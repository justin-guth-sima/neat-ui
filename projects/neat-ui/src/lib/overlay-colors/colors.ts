import { Injectable } from '@angular/core';
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

/** Hands out palette colours to identities; one per tile. */
export interface ColorAllocator {
  /** The colour of `identity`, recording that it was drawn at `now`. */
  colorFor(channelIndex: number, namespace: ColorNamespace, identity: unknown, now: number): string;
  /** Drops the track and pose colours. Class colours are the page's and stay. */
  clear(): void;
  size(channelIndex: number, namespace: ColorNamespace): number;
}

/**
 * The page's overlay colour memory. Class colours are shared by every tile created with the same
 * instance, so one class has one colour on every tile; track and pose colours stay per tile.
 * Provided in root for the page; a test or a second, independent page creates its own. Apps only
 * pass it to `createOverlayState`; it has no members of its own.
 */
@Injectable({ providedIn: 'root' })
export class NeatOverlayColors {}

/**
 * Each instance's class colours, kept here so the service exposes nothing to apps. A WeakMap, so a
 * discarded instance takes its colours with it.
 */
const classColorsOf = new WeakMap<NeatOverlayColors, ColorMap>();

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
 * A tile's allocator: its track and pose colours are its own, its class colours are `colors`'.
 * Internal; `createOverlayState` calls it. One map per (channel, namespace), or the shared map for
 * classes.
 *
 * A new identity takes the lowest free slot. When every slot is held, it takes the slot whose
 * holders have all been absent for longer than RELEASE_AFTER_MS, the one absent longest first. An
 * identity drawn more recently than that is live, and a live identity never loses its slot: when
 * every slot is live, the newcomer shares the slot drawn longest ago. Ties go to the identity
 * inserted first. Each map is independent; timestamps in one map do not affect another. Every
 * tile draws with the page's clock, so `lastSeen` values from different tiles compare correctly.
 */
export function createColorAllocator(colors: NeatOverlayColors): ColorAllocator {
  // The first allocator of an instance creates its class map.
  const classColors = classColorsOf.get(colors) ?? createColorMap();
  classColorsOf.set(colors, classColors);
  const maps = new Map<string, ColorMap>();

  function mapFor(channelIndex: number, namespace: ColorNamespace): ColorMap {
    if (namespace === 'class') return classColors;
    const key = `${channelIndex}:${namespace}`;
    let map = maps.get(key);
    if (!map) {
      map = createColorMap();
      maps.set(key, map);
    }
    return map;
  }

  return {
    colorFor(channelIndex, namespace, identity, now) {
      const key = identityKey(identity);
      if (key === null) return OVERLAY_NEUTRAL_COLOR;
      const map = mapFor(channelIndex, namespace);
      const existing = map.holders.get(key);
      if (existing && !(isStale(existing, now) && separateFromSharers(map, key, existing, now))) {
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

    // Shared class colours stay: other tiles may be drawing them, and they release after
    // RELEASE_AFTER_MS like any identity.
    clear() {
      maps.clear();
    },

    size(channelIndex, namespace) {
      return mapFor(channelIndex, namespace).holders.size;
    },
  };
}

/**
 * The colour to draw an identity in: its override, then the `default` override for anything
 * unlisted, then the neutral colour for a missing identity, then the allocator's.
 */
export function resolveColor({
  allocator,
  channelIndex,
  namespace,
  identity,
  overrides,
  now,
}: {
  allocator: ColorAllocator;
  channelIndex: number;
  namespace: ColorNamespace;
  identity: unknown;
  overrides?: Readonly<Record<string, string>>;
  now: number;
}): string {
  const key = identityKey(identity);
  if (overrides) {
    // Labels come from the producer, so a label such as "constructor" can reach a plain object's
    // prototype; only string values count as overrides.
    const own: unknown = key === null ? undefined : overrides[key];
    if (typeof own === 'string') return own;
    const fallback: unknown = overrides['default'];
    if (typeof fallback === 'string') return fallback;
  }
  if (key === null) return OVERLAY_NEUTRAL_COLOR;
  return allocator.colorFor(channelIndex, namespace, key, now);
}
