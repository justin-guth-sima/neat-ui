import { TestBed } from '@angular/core/testing';
import { ExplainingAPart } from './1-explaining-a-part.example';
import { Sides } from './2-sides.example';

const bubbles = () =>
  Array.from(document.querySelectorAll('.cdk-overlay-container .bubble'), (bubble) =>
    bubble.textContent?.trim(),
  );

describe('the bubble examples', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('explain the stage pressed, describe its button by the note, and hide on a second press', async () => {
    const fixture = TestBed.createComponent(ExplainingAPart);
    await fixture.whenStable();
    const [, detector] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    );

    expect(bubbles()).toEqual([]);
    detector.click();
    await fixture.whenStable();
    expect(bubbles()).toEqual(['Runs the model on the MLA and finds the objects in each frame.']);
    expect(detector.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById(detector.getAttribute('aria-describedby')!)).not.toBeNull();

    detector.click();
    await fixture.whenStable();
    expect(bubbles()).toEqual([]);
    expect(detector.hasAttribute('aria-describedby')).toBe(false);
  });

  it('put a bubble on each side', async () => {
    const fixture = TestBed.createComponent(Sides);
    await fixture.whenStable();

    expect(bubbles()).toEqual(['On the top', 'On the right', 'On the bottom', 'On the left']);
  });
});
