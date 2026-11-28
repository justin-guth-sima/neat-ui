import { TestBed } from '@angular/core/testing';
import { ExpandingACard } from './1-expanding-a-card.example';
import { CoveringARegion } from './2-covering-a-region.example';

describe('the expand examples', () => {
  it('show the card over the window from the button in its header, and put it back', async () => {
    const fixture = TestBed.createComponent(ExpandingACard);
    await fixture.whenStable();
    const card: HTMLElement = fixture.nativeElement.querySelector('neat-card');
    const button = card.querySelector<HTMLButtonElement>('[data-slot="card-action"] button')!;

    expect(button.textContent?.trim()).toBe('Expand');
    button.click();
    await fixture.whenStable();
    expect(card.hasAttribute('data-neat-expanded')).toBe(true);
    expect(button.textContent?.trim()).toBe('Close');

    button.click();
    await fixture.whenStable();
    expect(card.hasAttribute('data-neat-expanded')).toBe(false);
  });

  it('cover the region the choice names, the board card among them', async () => {
    const fixture = TestBed.createComponent(CoveringARegion);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const board = root.querySelector<HTMLElement>('neat-card.board')!;
    const chart = board.querySelector<HTMLElement>('neat-card[neatExpand]')!;
    const option = (label: string) =>
      Array.from(root.querySelectorAll<HTMLElement>('[role="radio"]')).find((radio) =>
        radio.textContent?.includes(label),
      )!;
    // jsdom lays nothing out: the board gets a box to cover.
    board.getBoundingClientRect = () => new DOMRect(24, 96, 640, 352);

    expect(option('Page body').getAttribute('aria-checked')).toBe('true');
    option('Card').click();
    await fixture.whenStable();
    chart.querySelector<HTMLButtonElement>('[data-slot="card-action"] button')!.click();
    await fixture.whenStable();

    expect(chart.hasAttribute('data-neat-expanded')).toBe(true);
    expect(chart.hasAttribute('data-neat-expand-region')).toBe(true);
    expect(chart.style.getPropertyValue('--neat-expand-width')).toBe('640px');
  });
});
