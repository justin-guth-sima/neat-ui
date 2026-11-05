import { TestBed } from '@angular/core/testing';
import { CLASSES as SCORE_BARS_CLASSES } from '../score-bars/data';
import { CLASSES } from './data';
import { GestureTimeline } from './1-label-timeline.example';
import { NameRows } from './2-name-rows.example';

// jsdom lays nothing out: give the strip's row of names a width of 600 px and each name, as the
// timeline measures it, 6 px a character, so the names can be laid out.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const width = this.classList.contains('names')
      ? 600
      : this.classList.contains('probe')
        ? (this.textContent ?? '').length * 6
        : 0;
    return { left: 0, top: 0, width, height: 0, right: width, bottom: 0 } as DOMRect;
  });
});

afterEach(() => vi.restoreAllMocks());

/** The names a strip draws above its runs, newest first. */
const namesOf = (strip: Element) =>
  Array.from(strip.querySelectorAll('[data-slot="label-timeline-name"]')).map((name) =>
    name.textContent?.trim(),
  );

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
    const strip = fixture.nativeElement.querySelector('neat-label-timeline');
    expect(namesOf(strip)).not.toContain('No gesture');
    // The newest run is a long-named gesture that reaches "now", and the newest name.
    const newest = runs[runs.length - 1];
    expect(newest.dataset['label']).toBe(CLASSES[2]);
    expect(namesOf(strip)[0]).toBe(CLASSES[2]);
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

describe('the name rows example', () => {
  it('names more of the busy strip with two rows than with one, the newest gesture in both', async () => {
    const fixture = TestBed.createComponent(NameRows);
    await fixture.whenStable();
    const [one, two] = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('neat-label-timeline'),
    );
    const newest = Array.from(one.querySelectorAll<HTMLElement>('[data-slot="label-timeline-run"]'))
      .map((run) => run.dataset['label'])
      .filter((label) => label !== 'No gesture')
      .at(-1);

    expect(one.querySelectorAll('li').length).toBeGreaterThan(15);
    expect(namesOf(two).length).toBeGreaterThan(namesOf(one).length);
    expect(namesOf(one)[0]).toBe(newest);
    expect(namesOf(two)[0]).toBe(newest);
  });
});
