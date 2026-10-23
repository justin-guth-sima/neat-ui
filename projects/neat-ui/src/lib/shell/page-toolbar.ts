import {
  DestroyRef,
  Directive,
  inject,
  Injectable,
  InjectionToken,
  Injector,
  isDevMode,
  Signal,
  signal,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { TemplatePortal } from '@angular/cdk/portal';

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
export class PageToolbarSlot {
  private readonly current = signal<TemplatePortal | null>(null);

  /** The registered page toolbar, or null when the active page has none. */
  readonly portal: Signal<TemplatePortal | null> = this.current.asReadonly();

  register(portal: TemplatePortal): void {
    // One top bar, one active page: a second toolbar means two pages claim it at once, which
    // the app has to fix rather than the kit silently picking one.
    if (isDevMode() && this.current() !== null) {
      throw new Error(
        'neat-ui: only one page toolbar at a time; remove the other *neatPageToolbar first.',
      );
    }
    this.current.set(portal);
  }

  unregister(portal: TemplatePortal): void {
    // The view lives in the shell, not in the page: take it out now, so its bindings never run
    // against a destroyed page while the shell waits for its next change detection.
    if (portal.isAttached) {
      portal.detach();
    }
    if (this.current() === portal) {
      this.current.set(null);
    }
  }
}

/**
 * The page's toolbar: `<div *neatPageToolbar>…</div>` on a page renders that content in the
 * shell's top bar, at its right end just before the end slot, while the page exists. In kiosk mode,
 * where the top bar is hidden, it renders in a floating bar beside the exit control that shows
 * while the pointer moves. The content stays the page's: its bindings and injection context are
 * those of the page's template.
 *
 * One page toolbar at a time; a second one throws in dev mode.
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
