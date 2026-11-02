import { computed, signal } from '@angular/core';
import type { NeatDiagram, NeatDiagramHighlight } from './model';
import type { Point } from './route';

/*
 * What is in focus on a diagram, ported from the Autoware demo's System page (`link-hover.ts`): a
 * block (the pointer over it, or the keyboard on its open button) or an edge (the pointer over its
 * hit path or its label), and the tip of that edge by the pointer. While something is in focus
 * the rest is dimmed, as far as the diagram's `highlight` allows (`highlighted`). The listeners
 * stay in `DiagramHover`, outside change detection; a signal changes only when what is in focus
 * does, and the tip follows the pointer by a style write.
 */

/** What the pointer or the keyboard is on. */
export interface DiagramFocus {
  readonly kind: 'block' | 'edge';
  readonly id: string;
}

/** The parts that stay as they are while something is in focus; the rest is dimmed. */
export interface FocusedParts {
  readonly nodes: ReadonlySet<string>;
  readonly edges: ReadonlySet<string>;
  readonly notes: ReadonlySet<string>;
}

/** The gap between the pointer and its tip, px on screen (the demo's). */
export const TIP_GAP = 14;

/**
 * What `highlight` lets dim the diagram out of `focus`: nothing for `none`, an edge only for
 * `edges`, anything for `all`. The tip of an edge follows the pointer whatever this answers.
 */
export function highlighted(
  focus: DiagramFocus | null,
  highlight: NeatDiagramHighlight,
): DiagramFocus | null {
  if (highlight === 'all') return focus;
  return highlight === 'edges' && focus?.kind === 'edge' ? focus : null;
}

/**
 * The parts in focus on `level`: a block with the edges that enter or leave it, an edge with the
 * nodes at its ends; with either, the notes on those edges. Null while nothing is in focus.
 */
export function focusedParts(level: NeatDiagram, focus: DiagramFocus | null): FocusedParts | null {
  if (!focus) return null;
  const nodes = new Set<string>();
  const edges = new Set<string>();
  if (focus.kind === 'block') {
    nodes.add(focus.id);
    for (const edge of level.edges) {
      if (edge.from === focus.id || edge.to === focus.id) edges.add(edge.id);
    }
  } else {
    edges.add(focus.id);
    const edge = level.edges.find((e) => e.id === focus.id);
    if (edge) nodes.add(edge.from).add(edge.to);
  }
  const notes = new Set(
    (level.notes ?? [])
      .filter((note) => note.edges?.some((id) => edges.has(id)))
      .map((note) => note.id),
  );
  return { nodes, edges, notes };
}

/**
 * Where a tip of `size` goes for the pointer `at`, in a box of `box` (px from its corner): below
 * and right of the pointer, a gap away; on the other side on an axis where that leaves the box;
 * and pushed into the box where neither side has room, so it is never cut off.
 */
export function placeTip(
  at: Point,
  size: { readonly w: number; readonly h: number },
  box: { readonly w: number; readonly h: number },
): { left: number; top: number } {
  const axis = (p: number, length: number, room: number) => {
    const after = p + TIP_GAP;
    if (after + length <= room) return after;
    const before = p - TIP_GAP - length;
    if (before >= 0) return before;
    return Math.max(0, Math.min(after, room - length));
  };
  return { left: axis(at.x, size.w, box.w), top: axis(at.y, size.h, box.h) };
}

const sameFocus = (a: DiagramFocus | null, b: DiagramFocus | null) =>
  a?.kind === b?.kind && a?.id === b?.id;

/**
 * What the pointer and the keyboard put in focus on one diagram's box, found by delegation (the
 * parts' `data-node` and `data-edge`), so no listener runs per part. Created outside the zone; its
 * listeners write a signal only when what is in focus changes.
 */
export class DiagramHover {
  private readonly pointer = signal<DiagramFocus | null>(null, { equal: sameFocus });
  /** The block whose open button has the focus. */
  private readonly keyboard = signal<string | null>(null);
  /** The pointer, px from the box's padding corner, for the tip. */
  private at: Point = { x: 0, y: 0 };

  /** The pointer's part, else the keyboard's block. */
  readonly focus = computed<DiagramFocus | null>(() => {
    const block = this.keyboard();
    return this.pointer() ?? (block === null ? null : { kind: 'block', id: block });
  });

  /** The edge whose tip shows: the one under the pointer. */
  readonly tipEdge = computed(() => {
    const focus = this.pointer();
    return focus?.kind === 'edge' ? focus.id : null;
  });

  constructor(
    private readonly box: HTMLElement,
    /** The tip's element while it is rendered. */
    private readonly tip: () => HTMLElement | undefined,
  ) {
    box.addEventListener('pointerover', this.over, { passive: true });
    box.addEventListener('pointermove', this.over, { passive: true });
    box.addEventListener('pointerleave', this.leave);
    box.addEventListener('focusin', this.focusIn);
    box.addEventListener('focusout', this.focusOut);
  }

  /** Puts the tip by the pointer, inside the box. Called on each move and once it renders. */
  place(): void {
    const tip = this.tip();
    if (!tip) return;
    const size = { w: tip.offsetWidth, h: tip.offsetHeight };
    const { left, top } = placeTip(this.at, size, {
      w: this.box.clientWidth,
      h: this.box.clientHeight,
    });
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  /** Nothing is in focus: a new level has other parts. */
  clear(): void {
    this.pointer.set(null);
    this.keyboard.set(null);
  }

  destroy(): void {
    this.box.removeEventListener('pointerover', this.over);
    this.box.removeEventListener('pointermove', this.over);
    this.box.removeEventListener('pointerleave', this.leave);
    this.box.removeEventListener('focusin', this.focusIn);
    this.box.removeEventListener('focusout', this.focusOut);
  }

  /**
   * The part under a mouse or a pen. Touch has no hover, and a held button is a drag of the
   * view, whose parts slide under the pointer: neither puts anything in focus.
   */
  private readonly over = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || event.buttons !== 0) return this.leave();
    const target = event.target instanceof Element ? event.target : null;
    const edge = this.inBox(target?.closest('[data-edge]'))?.getAttribute('data-edge');
    if (edge) {
      const corner = this.box.getBoundingClientRect();
      this.at = {
        x: event.clientX - corner.left - this.box.clientLeft,
        y: event.clientY - corner.top - this.box.clientTop,
      };
      this.pointer.set({ kind: 'edge', id: edge });
      this.place();
      return;
    }
    const block = this.inBox(target?.closest('.block[data-node]'))?.getAttribute('data-node');
    this.pointer.set(block ? { kind: 'block', id: block } : null);
  };

  private readonly leave = (): void => this.pointer.set(null);

  /**
   * An open button the keyboard focuses. A press on a block focuses its button too (d3-zoom lets
   * the press through), and after a pan from it the block would stay in focus with the rest
   * dimmed and no ring to say why; `:focus-visible` is the browser's word for the keyboard's.
   */
  private readonly focusIn = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const keyboard = target?.matches('.block[data-node]:focus-visible');
    this.keyboard.set(keyboard ? target!.getAttribute('data-node') : null);
  };

  private readonly focusOut = (): void => this.keyboard.set(null);

  /** `element` if it is one of this box's parts, not an ancestor of the box's. */
  private inBox(element: Element | null | undefined): Element | null {
    return element && element !== this.box && this.box.contains(element) ? element : null;
  }
}
