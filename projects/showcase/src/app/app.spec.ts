import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from './app';
import { appConfig } from './app.config';

const PAGES = [
  { path: '/theme', link: 'Theme', heading: 'Palette' },
  { path: '/icons', link: 'Icons', heading: 'Icons' },
  { path: '/components', link: 'Components', heading: 'Button' },
  { path: '/charts', link: 'Charts', heading: 'Sparkline' },
  { path: '/page', link: 'Page', heading: 'Page' },
];

/**
 * The components page sizes its slider, tile grid and video tile through ResizeObserver, which
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
    TestBed.configureTestingModule({ providers: appConfig.providers });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    await navigate('/');
  });

  afterEach(() => vi.unstubAllGlobals());

  it('lists the five pages in the shell navigation', () => {
    const labels = Array.from(root().querySelectorAll('nav a'), (a) => a.textContent?.trim());
    expect(labels).toEqual(['Theme', 'Icons', 'Components', 'Charts', 'Page']);
  });

  it('redirects the root to the theme page', () => {
    expect(router.url).toBe('/theme');
  });

  it.each(PAGES)('renders $path as a page inside the shell', async ({ path, link, heading }) => {
    await navigate(path);

    expect(content().querySelector('neat-page')).not.toBeNull();
    expect(content().querySelector('h2')?.textContent).toContain(heading);
    expect(root().querySelector('nav a.active')?.textContent?.trim()).toBe(link);
    expect(root().querySelector('header h1')?.textContent?.trim()).toBe(link);
  });

  it('demonstrates the page toolbar and side panel on the page demo', async () => {
    await navigate('/page');
    const toggle = root().querySelector(
      'header neat-aside-toggle button[aria-label="Side panel"]',
    ) as HTMLButtonElement;
    const aside = (): HTMLElement | null => content().querySelector('neat-page aside');

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(aside()?.querySelector('h2')?.textContent).toBe('src3');

    toggle.click();
    await fixture.whenStable();

    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(aside()).toBeNull();
  });

  it('demonstrates page tabs on the page demo: route links, the open one marked', async () => {
    await navigate('/page');
    const tabs = (): HTMLAnchorElement[] =>
      Array.from(content().querySelectorAll<HTMLAnchorElement>('neat-page > nav a'));
    const open = (): string[] =>
      tabs()
        .filter((tab) => tab.getAttribute('aria-current') === 'page')
        .map((tab) => tab.textContent?.trim() ?? '');

    expect(content().querySelector('neat-page > nav')?.getAttribute('aria-label')).toBe(
      'Page demo views',
    );
    expect(tabs().map((tab) => tab.getAttribute('href'))).toEqual(['/page', '/page/details']);
    expect(open()).toEqual(['Overview']);

    await navigate('/page/details');

    expect(open()).toEqual(['Details']);
    // The rail's item stays open under the nested route.
    expect(root().querySelector('nav a.active')?.textContent?.trim()).toBe('Page');
  });
});
