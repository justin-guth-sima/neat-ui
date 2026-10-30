import {
  Directive,
  ElementRef,
  inject,
  Injectable,
  input,
  type OnDestroy,
  type OnInit,
  signal,
} from '@angular/core';

/*
 * A note's content is the app's, so only the browser knows how big its box is, and a note is
 * placed from its size (`placeNotes`). One ResizeObserver per diagram measures the rendered boxes;
 * it stays here, apart from the component (AGENTS.md: raw browser APIs stay isolated), and writes
 * one signal, only when a size changes. ResizeObserver reports layout sizes, which a zoom's CSS
 * transform does not change, so the sizes are diagram units.
 */

export interface NoteSize {
  readonly w: number;
  readonly h: number;
}

/** The measured size of each note box with content, by note id. Provided by the diagram. */
@Injectable()
export class NoteSizes implements OnDestroy {
  private readonly measured = signal<ReadonlyMap<string, NoteSize>>(new Map());
  /** The sizes so far; a note without content, or not laid out yet, has none. */
  readonly sizes = this.measured.asReadonly();
  private readonly ids = new Map<Element, string>();
  private observer: ResizeObserver | null = null;

  observe(box: HTMLElement, id: string): void {
    this.ids.set(box, id);
    this.observer ??= new ResizeObserver((entries) => this.read(entries));
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

  private write(changes: readonly (readonly [string, NoteSize | null])[]): void {
    let next: Map<string, NoteSize> | null = null;
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
function sizeOf(entry: ResizeObserverEntry): NoteSize | null {
  const [border] = entry.borderBoxSize ?? [];
  if (!border || border.inlineSize <= 0 || border.blockSize <= 0) return null;
  const content = Array.from(entry.target.childNodes).some(
    (child) =>
      child.nodeType === Node.ELEMENT_NODE ||
      (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()),
  );
  return content ? { w: border.inlineSize, h: border.blockSize } : null;
}

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
