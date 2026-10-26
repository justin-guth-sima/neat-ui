import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { NeatIcon } from '../icon/icon';
import { NeatViewport } from '../page/viewport';
import { NeatRailItem, RailState } from './rail-item';
import railItemStyles from './rail-item.css' with { loader: 'text' };

/** Items as an app puts them in the rail: the shell provides the rail's state to its content. */
@Component({
  imports: [NeatIcon, NeatRailItem, RouterLink],
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
    <button neatRailItem type="button" label="Dark theme" [pressed]="dark()">
      <neat-icon name="moon" />
    </button>
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
  readonly dark = signal<boolean | undefined>(undefined);
}

@Component({
  imports: [NeatIcon, NeatRailItem],
  template: `<button neatRailItem type="button" label="Lost"><neat-icon name="info" /></button>`,
})
class OutsideShell {}

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

  it('binds pressed as aria-pressed, absent while pressed is unset', async () => {
    const { fixture, host, item } = await render();
    expect(item('Dark theme').hasAttribute('aria-pressed')).toBe(false);

    host.dark.set(false);
    await fixture.whenStable();
    expect(item('Dark theme').getAttribute('aria-pressed')).toBe('false');

    host.dark.set(true);
    await fixture.whenStable();
    expect(item('Dark theme').getAttribute('aria-pressed')).toBe('true');
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
