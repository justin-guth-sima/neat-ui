import { Directive, effect, input, signal, untracked } from '@angular/core';
import {
  DIAGRAM_MESSAGES_CONTEXT,
  type DiagramMessagesContext,
  type DiagramTransform,
  type MessagesLevel,
  type Rect,
} from '@bench/diagram-seam';

/**
 * The dot layer's context over a host other than `neat-diagram` (design 3.2, the
 * `VflowDiagramContext` there): on the positioned box that holds the drawing and the
 * `neat-diagram-messages` over it, it gives the layer what `neat-diagram` would, from the host's
 * bindings: the kit's routes as the level, the cards as covers, every edge id, and the transform
 * the drawing is shown at. The vflow host binds vflow's viewport, the none host its fixed fit;
 * so one directive serves both, and the layer under it is the kit's own, unchanged.
 *
 * Nothing is ever in focus: the bench exercises no hover (design 3.3). A new `viewTransform`
 * reaches the listeners when the host's change detection binds it, the pass in which vflow writes
 * its own viewport to the DOM.
 */
@Directive({
  selector: '[benchDiagramContext]',
  providers: [{ provide: DIAGRAM_MESSAGES_CONTEXT, useExisting: BenchDiagramContext }],
})
export class BenchDiagramContext implements DiagramMessagesContext {
  readonly level = input.required<MessagesLevel>();
  readonly covers = input.required<readonly Rect[]>();
  readonly edgeIds = input.required<ReadonlySet<string>>();
  /** Diagram units to px in the box, as the drawing below is shown now. */
  readonly viewTransform = input.required<DiagramTransform>();
  readonly focus = signal<ReadonlySet<string> | null>(null).asReadonly();
  private readonly listeners = new Set<() => void>();

  constructor() {
    effect(() => {
      this.viewTransform();
      untracked(() => this.listeners.forEach((listener) => listener()));
    });
  }

  /** A plain read, as the layer reads it per frame: no signal dependency is made. */
  transform(): DiagramTransform {
    return untracked(this.viewTransform);
  }

  onTransform(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
