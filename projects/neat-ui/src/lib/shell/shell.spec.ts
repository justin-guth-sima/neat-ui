import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterOutlet, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NeatIcon } from '../icon/icon';
import { KIOSK_POINTER_IDLE_MS, KioskService } from '../kiosk/kiosk.service';
import { NeatAsideToggle } from '../page/aside';
import { ThemeService } from '../theme/theme.service';
import { NeatViewport } from '../page/viewport';
import { NeatNavItem } from './nav-item';
import { NeatPageToolbar } from './page-toolbar';
import { NeatRailDivider, NeatRailItem } from './rail-item';
import { NeatShell } from './shell';
import shellStyles from './shell.css' with { loader: 'text' };

const RAIL_KEY = 'neat-ui:rail-expanded';

const NAV_ITEMS: NeatNavItem[] = [
  { label: 'Media', icon: 'media', path: '/media' },
  { label: 'Streaming', icon: 'streaming', path: '/streaming' },
  { label: 'Viewer', icon: 'viewer', path: '/viewer' },
];

@Component({ template: 'page content' })
class StubPage {}

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

/** A page with tools and a side panel, whose toggle it declares beside its toolbar. */
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

/** A page with a side panel and no other tools. */
@Component({
  imports: [NeatAsideToggle],
  template: `<neat-aside-toggle label="Inspector" />`,
})
class AsideOnlyPage {}

