import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  effect,
  ElementRef,
  inject,
  Injectable,
  InjectionToken,
  input,
  signal,
} from '@angular/core';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';
import { neatAsideOpen } from '../page/aside-open';
import { NeatViewport } from '../page/viewport';
import { safeStorage } from '../storage';
import type { NeatTone } from '../theme/tone';
import { provideNeatTooltipOptions } from '../tooltip/tooltip';

const RAIL_EXPANDED_KEY = 'neat-ui:rail-expanded';

/**
 * Whether the shell's rail shows its labels. Internal to the kit: `neat-shell` provides it to its
 * own template and to the content an app projects into it, which is how a rail item knows.
 *
 * On a wide screen it is the remembered choice; on a narrow one, where the rail floats over the
 * content, a transient flag that starts collapsed and never overwrites the wide screen's choice
 * (the rule of a page's aside, `neatAsideOpen`).
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

  set(expanded: boolean): void {
    this.state.set(expanded);
  }

  /** A floating rail covers the page it just opened, so following a link puts it away. */
  collapseWhenNarrow(): void {
    if (this.viewport.narrow()) {
      this.state.set(false);
    }
  }
}

/**
 * Provided by an item that shows a menu of sub-pages (`RailMenu`), which `NeatRailItem` reads to
 * leave its
 * tooltip off: the menu's heading says the label. Internal to the kit.
 */
export const RAIL_ITEM_HAS_MENU = new InjectionToken<true>('neat-rail-item-has-menu');

/**
 * An app's own item in the shell's rail, at its bottom below the pages.
 *
 * ```html
 * <button neatRailEnd neatRailItem type="button" label="System information" (click)="…">
 *   <neat-icon name="info" />
 * </button>
 * ```
 *
 * It has the look of every rail item: the page links, the theme item and the rail's own control.
 * Mark it `neatRailEnd` to place it at the rail's bottom.
 *
 * The content is the icon: a `neat-icon` with a name of the kit's set, or a glyph from
 * `@sima/neat-ui/lucide` where no name fits. `label` is the visible text while the rail is
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
 * - `detail` is a smaller second line, in the tone's color.
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
 * followed on a narrow screen puts the floating rail away. A button leaves it, since its action
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
    '[attr.data-tone]': 'tone() ?? null',
    '(click)': 'followed()',
  },
  template: `
    <span class="icon">
      <ng-content />
      @if (tone()) {
        <span class="dot" aria-hidden="true"></span>
      }
    </span>
    <span class="label" [class.sr-only]="!expanded()">
      <ng-content select="[neatRailItemLabel]">
        @if (showsLines()) {
          <span class="lines" aria-hidden="true">
            <span class="line">{{ text() ?? label() }}</span>
            @if (detail(); as detail) {
              <span class="line detail">{{ detail }}</span>
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

  /** Whether the item shows lines that say other than `label`, which then names it unseen. */
  protected readonly showsLines = computed(
    () => !!this.detail() || (this.text() ?? this.label()) !== this.label(),
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
    effect(() => tooltip.mutableTooltipDisabled.set(this.expanded() || menu !== null));
  }

  protected expanded(): boolean {
    return this.rail?.expanded() ?? true;
  }

  protected followed(): void {
    if (this.isLink) {
      this.rail?.collapseWhenNarrow();
    }
  }
}

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
 * The line is 1px of `--sidebar-border`, with a quarter step of margin above and below. With the
 * group's quarter-step gap, that leaves half a step to the items around it.
 *
 * It is decorative (`aria-hidden`). The items' names say what they are, and a separator announced
 * between them would only be noise.
 */
@Directive({
  selector: 'hr[neatRailDivider]',
  host: {
    'aria-hidden': 'true',
    class: 'mx-0 my-1 h-0 shrink-0 border-t border-sidebar-border',
  },
})
export class NeatRailDivider {}
