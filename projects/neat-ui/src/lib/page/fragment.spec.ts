import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { inPageLinkTarget, scrollToTarget } from './fragment';
import { NeatPage } from './page';
import { NeatViewport } from './viewport';

/** A click on the element, with the options a test gives. */
function click(target: Element, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('inPageLinkTarget', () => {
  let page: HTMLElement;

  beforeEach(() => {
    page = document.createElement('neat-page');
    page.innerHTML = `
      <a id="plain" href="#setup">Set up</a>
      <a id="encoded" href="#caf%C3%A9">Café</a>
      <a id="malformed" href="#100%">Full</a>
      <a id="bare" href="#">Top</a>
      <a id="route" href="/guide#setup">Guide</a>
      <a id="blank" href="#setup" target="_blank">New tab</a>
      <a id="self" href="#setup" target="_self">Here</a>
      <a id="download" href="#setup" download>Save</a>
      <a id="nested-text" href="#setup"><span>Inside</span></a>
      <neat-page><a id="nested" href="#setup">Nested</a></neat-page>
    `;
    document.body.append(page);
  });

  afterEach(() => page.remove());

  /** What a click on the element of `id` asks for. */
  const asked = (id: string, init?: MouseEventInit): string | null => {
    let result: string | null = 'not clicked';
    const listen = (event: Event) => {
      result = inPageLinkTarget(event as MouseEvent, page);
      // jsdom cannot follow a link that leaves the document.
      event.preventDefault();
    };
    page.addEventListener('click', listen);
    click(page.querySelector(`#${id}`) as Element, init);
    page.removeEventListener('click', listen);
    return result;
  };

  it('takes the id of a plain click on an in-page link, decoded', () => {
    expect(asked('plain')).toBe('setup');
    expect(asked('encoded')).toBe('café');
    expect(asked('malformed')).toBe('100%');
    expect(asked('self')).toBe('setup');
    expect(asked('nested-text')).toBe('setup');
  });

  it('leaves a bare #, a link with a path, one that opens elsewhere or downloads', () => {
    expect(asked('bare')).toBeNull();
    expect(asked('route')).toBeNull();
    expect(asked('blank')).toBeNull();
    expect(asked('download')).toBeNull();
  });

  it('leaves a click with a modifier or another button, and one already handled', () => {
    for (const init of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
    ]) {
      expect(asked('plain', init), JSON.stringify(init)).toBeNull();
    }
    expect(asked('plain', { button: 1 })).toBeNull();

    const handled = (event: Event) => event.preventDefault();
    page.querySelector('#plain')?.addEventListener('click', handled);
    expect(asked('plain')).toBeNull();
  });

  it('leaves a link of a page nested in this one to that page', () => {
    expect(asked('nested')).toBeNull();
  });
});

describe('scrollToTarget', () => {
  afterEach(() => vi.restoreAllMocks());

  /** A box scrolled `scrollTop` down, its top at 100 on screen, and a target at `targetTop`. */
  function layout(targetTop: number, styles: { padding?: string; margin?: string } = {}) {
    const box = document.createElement('div');
    const target = document.createElement('h2');
    box.append(target);
    box.scrollTop = 0;
    Object.defineProperty(box, 'scrollTop', { value: 40, writable: true });
    Object.defineProperty(box, 'clientHeight', { value: 500 });
    box.getBoundingClientRect = () => new DOMRect(0, 100, 300, 500);
    target.getBoundingClientRect = () => new DOMRect(0, targetTop, 300, 20);
    const scrollTo = vi.fn();
    box.scrollTo = scrollTo;
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (element) =>
        ({
          scrollPaddingTop: element === box ? (styles.padding ?? 'auto') : 'auto',
          scrollMarginTop: element === target ? (styles.margin ?? '0px') : '0px',
        }) as CSSStyleDeclaration,
    );
    return { box, target, scrollTo };
  }

  it('scrolls the box so the target sits at its top', () => {
    const { box, target, scrollTo } = layout(700);

    scrollToTarget(target, box, false);

    // 600 below the box's top, which is already 40 down.
    expect(scrollTo).toHaveBeenCalledWith({ top: 640, behavior: 'instant' });
  });

  it('stops the target below the box’s scroll padding, less its own scroll margin', () => {
    const { box, target, scrollTo } = layout(700, { padding: '24px', margin: '8px' });

    scrollToTarget(target, box, true);

    expect(scrollTo).toHaveBeenCalledWith({ top: 640 - 24 - 8, behavior: 'smooth' });
  });

  it('takes a scroll padding in percent of the box’s height', () => {
    const { box, target, scrollTo } = layout(700, { padding: '10%' });

    scrollToTarget(target, box, false);

    expect(scrollTo).toHaveBeenCalledWith({ top: 640 - 50, behavior: 'instant' });
  });

  it('scrolls no higher than the box’s top', () => {
    const { box, target, scrollTo } = layout(0, { padding: '24px' });

    scrollToTarget(target, box, false);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });
});

