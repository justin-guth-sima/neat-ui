import { DOCUMENT, inject, Injectable, Signal, signal } from '@angular/core';
import { safeStorage } from '../storage';

/** The two color schemes the kit has, which `ThemeService` switches between. */
export type NeatColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'neat-ui:color-scheme';
/** The dark theme's selector: tokens.generated.css and the `dark` variant in neat-ui.tailwind.css. */
export const NEAT_DARK_CLASS = 'neat-dark';

/**
 * Light/dark switch for the kit. Light is the default regardless of the OS preference (which is
 * deliberately never read); dark is opt-in and persisted.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly current = signal<NeatColorScheme>(
    safeStorage.get(STORAGE_KEY) === 'dark' ? 'dark' : 'light',
  );

  readonly scheme: Signal<NeatColorScheme> = this.current.asReadonly();

  constructor() {
    this.apply(this.current());
  }

  /**
   * Applies `scheme` and, unless `persist` is false, stores it for later page loads.
   *
   * Without storing, the scheme holds for this page load only, as a URL parameter that themes a
   * shared link needs. The user's stored choice stays, and a later toggle stores as usual.
   */
  setScheme(scheme: NeatColorScheme, { persist = true }: { persist?: boolean } = {}): void {
    this.current.set(scheme);
    this.apply(scheme);
    if (persist) {
      safeStorage.set(STORAGE_KEY, scheme);
    }
  }

  /** Switches to the other scheme and stores the choice, as the shell's theme item does. */
  toggle(): void {
    this.setScheme(this.current() === 'dark' ? 'light' : 'dark');
  }

  private apply(scheme: NeatColorScheme): void {
    this.root.classList.toggle(NEAT_DARK_CLASS, scheme === 'dark');
  }
}
