import { Injectable, signal, type WritableSignal } from '@angular/core';
import { OVERLAY_NEUTRAL_COLOR, OVERLAY_PALETTE } from '../theme/identity-palette';

/** An identity that has not been drawn for this long no longer holds its slot. */
export const RELEASE_AFTER_MS = 5000;

/**
 * What an identity names. A class label names the same thing on every channel; track and pose
 * ids are only unique within one stream.
 */
export type ColorNamespace = 'class' | 'track' | 'pose';

interface SlotHolder {
  slot: number;
  lastSeen: number;
  /** Insertion order within the map, the tie-break between equal `lastSeen` values. */
  order: number;
}

/** Identity -> slot holder, for one channel and namespace or for the page's classes. */
interface ColorMap {
  readonly holders: Map<string, SlotHolder>;
  insertions: number;
}

function createColorMap(): ColorMap {
  return { holders: new Map(), insertions: 0 };
}

/** The page's class colors, and a count that moves whenever one is given or taken back. */
interface ClassColors {
  readonly map: ColorMap;
  readonly changes: WritableSignal<number>;
}

/** Hands out palette colors to identities; one per tile. */
export interface ColorAllocator {
  /** The color of `identity`, recording that it was drawn at `now`. */
  colorFor(channelIndex: number, namespace: ColorNamespace, identity: unknown, now: number): string;
  /**
   * The color `identity` holds, without recording a draw; null for one that holds none (not drawn
   * yet, or forgotten). It reads a signal that changes whenever a color of its map is given or taken
   * back, so a computed or a template that calls it follows: the page's for classes, the
   * allocator's own for tracks and poses.
   */
  held(channelIndex: number, namespace: ColorNamespace, identity: unknown): string | null;
  /** Drops the track and pose colors. Class colors are the page's and stay. */
  clear(): void;
  size(channelIndex: number, namespace: ColorNamespace): number;
}

/**
 * The page's overlay color memory. Class colors are shared by every tile created with the same
 * instance, so one class has one color on every tile; track and pose colors stay per tile.
 * Provided in root for the page; a test or a second, independent page creates its own. Apps only
 * pass it to `createOverlayState`; it has no members of its own.
 */
@Injectable({ providedIn: 'root' })
export class NeatOverlayColors {}

/**
 * Each instance's class colors, kept here so the service exposes nothing to apps. A WeakMap, so a
 * discarded instance takes its colors with it.
 */
const classColorsOf = new WeakMap<NeatOverlayColors, ClassColors>();

function bump(changes: WritableSignal<number>): void {
  changes.update((count) => count + 1);
}

function identityKey(identity: unknown): string | null {
  if (identity === null || identity === undefined) return null;
  const text = String(identity);
  return text === '' ? null : text;
}

function isStale(holder: SlotHolder, now: number): boolean {
  return now - holder.lastSeen > RELEASE_AFTER_MS;
}

function olderThan(a: SlotHolder, b: SlotHolder): boolean {
  return a.lastSeen < b.lastSeen || (a.lastSeen === b.lastSeen && a.order < b.order);
}

interface Holding {
  key: string;
  holder: SlotHolder;
}

/** Holders grouped by slot, in insertion order. */
function holdersBySlot(map: ColorMap): Map<number, Holding[]> {
  const bySlot = new Map<number, Holding[]>();
  for (const [key, holder] of map.holders) {
    const group = bySlot.get(holder.slot);
    if (group) group.push({ key, holder });
    else bySlot.set(holder.slot, [{ key, holder }]);
  }
  return bySlot;
}

/**
 * Drops stale identities that share a slot with another identity, keeping the most recently seen
 * one when all of them are stale. Nothing on screen is affected, and the map stays bounded while a
 * channel runs above the palette size.
 */
