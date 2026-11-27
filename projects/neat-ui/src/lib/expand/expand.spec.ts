import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NeatPage } from '../page/page';
import type { NeatNavItem } from '../shell/nav-item';
import { NeatShell } from '../shell/shell';
import expandStyles from './expand.css' with { loader: 'text' };
import { NeatExpand, type NeatExpandRegion } from './expand';

@Component({
  imports: [NeatExpand],
  template: `
    <button id="outside" type="button" (click)="expand.open()">Expand from outside</button>
    <section neatExpand #expand="neatExpand" [(expanded)]="expanded">
      <button id="first" type="button" (click)="expand.toggle()">
        {{ expand.expanded() ? 'Close' : 'Expand' }}
      </button>
      <button id="last" type="button">Last</button>
    </section>
    <div id="focusable" neatExpand tabindex="0"></div>
  `,
})
class ExpandHost {
  readonly expanded = signal(false);
}

/**
 * jsdom has no Popover API: these stand in for it on every element, and record which elements
 * are in the top layer. jsdom's stylesheet hides a popover it does not know to be open, which
 * would make everything in it unfocusable, so the stand-in shows it with an inline display.
 */
function fakePopoverApi(): Set<HTMLElement> {
  const open = new Set<HTMLElement>();
  HTMLElement.prototype.showPopover = function (this: HTMLElement) {
    open.add(this);
    this.style.display = 'block';
  };
  HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    open.delete(this);
    this.style.removeProperty('display');
  };
  return open;
}

function removePopoverApi(): void {
  const prototype = HTMLElement.prototype as Partial<HTMLElement>;
  delete prototype.showPopover;
  delete prototype.hidePopover;
}

