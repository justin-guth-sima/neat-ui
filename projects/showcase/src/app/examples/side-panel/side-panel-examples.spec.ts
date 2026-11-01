import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NeatViewport } from '@sima/neat-ui';
import { App } from '../../app';
import { appConfig } from '../../app.config';

/** jsdom has no ResizeObserver; these specs check what the pages declare, not sizes. */
class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

const REMEMBERED_KEY = 'neat-ui-showcase:remembered-panel';

describe('the side panel examples, each routed on a page of its own', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  const root = (): HTMLElement => fixture.nativeElement;
  const content = (): HTMLElement => root().querySelector('neat-shell main.content') as HTMLElement;
  // The page declares the toggle; the shell draws it at the top bar's right edge.
  const toggle = (): HTMLButtonElement =>
    root().querySelector('header .aside-edge button[aria-label="Side panel"]') as HTMLButtonElement;
  const aside = (): HTMLElement | null => content().querySelector('neat-page aside');

  async function open(path: string, providers: unknown[] = []): Promise<void> {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...providers] });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    await router.navigateByUrl(path);
    await fixture.whenStable();
  }

  beforeEach(() => {
    localStorage.removeItem(REMEMBERED_KEY);
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    localStorage.removeItem(REMEMBERED_KEY);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('open and close the panel from the top bar toggle, saying the width is default', async () => {
    await open('/demo/side-panel/source-panel');

    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(aside()?.querySelector('h2')?.textContent).toBe('src3');
    expect(content().querySelector('.showcase-section p')?.textContent).toBe(
      "The panel's width is null, the default.",
    );

    toggle().click();
    await fixture.whenStable();

    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(aside()).toBeNull();
  });

  it('put the reset button in the top bar, disabled while the width is the default', async () => {
    await open('/demo/side-panel/source-panel');
    const reset = root().querySelector(
      'header [aria-label="Page tools"] button',
    ) as HTMLButtonElement;

    expect(reset.textContent?.trim()).toBe('Reset panel width');
    expect(reset.getAttribute('aria-disabled')).toBe('true');
  });

  it('remember the panel on a wide screen: closing is stored and comes back closed', async () => {
    await open('/demo/side-panel/remembered-panel');
    expect(aside()).not.toBeNull();

    toggle().click();
    await fixture.whenStable();

    expect(aside()).toBeNull();
    expect(localStorage.getItem(REMEMBERED_KEY)).toBe('false');

    TestBed.resetTestingModule();
    await open('/demo/side-panel/remembered-panel');

    expect(aside()).toBeNull();
  });

  it('start closed on a narrow screen, and not remember what is opened there', async () => {
    await open('/demo/side-panel/remembered-panel', [
      { provide: NeatViewport, useValue: { narrow: signal(true) } },
    ]);
    expect(aside()).toBeNull();

    toggle().click();
    await fixture.whenStable();

    expect(aside()).not.toBeNull();
    expect(localStorage.getItem(REMEMBERED_KEY)).toBeNull();
  });
});
