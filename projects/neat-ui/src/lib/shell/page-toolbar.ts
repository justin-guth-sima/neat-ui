import {
  DestroyRef,
  Directive,
  inject,
  Injectable,
  isDevMode,
  Signal,
  signal,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { TemplatePortal } from '@angular/cdk/portal';

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
 * shell's top bar, between the page title and the end slot, while the page exists. In kiosk mode,
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
    const portal = new TemplatePortal(inject(TemplateRef), inject(ViewContainerRef));
    slot.register(portal);
    inject(DestroyRef).onDestroy(() => slot.unregister(portal));
  }
}