async function render() {
  const fixture = TestBed.createComponent(ExpandHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const element = (selector: string) => root.querySelector<HTMLElement>(selector)!;
  const press = (target: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };
  return { fixture, host: fixture.componentInstance, section: element('section'), element, press };
}

describe('NeatExpand', () => {
  let topLayer: Set<HTMLElement>;

  beforeEach(() => {
    topLayer = fakePopoverApi();
    // jsdom lays nothing out, and CDK counts an element without a box as hidden, so not tabbable.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1);
  });

  afterEach(() => removePopoverApi());

  it('lifts its host into the top layer as a manual popover, in its expanded look', async () => {
    const { fixture, section, element } = await render();

    element('#first').click();
    await fixture.whenStable();

    expect(topLayer.has(section)).toBe(true);
    expect(section.getAttribute('popover')).toBe('manual');
    expect(section.hasAttribute('data-neat-expanded')).toBe(true);
    expect(element('#first').textContent?.trim()).toBe('Close');
  });

  it('puts its host back in its place on the page when it closes', async () => {
    const { fixture, section, element } = await render();

    element('#first').click();
    await fixture.whenStable();
    element('#first').click();
    await fixture.whenStable();

    expect(topLayer.has(section)).toBe(false);
    expect(section.hasAttribute('popover')).toBe(false);
    expect(section.hasAttribute('data-neat-expanded')).toBe(false);
  });

  it('follows the app’s state both ways', async () => {
    const { fixture, host, section, element } = await render();

    host.expanded.set(true);
    await fixture.whenStable();
    expect(topLayer.has(section)).toBe(true);

    element('#first').click();
    await fixture.whenStable();
    expect(host.expanded()).toBe(false);
    expect(topLayer.has(section)).toBe(false);
  });

  it('moves the focus into the host when it opens from outside, and back when it closes', async () => {
    const { fixture, section, element, press } = await render();
    const outside = element('#outside');

    outside.focus();
    outside.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(section);
    expect(section.getAttribute('tabindex')).toBe('-1');

    press(section, 'Escape');
    await fixture.whenStable();
    expect(document.activeElement).toBe(outside);
    expect(section.hasAttribute('tabindex')).toBe(false);
  });

  it('leaves the focus on a control inside the host that opened it', async () => {
    const { fixture, element } = await render();
    const button = element('#first');

    button.focus();
    button.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(button);

    button.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(button);
  });

  it('leaves the focus where it is on closing when it went outside the host', async () => {
    const { fixture, host, element } = await render();
    const outside = element('#outside');

    element('#first').focus();
    host.expanded.set(true);
    await fixture.whenStable();
    outside.focus();
    host.expanded.set(false);
    await fixture.whenStable();

    expect(document.activeElement).toBe(outside);
  });

  it('keeps a tabindex its host has of its own', async () => {
    const { fixture, element } = await render();
    const focusable = element('#focusable');
    const expand = fixture.debugElement
      .queryAll((node) => node.nativeElement === focusable)[0]
      .injector.get(NeatExpand);

    expand.open();
    await fixture.whenStable();
    expect(focusable.getAttribute('tabindex')).toBe('0');
    expand.close();
    await fixture.whenStable();
    expect(focusable.getAttribute('tabindex')).toBe('0');
  });

  it('closes on Escape and stops the key there, but only while open', async () => {
    const { fixture, host, element, press } = await render();
    const page = vi.fn();
    document.addEventListener('keydown', page);

    expect(press(element('#first'), 'Escape').defaultPrevented).toBe(false);
    expect(page).toHaveBeenCalledTimes(1);

    host.expanded.set(true);
    await fixture.whenStable();
    expect(press(element('#first'), 'Escape').defaultPrevented).toBe(true);
    await fixture.whenStable();

    expect(host.expanded()).toBe(false);
    expect(page).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', page);
  });

  it('leaves an Escape that a control inside already handled', async () => {
    const { fixture, host, element } = await render();
    host.expanded.set(true);
    await fixture.whenStable();
    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();

    element('#first').dispatchEvent(handled);
    await fixture.whenStable();

    expect(host.expanded()).toBe(true);
  });

  it('keeps Tab and Shift+Tab inside the host while it is open', async () => {
    const { fixture, host, element, press } = await render();
    const first = element('#first');
    const last = element('#last');

    expect(press(last, 'Tab').defaultPrevented).toBe(false);

    host.expanded.set(true);
    await fixture.whenStable();
    last.focus();
    expect(press(last, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(press(first, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    // Between the two, the browser's own Tab moves on.
    expect(press(first, 'Tab').defaultPrevented).toBe(false);
  });

  it('follows the browser when it takes the host out of the top layer', async () => {
    const { fixture, host, section } = await render();
    host.expanded.set(true);
    await fixture.whenStable();

    section.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }));
    await fixture.whenStable();

    expect(host.expanded()).toBe(false);
    expect(section.hasAttribute('popover')).toBe(false);
  });

  it('changes its state without the Popover API, leaving the host in its place', async () => {
    removePopoverApi();
    const { fixture, host, section, element } = await render();

    element('#first').click();
    await fixture.whenStable();

    expect(host.expanded()).toBe(true);
    expect(section.hasAttribute('data-neat-expanded')).toBe(true);
    expect(section.hasAttribute('popover')).toBe(false);
  });
});

/** A ResizeObserver the spec drives: jsdom lays nothing out, so the spec says what changed. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  disconnect(): void {
    FakeResizeObserver.instances = FakeResizeObserver.instances.filter((other) => other !== this);
  }

  /** Reports a new size of every element it observes. */
  static fire(): void {
    for (const observer of FakeResizeObserver.instances) {
      observer.callback([], observer as unknown as ResizeObserver);
    }
  }
}

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  }) as DOMRect;

/** Where the host is placed in the top layer, as the region tracker wrote it. */
const placement = (host: HTMLElement) => ({
  top: host.style.getPropertyValue('--neat-expand-top'),
  left: host.style.getPropertyValue('--neat-expand-left'),
  width: host.style.getPropertyValue('--neat-expand-width'),
  height: host.style.getPropertyValue('--neat-expand-height'),
});

