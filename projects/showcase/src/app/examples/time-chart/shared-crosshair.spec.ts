import { TestBed } from '@angular/core/testing';
import { SharedCrosshair } from './8-shared-crosshair.example';

describe('the shared crosshair example', () => {
  beforeEach(() => {
    // jsdom has no ResizeObserver; the label timeline measures its names with one.
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows the moment its buttons set on every chart, and clears it', async () => {
    const fixture = TestBed.createComponent(SharedCrosshair);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.actions button'));
    const readouts = () =>
      ['neat-time-chart', 'neat-stacked-chart', 'neat-heatmap', 'neat-label-timeline'].map(
        (chart) => root.querySelector(`${chart} .readout`) !== null,
      );
    expect(readouts()).toEqual([false, false, false, false]);
    buttons[0].click();
    await fixture.whenStable();
    expect(readouts()).toEqual([true, true, true, true]);
    expect(root.querySelector('.report dd')?.textContent).toBe('12:02:00');
    buttons[2].click();
    await fixture.whenStable();
    expect(readouts()).toEqual([false, false, false, false]);
  });
});
