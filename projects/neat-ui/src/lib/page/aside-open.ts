import { computed, inject, linkedSignal, type Signal } from '@angular/core';
import { NeatViewport } from './viewport';

/** The state of a page's side panel, as `neatAsideOpen` keeps it. */
export interface NeatAsideOpen {
  /** Whether the panel is open now: bind it to the page's `aside` and the toggle's `open`. */
  readonly open: Signal<boolean>;
  /** Opens or closes the panel; the toggle's `(openChange)` and the page's own openings go here. */
  set(open: boolean): void;
}

/**
 * The open state of a page's side panel, for a page that remembers the choice (`remembered`, with
 * `remember` writing it where the page keeps it, such as local storage). Call it in an injection
 * context.
 *
 * On a wide screen the panel is the remembered choice and `set` remembers. On a narrow screen the
 * panel floats over the page and starts closed, whatever was remembered, and `set` changes a
 * transient flag only: a phone's opening and closing must not overwrite the choice made on a wide
 * screen. The flag resets to closed whenever `narrow` has changed since it was last read, so each
 * time the viewport becomes narrow it starts closed, and going wide shows the remembered choice
 * again.
 */
export function neatAsideOpen(
  remembered: Signal<boolean>,
  remember: (open: boolean) => void,
): NeatAsideOpen {
  const narrow = inject(NeatViewport).narrow;
  // Resets to closed whenever `narrow` changes, so only a narrow screen's own choices outlive it.
  const transient = linkedSignal<boolean, boolean>({ source: narrow, computation: () => false });
  return {
    open: computed(() => (narrow() ? transient() : remembered())),
    set: (open) => (narrow() ? transient.set(open) : remember(open)),
  };
}
