import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injectable,
  input,
  signal,
} from '@angular/core';
import { BrnTooltip } from '@spartan-ng/brain/tooltip';
import { neatAsideOpen } from '../page/aside-open';
import { NeatViewport } from '../page/viewport';
import { safeStorage } from '../storage';
import { provideNeatTooltipOptions } from '../tooltip/tooltip';

const RAIL_EXPANDED_KEY = 'neat-ui:rail-expanded';

/**
 * Whether the shell's rail shows its labels. Internal to the kit: `neat-shell` provides it to its
 * own template and to the content an app projects into it, which is how a rail item knows.
 *
 * On a wide screen it is the remembered choice; on a narrow one, where the rail floats over the
 * content, a transient flag that starts collapsed and never overwrites the wide screen's choice
 * (the rule of a page's side panel, `neatAsideOpen`).
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
 * An item of the shell's rail, the one look of the page links, the theme switch, the rail's own
 * control and an app's items at the bottom of the rail (`[neatRailEnd]`):
 *
 * ```html
 * <button neatRailEnd neatRailItem type="button" label="System information" (click)="…">
 *   <neat-icon name="info" />
 * </button>
 * ```
 *
 * The content is the icon, so an app can draw more than a glyph there (a state dot on it). `label`
 * is the visible text while the rail is expanded; collapsed, it stays as the item's visually hidden
 * text, so the name is kept, and shows as a tooltip on the right. An item whose visible text is
 * richer than its label (two lines, a coloured state) puts it in an element marked
 * `neatRailItemLabel`, which takes the label's place; `label` stays the tooltip, so it should say
 * at least what that text says. Its name is then that text, unless the app gives an `aria-label`.
 * `pressed` makes it a toggle (`aria-pressed`, absent while unset); its state shows in its icon,
 * since the rail's selection fill means "the current page" (`aria-current="page"`).
 *
 * The host stays the native button or link, with its own click, focus and `routerLink`. A link
 * followed on a narrow screen puts the floating rail away; a button leaves it, since its action
 * may want the rail (a theme switch) or open a dialog over it.
 *
 * Brain's tooltip is a host directive here, not `neatTooltip`, because the item names its own
 * tooltip from `label`: a host directive's inputs come from the template that uses the element,
 * and `label` feeds both the item and the tooltip. It is switched off while the labels show.
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
    '[attr.aria-pressed]': 'pressed() ?? null',
    '(click)': 'followed()',
  },
  template: `
    <span class="icon"><ng-content /></span>
    <span class="label" [class.sr-only]="!expanded()">
      <ng-content select="[neatRailItemLabel]">{{ label() }}</ng-content>
    </span>
  `,
  styleUrl: './rail-item.css',
})
export class NeatRailItem {
  /** The item's text: visible while the rail is expanded, its tooltip while it is not. */
  readonly label = input.required<string>();
  /** A toggle's state; leave unset for an item that is not one. */
  readonly pressed = input<boolean>();

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
    // reach: the item decides, and a visible label needs no tooltip repeating it.
    effect(() => tooltip.mutableTooltipDisabled.set(this.expanded()));
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
