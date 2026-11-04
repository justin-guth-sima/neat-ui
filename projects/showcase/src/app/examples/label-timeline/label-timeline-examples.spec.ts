import { TestBed } from '@angular/core/testing';
import { GestureTimeline } from './1-label-timeline.example';

describe('the label timeline example', () => {
  it('starts with the window filled with named gestures and a muted quiet class', async () => {
    const fixture = TestBed.createComponent(GestureTimeline);
    await fixture.whenStable();
    const runs = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('[data-slot="timeline-run"]'),
    );

    expect(runs.length).toBeGreaterThan(4);
    expect(runs.some((run) => run.dataset['label'] === 'No gesture')).toBe(true);
    expect(runs.some((run) => run.querySelector('.name'))).toBe(true);
    expect(fixture.nativeElement.querySelector('.name')?.textContent).not.toContain('No gesture');
  });
});
