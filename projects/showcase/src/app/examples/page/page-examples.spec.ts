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

describe('the page examples, each routed on a page of its own', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  const root = (): HTMLElement => fixture.nativeElement;
  const content = (): HTMLElement => root().querySelector('neat-shell main.content') as HTMLElement;
  const open = async (path: string): Promise<void> => {
    await router.navigateByUrl(path);
    await fixture.whenStable();
  };
  const tabs = (): HTMLAnchorElement[] =>
    Array.from(content().querySelectorAll<HTMLAnchorElement>('neat-page > nav a'));

  function start(providers: unknown[] = []): void {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, ...providers] });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
  }

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('link page tabs between two routes, the open one marked', async () => {
    start();
    await open('/demo/page/overview');

    expect(content().querySelector('neat-page > nav')?.getAttribute('aria-label')).toBe(
      'Page example views',
    );
    expect(tabs().map((tab) => tab.getAttribute('href'))).toEqual([
      '/demo/page/overview',
      '/demo/page/details',
    ]);
    expect(
      tabs()
        .filter((tab) => tab.getAttribute('aria-current') === 'page')
        .map((tab) => tab.textContent?.trim()),
    ).toEqual(['Overview']);

    await open('/demo/page/details');

    expect(
      tabs()
        .filter((tab) => tab.getAttribute('aria-current') === 'page')
        .map((tab) => tab.textContent?.trim()),
    ).toEqual(['Details']);
  });

  it('put the page’s tool in the top bar, and keep its state in the page', async () => {
    start();
    await open('/demo/page/overview');
    const tool = (): HTMLButtonElement | null =>
      root().querySelector<HTMLButtonElement>('header [aria-label="Page tools"] button');
    const sections = (): number => content().querySelectorAll('section h3').length;

    expect(content().querySelector('button')).toBeNull();
    expect(tool()?.textContent?.trim()).toBe('Fewer sections');
    expect(sections()).toBe(20);

    tool()!.click();
    await fixture.whenStable();

    expect(tool()?.textContent?.trim()).toBe('More sections');
    expect(sections()).toBe(3);
  });

  it('say whether the screen is narrow, as the kit’s viewport does', async () => {
    const narrow = signal(false);
    start([{ provide: NeatViewport, useValue: { narrow } }]);
    await open('/demo/page/overview');
    const line = (): string | undefined =>
      content().querySelector('.showcase-muted')?.textContent?.trim();

    expect(line()).toBe('The screen is wide.');

    narrow.set(true);
    await fixture.whenStable();

    expect(line()).toBe('The screen is narrow, below 48rem.');
  });

  it('reach the edges with no inset and nothing to scroll in the full-bleed example', async () => {
    start();
    await open('/demo/page/full-bleed');

    const body = content().querySelector('neat-page .body') as HTMLElement;
    expect(body.dataset['padding']).toBe('none');
    expect(body.dataset['scroll']).toBe('none');
    expect(content().querySelectorAll('.tile')).toHaveLength(6);
  });
});
