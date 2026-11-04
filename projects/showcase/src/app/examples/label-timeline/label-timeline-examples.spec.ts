import { TestBed } from '@angular/core/testing';
import { CLASSES as SCORE_BARS_CLASSES } from '../score-bars/data';
import { CLASSES } from './data';
import { GestureTimeline } from './1-label-timeline.example';

describe('the label timeline example', () => {
  it('starts with the window filled with named gestures and a muted quiet class', async () => {
    const fixture = TestBed.createComponent(GestureTimeline);
    await fixture.whenStable();
    // The example shows the same runs in two strips; the first is enough for what they hold.
    const runs = Array.from<HTMLElement>(
      fixture.nativeElement
        .querySelector('neat-label-timeline')
        .querySelectorAll('[data-slot="label-timeline-run"]'),
    );

    expect(runs.length).toBeGreaterThan(4);
    expect(runs.some((run) => run.dataset['label'] === 'No gesture')).toBe(true);
    expect(runs.some((run) => run.querySelector('.name'))).toBe(true);
    expect(fixture.nativeElement.querySelector('.name')?.textContent).not.toContain('No gesture');
    // The newest run is a long-named gesture that reaches "now".
    const newest = runs[runs.length - 1];
    expect(newest.dataset['label']).toBe(CLASSES[2]);
    expect(newest.querySelector('.name')?.textContent).toContain(CLASSES[2]);
    expect(parseFloat(newest.style.left) + parseFloat(newest.style.width)).toBeCloseTo(100, 5);
  });
});

describe("the label timeline example's strips", () => {
  it('are the same runs, one stepping and one smooth, each named for it', async () => {
    const fixture = TestBed.createComponent(GestureTimeline);
    await fixture.whenStable();
    const strips = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('neat-label-timeline'),
    );

    expect(strips.map((strip) => strip.getAttribute('aria-label'))).toEqual([
      'Last 30 s, step',
      'Last 30 s, smooth',
    ]);
    expect(strips[0].querySelectorAll('li').length).toBe(strips[1].querySelectorAll('li').length);
    expect(fixture.nativeElement.textContent).toContain('Step: moves when the app updates');
    expect(fixture.nativeElement.textContent).toContain('Smooth: scrolls between updates');
  });
});

describe("the label timeline example's classes", () => {
  it("are the score bars example's, so a label has the same colour in both", () => {
    expect(CLASSES).toEqual(SCORE_BARS_CLASSES);
  });
});
