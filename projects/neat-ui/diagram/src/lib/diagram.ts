import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  untracked,
  viewChild,
} from '@angular/core';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';
import { BRACE_HEIGHT, drawLevel } from './drawing';
import { levelExtent } from './fit';
import type { NeatDiagramSet } from './model';
import { NoteBox, NoteSizes } from './note-sizes';
import { placeNotes } from './notes';
import { firstOfEachId } from './report';
import { NeatDiagramBlockTemplate, NeatDiagramNoteTemplate } from './templates';
import { DiagramZoom } from './zoom';

/**
 * A hand-placed diagram in the kit's look:
 *
 * ```html
 * <neat-diagram [diagram]="system" label="The demo's system">
 *   <ng-template neatDiagramNote let-note>…</ng-template>
 * </neat-diagram>
 * ```
 *
 * Frames and bands are drawn behind one SVG of edges, blocks, brackets, edge labels and notes in
 * front of it, all in one container (what pan and zoom move). Every part is keyed by its id, so a
 * new diagram object with the same content (an app recomputing it on every poll) changes nothing
 * in the DOM, and a moved node is the same element, moved. A part whose ids name nothing is left
 * out and named once in dev mode; the rest is drawn.
 *
 * The host is a `figure` named by `label`; it fills the box the app gives it and clips what lies
 * outside. Chips are the kit's status chips; a block's body and the notes' content are the app's
 * templates (`neatDiagramBlock`, `neatDiagramNote`).
 *
 * The user pans and zooms it (drag, wheel, pinch, double-click; with the box focused, the arrow
 * keys, `+`, `-` and `0`); it fits its level to the box by itself until they do, and `fit()` fits
 * it again (`DiagramZoom`). It takes the wheel and touch over its box (`touch-action: none`), so
 * give it a bounded box, not a long stretch of a scrolling page.
 */
@Component({
  selector: 'neat-diagram',
  imports: [NgTemplateOutlet, NeatStatusChip, NoteBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NoteSizes],
  host: { role: 'figure', '[attr.aria-label]': 'label()', tabindex: '0' },
  templateUrl: './diagram.html',
  styleUrls: ['./frames.css', './blocks.css', './diagram.css'],
})
export class NeatDiagramView {
  /** The overview and its drill-down levels. */
  readonly diagram = input.required<NeatDiagramSet>();
  /** The figure's accessible name: what the diagram shows. */
  readonly label = input.required<string>();

  protected readonly blockTemplate = contentChild(NeatDiagramBlockTemplate);
  protected readonly noteTemplate = contentChild(NeatDiagramNoteTemplate);
  private readonly noteSizes = inject(NoteSizes);
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private zoom: DiagramZoom | null = null;
  private readonly zone = inject(NgZone);

  protected readonly BRACE_HEIGHT = BRACE_HEIGHT;

  /** The level shown. */
  private readonly shown = computed(() => this.diagram().overview);

  protected readonly level = computed(() =>
    drawLevel(this.shown(), new Set(Object.keys(this.diagram().levels ?? {}))),
  );

  /** The level's notes, each drawn (and measured) only while the app has a note template. */
  protected readonly notes = computed(() => firstOfEachId(this.shown().notes ?? [], 'note'));

  /** Where each measured note goes, by id. */
  protected readonly placements = computed(() =>
    placeNotes(this.shown(), this.level().layouts, this.noteSizes.sizes()),
  );

  /** What a fit frames: the level's nodes, edges and placed notes. */
  private readonly extent = computed(() =>
    levelExtent(
      this.level(),
      [...this.placements().values()].map((placement) => placement.box),
    ),
  );

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // After a render, so the content container exists; d3-zoom's listeners run outside the zone.
    afterRenderEffect(() => {
      const extent = this.extent();
      untracked(() => {
        this.zoom ??= this.zone.runOutsideAngular(
          () => new DiagramZoom(host, this.content().nativeElement),
        );
        this.zoom.setExtent(extent);
      });
    });
    inject(DestroyRef).onDestroy(() => this.zoom?.destroy());
  }

  /** Fits the level to the box, animated unless reduced motion; it then fits by itself again. */
  fit(): void {
    // Outside the zone, so its animation frames run no change detection in a zone.js app.
    this.zone.runOutsideAngular(() => this.zoom?.fit());
  }
}