@Component({
  imports: [NeatPage],
  template: `
    <neat-page [scroll]="scroll()" aside="open">
      <a class="to-later" href="#later">Later</a>
      <a class="to-panel" href="#details">Details</a>
      <h2 id="setup">Set up</h2>
      <h2 id="later">Later</h2>
      <neat-page><h2 id="inner">Inner</h2></neat-page>
      <section neatPageAside><h3 id="details">Details</h3></section>
    </neat-page>
  `,
})
class GuidePage {
  readonly scroll = signal<'body' | 'none'>('body');
}

@Component({ template: '<p>Elsewhere</p>' })
class OtherPage {}

describe('NeatPage and a URL’s fragment', () => {
  /** Each scroll a box was asked for: which box, and the behavior. */
  let scrolls: { box: string; behavior: ScrollBehavior | undefined }[];

  beforeEach(() => {
    scrolls = [];
    HTMLElement.prototype.scrollTo = function (
      this: HTMLElement,
      options?: ScrollToOptions | number,
    ) {
      const box = this.classList.contains('body') ? 'body' : this.tagName.toLowerCase();
      scrolls.push({ box, behavior: (options as ScrollToOptions).behavior });
    } as HTMLElement['scrollTo'];
    vi.stubGlobal('ResizeObserver', undefined);
  });

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
    vi.unstubAllGlobals();
  });

  async function open(url: string, providers: unknown[] = []) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'guide', component: GuidePage },
          { path: 'other', component: OtherPage },
        ]),
        { provide: NeatViewport, useValue: { narrow: signal(false) } },
        ...(providers as never[]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    const guide = (await harness.navigateByUrl(url)) as GuidePage | null;
    await harness.fixture.whenStable();
    const root = () => harness.routeNativeElement as HTMLElement;
    const settle = () => harness.fixture.whenStable();
    return { harness, guide, root, settle, router: TestBed.inject(Router) };
  }

  it('jumps the body to the fragment’s element as the page opens', async () => {
    await open('/guide#setup');

    expect(scrolls).toEqual([{ box: 'body', behavior: 'instant' }]);
  });

  it('scrolls nothing for a URL without a fragment, or one that names no element', async () => {
    const { harness, settle } = await open('/guide');
    await harness.navigateByUrl('/guide#missing');
    await settle();

    expect(scrolls).toEqual([]);
  });

  it('follows an in-page link as a navigation, smoothly, keeping the route', async () => {
    const { root, settle, router } = await open('/guide?tab=api');

    const event = click(root().querySelector('.to-later') as Element);
    await settle();

    expect(event.defaultPrevented).toBe(true);
    expect(router.url).toBe('/guide?tab=api#later');
    expect(scrolls).toEqual([{ box: 'body', behavior: 'smooth' }]);
  });

  it('scrolls again on a link to the fragment the URL already has', async () => {
    const { root, settle, router } = await open('/guide#later');
    scrolls.length = 0;

    click(root().querySelector('.to-later') as Element);
    await settle();

    expect(router.url).toBe('/guide#later');
    expect(scrolls).toEqual([{ box: 'body', behavior: 'smooth' }]);
  });

  it('jumps, never glides, for a user who asked for reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    const { root, settle } = await open('/guide');

    click(root().querySelector('.to-later') as Element);
    await settle();

    expect(scrolls).toEqual([{ box: 'body', behavior: 'instant' }]);
  });

  it('scrolls the aside to an element in it', async () => {
    const { root, settle } = await open('/guide');

    click(root().querySelector('.to-panel') as Element);
    await settle();

    expect(scrolls).toEqual([{ box: 'aside', behavior: 'smooth' }]);
  });

  it('leaves an element of a page nested in it to that page, and a body that does not scroll', async () => {
    const { harness, guide, settle } = await open('/guide');
    await harness.navigateByUrl('/guide#inner');
    await settle();
    // The inner page's body holds it, and it scrolls that.
    expect(scrolls).toEqual([{ box: 'body', behavior: 'smooth' }]);
    scrolls.length = 0;

    guide?.scroll.set('none');
    await settle();
    await harness.navigateByUrl('/guide#setup');
    await settle();

    expect(scrolls).toEqual([]);
  });

  it('leaves an in-page link to the browser and the router under hash routing', async () => {
    const { root, settle } = await open('/guide', [
      { provide: LocationStrategy, useClass: HashLocationStrategy },
    ]);

    // What the page decided, seen as the click leaves it; then kept from jsdom, which cannot leave.
    let prevented: boolean | undefined;
    root().addEventListener('click', (event) => {
      prevented = event.defaultPrevented;
      event.preventDefault();
    });
    click(root().querySelector('.to-later') as Element);
    await settle();

    expect(prevented).toBe(false);
  });

  it('stops following the router once the page is gone', async () => {
    const { harness, settle } = await open('/guide');
    await harness.navigateByUrl('/other#setup');
    await settle();

    expect(scrolls).toEqual([]);
  });
});
