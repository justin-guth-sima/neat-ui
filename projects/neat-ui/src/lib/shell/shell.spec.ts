import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Inbox } from 'lucide';
import { NeatBoardItem } from '../board-item/board-item';
import { NeatIcon } from '../icon/icon';
import { KIOSK_POINTER_IDLE_MS, KioskService } from '../kiosk/kiosk.service';
import { NeatAsideToggle } from '../page/aside';
import { ThemeService } from '../theme/theme.service';
import { NeatViewport } from '../page/viewport';
import { NeatNavItem } from './nav-item';
import { NeatPageToolbar, NeatPageToolbarDivider } from './page-toolbar';
import { NeatRailDivider, NeatRailItem } from './rail-item';
import { NeatShell } from './shell';
import shellStyles from './shell.css' with { loader: 'text' };

const RAIL_KEY = 'neat-ui:rail-expanded';

/**
 * Pages with sub-pages: Theme's and Layout's route to their own, Stats' first has the page's
 * path.
 */
const LEVEL_ITEMS: NeatNavItem[] = [
  {
    label: 'Theme',
    icon: 'viewer',
    path: '/theme',
    children: [
      { label: 'Tokens', path: '/theme/tokens' },
      { label: 'Colors', path: '/theme/colors' },
      { label: 'Icons', path: '/theme/icons' },
    ],
  },
  {
    label: 'Layout',
    icon: 'viewer',
    path: '/layout',
    children: [{ label: 'Grid', path: '/layout/grid' }],
  },
  {
    label: 'Components',
    icon: 'viewer',
    path: '/components',
    children: [{ label: 'Data', path: '/components/data' }],
  },
  {
    label: 'Stats',
    icon: 'viewer',
    path: '/stats',
    children: [
      { label: 'Live', path: '/stats' },
      { label: 'Runs', path: '/stats/runs' },
    ],
  },
  {
    label: 'Archive',
    icon: 'viewer',
    path: '/archive',
    children: [
      { label: 'Year', path: '/archive/2026' },
      { label: 'January', path: '/archive/2026/jan' },
    ],
  },
  {
    label: 'Reports',
    icon: 'viewer',
    path: '/reports',
    children: [
      { label: 'Summary', path: '/reports/summary' },
      { label: 'Runs', path: '/reports/runs' },
    ],
  },
  // A page whose icon no name of the kit's set fits, so the app gives a Lucide glyph.
  { label: 'Empty', icon: Inbox, path: '/empty', children: [] },
  { label: 'Home', icon: 'home', path: '/home' },
];

const NAV_ITEMS: NeatNavItem[] = [
  { label: 'Media', icon: 'media', path: '/media' },
  { label: 'Streaming', icon: 'streaming', path: '/streaming' },
  { label: 'Viewer', icon: 'viewer', path: '/viewer' },
];

@Component({ template: 'page content' })
class StubPage {}

/** A parent route's page, which shows its child route. */
@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class ParentPage {}

/** A page with a toolbar whose controls act on the page's own state. */
@Component({
  imports: [NeatPageToolbar],
  template: `
    <div class="toolbar-demo" *neatPageToolbar>
      <button type="button" (click)="next()">Next page</button>
      <span class="page-number">Page {{ page() }}</span>
    </div>
    <p class="viewer-body">page content</p>
  `,
})
class ToolbarPage {
  readonly page = signal(1);

  protected next(): void {
    this.page.update((page) => page + 1);
  }
}

@Component({
  imports: [NeatPageToolbar],
  template: `<span class="other-toolbar" *neatPageToolbar>Other tools</span>`,
})
class OtherToolbarPage {}

/** A page with tools and an aside, whose toggle it declares beside its toolbar. */
@Component({
  imports: [NeatAsideToggle, NeatPageToolbar],
  template: `
    <div *neatPageToolbar><button type="button" class="tool">Refresh</button></div>
    <neat-aside-toggle [(open)]="open" />
    <p>panel page</p>
  `,
})
class AsidePage {
  readonly open = signal(true);
}

/** A page whose tools have a divider between two groups. */
@Component({
  imports: [NeatPageToolbar, NeatPageToolbarDivider],
  template: `
    <ng-container *neatPageToolbar>
      <button type="button" class="tool">Refresh</button>
      <hr neatPageToolbarDivider />
      <button type="button" class="tool">Export</button>
    </ng-container>
  `,
})
class DividerPage {}

/** A page with an aside and no other tools. */
@Component({
  imports: [NeatAsideToggle],
  template: `<neat-aside-toggle label="Inspector" />`,
})
class AsideOnlyPage {}

/** The detail the app host passes; a spec sets it, and `beforeEach` clears it. */
const APP_DETAIL = signal<string | undefined>(undefined);

@Component({
  imports: [NeatIcon, NeatRailDivider, NeatRailItem, NeatShell, RouterOutlet],
  template: `
    <neat-shell appName="Neat Insight" [appDetail]="appDetail()" [navItems]="navItems">
      <span neatTopbarEnd class="board-status">Board connected</span>
      <button neatRailEnd neatRailItem type="button" label="System information">
        <neat-icon name="info" />
      </button>
      <hr neatRailEnd neatRailDivider class="app-divider" />
      <router-outlet />
    </neat-shell>
  `,
})
class AppHost {
  readonly navItems = NAV_ITEMS;
  readonly appDetail = APP_DETAIL;
}

/** An app whose rail holds the kit's board item, the one with a live region of its own. */
@Component({
  imports: [NeatBoardItem, NeatShell, RouterOutlet],
  template: `
    <neat-shell appName="Neat Insight" [navItems]="navItems">
      <neat-board-item neatRailEnd name="DevKit" address="192.168.1.20" connection="connected" />
      <router-outlet />
    </neat-shell>
  `,
})
class BoardHost {
  readonly navItems = NAV_ITEMS;
}

const boardRoutes: Routes = [
  { path: 'with-board', component: BoardHost, children: [{ path: '', component: StubPage }] },
];

const routes: Routes = [
  {
    path: '',
    component: AppHost,
    children: [
      { path: 'media', component: StubPage },
      { path: 'streaming', component: StubPage },
      { path: 'streaming/:slot', component: StubPage },
      { path: 'viewer', component: StubPage },
      { path: 'viewer/grid', component: ToolbarPage },
      { path: 'media/library', component: OtherToolbarPage },
      { path: 'viewer/divider', component: DividerPage },
      { path: 'viewer/panel', component: AsidePage },
      { path: 'viewer/inspect', component: AsideOnlyPage },
      // Routes that no nav item matches, one with a title, and one a nav item matches with its own.
      { path: 'board', title: 'Board', component: StubPage },
      { path: 'untitled', component: StubPage },
      { path: 'media/titled', title: 'Library', component: StubPage },
    ],
  },
];

@Component({
  imports: [NeatShell, RouterOutlet],
  template: `
    <neat-shell appName="Neat Insight" [navItems]="navItems"><router-outlet /></neat-shell>
  `,
})
class LevelsHost {
  readonly navItems = LEVEL_ITEMS;
}

const levelRoutes: Routes = [
  {
    path: '',
    component: LevelsHost,
    children: [
      { path: 'theme', component: StubPage },
      { path: 'theme/tokens', component: StubPage },
      { path: 'theme/colors', component: StubPage },
      { path: 'theme/icons', component: StubPage },
      { path: 'layout', component: StubPage },
      { path: 'layout/grid', component: StubPage },
      { path: 'components/data', component: StubPage },
      { path: 'components/data/select-list', title: 'Select list', component: StubPage },
      { path: 'components/data/untitled', component: StubPage },
      { path: 'stats', component: StubPage },
      { path: 'stats/runs', component: StubPage },
      { path: 'stats/runs/compare', title: 'Compare', component: StubPage },
      { path: 'archive/2026', component: StubPage },
      { path: 'archive/2026/jan', component: StubPage },
      { path: 'archive/2026/jan/week', component: StubPage },
      // The shape of an app that titles a page's one route: the views under it have no titles.
      {
        path: 'reports',
        title: 'Reports',
        component: ParentPage,
        children: [
          { path: 'summary', component: StubPage },
          {
            path: 'runs',
            component: ParentPage,
            children: [
              { path: '', component: StubPage },
              { path: ':id', component: StubPage },
              { path: ':id/log', title: 'Run log', component: StubPage },
            ],
          },
        ],
      },
      { path: 'empty', component: StubPage },
      { path: 'home', component: StubPage },
    ],
  },
];

