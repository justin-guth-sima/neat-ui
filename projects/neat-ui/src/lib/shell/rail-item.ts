import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  effect,
  ElementRef,
  HostAttributeToken,
  inject,
  Injectable,
  InjectionToken,
  input,
  signal,
} from '@angular/core';
import { BrnSeparator, provideBrnSeparatorConfig } from '@spartan-ng/brain/separator';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';
import { neatAsideOpen } from '../page/aside-open';
import { NeatViewport } from '../page/viewport';
import { safeStorage } from '../storage';
import { TONE_DOT_COLORS, type NeatTone } from '../theme/tone';
import { provideNeatTooltipOptions } from '../tooltip/tooltip';
import { hlmSeparatorClass } from '../ui/separator/src';
import { hlm } from '../ui/utils/src';
import {
  MENU_BUTTON_HELM_CLASSES,
  MENU_BUTTON_LG_COLLAPSED_CLASSES,
  MENU_SUB_BUTTON_HELM_CLASSES,
  SIDEBAR_HELM_CLASSES,
} from './sidebar-classes';

const RAIL_EXPANDED_KEY = 'neat-ui:rail-expanded';

/**
 * Whether the shell's rail shows its labels. Internal to the kit: `neat-shell` provides it to its
 * own template and to the content an app projects into it, which is how a rail item knows.
 *
 * On a wide screen it is the remembered choice; on a narrow one, whether the drawer is open, a
 * transient flag that starts closed and never overwrites the wide screen's choice (the rule of a
 * page's aside, `neatAsideOpen`).
 */
@Injectable()
export class RailState {
  private readonly viewport = inject(NeatViewport);
  private readonly remembered = signal(safeStorage.get(RAIL_EXPANDED_KEY) === 'true');
  private readonly state = neatAsideOpen(this.remembered, (expanded) => {
    this.remembered.set(expanded);
    safeStorage.set(RAIL_EXPANDED_KEY, String(expanded));
  });

  readonly expanded = this.state.open;

  /**
   * Whether the rail's items show their labels: while expanded, and always on a narrow screen,
   * where they are only ever in the drawer, so they keep them while it slides out.
   */
  readonly labelsShown = computed(() => this.viewport.narrow() || this.expanded());

  set(expanded: boolean): void {
    this.state.set(expanded);
  }

  /** The drawer covers the page it just opened, so following a link puts it away. */
  collapseWhenNarrow(): void {
    if (this.viewport.narrow()) {
      this.state.set(false);
    }
  }
}

/**
 * What the kit adds to helm's rows, which helm leaves to its own button or link: the native
 * element's defaults undone (no underline, a pointer), and a page that holds the open sub-page
 * (`data-branch`) in weight 500 without a fill, so one row alone reads as current.
 */
const RAIL_ITEM_CLASSES = 'cursor-pointer no-underline data-branch:font-medium';

/**
 * Provided by an item that shows a menu of sub-pages (`RailMenu`), which `NeatRailItem` reads to
 * leave its
 * tooltip off: the menu's heading says the label. Internal to the kit.
 */
export const RAIL_ITEM_HAS_MENU = new InjectionToken<true>('neat-rail-item-has-menu');

