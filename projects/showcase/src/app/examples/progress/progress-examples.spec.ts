import { TestBed } from '@angular/core/testing';
import { KnownAndUnknown } from './1-known-and-unknown.example';
import { TitledReadout } from './2-titled-readout.example';

const bar = (host: HTMLElement, name: string) =>
  host.querySelector<HTMLElement>(`[role="progressbar"][aria-label="${name}"]`)!;
const thumb = (host: HTMLElement) => host.querySelector<HTMLElement>('[role="slider"]')!;
const press = (element: HTMLElement, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

describe('the progress examples', () => {
  it('move the first bar with the slider, and leave the unknown bar without a value', async () => {
    const fixture = TestBed.createComponent(KnownAndUnknown);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(bar(host, 'Upload').getAttribute('aria-valuenow')).toBe('40');
    press(thumb(host), 'ArrowRight');
    await fixture.whenStable();

    expect(bar(host, 'Upload').getAttribute('aria-valuenow')).toBe('45');
    expect(bar(host, 'Import').getAttribute('aria-valuenow')).toBe('100');
    expect(bar(host, 'Preparing').hasAttribute('aria-valuenow')).toBe(false);
  });

  it('show the percent and the whole detail as a tooltip, no percent while unknown', async () => {
    const fixture = TestBed.createComponent(TitledReadout);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const [encoding, preparing] = Array.from(
      host.querySelectorAll('[data-slot="progress-readout"]'),
    );

    expect(encoding.querySelector('[data-slot="progress-title"]')?.textContent).toContain('40%');
    expect(
      encoding.querySelector('[data-slot="progress-detail"]')?.getAttribute('title'),
    ).toContain('a very long detail that cuts at the end');
    press(thumb(host), 'ArrowRight');
    await fixture.whenStable();

    expect(encoding.querySelector('[data-slot="progress-title"]')?.textContent).toContain('45%');
    expect(preparing.querySelector('[data-slot="progress-title"]')?.textContent).not.toContain('%');
  });
});
