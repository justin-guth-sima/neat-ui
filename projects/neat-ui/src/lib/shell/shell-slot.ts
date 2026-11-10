import { isDevMode, signal, Signal } from '@angular/core';
import { TemplatePortal } from '@angular/cdk/portal';

/**
 * A place in the shell that the active page fills with a template of its own: the page toolbar
 * (`*neatPageToolbar`) and the aside toggle (`neat-aside-toggle`). Internal to the kit: the
 * page side registers a portal, the shell renders `portal`, and the content stays the page's
 * (bindings, injection).
 */
export class ShellSlot {
  private readonly current = signal<TemplatePortal | null>(null);

  /** The registered portal, or null when the active page fills nothing here. */
  readonly portal: Signal<TemplatePortal | null> = this.current.asReadonly();

  /** @param secondError what a second registration throws in dev mode */
  constructor(private readonly secondError: string) {}

  register(portal: TemplatePortal): void {
    // One shell, one active page: a second registration means two pages claim the place at once,
    // which the app has to fix rather than the kit silently picking one.
    if (isDevMode() && this.current() !== null) {
      throw new Error(this.secondError);
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
