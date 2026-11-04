import { TestBed } from '@angular/core/testing';
import { GestureScores } from './1-score-bars.example';
import { CLASSES } from './data';

describe('the score bars example', () => {
  it('draws the 14 classes and marks one as the top', async () => {
    const fixture = TestBed.createComponent(GestureScores);
    await fixture.whenStable();
    const rows = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.row'));

    expect(rows.map((row) => row.querySelector('.name')?.textContent?.trim())).toEqual([
      ...CLASSES,
    ]);
    expect(rows.filter((row) => row.hasAttribute('data-top'))).toHaveLength(1);
  });
});
