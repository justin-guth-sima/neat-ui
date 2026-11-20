import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from './app';
import { appConfig } from './app.config';

/**
 * A page of each kind, with its rail item and the top bar's title: a sub-page's label beside its
 * page's, a topic of a category beside "page › category", Getting started's beside its own.
 */
const PAGES = [
  {
    path: '/getting-started',
    link: 'Getting started',
    heading: 'Add the package',
    title: 'Quick start Getting started',
  },
  {
    path: '/getting-started/tutorial',
    link: 'Getting started',
    heading: 'Install Node.js',
    title: 'Tutorial Getting started',
  },
  { path: '/theme/tokens', link: 'Theme', heading: 'Theme variables', title: 'Tokens Theme' },
  { path: '/theme/colors', link: 'Theme', heading: 'ThemeService', title: 'Colors Theme' },
  { path: '/theme/icons', link: 'Theme', heading: 'NeatIcon', title: 'Icons Theme' },
  { path: '/layout/shell', link: 'Layout', heading: 'NeatShell', title: 'Shell Layout' },
  { path: '/layout/page', link: 'Layout', heading: 'NeatPage', title: 'Page Layout' },
  {
    path: '/layout/aside',
    link: 'Layout',
    heading: 'NeatAsidePanel',
    title: 'Aside Layout',
  },
  {
    path: '/components/actions/button',
    link: 'Components',
    heading: 'NeatButton',
    title: 'Button Components › Actions',
  },
  {
    path: '/components/forms/input',
    link: 'Components',
    heading: 'NeatInput',
    title: 'Input Components › Forms',
  },
  {
    path: '/components/status/status-chip',
    link: 'Components',
    heading: 'NeatStatusChip',
    title: 'Status chip Components › Status',
  },
  {
    path: '/components/data/table',
    link: 'Components',
    heading: 'NeatTable',
    title: 'Table Components › Data',
  },
  {
    path: '/components/charts/time-chart',
    link: 'Components',
    heading: 'NeatTimeChart',
    title: 'Time chart Components › Charts',
  },
  {
    path: '/components/charts/sparkline',
    link: 'Components',
    heading: 'NeatSparkline',
    title: 'Sparkline Components › Charts',
  },
  {
    path: '/components/diagram/diagram',
    link: 'Components',
    heading: 'NeatDiagramView',
    title: 'Diagram Components › Diagram',
  },
  {
    path: '/components/video/video-tile',
    link: 'Components',
    heading: 'NeatVideoTile',
    title: 'Video tile Components › Video',
  },
];