describe('NeatShell', () => {
  let harness: RouterTestingHarness;

  const shell = (): HTMLElement => harness.fixture.nativeElement.querySelector('neat-shell');
  const nav = (): HTMLElement => shell().querySelector('nav') as HTMLElement;
  const links = (): HTMLAnchorElement[] => Array.from(nav().querySelectorAll('a'));
  const link = (label: string): HTMLAnchorElement =>
    links().find((a) => a.textContent?.trim() === label) as HTMLAnchorElement;
  const topbar = (): HTMLElement => shell().querySelector('header') as HTMLElement;
  /** The shell's button of that accessible name: its `aria-label`, or its text (a rail item's). */
  const button = (name: string): HTMLButtonElement =>
    (Array.from(shell().querySelectorAll('button')).find(
      (element) => (element.ariaLabel ?? element.textContent?.trim()) === name,
    ) ?? null) as HTMLButtonElement;
  /** The sidebar trigger at the top bar's start: named for what a press does. */
  const railToggle = (): HTMLButtonElement =>
    shell().querySelector('header button[data-sidebar="trigger"]') as HTMLButtonElement;
  const triggerName = (): string | null => railToggle().getAttribute('aria-label');
  /** The sidebar on a wide screen: the grid item helm's state attributes are on. */
  const sidebar = (): HTMLElement => shell().querySelector('[data-slot="sidebar"]') as HTMLElement;
  /** The sidebar footer's rows: the shell's divider, the app's items, the theme item. */
  const footerMenu = (): HTMLElement =>
    shell().querySelector('[data-sidebar="footer"] > [data-sidebar="menu"]') as HTMLElement;
  /** The kit's theme item, the last of the footer's rows. */
  const themeToggle = (): HTMLButtonElement =>
    footerMenu().querySelector(':scope > button[neatRailItem]:last-child') as HTMLButtonElement;
  const systemInfo = (): HTMLButtonElement => button('System information');
  const asideToggle = (name = 'Side panel'): HTMLButtonElement => button(name);
  const asideEdge = (): HTMLElement | null => shell().querySelector('.aside-edge');
  const kioskButton = (): HTMLButtonElement => button('Kiosk mode');
  const exitControl = (): HTMLButtonElement => button('Exit kiosk mode');
  const main = (): HTMLElement => shell().querySelector('main') as HTMLElement;
  const toolbarDemo = (): HTMLElement | null => shell().querySelector('.toolbar-demo');
  const toolbarRegion = (): HTMLElement | null => shell().querySelector('.page-toolbar');
  const kioskToolbar = (): HTMLElement | null => shell().querySelector('.kiosk-toolbar');
  const kioskChrome = (): HTMLElement => shell().querySelector('.kiosk-chrome') as HTMLElement;
  /** The opacity the element is drawn with: its own times every ancestor's. */
  const renderedOpacity = (element: Element): number => {
    let opacity = 1;
    for (let node: Element | null = element; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity || 1);
    }
    return opacity;
  };
  /**
   * The element's `pointer-events`, inheritance included: jsdom does not inherit it, so the nearest
   * value other than `auto` on the element or an ancestor stands in (nothing in the shell sets
   * `auto` to undo an ancestor's `none`).
   */
  const pointerEvents = (element: Element): string => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const value = getComputedStyle(node).pointerEvents;
      if (value && value !== 'auto') {
        return value;
      }
    }
    return 'auto';
  };
  const labelOf = (item: HTMLElement): HTMLElement => item.querySelector('.label') as HTMLElement;
  /** The declarations of the stylesheet's rule for `selector`, written as in the stylesheet. */
  const rule = (selector: string): string | undefined =>
    new RegExp(`${selector.replace(/[()[\]'.]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(shellStyles)?.[1];
  const tooltip = (): HTMLElement | null => document.querySelector('[role="tooltip"]');
  /**
   * A mouse entering `element`. jsdom lays nothing out, so the viewport gets a size and the element
   * a place in its middle, where a tooltip fits on its preferred side and does not flip.
   */
  const hover = (element: HTMLElement): void => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    element.getBoundingClientRect = () => new DOMRect(492, 364, 40, 40);
    element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  };

  const start = async (url = '/media'): Promise<void> => {
    harness = await RouterTestingHarness.create(url);
  };

  const settle = async (): Promise<void> => {
    await harness.fixture.whenStable();
  };

  /** Lets timers due now run (tooltips open on a zero delay), then change detection. */
  const tick = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve));
    await settle();
  };

  beforeEach(() => {
    localStorage.clear();
    APP_DETAIL.set(undefined);
    TestBed.configureTestingModule({
      providers: [provideRouter([...boardRoutes, ...routes, ...levelRoutes])],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
    history.replaceState(null, '', '/');
    document.documentElement.classList.remove('neat-dark');
  });

  it('renders one rail link per nav item, with label as tooltip and accessible name', async () => {
    await start();

    expect(nav().getAttribute('aria-label')).toBe('Main');
    expect(links().map((a) => a.textContent?.trim())).toEqual(['Media', 'Streaming', 'Viewer']);
    expect(links().map((a) => a.getAttribute('href'))).toEqual(['/media', '/streaming', '/viewer']);
    // The icon is decorative, so the visible (or visually hidden) label is the whole name.
    expect(link('Viewer').querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    hover(link('Viewer'));
    await tick();

    expect(tooltip()?.textContent?.trim()).toBe('Viewer');
    expect(tooltip()?.getAttribute('data-side')).toBe('right');
  });

  it('marks the active route (aria-current="page") and shows its label as the page title', async () => {
    await start('/streaming');

    expect(link('Streaming').getAttribute('aria-current')).toBe('page');
    expect(link('Media').hasAttribute('aria-current')).toBe(false);
    expect(topbar().querySelector('h1')?.textContent?.trim()).toBe('Streaming');

    await harness.navigateByUrl('/viewer');

    expect(link('Viewer').getAttribute('aria-current')).toBe('page');
    expect(link('Streaming').hasAttribute('aria-current')).toBe(false);
    expect(topbar().querySelector('h1')?.textContent?.trim()).toBe('Viewer');
  });

  it('keeps a nav item active on the routes nested under it', async () => {
    await start('/streaming/3?view=grid');

    expect(link('Streaming').getAttribute('aria-current')).toBe('page');
    expect(topbar().querySelector('h1')?.textContent?.trim()).toBe('Streaming');
  });

  it('takes the page title from the route’s title where no nav item matches', async () => {
    await start('/board');

    expect(links().some((a) => a.hasAttribute('aria-current'))).toBe(false);
    expect(topbar().querySelector('h1')?.textContent?.trim()).toBe('Board');
  });

  it('prefers the nav item’s label to the route’s title', async () => {
    await start('/media/titled');

    expect(topbar().querySelector('h1')?.textContent?.trim()).toBe('Media');
  });

  it('shows no page title for a route with neither a nav item nor a title', async () => {
    await start('/board');
    await harness.navigateByUrl('/untitled');

    expect(topbar().querySelector('h1')).toBeNull();
  });

  it('the sidebar carries helm’s state attributes', async () => {
    await start();
    // So helm's `group-data-[collapsible=icon]:` classes, copied verbatim, key on it.
    expect(sidebar().classList).toContain('group');
    expect(sidebar().classList).toContain('peer');
    expect(sidebar().getAttribute('data-variant')).toBe('sidebar');
    expect(sidebar().getAttribute('data-side')).toBe('left');
    expect(sidebar().getAttribute('data-state')).toBe('collapsed');
    expect(sidebar().getAttribute('data-collapsible')).toBe('icon');

    railToggle().click();
    await settle();

    expect(sidebar().getAttribute('data-state')).toBe('expanded');
    expect(sidebar().getAttribute('data-collapsible')).toBe('');
  });

  describe('the sidebar header', () => {
    const header = (): HTMLElement =>
      sidebar().querySelector('[data-sidebar="header"]') as HTMLElement;
    const text = (): HTMLElement => header().querySelector('.app-text') as HTMLElement;

    it('the header holds the logo, the app name and appDetail', async () => {
      localStorage.setItem(RAIL_KEY, 'true');
      APP_DETAIL.set('0.46.0');
      await start();

      const logo = header().querySelector('svg[role="img"]');
      expect(logo?.getAttribute('aria-label')).toBe('SiMa.ai');
      expect(header().querySelector('.app-name')?.textContent).toBe('Neat Insight');
      expect(header().querySelector('.app-detail')?.textContent?.trim()).toBe('0.46.0');
      expect(text().classList).not.toContain('sr-only');
      // Not a control: the header has nothing to switch.
      expect(header().querySelector('a, button')).toBeNull();
      expect(topbar().querySelector('svg[role="img"]')).toBeNull();
    });

    it('collapsed, the header shows the logo alone', async () => {
      APP_DETAIL.set('0.46.0');
      await start();

      expect(header().querySelector('svg[role="img"]')).not.toBeNull();
      // Visually hidden, still in the accessible tree.
      expect(text().classList).toContain('sr-only');
      expect(header().querySelector('.app-name')?.textContent).toBe('Neat Insight');
      expect(header().querySelector('.app-detail')?.textContent?.trim()).toBe('0.46.0');
    });

    it('collapsed without a detail, the name alone is visually hidden', async () => {
      await start();

      expect(appName().classList).toContain('sr-only');
      expect(header().contains(appName())).toBe(true);
    });

    it('a long name without a detail ends in an ellipsis', async () => {
      localStorage.setItem(RAIL_KEY, 'true');
      await start();

      // A flex item of the brand's row: without `min-width: 0` it keeps its text's width and is
      // clipped by the row with no ellipsis.
      const name = getComputedStyle(appName());
      expect(name.minWidth).toBe('0px');
      expect(name.overflow).toBe('hidden');
      expect(name.textOverflow).toBe('ellipsis');
      expect(name.whiteSpace).toBe('nowrap');
    });
  });

  it('the trigger leads the top bar and is named for what it does', async () => {
    await start('/viewer/grid');
    const focusable = Array.from(
      topbar().querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ).filter((element) => element.tabIndex >= 0);
    expect(focusable[0]).toBe(railToggle());
    expect(triggerName()).toBe('Show labels');
    expect(railToggle().querySelector('neat-icon')?.getAttribute('data-icon')).toBe('rail-expand');
    // A divider sets it apart from the page title.
    expect(railToggle().nextElementSibling?.matches('hr[neatPageToolbarDivider]')).toBe(true);
    hover(railToggle());
    await tick();
    expect(tooltip()?.textContent?.trim()).toBe('Show labels');

    railToggle().click();
    await settle();

    expect(triggerName()).toBe('Hide labels');
    expect(railToggle().querySelector('neat-icon')?.getAttribute('data-icon')).toBe(
      'rail-collapse',
    );
    expect(localStorage.getItem(RAIL_KEY)).toBe('true');

    railToggle().click();
    await settle();

    expect(triggerName()).toBe('Show labels');
    expect(localStorage.getItem(RAIL_KEY)).toBe('false');
  });

  it('the sidebar’s edge toggles on click and is hidden from assistive technology', async () => {
    await start();
    const edge = sidebar().querySelector('[data-sidebar="rail"]') as HTMLButtonElement;

    expect(edge.getAttribute('aria-hidden')).toBe('true');
    expect(edge.tabIndex).toBe(-1);
    // A pointer's hint, the trigger's name.
    expect(edge.title).toBe('Show labels');

    edge.click();
    await settle();
    expect(triggerName()).toBe('Hide labels');
    expect(edge.title).toBe('Hide labels');
    expect(sidebar().getAttribute('data-state')).toBe('expanded');

    edge.click();
    await settle();
    expect(triggerName()).toBe('Show labels');
  });

  it('the tab order is the sidebar, then the top bar, then the content', async () => {
    await start('/viewer/panel');
    const focusable = Array.from(
      shell().querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ).filter((element) => element.tabIndex >= 0);

    expect(focusable.map((element) => element.textContent?.trim() || element.ariaLabel)).toEqual([
      'Media',
      'Streaming',
      'Viewer',
      'System information',
      'Dark theme',
      'Show labels',
      'Refresh',
      'Kiosk mode',
      'Side panel',
    ]);
    expect(
      sidebar().compareDocumentPosition(topbar()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      topbar().compareDocumentPosition(main()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('the shell stays in its box', async () => {
    localStorage.setItem(RAIL_KEY, 'true');
    await start('/viewer/grid');

    // Helm's sidebar is fixed to the viewport; the kit's is a column of the shell's grid, so a
    // shell in a bounded box (a demo frame) keeps its sidebar inside it.
    const classes = Array.from(shell().querySelectorAll('*')).flatMap((element) => [
      ...element.classList,
    ]);
    expect(classes).not.toContain('fixed');
    expect(classes.filter((name) => /(^|:)h-[sdl]?vh$/.test(name))).toEqual([]);
    // The one inset-y-0 is helm's edge strip, absolute inside the sidebar's own container.
    for (const element of shell().querySelectorAll('.inset-y-0')) {
      expect(element.classList).toContain('absolute');
      expect(sidebar().contains(element)).toBe(true);
    }
    expect(sidebar().parentElement).toBe(shell());
    expect(getComputedStyle(sidebar()).gridArea).toMatch(/^sidebar/);
  });

  it('the pages scroll while collapsed too, so a short window reaches them all', async () => {
    await start();

    const content = nav().parentElement as HTMLElement;
    expect(content.getAttribute('data-sidebar')).toBe('content');
    expect(sidebar().getAttribute('data-collapsible')).toBe('icon');
    expect(content.classList).toContain('overflow-auto');
    // Collapsed, only the sideways overflow is hidden (the rows' labels), never the scrolling.
    expect(content.classList).toContain('group-data-[collapsible=icon]:overflow-x-hidden');
    expect(content.classList).not.toContain('group-data-[collapsible=icon]:overflow-hidden');
  });

  it('page icons are 16 px', async () => {
    await start();

    const icons = links().map((a) => a.querySelector('neat-icon') as HTMLElement);
    expect(icons).toHaveLength(3);
    for (const icon of icons) {
      expect(icon.querySelector('svg')?.getAttribute('width')).toBe('16');
    }
  });

  it('app items render once', async () => {
    localStorage.setItem(RAIL_KEY, 'true');
    await start();

    // The app wrote two: its System information item and a divider.
    expect(document.querySelectorAll('[neatRailEnd]')).toHaveLength(2);
    expect(
      Array.from(document.querySelectorAll('button')).filter(
        (element) => element.textContent?.trim() === 'System information',
      ),
    ).toHaveLength(1);
  });

  it('expands the rail to show labels and persists that under neat-ui:rail-expanded', async () => {
    await start();
    expect(triggerName()).toBe('Show labels');
    expect(labelOf(link('Media')).classList).toContain('sr-only');

    railToggle().click();
    await settle();

    expect(triggerName()).toBe('Hide labels');
    expect(labelOf(link('Media')).classList).not.toContain('sr-only');
    expect(localStorage.getItem(RAIL_KEY)).toBe('true');

    // Labels are visible now, so the links show no tooltip.
    hover(link('Media'));
    await tick();
    expect(tooltip()).toBeNull();

    railToggle().click();
    await settle();

    expect(triggerName()).toBe('Show labels');
    expect(localStorage.getItem(RAIL_KEY)).toBe('false');
  });

  it('keeps the collapsed rail’s hidden labels inside their items, which scroll with the nav', async () => {
    await start();

    // A hidden label is absolutely positioned. Its containing block is its item, inside the nav
    // that scrolls: past it (the shell host is not positioned) a label below the fold would make
    // the whole document scroll.
    expect(labelOf(link('Media')).classList).toContain('sr-only');
    expect(getComputedStyle(link('Media')).position).toBe('relative');
    expect(nav().contains(link('Media'))).toBe(true);
  });

  it('restores an expanded rail on start', async () => {
    localStorage.setItem(RAIL_KEY, 'true');

    await start();

    expect(triggerName()).toBe('Hide labels');
    expect(labelOf(link('Media')).classList).not.toContain('sr-only');
  });

  it('keeps the rail collapsed by default when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    await start();

    expect(triggerName()).toBe('Show labels');

    railToggle().click();
    await settle();

    expect(triggerName()).toBe('Hide labels');
  });

  it('switches the color scheme from the rail’s last end item, named for what a click does', async () => {
    await start();
    const theme = TestBed.inject(ThemeService);
    expect(sidebar().contains(themeToggle())).toBe(true);
    expect(topbar().contains(themeToggle())).toBe(false);
    expect(themeToggle().textContent?.trim()).toBe('Dark theme');
    expect(themeToggle().querySelector('neat-icon')?.getAttribute('data-icon')).toBe('moon');

    themeToggle().click();
    await settle();

    expect(theme.scheme()).toBe('dark');
    expect(themeToggle().textContent?.trim()).toBe('Light theme');
    expect(themeToggle().querySelector('neat-icon')?.getAttribute('data-icon')).toBe('sun');

    themeToggle().click();
    await settle();

    expect(theme.scheme()).toBe('light');
    expect(themeToggle().textContent?.trim()).toBe('Dark theme');
  });

  it('gives the theme item and the trigger no pressed state: they are actions', async () => {
    await start();
    expect(themeToggle().hasAttribute('aria-pressed')).toBe(false);
    expect(railToggle().hasAttribute('aria-pressed')).toBe(false);

    themeToggle().click();
    railToggle().click();
    await settle();

    expect(themeToggle().hasAttribute('aria-pressed')).toBe(false);
    expect(railToggle().hasAttribute('aria-pressed')).toBe(false);
  });

  it('is a rail item: its label shows when the rail is expanded and is a right tooltip when not', async () => {
    await start();
    expect(labelOf(themeToggle()).classList).toContain('sr-only');

    hover(themeToggle());
    await tick();
    expect(tooltip()?.textContent?.trim()).toBe('Dark theme');
    expect(tooltip()?.getAttribute('data-side')).toBe('right');

    railToggle().click();
    await settle();
    expect(labelOf(themeToggle()).classList).not.toContain('sr-only');
  });

  it('projects [neatRailEnd] into the sidebar’s footer, below a divider: the app’s items, then the theme', async () => {
    await start();
    const end = footerMenu();

    expect(sidebar().contains(end)).toBe(true);
    expect(nav().contains(end)).toBe(false);
    expect(end.contains(systemInfo())).toBe(true);
    expect([...end.children].at(-1)).toBe(themeToggle());
    expect(sidebar().contains(railToggle())).toBe(false);
    // The line above the group is the kit's rail divider, the element an app draws between its
    // own items, so the pattern exists once.
    const children = [...end.children];
    expect(children[0].matches('hr[neatRailDivider]')).toBe(true);
    expect(children.map((child) => child.tagName)).toEqual(['HR', 'BUTTON', 'HR', 'BUTTON']);
    expect(children[2].classList).toContain('app-divider');
  });

  it('reaches the sidebar’s footer items in order after the pages, from the keyboard', async () => {
    await start();
    const focusable = Array.from(
      sidebar().querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ).filter((element) => element.tabIndex >= 0);

    expect(focusable.map((element) => element.textContent?.trim() || element.ariaLabel)).toEqual([
      'Media',
      'Streaming',
      'Viewer',
      'System information',
      'Dark theme',
    ]);
  });

  it('keeps the names of the app’s collapsed rail items: the label, visually hidden, and a tooltip', async () => {
    await start();
    expect(systemInfo().textContent?.trim()).toBe('System information');
    expect(labelOf(systemInfo()).classList).toContain('sr-only');

    hover(systemInfo());
    await tick();
    expect(tooltip()?.textContent?.trim()).toBe('System information');
    expect(tooltip()?.getAttribute('data-side')).toBe('right');
  });

  it('hides rail and top bar while kiosk is active', async () => {
    await start();
    const kiosk = TestBed.inject(KioskService);

    await kiosk.enter();
    await settle();

    expect(shell().querySelector('nav')).toBeNull();
    expect(shell().querySelector('[data-slot="sidebar"]')).toBeNull();
    expect(shell().querySelector('header')).toBeNull();
    expect(main().textContent).toContain('page content');
    // The content area takes the whole viewport.
    expect(getComputedStyle(shell()).gridTemplateAreas).toBe('"content"');

    await kiosk.exit();
    await settle();

    expect(nav().getAttribute('aria-label')).toBe('Main');
    expect(sidebar().textContent).toContain('Neat Insight');
    expect(getComputedStyle(shell()).gridTemplateAreas).toBe('"sidebar topbar" "sidebar content"');
  });

  it('shows the exit control on pointer movement and hides it when the pointer is idle', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await start();
    expect(exitControl()).toBeNull();

    await TestBed.inject(KioskService).enter();
    await settle();
    const control = exitControl();
    const shown = () => renderedOpacity(control) === 1;
    expect(shown()).toBe(true);

    await vi.advanceTimersByTimeAsync(KIOSK_POINTER_IDLE_MS);
    await settle();
    expect(shown()).toBe(false);
    expect(renderedOpacity(control)).toBe(0);
    // Faded out, it ignores pointers (a tap reaches the page and wakes it) but stays in the
    // accessibility tree.
    expect(pointerEvents(control)).toBe('none');
    expect(control.closest('[aria-hidden="true"]')).toBeNull();

    document.dispatchEvent(new Event('pointermove'));
    await settle();
    expect(shown()).toBe(true);

    await vi.advanceTimersByTimeAsync(KIOSK_POINTER_IDLE_MS);
    await settle();
    expect(shown()).toBe(false);

    document.dispatchEvent(new Event('touchstart'));
    await settle();
    expect(shown()).toBe(true);
  });

  it('keeps the exit control visible while it has keyboard focus', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await start();
    await TestBed.inject(KioskService).enter();
    await settle();
    const control = exitControl();
    control.blur();

    // Focus as Tab gives it, which :focus-visible tells apart from pointer or scripted focus.
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    control.focus();
    await vi.advanceTimersByTimeAsync(KIOSK_POINTER_IDLE_MS);
    await settle();

    expect(TestBed.inject(KioskService).pointerIdle()).toBe(true);
    expect(renderedOpacity(control)).toBe(1);
    // It comes first in the tab order, ahead of the page.
    expect(control.compareDocumentPosition(main()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    control.blur();
    await settle();

    expect(renderedOpacity(control)).toBe(0);
  });

  it('makes the exit control a tap-friendly circle of at least 44px', async () => {
    await start();
    await TestBed.inject(KioskService).enter();
    await settle();
    await tick();

    // jsdom has no kit stylesheet: the 48px touch size is asserted by class here, and measured in
    // the browser check.
    expect(exitControl().classList).toContain('size-12');
    expect(exitControl().classList).toContain('rounded-full');
  });

  it('keeps the kiosk button in the top bar: a 40px round icon-only target, its tooltip below', async () => {
    await start();
    await tick();

    expect(topbar().contains(kioskButton())).toBe(true);
    expect(kioskButton().classList).toContain('size-10');
    expect(kioskButton().classList).toContain('rounded-full');

    hover(kioskButton());
    await tick();
    expect(tooltip()?.textContent?.trim()).toBe('Kiosk mode');
    expect(tooltip()?.getAttribute('data-side')).toBe('bottom');
  });

  it('puts the page’s aside toggle at the top bar’s right edge, after the kiosk button', async () => {
    await start('/viewer/panel');
    const edge = asideEdge() as HTMLElement;

    expect(topbar().lastElementChild).toBe(edge);
    expect(edge.contains(asideToggle())).toBe(true);
    expect(main().contains(asideToggle())).toBe(false);
    expect(
      kioskButton().compareDocumentPosition(asideToggle()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // After the page's tools and the end slot too, so the tab order matches what is drawn.
    const tool = topbar().querySelector('.page-toolbar .tool') as HTMLElement;
    expect(tool.compareDocumentPosition(edge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The page's own state drives it, as it did inside the toolbar.
    expect(asideToggle().getAttribute('aria-pressed')).toBe('true');
    asideToggle().click();
    await settle();
    expect(asideToggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('sets the toggle apart from the rest of the bar by a divider the bar’s height, flush with its end', async () => {
    await start('/viewer/inspect');

    expect(asideToggle('Inspector')).not.toBeNull();
    // jsdom lays nothing out: read from the cascade. The edge spans the bar's height and reaches
    // back across the bar's end inset, so its divider and its cell sit on the edge.
    const edge = rule('.aside-edge') as string;
    expect(edge).toMatch(/align-self:\s*stretch;/);
    expect(edge).toMatch(/border-inline-start:\s*1px solid var\(--border\);/);
    expect(edge).toMatch(/margin-inline-end:\s*calc\(-1 \* var\(--neat-space-2\)\);/);
    expect(rule(":host([data-narrow='false']) .topbar")).toMatch(
      /padding-inline-end:\s*var\(--neat-space-2\);/,
    );
  });

  it('shows no edge on a page without an aside, and drops it when the page goes', async () => {
    await start('/viewer/panel');
    expect(asideEdge()).not.toBeNull();

    await harness.navigateByUrl('/media');

    expect(asideEdge()).toBeNull();
    expect(asideToggle()).toBeNull();
  });

  it('in kiosk the toggle floats with the page tools, after them, and keeps the page’s state', async () => {
    await start('/viewer/panel');
    await TestBed.inject(KioskService).enter();
    await settle();

    const bar = kioskToolbar() as HTMLElement;
    expect(bar.contains(asideToggle())).toBe(true);
    const tool = bar.querySelector('.tool') as HTMLElement;
    expect(
      tool.compareDocumentPosition(asideToggle()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The exit control stays first in the tab order.
    expect(
      exitControl().compareDocumentPosition(asideToggle()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    asideToggle().click();
    await settle();
    await TestBed.inject(KioskService).exit();
    await settle();

    expect(asideToggle().getAttribute('aria-pressed')).toBe('false');
    expect(asideEdge()?.contains(asideToggle())).toBe(true);
  });

  it('draws a toolbar divider between groups of tools, in the top bar and in the kiosk bar', async () => {
    await start('/viewer/divider');
    const between = (bar: HTMLElement): void => {
      const [first, second] = Array.from(bar.querySelectorAll('.tool'));
      const divider = bar.querySelector('hr[neatPageToolbarDivider]') as HTMLElement;
      expect(divider.parentElement).toBe(first.parentElement);
      expect(
        first.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        divider.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    };
    between(toolbarRegion() as HTMLElement);

    await TestBed.inject(KioskService).enter();
    await settle();
    between(kioskToolbar() as HTMLElement);
  });

  it('in kiosk floats the toggle of a page without other tools in a bar of its own', async () => {
    await start('/viewer/inspect');
    await TestBed.inject(KioskService).enter();
    await settle();

    expect(kioskToolbar()?.contains(asideToggle('Inspector'))).toBe(true);
    expect(kioskToolbar()?.getAttribute('aria-label')).toBe('Page tools');
  });

  it('entering kiosk mode focuses the exit control', async () => {
    await start();
    kioskButton().focus();

    kioskButton().click();
    await settle();
    await tick();

    // The top-bar button that had focus is gone; without this the next Tab would skip the control.
    expect(document.activeElement).toBe(exitControl());
  });

  it('leaving kiosk mode with the exit control returns focus to the top-bar kiosk button', async () => {
    await start();
    kioskButton().click();
    await settle();
    await tick();
    expect(document.activeElement).toBe(exitControl());

    exitControl().click();
    await settle();
    await tick();

    // The exit control that had focus is gone; focus goes back where kiosk mode was entered.
    expect(document.activeElement).toBe(kioskButton());
  });

  it('does not move focus when kiosk mode ends without the exit control', async () => {
    history.replaceState(null, '', '/media?kiosk');
    await start('/media?kiosk');
    await tick();

    await TestBed.inject(KioskService).exit();
    await settle();
    await tick();

    expect(kioskButton()).not.toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('lets a focused exit control fade when focus did not come from the keyboard', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await start();

    kioskButton().click();
    await settle();
    await vi.advanceTimersByTimeAsync(0);
    await settle();
    expect(document.activeElement).toBe(exitControl());

    await vi.advanceTimersByTimeAsync(KIOSK_POINTER_IDLE_MS);
    await settle();

    // Entered with a pointer: the control fades as usual, so a booth display does not keep it up.
    expect(renderedOpacity(exitControl())).toBe(0);

    expect(exitControl().matches(':focus-visible')).toBe(false);

    // A key press makes the focus visible, which un-fades the control (the shell's CSS keys on
    // :focus-visible) before Enter can act on it. jsdom keeps the computed style cached until the
    // DOM changes, so the rendered opacity after a key press is measured in the browser check.
    exitControl().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(exitControl().matches(':focus-visible')).toBe(true);
  });

  it('does not take focus when kiosk mode comes from ?kiosk at start', async () => {
    history.replaceState(null, '', '/media?kiosk');
    await start('/media?kiosk');
    await tick();

    expect(exitControl()).not.toBeNull();
    // Nothing had focus to lose; a focused control would stay visible on a booth display.
    expect(document.activeElement).toBe(document.body);
  });

  it('exit control and top-bar kiosk button both work', async () => {
    await start();
    const kiosk = TestBed.inject(KioskService);
    expect(topbar().contains(kioskButton())).toBe(true);
    // A plain action: the button is gone while kiosk is on, so it has no pressed state to report.
    expect(kioskButton().hasAttribute('aria-pressed')).toBe(false);
    expect(kioskButton().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    kioskButton().click();
    await settle();

    expect(kiosk.active()).toBe(true);
    expect(shell().querySelector('header')).toBeNull();
    expect(exitControl().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    exitControl().click();
    await settle();

    expect(kiosk.active()).toBe(false);
    expect(exitControl()).toBeNull();
    expect(kioskButton().hasAttribute('aria-pressed')).toBe(false);
  });

  it('projects [neatTopbarEnd] content into the top bar', async () => {
    await start();

    expect(topbar().querySelector('.board-status')?.textContent).toBe('Board connected');
  });

  it('lets wide [neatTopbarEnd] content shrink instead of pushing out of the top bar', async () => {
    await start();
    const end = getComputedStyle(topbar().querySelector('.topbar-end') as HTMLElement);

    // jsdom lays nothing out: the flex item's ability to shrink below its content is asserted by
    // style, and the app's e2e suite checks that nothing spills out of the top bar.
    expect(end.flexShrink).toBe('1');
    expect(end.minWidth).toBe('0px');
  });

  it('projects the routed page into the main content area', async () => {
    await start();

    const main = shell().querySelector('main') as HTMLElement;
    expect(main.textContent).toContain('page content');
    expect(main.contains(topbar())).toBe(false);
  });

  it('gives the content area the full remaining space without letting it scroll', async () => {
    await start();

    const host = getComputedStyle(shell());
    const main = getComputedStyle(shell().querySelector('main') as HTMLElement);
    expect(host.height).toBe('100dvh');
    // Capped by a bounded box it is placed in; at the root the cap resolves to nothing.
    expect(host.maxHeight).toBe('100%');
    expect(host.overflow).toBe('hidden');
    expect(main.minHeight).toBe('0px');
    expect(main.minWidth).toBe('0px');
    expect(main.overflow).toBe('hidden');
  });
  it('renders *neatPageToolbar content in the shell top bar and removes it when the page is destroyed', async () => {
    await start('/viewer/grid');

    const region = toolbarRegion() as HTMLElement;
    expect(topbar().contains(region)).toBe(true);
    expect(region.contains(toolbarDemo())).toBe(true);
    // A named group, not role="toolbar", whose arrow-key roving would fight sliders inside it.
    expect(region.getAttribute('role')).toBe('group');
    expect(region.getAttribute('aria-label')).toBe('Page tools');
    expect(main().querySelector('.toolbar-demo')).toBeNull();
    expect(main().querySelector('.viewer-body')).not.toBeNull();
    // Between the page title and the end slot.
    const title = topbar().querySelector('h1') as HTMLElement;
    const end = topbar().querySelector('.topbar-end') as HTMLElement;
    expect(title.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(region.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The content stays the page's: its bindings read and change the page's state.
    (region.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(region.querySelector('.page-number')?.textContent).toBe('Page 2');

    await harness.navigateByUrl('/media');

    expect(toolbarDemo()).toBeNull();
    expect(toolbarRegion()).toBeNull();
  });

  it('hands the top bar to the toolbar of the page navigated to', async () => {
    await start('/viewer/grid');

    await harness.navigateByUrl('/media/library');

    expect(toolbarDemo()).toBeNull();
    expect(toolbarRegion()?.querySelector('.other-toolbar')?.textContent).toBe('Other tools');
  });

  it('shows no toolbar region for a page without a toolbar', async () => {
    await start('/media');

    expect(toolbarRegion()).toBeNull();
  });

  it('puts the toolbar at the right end of the top bar, the free space before it', async () => {
    await start('/viewer/grid');
    const region = getComputedStyle(toolbarRegion() as HTMLElement);
    const end = getComputedStyle(topbar().querySelector('.topbar-end') as HTMLElement);

    // jsdom lays nothing out: the layout is asserted through the properties that produce it, and
    // the visual check of the showcase's Page demo covers the result. The toolbar's auto start
    // margin takes the free space; nothing grows and no other auto margin competes for it, so the
    // end slot, with its content (the board status here), sits right after the toolbar.
    expect(topbar().getAttribute('data-toolbar')).toBe('true');
    expect(region.marginInlineStart).toBe('auto');
    expect(end.marginInlineStart).not.toBe('auto');
    expect(end.flexGrow).toBe('0');
    const status = topbar().querySelector('.topbar-end .board-status') as HTMLElement;
    expect(status.textContent).toBe('Board connected');
    expect(
      (toolbarRegion() as HTMLElement).compareDocumentPosition(status) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('puts the end slot at the right edge of the top bar without a toolbar', async () => {
    await start('/media');
    const end = getComputedStyle(topbar().querySelector('.topbar-end') as HTMLElement);

    // Style assertions again, for the same reason as above: the end slot's auto start margin takes
    // the free space, as the toolbar's does with a toolbar.
    expect(topbar().getAttribute('data-toolbar')).toBe('false');
    expect(end.marginInlineStart).toBe('auto');
    expect(end.flexGrow).toBe('0');
  });

  it('lets a wide toolbar shrink and scroll instead of pushing the end slot out', async () => {
    await start('/viewer/grid');
    const region = getComputedStyle(toolbarRegion() as HTMLElement);

    // jsdom lays nothing out: the region's ability to give up its width first is asserted by
    // style, and the app's e2e suite checks that the top bar's items stay inside it.
    expect(region.minWidth).toBe('0px');
    expect(Number(region.flexShrink)).toBeGreaterThan(1);
    expect(region.flexGrow).toBe('0');
    // jsdom does not expand the `overflow` shorthand into its two axes.
    expect(region.overflow).toBe('auto hidden');
  });

  it('in kiosk the toolbar shows in the floating bar only while the pointer is active', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await start('/viewer/grid');

    await TestBed.inject(KioskService).enter();
    await settle();

    expect(shell().querySelector('header')).toBeNull();
    const bar = kioskToolbar() as HTMLElement;
    expect(bar.contains(toolbarDemo())).toBe(true);
    expect(main().contains(bar)).toBe(false);
    expect(bar.getAttribute('role')).toBe('group');
    expect(bar.getAttribute('aria-label')).toBe('Page tools');
    // The exit control stays first in the tab order, ahead of the toolbar.
    expect(
      exitControl().compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const shown = () => renderedOpacity(bar) === 1;
    expect(shown()).toBe(true);

    await vi.advanceTimersByTimeAsync(KIOSK_POINTER_IDLE_MS);
    await settle();
    expect(shown()).toBe(false);
    expect(renderedOpacity(bar)).toBe(0);
    expect(pointerEvents(bar)).toBe('none');
    expect(bar.closest('[aria-hidden="true"]')).toBeNull();

    document.dispatchEvent(new Event('pointermove'));
    await settle();
    expect(shown()).toBe(true);
    expect(pointerEvents(bar)).toBe('auto');
  });

  it('keeps the floating row inside the content area, so a wide toolbar scrolls', async () => {
    await start('/viewer/grid');
    await TestBed.inject(KioskService).enter();
    await settle();

    // jsdom lays nothing out: the cap is asserted by style and measured in the browser check. A
    // grid item aligned to the end is as wide as its content unless capped; 2rem is its margins.
    // jsdom computes rem at 16px.
    expect(getComputedStyle(kioskChrome()).maxWidth).toBe('calc(100% - 32px)');
    expect(getComputedStyle(kioskChrome()).margin).toBe('16px');
    const bar = getComputedStyle(kioskToolbar() as HTMLElement);
    expect(bar.minWidth).toBe('0px');
    expect(bar.overflow).toBe('auto hidden');
  });

  it('re-creates the toolbar on entering and leaving kiosk mode, with the state the page holds', async () => {
    await start('/viewer/grid');

    await TestBed.inject(KioskService).enter();
    await settle();
    (kioskToolbar()?.querySelector('button') as HTMLButtonElement).click();
    await settle();
    expect(kioskToolbar()?.querySelector('.page-number')?.textContent).toBe('Page 2');

    await TestBed.inject(KioskService).exit();
    await settle();

    // A new view of the page's template in the top bar; what it shows comes from the page.
    expect(kioskToolbar()).toBeNull();
    expect(toolbarRegion()?.querySelector('.page-number')?.textContent).toBe('Page 2');
  });

  it('keeps the exit control and the toolbar visible together while either has keyboard focus', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await start('/viewer/grid');
    await TestBed.inject(KioskService).enter();
    await settle();
    const bar = kioskToolbar() as HTMLElement;
    const tool = bar.querySelector('button') as HTMLButtonElement;
    const exit = exitControl();
    exit.blur();

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    tool.focus();
    await vi.advanceTimersByTimeAsync(KIOSK_POINTER_IDLE_MS);
    await settle();

    expect(TestBed.inject(KioskService).pointerIdle()).toBe(true);
    expect(renderedOpacity(bar)).toBe(1);
    expect(renderedOpacity(exit)).toBe(1);

    tool.blur();
    await settle();
    expect(renderedOpacity(bar)).toBe(0);
    expect(renderedOpacity(exit)).toBe(0);

    // Still keyboard use (the Tab above), so this focus is visible too.
    exit.focus();
    await settle();
    expect(renderedOpacity(exit)).toBe(1);
    expect(renderedOpacity(bar)).toBe(1);
  });

  it('shows no floating toolbar in kiosk for a page without a toolbar', async () => {
    await start('/media');
    await TestBed.inject(KioskService).enter();
    await settle();

    expect(exitControl()).not.toBeNull();
    expect(kioskToolbar()).toBeNull();
  });

  // The viewport a wide screen has is the real `NeatViewport`, which stays wide where jsdom has no
  // `matchMedia`; the narrow screen's is stubbed below.
  const appName = (): HTMLElement => shell().querySelector('.app-name') as HTMLElement;
  const pageTitle = (): HTMLElement | null => shell().querySelector('h1.page-title');

  it('on a wide screen: says so on the host and shows the app name and the page title', async () => {
    localStorage.setItem(RAIL_KEY, 'true');
    await start();

    expect(shell().dataset['narrow']).toBe('false');
    expect(appName().classList).not.toContain('sr-only');
    expect(pageTitle()?.textContent?.trim()).toBe('Media');
  });

  describe('appDetail', () => {
    it('is laid out in one column, small, muted and in tabular digits', () => {
      expect(rule('.app-text')).toMatch(/flex-direction:\s*column/);
      expect(rule('.app-detail')).toMatch(/font-size:\s*0\.6875rem/);
      expect(rule('.app-detail')).toMatch(/color:\s*var\(--muted-foreground\)/);
      expect(rule('.app-detail')).toMatch(/font-variant-numeric:\s*tabular-nums/);
    });

    const brand = (): HTMLElement => shell().querySelector('.sidebar-brand') as HTMLElement;
    const detail = (): HTMLElement | null => shell().querySelector('.app-detail');

    it('renders no extra element without it: the brand is the logo and the name', async () => {
      await start();
      expect(detail()).toBeNull();
      expect(brand().querySelector('.app-text')).toBeNull();
      expect(appName().parentElement).toBe(brand());
    });

    it('shows it below the name, in one column with it', async () => {
      await start();
      APP_DETAIL.set('0.45.0');
      await settle();
      expect(detail()?.textContent?.trim()).toBe('0.45.0');
      const column = brand().querySelector('.app-text') as HTMLElement;
      expect(Array.from(column.children)).toEqual([appName(), detail()]);
      expect(detail()?.classList).not.toContain('sr-only');
    });

    it('drops the element again when the detail goes', async () => {
      await start();
      APP_DETAIL.set('0.45.0');
      await settle();
      APP_DETAIL.set(undefined);
      await settle();
      expect(detail()).toBeNull();
    });
  });

  it('on a wide screen: shows the page title heading', async () => {
    await start();
    expect(pageTitle()?.classList).not.toContain('sr-only');
  });

  it('on a wide screen: keeps the rail expanded after following a link', async () => {
    localStorage.setItem(RAIL_KEY, 'true');
    await start();

    link('Streaming').click();
    await settle();

    expect(triggerName()).toBe('Hide labels');
  });

  it('puts the sidebar beside the top bar and the content, the shell’s full height', async () => {
    await start();

    expect(rule(":host([data-kiosk='false'][data-narrow='false'])")).toMatch(
      /grid-template-areas:\s*'sidebar topbar'\s*'sidebar content';/,
    );
  });

  it('on a wide screen: lays the expanded sidebar beside the content, pushing it', async () => {
    await start();
    railToggle().click();
    await settle();

    expect(sidebar().getAttribute('data-state')).toBe('expanded');
    expect(getComputedStyle(sidebar()).position).not.toBe('absolute');
    // The column is as wide as the sidebar, so the content moves with it.
    expect(getComputedStyle(shell()).gridTemplateColumns).toMatch(/^auto/);
    expect(getComputedStyle(shell()).gridTemplateRows).toMatch(/^var\(--neat-topbar-height\)/);
    // Helm's widths, set on the host for the sidebar's classes to read.
    expect(rule(':host')).toMatch(/--sidebar-width:\s*16rem;/);
    expect(rule(':host')).toMatch(/--sidebar-width-icon:\s*3rem;/);
    expect(rule(':host')).toMatch(/--neat-topbar-height:\s*3rem;/);
  });

  describe('on a narrow screen', () => {
    beforeEach(() => {
      TestBed.overrideProvider(NeatViewport, { useValue: { narrow: signal(true) } });
    });

    /** The open drawer: a modal dialog in the CDK's overlay, outside the shell's element. */
    const drawer = (): HTMLElement | null => document.querySelector('[role="dialog"]');
    const drawerLink = (label: string): HTMLAnchorElement =>
      Array.from(drawer()?.querySelectorAll('a') ?? []).find(
        (a) => a.textContent?.trim() === label,
      ) as HTMLAnchorElement;
    const drawerButton = (name: string): HTMLButtonElement =>
      Array.from(drawer()?.querySelectorAll('button') ?? []).find(
        (element) => (element.ariaLabel ?? element.textContent?.trim()) === name,
      ) as HTMLButtonElement;

    /** Runs pending timers and render hooks: the focus moves after a render, closing waits one. */
    const settleOverlay = async (): Promise<void> => {
      for (let i = 0; i < 3; i++) {
        await tick();
      }
    };

    /** Opens the drawer as a person does, from a press on the trigger, which has the focus. */
    const openDrawer = async (): Promise<void> => {
      // jsdom lays nothing out, and the focus trap only moves the focus to elements it can see.
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
      railToggle().focus();
      railToggle().click();
      await settleOverlay();
    };

    const escape = (): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        keyCode: 27,
        bubbles: true,
        cancelable: true,
      });
      (document.activeElement ?? document.body).dispatchEvent(event);
      return event;
    };

    it('says so on the host', async () => {
      await start();
      expect(shell().dataset['narrow']).toBe('true');
    });

    it('there is no sidebar column', async () => {
      localStorage.setItem(RAIL_KEY, 'true');
      await start();

      expect(shell().querySelector('[data-slot="sidebar"]')).toBeNull();
      expect(shell().querySelector('nav')).toBeNull();
      expect(rule(":host([data-kiosk='false'][data-narrow='true'])")).toMatch(
        /grid-template-areas:\s*'topbar'\s*'content';/,
      );
      expect(getComputedStyle(shell()).gridTemplateColumns).toBe('minmax(0, 1fr)');
      // The drawer is closed, and the app's items are in it alone: nowhere while it is closed.
      expect(drawer()).toBeNull();
      expect(document.querySelectorAll('[neatRailEnd]')).toHaveLength(0);
    });

    it('the top bar shows the trigger and the page title', async () => {
      await start();

      const focusable = Array.from(
        topbar().querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ).filter((element) => element.tabIndex >= 0);
      expect(focusable[0]).toBe(railToggle());
      expect(triggerName()).toBe('Show navigation');
      expect(railToggle().id).toMatch(/^neat-shell-trigger-\d+$/);
      expect(railToggle().getAttribute('aria-haspopup')).toBe('dialog');
      expect(railToggle().querySelector('neat-icon')?.getAttribute('data-icon')).toBe(
        'rail-expand',
      );
      expect(pageTitle()?.textContent?.trim()).toBe('Media');
      expect(pageTitle()?.classList).not.toContain('sr-only');
      // It truncates: a flex item of no basis that grows, cut with an ellipsis.
      expect(rule(":host([data-narrow='true']) .page-title")).toMatch(/flex:\s*1 1 0;/);
      expect(getComputedStyle(pageTitle() as HTMLElement).textOverflow).toBe('ellipsis');
      // No sidebar header on a phone: the app's name is read out in the top bar.
      expect(topbar().contains(appName())).toBe(true);
      expect(appName().textContent).toBe('Neat Insight');
      expect(appName().classList).toContain('sr-only');
    });

    it('starts with the drawer closed whatever was remembered', async () => {
      localStorage.setItem(RAIL_KEY, 'true');
      await start();

      expect(drawer()).toBeNull();
      expect(triggerName()).toBe('Show navigation');
    });

    it('the trigger opens the drawer', async () => {
      await start('/streaming');
      await openDrawer();

      const panel = drawer() as HTMLElement;
      expect(panel.getAttribute('aria-modal')).toBe('true');
      expect(panel.getAttribute('aria-label')).toBe('Neat Insight');
      expect(panel.hasAttribute('aria-labelledby')).toBe(false);
      // The sidebar's three parts, as expanded: the brand, the pages, the app's items and the theme.
      const header = panel.querySelector('[data-sidebar="header"]') as HTMLElement;
      expect(header.querySelector('neat-logo')).not.toBeNull();
      expect(header.querySelector('.app-name')?.textContent).toBe('Neat Insight');
      expect(header.querySelector('.app-name')?.classList).not.toContain('sr-only');
      const nav = panel.querySelector('nav') as HTMLElement;
      expect(nav.getAttribute('aria-label')).toBe('Main');
      expect(Array.from(nav.querySelectorAll('a'), (a) => a.textContent?.trim())).toEqual([
        'Media',
        'Streaming',
        'Viewer',
      ]);
      const footer = panel.querySelector('[data-sidebar="footer"]') as HTMLElement;
      const info = drawerButton('System information');
      expect(footer.contains(info)).toBe(true);
      expect(labelOf(info).classList).not.toContain('sr-only');
      expect(labelOf(drawerButton('Dark theme')).classList).not.toContain('sr-only');
      expect(labelOf(drawerLink('Media')).classList).not.toContain('sr-only');
      // The focus starts on the current page's link.
      expect(document.activeElement).toBe(drawerLink('Streaming'));
    });

    it('the drawer focuses its first link on a route with no page', async () => {
      await start('/board');
      await openDrawer();

      expect(document.activeElement).toBe(drawerLink('Media'));
    });

    it('the drawer focuses the open sub-page on a page with sub-pages', async () => {
      await start('/theme/colors');
      await openDrawer();

      expect(document.activeElement).toBe(drawerLink('Colors'));
    });

    it('Escape and the scrim close the drawer and the focus returns to the trigger', async () => {
      await start();
      const seen: string[] = [];
      const listener = (event: KeyboardEvent): number => seen.push(event.key);
      document.addEventListener('keydown', listener);

      await openDrawer();
      const event = escape();
      await settleOverlay();

      expect(drawer()).toBeNull();
      expect(document.activeElement).toBe(railToggle());
      // A modal stops a handled Escape: no page shortcut behind it sees the key.
      expect(seen).toEqual([]);
      expect(event.defaultPrevented).toBe(true);
      document.removeEventListener('keydown', listener);

      await openDrawer();
      const scrim = document.querySelector('.cdk-overlay-backdrop') as HTMLElement;
      expect(scrim.className).toContain('bg-black/10');
      scrim.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      scrim.click();
      await settleOverlay();

      expect(drawer()).toBeNull();
      expect(document.activeElement).toBe(railToggle());
    });

    it('a followed link closes the drawer, a button does not', async () => {
      await start();
      await openDrawer();

      drawerButton('Dark theme').click();
      await settleOverlay();
      expect(drawer()).not.toBeNull();
      drawerButton('System information').click();
      await settleOverlay();
      expect(drawer()).not.toBeNull();

      drawerLink('Streaming').click();
      await settleOverlay();

      expect(TestBed.inject(Router).url).toBe('/streaming');
      expect(drawer()).toBeNull();
      expect(triggerName()).toBe('Show navigation');
    });

    it('opening the drawer leaves the remembered choice alone', async () => {
      localStorage.setItem(RAIL_KEY, 'false');
      await start();

      await openDrawer();
      expect(drawer()).not.toBeNull();
      expect(localStorage.getItem(RAIL_KEY)).toBe('false');
      escape();
      await settleOverlay();

      expect(drawer()).toBeNull();
      expect(localStorage.getItem(RAIL_KEY)).toBe('false');
    });

    it('widening closes the drawer and the focus goes to the trigger', async () => {
      localStorage.setItem(RAIL_KEY, 'true');
      const narrow = signal(true);
      TestBed.overrideProvider(NeatViewport, { useValue: { narrow } });
      await start();
      await openDrawer();
      drawerLink('Viewer').focus();

      narrow.set(false);
      await settleOverlay();

      expect(drawer()).toBeNull();
      expect(shell().dataset['narrow']).toBe('false');
      expect(document.activeElement).toBe(railToggle());
      expect(triggerName()).toBe('Hide labels');
      expect(sidebar().getAttribute('data-state')).toBe('expanded');
      // The app's items are back in the sidebar's footer, once.
      expect(sidebar().contains(systemInfo())).toBe(true);
      expect(document.querySelectorAll('[neatRailEnd]')).toHaveLength(2);
      expect(localStorage.getItem(RAIL_KEY)).toBe('true');
    });

    it('shows the remembered sidebar again when the screen turns wide with the drawer closed', async () => {
      localStorage.setItem(RAIL_KEY, 'true');
      const narrow = signal(true);
      TestBed.overrideProvider(NeatViewport, { useValue: { narrow } });
      await start();
      expect(triggerName()).toBe('Show navigation');

      narrow.set(false);
      await settle();

      expect(shell().dataset['narrow']).toBe('false');
      expect(triggerName()).toBe('Hide labels');
      expect(sidebar().contains(systemInfo())).toBe(true);
    });

    it('the app’s items live in one place at a time', async () => {
      await start('/with-board');
      const items = (): number => document.querySelectorAll('[neatRailEnd]').length;
      expect(items()).toBe(0);

      await openDrawer();
      const board = drawer()?.querySelector('neat-board-item') as HTMLElement;
      const region = board.querySelector('[role="status"]') as HTMLElement;
      expect(items()).toBe(1);
      expect(region.textContent?.trim()).toBe('');

      for (let round = 0; round < 2; round++) {
        escape();
        await settleOverlay();
        expect(drawer()).toBeNull();
        expect(items()).toBe(0);

        await openDrawer();
        expect(items()).toBe(1);
        // The same element, so the same component: it is moved, never made again.
        expect(drawer()?.querySelector('neat-board-item')).toBe(board);
        // Its label did not change, so its live region says nothing.
        expect(region.textContent?.trim()).toBe('');
      }
    });

    it('the drawer keeps its labels while it slides out', async () => {
      await start('/streaming');
      await openDrawer();
      const panel = drawer() as HTMLElement;

      escape();
      // One render: the drawer is closing (its slide runs now) but still there.
      harness.fixture.detectChanges();

      expect(panel.isConnected).toBe(true);
      expect(panel.querySelector('[data-slot="sheet-content"]')?.getAttribute('data-state')).toBe(
        'closed',
      );
      expect(labelOf(drawerLink('Media')).classList).not.toContain('sr-only');
      expect(labelOf(drawerButton('System information')).classList).not.toContain('sr-only');
      expect(panel.querySelector('.app-name')?.classList).not.toContain('sr-only');
      await settleOverlay();
      expect(drawer()).toBeNull();
    });

    it('the drawer does not slide under reduced motion', async () => {
      await start();
      await openDrawer();

      const panel = drawer()?.querySelector('[data-slot="sheet-content"]') as HTMLElement;
      const scrim = document.querySelector('.cdk-overlay-backdrop') as HTMLElement;
      expect(panel.getAttribute('data-side')).toBe('left');
      expect(panel.getAttribute('data-state')).toBe('open');
      const motion = (element: HTMLElement): string[] =>
        Array.from(element.classList).filter((name) =>
          /(^|:)(animate-|slide-|fade-|transition|duration-|ease-)/.test(name),
        );
      expect(motion(panel)).toContain('motion-safe:data-[side=left]:data-open:slide-in-from-left');
      expect(motion(scrim)).toContain('motion-safe:data-open:fade-in-0');
      for (const name of [...motion(panel), ...motion(scrim)]) {
        expect(name).toMatch(/^motion-safe:/);
      }
    });

    it('the drawer is the mobile sidebar’s width, on the sidebar’s fill', async () => {
      await start();
      await openDrawer();

      const panel = drawer()?.querySelector('[data-slot="sheet-content"]') as HTMLElement;
      expect(panel.classList).toContain('bg-sidebar');
      expect(panel.classList).toContain('w-(--sidebar-width)');
      // Helm's sheet would take three quarters of the screen beside its own width class.
      expect(panel.classList).not.toContain('data-[side=left]:w-3/4');
      expect(rule('.drawer')).toMatch(/--sidebar-width:\s*18rem;/);
    });

    it('shrinks the top bar’s inset and gap to the smallest space, and lets it wrap', async () => {
      await start();
      const declarations = rule(":host([data-narrow='true']) .topbar");
      expect(declarations).toMatch(/gap:\s*0 var\(--neat-space-2\);/);
      expect(declarations).toMatch(/padding-inline-end:\s*var\(--neat-space-2\);/);
      expect(declarations).toMatch(/flex-wrap:\s*wrap;/);
    });

    it('gives the page toolbar a row of its own under the trigger, the title, the end slot and the actions', async () => {
      await start('/viewer/grid');
      const region = getComputedStyle(toolbarRegion() as HTMLElement);

      // jsdom lays nothing out: the row is read from the cascade. A basis of the whole bar that
      // never shrinks wraps the toolbar onto its own line, and `order` puts that line last, after
      // the actions that follow it in the markup.
      expect(region.order).toBe('1');
      expect(region.flexBasis).toBe('100%');
      expect(region.flexShrink).toBe('0');
      expect(region.flexGrow).toBe('0');
      expect(region.overflow).toBe('auto hidden');
      // The wide rules (beside the title, the free space, shrinking first) do not apply.
      expect(region.marginInlineStart).not.toBe('auto');
      expect(region.alignSelf).not.toBe('stretch');
    });

    it('lets the end slot take the first row’s free width, its content at the right', async () => {
      await start('/viewer/grid');
      const end = getComputedStyle(topbar().querySelector('.topbar-end') as HTMLElement);

      // jsdom lays nothing out: a basis of zero that grows is what lets the slot sit beside the
      // trigger, the title and the actions in one row instead of wrapping onto a line of its own.
      expect(topbar().getAttribute('data-toolbar')).toBe('true');
      expect(end.flexGrow).toBe('1');
      expect(end.flexShrink).toBe('1');
      expect(end.flexBasis).toMatch(/^0(px|%)?$/);
      expect(end.minWidth).toBe('0px');
      expect(end.justifyContent).toBe('flex-end');
      // It grows only up to its content, so the page title beside it takes the rest; with no
      // title, its auto margin keeps it at the row's end.
      expect(end.maxWidth).toBe('max-content');
      expect(end.marginInlineStart).toBe('auto');
    });

    it('makes the aside toggle the last item of the first row, after the kiosk button', async () => {
      await start('/viewer/panel');
      const region = getComputedStyle(toolbarRegion() as HTMLElement);
      const edge = asideEdge() as HTMLElement;

      // The toolbar's `order` moves it to a row of its own; the edge keeps the markup's place,
      // last on the first row, after the actions.
      expect(region.order).toBe('1');
      expect(getComputedStyle(edge).order).toBe('0');
      const actions = topbar().querySelector('.topbar-actions') as HTMLElement;
      expect(actions.nextElementSibling).toBe(edge);
      expect(edge.contains(asideToggle())).toBe(true);
      // The trigger, the title, the kiosk button and the toggle share the row; nothing in it grows
      // but the title and the end slot, so they fit at 390 px (measured in the browser check).
      expect(getComputedStyle(edge).flexGrow).toBe('0');
      expect(getComputedStyle(edge).flexShrink).toBe('0');
    });

    it('keeps the bar as high as the wide one when the page has no tools', async () => {
      await start('/media');

      expect(rule(":host([data-narrow='true']) .topbar")).toMatch(
        /min-height:\s*var\(--neat-topbar-height\);/,
      );
      expect(getComputedStyle(topbar()).minHeight).toBe('var(--neat-topbar-height)');
    });

    it('lets the top bar’s row be as high as its content, where the wide bar has one fixed height', async () => {
      await start('/viewer/grid');

      // The grid template cannot resolve var() in jsdom, so the row's size is read as written.
      expect(rule(":host([data-kiosk='false'][data-narrow='true'])")).toMatch(
        /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/,
      );
      expect(getComputedStyle(shell()).gridTemplateRows).toMatch(/^auto/);
    });
  });

  describe('sub-pages in the rail', () => {
    const children = (): HTMLAnchorElement[] =>
      Array.from(nav().querySelectorAll<HTMLAnchorElement>('ul ul a'));
    const childLabels = (): (string | undefined)[] => children().map((a) => a.textContent?.trim());
    const title = (): string | undefined =>
      topbar().querySelector('h1')?.firstChild?.textContent?.trim();
    const context = (): string | undefined =>
      topbar().querySelector('.page-context')?.textContent?.trim();

    beforeEach(() => localStorage.setItem(RAIL_KEY, 'true'));

    it('unfolds the active page’s sub-pages under it and marks the open one', async () => {
      await start('/theme/colors');

      expect(childLabels()).toEqual(['Tokens', 'Colors', 'Icons']);
      expect(link('Theme').parentElement?.contains(link('Colors'))).toBe(true);
      expect(
        link('Theme').compareDocumentPosition(link('Tokens')) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(link('Colors').getAttribute('aria-current')).toBe('page');
      expect(link('Tokens').hasAttribute('aria-current')).toBe(false);
      expect(link('Theme').hasAttribute('aria-current')).toBe(false);
      expect(link('Layout').hasAttribute('aria-current')).toBe(false);
      expect(links().map((a) => a.getAttribute('href'))).toContain('/theme/icons');
    });

    it('sub-pages show under the active page as helm’s menu-sub', async () => {
      await start('/theme/colors');

      const list = link('Theme').parentElement?.querySelector('ul') as HTMLElement;
      expect(list.getAttribute('data-sidebar')).toBe('menu-sub');
      expect(list.contains(link('Colors'))).toBe(true);
      expect(link('Colors').getAttribute('data-sidebar')).toBe('menu-sub-button');
      expect(link('Colors').getAttribute('aria-current')).toBe('page');
      // The page's row: weight 500 without the fill, and no aria-current.
      expect(link('Theme').hasAttribute('aria-current')).toBe(false);
      expect(link('Theme').hasAttribute('data-branch')).toBe(true);

      railToggle().click();
      await settle();

      expect(nav().querySelector('[data-sidebar="menu-sub"]')).toBeNull();
    });

    it('keeps a sub-page open on the routes nested under it', async () => {
      await start('/components/data/select-list');

      expect(link('Data').getAttribute('aria-current')).toBe('page');
      expect(link('Components').hasAttribute('aria-current')).toBe(false);
    });

    it('lets the page’s own item stay current where no sub-page matches', async () => {
      await start('/theme');

      expect(childLabels()).toEqual(['Tokens', 'Colors', 'Icons']);
      expect(link('Theme').getAttribute('aria-current')).toBe('page');
    });

    it('matches a sub-page with its page’s path exactly', async () => {
      await start('/stats');
      expect(link('Live').getAttribute('aria-current')).toBe('page');
      expect(link('Runs').hasAttribute('aria-current')).toBe(false);

      await harness.navigateByUrl('/stats/runs');
      expect(link('Runs').getAttribute('aria-current')).toBe('page');
      expect(link('Live').hasAttribute('aria-current')).toBe(false);

      await harness.navigateByUrl('/stats/runs/compare?runs=1,2');
      expect(link('Runs').getAttribute('aria-current')).toBe('page');
      expect(link('Live').hasAttribute('aria-current')).toBe(false);
    });

    it('shows no sub-pages in the collapsed rail, and shows them once it is expanded', async () => {
      localStorage.setItem(RAIL_KEY, 'false');
      await start('/theme/colors');

      expect(children()).toEqual([]);

      railToggle().click();
      await settle();

      expect(childLabels()).toEqual(['Tokens', 'Colors', 'Icons']);
      expect(link('Colors').getAttribute('aria-current')).toBe('page');
    });

    it('shows them in the drawer of a narrow screen once it is opened', async () => {
      TestBed.overrideProvider(NeatViewport, { useValue: { narrow: signal(true) } });
      localStorage.setItem(RAIL_KEY, 'false');
      await start('/theme/colors');
      expect(document.querySelector('nav')).toBeNull();

      railToggle().click();
      for (let i = 0; i < 3; i++) await tick();

      const drawerNav = document.querySelector('[role="dialog"] nav') as HTMLElement;
      const subPages = Array.from(drawerNav.querySelectorAll<HTMLAnchorElement>('ul ul a'));
      expect(subPages.map((a) => a.textContent?.trim())).toEqual(['Tokens', 'Colors', 'Icons']);
      expect(subPages[1].getAttribute('aria-current')).toBe('page');
      expect(localStorage.getItem(RAIL_KEY)).toBe('false');
    });

    it('folds the old sub-pages and unfolds the new ones, the pressed link keeping focus', async () => {
      await start('/theme/colors');
      const pressed = link('Layout');
      pressed.focus();

      pressed.click();
      await settle();
      await harness.fixture.whenStable();

      expect(childLabels()).toEqual(['Grid']);
      expect(link('Layout')).toBe(pressed);
      expect(document.activeElement).toBe(pressed);
    });

    it('titles the page with the open sub-page and puts the page beside it', async () => {
      await start('/theme/colors');

      expect(title()).toBe('Colors');
      expect(context()).toBe('Theme');
    });

    it('titles a deeper route with its own title and the trail to its sub-page', async () => {
      await start('/stats/runs/compare');

      expect(title()).toBe('Compare');
      expect(context()).toBe('Stats › Runs');

      await harness.navigateByUrl('/components/data/select-list');

      expect(title()).toBe('Select list');
      expect(context()).toBe('Components › Data');
    });

    it('falls back to the sub-page’s label where a deeper route has no title', async () => {
      await start('/components/data/untitled');

      expect(title()).toBe('Data');
      expect(context()).toBe('Components');
    });

    it('ignores the titles of the routes above the sub-page, which name the page', async () => {
      await start('/reports/runs/7');

      expect(title()).toBe('Runs');
      expect(context()).toBe('Reports');

      await harness.navigateByUrl('/reports/runs');
      expect(title()).toBe('Runs');

      await harness.navigateByUrl('/reports/runs/7/log');
      expect(title()).toBe('Run log');
      expect(context()).toBe('Reports › Runs');
    });

    it('draws no sub-page list for an empty children array', async () => {
      await start('/empty');

      expect(nav().querySelector('ul ul')).toBeNull();
      expect(link('Empty').getAttribute('aria-current')).toBe('page');
    });

    it('opens the sub-page with the longer path where one path is a prefix of another', async () => {
      await start('/archive/2026');
      expect(link('Year').getAttribute('aria-current')).toBe('page');
      expect(link('January').hasAttribute('aria-current')).toBe(false);

      await harness.navigateByUrl('/archive/2026/jan?x=1#top');
      expect(link('January').getAttribute('aria-current')).toBe('page');
      expect(link('Year').hasAttribute('aria-current')).toBe(false);

      await harness.navigateByUrl('/archive/2026/jan/week');
      expect(link('January').getAttribute('aria-current')).toBe('page');
      expect(link('Year').hasAttribute('aria-current')).toBe(false);
    });

    it('draws a page’s icon by the kit’s name, or a Lucide glyph the app gives', async () => {
      await start('/home');

      expect(link('Home').querySelector('neat-icon')?.getAttribute('data-icon')).toBe('home');
      const glyph = link('Empty').querySelector('neat-icon svg') as SVGElement;
      expect(Array.from(glyph.children, (child) => child.tagName.toLowerCase())).toEqual(
        Inbox.map(([tag]) => tag),
      );
      expect(glyph.getAttribute('aria-hidden')).toBe('true');
    });

    it('keeps the page’s own label as the title of a page without sub-pages', async () => {
      await start('/home');

      expect(title()).toBe('Home');
      expect(context()).toBeUndefined();
    });
  });

  describe('sub-page menu of the collapsed rail', () => {
    const pageButton = (label: string): HTMLAnchorElement => link(label);
    const menu = (): HTMLElement | null => document.querySelector('neat-rail-menu-panel');
    const menuLinks = (): HTMLAnchorElement[] => Array.from(menu()?.querySelectorAll('a') ?? []);
    const url = (): string => TestBed.inject(Router).url;
    const keydown = (target: Element, key: string, shiftKey = false): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', {
        key,
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      return event;
    };
    const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
    /** Presses the item: a click, which a tap and Enter on a link all come to. */
    const press = async (item: HTMLElement): Promise<void> => {
      item.click();
      await settle();
    };

    /** Keyboard focus on the item: focus-visible, which jsdom cannot compute, is taken as given. */
    const focusByKeyboard = (item: HTMLElement): void => {
      const matches = item.matches.bind(item);
      vi.spyOn(item, 'matches').mockImplementation((selector) =>
        selector === ':focus-visible' ? document.activeElement === item : matches(selector),
      );
      item.focus();
    };
    const leave = (item: HTMLElement): void => {
      item.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    };

    it('keeps a page with sub-pages a link to the page, with a menu that is closed to begin with', async () => {
      await start('/theme/colors');

      const item = pageButton('Theme');
      expect(item.getAttribute('href')).toBe('/theme');
      expect(item.hasAttribute('aria-haspopup')).toBe(false);
      expect(item.hasAttribute('aria-expanded')).toBe(false);
      expect(item.hasAttribute('aria-controls')).toBe(false);
      expect(item.getAttribute('aria-current')).toBe('page');
      expect(menu()).toBeNull();
    });

    it('navigates to the page’s path on a press and leaves no menu open', async () => {
      await start('/home');

      await press(pageButton('Theme'));

      expect(url()).toBe('/theme');
      expect(menu()).toBeNull();
    });

    it('shows the menu on mouse hover: the page’s name, then its sub-pages, tied to the item', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');

      hover(item);
      await settle();

      expect(menu()?.getAttribute('role')).toBe('group');
      const heading = menu()?.querySelector('h2') as HTMLElement;
      expect(heading.textContent?.trim()).toBe('Theme');
      expect(menu()?.getAttribute('aria-labelledby')).toBe(heading.id);
      expect(item.getAttribute('aria-controls')).toBe(menu()?.id);
      expect(menuLinks().map((a) => a.textContent?.trim())).toEqual(['Tokens', 'Colors', 'Icons']);
      expect(menuLinks().map((a) => a.getAttribute('href'))).toEqual([
        '/theme/tokens',
        '/theme/colors',
        '/theme/icons',
      ]);
      expect(menuLinks().map((a) => a.getAttribute('aria-current'))).toEqual([null, 'page', null]);
      expect(document.activeElement).not.toBe(menuLinks()[0]);
      expect(tooltip()).toBeNull();
      expect(url()).toBe('/theme/colors');
    });

    it('opens beside the sidebar’s edge, level with the item', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');
      // jsdom lays nothing out: a sidebar 48px wide, its item inset from its edge.
      sidebar().getBoundingClientRect = () => new DOMRect(0, 0, 48, 768);
      vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
      vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
      item.getBoundingClientRect = () => new DOMRect(8, 100, 32, 32);

      item.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      await settle();

      // Level with the item's top, from its end (40) moved on to the sidebar's edge (48) and the
      // gap (4): 12px past the item.
      const pane = menu()?.closest('.cdk-overlay-pane') as HTMLElement;
      const box = pane.parentElement as HTMLElement;
      expect(box.style.top).toBe('100px');
      expect(box.style.left).toBe('40px');
      expect(pane.style.transform).toBe('translateX(12px)');
    });

    it('closes after the pointer leaves the item', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');
      hover(item);
      await settle();

      leave(item);
      await pause(50);
      expect(menu()).not.toBeNull();
      await pause(200);
      expect(menu()).toBeNull();
      expect(item.hasAttribute('aria-controls')).toBe(false);
    });

    it('leaves only the second menu open when the pointer crosses two items within the delay', async () => {
      await start('/home');
      const first = pageButton('Theme');
      const second = pageButton('Layout');

      hover(first);
      await settle();
      leave(first);
      hover(second);
      await settle();

      expect(document.querySelectorAll('neat-rail-menu-panel')).toHaveLength(1);
      expect(menu()?.querySelector('h2')?.textContent?.trim()).toBe('Layout');
      expect(first.hasAttribute('aria-controls')).toBe(false);
      expect(second.getAttribute('aria-controls')).toBe(menu()?.id);
      await pause(250);
      expect(document.querySelectorAll('neat-rail-menu-panel')).toHaveLength(1);
    });

    it('leaves only the second menu open when keyboard focus moves from one item to the next', async () => {
      await start('/home');
      const first = pageButton('Theme');
      const second = pageButton('Layout');
      focusByKeyboard(first);
      await settle();

      focusByKeyboard(second);
      await settle();

      expect(document.querySelectorAll('neat-rail-menu-panel')).toHaveLength(1);
      expect(menu()?.querySelector('h2')?.textContent?.trim()).toBe('Layout');
    });

    it('keeps the first menu when the pointer leaves its item for its panel within the delay', async () => {
      await start('/home');
      const item = pageButton('Theme');
      hover(item);
      await settle();

      leave(item);
      await pause(50);
      (menu()?.parentElement as HTMLElement).dispatchEvent(
        new PointerEvent('pointerenter', { pointerType: 'mouse' }),
      );
      await pause(250);

      expect(menu()?.querySelector('h2')?.textContent?.trim()).toBe('Theme');
    });

    it('stays open while the pointer is on the menu, and closes after it leaves it', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');
      hover(item);
      await settle();

      leave(item);
      const panel = menu()?.parentElement as HTMLElement;
      panel.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      await pause(250);
      expect(menu()).not.toBeNull();

      panel.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      await pause(250);
      expect(menu()).toBeNull();
    });

    it('puts the menu away on a press while it is open, and navigates', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');
      hover(item);
      await settle();
      expect(menu()).not.toBeNull();

      await press(item);

      expect(url()).toBe('/theme');
      expect(menu()).toBeNull();
      leave(item);
      await pause(250);
      expect(menu()).toBeNull();
    });

    it('does not open on a touch pointer entering: a tap just navigates', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');

      item.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
      await settle();
      expect(menu()).toBeNull();

      await press(item);
      expect(menu()).toBeNull();
      expect(url()).toBe('/theme');
    });

    it('shows the menu on keyboard focus, but not on the focus a press gives', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');

      item.focus();
      await settle();
      expect(menu()).toBeNull();

      item.blur();
      focusByKeyboard(item);
      await settle();
      expect(menu()).not.toBeNull();
      expect(item.getAttribute('aria-controls')).toBe(menu()?.id);
    });

    it('takes Tab from the focused item to the first link', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');
      focusByKeyboard(item);
      await settle();

      const event = keydown(item, 'Tab');

      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(menuLinks()[0]);
    });

    it('keeps a menu that keyboard focus shows when the pointer passes over it and leaves', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');
      focusByKeyboard(item);
      hover(item);
      await settle();

      leave(item);
      await pause(250);

      expect(menu()).not.toBeNull();
    });

    it('closes on Escape and leaves the focus on the item', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');
      focusByKeyboard(item);
      await settle();

      const event = keydown(item, 'Escape');
      await settle();

      expect(event.defaultPrevented).toBe(true);
      expect(menu()).toBeNull();
      expect(document.activeElement).toBe(item);
    });

    it('closes on Escape from a link and gives the focus back to the item', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');
      focusByKeyboard(item);
      keydown(item, 'Tab');

      keydown(document.activeElement as Element, 'Escape');
      await settle();

      expect(menu()).toBeNull();
      expect(document.activeElement).toBe(item);
    });

    it('leaves Tab alone on the item while the menu is closed', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');
      item.focus();

      const event = keydown(item, 'Tab');

      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(item);
    });

    it('leaves the focus where it is when Escape closes a menu focus is not in', async () => {
      await start('/theme/colors');
      hover(pageButton('Theme'));
      await settle();
      const field = document.createElement('input');
      document.body.append(field);
      field.focus();
      // Focus landing outside closes a menu, so the field takes it before the hover opens one.
      hover(pageButton('Theme'));

      keydown(field, 'Escape');
      await settle();
      field.remove();

      expect(menu()).toBeNull();
      expect(document.activeElement).not.toBe(pageButton('Theme'));
    });

    it('closes when focus lands outside the menu and its item', async () => {
      await start('/theme/colors');
      focusByKeyboard(pageButton('Theme'));
      await settle();
      expect(menu()).not.toBeNull();

      button('Dark theme').focus();
      await settle();

      expect(menu()).toBeNull();
    });

    it('marks the item current while the route is elsewhere on its page, and not on another page', async () => {
      await start('/home');

      expect(pageButton('Theme').hasAttribute('aria-current')).toBe(false);

      await harness.navigateByUrl('/theme/icons');
      expect(pageButton('Theme').getAttribute('aria-current')).toBe('page');
    });

    it('takes Tab from the item to the first link, also where hover opened the menu', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');
      hover(item);
      await settle();
      item.focus();

      const event = keydown(item, 'Tab');

      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(menuLinks()[0]);
    });

    it('leaves the menu from its last link with Tab, on to the next item, and from its first with Shift+Tab to its own', async () => {
      await start('/theme/colors');
      const item = pageButton('Theme');
      focusByKeyboard(item);
      keydown(item, 'Tab');

      menuLinks()[2].focus();
      const onward = keydown(menuLinks()[2], 'Tab');
      expect(onward.defaultPrevented).toBe(true);
      expect(menu()).toBeNull();
      expect(document.activeElement).toBe(link('Layout'));

      await settle();
      item.blur();
      focusByKeyboard(item);
      keydown(item, 'Tab');
      const back = keydown(menuLinks()[0], 'Tab', true);
      expect(back.defaultPrevented).toBe(true);
      expect(menu()).toBeNull();
      expect(document.activeElement).toBe(item);
    });

    it('closes on a press outside, which keeps the focus it gave', async () => {
      await start('/theme/colors');
      hover(pageButton('Theme'));
      await settle();
      const other = button('Dark theme');

      other.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      other.focus();
      other.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      expect(menu()).toBeNull();
      expect(document.activeElement).toBe(other);
    });

    it('navigates and closes when a link is chosen', async () => {
      await start('/theme/colors');
      hover(pageButton('Theme'));
      await settle();

      menuLinks()[2].click();
      await settle();

      expect(url()).toBe('/theme/icons');
      expect(menu()).toBeNull();
      expect(pageButton('Theme').getAttribute('aria-current')).toBe('page');
    });

    it('leaves a page without sub-pages as it was: a link with a tooltip that navigates', async () => {
      await start('/theme/colors');
      const home = link('Home');

      expect(home.hasAttribute('aria-haspopup')).toBe(false);
      hover(home);
      await tick();
      expect(tooltip()?.textContent?.trim()).toBe('Home');
      expect(menu()).toBeNull();

      home.click();
      await settle();
      expect(url()).toBe('/home');
    });

    it('shows no tooltip on the item that shows the menu', async () => {
      await start('/theme/colors');

      hover(pageButton('Theme'));
      await tick();

      expect(tooltip()).toBeNull();
    });

    it('opens no menu while the rail is expanded', async () => {
      localStorage.setItem(RAIL_KEY, 'true');
      await start('/home');

      expect(link('Theme').getAttribute('href')).toBe('/theme');
      expect(link('Theme').hasAttribute('aria-haspopup')).toBe(false);
      hover(link('Theme'));
      await settle();
      expect(menu()).toBeNull();
    });

    it('puts the menu away when the rail expands under it', async () => {
      await start('/theme/colors');
      hover(pageButton('Theme'));
      await settle();

      railToggle().click();
      await settle();

      expect(menu()).toBeNull();
    });
  });
});
