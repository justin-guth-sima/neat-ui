import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from './app';
import { appConfig } from './app.config';

const PAGES = [
  { path: '/theme/tokens', link: 'Theme', heading: 'Theme variables' },
  { path: '/theme/colours', link: 'Theme', heading: 'ThemeService' },
  { path: '/theme/icons', link: 'Theme', heading: 'NeatIcon' },
  { path: '/layout/shell', link: 'Layout', heading: 'NeatShell' },
  { path: '/layout/page', link: 'Layout', heading: 'NeatPage' },
  { path: '/layout/side-panel', link: 'Layout', heading: 'NeatAsidePanel' },
  { path: '/actions/button', link: 'Actions', heading: 'NeatButton' },
  { path: '/forms/input', link: 'Forms', heading: 'NeatInput' },
  { path: '/status/status-chip', link: 'Status', heading: 'NeatStatusChip' },
  { path: '/data/table', link: 'Data', heading: 'NeatTable' },
  { path: '/charts/time-chart', link: 'Charts', heading: 'NeatTimeChart' },
  { path: '/charts/sparkline', link: 'Charts', heading: 'NeatSparkline' },
  { path: '/diagram/diagram', link: 'Diagram', heading: 'NeatDiagramView' },
  { path: '/video/video-tile', link: 'Video', heading: 'NeatVideoTile' },
];

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

  it('lists the nine docs groups, in order, in the shell navigation', () => {
    // The rail is the shell's first nav; the page's tabs, a nav of the page, come after it.
    const rail = root().querySelector('nav') as HTMLElement;
    const labels = Array.from(rail.querySelectorAll('a'), (a) => a.textContent?.trim());
    expect(labels).toEqual([
      'Theme',
      'Layout',
      'Actions',
      'Forms',
      'Status',
      'Data',
      'Charts',
      'Diagram',
      'Video',
    ]);
  });

  it('opens a group on its first topic, the rail item staying open on the group’s topics', async () => {
    await navigate('/charts');

    expect(router.url).toBe('/charts/sparkline');
    expect(root().querySelector('nav a.active')?.textContent?.trim()).toBe('Charts');
  });

  it('redirects the root to the theme page, and the theme group to its first topic', async () => {
    expect(router.url).toBe('/theme/tokens');

    await navigate('/theme');

    expect(router.url).toBe('/theme/tokens');
  });

  it.each(['/components', '/legacy/charts', '/nowhere/at/all'])(
    'sends the old or unknown address %s to the first topic',
    async (path) => {
      await navigate(path);

      expect(router.url).toBe('/theme/tokens');
    },
  );

  it('titles the document with the app name and the page', async () => {
    expect(document.title).toBe('neat-ui showcase · Tokens');

    await navigate('/demo/page/details');

    expect(document.title).toBe('neat-ui showcase · Details');
  });

  it.each(PAGES)('renders $path as a page inside the shell', async ({ path, link, heading }) => {
    await navigate(path);

    expect(content().querySelector('neat-page')).not.toBeNull();
    expect(content().querySelector('h2')?.textContent).toContain(heading);
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
