import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterOutlet, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ThemeService } from '../theme/theme.service';
import { NeatNavItem } from './nav-item';
import { NeatShell } from './shell';

const RAIL_KEY = 'neat-ui:rail-expanded';

const NAV_ITEMS: NeatNavItem[] = [
  { label: 'Media', icon: 'media', path: '/media' },
  { label: 'Streaming', icon: 'streaming', path: '/streaming' },
  { label: 'Viewer', icon: 'viewer', path: '/viewer' },
];

@Component({ template: 'page content' })
class StubPage {}

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
  const labelOf = (anchor: HTMLAnchorElement): HTMLElement =>
    anchor.querySelector('.label') as HTMLElement;
  const tooltip = (): HTMLElement | null => document.querySelector('.p-tooltip');

  const start = async (url = '/media'): Promise<void> => {
    harness = await RouterTestingHarness.create(url);
  };

  const settle = async (): Promise<void> => {
    await harness.fixture.whenStable();
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    tooltip()?.remove();
    document.documentElement.classList.remove('neat-dark');
  });

  it('renders one rail link per nav item, with label as tooltip and accessible name', async () => {
    await start();

    expect(nav().getAttribute('aria-label')).toBe('Main');
    expect(links().map((a) => a.textContent?.trim())).toEqual(['Media', 'Streaming', 'Viewer']);
    expect(links().map((a) => a.getAttribute('href'))).toEqual(['/media', '/streaming', '/viewer']);
    // The icon is decorative, so the visible (or visually hidden) label is the whole name.
    expect(link('Viewer').querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');

    link('Viewer').dispatchEvent(new MouseEvent('mouseenter'));

    expect(tooltip()?.textContent?.trim()).toBe('Viewer');
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
    link('Media').dispatchEvent(new MouseEvent('mouseenter'));
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

  it('projects [neatTopbarEnd] content into the top bar', async () => {
    await start();

    expect(topbar().querySelector('.board-status')?.textContent).toBe('Board connected');
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
});
