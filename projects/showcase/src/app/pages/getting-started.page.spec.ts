import { reflectComponentType, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  NEAT_ICON_NAMES,
  NeatShell,
  NeatViewport,
  provideNeatTitles,
  provideNeatUi,
} from '@sima/neat-ui';
import { NeatToastHost } from '@sima/neat-ui/toast';
import { signal } from '@angular/core';
import kit from '../../../../neat-ui/package.json' with { type: 'json' };
import readme from '../../../../neat-ui/README.md' with { loader: 'text' };
import repositoryReadme from '../../../../../README.md' with { loader: 'text' };
import { KIT_ENTRIES } from '../docs/docs.testing';
import {
  APP_COMPONENT,
  APP_CONFIG,
  GettingStartedPage,
  INSTALL,
  STYLES,
} from './getting-started.page';

/** What the snippets import from the kit: each name with the entry it comes from. */
function kitImports(): Map<string, string> {
  const imports = new Map<string, string>();
  for (const snippet of [APP_CONFIG, APP_COMPONENT]) {
    for (const [, names, from] of snippet.matchAll(
      /import \{([^}]+)\} from '(@sima\/neat-ui[^']*)'/g,
    )) {
      for (const name of names.split(',').map((each) => each.trim())) imports.set(name, from);
    }
  }
  return imports;
}

describe('GettingStartedPage', () => {
  async function open() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'getting-started', component: GettingStartedPage },
          { path: 'theme', children: [] },
          { path: 'layout', children: [] },
          { path: 'components', children: [] },
        ]),
        { provide: NeatViewport, useValue: { narrow: signal(false) } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/getting-started', GettingStartedPage);
    await harness.fixture.whenStable();
    return harness.routeNativeElement as HTMLElement;
  }

  it('renders the four steps in order, each with its code and a copy button', async () => {
    const page = await open();
    const steps = Array.from(page.querySelectorAll('ol.steps > li'));

    expect(steps.map((step) => step.querySelector('h2')?.textContent?.trim())).toEqual([
      'Add the package',
      'Provide the kit',
      'Import the stylesheet',
      'Put the app in the shell',
    ]);
    expect(steps.map((step) => step.querySelector('pre')?.textContent)).toEqual([
      INSTALL,
      APP_CONFIG,
      STYLES,
      APP_COMPONENT,
    ]);
    for (const step of steps) expect(step.querySelector('neat-copy-button')).not.toBeNull();
  });

  it('points coding agents at the README’s rules for an app, and AGENTS.md for the kit itself', async () => {
    const page = await open();
    const note = page.querySelector('neat-callout') as HTMLElement;

    expect(note.querySelector('[role="heading"]')?.textContent?.trim()).toBe('For coding agents');
    const text = note.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('node_modules/@sima/neat-ui/README.md');
    expect(text).toContain('Using the kit in an app');
    expect(text).toContain('AGENTS.md is for working on the kit itself');
    for (const rule of [
      'import UI only from the kit',
      'one entry per part',
      "pages in the rail, a page's sub-pages as its rail item's children, more in the page nav, never tabs that change the address",
      'icon names and curve names first',
      'propose a kit change instead of a workaround',
    ]) {
      expect(text).toContain(rule);
    }
  });

  // The README is the rules' one home for an app; the note names them, so both must say the same.
  it('finds the navigation rule it names in the README’s rules for an app', () => {
    const rules = readme.slice(readme.indexOf('## Using the kit in an app')).replace(/\s+/g, ' ');

    expect(rules).toContain('**Navigate with the rail and the page nav, never with tabs.**');
    for (const part of ['`children`', '`nav[neatPageNav]`', 'route-linked tabs', '`neat-tabs`']) {
      expect(rules).toContain(part);
    }
  });

  it('links on to Theme, Layout and Components', async () => {
    const page = await open();
    const links = Array.from(page.querySelectorAll('.next a'), (link) => [
      link.querySelector('.name')?.textContent?.trim(),
      link.getAttribute('href'),
    ]);

    expect(links).toEqual([
      ['Theme', '/theme'],
      ['Layout', '/layout'],
      ['Components', '/components'],
    ]);
  });

  // The snippets are text, so these hold them to the kit as it is: a rename or a move fails here.
  it('installs the tarball `npm pack` names after the package', () => {
    const tarball = `${kit.name.replace('@', '').replace('/', '-')}-<version>.tgz`;

    expect(INSTALL).toBe(`npm install ./vendor/${tarball}`);
  });

  it('imports a stylesheet the kit’s package exports', () => {
    const path = /"@sima\/neat-ui\/([^"]+)"/.exec(STYLES)?.[1];

    expect(Object.keys(kit.exports)).toContain(`./${path}`);
  });

  it('imports the providers, the shell and the toast host from their entries', () => {
    const parts: [string, unknown, string][] = [
      ['provideNeatUi', provideNeatUi, '@sima/neat-ui'],
      ['provideNeatTitles', provideNeatTitles, '@sima/neat-ui'],
      ['NeatShell', NeatShell, '@sima/neat-ui'],
      ['NeatToastHost', NeatToastHost, '@sima/neat-ui/toast'],
    ];
    const imports = kitImports();

    for (const [name, value, entry] of parts) {
      expect(typeof value, name).toBe('function');
      expect(imports.get(name), name).toBe(entry);
    }
    for (const component of [NeatShell, NeatToastHost] as Type<unknown>[]) {
      expect(APP_COMPONENT).toContain(`<${reflectComponentType(component)?.selector}`);
    }
  });

  it('imports only what the kit exports, from the entry that exports it', () => {
    for (const [name, from] of kitImports()) {
      const entry = KIT_ENTRIES.find((candidate) => candidate.import === from);

      expect(
        entry?.parts.some((part) => part.name === name),
        `${name} from ${from}`,
      ).toBe(true);
    }
  });

  // The repository README's quick start is these four steps, indented under its numbered list.
  it('has the same snippets as the repository README’s quick start', () => {
    const indented = (snippet: string) =>
      snippet
        .split('\n')
        .map((line) => (line ? `   ${line}` : line))
        .join('\n');
    for (const snippet of [INSTALL, APP_CONFIG, STYLES, APP_COMPONENT]) {
      expect(repositoryReadme).toContain(indented(snippet));
    }
  });

  it('names only the kit’s icons', () => {
    const icons = [...APP_COMPONENT.matchAll(/icon: '([\w-]+)'/g)].map((match) => match[1]);

    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(NEAT_ICON_NAMES).toContain(icon);
  });
});