/**
 * An app's own item in the shell's rail, in the sidebar's footer below the pages.
 *
 * ```html
 * <button neatRailEnd neatRailItem type="button" label="System information" (click)="…">
 *   <neat-icon name="info" />
 * </button>
 * ```
 *
 * It has the look of every rail item: the page links and the theme item.
 * Mark it `neatRailEnd` to place it in the footer.
 *
 * The content is the icon: a `neat-icon` with a name of the kit's set, or a glyph from
 * `@sima/neat-ui/lucide` where no name fits. It is drawn at 16 px, whatever its `size`. `label` is the visible text while the rail is
 * expanded. Collapsed, it stays as the item's visually hidden text, so the name is kept, and shows
 * as a tooltip on the right.
 *
 * An item with a state, such as a board or a connection, says it with the kit's inputs:
 *
 * ```html
 * <button neatRailEnd neatRailItem type="button" label="DevKit, 192.168.100.2, connected"
 *         text="DevKit" detail="192.168.100.2" tone="success" (click)="…">
 *   <neat-icon name="board" />
 * </button>
 * ```
 *
 * - `tone` puts a dot on the icon's corner.
 * - `text` is the visible first line, the label by default.
 * - `detail` is a smaller second line, in the tone's color. An item with a `detail` is a two-line row.
 *
 * Both lines are cut with an ellipsis, and hidden with the label while the rail is collapsed.
 *
 * `label` stays the tooltip and the name, so it is the whole sentence, with the state the dot alone
 * shows. The tooltip takes its text from `label` alone, so the kit cannot compose it from the
 * lines. So `label` must hold the visible `text` and `detail` as they read.
 *
 * While the lines say other than `label`, they are `aria-hidden`, and the label is visually hidden
 * text beside them. So the name still comes from the content, and an `aria-label` the app sets
 * still wins. A kit `aria-label` binding would remove the app's.
 *
 * Visible text the inputs cannot say goes in an element marked `neatRailItemLabel`, which takes the
 * label's place. `label` stays the tooltip, so it should say at least what that text says. The
 * item's name is then that text, unless the app gives an `aria-label`.
 *
 * The lines of such an element are the app's, which the kit's stylesheet cannot reach. So each
 * ellipsizes itself: `min-width: 0`, `overflow: hidden`, `white-space: nowrap`,
 * `text-overflow: ellipsis`.
 *
 * An item is an action, never a toggle. Its label says what a click does: "Dark theme" while light,
 * "Light theme" while dark. So it has no pressed state, and the rail's selection fill means only
 * "the current page" (`aria-current="page"`).
 *
 * The host stays the native button or link, with its own click, focus and `routerLink`. A link
 * followed on a narrow screen puts the drawer away. A button leaves it, since its action
 * may want the rail, as a theme switch does, or open a dialog over it.
 *
 * The tooltip is off while the labels show. It is off too on a collapsed page item with
 * `children`, whose menu of sub-pages names the page itself.
 */
@Component({
  // An attribute selector keeps the native button or link as the host, as `button[neatSwitch]`
  // does.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[neatRailItem], a[neatRailItem]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideNeatTooltipOptions('right')],
  hostDirectives: [{ directive: BrnTooltip, inputs: ['brnTooltip: label'] }],
  host: {
    '[attr.data-sidebar]': 'child ? "menu-sub-button" : "menu-button"',
    '[attr.data-size]': 'size()',
    '[attr.data-tone]': 'tone() ?? null',
    '[class]': 'classes()',
    '(click)': 'followed()',
  },
  template: `
    <!-- Helm's icon size, 16 px, for any neat-icon in the slot: an app's own icon keeps
         neat-icon's default size attribute (20), which a CSS size overrides. A utility, not
         rail-item.css, since encapsulated styles cannot reach the app's projected icon. -->
    <span
      class="icon relative inline-flex flex-none [&_neat-icon_svg]:size-4"
      [class.hidden]="child"
    >
      <ng-content />
      @if (tone()) {
        <span class="dot" aria-hidden="true" [style.--neat-tone-dot]="dotColor()"></span>
      }
    </span>
    <span class="label min-w-0 flex-1 truncate" [class.sr-only]="!labelsShown()">
      <ng-content select="[neatRailItemLabel]">
        @if (showsLines()) {
          <span class="lines flex min-w-0 flex-col leading-tight" aria-hidden="true">
            <span class="line truncate">{{ text() ?? label() }}</span>
            @if (detail(); as detail) {
              <span class="line detail truncate text-xs">{{ detail }}</span>
            }
          </span>
          <span class="sr-only">{{ label() }}</span>
        } @else {
          {{ label() }}
        }
      </ng-content>
    </span>
  `,
  styleUrl: './rail-item.css',
})
export class NeatRailItem {
  // Brain's tooltip is a host directive here, not `neatTooltip`, because the item names its own
  // tooltip from `label`: a host directive's inputs come from the template that uses the element,
  // and `label` feeds both the item and the tooltip.

  /**
   * The item's name and tooltip, and its visible text while the rail is expanded unless `text` or
   * `detail` say otherwise.
   */
  readonly label = input.required<string>();
  /** The visible first line, when it says less than `label` (a board's name, its state aside). */
  readonly text = input<string>();
  /** A smaller second line under the first (an address, a state), in the tone's color. */
  readonly detail = input<string>();
  /** The state a dot on the icon's corner shows; no dot without it. */
  readonly tone = input<NeatTone>();

