// SPIKE (spike/sidebar-layout): the shell rebuilt on Spartan's sidebar layout, for comparing the two
// layouts by eye. Never merged; no tests. It reuses NeatShell's logic (the active page, the title,
// kiosk focus) by inheritance and swaps the template for helm's sidebar parts.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { CdkPortalOutlet } from '@angular/cdk/portal';
import { RouterLink } from '@angular/router';
import { NeatButton } from '../button/button';
import { provideExpandArea, SHELL_CONTENT_AREA } from '../expand/expand-area';
import { NeatIcon } from '../icon/icon';
import { NeatKioskExit } from '../kiosk/kiosk-exit';
import { TONE_DOT_COLORS, type NeatTone } from '../theme/tone';
import { NeatTooltip } from '../tooltip/tooltip';
import {
  HlmSidebarImports,
  HlmSidebarService,
  provideHlmSidebarConfig,
} from '../ui/sidebar/src';
import { HlmSeparator } from '../ui/separator/src';
import { NeatLogo } from './logo';
import { NeatNavItem } from './nav-item';
import { RailState } from './rail-item';
import { RailMenu } from './rail-menu';
import { NeatShell } from './shell';

/**
 * SPIKE. An app's item in the sidebar's footer: helm's `menu-button`, with the rail item's state
 * dot on the icon and an optional second line (`detail`), which makes it helm's `lg` row (the
 * NavUser pattern of Spartan's blocks). Collapsed, helm's tooltip says `label`.
 */
@Component({
  selector: 'neat-sidebar-item',
  imports: [HlmSidebarImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      hlmSidebarMenuButton
      type="button"
      [size]="detail() ? 'lg' : 'default'"
      [tooltip]="label()"
      [attr.data-tone]="tone() ?? null"
      [attr.aria-haspopup]="dialog() ? 'dialog' : null"
      (click)="activated.emit()"
    >
      <span class="icon">
        <ng-content />
        @if (tone()) {
          <span class="dot" [style.--neat-tone-dot]="dotColor()"></span>
        }
      </span>
      @if (detail()) {
        <span class="lines" aria-hidden="true">
          <span class="text">{{ text() ?? label() }}</span>
          <span class="detail">{{ detail() }}</span>
        </span>
        <span class="sr-only">{{ label() }}</span>
      } @else {
        <span>{{ text() ?? label() }}</span>
      }
    </button>
  `,
  styleUrl: './sidebar-item.css',
})
export class NeatSidebarItem {
  readonly label = input.required<string>();
  readonly text = input<string>();
  readonly detail = input<string>();
  readonly tone = input<NeatTone>();
  readonly dialog = input(false);
  readonly activated = output<void>();
  protected readonly dotColor = computed(() => {
    const tone = this.tone();
    return tone ? TONE_DOT_COLORS[tone] : null;
  });
}

/**
 * SPIKE. `neat-shell` on Spartan's sidebar layout: helm's `sidebar` in `collapsible="icon"` mode,
 * full height, its header the logo with the app name and detail, its content the pages with their
 * sub-pages as `menu-sub`, its footer the app's items (`neatSidebarFooter`) and the theme item;
 * beside it `sidebar-inset` with the page's top bar (the trigger, the title, the page's tools, the
 * end slot, kiosk, the aside toggle) over the content area.
 */
@Component({
  selector: 'neat-sidebar-shell',
  imports: [
    CdkPortalOutlet,
    HlmSidebarImports,
    HlmSeparator,
    NeatButton,
    NeatIcon,
    NeatKioskExit,
    NeatLogo,
    NeatSidebarItem,
    NeatTooltip,
    RailMenu,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    RailState,
    provideExpandArea(SHELL_CONTENT_AREA, '.content'),
    provideHlmSidebarConfig({ closeMobileSidebarOnMenuButtonClick: true }),
  ],
  host: {
    '[attr.data-kiosk]': 'kiosk.active()',
    '[attr.data-narrow]': 'viewport.narrow()',
  },
  templateUrl: './sidebar-shell.html',
  styleUrl: './sidebar-shell.css',
})
export class NeatSidebarShell extends NeatShell {
  protected readonly sidebar = inject(HlmSidebarService);
  /** Icon mode: collapsed on a wide screen (the phone's drawer always shows labels). */
  protected readonly collapsed = computed(
    () => this.sidebar.state() === 'collapsed' && !this.sidebar.isMobile(),
  );

  /**
   * Whether the item's sub-pages show: the active page's, as in the kit's rail. helm hides
   * `menu-sub` in icon mode by itself.
   */
  protected openItem(item: NeatNavItem): boolean {
    return this.isActivePage(item) && !!item.children?.length;
  }
}
