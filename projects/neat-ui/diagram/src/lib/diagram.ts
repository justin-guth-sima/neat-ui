import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  NgZone,
  untracked,
  viewChild,
} from '@angular/core';
import { NeatButton, NeatIcon, NeatInlineButton } from '@sima/neat-ui';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';
import { BRACE_HEIGHT, describeLevel, drawLevel } from './drawing';
import { levelExtent } from './fit';
import { DiagramHover, focusedParts } from './hover';
import { samePath, walkLevels } from './levels';
import type { NeatDiagramNode, NeatDiagramSet } from './model';
import { NoteBox, NoteSizes } from './note-sizes';
import { placeNotes } from './notes';
import { firstOfEachId } from './report';
import {
  NeatDiagramBlockTemplate,
  NeatDiagramEdgeTipTemplate,
  NeatDiagramNoteTemplate,
} from './templates';
import { DiagramZoom } from './zoom';

/**
 * A hand-placed diagram in the kit's look:
 *
 * ```html
 * <neat-diagram [diagram]="system" label="The demo's system" [(level)]="level">
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
 * outside. Chips are the kit's status chips; a block's body, the notes' content and the tip of
 * the edge under the pointer are the app's templates (`neatDiagramBlock`, `neatDiagramNote`,
 * `neatDiagramEdgeTip`). A visually hidden list after the drawing says the level's nodes and
 * edges in words.
 *
 * A block or an edge under the pointer, or a block whose open button has the focus, is in focus
 * with what it is joined to; the rest is dimmed. A block that opens a level is a button that opens
 * it; `level` is the path of open levels, which an app can bind to its route, and the bar over the
 * drawing goes back and shows the path. A path that leads nowhere (a stale route) is cut to the
 * part that does, and the model is set to it; so render the diagram once its data is there, since
 * a routed path is checked against the diagram given, a placeholder too.
 *
 * The user pans and zooms it (drag, wheel, pinch, double-click; with the box focused, the arrow
 * keys, `+`, `-` and `0`); it fits its level to the box by itself until they do, and `fit()` fits
 * it again (`DiagramZoom`). It takes the wheel and touch over its box (`touch-action: none`), so
 * give it a bounded box, not a long stretch of a scrolling page.
 */
