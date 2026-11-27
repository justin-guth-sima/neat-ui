import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ARC_RADIUS, arcPath, GAUGE_VIEW, gaugeShare, ZONE_RADIUS } from './arc';
import { NeatGauge } from './gauge';
import type { NeatGaugeZones } from './zones';
import css from './gauge.css' with { loader: 'text' };

@Component({
  imports: [NeatGauge],
  template: `
    <neat-gauge
      [value]="value()"
      [min]="min()"
      [max]="max()"
      [unit]="unit()"
      label="Reply speed"
      [showLabel]="showLabel()"
      [digits]="digits()"
      [zones]="zones()"
      [easing]="'linear'"
    />
  `,
})
class GaugeHost {
  readonly value = signal<number | null>(42);
  readonly min = signal(0);
  readonly max = signal(60);
  readonly unit = signal('tokens/s');
  readonly showLabel = signal(false);
  readonly digits = signal(0);
  readonly zones = signal<NeatGaugeZones | null>(null);
}

/** The attributes a meter has and a gauge without a valid value leaves out. */
const ARIA_VALUES = ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext'];

/**
 * What the reading over the drawing says, unless it is hidden: its figure and its unit, each a box
 * of its own that a screen reader reads apart.
 */
function reading(gauge: HTMLElement): string | null {
  const element = gauge.querySelector('.reading');
  if (!element || element.getAttribute('aria-hidden') === 'true') return null;
  return [...element.children].map((child) => child.textContent?.trim()).join(' ');
}

/** `matchMedia` answering the reduced-motion query as told. */
function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: reduce, media: query })),
  );
}

