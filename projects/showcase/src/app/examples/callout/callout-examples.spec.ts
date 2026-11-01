import { TestBed } from '@angular/core/testing';
import { Banner } from './1-banner.example';
import { Tones } from './2-tones.example';

async function render<T>(component: new () => T): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('the callout examples', () => {
  it('make the banner a region named by its heading, with its action under the text', async () => {
    const host = await render(Banner);
    const banner = host.querySelector<HTMLElement>('[role="region"]')!;
    const heading = banner.querySelector<HTMLElement>('[role="heading"]')!;

    expect(heading.textContent?.trim()).toBe('Board changed');
    expect(banner.getAttribute('aria-labelledby')).toBe(heading.id);
    const action = banner.querySelector('[data-slot="callout-actions"] button');
    expect(action?.textContent?.trim()).toBe('Refresh');
  });

  it('show a note of each of the six tones, none of them a landmark', async () => {
    const host = await render(Tones);
    const notes = Array.from(host.querySelectorAll('neat-callout'));

    expect(notes.map((note) => note.textContent?.trim())).toEqual([
      'neutral: Idle',
      'success: Live',
      'warning: Unreachable',
      'danger: Auth failed',
      'info: Connecting',
      'highlight: External',
    ]);
    expect(notes.some((note) => note.hasAttribute('role'))).toBe(false);
  });
});
