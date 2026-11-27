import { TestBed } from '@angular/core/testing';
import { Solid } from './2-solid.example';
import { Tones } from './1-tones.example';

const labels = (host: HTMLElement): string[][] =>
  Array.from(host.querySelectorAll('.showcase-row'), (row) =>
    Array.from(row.querySelectorAll('[data-slot="badge"]'), (badge) => badge.textContent!.trim()),
  );

const ROW = [
  'Idle',
  'Live',
  'Unreachable',
  'Auth failed',
  'Connecting',
  'External',
  'Metadata late',
];

describe('the badge examples', () => {
  it('show the six tones and a badge button on the page and on a card, soft', async () => {
    const fixture = TestBed.createComponent(Tones);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(labels(host)).toEqual([ROW, ROW]);
    expect(
      Array.from(host.querySelectorAll('.showcase-row'), (r) => r.classList.contains('card')),
    ).toEqual([false, true]);
    // The soft tones read their color on a tint, which only the soft variant's classes have.
    expect(
      Array.from(host.querySelectorAll('[data-slot="badge"]')).every((badge) =>
        /bg-neat-(tint|chip)/.test(badge.className),
      ),
    ).toBe(true);
  });

  it('open the late notice from the badge button', async () => {
    const fixture = TestBed.createComponent(Tones);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('p')).toBeNull();

    host.querySelector<HTMLButtonElement>('button[neatBadge]')!.click();
    await fixture.whenStable();

    expect(host.querySelector('p')?.textContent).toBe('The late notice would open here.');
  });

  it('fill every toned badge of the second example with its status color', async () => {
    const fixture = TestBed.createComponent(Solid);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const badges = Array.from(host.querySelectorAll('[data-slot="badge"]'));

    expect(labels(host)).toEqual([ROW, ROW]);
    expect(badges.some((badge) => /bg-neat-tint/.test(badge.className))).toBe(false);
    expect(badges.filter((badge) => badge.classList.contains('bg-success'))).toHaveLength(2);
  });
});
