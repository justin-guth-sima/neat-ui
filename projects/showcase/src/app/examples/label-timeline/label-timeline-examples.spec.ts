import { TestBed } from '@angular/core/testing';
import { CLASSES as SCORE_BARS_CLASSES } from '../score-bars/data';
import { CLASSES } from './data';
import { GestureTimeline } from './1-label-timeline.example';

describe('the label timeline example', () => {
  it('starts with the window filled with named gestures and a muted quiet class', async () => {
    const fixture = TestBed.createComponent(GestureTimeline);
    await fixture.whenStable();
    const runs = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('[data-slot="label-timeline-run"]'),
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

describe('the label timeline example\'s classes', () => {
  it('are the score bars example\'s, so a label has the same colour in both', () => {
    expect(CLASSES).toEqual(SCORE_BARS_CLASSES);
  });
});
