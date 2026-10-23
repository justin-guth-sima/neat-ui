import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterOutlet, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { KIOSK_POINTER_IDLE_MS, KioskService } from '../kiosk/kiosk.service';
import { ThemeService } from '../theme/theme.service';
import { NeatNavItem } from './nav-item';
import { NeatPageToolbar } from './page-toolbar';
import { NeatShell } from './shell';

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

@Component({
  imports: [NeatShell, RouterOutlet],
  template: `
    <neat-shell appName="Neat Insight" [navItems]="navItems">
      <span neatTopbarEnd class="board-status">Board connected</span>
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
  const button = (name: string): HTMLButtonElement =>
    shell().querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement;
  const railToggle = (): HTMLButtonElement => button('Show labels');
  const themeToggle = (): HTMLButtonElement => button('Dark mode');
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
  const labelOf = (anchor: HTMLAnchorElement): HTMLElement =>
    anchor.querySelector('.label') as HTMLElement;
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

  it('shows the logo and appName text in the top bar', async () => {
    await start();

    const logo = topbar().querySelector('svg[role="img"]');
    expect(logo?.getAttribute('aria-label')).toBe('SiMa.ai');
    expect(topbar().textContent).toContain('Neat Insight');
  });

  it('expands the rail to show labels and persists that under neat-ui:rail-expanded', async () => {
    await start();
    expect(railToggle().getAttribute('aria-pressed')).toBe('false');
    expect(labelOf(link('Media')).classList).toContain('visually-hidden');

    railToggle().click();
    await settle();

    expect(railToggle().getAttribute('aria-pressed')).toBe('true');
    expect(labelOf(link('Media')).classList).not.toContain('visually-hidden');
    expect(localStorage.getItem(RAIL_KEY)).toBe('true');

    // Labels are visible now, so the links show no tooltip.
    hover(link('Media'));
    await tick();
    expect(tooltip()).toBeNull();

    railToggle().click();
    await settle();

    expect(railToggle().getAttribute('aria-pressed')).toBe('false');
    expect(localStorage.getItem(RAIL_KEY)).toBe('false');
  });

  it('restores an expanded rail on start', async () => {
    localStorage.setItem(RAIL_KEY, 'true');

    await start();

    expect(railToggle().getAttribute('aria-pressed')).toBe('true');
    expect(labelOf(link('Media')).classList).not.toContain('visually-hidden');
  });

  it('keeps the rail collapsed by default when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    await start();

    expect(railToggle().getAttribute('aria-pressed')).toBe('false');

    railToggle().click();
    await settle();

    expect(railToggle().getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles the colour scheme from the top-bar button', async () => {
    await start();
    const theme = TestBed.inject(ThemeService);
    expect(themeToggle().getAttribute('aria-pressed')).toBe('false');
    expect(topbar().contains(themeToggle())).toBe(true);

    themeToggle().click();
    await settle();

    expect(theme.scheme()).toBe('dark');
    expect(themeToggle().getAttribute('aria-pressed')).toBe('true');

    themeToggle().click();
    await settle();

    expect(theme.scheme()).toBe('light');
    expect(themeToggle().getAttribute('aria-pressed')).toBe('false');
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

  it('gives the top-bar buttons 40px round icon-only targets with tooltips below them', async () => {
    await start();
    await tick();

    for (const control of [themeToggle(), kioskButton()]) {
      expect(control.classList).toContain('size-10');
      expect(control.classList).toContain('rounded-full');
    }

    hover(themeToggle());
    await tick();
    expect(tooltip()?.textContent?.trim()).toBe('Dark mode');
    expect(tooltip()?.getAttribute('data-side')).toBe('bottom');
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

    // jsdom lays nothing out: the layout is asserted through the flex properties that produce it,
    // and the visual check of the showcase's Page demo covers the result. The toolbar's auto start
    // margin takes the free space, which only works while nothing after it grows into that space:
    // the end slot stops growing and sits right after the toolbar.
    expect(region.marginInlineStart).toBe('auto');
    expect(end.flexGrow).toBe('0');
  });

  it('keeps the end slot taking the remaining width, right-aligned, without a toolbar', async () => {
    await start('/media');
    const end = getComputedStyle(topbar().querySelector('.topbar-end') as HTMLElement);

    // Style assertions again, for the same reason as above.
    expect(end.flexGrow).toBe('1');
    expect(end.justifyContent).toBe('flex-end');
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
});
