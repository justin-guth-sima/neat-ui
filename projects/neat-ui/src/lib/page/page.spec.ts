import type { Mock } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NeatPage } from './page';
import { NeatPageTabs } from './page-tabs';
import { NeatViewport } from './viewport';
import pageStyles from './page.css' with { loader: 'text' };

@Component({
  imports: [NeatPage],
  template: `
    <neat-page
      [scroll]="scroll()"
      [padding]="padding()"
      [aside]="aside()"
      [(asideWidth)]="asideWidth"
    >
      <p>Long content</p>
      <section neatPageAside class="inspector">Inspector</section>
    </neat-page>
  `,
})
class Host {
  readonly scroll = signal<'body' | 'none'>('body');
  readonly padding = signal<'page' | 'none'>('page');
  readonly aside = signal<'open' | 'closed'>('closed');
  readonly asideWidth = signal<number | null>(null);
}

@Component({
  imports: [NeatPage, NeatPageTabs],
  template: `
    <neat-page [aside]="'open'">
      <nav neatPageTabs aria-label="Views"><a href="/live">Live</a></nav>
      <p>Long content</p>
      <section neatPageAside class="inspector">Inspector</section>
    </neat-page>
  `,
})
class TabbedHost {}

/** A ResizeObserver the spec drives: jsdom lays nothing out, so the spec says what was measured. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  fire(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

describe('NeatPage', () => {
  let fixture: ComponentFixture<Host>;
  // The viewport the page reads, as a stub a test can turn narrow.
  const narrow = signal(false);

  const page = (): HTMLElement => fixture.nativeElement.querySelector('neat-page');
  const body = (): HTMLElement => page().querySelector('.body') as HTMLElement;
  const aside = (): HTMLElement | null => page().querySelector('aside');
  /** The row of the body and the aside, which the page's tabs sit above. */
  const content = (): HTMLElement => page().querySelector('.content') as HTMLElement;
  // jsdom computes the stylesheet's `overflow` shorthand but does not expand it into
  // `overflow-x`/`overflow-y`, so the shorthand is what can be asserted.
  const overflow = (element: Element): string => getComputedStyle(element).overflow;

  // jsdom resolves no var() in `padding` (it computes 0), so the inset of a padded page is asserted
  // as the stylesheet's rule for the state its body is in; the app's e2e suite measures it.
  const paddingRule = (state: string): string | undefined =>
    new RegExp(`\\.body\\[data-padding='${state}'\\]\\s*\\{([^}]*)\\}`)
      .exec(pageStyles)?.[1]
      .match(/padding:\s*([^;]+);/)?.[1];

  /** The declarations of the stylesheet's rule for the aside beside the body. */
  const asideRule = (): string | undefined =>
    /:host\(\[data-aside='beside'\]\) aside\s*\{([^}]*)\}/.exec(pageStyles)?.[1];
  /** The declarations every aside shares, beside the body or over it. */
  const sharedAsideRule = (): string | undefined =>
    /(?:^|\n)aside\s*\{([^}]*)\}/.exec(pageStyles)?.[1];

  /** The declarations of the rule that floats the aside over the body. */
  const overlayAsideRule = (): string | undefined =>
    /:host\(\[data-aside='overlay'\]\) aside\s*\{([^}]*)\}/.exec(pageStyles)?.[1];

  beforeEach(async () => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    narrow.set(false);
    TestBed.configureTestingModule({
      providers: [{ provide: NeatViewport, useValue: { narrow } }],
    });
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('projects its content into the page body', () => {
    expect(body().querySelector('p')?.textContent).toBe('Long content');
  });

  it('fills its parent', () => {
    expect(getComputedStyle(page()).height).toBe('100%');
  });

  it('with scroll="body" makes only the page body scrollable', () => {
    expect(overflow(body())).toBe('auto');
    expect(overflow(page())).toBe('hidden');
  });

  it('with scroll="none" makes nothing scrollable', async () => {
    fixture.componentInstance.scroll.set('none');
    await fixture.whenStable();

    expect(overflow(body())).toBe('hidden');
    expect(overflow(page())).toBe('hidden');
  });

  it('with padding="page" insets the content by the page spacing token', () => {
    expect(body().dataset['padding']).toBe('page');
    expect(paddingRule('page')).toBe('var(--neat-space-6)');
  });

  it('with padding="none" lets the content reach the edges', async () => {
    fixture.componentInstance.padding.set('none');
    await fixture.whenStable();

    expect(body().dataset['padding']).toBe('none');
    expect(getComputedStyle(body()).padding).toBe('0px');
  });

  it('pads the body inside its scroll container, which keeps its size', () => {
    // On the scrolling element, the padding scrolls with the content instead of framing it, and
    // border-box keeps the padded body at the page's height.
    expect(getComputedStyle(body()).boxSizing).toBe('border-box');
    expect(getComputedStyle(body()).height).toBe('100%');
  });

  it('pads the page and scrolls the body by default', async () => {
    const plain = TestBed.createComponent(NeatPage);
    await plain.whenStable();

    const plainBody = plain.nativeElement.querySelector('.body') as HTMLElement;
    expect(plainBody.dataset['padding']).toBe('page');
    expect(overflow(plainBody)).toBe('auto');
  });

  it('an open aside narrows the body; the body and the aside scroll independently; closed renders nothing', async () => {
    // Closed: no aside element, and the projected aside content is not in the page.
    expect(aside()).toBeNull();
    expect(page().querySelector('.inspector')).toBeNull();

    fixture.componentInstance.aside.set('open');
    await fixture.whenStable();

    const panel = aside() as HTMLElement;
    expect(panel.querySelector('.inspector')?.textContent).toBe('Inspector');
    expect(body().contains(panel)).toBe(false);
    // Beside the body, not over it: the page lays the two out in a row, the body takes what the
    // aside leaves and may shrink below its content's width, and the aside keeps its width.
    expect(getComputedStyle(content()).display).toBe('flex');
    expect(getComputedStyle(body()).flexGrow).toBe('1');
    expect(getComputedStyle(body()).minWidth).toBe('0px');
    expect(getComputedStyle(panel).flexShrink).toBe('0');
    expect(getComputedStyle(panel).position).not.toMatch(/absolute|fixed/);
    // jsdom resolves no var(), so the width is asserted as the stylesheet's rule: the token,
    // between the bounds the page computes.
    expect(asideRule()).toMatch(/width:\s*clamp\([^;]*var\(--neat-aside-width\)[^;]*\);/);
    expect(sharedAsideRule()).toMatch(/border-inline-start:\s*1px solid var\(--border\);/);
    // Two scroll containers side by side; the page itself still never scrolls.
    expect(overflow(body())).toBe('auto');
    expect(overflow(panel)).toBe('auto');
    expect(overflow(page())).toBe('hidden');

    // With a body that does not scroll, the aside is the page's only scroll context.
    fixture.componentInstance.scroll.set('none');
    await fixture.whenStable();
    expect(overflow(body())).toBe('hidden');
    expect(overflow(panel)).toBe('auto');

    fixture.componentInstance.aside.set('closed');
    await fixture.whenStable();
    expect(aside()).toBeNull();
    expect(page().querySelector('.inspector')).toBeNull();
  });

  it('beside the body on a wide screen: the host says so and nothing floats', async () => {
    fixture.componentInstance.aside.set('open');
    await fixture.whenStable();

    expect(page().dataset['aside']).toBe('beside');
    expect(getComputedStyle(aside() as HTMLElement).position).toBe('static');
    expect(getComputedStyle(body()).flexGrow).toBe('1');
  });

  it('over the body on a narrow screen: the host says so, and the aside floats inside the page', async () => {
    narrow.set(true);
    fixture.componentInstance.aside.set('open');
    await fixture.whenStable();

    expect(page().dataset['aside']).toBe('overlay');
    // The row below the tabs is the aside's containing block, so it floats over that box (not over
    // the tabs) and the body keeps its whole width (it is the only item left in the row).
    expect(getComputedStyle(content()).position).toBe('relative');
    expect(getComputedStyle(aside() as HTMLElement).position).toBe('absolute');
    // jsdom resolves no var() or min(), so the rest is asserted as the stylesheet's rule.
    expect(overlayAsideRule()).toMatch(/inset-block:\s*0;/);
    expect(overlayAsideRule()).toMatch(/inset-inline-end:\s*0;/);
    expect(overlayAsideRule()).toMatch(/z-index:\s*1;/);
    expect(overlayAsideRule()).toMatch(/width:\s*min\(var\(--neat-aside-width\),\s*100%\);/);
    expect(overlayAsideRule()).toMatch(/background:\s*var\(--background\);/);
    // The kit's raised-surface shadow, as its utility (the popover and the toast take theirs the same way).
    expect((aside() as HTMLElement).className).toContain('shadow-md');
  });

  describe('page tabs', () => {
    it('renders no row, and nothing above the content, on a page without tabs', async () => {
      expect(page().querySelector('nav')).toBeNull();
      expect([...page().children]).toEqual([content()]);
    });

    it('projects [neatPageTabs] as a row above the body and the side panel', async () => {
      const tabbed = TestBed.createComponent(TabbedHost);
      await tabbed.whenStable();

      const tabbedPage = tabbed.nativeElement.querySelector('neat-page') as HTMLElement;
      const tabs = tabbedPage.querySelector('nav') as HTMLElement;
      const row = tabbedPage.querySelector('.content') as HTMLElement;
      expect([...tabbedPage.children]).toEqual([tabs, row]);
      expect(row.contains(row.querySelector('.body'))).toBe(true);
      expect(row.contains(row.querySelector('aside'))).toBe(true);
      // The tabs are not part of the body: they neither scroll with it nor take its inset.
      expect(tabbedPage.querySelector('.body')?.contains(tabs)).toBe(false);
      expect(tabbedPage.querySelector('.body p')?.textContent).toBe('Long content');
    });

    it('stacks the tabs over the row, which takes the rest of the height', () => {
      expect(getComputedStyle(page()).flexDirection).toBe('column');
      expect(getComputedStyle(content()).flexGrow).toBe('1');
      // So the body can scroll inside the row instead of growing it.
      expect(getComputedStyle(content()).minHeight).toBe('0px');
    });

    it('floats the side panel inside the row, so on a phone it opens below the tabs', async () => {
      narrow.set(true);
      const tabbed = TestBed.createComponent(TabbedHost);
      await tabbed.whenStable();

      const tabbedPage = tabbed.nativeElement.querySelector('neat-page') as HTMLElement;
      const panel = tabbedPage.querySelector('aside') as HTMLElement;
      expect(tabbedPage.dataset['aside']).toBe('overlay');
      expect(getComputedStyle(panel).position).toBe('absolute');
      expect(panel.parentElement).toBe(tabbedPage.querySelector('.content'));
    });
  });

  it('follows the viewport when it is resized across the breakpoint', async () => {
    fixture.componentInstance.aside.set('open');
    await fixture.whenStable();
    expect(page().dataset['aside']).toBe('beside');

    narrow.set(true);
    await fixture.whenStable();
    expect(page().dataset['aside']).toBe('overlay');

    narrow.set(false);
    await fixture.whenStable();
    expect(page().dataset['aside']).toBe('beside');
  });

  it('keeps the aside closed by default', async () => {
    const plain = TestBed.createComponent(NeatPage);
    await plain.whenStable();

    expect(plain.nativeElement.querySelector('aside')).toBeNull();
  });

  describe('resizing the side panel', () => {
    const separator = (): HTMLElement | null =>
      page().querySelector<HTMLElement>('[role="separator"]');
    const host = (): Host => fixture.componentInstance;
    const attr = (name: string): string | null => separator()?.getAttribute(name) ?? null;

    /** The page and the panel as the browser would lay them out, reported to the observers. */
    async function layout(pageWidth: number, asideWidth = 352): Promise<void> {
      Object.defineProperty(page(), 'clientWidth', { configurable: true, value: pageWidth });
      const panel = aside();
      if (panel) {
        Object.defineProperty(panel, 'offsetWidth', { configurable: true, value: asideWidth });
      }
      FakeResizeObserver.instances.forEach((observer) => observer.fire());
      await fixture.whenStable();
    }

    async function open(pageWidth = 1000): Promise<void> {
      host().aside.set('open');
      await fixture.whenStable();
      await layout(pageWidth);
    }

    /** Presses a key on the separator; says whether the page took it (prevented the default). */
    function press(key: string): boolean {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      separator()?.dispatchEvent(event);
      return event.defaultPrevented;
    }

    function pointer(type: string, clientX: number, init: MouseEventInit = {}): void {
      separator()?.dispatchEvent(
        new MouseEvent(type, { clientX, button: 0, bubbles: true, cancelable: true, ...init }),
      );
    }

    /** The width the panel is asked to have, as the custom property the stylesheet reads. */
    const requested = (): string =>
      (aside() as HTMLElement).style.getPropertyValue('--neat-aside-width');

    it('has a separator only beside the body, while the panel is open', async () => {
      expect(separator()).toBeNull();

      await open();
      expect(separator()).not.toBeNull();

      narrow.set(true);
      await fixture.whenStable();
      expect(separator()).toBeNull();

      narrow.set(false);
      host().aside.set('closed');
      await fixture.whenStable();
      expect(separator()).toBeNull();
    });

    it('sits between the body and the panel, a tab stop that is a vertical separator', async () => {
      await open();

      expect(separator()?.previousElementSibling).toBe(body());
      expect(separator()?.nextElementSibling).toBe(aside());
      expect(attr('aria-orientation')).toBe('vertical');
      expect(attr('aria-label')).toBe('Resize side panel');
      expect(attr('tabindex')).toBe('0');
    });

    it('announces its value in pixels, bounded by 18rem and the page less 20rem', async () => {
      await open(1000);
      // The default panel as laid out, bounded by 18rem and by what leaves the body 20rem (320 px)
      // of a 1000 px page.
      expect(attr('aria-valuemin')).toBe('288');
      expect(attr('aria-valuemax')).toBe('680');
      expect(attr('aria-valuenow')).toBe('352');
      expect(attr('aria-valuetext')).toBe('352 px');
    });

    it('states no maximum before the page is measured, and leaves the keys to Home and End alone', async () => {
      host().aside.set('open');
      await fixture.whenStable();

      expect(separator()?.hasAttribute('aria-valuemax')).toBe(false);
      expect(aside()?.style.getPropertyValue('--neat-page-aside-max')).toBe('');
      expect(attr('aria-valuemin')).toBe('288');

      Object.defineProperty(aside(), 'offsetWidth', { configurable: true, value: 352 });
      press('End');
      expect(host().asideWidth()).toBeNull();
    });

    it('has no other cap: on a wide page the panel may grow until the body is 20rem', async () => {
      await open(2000);
      // Neither the old 48rem (768 px) nor a share of the page.
      expect(attr('aria-valuemax')).toBe('1680');

      host().asideWidth.set(1500);
      await fixture.whenStable();
      expect(attr('aria-valuenow')).toBe('1500');
    });

    it('counts the rem as the browser sets it, for the minimum and the body it keeps', async () => {
      document.documentElement.style.fontSize = '20px';
      try {
        await open(1500);
        // 18rem and 1500 px less 20rem, at 20 px a rem.
        expect(attr('aria-valuemin')).toBe('360');
        expect(attr('aria-valuemax')).toBe('1100');
      } finally {
        document.documentElement.style.fontSize = '';
      }
    });

    it('lets the panel keep the width the model asks for', async () => {
      await open();
      expect(requested()).toBe('');

      host().asideWidth.set(400);
      await fixture.whenStable();
      expect(requested()).toBe('400px');
      expect(attr('aria-valuenow')).toBe('400');

      host().asideWidth.set(null);
      await fixture.whenStable();
      expect(requested()).toBe('');
    });

    it('shows a width outside the bounds clamped and leaves the model alone', async () => {
      await open(1000);

      host().asideWidth.set(900);
      await fixture.whenStable();
      expect(attr('aria-valuenow')).toBe('680');
      expect(aside()?.style.getPropertyValue('--neat-page-aside-max')).toBe('680px');
      expect(aside()?.style.getPropertyValue('--neat-page-aside-min')).toBe('288px');

      host().asideWidth.set(100);
      await fixture.whenStable();
      expect(attr('aria-valuenow')).toBe('288');
      expect(host().asideWidth()).toBe(100);
    });

    it('re-clamps when the page is resized, without writing the model', async () => {
      host().asideWidth.set(500);
      await open(1200);
      expect(attr('aria-valuenow')).toBe('500');

      await layout(700);
      expect(attr('aria-valuemax')).toBe('380');
      expect(attr('aria-valuenow')).toBe('380');
      expect(aside()?.style.getPropertyValue('--neat-page-aside-max')).toBe('380px');
      expect(host().asideWidth()).toBe(500);

      // The remembered width comes back when the window does.
      await layout(1200);
      expect(attr('aria-valuenow')).toBe('500');
    });

    it('never lets the maximum fall below the minimum on a small page', async () => {
      await open(400);
      expect(attr('aria-valuemin')).toBe('288');
      expect(attr('aria-valuemax')).toBe('288');

      // 600 px less 20rem is 280 px, under the minimum: the minimum wins.
      await layout(600);
      expect(attr('aria-valuemax')).toBe('288');
    });

    it('watches the page and the panel only while the panel is open', async () => {
      await open();
      const observer = FakeResizeObserver.instances.find((each) => !each.disconnected);
      expect(observer?.observed).toContain(page());

      host().aside.set('closed');
      await fixture.whenStable();
      expect(FakeResizeObserver.instances.every((each) => each.disconnected)).toBe(true);
    });

    it("widens from the panel's own width before anything is measured", async () => {
      host().aside.set('open');
      await fixture.whenStable();
      Object.defineProperty(aside(), 'offsetWidth', { configurable: true, value: 352 });

      press('ArrowLeft');
      expect(host().asideWidth()).toBe(368);
    });

    it('does not watch the page on a narrow screen', async () => {
      narrow.set(true);
      host().aside.set('open');
      await fixture.whenStable();
      expect(FakeResizeObserver.instances.filter((each) => !each.disconnected)).toEqual([]);

      narrow.set(false);
      await fixture.whenStable();
      expect(FakeResizeObserver.instances.some((each) => !each.disconnected)).toBe(true);
    });

    it('widens with ArrowLeft and narrows with ArrowRight, 16 px a step', async () => {
      host().asideWidth.set(400);
      await open();

      expect(press('ArrowLeft')).toBe(true);
      expect(host().asideWidth()).toBe(416);
      expect(press('ArrowRight')).toBe(true);
      expect(press('ArrowRight')).toBe(true);
      expect(host().asideWidth()).toBe(384);
      await fixture.whenStable();
      expect(attr('aria-valuenow')).toBe('384');
    });

    it('starts from the width the default panel has', async () => {
      await open();
      press('ArrowLeft');
      expect(host().asideWidth()).toBe(368);
    });

    it('stops at the bounds', async () => {
      host().asideWidth.set(676);
      await open(1000);

      press('ArrowLeft');
      expect(host().asideWidth()).toBe(680);
      press('ArrowLeft');
      expect(host().asideWidth()).toBe(680);

      host().asideWidth.set(292);
      await fixture.whenStable();
      press('ArrowRight');
      expect(host().asideWidth()).toBe(288);
    });

    it('jumps to the minimum with Home and the maximum with End', async () => {
      await open(1000);

      press('Home');
      expect(host().asideWidth()).toBe(288);
      press('End');
      expect(host().asideWidth()).toBe(680);
    });

    it('leaves other keys alone', async () => {
      await open();

      expect(press('Tab')).toBe(false);
      expect(press('ArrowUp')).toBe(false);
      expect(host().asideWidth()).toBeNull();
    });

    it('resets to the default on a double click', async () => {
      host().asideWidth.set(450);
      await open();

      separator()?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(host().asideWidth()).toBeNull();
    });

    describe('dragging', () => {
      let capture: Mock<(pointerId: number) => void>;

      beforeEach(async () => {
        host().asideWidth.set(400);
        await open(1000);
        capture = vi.fn<(pointerId: number) => void>();
        (separator() as HTMLElement).setPointerCapture = capture;
      });

      it('follows the pointer live, left widening, and writes the model on release', async () => {
        pointer('pointerdown', 600);
        expect(capture).toHaveBeenCalled();

        pointer('pointermove', 550);
        await fixture.whenStable();
        expect(requested()).toBe('450px');
        expect(attr('aria-valuenow')).toBe('450');
        expect(host().asideWidth()).toBe(400);
        expect(page().hasAttribute('data-resizing')).toBe(true);

        pointer('pointermove', 650);
        await fixture.whenStable();
        expect(requested()).toBe('350px');

        pointer('pointerup', 650);
        await fixture.whenStable();
        expect(host().asideWidth()).toBe(350);
        expect(page().hasAttribute('data-resizing')).toBe(false);

        // Once released, the pointer no longer moves it.
        pointer('pointermove', 100);
        await fixture.whenStable();
        expect(requested()).toBe('350px');
      });

      it('keeps to the bounds while dragging', async () => {
        pointer('pointerdown', 600);
        pointer('pointermove', 0);
        await fixture.whenStable();
        expect(attr('aria-valuenow')).toBe('680');

        pointer('pointermove', 2000);
        await fixture.whenStable();
        expect(attr('aria-valuenow')).toBe('288');
      });

      it('drops the drag on a cancelled pointer', async () => {
        pointer('pointerdown', 600);
        pointer('pointermove', 500);
        pointer('pointercancel', 500);
        await fixture.whenStable();

        expect(host().asideWidth()).toBe(400);
        expect(requested()).toBe('400px');
        expect(page().hasAttribute('data-resizing')).toBe(false);
      });

      it('does not write the model for a click that moved nothing', async () => {
        host().asideWidth.set(null);
        await fixture.whenStable();

        pointer('pointerdown', 600);
        pointer('pointerup', 600);
        expect(host().asideWidth()).toBeNull();
      });

      it('ends the drag when the pointer capture is lost without a release', async () => {
        pointer('pointerdown', 600);
        pointer('pointermove', 500);
        separator()?.dispatchEvent(new Event('lostpointercapture', { bubbles: true }));
        await fixture.whenStable();
        expect(page().hasAttribute('data-resizing')).toBe(false);
        expect(host().asideWidth()).toBe(400);

        // Hovering afterwards does not move the panel.
        pointer('pointermove', 100);
        await fixture.whenStable();
        expect(requested()).toBe('400px');
      });

      it('clears the drag when the screen turns narrow mid-drag', async () => {
        pointer('pointerdown', 600);
        pointer('pointermove', 500);
        await fixture.whenStable();
        expect(page().hasAttribute('data-resizing')).toBe(true);

        narrow.set(true);
        await fixture.whenStable();
        expect(page().hasAttribute('data-resizing')).toBe(false);

        // Wide again, the panel has the model's width, not the abandoned drag's.
        narrow.set(false);
        await fixture.whenStable();
        expect(requested()).toBe('400px');
      });

      it('clears the drag when the panel closes mid-drag', async () => {
        pointer('pointerdown', 600);
        pointer('pointermove', 500);
        host().aside.set('closed');
        await fixture.whenStable();
        expect(page().hasAttribute('data-resizing')).toBe(false);

        host().aside.set('open');
        await fixture.whenStable();
        expect(requested()).toBe('400px');
      });

      it('ignores buttons other than the primary one', async () => {
        pointer('pointerdown', 600, { button: 2 });
        pointer('pointermove', 500);
        expect(requested()).toBe('400px');
        expect(capture).not.toHaveBeenCalled();
      });
    });

    it('asks nothing of the panel on a narrow screen: it keeps its own width there', async () => {
      host().asideWidth.set(500);
      await open();
      narrow.set(true);
      await fixture.whenStable();

      expect(requested()).toBe('');
      expect(aside()?.style.getPropertyValue('--neat-page-aside-max')).toBe('');
      expect(overlayAsideRule()).toMatch(/width:\s*min\(var\(--neat-aside-width\),\s*100%\);/);
    });

    describe('look', () => {
      const rule = (selector: string): string | undefined =>
        new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`).exec(pageStyles)?.[1];

      it('bounds the panel by what the page tells it, in one place', () => {
        expect(asideRule()).toMatch(
          /width:\s*clamp\(\s*var\(--neat-page-aside-min\),\s*var\(--neat-aside-width\),\s*var\(--neat-page-aside-max,\s*100%\)\s*\);/,
        );
      });

      it('has an 8 px hit area on the panel edge, a column-resize cursor, no touch scrolling', () => {
        const separatorRule = rule('\\.separator') ?? '';
        expect(separatorRule).toMatch(/width:\s*var\(--neat-space-2\);/);
        expect(separatorRule).toMatch(/margin-inline:\s*calc\(var\(--neat-space-2\)\s*\/\s*-2\);/);
        expect(separatorRule).toMatch(/cursor:\s*col-resize;/);
        expect(separatorRule).toMatch(/touch-action:\s*none;/);
        // Selection never starts at the handle.
        expect(separatorRule).toMatch(/user-select:\s*none;/);
      });

      it('keeps forced colours from boxing the handle, drawing its transparent outline on focus only', () => {
        // Forced-colors mode paints a transparent outline in a system colour, since it drops the
        // line's background: always, that would be a permanent box around the handle.
        expect(rule('\\.separator') ?? '').not.toMatch(/outline/);
        expect(rule('\\.separator:focus-visible') ?? '').toMatch(
          /outline:\s*var\(--neat-focus-ring-width\) solid transparent;/,
        );
      });

      it('shows its line on hover, on keyboard focus and while dragging, with tokens', () => {
        const line = rule('\\.separator::after') ?? '';
        expect(line).toMatch(/background:\s*var\(--ring\);/);
        expect(line).toMatch(/width:\s*var\(--neat-focus-ring-width\);/);
        expect(pageStyles).toMatch(
          new RegExp(
            '\\.separator:hover::after,\\s*\\.separator:focus-visible::after,\\s*' +
              ':host\\(\\[data-resizing\\]\\) \\.separator::after\\s*\\{[^}]*opacity:\\s*1;',
          ),
        );
      });

      it('fades its line only for a user who has not asked for reduced motion', () => {
        const motion = /@media \(prefers-reduced-motion: no-preference\)\s*\{([\s\S]*?)\n\}/.exec(
          pageStyles,
        )?.[1];
        expect(motion).toMatch(/\.separator::after\s*\{[^}]*transition:/);
        // No transition outside that query.
        expect(pageStyles.replace(motion ?? '', '')).not.toMatch(/transition:/);
      });
    });
  });
});