@Component({
  selector: 'neat-diagram',
  imports: [NeatButton, NeatIcon, NeatInlineButton, NeatStatusChip, NgTemplateOutlet, NoteBox],
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
  /**
   * The path of open levels, ids of `diagram().levels`, each opened by a block of the level before
   * it; `[]` for the overview. Set by the open buttons, the back button and the breadcrumbs.
   */
  readonly level = model<string[]>([]);

  protected readonly blockTemplate = contentChild(NeatDiagramBlockTemplate);
  protected readonly noteTemplate = contentChild(NeatDiagramNoteTemplate);
  private readonly edgeTipTemplate = contentChild(NeatDiagramEdgeTipTemplate);
  private readonly noteSizes = inject(NoteSizes);
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private readonly tipBox = viewChild<ElementRef<HTMLElement>>('tip');
  private readonly bar = viewChild<ElementRef<HTMLElement>>('bar');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly zone = inject(NgZone);
  private zoom: DiagramZoom | null = null;
  private readonly hover = this.zone.runOutsideAngular(
    () => new DiagramHover(this.host, () => this.tipBox()?.nativeElement),
  );

  protected readonly BRACE_HEIGHT = BRACE_HEIGHT;

  private readonly walked = computed(() => walkLevels(this.diagram(), this.level()));

  /** The path as far as it leads: the levels shown. */
  private readonly path = computed(() => this.walked().path, { equal: samePath });

  /** The level shown: the one at the end of the path. */
  private readonly shown = computed(() => this.walked().shown);

  /** The block that opens each level of the path, which names it in the level bar. */
  protected readonly crumbs = computed(() => this.walked().openers);

  /** What the back button goes to: the level before this one, or the overview. */
  protected readonly backTo = computed(() => this.crumbs().at(-2)?.label ?? 'Overview');

  protected readonly drawn = computed(() =>
    drawLevel(this.shown(), new Set(Object.keys(this.diagram().levels ?? {}))),
  );

  /** The level's notes, each drawn (and measured) only while the app has a note template. */
  protected readonly notes = computed(() => firstOfEachId(this.shown().notes ?? [], 'note'));

  /** Where each measured note goes, by id. */
  protected readonly placements = computed(() =>
    placeNotes(this.shown(), this.drawn().layouts, this.noteSizes.sizes()),
  );

  /** What a fit frames: the level's nodes, edges and placed notes. */
  private readonly extent = computed(() =>
    levelExtent(
      this.drawn(),
      [...this.placements().values()].map((placement) => placement.box),
    ),
  );

  /** The parts in focus while something is (the rest is dimmed); null while nothing is. */
  protected readonly focused = computed(() => focusedParts(this.shown(), this.hover.focus()));

  /** The tip of the edge under the pointer, while the app has a tip template. */
  protected readonly edgeTip = computed(() => {
    const template = this.edgeTipTemplate()?.template;
    const id = this.hover.tipEdge();
    const edge = this.drawn().edges.find((drawn) => drawn.id === id)?.edge;
    return template && edge ? { template, edge } : null;
  });

  /** The level in words, for the hidden list. */
  protected readonly described = computed(() => describeLevel(this.drawn()));

  constructor() {
    // A path cut to where it leads goes back to the app (a stale route is corrected).
    effect(() => {
      const path = this.path();
      if (!samePath(path, this.level())) this.level.set([...path]);
    });

    // After a render, so the content container exists; d3-zoom's listeners run outside the zone.
    let shownPath: readonly string[] | null = null;
    afterRenderEffect(() => {
      const extent = this.extent();
      const path = this.path();
      const bar = this.bar()?.nativeElement ?? null;
      untracked(() => {
        this.zoom ??= this.zone.runOutsideAngular(
          () => new DiagramZoom(this.host, this.content().nativeElement),
        );
        // A fit leaves the bar's height free, so the level does not start under it.
        this.zoom.setTopInset(bar);
        this.zoom.setExtent(extent);
        if (shownPath !== null && path !== shownPath) {
          // A new level has other parts: nothing stays in focus, and it fits afresh.
          this.hover.clear();
          this.zoom.levelChanged();
        }
        shownPath = path;
      });
    });

    // The tip, once rendered for a new edge, goes by the pointer.
    afterRenderEffect(() => {
      this.edgeTip();
      untracked(() => this.hover.place());
    });

    inject(DestroyRef).onDestroy(() => {
      this.zoom?.destroy();
      this.hover.destroy();
    });
  }

  /** Fits the level to the box, animated unless reduced motion; it then fits by itself again. */
  fit(): void {
    // Outside the zone, so its animation frames run no change detection in a zone.js app.
    this.zone.runOutsideAngular(() => this.zoom?.fit());
  }

  /** Opens the level `block` opens, one deeper than the level shown. */
  protected open(block: NeatDiagramNode): void {
    if (block.opens !== undefined) this.go([...this.path(), block.opens]);
  }

  /** Goes back to the level before this one. */
  protected back(): void {
    this.go(this.path().slice(0, -1));
  }

  /** Goes to the level at `index` of the path (a breadcrumb). */
  protected goTo(index: number): void {
    this.go(this.path().slice(0, index + 1));
  }

  /**
   * The control pressed may leave with its level (an open button, the last level's breadcrumb,
   * the bar on the way to the overview); the focus then stays in the diagram, on its box, instead
   * of falling to the page.
   */
  private go(path: string[]): void {
    this.level.set(path);
    afterNextRender(
      () => {
        if (!this.host.contains(document.activeElement)) this.host.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }
}
