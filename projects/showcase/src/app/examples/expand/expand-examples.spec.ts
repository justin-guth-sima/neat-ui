import { TestBed } from '@angular/core/testing';
import { ExpandingACard } from './1-expanding-a-card.example';

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
});