function pruneStaleSharers(map: ColorMap, now: number): void {
  for (const group of holdersBySlot(map).values()) {
    if (group.length < 2) continue;
    const stale = group.filter(({ holder }) => isStale(holder, now));
    if (stale.length === group.length) {
      stale.sort((a, b) => (olderThan(a.holder, b.holder) ? 1 : -1));
      stale.shift();
    }
    for (const { key } of stale) map.holders.delete(key);
  }
}

/**
 * A stale identity that comes back to a shared slot should not keep colliding. Stale sharers are
 * dropped so it keeps its slot. If a live identity holds the slot, the returning one is dropped
 * instead, to be allocated afresh; returns true then.
 */
function separateFromSharers(map: ColorMap, key: string, holder: SlotHolder, now: number): boolean {
  let live = false;
  for (const [otherKey, other] of map.holders) {
    if (otherKey === key || other.slot !== holder.slot) continue;
    if (isStale(other, now)) map.holders.delete(otherKey);
    else live = true;
  }
  if (live) map.holders.delete(key);
  return live;
}

function freeSlot(map: ColorMap): number {
  const used = new Set<number>();
  for (const holder of map.holders.values()) used.add(holder.slot);
  for (let slot = 0; slot < OVERLAY_PALETTE.length; slot += 1) {
    if (!used.has(slot)) return slot;
  }
  return -1;
}

/**
 * The slot of the stale identity absent longest, dropping that identity; -1 when every identity is
 * live. Called after pruneStaleSharers, so a stale identity is the only holder of its slot.
 */
function reclaimStaleSlot(map: ColorMap, now: number): number {
  let oldest: Holding | null = null;
  for (const [key, holder] of map.holders) {
    if (isStale(holder, now) && (oldest === null || olderThan(holder, oldest.holder))) {
      oldest = { key, holder };
    }
  }
  if (oldest === null) return -1;
  map.holders.delete(oldest.key);
  return oldest.holder.slot;
}

/**
 * The slot drawn longest ago, judged by its most recently seen holder, so that newcomers arriving
 * in one frame spread over different slots. Only called on a full map, so a slot is always found.
 */
function sharedSlot(map: ColorMap): number {
  let chosen: SlotHolder | null = null;
  for (const [slot, group] of holdersBySlot(map)) {
    const latest = group.reduce((a, b) => (olderThan(a.holder, b.holder) ? b : a)).holder;
    const candidate = { slot, lastSeen: latest.lastSeen, order: latest.order };
    if (chosen === null || olderThan(candidate, chosen)) chosen = candidate;
  }
  return chosen?.slot ?? 0;
}

/**
 * A tile's allocator: its track and pose colors are its own, its class colors are `colors`'.
 * Internal; `createOverlayState` calls it. One map per (channel, namespace), or the shared map for
 * classes.
 *
 * A new identity takes the lowest free slot. When every slot is held, it takes the slot whose
 * holders have all been absent for longer than RELEASE_AFTER_MS, the one absent longest first. An
 * identity drawn more recently than that is live, and a live identity never loses its slot: when
 * every slot is live, the newcomer shares the slot drawn longest ago. Ties go to the identity
 * inserted first. Each map is independent; timestamps in one map do not affect another. Every
 * tile draws with the page's clock, so `lastSeen` values from different tiles compare correctly.
 *
 * `held` reads a color without drawing, for the tile's and the view's `colorOf`. So that a list
 * beside them follows, the page's class map and each allocator's own maps have a signal that moves
 * when a color is given or taken back, never when an identity is merely drawn again.
 */