  /** The dot's color, from the table every tone dot shares. */
  protected readonly dotColor = computed(() => {
    const tone = this.tone();
    return tone ? TONE_DOT_COLORS[tone] : null;
  });

  /** Whether the item shows lines that say other than `label`, which then names it unseen. */
  protected readonly showsLines = computed(
    () => !!this.detail() || (this.text() ?? this.label()) !== this.label(),
  );

  /** A sub-page row, which the shell marks with `data-child`: helm's sub button, text only. */
  protected readonly child =
    inject(new HostAttributeToken('data-child'), { optional: true }) !== null;

  /**
   * Helm's size, which its classes key on: a sub-page row is its sub button's `md`; of the page
   * rows, helm's `lg` holds two lines, so it is the row with a detail, and everything else is
   * `default`.
   */
  protected readonly size = computed(() => (this.child ? 'md' : this.detail() ? 'lg' : 'default'));

  protected readonly classes = computed(() =>
    this.child
      ? hlm(RAIL_ITEM_CLASSES, MENU_SUB_BUTTON_HELM_CLASSES.md, 'w-full')
      : this.size() === 'lg'
        ? hlm(
            RAIL_ITEM_CLASSES,
            MENU_BUTTON_HELM_CLASSES.base,
            MENU_BUTTON_HELM_CLASSES.size.lg,
            MENU_BUTTON_LG_COLLAPSED_CLASSES,
          )
        : hlm(
            RAIL_ITEM_CLASSES,
            MENU_BUTTON_HELM_CLASSES.base,
            MENU_BUTTON_HELM_CLASSES.size.default,
          ),
  );

  private readonly rail = inject(RailState, { optional: true });
  private readonly isLink = inject(ElementRef).nativeElement instanceof HTMLAnchorElement;

  constructor() {
    // Outside the shell there is no rail to be an item of; a plain error says so where Angular's
    // would only name a missing provider.
    if (this.rail === null) {
      throw new Error('neat-ui: a neatRailItem belongs in neat-shell (its [neatRailEnd] slot).');
    }
    const tooltip = inject(BrnTooltip);
    // Brain's own switch for the tooltip, which the template of the page that uses the item cannot
    // reach: the item decides, and a visible label needs no tooltip repeating it. Nor does an item
    // with a menu, whose heading says the label.
    const menu = inject(RAIL_ITEM_HAS_MENU, { optional: true });
    effect(() => tooltip.mutableTooltipDisabled.set(this.labelsShown() || menu !== null));
  }

  /** Whether the item shows its label, which the rail decides. */
  protected labelsShown(): boolean {
    return this.rail?.labelsShown() ?? true;
  }

  protected followed(): void {
    if (this.isLink) {
      this.rail?.collapseWhenNarrow();
    }
  }
}

/** Helm's separator in the sidebar's own line color and inset, `hlm` merging the second over the first. */
const RAIL_DIVIDER_CLASSES = hlm(hlmSeparatorClass, SIDEBAR_HELM_CLASSES.separator);

/**
 * A line between groups of the rail's bottom items.
 *
 * ```html
 * <hr neatRailEnd neatRailDivider />
 * ```
 *
 * Put it among an app's `[neatRailEnd]` items, below a board block, for example. The shell draws
 * the line above the whole group with the same element, so the look is stated once.
 *
 * It is helm's sidebar separator, horizontal: a line 1px high of `--sidebar-border`, inset 0.5rem
 * from each side.
 *
 * It is decorative (`role="none"`, so it exposes nothing). The items' names say what they are,
 * and a separator announced between them would only be noise.
 */
@Directive({
  selector: 'hr[neatRailDivider]',
  hostDirectives: [BrnSeparator],
  providers: [provideBrnSeparatorConfig({ orientation: 'horizontal' })],
  host: {
    'data-horizontal': '',
    '[class]': 'classes',
  },
})
export class NeatRailDivider {
  protected readonly classes = RAIL_DIVIDER_CLASSES;
}
