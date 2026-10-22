import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import helmSlider from '../ui/slider/src/lib/hlm-slider.ts?source' with { loader: 'text' };
import { contrastRatio } from '../theme/color';
import { MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from '../theme/contrast-rules';
import { spartanThemeTokens } from '../theme/spartan-theme';
import { stateColor } from '../theme/state-colors';
import type { NeatColorScheme } from '../theme/theme.service';
import { NeatSlider, SLIDER_HELM_CLASSES } from './slider';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const SURFACES = ['background', 'card'] as const;

/** The variants on the slider's colour classes. */
const VOCABULARY = {
  dark: 'dark',
  hover: 'hover',
  'focus-visible': 'focus',
};

@Component({
  imports: [NeatSlider],
  template: `
    <neat-slider
      label="Tile width"
      [min]="120"
      [max]="480"
      [step]="10"
      [disabled]="disabled()"
      [(value)]="width"
      (valueChange)="changes.push($event)"
    />
  `,
})
class SliderHost {
  readonly width = signal(240);
  readonly disabled = signal(false);
  readonly changes: number[] = [];
}

/** Pointer capture is what brain's track checks while dragging; jsdom has none. */
function stubPointerCapture(element: HTMLElement): void {
  const captured = new Set<number>();
  element.setPointerCapture = (id) => captured.add(id);
  element.releasePointerCapture = (id) => captured.delete(id);
  element.hasPointerCapture = (id) => captured.has(id);
}

const pointer = (type: string, clientX: number) =>
  new PointerEvent(type, { clientX, pointerId: 1, bubbles: true });

/** Brain sizes the thumb through a ResizeObserver, which jsdom lacks; nothing here needs sizes. */
class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

async function render(setup: (host: SliderHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(SliderHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement.querySelector('neat-slider');
  const thumb = root.querySelector<HTMLElement>('[role="slider"]')!;
  const track = root.querySelector<HTMLElement>('[data-slot="slider-track"]')!;
  const range = root.querySelector<HTMLElement>('[data-slot="slider-range"]')!;
  return { fixture, host: fixture.componentInstance, root, thumb, track, range };
}

const key = (element: HTMLElement, name: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

describe('NeatSlider', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', NoopResizeObserver));
  afterEach(() => vi.unstubAllGlobals());

  it('exposes one slider thumb named by label, with its value and range', async () => {
    const { root, thumb } = await render();

    expect(root.querySelectorAll('[role="slider"]')).toHaveLength(1);
    expect(thumb.getAttribute('aria-label')).toBe('Tile width');
    expect(thumb.getAttribute('aria-valuenow')).toBe('240');
    expect(thumb.getAttribute('aria-valuemin')).toBe('120');
    expect(thumb.getAttribute('aria-valuemax')).toBe('480');
  });

  it('follows the bound value', async () => {
    const { fixture, host, thumb } = await render();

    host.width.set(400);
    await fixture.whenStable();

    expect(thumb.getAttribute('aria-valuenow')).toBe('400');
  });

  it('keyboard: arrows step by step, Home and End jump to the ends, each writing the value back', async () => {
    const { fixture, host, thumb } = await render();
    expect(thumb.tabIndex).toBe(0);

    key(thumb, 'ArrowRight');
    await fixture.whenStable();
    expect(host.width()).toBe(250);
    expect(thumb.getAttribute('aria-valuenow')).toBe('250');

    key(thumb, 'ArrowLeft');
    key(thumb, 'ArrowLeft');
    await fixture.whenStable();
    expect(host.width()).toBe(230);

    key(thumb, 'End');
    await fixture.whenStable();
    expect(host.width()).toBe(480);

    key(thumb, 'Home');
    await fixture.whenStable();
    expect(host.width()).toBe(120);
    expect(host.changes).toEqual([250, 240, 230, 480, 120]);
  });

  it('emits continuously while dragging, before the pointer is released', async () => {
    const { fixture, host, track } = await render();
    // 360 px for 120..480: one pixel is one unit, snapped to steps of 10.
    track.getBoundingClientRect = () => new DOMRect(0, 0, 360, 6);
    stubPointerCapture(track);

    track.dispatchEvent(pointer('pointerdown', 180));
    track.dispatchEvent(pointer('pointermove', 200));
    track.dispatchEvent(pointer('pointermove', 260));
    await fixture.whenStable();

    expect(host.changes).toEqual([300, 320, 380]);
    expect(host.width()).toBe(380);

    track.dispatchEvent(pointer('pointerup', 260));
    track.dispatchEvent(pointer('pointermove', 300));
    await fixture.whenStable();
    expect(host.changes).toEqual([300, 320, 380]);
  });

  it('disabled takes the thumb out of the tab order and ignores keys and pointers', async () => {
    const { fixture, host, root, thumb, track } = await render((host) => host.disabled.set(true));
    track.getBoundingClientRect = () => new DOMRect(0, 0, 360, 6);
    stubPointerCapture(track);

    expect(thumb.tabIndex).toBe(-1);
    expect(root.getAttribute('aria-disabled')).toBe('true');
    expect(root.hasAttribute('data-disabled')).toBe(true);

    key(thumb, 'ArrowRight');
    track.dispatchEvent(pointer('pointerdown', 300));
    await fixture.whenStable();
    expect(host.width()).toBe(240);
    expect(host.changes).toEqual([]);
  });

  it('draws the slider with helm’s classes', async () => {
    const { root, track, range, thumb } = await render();

    expect([...root.classList]).toEqual(expect.arrayContaining(['group', 'touch-none']));
    expect(track.classList).toContain('rounded-full');
    expect(range.classList).toContain('bg-primary');
    expect([...thumb.classList]).toEqual(
      expect.arrayContaining(['border-primary', 'size-4', 'focus-visible:ring-4']),
    );
  });

  it('helm drift: the copied class strings still appear in the vendored helm slider', () => {
    for (const [part, classes] of Object.entries(SLIDER_HELM_CLASSES)) {
      expect(helmSlider, part).toContain(classes);
    }
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const q = (on: string[], box?: string) => ({ tokens, vocabulary: VOCABULARY, on, box });
      const on = (...states: string[]) => (scheme === 'dark' ? ['dark', ...states] : states);

      it(`${scheme}: the filled range and the thumb's outline reach ${MIN_NON_TEXT_CONTRAST}:1 against background and card`, async () => {
        const { range, thumb } = await render();
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const fill = stateColor([...range.classList], 'bg', q(on()), under);
          const outline = stateColor([...thumb.classList], 'border', q(on()), under);
          expect(
            contrastRatio(fill, under),
            `${scheme}, range on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          expect(
            contrastRatio(outline, under),
            `${scheme}, thumb outline on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });

      it(`${scheme}: the thumb stands out at ${MIN_NON_TEXT_CONTRAST}:1 at the end of the filled range and on the empty track`, async () => {
        const { range, thumb, track } = await render();
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const fill = stateColor([...range.classList], 'bg', q(on()), under);
          const rail = stateColor([...track.classList], 'bg', q(on()), under);
          const knob = stateColor([...thumb.classList], 'bg', q(on()), fill);
          const outline = stateColor([...thumb.classList], 'border', q(on()), rail);
          expect(
            contrastRatio(knob, fill),
            `${scheme}, thumb ${knob} on range ${fill}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          expect(
            contrastRatio(outline, rail),
            `${scheme}, thumb outline ${outline} on track ${rail}, over --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });

      it(`${scheme}: the empty track stays visible (${MIN_FILL_CONTRAST}:1) against background and card`, async () => {
        const { track } = await render();
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const rail = stateColor([...track.classList], 'bg', q(on()), under);
          expect(
            contrastRatio(rail, under),
            `${scheme}, track ${rail} on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
        }
      });

      it(`${scheme}: the focus ring reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card`, async () => {
        const { thumb } = await render();
        expect(thumb.classList).toContain('focus-visible:ring-4');
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const ring = stateColor([...thumb.classList], 'ring', q(on('focus')), under);
          expect(
            contrastRatio(ring, under),
            `${scheme}, ring ${ring} on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });
    }
  });
});
