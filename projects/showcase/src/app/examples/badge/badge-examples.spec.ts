import { TestBed } from '@angular/core/testing';
import { Solid } from './2-solid.example';
import { Tones } from './1-tones.example';
import { CrowdedRow } from './4-crowded-row.example';
import { WithAnIcon } from './5-with-an-icon.example';

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

  it('put several badges in a row narrower than they are, each free to shrink', async () => {
    const fixture = TestBed.createComponent(CrowdedRow);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const badges = Array.from(host.querySelectorAll('.crowded neat-badge'));

    expect(badges.map((badge) => badge.textContent!.trim())).toEqual([
      'Live',
      'H.264 1920×1080',
      'External publisher',
    ]);
    for (const badge of badges) expect(badge.classList.contains('shrink-0')).toBe(false);
  });

  it('show a badge with an icon at helm’s badge icon size, 12 px', async () => {
    const fixture = TestBed.createComponent(WithAnIcon);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const badges = Array.from(host.querySelectorAll('neat-badge'));

    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      expect(badge.querySelector(':scope > neat-icon svg')?.getAttribute('width')).toBe('12');
      expect(badge.classList.contains('has-[>neat-icon]:inline-flex')).toBe(true);
    }
  });
});