export function createColorAllocator(colors: NeatOverlayColors): ColorAllocator {
  // The first allocator of an instance creates its class map.
  const classColors = classColorsOf.get(colors) ?? {
    map: createColorMap(),
    changes: signal(0),
  };
  classColorsOf.set(colors, classColors);
  const maps = new Map<string, ColorMap>();
  /** Moves whenever a track or pose color of this allocator is given or taken back. */
  const ownChanges = signal(0);

  function mapFor(channelIndex: number, namespace: ColorNamespace): ColorMap {
    if (namespace === 'class') return classColors.map;
    const key = `${channelIndex}:${namespace}`;
    let map = maps.get(key);
    if (!map) {
      map = createColorMap();
      maps.set(key, map);
    }
    return map;
  }

  function changesOf(namespace: ColorNamespace): WritableSignal<number> {
    return namespace === 'class' ? classColors.changes : ownChanges;
  }

  return {
    colorFor(channelIndex, namespace, identity, now) {
      const key = identityKey(identity);
      if (key === null) return OVERLAY_NEUTRAL_COLOR;
      const map = mapFor(channelIndex, namespace);
      const existing = map.holders.get(key);
      // The common case, an identity drawn a moment ago, changes no color and writes no signal.
      if (existing && !isStale(existing, now)) {
        existing.lastSeen = now;
        return OVERLAY_PALETTE[existing.slot];
      }
      // Everything below may give or take back a color.
      bump(changesOf(namespace));
      if (existing && !separateFromSharers(map, key, existing, now)) {
        existing.lastSeen = now;
        return OVERLAY_PALETTE[existing.slot];
      }
      let slot = freeSlot(map);
      if (slot < 0) {
        pruneStaleSharers(map, now);
        slot = reclaimStaleSlot(map, now);
      }
      if (slot < 0) slot = sharedSlot(map);
      map.insertions += 1;
      map.holders.set(key, { slot, lastSeen: now, order: map.insertions });
      return OVERLAY_PALETTE[slot];
    },

    held(channelIndex, namespace, identity) {
      // Read first, so a caller follows the map even while the identity holds nothing.
      changesOf(namespace)();
      const key = identityKey(identity);
      if (key === null) return OVERLAY_NEUTRAL_COLOR;
      const map =
        namespace === 'class' ? classColors.map : maps.get(`${channelIndex}:${namespace}`);
      const holder = map?.holders.get(key);
      return holder === undefined ? null : OVERLAY_PALETTE[holder.slot];
    },

    // Shared class colors stay: other tiles may be drawing them, and they release after
    // RELEASE_AFTER_MS like any identity.
    clear() {
      if (maps.size === 0) return;
      maps.clear();
      bump(ownChanges);
    },

    size(channelIndex, namespace) {
      return mapFor(channelIndex, namespace).holders.size;
    },
  };
}

/** What `resolveColor` and `heldColor` look an identity's color up with. */
export interface ColorQuery {
  allocator: ColorAllocator;
  channelIndex: number;
  namespace: ColorNamespace;
  identity: unknown;
  /** The style rows' colors, by label. */
  overrides?: Readonly<Record<string, string>>;
  /**
   * What `overrides` are looked up by, when it is not the identity: a pose is colored by its id
   * and styled by its label.
   */
  label?: unknown;
}

/**
 * The color to draw an identity in: its override, then the `default` override for anything
 * unlisted, then the neutral color for a missing identity, then the allocator's.
 */
export function resolveColor(query: ColorQuery & { now: number }): string {
  const { allocator, channelIndex, namespace, identity, now } = query;
  return overrideFor(query) ?? allocator.colorFor(channelIndex, namespace, identity, now);
}

/**
 * The color `resolveColor` gave the identity, without recording a draw: its override, else the
 * color the allocator holds for it (`ColorAllocator.held`), null while it holds none.
 */
export function heldColor(query: ColorQuery): string | null {
  const { allocator, channelIndex, namespace, identity } = query;
  return overrideFor(query) ?? allocator.held(channelIndex, namespace, identity);
}

/** The override for the query's label: its own row's color, then the `default` row's. */
function overrideFor({ identity, overrides, ...query }: ColorQuery): string | null {
  if (!overrides) return null;
  const key = identityKey('label' in query ? query.label : identity);
  // Labels come from the producer, so a label such as "constructor" can reach a plain object's
  // prototype; only string values count as overrides.
  const own: unknown = key === null ? undefined : overrides[key];
  if (typeof own === 'string') return own;
  const fallback: unknown = overrides['default'];
  return typeof fallback === 'string' ? fallback : null;
}