/** A routed page in the shell, with an expanding section and a card it can cover. */
@Component({
  imports: [NeatExpand, NeatPage],
  template: `
    <neat-page [aside]="aside()">
      <button id="opener" type="button" (click)="expanded.set(true)">Expand</button>
      <button id="covered" type="button">A control of the page</button>
      <div id="card" #card>
        <p>The card</p>
      </div>
      @if (sectionShown()) {
        <section
          neatExpand
          #expand="neatExpand"
          [region]="regionOver(card)"
          [(expanded)]="expanded"
        >
          <button id="first" type="button" (click)="expand.close()">Close</button>
          <div id="inner"></div>
          <button id="last" type="button">Last</button>
        </section>
      }
      <div neatPageAside>Inspector</div>
    </neat-page>
  `,
})
class RegionPage {
  readonly region = signal<NeatExpandRegion | 'card' | 'inner'>('content');
  readonly expanded = signal(false);
  readonly aside = signal<'open' | 'closed'>('closed');
  readonly sectionShown = signal(true);

  protected regionOver(card: HTMLElement): NeatExpandRegion {
    const region = this.region();
    if (region === 'inner') return document.querySelector<HTMLElement>('#inner') ?? 'window';
    return region === 'card' ? card : region;
  }
}

@Component({ template: 'Another page' })
class OtherPage {}

@Component({
  imports: [NeatShell, RouterOutlet],
  template: `
    <neat-shell appName="Neat Insight" [navItems]="items">
      <router-outlet />
    </neat-shell>
  `,
})
class RegionApp {
  readonly items: NeatNavItem[] = [
    { label: 'Region', icon: 'viewer', path: '/region' },
    { label: 'Other', icon: 'media', path: '/other' },
  ];
}

/** An expanding section with no shell or page around it. */
@Component({
  imports: [NeatExpand],
  template: `<section neatExpand [region]="region()" [(expanded)]="expanded"></section>`,
})
class BareHost {
  readonly region = signal<NeatExpandRegion>('content');
  readonly expanded = signal(false);
}