@Component({
  imports: [NeatIcon, NeatRailDivider, NeatRailItem, NeatShell, RouterOutlet],
  template: `
    <neat-shell appName="Neat Insight" [navItems]="navItems">
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
}

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
      { path: 'viewer/panel', component: AsidePage },
      { path: 'viewer/inspect', component: AsideOnlyPage },
      // Routes that no nav item matches, one with a title, and one a nav item matches with its own.
      { path: 'board', title: 'Board', component: StubPage },
      { path: 'untitled', component: StubPage },
      { path: 'media/titled', title: 'Library', component: StubPage },
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
  /** The rail's own control, after its bottom group: named for what a click does. */
  const railToggle = (): HTMLButtonElement =>
    shell().querySelector('.rail > button[neatRailItem]') as HTMLButtonElement;
  /** The kit's theme item, the last of the rail's bottom group. */
  const themeToggle = (): HTMLButtonElement =>
    shell().querySelector('.rail-end > button[neatRailItem]:last-child') as HTMLButtonElement;
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
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
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

  it('shows the logo and appName text in the top bar', async () => {
    await start();

    const logo = topbar().querySelector('svg[role="img"]');
    expect(logo?.getAttribute('aria-label')).toBe('SiMa.ai');
    expect(topbar().textContent).toContain('Neat Insight');
  });

  it('expands the rail to show labels and persists that under neat-ui:rail-expanded', async () => {
    await start();
    expect(railToggle().textContent?.trim()).toBe('Show labels');
    expect(labelOf(link('Media')).classList).toContain('sr-only');

    railToggle().click();
    await settle();

    expect(railToggle().textContent?.trim()).toBe('Collapse');
    expect(labelOf(link('Media')).classList).not.toContain('sr-only');
    expect(localStorage.getItem(RAIL_KEY)).toBe('true');

    // Labels are visible now, so the links show no tooltip.
    hover(link('Media'));
    await tick();
    expect(tooltip()).toBeNull();

    railToggle().click();
    await settle();

    expect(railToggle().textContent?.trim()).toBe('Show labels');
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

    expect(railToggle().textContent?.trim()).toBe('Collapse');
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

    expect(railToggle().textContent?.trim()).toBe('Show labels');

    railToggle().click();
    await settle();

    expect(railToggle().textContent?.trim()).toBe('Collapse');
  });

  it('switches the colour scheme from the rail’s last end item, named for what a click does', async () => {
    await start();
    const theme = TestBed.inject(ThemeService);
    expect(railBox().contains(themeToggle())).toBe(true);
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

  it('names the rail’s control for what a click does: "Show labels", then "Collapse"', async () => {
    await start();
    expect(railToggle().textContent?.trim()).toBe('Show labels');
    hover(railToggle());
    await tick();
    expect(tooltip()?.textContent?.trim()).toBe('Show labels');

    railToggle().click();
    await settle();

    // Expanded, the label shows, as in the mockup's bottom row.
    expect(railToggle().textContent?.trim()).toBe('Collapse');
    expect(labelOf(railToggle()).classList).not.toContain('sr-only');
  });

  it('gives the theme item and the rail’s control no pressed state: they are actions', async () => {
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

  it('projects [neatRailEnd] at the bottom of the rail, below a divider: the app’s items, the theme, then the collapse control', async () => {
    await start();
    const end = shell().querySelector('.rail-end') as HTMLElement;

    expect(railBox().contains(end)).toBe(true);
    expect(nav().contains(end)).toBe(false);
    expect(end.contains(systemInfo())).toBe(true);
    expect([...end.children].at(-1)).toBe(themeToggle());
    expect(
      end.compareDocumentPosition(railToggle()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(end.contains(railToggle())).toBe(false);
    // The line above the group is the kit's rail divider, the element an app draws between its
    // own items, so the pattern exists once.
    const children = [...end.children];
    expect(children[0].matches('hr[neatRailDivider]')).toBe(true);
    expect(children.map((child) => child.tagName)).toEqual(['HR', 'BUTTON', 'HR', 'BUTTON']);
    expect(children[2].classList).toContain('app-divider');
    expect(rule('.rail-end')).not.toMatch(/border|padding/);
  });

  it('reaches the rail’s bottom items in order after the pages, from the keyboard', async () => {
    await start();
    const focusable = Array.from(
      railBox().querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ).filter((element) => element.tabIndex >= 0);

    expect(focusable.map((element) => element.textContent?.trim() || element.ariaLabel)).toEqual([
      'Media',
      'Streaming',
      'Viewer',
      'System information',
      'Dark theme',
      'Show labels',
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
    expect(shell().querySelector('header')).toBeNull();
    expect(main().textContent).toContain('page content');
    // The content area takes the whole viewport.
    expect(getComputedStyle(shell()).gridTemplateAreas).toBe('"content"');

    await kiosk.exit();
    await settle();

    expect(nav().getAttribute('aria-label')).toBe('Main');
    expect(topbar().textContent).toContain('Neat Insight');
    expect(getComputedStyle(shell()).gridTemplateAreas).toBe('"rail topbar" "rail content"');
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

  it('puts the page’s side-panel toggle at the top bar’s right edge, after the kiosk button', async () => {
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
      /padding-inline:\s*1rem var\(--neat-space-2\);/,
    );
  });

  it('shows no edge on a page without a side panel, and drops it when the page goes', async () => {
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
  const railBox = (): HTMLElement => shell().querySelector('.rail') as HTMLElement;
  const appName = (): HTMLElement => shell().querySelector('.app-name') as HTMLElement;
  const pageTitle = (): HTMLElement | null => shell().querySelector('h1.page-title');

  it('on a wide screen: says so on the host and shows the app name and the page title', async () => {
    await start();

    expect(shell().dataset['narrow']).toBe('false');
    expect(appName().classList).not.toContain('sr-only');
    expect(pageTitle()?.textContent?.trim()).toBe('Media');
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

    expect(railToggle().textContent?.trim()).toBe('Collapse');
  });

  it('on a wide screen: lays the expanded rail beside the content', async () => {
    await start();
    railToggle().click();
    await settle();

    expect(railBox().dataset['floating']).toBe('false');
    expect(getComputedStyle(railBox()).position).not.toBe('absolute');
    expect(getComputedStyle(shell()).gridTemplateColumns).toMatch(/^auto/);
    expect(getComputedStyle(shell()).gridTemplateRows).toMatch(/^var\(--neat-topbar-height\)/);
  });

  describe('on a narrow screen', () => {
    beforeEach(() => {
      TestBed.overrideProvider(NeatViewport, { useValue: { narrow: signal(true) } });
    });

    it('says so on the host', async () => {
      await start();
      expect(shell().dataset['narrow']).toBe('true');
    });

    it('keeps the app name visually hidden and still in the accessible tree', async () => {
      await start();
      expect(appName().textContent).toBe('Neat Insight');
      expect(appName().classList).toContain('sr-only');
    });

    it('keeps the page title as a visually hidden heading', async () => {
      await start();
      expect(pageTitle()?.textContent?.trim()).toBe('Media');
      expect(pageTitle()?.classList).toContain('sr-only');
    });

    it('floats the expanded rail over the content', async () => {
      await start();
      // jsdom lays nothing out and resolves no var() in a grid template, so the geometry is read
      // from the cascade: the rail column is the collapsed rail's width whether or not the rail is
      // open (the content's left edge stays), and an open rail is absolutely positioned over it.
      expect(rule(":host([data-kiosk='false'][data-narrow='true'])")).toMatch(
        /grid-template-columns:\s*var\(--neat-rail-width\)\s+minmax\(0,\s*1fr\);/,
      );
      expect(getComputedStyle(shell()).gridTemplateColumns).toMatch(/^var\(--neat-rail-width\)/);
      expect(getComputedStyle(shell()).position).toBe('relative');
      expect(getComputedStyle(railBox()).position).not.toBe('absolute');

      railToggle().click();
      await settle();

      expect(railBox().dataset['expanded']).toBe('true');
      expect(getComputedStyle(shell()).gridTemplateColumns).toMatch(/^var\(--neat-rail-width\)/);
      expect(getComputedStyle(railBox()).position).toBe('absolute');
      expect(rule(".rail[data-floating='true']")).toMatch(/inset-block:\s*0;/);
      expect(rule(".rail[data-floating='true']")).toMatch(/inset-inline-start:\s*0;/);
      expect(rule(".rail[data-floating='true']")).toMatch(/z-index:\s*1;/);
      // Wider than the column it floats over.
      expect(rule(".rail[data-expanded='true']")).toMatch(
        /width:\s*var\(--neat-rail-width-expanded\);/,
      );
      // Its fill is the rail's own (the sidebar), and the shadow is the kit's raised-surface one,
      // as its utility.
      expect(rule('.rail')).toMatch(/background:\s*var\(--sidebar\);/);
      expect(railBox().className).toContain('shadow-md');
    });

    it('starts with the rail collapsed whatever was remembered', async () => {
      localStorage.setItem(RAIL_KEY, 'true');
      await start();

      expect(railToggle().textContent?.trim()).toBe('Show labels');
      expect(railBox().dataset['floating']).toBe('false');
    });

    it('opens and closes the rail without writing the remembered choice', async () => {
      localStorage.setItem(RAIL_KEY, 'true');
      await start();

      railToggle().click();
      await settle();
      expect(railToggle().textContent?.trim()).toBe('Collapse');
      railToggle().click();
      await settle();

      expect(localStorage.getItem(RAIL_KEY)).toBe('true');
    });

    it('collapses the floating rail when a link is followed', async () => {
      await start();
      railToggle().click();
      await settle();
      expect(railBox().dataset['floating']).toBe('true');

      link('Streaming').click();
      await settle();

      expect(railToggle().textContent?.trim()).toBe('Show labels');
      expect(railBox().dataset['floating']).toBe('false');
    });

    it('has no width transition, so the rail floats in and out at once', async () => {
      await start();
      // A transition only on the wide screen's rail, stated once in the stylesheet.
      expect(shellStyles).toMatch(
        /prefers-reduced-motion: no-preference\)\s*\{\s*:host\(\[data-narrow='false'\]\) \.rail\s*\{[^}]*transition:/,
      );
      expect(shellStyles).not.toMatch(/(^|\n)\s*\.rail\s*\{[^}]*transition:/);
    });

    it('shows the remembered rail again when the screen turns wide', async () => {
      localStorage.setItem(RAIL_KEY, 'true');
      const narrow = signal(true);
      TestBed.overrideProvider(NeatViewport, { useValue: { narrow } });
      await start();
      expect(railToggle().textContent?.trim()).toBe('Show labels');

      narrow.set(false);
      await settle();

      expect(shell().dataset['narrow']).toBe('false');
      expect(railToggle().textContent?.trim()).toBe('Collapse');
    });

    it('shrinks the top bar’s inset and gap to the smallest space, and lets it wrap', async () => {
      await start();
      const declarations = rule(":host([data-narrow='true']) .topbar");
      expect(declarations).toMatch(/gap:\s*0 var\(--neat-space-2\);/);
      expect(declarations).toMatch(/padding-inline:\s*var\(--neat-space-2\);/);
      expect(declarations).toMatch(/flex-wrap:\s*wrap;/);
    });

    it('gives the page toolbar a row of its own under the logo, the end slot and the actions', async () => {
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
      // logo and the actions in one row instead of wrapping onto a line of its own.
      expect(topbar().getAttribute('data-toolbar')).toBe('true');
      expect(end.flexGrow).toBe('1');
      expect(end.flexShrink).toBe('1');
      expect(end.flexBasis).toMatch(/^0(px|%)?$/);
      expect(end.minWidth).toBe('0px');
      expect(end.justifyContent).toBe('flex-end');
    });

    it('makes the side-panel toggle the last item of the first row, after the kiosk button', async () => {
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
      // The logo, the kiosk button and the toggle share the row; nothing in it grows but the end
      // slot, so they fit at 390 px (measured in the browser check).
      expect(getComputedStyle(edge).flexGrow).toBe('0');
      expect(getComputedStyle(edge).flexShrink).toBe('0');
    });

    it('shows the rail’s bottom group in the floating rail, the app’s items still reachable', async () => {
      await start();
      railToggle().click();
      await settle();

      expect(railBox().dataset['floating']).toBe('true');
      expect(railBox().contains(systemInfo())).toBe(true);
      expect(labelOf(systemInfo()).classList).not.toContain('sr-only');
      expect(labelOf(themeToggle()).classList).not.toContain('sr-only');
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
});
