import { TestBed } from '@angular/core/testing';
import { Tones } from './1-tones.example';

describe('the sparkline examples', () => {
  it('draw a line for each tone, two for the gap, and none for the one sample', async () => {
    const fixture = TestBed.createComponent(Tones);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const lines = (name: string): number =>
      (
        host
          .querySelector(`[role="img"][aria-label^="${name}"]`)
          ?.querySelector('path')
          ?.getAttribute('d') ?? ''
      ).split('M').length - 1;

    expect(['Default', 'Warning', 'Danger'].map(lines)).toEqual([1, 1, 1]);
    expect(lines('With a gap')).toBe(2);
    expect(lines('One sample')).toBe(0);
    expect(host.querySelectorAll('[role="img"]').length).toBe(5);
  });
});
