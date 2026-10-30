import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** The document's title: the app's name, then the page's, as a browser tab or history shows it. */
class NeatTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  constructor(private readonly appName: string) {
    super();
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    // The router's own pick: the deepest primary route's title, else the nearest one above it.
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${this.appName} · ${page}` : this.appName);
  }
}

/**
 * Titles the document `<appName> · <route title>`, or `<appName>` alone on a route without a
 * title, so every app's browser tabs read the same way: `provideNeatTitles('Neat Insight')` beside
 * `provideRouter` in the app's providers. The page title in the shell's top bar is the shell's own
 * and does not come from here.
 */
export function provideNeatTitles(appName: string): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: TitleStrategy, useFactory: () => new NeatTitleStrategy(appName) },
  ]);
}
