import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatDiagramFigureCard } from './figure-card';
import { NeatDiagramRateCard } from './messages/rate-card';

@Component({
  imports: [NeatDiagramFigureCard],
  template: `
    <neat-diagram-figure-card
      label="MLA benchmark"
      [value]="value()"
      [digits]="digits()"
      [unit]="unit()"
      [caption]="caption()"
      [history]="history()"
    />
  `,
})
class Host {
  readonly value = signal<number | null | undefined>(4.213);
  readonly digits = signal(2);
  readonly unit = signal('ms per call');
  readonly caption = signal('');
  readonly history = signal<readonly (number | null)[] | null | undefined>(undefined);
}

@Component({
  imports: [NeatDiagramFigureCard, NeatDiagramRateCard],
  template: `
    <neat-diagram-figure-card label="Active tracks" [value]="12" />
    <neat-diagram-rate-card label="Tracker → Gateway" [rate]="rate" />
  `,
})
class BothCards {
  readonly rate = { msgsPerSec: 30, bytesPerSec: 0, history: [] };
}

describe('NeatDiagramFigureCard', () => {
  /** `matchMedia` answering the reduced-motion query, so a new value shows at once. */
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query }));
  });
  afterEach(() => vi.unstubAllGlobals());

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const card = (fixture.nativeElement as HTMLElement).querySelector(
      'neat-diagram-figure-card',
    ) as HTMLElement;
    const line = () =>
      Array.from(card.querySelectorAll('.numbers > span'), (span) =>
        (span.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );
    const update = async (change: (host: Host) => void) => {
      change(fixture.componentInstance);
      await fixture.whenStable();
    };
    return { card, line, update };
  }

  it('shows the label, then the value with its digits and its unit', async () => {
    const { card, line } = await render();

    expect(card.querySelector('.label')?.textContent?.trim()).toBe('MLA benchmark');
    expect(line()).toEqual(['4.21 ms per call']);
    expect(card.querySelector('.numbers .value')?.textContent?.trim()).toBe('4.21');
  });

  it('sets its value in the kit’s eased number, in tabular digits', async () => {
    const { card } = await render();

    const value = card.querySelector('.numbers .value') as HTMLElement;
    expect(value.tagName).toBe('NEAT-EASED-NUMBER');
    expect(value.classList).toContain('tabular-nums');
  });

  it('shows a dash while there is no value, and no unit when it has none', async () => {
    const { line, update } = await render();

    await update((host) => {
      host.value.set(null);
      host.unit.set('');
    });

    expect(line()).toEqual(['–']);
  });

  it('puts the caption at the end of the value’s line, only while it has one', async () => {
    const { line, update } = await render();

    await update((host) => host.caption.set('237 per second'));
    expect(line()).toEqual(['4.21 ms per call', '237 per second']);

    await update((host) => host.caption.set(''));
    expect(line()).toEqual(['4.21 ms per call']);
  });

  it('draws a sparkline only with a history, named by the label and worded in the unit', async () => {
    const { card, update } = await render();
    expect(card.querySelector('neat-sparkline')).toBeNull();

    await update((host) => {
      host.unit.set('alive');
      host.digits.set(0);
      host.history.set([2, null, 8.4, 5]);
    });

    const sparkline = card.querySelector('neat-sparkline') as HTMLElement;
    expect(sparkline.getAttribute('aria-label')).toBe(
      'MLA benchmark: 3 recent samples, 2 alive to 8 alive',
    );
    expect(sparkline.querySelector('path')).not.toBeNull();

    // An empty history keeps the sparkline's box, so the card does not jump at its first samples.
    await update((host) => host.history.set([]));
    expect(card.querySelector('neat-sparkline')).not.toBeNull();
    await update((host) => host.history.set(null));
    expect(card.querySelector('neat-sparkline')).toBeNull();
  });

  it('words the sparkline’s samples without a unit when it has none', async () => {
    const { card, update } = await render();

    await update((host) => {
      host.unit.set('');
      host.history.set([1.5, 3.25]);
    });

    expect(card.querySelector('neat-sparkline')?.getAttribute('aria-label')).toBe(
      'MLA benchmark: 2 recent samples, 1.50 to 3.25',
    );
  });

  it('takes the rate card’s look from one sheet, so the notes read as one set', async () => {
    const fixture = TestBed.createComponent(BothCards);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    for (const selector of ['neat-diagram-figure-card', 'neat-diagram-rate-card']) {
      const card = root.querySelector(selector) as HTMLElement;
      // 11.5 rem, the demo's card.
      expect(getComputedStyle(card).width, selector).toBe('184px');
      const value = card.querySelector('.numbers .value') as HTMLElement;
      expect(getComputedStyle(value).fontVariantNumeric, selector).toBe('tabular-nums');
    }
  });
});
