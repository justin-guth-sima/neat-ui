import { TestBed } from '@angular/core/testing';
import { Tinted } from './2-tinted.example';
import { Tones } from './1-tones.example';

const labels = (host: HTMLElement): string[][] =>
  Array.from(host.querySelectorAll('.showcase-row'), (row) =>
    Array.from(row.querySelectorAll('[data-slot="status-chip"]'), (chip) =>
      chip.textContent!.trim(),
    ),
  );

describe('the status chip examples', () => {
  it('show the six tones and a button chip on the page and on a card', async () => {
    const fixture = TestBed.createComponent(Tones);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const row = [
      'Idle',
      'Live',
      'Unreachable',
      'Auth failed',
      'Connecting',
      'External',
      'Metadata late',
    ];

    expect(labels(host)).toEqual([row, row]);
    expect(
      Array.from(host.querySelectorAll('.showcase-row'), (r) => r.classList.contains('card')),
    ).toEqual([false, true]);
  });

  it('open the late notice from the button chip', async () => {
    const fixture = TestBed.createComponent(Tones);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('p')).toBeNull();

    host.querySelector<HTMLButtonElement>('button[neatStatusChip]')!.click();
    await fixture.whenStable();

    expect(host.querySelector('p')?.textContent).toBe('The late notice would open here.');
  });

  it('tint every chip of the second example', async () => {
    const fixture = TestBed.createComponent(Tinted);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const chips = host.querySelectorAll('[data-slot="status-chip"]');

    expect(chips).toHaveLength(14);
    // The tinted tones read their colour on a tint, which only the tinted variant's classes have.
    expect(Array.from(chips).every((chip) => /bg-neat-(tint|chip)/.test(chip.className))).toBe(
      true,
    );
  });
});
