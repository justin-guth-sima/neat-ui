import { Location } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterLink, RouterOutlet } from '@angular/router';
import type { ComponentFixture } from '@angular/core/testing';
import { NeatPageTab, NeatPageTabs } from './page-tabs';

@Component({ template: '' })
class Empty {}

const routes = [
  { path: 'stats', component: Empty },
  { path: 'stats/runs', component: Empty },
  { path: 'stats/runs/:id', component: Empty },
  { path: 'stats/compare', component: Empty },
];

@Component({
  imports: [NeatPageTabs, NeatPageTab, RouterLink, RouterOutlet],
  template: `
    <router-outlet />
    <nav neatPageTabs aria-label="Stats views">
      <a neatPageTab routerLink="/stats">Live</a>
      <a neatPageTab routerLink="/stats/runs" [activeMatch]="runsMatch()">Runs</a>
      @if (compare()) {
        <a neatPageTab routerLink="/stats/compare" [queryParams]="{ run: ['a', 'b'] }">Compare</a>
      }
    </nav>
  `,
})
class TabsHost {
  readonly runsMatch = signal<'exact' | 'subset'>('exact');
  readonly compare = signal(true);
}

@Component({
  imports: [NeatPageTabs],
  template: `<nav neatPageTabs>No name</nav>`,
})
class Unnamed {}

@Component({
  imports: [NeatPageTabs],
  template: `<nav neatPageTabs [attr.aria-label]="name">Bound name</nav>`,
})
class BoundName {
  readonly name = 'Stats views';
}

describe('NeatPageTabs', () => {
  let fixture: ComponentFixture<TabsHost>;

  const nav = (): HTMLElement => fixture.nativeElement.querySelector('nav');
  /** The tabs that say they are the open view. */
  const current = (): string[] =>
    [...nav().querySelectorAll('a')]
      .filter((anchor) => anchor.getAttribute('aria-current') === 'page')
      .map((anchor) => anchor.textContent?.trim() ?? '');

  async function go(url: string): Promise<void> {
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
  }

  /** Back or forward in the (mock) history, as the browser's buttons do. */
  async function step(direction: 'back' | 'forward'): Promise<void> {
    const navigated = new Promise<void>((resolve) => {
      const subscription = TestBed.inject(Router).events.subscribe((event) => {
        if (event.constructor.name === 'NavigationEnd') {
          subscription.unsubscribe();
          resolve();
        }
      });
    });
    TestBed.inject(Location)[direction]();
    await navigated;
    await fixture.whenStable();
  }

  async function start(url: string): Promise<void> {
    fixture = TestBed.createComponent(TabsHost);
    // What bootstrapping an app does: listens to the browser's history, for back and forward.
    TestBed.inject(Router).initialNavigation();
    await go(url);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  afterEach(() => vi.restoreAllMocks());

  it('is a navigation landmark of links, not a tablist', async () => {
    await start('/stats');

    expect(nav().tagName).toBe('NAV');
    expect(nav().getAttribute('aria-label')).toBe('Stats views');
    expect(nav().querySelector('[role]')).toBeNull();
    expect([...nav().querySelectorAll('a')].map((anchor) => anchor.getAttribute('href'))).toEqual([
      '/stats',
      '/stats/runs',
      '/stats/compare?run=a&run=b',
    ]);
    // Links are tab stops on their own: nothing takes them out of the order.
    expect(nav().querySelector('[tabindex]')).toBeNull();
  });

  it('marks only the tab of the open route, and follows the route', async () => {
    await start('/stats');
    expect(current()).toEqual(['Live']);

    await go('/stats/runs');
    expect(current()).toEqual(['Runs']);
    expect(nav().querySelector('a')?.hasAttribute('aria-current')).toBe(false);

    await go('/stats/compare?run=a&run=b');
    expect(current()).toEqual(['Compare']);
  });

  it('is right on a deep link', async () => {
    await start('/stats/runs');

    expect(current()).toEqual(['Runs']);
  });

  it('is right after back and forward', async () => {
    await start('/stats');
    await go('/stats/runs');
    await go('/stats/compare?run=a&run=b');

    await step('back');
    expect(current()).toEqual(['Runs']);

    await step('back');
    expect(current()).toEqual(['Live']);

    await step('forward');
    expect(current()).toEqual(['Runs']);
  });

  it('matches the path exactly by default, so a nested route leaves its parent tab', async () => {
    await start('/stats/runs/42');

    expect(current()).toEqual([]);
  });

  it('keeps a tab active under its nested routes with activeMatch="subset"', async () => {
    await start('/stats/runs/42');
    fixture.componentInstance.runsMatch.set('subset');
    await fixture.whenStable();

    expect(current()).toEqual(['Runs']);
  });

  it('judges the path only: query parameters and a fragment do not unmark a tab', async () => {
    await start('/stats/compare?run=x&run=y&sort=name#top');

    expect(current()).toEqual(['Compare']);
  });

  it('keeps the open tab marked when another tab appears or goes', async () => {
    await start('/stats/runs');
    fixture.componentInstance.compare.set(false);
    await fixture.whenStable();
    expect(current()).toEqual(['Runs']);

    fixture.componentInstance.compare.set(true);
    await fixture.whenStable();
    expect(current()).toEqual(['Runs']);
  });

  it('draws the open tab differently through data-active, and only that one', async () => {
    await start('/stats/runs');

    const active = [...nav().querySelectorAll('a')].filter((anchor) =>
      anchor.hasAttribute('data-active'),
    );
    expect(active.map((anchor) => anchor.textContent?.trim())).toEqual(['Runs']);
    expect(active[0].className).toContain('data-active:font-semibold');
    expect(active[0].className).toContain('data-active:border-primary');
  });

  it('scrolls sideways when narrow, never wraps its tabs and keeps them whole', async () => {
    await start('/stats');

    expect(nav().className).toContain('overflow-x-auto');
    expect(nav().className).not.toContain('flex-wrap');
    for (const anchor of nav().querySelectorAll('a')) {
      expect(anchor.className).toContain('whitespace-nowrap');
      expect(anchor.className).toContain('shrink-0');
    }
  });

  it('refuses a nav without a name in dev mode', async () => {
    // Angular's ErrorHandler logs the error as well as rejecting.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const unnamed = TestBed.createComponent(Unnamed);
    await expect(unnamed.whenStable()).rejects.toThrow(/aria-label/);
  });

  it('takes a name the app binds', async () => {
    const bound = TestBed.createComponent(BoundName);
    await expect(bound.whenStable()).resolves.toBe(true);
  });
});