async function render(setup: (host: GaugeHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(GaugeHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const gauge: HTMLElement = fixture.nativeElement.querySelector('neat-gauge');
  const valueArc = () => gauge.querySelector('path.value')?.getAttribute('d') ?? null;
  const figure = () => gauge.querySelector('neat-eased-number')?.textContent?.trim();
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, host: fixture.componentInstance, gauge, valueArc, figure, settle };
}

describe('NeatGauge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is a meter named by its label, with its range, its value and the value in words', async () => {
    const { gauge } = await render();

    expect(gauge.getAttribute('role')).toBe('meter');
    expect(gauge.getAttribute('aria-label')).toBe('Reply speed');
    expect(gauge.getAttribute('aria-valuemin')).toBe('0');
    expect(gauge.getAttribute('aria-valuemax')).toBe('60');
    expect(gauge.getAttribute('aria-valuenow')).toBe('42');
    expect(gauge.getAttribute('aria-valuetext')).toBe('42 tokens/s of 60');
  });

  it('words the value with its digits, and without a unit when it has none', async () => {
    const { gauge, host, settle } = await render((h) => {
      h.value.set(41.66);
      h.digits.set(1);
    });

    expect(gauge.getAttribute('aria-valuetext')).toBe('41.7 tokens/s of 60.0');
    host.unit.set('');
    await settle();
    expect(gauge.getAttribute('aria-valuetext')).toBe('41.7 of 60.0');
  });

  it('adds the zone to the words while the value is in one', async () => {
    const { gauge, host, settle } = await render((h) => {
      h.min.set(0);
      h.max.set(110);
      h.unit.set('°C');
      h.zones.set({ warning: 85, danger: 100 });
      h.value.set(62);
    });

    expect(gauge.getAttribute('aria-valuetext')).toBe('62 °C of 110');
    host.value.set(85);
    await settle();
    expect(gauge.getAttribute('aria-valuetext')).toBe('85 °C of 110, warning');
    host.value.set(104);
    await settle();
    expect(gauge.getAttribute('aria-valuetext')).toBe('104 °C of 110, danger');
  });

  it('is no meter while there is no value, or one that is no number: a group named by its label, its "–" readable', async () => {
    const { gauge, host, valueArc, figure, settle } = await render((h) => h.value.set(null));
    const notAMeter = () => {
      // ARIA 1.2 requires aria-valuenow on a meter, so without a value the host is a group.
      expect(gauge.getAttribute('role')).toBe('group');
      expect(gauge.getAttribute('aria-label')).toBe('Reply speed');
      for (const name of ARIA_VALUES) expect(gauge.hasAttribute(name), name).toBe(false);
      expect(figure()).toBe('–');
      expect(reading(gauge)).toBe('– tokens/s');
      expect(valueArc()).toBeNull();
    };

    notAMeter();
    // The track is drawn, so an empty gauge still shows its range.
    expect(gauge.querySelector('path.track')?.getAttribute('d')).toBe(arcPath(0, 1, ARC_RADIUS));

    host.value.set(Number.NaN);
    await settle();
    notAMeter();
    host.value.set(Infinity);
    await settle();
    notAMeter();

    // A value again: a meter with all of its values, the reading hidden as the words say it.
    host.value.set(12);
    await settle();
    expect(gauge.getAttribute('role')).toBe('meter');
    expect(gauge.getAttribute('aria-valuenow')).toBe('12');
    expect(gauge.getAttribute('aria-valuetext')).toBe('12 tokens/s of 60');
    expect(gauge.querySelector('.reading')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('holds a value outside the range to it on the arc and in aria-valuenow, and says the value itself', async () => {
    stubReducedMotion(true);
    const { gauge, host, valueArc, figure, settle } = await render((h) => h.value.set(75));

    expect(gauge.getAttribute('aria-valuenow')).toBe('60');
    expect(gauge.getAttribute('aria-valuetext')).toBe('75 tokens/s of 60');
    expect(figure()).toBe('75');
    expect(valueArc()).toBe(arcPath(0, 1, ARC_RADIUS));

    // Below min, the arc is empty and draws nothing (a round cap would draw a dot).
    host.value.set(-3);
    await settle();
    expect(gauge.getAttribute('aria-valuenow')).toBe('0');
    expect(gauge.getAttribute('aria-valuetext')).toBe('-3 tokens/s of 60');
    expect(valueArc()).toBeNull();
  });

  it('draws no arc and no zones for a range that is none, is no meter then, and says so once in dev mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { gauge, host, valueArc, figure, settle } = await render((h) => {
      h.min.set(60);
      h.max.set(60);
      h.zones.set({ warning: 40 });
    });

    expect(valueArc()).toBeNull();
    expect(gauge.querySelectorAll('path.zone')).toHaveLength(0);
    expect(gauge.getAttribute('role')).toBe('group');
    expect(gauge.getAttribute('aria-label')).toBe('Reply speed');
    for (const name of ARIA_VALUES) expect(gauge.hasAttribute(name), name).toBe(false);
    // The value is still read, from the figure and its unit.
    expect(figure()).toBe('42');
    expect(reading(gauge)).toBe('42 tokens/s');

    host.value.set(43);
    host.max.set(0);
    await settle();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('neat-gauge');

    // A range again: a meter, with the arc and all of its values.
    host.max.set(120);
    host.min.set(0);
    await settle();
    expect(gauge.getAttribute('role')).toBe('meter');
    expect(gauge.getAttribute('aria-valuemin')).toBe('0');
    expect(gauge.getAttribute('aria-valuemax')).toBe('120');
    expect(gauge.getAttribute('aria-valuenow')).toBe('43');
    expect(gauge.getAttribute('aria-valuetext')).toBe('43 tokens/s of 120, warning');
    expect(valueArc()).toBe(arcPath(0, gaugeShare(43, 0, 120)!, ARC_RADIUS));
  });

  it("words the range with the value's digits, in the ends and in the words", async () => {
    const { gauge } = await render((h) => {
      h.unit.set('V');
      h.max.set(0.1 + 0.2);
      h.value.set(0.2);
      h.digits.set(2);
    });

    expect(gauge.getAttribute('aria-valuetext')).toBe('0.20 V of 0.30');
    expect([...gauge.querySelectorAll('.end')].map((end) => end.textContent?.trim())).toEqual([
      '0.00',
      '0.30',
    ]);
  });

  it("draws the zones as thin arcs outside the gauge track in the threshold lines' tokens", async () => {
    const { gauge } = await render((h) => {
      h.max.set(110);
      h.zones.set({ warning: 85, danger: 100 });
    });
    const zones = [...gauge.querySelectorAll<SVGPathElement>('path.zone')];

    expect(zones.map((zone) => zone.getAttribute('data-zone'))).toEqual(['warning', 'danger']);
    expect(zones.map((zone) => zone.getAttribute('d'))).toEqual([
      arcPath(85 / 110, 100 / 110, ZONE_RADIUS),
      arcPath(100 / 110, 1, ZONE_RADIUS),
    ]);
    expect(css).toMatch(
      /\.zone\[data-zone='warning'\]\s*\{[^}]*stroke: var\(--neat-line-warning\)/,
    );
    expect(css).toMatch(/\.zone\[data-zone='danger'\]\s*\{[^}]*stroke: var\(--neat-line-danger\)/);
    expect(css).toMatch(/\.track\s*\{[^}]*stroke: var\(--neat-gauge-track\)/);
    expect(css).toMatch(/\.value\s*\{[^}]*stroke: var\(--neat-line\)/);
  });

  it('shows the figure as an eased number with its digits, the unit beside it and the range below', async () => {
    const { gauge, figure } = await render((h) => {
      h.value.set(12.34);
      h.digits.set(1);
    });

    expect(figure()).toBe('12.3');
    expect(gauge.querySelector('.unit')?.textContent?.trim()).toBe('tokens/s');
    expect([...gauge.querySelectorAll('.end')].map((end) => end.textContent?.trim())).toEqual([
      '0.0',
      '60.0',
    ]);
    // The drawing and the figure are hidden: the meter says all of it in words.
    expect(gauge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the label as a title only with showLabel', async () => {
    const { gauge, host, settle } = await render();

    expect(gauge.querySelector('.label')).toBeNull();
    host.showLabel.set(true);
    await settle();
    expect(gauge.querySelector('.label')?.textContent?.trim()).toBe('Reply speed');
  });

  it('keeps the proportions of its drawing', async () => {
    const { gauge } = await render();
    const dial = gauge.querySelector<HTMLElement>('.dial')!;

    expect(gauge.querySelector('svg')?.getAttribute('viewBox')).toBe(
      `0 0 ${GAUGE_VIEW.width} ${GAUGE_VIEW.height}`,
    );
    expect(dial.style.aspectRatio.replace(/\s/g, '')).toBe(
      `${GAUGE_VIEW.width}/${GAUGE_VIEW.height}`,
    );
  });

  it('moves the arc and the figure to a new value by its easing, and lands on it', async () => {
    stubReducedMotion(false);
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { host, valueArc, figure, settle } = await render((h) => h.value.set(0));
    expect(valueArc()).toBeNull();

    host.value.set(60);
    await settle();
    await vi.advanceTimersByTimeAsync(200);
    await settle();
    const midway = Number(figure());
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(60);
    // The arc is on its way too: drawn, and short of the full sweep.
    expect(valueArc()).toMatch(/^M /);
    expect(valueArc()).not.toBe(arcPath(0, 1, ARC_RADIUS));

    await vi.advanceTimersByTimeAsync(400);
    await settle();
    expect(figure()).toBe('60');
    expect(valueArc()).toBe(arcPath(0, 1, ARC_RADIUS));
  });

  it('jumps to a new value under reduced motion, the arc and the figure alike', async () => {
    stubReducedMotion(true);
    const { host, valueArc, figure, settle } = await render((h) => h.value.set(10));

    host.value.set(30);
    await settle();
    expect(figure()).toBe('30');
    expect(valueArc()).toBe(arcPath(0, 0.5, ARC_RADIUS));
  });
});
