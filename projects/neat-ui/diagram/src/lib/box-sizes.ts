import {
  Directive,
  ElementRef,
  inject,
  Injectable,
  input,
  NgZone,
  type OnDestroy,
  type OnInit,
  signal,
} from '@angular/core';

/*
 * Boxes whose size only the browser knows: a note's content is the app's, and a note is placed
 * from its size (`placeNotes`); an edge label's text sets its width, and the dots are kept off it
 * by its box. One ResizeObserver per kind and diagram measures the rendered boxes; it stays here,
 * apart from the component (AGENTS.md: raw browser APIs stay isolated), and writes one signal,
 * only when a size changes. ResizeObserver reports layout sizes, which a zoom's CSS transform does
 * not change, so the sizes are diagram units.
 */

export interface BoxSize {
  readonly w: number;
  readonly h: number;
}

/** The measured size of each box with content, by its part's id. */
@Injectable()
abstract class BoxSizes implements OnDestroy {
  private readonly measured = signal<ReadonlyMap<string, BoxSize>>(new Map());
  /** The sizes so far; a box without content, or not laid out yet, has none. */
  readonly sizes = this.measured.asReadonly();
  private readonly ids = new Map<Element, string>();
  private readonly zone = inject(NgZone);
  private observer: ResizeObserver | null = null;

  observe(box: HTMLElement, id: string): void {
    this.ids.set(box, id);
    // Outside the zone, so a zone.js app runs no change detection for every report; the signal
    // it writes when a size changes is what schedules the render.
    this.observer ??= this.zone.runOutsideAngular(
      () => new ResizeObserver((entries) => this.read(entries)),
    );
    this.observer.observe(box, { box: 'border-box' });
  }

  unobserve(box: HTMLElement): void {
    const id = this.ids.get(box);
    this.ids.delete(box);
    this.observer?.unobserve(box);
    if (id !== undefined) this.write([[id, null]]);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private read(entries: readonly ResizeObserverEntry[]): void {
    this.write(
      entries.flatMap((entry) => {
        const id = this.ids.get(entry.target);
        return id === undefined ? [] : [[id, sizeOf(entry)] as const];
      }),
    );
  }

  private write(changes: readonly (readonly [string, BoxSize | null])[]): void {
    let next: Map<string, BoxSize> | null = null;
    for (const [id, size] of changes) {
      const known = (next ?? this.measured()).get(id);
      if (known?.w === size?.w && known?.h === size?.h) continue;
      next ??= new Map(this.measured());
      if (size) next.set(id, size);
      else next.delete(id);
    }
    if (next) this.measured.set(next);
  }
}

/**
 * A box's border-box size, or null when there is nothing to place: a box the app's template left
 * empty (only Angular's comment anchors in it), or one without a size (in a hidden tab), which is
 * measured again once it has one.
 */
function sizeOf(entry: ResizeObserverEntry): BoxSize | null {
  const [border] = entry.borderBoxSize ?? [];
  if (!border || border.inlineSize <= 0 || border.blockSize <= 0) return null;
  const content = Array.from(entry.target.childNodes).some(
    (child) =>
      child.nodeType === Node.ELEMENT_NODE ||
      (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()),
  );
  return content ? { w: border.inlineSize, h: border.blockSize } : null;
}

/** The note boxes' sizes, by note id. Provided by the diagram. */
@Injectable()
export class NoteSizes extends BoxSizes {}

/** The edge labels' sizes, by edge id. Provided by the diagram. */
@Injectable()
export class EdgeLabelSizes extends BoxSizes {}

/** Puts a note's box under the diagram's measurement while it is rendered. */
@Directive({ selector: '[neatDiagramNoteBox]' })
export class NoteBox implements OnInit, OnDestroy {
  /** The note's id. */
  readonly id = input.required<string>({ alias: 'neatDiagramNoteBox' });
  private readonly box = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly sizes = inject(NoteSizes);

  ngOnInit(): void {
    this.sizes.observe(this.box, this.id());
  }

  ngOnDestroy(): void {
    this.sizes.unobserve(this.box);
  }
}

/** Puts an edge label under the diagram's measurement while it is rendered. */
@Directive({ selector: '[neatDiagramEdgeLabelBox]' })
export class EdgeLabelBox implements OnInit, OnDestroy {
  /** The edge's id. */
  readonly id = input.required<string>({ alias: 'neatDiagramEdgeLabelBox' });
  private readonly box = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly sizes = inject(EdgeLabelSizes);

  ngOnInit(): void {
    this.sizes.observe(this.box, this.id());
  }

  ngOnDestroy(): void {
    this.sizes.unobserve(this.box);
  }
}
