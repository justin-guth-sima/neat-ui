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
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { NeatBreadcrumbs, NeatButton, NeatIcon, ɵSTALE_CLASSES } from '@sima/neat-ui';
import { NeatBadge } from '@sima/neat-ui/badge';
import { BRACE_HEIGHT, describeLevel, drawLevel, labelCovers } from './drawing';
import { levelExtent } from './fit';
import { EdgeLabelBox, EdgeLabelSizes, NoteBox, NoteSizes } from './box-sizes';
import { DiagramHover, focusedParts, highlighted } from './hover';
import { samePath, walkLevels } from './levels';
import {
  type DiagramMessagesContext,
  DiagramMessagesSlot,
  IDENTITY_TRANSFORM,
  provideDiagramMessagesContext,
} from './messages/context';
import {
  badgesOf,
  type NeatDiagramHighlight,
  type NeatDiagramNode,
  type NeatDiagramPart,
  type NeatDiagramPick,
  type NeatDiagramSet,
} from './model';
import { placeNotes } from './notes';
import { firstOfEachId } from './report';
import {
  NeatDiagramBlockTemplate,
  NeatDiagramEdgeTooltipTemplate,
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
 * The app places every node. The kit routes the edges between them, and draws the whole.
 *
 * Groups and bands are drawn behind one SVG of edges. Blocks, brackets, edge labels and notes are
 * drawn in front of it. All of them sit in one container, which is what pan and zoom move.
 *
 * Every part is keyed by its id. So a new diagram object with the same content, from an app that
 * recomputes it on every poll, changes nothing in the DOM. A moved node is the same element, moved.
 * A part whose ids name nothing is left out and named once in dev mode. The rest is drawn.
 *
 * The host is a `figure` named by `label`. It fills the box the app gives it, and clips what lies
 * outside. Give it a bounded box: without a height it shows nothing.
 *
 * A block's badges are the kit's badges, soft. A block's body, the notes' content and the tooltip of the edge
 * under the pointer are the app's templates: `neatDiagramBlock`, `neatDiagramNote` and
 * `neatDiagramEdgeTooltip`. A visually hidden list after the drawing says the level's nodes and
 * edges in words.
 *
 * With `highlight` set, a part in focus stays as it is with what it is joined to, and the rest is
 * dimmed. The part is a block or an edge under the pointer, or a block whose open button has the
 * focus.
 *
 * `hovered` is that part, both ways, as the kit's rule for widget interaction has it. The diagram
 * sets it while the pointer or the keyboard is on a part, and null once they leave. The app may set
 * it, so a list beside the diagram can put a block in focus, shown as `highlight` allows.
 *
 * `activated` reports a click on a block or an edge. A block that opens a level is a button that
 * opens it, and the click opens it too.
 *
 * `level` is the path of open levels, which an app can bind to its route. The bar over the drawing
 * goes back and shows the path. A path that leads nowhere, such as a stale route, is cut to the
 * part that does, and the model is set to it. So render the diagram once its data is there: a
 * routed path is checked against the diagram given, a placeholder too.
 *
 * The user pans and zooms it by drag, wheel, pinch and double-click. With the box focused, the
 * arrow keys, `+`, `-` and `0` do too. It fits its level to the box by itself until the user pans
 * or zooms, and `fit()` fits it again.
 *
 * It takes the wheel and touch over its box (`touch-action: none`). So give it a bounded box, not
 * a long stretch of a scrolling page.
 *
 * A `neat-diagram-messages` projected into it draws the messages moving along its edges, over the
 * drawing. The diagram gives it the level, its edges, and the pan and zoom it draws by.
 */
@Component({
  selector: 'neat-diagram',
  imports: [
    EdgeLabelBox,
    NeatBreadcrumbs,
    NeatBadge,
    NeatButton,
    NeatIcon,
    NgTemplateOutlet,
    NoteBox,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [NoteSizes, EdgeLabelSizes, provideDiagramMessagesContext()],
  host: {
    role: 'figure',
    '[attr.aria-label]': 'label()',
    tabindex: '0',
    '(click)': 'onClick($event)',
  },
  templateUrl: './diagram.html',
  styleUrls: ['./groups.css', './blocks.css', './lines.css', './diagram.css'],
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
  /**
   * What dims the rest while something is under the pointer: `none`, `edges` or `all`.
   *
   * - `none`, the default, dims nothing. Dimming without a reason to look is noise that every pass
   *   of the pointer over the drawing makes.
   * - `edges` is for a drawing whose links are what the reader follows. The dim then says which
   *   blocks a link joins.
   * - `all` is for when a block's links are worth tracing too.
   *
   * An edge's tooltip shows whatever this is.
   */
  readonly highlight = input<NeatDiagramHighlight>('none');
  /**
   * The part in focus.
   *
   * It is the pointer's block or edge, or the keyboard's block, while they are on one, and null
   * once they leave. While they are on none, it is one the app sets.
   */
  readonly hovered = model<NeatDiagramPart | null>(null);
  /** A click on a block or an edge (not a drag of the view): which part. */
  readonly activated = output<NeatDiagramPick>();

  protected readonly blockTemplate = contentChild(NeatDiagramBlockTemplate);
  protected readonly noteTemplate = contentChild(NeatDiagramNoteTemplate);
  private readonly edgeTooltipTemplate = contentChild(NeatDiagramEdgeTooltipTemplate);
  private readonly noteSizes = inject(NoteSizes);
  private readonly labelSizes = inject(EdgeLabelSizes);
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private readonly edges = viewChild.required<ElementRef<SVGElement>>('edges');
  private readonly tooltipBox = viewChild<ElementRef<HTMLElement>>('tooltip');
  private readonly bar = viewChild<ElementRef<HTMLElement>>('bar');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly zone = inject(NgZone);
  private zoom: DiagramZoom | null = null;
  /** The messaging layer's listeners for a new transform (`DiagramMessagesContext`). */
  private readonly transformListeners = new Set<() => void>();
  private readonly hover = this.zone.runOutsideAngular(
    () => new DiagramHover(this.host, () => this.tooltipBox()?.nativeElement),
  );

  protected readonly BRACE_HEIGHT = BRACE_HEIGHT;
  /** The look of `[neatStale]`, for a node with `stale`. */
  protected readonly staleClasses = ɵSTALE_CLASSES;
  protected readonly badgesOf = badgesOf;

  private readonly walked = computed(() => walkLevels(this.diagram(), this.level()));

  /** The path as far as it leads: the levels shown. */
  private readonly path = computed(() => this.walked().path, { equal: samePath });

  /** The level shown: the one at the end of the path. */
  private readonly shown = computed(() => this.walked().shown);

  /**
   * Each level of the path as a crumb, named by the block that opens it: its label, and on the
   * last crumb (where the user is) its detail, muted.
   */
  protected readonly crumbs = computed(() =>
    this.walked().openers.map((opener) => ({ label: opener.label, detail: opener.detail })),
  );

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
  protected readonly focused = computed(() =>
    focusedParts(this.shown(), highlighted(this.hover.focus() ?? this.hovered(), this.highlight())),
  );

  /** The tooltip of the edge under the pointer, while the app has a tooltip template. */
  protected readonly edgeTooltip = computed(() => {
    const template = this.edgeTooltipTemplate()?.template;
    const id = this.hover.tooltipEdge();
    const edge = this.drawn().edges.find((drawn) => drawn.id === id)?.edge;
    return template && edge ? { template, edge } : null;
  });

  /** The level in words, for the hidden list. */
  protected readonly described = computed(() => describeLevel(this.drawn()));

  constructor() {
    inject(DiagramMessagesSlot).context = this.messagesContext();

    // `hovered` follows the pointer's or the keyboard's part while there is one, and goes back to
    // null when they leave; the app's own value stands while they are on none.
    let held = false;
    effect(() => {
      const own = this.hover.focus();
      untracked(() => {
        if (own) {
          held = true;
          const now = this.hovered();
          if (now?.kind !== own.kind || now?.id !== own.id) this.hovered.set(own);
        } else if (held) {
          held = false;
          if (this.hovered() !== null) this.hovered.set(null);
        }
      });
    });

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
          () =>
            new DiagramZoom(
              this.host,
              this.content().nativeElement,
              this.edges().nativeElement,
              () => this.transformListeners.forEach((listener) => listener()),
            ),
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

    // The tooltip, once rendered for a new edge, goes by the pointer.
    afterRenderEffect(() => {
      this.edgeTooltip();
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

  /**
   * What a messaging layer projected into the diagram draws by: the level shown (another path is
   * another level), its blocks, placed notes and edge labels as the cards dots pass behind (the
   * canvas lies over the whole drawing, so a dot would otherwise run through a label's text),
   * every edge id of the set, the edges in focus, and the transform with a hook for each change.
   */
  private messagesContext(): DiagramMessagesContext {
    return {
      level: computed(() => ({
        key: JSON.stringify(this.path()),
        edges: this.drawn().edges.map(({ id, edge, line, points }) => ({
          id,
          from: edge.from,
          to: edge.to,
          series: edge.series,
          line,
          points,
        })),
      })),
      covers: computed(() => [
        ...this.drawn()
          .front.filter(({ node }) => node.role === 'block')
          .map(({ rect }) => rect),
        ...[...this.placements().values()].map(({ box }) => box),
        ...labelCovers(this.drawn().edges, this.labelSizes.sizes()),
      ]),
      edgeIds: computed(() => {
        const { overview, levels } = this.diagram();
        const all = [overview, ...Object.values(levels ?? {})];
        return new Set(all.flatMap((level) => level.edges.map((edge) => edge.id)));
      }),
      focus: computed(() => this.focused()?.edges ?? null),
      transform: () => this.zoom?.transform ?? IDENTITY_TRANSFORM,
      onTransform: (listener) => {
        this.transformListeners.add(listener);
        return () => this.transformListeners.delete(listener);
      },
    };
  }

  /** A click on a block or an edge (d3-zoom swallows a drag's) reports it to the app. */
  protected onClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const edge = target?.closest('[data-edge]')?.getAttribute('data-edge');
    const block = target?.closest('.block[data-node]')?.getAttribute('data-node');
    if (edge) this.activated.emit({ kind: 'edge', id: edge, event });
    else if (block) this.activated.emit({ kind: 'block', id: block, event });
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
