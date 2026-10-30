import { Component, inject, reflectComponentType, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { NeatIcon } from '../icon/icon';
import { NeatViewport } from '../page/viewport';
import { contrastRatio, mixOklab } from '../theme/color';
import { spartanThemeTokens } from '../theme/spartan-theme';
import type { NeatTone } from '../theme/tone';
import { NeatRailDivider, NeatRailItem, RailState } from './rail-item';
import railItemStyles from './rail-item.css' with { loader: 'text' };

/** Items as an app puts them in the rail: the shell provides the rail's state to its content. */
@Component({
  imports: [NeatIcon, NeatRailDivider, NeatRailItem, RouterLink],
  providers: [RailState],
  template: `
    <button
      neatRailItem
      type="button"
      label="System information"
      (click)="clicks.set(clicks() + 1)"
    >
      <neat-icon name="info" />
    </button>
    <button neatRailItem type="button" label="Dark theme">
      <neat-icon name="moon" />
    </button>
    <hr neatRailDivider />
    <button neatRailItem type="button" label="DevKit, 192.168.100.2, connected" class="board">
      <neat-icon name="board" />
      <span neatRailItemLabel class="custom">DevKit <small>192.168.100.2</small></span>
    </button>
    <a neatRailItem routerLink="/help" label="Help"><neat-icon name="document" /></a>
  `,
})
class RailHost {
  readonly rail = inject(RailState);
  readonly clicks = signal(0);
}

/** Items with the kit's state: a dot's tone, a visible text of their own and a second line. */
@Component({
  imports: [NeatIcon, NeatRailItem],
  providers: [RailState],
  template: `
    <button
      neatRailItem
      type="button"
      label="DevKit, 192.168.100.2, connected"
      text="DevKit"
      detail="192.168.100.2"
      [tone]="tone()"
    >
      <neat-icon name="board" />
    </button>
    <button neatRailItem type="button" label="Modalix DevKit, connecting" text="Modalix DevKit">
      <neat-icon name="board" />
    </button>
    <button neatRailItem type="button" label="Gateway, connecting" detail="Connecting…">
      <neat-icon name="board" />
    </button>
    <button neatRailItem type="button" label="Search" aria-label="Search the media">
      <neat-icon name="info" />
    </button>
  `,
})
class StateHost {
  readonly rail = inject(RailState);
  readonly tone = signal<NeatTone | undefined>('success');
}

@Component({
  imports: [NeatIcon, NeatRailItem],
  template: `<button neatRailItem type="button" label="Lost"><neat-icon name="info" /></button>`,
})
class OutsideShell {}

const TONES: NeatTone[] = ['neutral', 'success', 'warning', 'danger', 'info', 'highlight'];

@Component({ template: 'help' })
class HelpPage {}

describe('NeatRailItem', () => {
  async function render() {
    const fixture = TestBed.createComponent(RailHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const item = (label: string): HTMLElement =>
      root.querySelector(`[neatRailItem][label="${label}"]`) as HTMLElement;
    const labelOf = (element: HTMLElement): HTMLElement =>
      element.querySelector('.label') as HTMLElement;
    return { fixture, host: fixture.componentInstance, item, labelOf };
  }

  const tooltip = (): HTMLElement | null => document.querySelector('[role="tooltip"]');
  /** A mouse entering `element`, laid out where a tooltip fits on its preferred side. */
  const hover = (element: HTMLElement): void => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    element.getBoundingClientRect = () => new DOMRect(492, 364, 40, 40);
    element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  };
  const tick = async (fixture: { whenStable(): Promise<unknown> }): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'help', component: HelpPage }])],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('collapsed: keeps its label as its name, visually hidden, and shows it as a tooltip on the right', async () => {
    const { fixture, item, labelOf } = await render();
    const info = item('System information');

    expect(labelOf(info).textContent?.trim()).toBe('System information');
    expect(labelOf(info).classList).toContain('sr-only');
    // The icon is decorative, so the label is the whole accessible name.
    expect(info.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(info.textContent?.trim()).toBe('System information');

    hover(info);
    await tick(fixture);

    expect(tooltip()?.textContent?.trim()).toBe('System information');
    expect(tooltip()?.getAttribute('data-side')).toBe('right');
  });

  it('expanded: shows its label beside the icon and no tooltip', async () => {
    const { fixture, host, item, labelOf } = await render();
    host.rail.set(true);
    await fixture.whenStable();
    const info = item('System information');

    expect(labelOf(info).classList).not.toContain('sr-only');

    hover(info);
    await tick(fixture);
    expect(tooltip()).toBeNull();
  });

  it('is the native button or link it sits on: its click is the app’s', async () => {
    const { fixture, host, item } = await render();

    item('System information').click();
    await fixture.whenStable();

    expect(host.clicks()).toBe(1);
    expect(item('Help').tagName).toBe('A');
    expect(item('Help').getAttribute('href')).toBe('/help');
  });

  it('has no pressed state: a rail item is an action whose label says what a click does', async () => {
    const { item } = await render();

    expect(item('Dark theme').hasAttribute('aria-pressed')).toBe(false);
    expect(reflectComponentType(NeatRailItem)!.inputs.map((input) => input.templateName)).toEqual([
      'label',
      'text',
      'detail',
      'tone',
    ]);
  });

  it('takes richer visible text from [neatRailItemLabel], the label staying its tooltip', async () => {
    const { fixture, item, labelOf } = await render();
    const board = item('DevKit, 192.168.100.2, connected');

    expect(labelOf(board).querySelector('.custom')?.textContent).toBe('DevKit 192.168.100.2');
    // The custom text replaces the default one; the icon stays outside the label.
    expect(labelOf(board).textContent?.trim()).toBe('DevKit 192.168.100.2');
    expect(labelOf(board).querySelector('svg')).toBeNull();
    expect(labelOf(board).classList).toContain('sr-only');

    hover(board);
    await tick(fixture);
    expect(tooltip()?.textContent?.trim()).toBe('DevKit, 192.168.100.2, connected');
  });

  it('without the state inputs, has no dot, no second line and no name of its own', async () => {
    const { item, labelOf } = await render();

    for (const label of ['System information', 'Help']) {
      const plain = item(label);
      expect(plain.querySelector('.dot'), label).toBeNull();
      expect(plain.hasAttribute('data-tone'), label).toBe(false);
      expect(plain.hasAttribute('aria-label'), label).toBe(false);
      expect(labelOf(plain).children.length, label).toBe(0);
      expect(labelOf(plain).textContent?.trim(), label).toBe(label);
    }
  });

  describe('with a state', () => {
    async function renderState() {
      const fixture = TestBed.createComponent(StateHost);
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const item = (label: string): HTMLElement =>
        root.querySelector(`[neatRailItem][label="${label}"]`) as HTMLElement;
      const lines = (element: HTMLElement): (string | undefined)[] =>
        Array.from(element.querySelectorAll('.label .line'), (line) => line.textContent?.trim());
      return { fixture, host: fixture.componentInstance, item, lines };
    }

    /**
     * The name the item's content gives it, as assistive technology computes it for a button or a
     * link without an `aria-label`: its text, less what is `aria-hidden`.
     */
    function nameFromContent(element: Element): string {
      const parts: string[] = [];
      const walk = (node: Node): void => {
        if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') return;
        if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent ?? '');
        node.childNodes.forEach(walk);
      };
      walk(element);
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }

    it('draws a dot on its icon only with a tone, which the host names in data-tone', async () => {
      const { fixture, host, item } = await renderState();
      const board = item('DevKit, 192.168.100.2, connected');

      for (const tone of TONES) {
        host.tone.set(tone);
        await fixture.whenStable();
        expect(board.getAttribute('data-tone')).toBe(tone);
        const dot = board.querySelector('.icon > .dot');
        expect(dot, tone).not.toBeNull();
        // The words say the state; the dot repeats it.
        expect(dot?.getAttribute('aria-hidden')).toBe('true');
      }

      host.tone.set(undefined);
      await fixture.whenStable();
      expect(board.hasAttribute('data-tone')).toBe(false);
      expect(board.querySelector('.dot')).toBeNull();
    });

    it('shows its text, then its detail, as two lines of the label, hidden with it', async () => {
      const { fixture, host, item, lines } = await renderState();
      const board = item('DevKit, 192.168.100.2, connected');

      expect(lines(board)).toEqual(['DevKit', '192.168.100.2']);
      expect(board.querySelector('.label .line.detail')?.textContent?.trim()).toBe('192.168.100.2');
      expect(board.querySelector('.label')?.classList).toContain('sr-only');

      host.rail.set(true);
      await fixture.whenStable();
      expect(board.querySelector('.label')?.classList).not.toContain('sr-only');
    });

    it('shows its label as the first line when it has a detail and no text', async () => {
      const { item, lines } = await renderState();

      expect(lines(item('Gateway, connecting'))).toEqual(['Gateway, connecting', 'Connecting…']);
    });

    it('shows its text alone, on one line, when it has no detail', async () => {
      const { item, lines } = await renderState();

      expect(lines(item('Modalix DevKit, connecting'))).toEqual(['Modalix DevKit']);
    });

    it('keeps its label as its name and tooltip when the visible text differs', async () => {
      const { fixture, item } = await renderState();

      for (const label of [
        'DevKit, 192.168.100.2, connected',
        'Modalix DevKit, connecting',
        'Gateway, connecting',
      ]) {
        // Named by its content, not an aria-label of the kit's, which would take the place of one
        // the app sets.
        expect(item(label).hasAttribute('aria-label'), label).toBe(false);
        expect(nameFromContent(item(label)), label).toBe(label);
      }

      const board = item('DevKit, 192.168.100.2, connected');
      hover(board);
      await tick(fixture);
      expect(tooltip()?.textContent?.trim()).toBe('DevKit, 192.168.100.2, connected');
    });

    it('leaves an aria-label the app sets as the name', async () => {
      const { item } = await renderState();

      expect(item('Search').getAttribute('aria-label')).toBe('Search the media');
      expect(nameFromContent(item('Search'))).toBe('Search');
    });
  });

  describe('its state colours, from the stylesheet and the emitted theme tokens', () => {
    /** The custom properties a `:host([data-tone='…'])` block of the stylesheet sets. */
    function toneBlock(tone: NeatTone): Record<string, string> {
      const block = new RegExp(`:host\\(\\[data-tone='${tone}'\\]\\)\\s*\\{([^}]*)\\}`).exec(
        railItemStyles,
      );
      expect(block, tone).not.toBeNull();
      return Object.fromEntries(
        Array.from(block![1].matchAll(/(--[\w-]+):\s*([^;]+);/g), ([, name, value]) => [
          name,
          value.trim(),
        ]),
      );
    }

    /** A colour the stylesheet writes: a token, or a `color-mix` in OKLab of two tokens. */
    function resolve(value: string, tokens: Record<string, string>): string {
      const token = /^var\(--([\w-]+)\)$/.exec(value);
      if (token) return tokens[token[1]];
      const mix = /^color-mix\(in oklab, var\(--([\w-]+)\) (\d+)%, var\(--([\w-]+)\)\)$/.exec(
        value,
      );
      if (mix) return mixOklab(tokens[mix[1]], Number(mix[2]) / 100, tokens[mix[3]]);
      throw new Error(`Cannot resolve ${value}`);
    }

    for (const scheme of ['light', 'dark'] as const) {
      const tokens = spartanThemeTokens(scheme) as Record<string, string>;
      const surfaces = ['sidebar', 'sidebar-accent'];

      it(`${scheme}: each tone’s detail text reaches 4.5:1 on the rail and on its fills`, () => {
        for (const tone of TONES) {
          const detail = resolve(toneBlock(tone)['--rail-item-detail'], tokens);
          for (const surface of surfaces) {
            expect(
              contrastRatio(detail, tokens[surface]),
              `${tone} on --${surface}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      });

      it(`${scheme}: each tone’s dot reaches 3:1 on its ring`, () => {
        for (const tone of TONES) {
          const dot = resolve(toneBlock(tone)['--rail-item-dot'], tokens);
          for (const surface of surfaces) {
            expect(
              contrastRatio(dot, tokens[surface]),
              `${tone} on --${surface}`,
            ).toBeGreaterThanOrEqual(3);
          }
        }
      });
    }

    it('draws the dot at the icon’s corner with a ring of the surface it sits on', () => {
      expect(railItemStyles).toMatch(
        /\.dot\s*\{[^}]*inset-block-end:\s*-0\.125rem;[^}]*inset-inline-end:\s*-0\.125rem;[^}]*inline-size:\s*0\.5rem;[^}]*block-size:\s*0\.5rem;[^}]*box-shadow:\s*0 0 0 0\.125rem var\(--rail-item-surface\);/,
      );
      expect(railItemStyles).toMatch(/:host\s*\{[^}]*--rail-item-surface:\s*var\(--sidebar\);/);
      expect(railItemStyles).toMatch(
        /:host\(:hover\),\s*:host\(\[aria-current='page'\]\)\s*\{[^}]*--rail-item-surface:\s*var\(--sidebar-accent\);/,
      );
    });
  });

  it('is the containing block of its hidden label, which would otherwise escape a scrolling rail', async () => {
    const { item, labelOf } = await render();
    const info = item('System information');

    expect(labelOf(info).classList).toContain('sr-only');
    expect(getComputedStyle(info).position).toBe('relative');
  });

  it('marks the current page with the rail’s selection fill, from aria-current', async () => {
    // The look is stated once, in the item's stylesheet, for the shell's page links and the app's
    // items alike.
    expect(railItemStyles).toMatch(
      /:host\(:hover\),\s*:host\(\[aria-current='page'\]\)\s*\{[^}]*background:\s*var\(--sidebar-accent\);/,
    );
    expect(railItemStyles).toMatch(/:host\(:focus-visible\)\s*\{[^}]*var\(--sidebar-ring\)/);
  });

  describe('on a narrow screen, where the rail floats over the page', () => {
    beforeEach(() => {
      TestBed.overrideProvider(NeatViewport, { useValue: { narrow: signal(true) } });
    });

    it('puts the rail away when a link is followed', async () => {
      const { fixture, host, item } = await render();
      host.rail.set(true);
      await fixture.whenStable();

      item('Help').click();
      await fixture.whenStable();

      expect(host.rail.expanded()).toBe(false);
    });

    it('leaves the rail open for a button, whose action may want it (a theme switch)', async () => {
      const { fixture, host, item } = await render();
      host.rail.set(true);
      await fixture.whenStable();

      item('System information').click();
      await fixture.whenStable();

      expect(host.rail.expanded()).toBe(true);
    });
  });

  it('says where it belongs when used outside the shell’s rail', async () => {
    expect(() => TestBed.createComponent(OutsideShell)).toThrow(/neatRailItem.*neat-shell/);
  });
});

describe('NeatRailDivider', () => {
  it('is a line in the rail’s colours, a quarter step from the items around it, and decorative', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(RailHost);
    await fixture.whenStable();
    const divider = (fixture.nativeElement as HTMLElement).querySelector('hr') as HTMLElement;

    // jsdom applies no Tailwind: the look is its classes, stated once on the directive.
    expect([...divider.classList]).toEqual(
      expect.arrayContaining([
        'mx-0',
        'my-1',
        'h-0',
        'shrink-0',
        'border-t',
        'border-sidebar-border',
      ]),
    );
    // The items' names say what they are; a separator between them would only add noise.
    expect(divider.getAttribute('aria-hidden')).toBe('true');
  });
});
