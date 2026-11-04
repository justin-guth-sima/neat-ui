import { TestBed } from '@angular/core/testing';
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
});