describe('NeatExpand over a region', () => {
  let topLayer: Set<HTMLElement>;
  let harness: RouterTestingHarness;
  let frames: Map<number, FrameRequestCallback>;

  const root = (): HTMLElement => harness.fixture.nativeElement;
  const element = (selector: string) => root().querySelector<HTMLElement>(selector)!;
  const section = () => element('section[neatExpand]');
  const page = (): RegionPage =>
    harness.fixture.debugElement.query((node) => node.componentInstance instanceof RegionPage)
      .componentInstance;
  const settle = () => harness.fixture.whenStable();
  /** Runs the frame's callbacks, as the browser does before it paints. */
  const frame = (): void => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(0);
  };

  beforeEach(async () => {
    topLayer = fakePopoverApi();
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1);
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    frames = new Map();
    let next = 1;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(next, callback);
      return next++;
    });
    vi.stubGlobal('cancelAnimationFrame', (handle: number) => frames.delete(handle));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: RegionApp,
            children: [
              { path: 'region', component: RegionPage },
              { path: 'other', component: OtherPage },
            ],
          },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create('/region');
    // jsdom lays nothing out: the shell's content area, the page's body and the card get boxes.
    element('main.content').getBoundingClientRect = () => rect(64, 56, 960, 712);
    element('neat-page .body').getBoundingClientRect = () => rect(64, 56, 608, 712);
    element('#card').getBoundingClientRect = () => rect(88, 120, 320, 180);
  });

  afterEach(() => {
    removePopoverApi();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function open(region: NeatExpandRegion | 'card' | 'inner'): Promise<void> {
    page().region.set(region);
    page().expanded.set(true);
    await settle();
  }

  it('covers the shell’s content area, leaving the rail and the top bar', async () => {
    await open('content');

    expect(topLayer.has(section())).toBe(true);
    expect(section().hasAttribute('data-neat-expand-region')).toBe(true);
    expect(placement(section())).toEqual({
      top: '56px',
      left: '64px',
      width: '960px',
      height: '712px',
    });
  });

  it('covers the page’s body, leaving the aside beside it', async () => {
    page().aside.set('open');
    await open('body');

    expect(placement(section())).toEqual({
      top: '56px',
      left: '64px',
      width: '608px',
      height: '712px',
    });
  });

  it('covers an element the app names', async () => {
    await open('card');

    expect(placement(section())).toEqual({
      top: '120px',
      left: '88px',
      width: '320px',
      height: '180px',
    });
  });

  it('covers the whole window by default, as it always has', async () => {
    page().region.set('window');
    page().expanded.set(true);
    await settle();

    expect(topLayer.has(section())).toBe(true);
    expect(section().hasAttribute('data-neat-expand-region')).toBe(false);
    expect(placement(section()).top).toBe('');
  });

  it('follows its region on the next frame when it resizes, the window resizes or a box scrolls', async () => {
    await open('body');

    // The aside opens: the body narrows.
    element('neat-page .body').getBoundingClientRect = () => rect(64, 56, 608 - 352, 712);
    FakeResizeObserver.fire();
    frame();
    expect(placement(section()).width).toBe('256px');

    element('neat-page .body').getBoundingClientRect = () => rect(0, 104, 390, 700);
    window.dispatchEvent(new Event('resize'));
    frame();
    expect(placement(section())).toEqual({
      top: '104px',
      left: '0px',
      width: '390px',
      height: '700px',
    });

    await open('card');
    element('#card').getBoundingClientRect = () => rect(88, -40, 320, 180);
    // A scroll of the body, which does not bubble.
    element('neat-page .body').dispatchEvent(new Event('scroll'));
    frame();
    expect(placement(section()).top).toBe('-40px');
  });

  it('moves to another region while it is expanded', async () => {
    await open('card');

    page().region.set('content');
    await settle();
    expect(placement(section()).width).toBe('960px');

    page().region.set('window');
    await settle();
    expect(section().hasAttribute('data-neat-expand-region')).toBe(false);
    expect(placement(section()).width).toBe('');
    expect(topLayer.has(section())).toBe(true);
  });

  it('closes when the element it covers leaves the page, and gives the focus back', async () => {
    const opener = element('#opener');
    page().region.set('card');
    await settle();
    opener.focus();
    opener.click();
    await settle();
    expect(document.activeElement).toBe(section());

    // The app takes the card out of the page.
    element('#card').remove();
    // The DOM change is seen in a microtask, the region measured in the next frame.
    await Promise.resolve();
    frame();
    await settle();

    expect(page().expanded()).toBe(false);
    expect(topLayer.has(section())).toBe(false);
    expect(section().hasAttribute('data-neat-expand-region')).toBe(false);
    expect(placement(section()).top).toBe('');
    expect(document.activeElement).toBe(opener);
  });

  it('closes when the element it covers is hidden', async () => {
    await open('card');

    element('#card').style.display = 'none';
    element('#card').getBoundingClientRect = () => rect(0, 0, 0, 0);
    FakeResizeObserver.fire();
    frame();
    await settle();

    expect(page().expanded()).toBe(false);
    expect(topLayer.has(section())).toBe(false);
  });

  it('does not open over an element that shows nothing', async () => {
    element('#card').getBoundingClientRect = () => rect(0, 0, 0, 0);

    await open('card');

    expect(page().expanded()).toBe(false);
    expect(topLayer.has(section())).toBe(false);
  });

  it('gives the focus back when it goes from the page while expanded', async () => {
    const opener = element('#opener');
    opener.focus();
    opener.click();
    await settle();
    expect(document.activeElement).toBe(section());

    page().sectionShown.set(false);
    await settle();

    expect(document.activeElement).toBe(opener);
    expect(FakeResizeObserver.instances).toEqual([]);
  });

  it('keeps Escape, Tab inside and the focus going back in a region', async () => {
    const opener = element('#opener');
    opener.focus();
    page().region.set('content');
    opener.click();
    await settle();
    const first = element('#first');
    const last = element('#last');

    last.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await settle();
    expect(page().expanded()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('keeps the focus out of what it covers when it arrives from the top bar or the rail', async () => {
    page().aside.set('open');
    await open('content');
    const topbarButton = element('header button');
    const first = element('#first');

    // A click on the top bar's button moved the focus out of the host.
    topbarButton.focus();
    expect(document.activeElement).toBe(topbarButton);

    // Tab from there would reach the page's controls under the host: the focus goes into it.
    element('#covered').focus();
    expect(document.activeElement).toBe(first);
    element('[neatPageAside]').setAttribute('tabindex', '-1');
    element('[neatPageAside]').focus();
    expect(document.activeElement).toBe(first);

    page().expanded.set(false);
    await settle();
    element('#covered').focus();
    expect(document.activeElement).toBe(element('#covered'));
  });

  it('keeps the focus out of a card it covers, and lets it be outside the card', async () => {
    await open('card');
    const outside = element('#covered');

    outside.focus();
    expect(document.activeElement).toBe(outside);
    element('#card').setAttribute('tabindex', '-1');
    element('#card').focus();
    expect(document.activeElement).toBe(element('#first'));
  });

  it('follows its region when it moves without resizing, as the rail beside it changes', async () => {
    await open('card');

    // A fixed-width card shifted by an element around it that resized: the content area.
    element('#card').getBoundingClientRect = () => rect(200, 120, 320, 180);
    FakeResizeObserver.fire();
    frame();

    expect(placement(section()).left).toBe('200px');
  });

  it('covers the window for an element that is the host or inside it, said in dev mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await open('inner');

    expect(topLayer.has(section())).toBe(true);
    expect(section().hasAttribute('data-neat-expand-region')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('inside');
  });

  it('lets the rail navigate while it covers the content area, and goes with its page', async () => {
    await open('content');
    const other = Array.from(root().querySelectorAll<HTMLAnchorElement>('nav a')).find(
      (link) => link.textContent?.trim() === 'Other',
    )!;

    other.click();
    await settle();

    expect(TestBed.inject(Router).url).toBe('/other');
    expect(root().querySelector('[data-neat-expanded]')).toBeNull();
    expect(FakeResizeObserver.instances).toEqual([]);
  });
});

describe('NeatExpand outside a shell or a page', () => {
  beforeEach(() => fakePopoverApi());
  afterEach(() => {
    removePopoverApi();
    vi.restoreAllMocks();
  });

  it('covers the window for the content area or the body, said once in the app in dev mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Two elements, each opened twice over each region: one warning a kind, for the whole app.
    for (let round = 0; round < 2; round++) {
      const fixture = TestBed.createComponent(BareHost);
      await fixture.whenStable();
      const host = fixture.componentInstance;
      const section: HTMLElement = fixture.nativeElement.querySelector('section');

      host.expanded.set(true);
      await fixture.whenStable();
      expect(section.hasAttribute('data-neat-expand-region')).toBe(false);
      expect(placement(section).top).toBe('');

      host.expanded.set(false);
      await fixture.whenStable();
      host.expanded.set(true);
      await fixture.whenStable();
      host.region.set('body');
      await fixture.whenStable();
      fixture.destroy();
    }

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('content');
    expect(warn.mock.calls[1][0]).toContain('body');
  });
});

describe('the expanded look', () => {
  const css = expandStyles.replace(/\/\*[\s\S]*?\*\//g, '');
  const layered = css.slice(css.indexOf('@layer base'));
  const unlayered = css.slice(0, css.indexOf('@layer base'));

  it('covers the window from outside any layer, so the host’s own sizing gives way', () => {
    expect(unlayered).toContain('[data-neat-expanded]:popover-open');
    for (const declaration of ['position: fixed', 'inset: 0', 'width: auto', 'height: auto']) {
      expect(unlayered).toContain(declaration);
    }
  });

  it('gives its fill and colors in the base layer, so the host’s own win', () => {
    for (const declaration of ['background-color: var(--background)', 'color: var(--foreground)']) {
      expect(layered).toContain(declaration);
      expect(unlayered).not.toContain(declaration);
    }
  });

  it('places a host over its region from the tracker’s geometry, outweighing the window’s', () => {
    const rule =
      /\[data-neat-expanded\]\[data-neat-expand-region\]:popover-open\s*\{([^}]*)\}/.exec(
        unlayered,
      )?.[1];
    for (const declaration of [
      'inset: auto',
      'top: var(--neat-expand-top)',
      'left: var(--neat-expand-left)',
      'width: var(--neat-expand-width)',
      'height: var(--neat-expand-height)',
      'border-radius: var(--neat-expand-radius)',
    ]) {
      expect(rule).toContain(declaration);
    }
  });

  it('adds no padding, which would shrink a component’s content box under its parts', () => {
    expect(css).not.toContain('padding');
  });
});
