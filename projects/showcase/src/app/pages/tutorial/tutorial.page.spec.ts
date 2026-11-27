import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NeatViewport } from '@sima/neat-ui';
import kit from '../../../../../neat-ui/package.json';
import { TUTORIAL_FILES } from '../../docs/generated/tutorial';
import { App as ShellApp } from './steps/05-shell/src/app/app';
import { routes as pageRoutes } from './steps/06-pages/src/app/app.routes';
import { Streams as SearchedStreams } from './steps/08-search/src/app/streams/streams';
import { Streams as PanelStreams } from './steps/09-panel/src/app/streams/streams';
import { DOWNLOAD_KIT, INSTALL_KIT, TARBALL, TutorialPage } from './tutorial.page';

class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function setUp(routes: Routes = [{ path: '**', children: [] }]): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      { provide: NeatViewport, useValue: { narrow: signal(false) } },
    ],
  });
}

async function render<T>(component: new () => T) {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

describe('the tutorial', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', NoopResizeObserver));
  afterEach(() => vi.unstubAllGlobals());

  it('installs the kit’s tarball at the kit’s own version', () => {
    expect(TARBALL).toBe(`sima-neat-ui-${kit.version}.tgz`);
    expect(INSTALL_KIT).toBe(`npm install ./vendor/${TARBALL}`);
    expect(DOWNLOAD_KIT).toContain(`gh release download v${kit.version} `);
  });

  it('shows nine steps, each step’s changed files and a picture of what it shows', async () => {
    setUp([
      { path: 'tutorial', component: TutorialPage },
      { path: '**', children: [] },
    ]);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/tutorial', TutorialPage);
    await harness.fixture.whenStable();
    const page = harness.routeNativeElement as HTMLElement;
    const steps = Array.from(page.querySelectorAll('ol.steps > li'));

    expect(steps.map((step) => step.querySelector('h2')?.textContent?.trim())).toEqual([
      'Install Node.js',
      'Create an Angular app',
      'Say hello',
      'Add the kit',
      'Put the app in the shell',
      'Add two pages',
      'List the streams',
      'Search them',
      'Show the picked stream',
    ]);
    const shown = (index: number) =>
      Array.from(steps[index].querySelectorAll('.file-name'), (name) => name.textContent?.trim());
    for (const [index, folder] of [
      [2, '03-hello'],
      [3, '04-kit'],
      [4, '05-shell'],
      [5, '06-pages'],
      [6, '07-list'],
      [7, '08-search'],
      [8, '09-panel'],
    ] as const) {
      expect(shown(index), folder).toEqual(TUTORIAL_FILES[folder].map((file) => file.path));
    }
    const pictures = steps.map((step) => step.querySelector('img')?.getAttribute('src') ?? null);
    expect(pictures).toEqual([
      null,
      'tutorial/02-new-app.webp',
      'tutorial/03-hello.webp',
      'tutorial/04-kit.webp',
      'tutorial/05-shell.webp',
      'tutorial/06-pages.webp',
      'tutorial/07-list.webp',
      'tutorial/08-search.webp',
      'tutorial/09-panel.webp',
    ]);
    for (const image of steps.flatMap((step) => Array.from(step.querySelectorAll('img')))) {
      expect(image.getAttribute('alt')?.length).toBeGreaterThan(0);
    }
  });

  describe('its app, as each step leaves it', () => {
    it('puts the app in the shell with its two pages in the rail', async () => {
      setUp();
      const { host } = await render(ShellApp);

      expect(host.querySelector('neat-shell')).not.toBeNull();
      const labels = Array.from(host.querySelectorAll('a[neatRailItem]'), (a) =>
        a.textContent?.trim(),
      );
      expect(labels).toEqual(['Streams', 'About']);
    });

    it('routes the two pages, the Streams page first', () => {
      expect(pageRoutes.map((route) => route.path)).toEqual(['', 'streams', 'about']);
      expect(pageRoutes[0].redirectTo).toBe('streams');
    });

    it('filters the streams by what is typed, and counts them', async () => {
      setUp();
      const { fixture, host } = await render(SearchedStreams);
      const field = host.querySelector('neat-search input') as HTMLInputElement;

      field.value = 'mp4';
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(host.querySelectorAll('[role="option"]')).toHaveLength(2);
      expect(host.querySelector('neat-search .status')?.textContent?.trim()).toBe('2 of 5 streams');
    });

    it('shows the picked stream in the panel, and stops and starts it', async () => {
      setUp();
      const { fixture, host } = await render(PanelStreams);
      (host.querySelector('[role="option"]') as HTMLElement).click();
      await fixture.whenStable();

      const panel = () => host.querySelector('[neatPageAside]') as HTMLElement;
      expect(panel().querySelector('[neatAsideTitle]')?.textContent?.trim()).toBe('Front door');
      const button = () => panel().querySelector('[neatAsideActions] button') as HTMLButtonElement;
      expect(button().textContent?.trim()).toBe('Stop');

      button().click();
      await fixture.whenStable();
      expect(button().textContent?.trim()).toBe('Start');
      expect(host.querySelector('[role="option"] neat-badge')?.textContent?.trim()).toBe('Idle');
    });
  });
});
