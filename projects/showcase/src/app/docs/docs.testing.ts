import type { EnvironmentProviders, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DocsContext, type DocsTarget } from './docs-context';

/**
 * A docs page for the views' specs: `here` names the parts on the page, `elsewhere` the topic path
 * of parts on other pages, and `revealed` records what the views asked the panel to show.
 */
export class FakeDocs extends DocsContext {
  readonly revealed: string[] = [];

  constructor(
    private readonly here: readonly string[] = [],
    private readonly elsewhere: Readonly<Record<string, string>> = {},
  ) {
    super();
  }

  target(name: string): DocsTarget | null {
    const fragment = `api-${name}`;
    if (this.here.includes(name)) return { commands: [], fragment, here: true };
    const path = this.elsewhere[name];
    return path ? { commands: path, fragment, here: false } : null;
  }

  reveal(name: string): void {
    this.revealed.push(name);
  }
}

/**
 * A router whose every path matches, so a followed link navigates instead of failing after the
 * spec, and `docs` as the page's context.
 */
export function provideFakeDocs(docs: FakeDocs): (Provider | EnvironmentProviders)[] {
  return [provideRouter([{ path: '**', children: [] }]), { provide: DocsContext, useValue: docs }];
}