/** Components' categories, its sub-pages in the rail, in order, with their topics' count. */
const CATEGORIES = [
  ['Actions', '/components/actions', 8],
  ['Forms', '/components/forms', 9],
  ['Status', '/components/status', 9],
  ['Data', '/components/data', 7],
  ['Charts', '/components/charts', 6],
  ['Diagram', '/components/diagram', 4],
  ['Video', '/components/video', 4],
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
  /** The rail's pages, and their sub-pages while unfolded, which are the `data-child` rows. */
  const rail = (): HTMLElement => root().querySelector('neat-shell nav') as HTMLElement;
  const linksOf = (links: Iterable<Element>) =>
    Array.from(links, (link) => [link.textContent?.trim(), link.getAttribute('href')]);
  const currentOf = (links: Iterable<Element>) =>
    Array.from(links)
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.textContent?.trim());

  /** Presses the rail's own control, "Show labels" or "Collapse". */
  async function pressRailControl(label: string): Promise<void> {
    const control = Array.from(
      root().querySelectorAll<HTMLButtonElement>('neat-shell button[neatRailItem]'),
    ).find((button) => button.textContent?.trim() === label) as HTMLButtonElement;
    control.click();
    await fixture.whenStable();
  }

  async function navigate(path: string): Promise<void> {
    await router.navigateByUrl(path);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    // jsdom has no canvas, and says so on the console; the theme page resolves colors on one.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    TestBed.configureTestingModule({ providers: appConfig.providers });
    router = TestBed.inject(Router);
    // The rail starts collapsed, as a first visit's does, whatever an earlier test chose.
    localStorage.clear();
    fixture = TestBed.createComponent(App);
    await navigate('/');
    // Sub-pages unfold only while the rail shows its labels; collapsed, they are a menu.
    await pressRailControl('Show labels');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('lists Getting started, Theme, Layout and Components in the rail, in order', () => {
    const labels = Array.from(rail().querySelectorAll('a:not([data-child])'), (a) =>
      a.textContent?.trim(),
    );
    expect(labels).toEqual(['Getting started', 'Theme', 'Layout', 'Components']);
  });

  it('unfolds Getting started’s Quick start and Tutorial under its rail item', async () => {
    await navigate('/getting-started/tutorial');
    const children = rail().querySelectorAll('a[data-child]');

    expect(linksOf(children)).toEqual([
      ['Quick start', '/getting-started'],
      ['Tutorial', '/getting-started/tutorial'],
    ]);
    expect(currentOf(children)).toEqual(['Tutorial']);
  });

  it('opens a page on its first sub-page, and a category on its first topic', async () => {
    await navigate('/components');

    expect(router.url).toBe('/components/actions/breadcrumbs');
    expect(rail().querySelector('a.active')?.textContent?.trim()).toBe('Components');

    await navigate('/components/data');

    expect(router.url).toBe('/components/data/card');

    await navigate('/theme');

    expect(router.url).toBe('/theme/tokens');
    expect(rail().querySelector('a.active')?.textContent?.trim()).toBe('Theme');
  });

  it('unfolds Theme’s topics under its rail item', async () => {
    await navigate('/theme/colors');
    const children = rail().querySelectorAll('a[data-child]');

    expect(linksOf(children)).toEqual([
      ['Tokens', '/theme/tokens'],
      ['Colors', '/theme/colors'],
      ['Icons', '/theme/icons'],
      ['Icon finder', '/theme/icon-finder'],
    ]);
    expect(currentOf(children)).toEqual(['Colors']);
  });

  it('unfolds Components’ seven categories under its rail item, the open one current', async () => {
    await navigate('/components/data/select-list');
    const children = rail().querySelectorAll('a[data-child]');

    expect(linksOf(children)).toEqual(CATEGORIES.map(([label, path]) => [label, path]));
    expect(currentOf(children)).toEqual(['Data']);
    // One row looks current: the category, not Components above it.
    expect(
      rail().querySelector('a.active:not([data-child])')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('keeps Components a link, with a categories’ menu on hover and focus, while the rail is collapsed', async () => {
    await navigate('/components/data/select-list');
    await pressRailControl('Collapse');
    const item = Array.from(rail().querySelectorAll('a[neatRailItem]')).find(
      (link) => link.textContent?.trim() === 'Components',
    );

    expect(rail().querySelector('a[data-child]')).toBeNull();
    expect(item?.hasAttribute('aria-haspopup')).toBe(false);
    expect(item?.getAttribute('href')).toBe('/components');
    expect(item?.getAttribute('aria-current')).toBe('page');
  });

  it('redirects the root to Getting started', () => {
    expect(router.url).toBe('/getting-started');
    expect(rail().querySelector('a.active')?.textContent?.trim()).toBe('Getting started');
  });

  // No redirects from earlier addresses: a category's own (`/data/select-list`) and a topic's
  // straight under Components (`/components/select-list`) are unknown now, as is any other.
  it.each([
    '/data/select-list',
    '/charts',
    '/components/select-list',
    '/components/button',
    '/legacy/charts',
    '/nowhere/at/all',
    '/components/nothing',
    '/components/data/nothing',
  ])('sends the unknown address %s to Getting started', async (path) => {
    await navigate(path);

    expect(router.url).toBe('/getting-started');
  });

  it('lists a category’s topics in the page nav, with a filter', async () => {
    await navigate('/components/data/select-list');
    const list = content().querySelector('neat-page > nav[neatPageNav]') as HTMLElement;
    const links = () => Array.from(list.querySelectorAll('a'), (link) => link.textContent?.trim());

    expect(content().querySelector('neat-page h2')?.textContent).toContain('NeatSelectList');
    expect(list.getAttribute('aria-label')).toBe('Data topics');
    expect(links()).toEqual([
      'Card',
      'Code block',
      'Collapsible',
      'Details',
      'File browser',
      'Line list',
      'Select list',
      'Stored signal',
      'Table',
    ]);
    expect(currentOf(list.querySelectorAll('a'))).toEqual(['Select list']);
    expect(list.querySelector('a[aria-current="page"]')?.getAttribute('href')).toBe(
      '/components/data/select-list',
    );

    const field = list.querySelector('input[type="search"]') as HTMLInputElement;
    expect(field.getAttribute('aria-label')).toBe('Filter topics');
    field.value = 'list';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(links()).toEqual(['Line list', 'Select list']);
  });

  it('renders no page tabs, which the kit no longer has', async () => {
    for (const path of ['/theme/tokens', '/layout/page', '/components/data/select-list']) {
      await navigate(path);

      expect(content().querySelector('[neatPageTabs]'), path).toBeNull();
    }
  });

  it('titles the document with the app name and the page', async () => {
    expect(document.title).toBe('neat-ui showcase · Quick start');

    await navigate('/components/data/select-list');

    expect(document.title).toBe('neat-ui showcase · Select list');

    await navigate('/demo/page/details');

    expect(document.title).toBe('neat-ui showcase · Details');
  });

  it.each(PAGES)(
    'renders $path as a page inside the shell',
    async ({ path, link, heading, title }) => {
      await navigate(path);

      expect(content().querySelector('neat-page')).not.toBeNull();
      expect(content().querySelector('neat-page h2')?.textContent).toContain(heading);
      expect(rail().querySelector('a.active')?.textContent?.trim()).toBe(link);
      expect(root().querySelector('header h1')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        title,
      );
    },
  );

  it('keeps only the kit’s theme switch at the rail’s end', () => {
    const end = root().querySelector('neat-shell .rail-end') as HTMLElement;
    const items = Array.from(end.querySelectorAll('[neatRailItem]'), (item) =>
      item.textContent?.trim(),
    );

    expect(items).toEqual(['Dark theme']);
  });
});
