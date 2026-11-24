import { TestBed } from '@angular/core/testing';
import { OnAPicture } from './1-on-a-picture.example';

describe('the live badge example', () => {
  it('says Live on the picture, File preview once Live is off, and Not live off a picture', async () => {
    const fixture = TestBed.createComponent(OnAPicture);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const badges = () =>
      Array.from(host.querySelectorAll('neat-live-badge')).map((badge) => ({
        text: badge.textContent?.trim(),
        live: badge.querySelector('neat-live-dot') !== null,
        onPicture: badge.hasAttribute('data-on-picture'),
      }));

    expect(badges()).toEqual([
      { text: 'Live', live: true, onPicture: true },
      { text: 'Not live', live: false, onPicture: false },
    ]);

    host.querySelector<HTMLElement>('button[role="switch"]')!.click();
    await fixture.whenStable();

    expect(badges()[0]).toEqual({ text: 'File preview', live: false, onPicture: true });
  });
});
