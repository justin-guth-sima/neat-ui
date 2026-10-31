import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEAT_DIAGRAM_MESSAGE_DEFAULTS, type NeatDiagramMessageSettings } from './messages';
import { NeatDiagramAnimationSettings, neatParseMessageSettings } from './animation-settings';

@Component({
  imports: [NeatDiagramAnimationSettings],
  template: `<neat-diagram-animation-settings [(settings)]="settings" />`,
})
class Host {
  readonly settings = signal<NeatDiagramMessageSettings>(NEAT_DIAGRAM_MESSAGE_DEFAULTS);
}

class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

const key = (element: HTMLElement, name: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

describe('NeatDiagramAnimationSettings', () => {
  const panel = (): HTMLElement | null => document.querySelector('[role="dialog"]');

  async function render(initial: NeatDiagramMessageSettings = NEAT_DIAGRAM_MESSAGE_DEFAULTS) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.settings.set(initial);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const trigger = root.querySelector<HTMLButtonElement>('[neatPopoverTrigger]')!;
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    trigger.getBoundingClientRect = () => new DOMRect(472, 368, 32, 32);
    trigger.click();
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    }
    const thumb = (name: string) =>
      panel()!.querySelector<HTMLElement>(`[role="slider"][aria-label^="${name}"]`)!;
    return { fixture, host: fixture.componentInstance, trigger, thumb };
  }

  beforeEach(() => vi.stubGlobal('ResizeObserver', NoopResizeObserver));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('is a button named Animation that opens a panel of the same name', async () => {
    const { trigger } = await render();
    expect(trigger.getAttribute('aria-label')).toBe('Animation');
    expect(panel()?.getAttribute('aria-label')).toBe('Animation');
  });

  it('shows the settings: speed, size, messages per dot and the steps switch', async () => {
    const { thumb } = await render({ speed: 400, size: 1.5, every: 3, steps: false });
    const rows = Array.from(panel()!.querySelectorAll('.row'), (row) =>
      Array.from(row.querySelectorAll('span'), (span) => span.textContent),
    );
    expect(rows).toEqual([
      ['Speed', '400 px/s'],
      ['Dot size', '× 1.5'],
      ['Messages per dot', '1 dot = 3 msgs'],
    ]);
    expect(thumb('Speed').getAttribute('aria-valuenow')).toBe('400');
    expect(panel()!.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('false');
  });

  it('says "1 dot = 1 msg" for one message per dot', async () => {
    await render();
    expect(panel()!.textContent).toContain('1 dot = 1 msg');
    expect(panel()!.textContent).not.toContain('1 msgs');
  });

  it('gives each slider the demo’s range', async () => {
    const { thumb } = await render();
    const range = (name: string) => {
      const t = thumb(name);
      return ['aria-valuemin', 'aria-valuemax'].map((a) => Number(t.getAttribute(a)));
    };
    expect(range('Speed')).toEqual([50, 1000]);
    expect(range('Dot size')).toEqual([0.5, 2]);
    expect(range('Messages per dot')).toEqual([1, 10]);
  });

  it('writes a slider’s change back into the model, keeping the other settings', async () => {
    const { fixture, host, thumb } = await render();
    key(thumb('Speed'), 'ArrowRight');
    await fixture.whenStable();
    expect(host.settings()).toEqual({ ...NEAT_DIAGRAM_MESSAGE_DEFAULTS, speed: 280 });
    key(thumb('Messages per dot'), 'ArrowRight');
    await fixture.whenStable();
    expect(host.settings()).toEqual({ ...NEAT_DIAGRAM_MESSAGE_DEFAULTS, speed: 280, every: 2 });
    expect(panel()!.textContent).toContain('1 dot = 2 msgs');
  });

  it('writes the switch into the model as steps', async () => {
    const { fixture, host } = await render();
    panel()!.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
    await fixture.whenStable();
    expect(host.settings().steps).toBe(false);
  });

  it('resets every setting to the defaults', async () => {
    const { fixture, host } = await render({ speed: 900, size: 2, every: 7, steps: false });
    const reset = Array.from(panel()!.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Reset to defaults',
    )!;
    reset.click();
    await fixture.whenStable();
    expect(host.settings()).toEqual(NEAT_DIAGRAM_MESSAGE_DEFAULTS);
  });
});

describe('neatParseMessageSettings', () => {
  it('gives the defaults for anything that is no object', () => {
    for (const raw of [undefined, null, 'x', 3, []]) {
      expect(neatParseMessageSettings(raw)).toEqual(NEAT_DIAGRAM_MESSAGE_DEFAULTS);
    }
  });

  it('keeps known keys of the right type, clamped, and rounds the whole-number one', () => {
    expect(
      neatParseMessageSettings({ speed: 5000, size: 0.1, every: 2.6, steps: false, old: 1 }),
    ).toEqual({ speed: 1000, size: 0.5, every: 3, steps: false });
  });

  it('takes the default for a value of the wrong type or not finite', () => {
    expect(
      neatParseMessageSettings({ speed: '300', size: Number.NaN, every: Infinity, steps: 1 }),
    ).toEqual(NEAT_DIAGRAM_MESSAGE_DEFAULTS);
  });
});
