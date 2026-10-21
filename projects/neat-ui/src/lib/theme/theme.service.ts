import { DOCUMENT, inject, Injectable, Signal, signal } from '@angular/core';
import { safeStorage } from '../storage';

export type NeatColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'neat-ui:color-scheme';
/** Must match `darkModeSelector` in `provideNeatUi()`. */
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

  setScheme(scheme: NeatColorScheme): void {
    this.current.set(scheme);
    this.apply(scheme);
    safeStorage.set(STORAGE_KEY, scheme);
  }

  toggle(): void {
    this.setScheme(this.current() === 'dark' ? 'light' : 'dark');
  }

  private apply(scheme: NeatColorScheme): void {
    this.root.classList.toggle(NEAT_DARK_CLASS, scheme === 'dark');
  }
}
