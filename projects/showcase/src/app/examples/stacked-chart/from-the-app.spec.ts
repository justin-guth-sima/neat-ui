import { TestBed } from '@angular/core/testing';
import { StackedFromTheApp } from './2-from-the-app.example';

describe('the from-the-app example', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reads out what its button sets, and nothing once cleared', async () => {
    const fixture = TestBed.createComponent(StackedFromTheApp);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.actions button'));
    const readout = () => root.querySelector('neat-stacked-chart .readout');
    expect(readout()).toBeNull();
    buttons[0].click();
    await fixture.whenStable();
    expect(readout()).not.toBeNull();
    expect(root.querySelector('.report dd')?.textContent).not.toBe('None');
    buttons[1].click();
    await fixture.whenStable();
    expect(readout()).toBeNull();
  });
});
