import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  input,
} from '@angular/core';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';
import { BRACE_HEIGHT, drawLevel } from './drawing';
import type { NeatDiagramSet } from './model';
import { NoteBox, NoteSizes } from './note-sizes';
import { placeNotes } from './notes';
import { firstOfEachId } from './report';
import { NeatDiagramBlockTemplate, NeatDiagramNoteTemplate } from './templates';

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
 */
@Component({
  selector: 'neat-diagram',
  imports: [NgTemplateOutlet, NeatStatusChip, NoteBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NoteSizes],
  host: { role: 'figure', '[attr.aria-label]': 'label()' },
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
}
