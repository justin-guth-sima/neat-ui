import {
  DestroyRef,
  Directive,
  inject,
  Injectable,
  InjectionToken,
  Injector,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { TemplatePortal } from '@angular/cdk/portal';
import { BrnSeparator, provideBrnSeparatorConfig } from '@spartan-ng/brain/separator';
import { hlmSeparatorClass } from '../ui/separator/src';
import { hlm } from '../ui/utils/src';
import { ShellSlot } from './shell-slot';

/**
 * True for content rendered inside the page toolbar, in the top bar or the kiosk bar alike.
 * Internal to the kit: a popover reads it to hold the kiosk bar open while it is open.
 */
export const IN_PAGE_TOOLBAR = new InjectionToken<boolean>('neat-ui: in the page toolbar', {
  providedIn: 'root',
  factory: () => false,
});

/**
 * Where the active page's toolbar is handed to the shell. Internal to the kit: pages use
 * `*neatPageToolbar`, the shell renders `portal`.
 */
@Injectable({ providedIn: 'root' })
export class PageToolbarSlot extends ShellSlot {
  constructor() {
    super('neat-ui: only one page toolbar at a time; remove the other *neatPageToolbar first.');
  }
}

/**
 * The page's toolbar, rendered in the shell's top bar while the page exists.
 *
 * ```html
 * <div *neatPageToolbar>
 *   <button neatButton type="button" variant="text" (click)="refresh()">Refresh</button>
 * </div>
 * ```
 *
 * It sits at the top bar's right end, just before the end slot and the kiosk button. In kiosk mode,
 * where the top bar is hidden, it renders in a floating bar beside the exit control, which shows
 * while the pointer moves.
 *
 * The content stays the page's: its bindings and injection context are those of the page's
 * template. The tools are the row's items, so a page with dividers places them with
 * `ng-container *neatPageToolbar` (a `div` makes one item of them, fine without dividers).
 *
 * One page toolbar at a time: a second one throws in dev mode.
 */
@Directive({ selector: '[neatPageToolbar]' })
export class NeatPageToolbar {
  constructor() {
    const slot = inject(PageToolbarSlot);
    // The shell renders the content with this injector wherever it puts it, so what is inside can
    // tell it is in the toolbar without looking at the DOM.
    const injector = Injector.create({
      providers: [{ provide: IN_PAGE_TOOLBAR, useValue: true }],
      parent: inject(Injector),
    });
    const portal = new TemplatePortal(
      inject(TemplateRef),
      inject(ViewContainerRef),
      undefined,
      injector,
    );
    slot.register(portal);
    inject(DestroyRef).onDestroy(() => slot.unregister(portal));
  }
}

/**
 * Spartan's separator (helm's `hlmSeparatorClass`), inset from the row at top and bottom, with no
 * margin along it and no `hr` border.
 */
const TOOLBAR_DIVIDER_CLASSES = hlm(hlmSeparatorClass, 'm-0 my-(--neat-space-3) h-auto border-0');

/**
 * A short vertical line between groups of tools in the page toolbar.
 *
 * ```html
 * <ng-container *neatPageToolbar>
 *   <button neatButton type="button" variant="text">Refresh</button>
 *   <hr neatPageToolbarDivider />
 *   <button neatButton type="button" variant="text">Export</button>
 * </ng-container>
 * ```
 *
 * Put it between the tools, placed with `ng-container *neatPageToolbar`. It is Spartan's
 * separator, vertical: a line 1px wide of `--border`. It takes the height of the row it stands
 * in, less `--neat-space-3` at top and bottom, so it looks the same in the top bar, in kiosk
 * mode's floating bar and in a phone's second row. The toolbar's gap spaces it, so it has no
 * margin along the row.
 *
 * It is decorative (`role="none"`, so it exposes nothing). The page tools are a group, not an
 * ARIA toolbar, and the tools' names say what they are, so a separator announced between them
 * would only be noise.
 */
@Directive({
  selector: 'hr[neatPageToolbarDivider]',
  hostDirectives: [BrnSeparator],
  providers: [provideBrnSeparatorConfig({ orientation: 'vertical' })],
  host: {
    'data-vertical': '',
    '[class]': 'classes',
  },
})
export class NeatPageToolbarDivider {
  protected readonly classes = TOOLBAR_DIVIDER_CLASSES;
}
