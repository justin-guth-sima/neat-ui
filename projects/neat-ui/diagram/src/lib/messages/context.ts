import { inject, Injectable, InjectionToken, type Provider, type Signal } from '@angular/core';
import type { Rect } from '../layout';
import type { NeatDiagramEdge } from '../model';
import type { Point } from '../route';

/*
 * What the messaging layer needs of the diagram it draws over, and nothing more: the drawn level's
 * edges, the cards its dots pass behind, which edges are in focus, the transform and a hook for
 * when the transform changes. `neat-diagram` provides it to the layer projected into it; a host
 * other than `neat-diagram` (the benchmark's, over another renderer) can provide the same token,
 * so the layer draws over it with the same code. Internal: none of this is public API.
 */

/** Diagram units to px in the layer's box: `x * k + x0`, `y * k + y0`, as d3-zoom's transform. */
export interface DiagramTransform {
  readonly k: number;
  readonly x: number;
  readonly y: number;
}

/** The transform before any pan or zoom. */
export const IDENTITY_TRANSFORM: DiagramTransform = Object.freeze({ k: 1, x: 0, y: 0 });

/** A drawn edge as the layer needs it: its ends (for the step chains), colour and route. */
export interface MessagesEdge extends Pick<
  NeatDiagramEdge,
  'id' | 'from' | 'to' | 'series' | 'line'
> {
  /** Its route's corners, ends included, in diagram units (`EdgeLayout.points`). */
  readonly points: readonly Point[];
}

/** The level drawn, for the dots. */
export interface MessagesLevel {
  /**
   * Which level it is; another key is another level, whose edges are other edges (the dots on
   * their way are cleared). The same key with new edges is the same level laid out anew.
   */
  readonly key: string;
  readonly edges: readonly MessagesEdge[];
}

export interface DiagramMessagesContext {
  /** The level drawn. A new value is a new layout, which the layer samples once. */
  readonly level: Signal<MessagesLevel>;
  /**
   * The cards the dots pass behind (blocks, placed notes and edge labels), in diagram units: dots
   * are drawn on a canvas over the whole drawing, so without this they would run over the card
   * they enter and through the text of a label on their edge.
   */
  readonly covers: Signal<readonly Rect[]>;
  /**
   * Every edge id of every level: the ids whose messages the layer counts, so a push for an id
   * that names no edge costs no memory.
   */
  readonly edgeIds: Signal<ReadonlySet<string>>;
  /** The edges in focus while something is (the rest are dimmed); null while nothing is. */
  readonly focus: Signal<ReadonlySet<string> | null>;
  /** The transform now. A plain read, not a signal: it changes on every pan and zoom event. */
  transform(): DiagramTransform;
  /** Calls `listener` after each change of the transform, until the returned function is called. */
  onTransform(listener: () => void): () => void;
}

/** The context of the diagram the layer is projected into. */
export const DIAGRAM_MESSAGES_CONTEXT = new InjectionToken<DiagramMessagesContext>(
  'the diagram neat-diagram-messages draws over',
);

/**
 * Where `neat-diagram` puts the context it makes from its own state, in its constructor: before
 * the layer projected into it is created and injects the context.
 */
@Injectable()
export class DiagramMessagesSlot {
  context: DiagramMessagesContext | null = null;
}

/** For `neat-diagram`'s providers: the context, from the slot its constructor fills. */
export function provideDiagramMessagesContext(): Provider[] {
  return [
    DiagramMessagesSlot,
    { provide: DIAGRAM_MESSAGES_CONTEXT, useFactory: () => inject(DiagramMessagesSlot).context },
  ];
}

/**
 * Told once per frame the layer draws: how long its drawing took (ms of script, measured with
 * `performance.now()`) and how many dots it drew. For the benchmark; absent in apps, where it
 * costs one check per frame.
 */
export type DotFrameProbe = (drawMs: number, dotsDrawn: number) => void;

export const DOT_FRAME_PROBE = new InjectionToken<DotFrameProbe>('DOT_FRAME_PROBE');
