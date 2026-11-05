import { TestBed } from '@angular/core/testing';
import { GestureScores } from './1-score-bars.example';
import { FillingACard } from './2-filling-a-card.example';
import { CLASSES } from './data';

describe('the score bars example', () => {
  it('draws the 14 classes and marks one as the top', async () => {
    const fixture = TestBed.createComponent(GestureScores);
    await fixture.whenStable();
    const rows = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('[data-slot="score-bars-row"]'));

    expect(rows.map((row) => row.querySelector('.name')?.textContent?.trim())).toEqual([
      ...CLASSES,
    ]);
    expect(rows.filter((row) => row.hasAttribute('data-top'))).toHaveLength(1);
  });
});

describe('the filling score bars example', () => {
  it('fills its card with all 14 classes', async () => {
    const fixture = TestBed.createComponent(FillingACard);
    await fixture.whenStable();
    const bars = fixture.nativeElement.querySelector('neat-card neat-score-bars');

    expect(bars.hasAttribute('data-fill')).toBe(true);
    expect(bars.querySelectorAll('[data-slot="score-bars-row"]')).toHaveLength(CLASSES.length);
  });
});
