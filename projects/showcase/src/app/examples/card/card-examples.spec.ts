import { TestBed } from '@angular/core/testing';
import { ActionsOnlyCardExample } from './4-actions-only.example';
import { FillingTheRowExample } from './3-filling-the-row.example';
import { TitleButtonCardExample } from './5-title-as-a-button.example';
import { ContentOnlyCardExample } from './2-content-only.example';
import { TitledCardExample } from './1-titled-card.example';

describe('the card examples', () => {
  it('shows a titled region with an action in its header and a footer', async () => {
    const fixture = TestBed.createComponent(TitledCardExample);
    await fixture.whenStable();
    const card: HTMLElement = fixture.nativeElement.querySelector('neat-card');

    expect(card.getAttribute('role')).toBe('region');
    expect(card.querySelector('[data-slot="card-title"]')?.getAttribute('role')).toBe('heading');
    expect(card.querySelector('[data-slot="card-title"]')?.textContent).toContain('Detections');
    expect(card.querySelector('[data-slot="card-action"] button')?.textContent).toContain('Clear');
    expect(card.querySelector('[data-slot="card-footer"]')?.textContent).toContain('Updated');
  });

  it('shows a content-only card with no title and no role', async () => {
    const fixture = TestBed.createComponent(ContentOnlyCardExample);
    await fixture.whenStable();
    const card: HTMLElement = fixture.nativeElement.querySelector('neat-card');

    expect(card.hasAttribute('role')).toBe(false);
    expect(card.querySelector('[data-slot="card-title"]')?.textContent).toBe('');
    expect(card.querySelector('[data-slot="card-content"]')?.textContent).toContain('yolov8n');
  });

  it('shows an untitled card whose image fills it next to a titled card with a footer', async () => {
    const fixture = TestBed.createComponent(FillingTheRowExample);
    await fixture.whenStable();
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('neat-card'));
    const [untitled, ...titled] = cards;
    const subtitle = titled[0].querySelector<HTMLElement>('[data-slot="card-description"]')!;

    expect(untitled.querySelector('[data-slot="card-content"] img')).not.toBeNull();
    expect(untitled.querySelector('[data-slot="card-title"]')?.textContent).toBe('');
    expect(untitled.querySelector('[data-slot="card-content"]')?.className).toContain('flex-1');
    expect(titled.length).toBe(1);
    expect(subtitle.className).toContain('col-start-1');
    for (const card of titled) {
      expect(card.querySelector('[data-slot="card-footer"]')?.textContent).toContain('Updated');
    }
  });

  it('shows actions without a title in the header, and no role', async () => {
    const fixture = TestBed.createComponent(ActionsOnlyCardExample);
    await fixture.whenStable();
    const card: HTMLElement = fixture.nativeElement.querySelector('neat-card');

    expect(card.querySelectorAll('[data-slot="card-action"] button').length).toBe(2);
    expect(card.querySelector('[data-slot="card-title"]')?.textContent).toBe('');
    expect(card.hasAttribute('role')).toBe(false);
  });

  it('shows a title that is a button, no heading role without a title text', async () => {
    const fixture = TestBed.createComponent(TitleButtonCardExample);
    await fixture.whenStable();
    const card: HTMLElement = fixture.nativeElement.querySelector('neat-card');
    const title = card.querySelector('[data-slot="card-title"]')!;

    expect(title.querySelector('button')?.textContent).toContain('Detections');
    expect(title.hasAttribute('role')).toBe(false);
    card.querySelector<HTMLElement>('button')!.click();
    await fixture.whenStable();
    expect(card.querySelector('[data-slot="card-content"]')?.textContent).toContain('Opened');
  });
});
