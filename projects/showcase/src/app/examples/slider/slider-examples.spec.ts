import { TestBed } from '@angular/core/testing';
import { LiveValue } from './1-live-value.example';
import { DescribedAndDisabled } from './2-described-and-disabled.example';

async function render<T>(component: new () => T): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const thumbs = (host: HTMLElement) =>
  Array.from(host.querySelectorAll<HTMLElement>('[role="slider"]'));

describe('the slider examples', () => {
  it('show the value beside the slider and follow a key press', async () => {
    const fixture = TestBed.createComponent(LiveValue);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const [thumb] = thumbs(host);

    expect(thumb.getAttribute('aria-label')).toBe('Opacity');
    expect(thumb.getAttribute('aria-valuenow')).toBe('60');
    expect(host.querySelector('.showcase-code')?.textContent?.trim()).toBe('60 %');

    thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();

    expect(host.querySelector('.showcase-code')?.textContent?.trim()).toBe('65 %');
  });

  it('describe one slider by its note and disable the other', async () => {
    const host = await render(DescribedAndDisabled);
    const [gain, disabled] = thumbs(host);

    expect(gain.getAttribute('aria-label')).toBe('Gain');
    expect(
      document.getElementById(gain.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toContain('describedBy');
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    expect(disabled.getAttribute('aria-valuenow')).toBe('40');
  });
});
