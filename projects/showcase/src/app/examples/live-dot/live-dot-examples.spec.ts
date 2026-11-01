import { TestBed } from '@angular/core/testing';
import { Badges } from './1-badges.example';

describe('the live dot example', () => {
  it('pulse the second and third dots only, each hidden from assistive technology', async () => {
    const fixture = TestBed.createComponent(Badges);
    await fixture.whenStable();
    const dots = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('neat-live-dot'),
    );

    expect(dots.map((dot) => dot.querySelector('.ring') !== null)).toEqual([false, true, true]);
    expect(dots.every((dot) => dot.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});
