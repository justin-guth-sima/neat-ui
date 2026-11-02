import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from './app';
import { appConfig } from './app.config';

const PAGES = [
  { path: '/getting-started', link: 'Getting started', heading: 'Add the package' },
  { path: '/theme/tokens', link: 'Theme', heading: 'Theme variables' },
  { path: '/theme/colours', link: 'Theme', heading: 'ThemeService' },
  { path: '/theme/icons', link: 'Theme', heading: 'NeatIcon' },
  { path: '/layout/shell', link: 'Layout', heading: 'NeatShell' },
  { path: '/layout/page', link: 'Layout', heading: 'NeatPage' },
  { path: '/layout/side-panel', link: 'Layout', heading: 'NeatAsidePanel' },
  { path: '/components/button', link: 'Components', heading: 'NeatButton' },
  { path: '/components/input', link: 'Components', heading: 'NeatInput' },
  { path: '/components/status-chip', link: 'Components', heading: 'NeatStatusChip' },
  { path: '/components/table', link: 'Components', heading: 'NeatTable' },
  { path: '/components/time-chart', link: 'Components', heading: 'NeatTimeChart' },
  { path: '/components/sparkline', link: 'Components', heading: 'NeatSparkline' },
  { path: '/components/diagram', link: 'Components', heading: 'NeatDiagramView' },
  { path: '/components/video-tile', link: 'Components', heading: 'NeatVideoTile' },
];

/** Components' categories, in list order, with their topics' count. */
const CATEGORIES = [
  ['Actions', 8],
  ['Forms', 9],
  ['Status', 9],
  ['Data', 7],
  ['Charts', 6],
  ['Diagram', 4],
  ['Video', 4],
] as const;

/**
 * The docs pages size their sliders, tile grid and video tile through ResizeObserver, which
 * jsdom lacks; these specs check routing and page content, not sizes.
 */
class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  const root = (): HTMLElement => fixture.nativeElement;
  const content = (): HTMLElement => root().querySelector('neat-shell main.content') as HTMLElement;

  async function navigate(path: string): Promise<void> {
    await router.navigateByUrl(path);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    // jsdom has no canvas, and says so on the console; the theme page resolves colours on one.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    TestBed.configureTestingModule({ providers: appConfig.providers });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    await navigate('/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('lists Getting started, Theme, Layout and Components in the rail, in order', () => {
    // The rail is the shell's first nav; the page's tabs, a nav of the page, come after it.
    const rail = root().querySelector('nav') as HTMLElement;
    const labels = Array.from(rail.querySelectorAll('a'), (a) => a.textContent?.trim());
    expect(labels).toEqual(['Getting started', 'Theme', 'Layout', 'Components']);
  });

  it('opens a group on its first topic, the rail item staying open on the group’s topics', async () => {
    await navigate('/components');

    expect(router.url).toBe('/components/button');
    expect(root().querySelector('nav a.active')?.textContent?.trim()).toBe('Components');

    await navigate('/theme');

    expect(router.url).toBe('/theme/tokens');
    expect(root().querySelector('nav a.active')?.textContent?.trim()).toBe('Theme');
  });

  it('redirects the root to Getting started', () => {
    expect(router.url).toBe('/getting-started');
    expect(root().querySelector('nav a.active')?.textContent?.trim()).toBe('Getting started');
  });

  it.each([
    ['/data/select-list', '/components/select-list'],
    ['/charts', '/components/sparkline'],
    ['/diagram/drill-down', '/components/drill-down'],
    ['/actions', '/components/button'],
  ])('sends the old address %s to %s', async (path, to) => {
    await navigate(path);

    expect(router.url).toBe(to);
  });

  it.each(['/legacy/charts', '/nowhere/at/all', '/components/nothing'])(
    'sends the unknown address %s to Getting started',
    async (path) => {
      await navigate(path);

      expect(router.url).toBe('/getting-started');
    },
  );

  it('lists Components’ topics under seven headings, with a filter', async () => {
    await navigate('/components/select-list');
    const list = content().querySelector('app-topic-list') as HTMLElement;
    const headings = () =>
      Array.from(list.querySelectorAll('h2'), (heading) => heading.textContent?.trim());
    const links = () => Array.from(list.querySelectorAll('a'), (link) => link.textContent?.trim());

    expect(content().querySelector('neat-page h2')?.textContent).toContain('NeatSelectList');
    expect(headings()).toEqual(CATEGORIES.map(([label]) => label));
    expect(links()).toHaveLength(47);
    for (const list of Array.from(content().querySelectorAll('app-topic-list ul'))) {
      const label = content().querySelector(`[id="${list.getAttribute('aria-labelledby')}"]`);
      const count = CATEGORIES.find(([name]) => name === label?.textContent?.trim())?.[1];
      expect(list.querySelectorAll('a').length, label?.textContent ?? '').toBe(count);
    }
    expect(
      Array.from(list.querySelectorAll('a[aria-current="page"]'), (link) =>
        link.getAttribute('href'),
      ),
    ).toEqual(['/components/select-list']);

    const field = list.querySelector('input[neatInput]') as HTMLInputElement;
    expect(field.getAttribute('aria-label')).toBe('Filter components');
    field.value = 'chart';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(headings()).toEqual(['Charts']);
    expect(links()).toEqual([
      'Sparkline',
      'Time chart',
      'Stacked chart',
      'Heatmap',
      'Chart card',
      'Series swatch',
    ]);
  });

  it('titles the document with the app name and the page', async () => {
    expect(document.title).toBe('neat-ui showcase · Getting started');

    await navigate('/components/select-list');

    expect(document.title).toBe('neat-ui showcase · Select list');

    await navigate('/demo/page/details');

    expect(document.title).toBe('neat-ui showcase · Details');
  });

  it.each(PAGES)('renders $path as a page inside the shell', async ({ path, link, heading }) => {
    await navigate(path);

    expect(content().querySelector('neat-page')).not.toBeNull();
    // The page's own first heading; Components' topic list beside it has headings too.
    expect(content().querySelector('neat-page h2')?.textContent).toContain(heading);
    expect(root().querySelector('nav a.active')?.textContent?.trim()).toBe(link);
    expect(root().querySelector('header h1')?.textContent?.trim()).toBe(link);
  });

  it('keeps only the kit’s theme switch at the rail’s end', () => {
    const end = root().querySelector('neat-shell .rail-end') as HTMLElement;
    const items = Array.from(end.querySelectorAll('[neatRailItem]'), (item) =>
      item.textContent?.trim(),
    );

    expect(items).toEqual(['Dark theme']);
  });
});
