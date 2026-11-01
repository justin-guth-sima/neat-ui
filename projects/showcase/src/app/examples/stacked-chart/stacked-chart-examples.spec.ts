import { TestBed } from '@angular/core/testing';
import { PowerRails } from './1-power-rails.example';

describe('the stacked chart examples', () => {
  it('list the eight rails with their values and shares in the legend', async () => {
    const fixture = TestBed.createComponent(PowerRails);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const items = Array.from(host.querySelectorAll('.legend li'));
    const label = (li: Element) => li.querySelector('span:not(.share)')?.textContent;

    expect(items.map(label)).toEqual([
      'Core',
      'MLA',
      'DDR',
      'Camera',
      'Network',
      'Storage',
      'Fan',
      'Board',
    ]);
    expect(items[0].querySelector('strong')?.textContent).toBe('4.0 W');
    expect(items[0].querySelector('.share')?.textContent).toBe('39%');
  });

  it('name the plot after the chart and its headline', async () => {
    const fixture = TestBed.createComponent(PowerRails);
    await fixture.whenStable();
    const plot = (fixture.nativeElement as HTMLElement).querySelector('[role="group"]');

    expect(plot?.getAttribute('aria-label')).toContain('Where the power goes: 11.2 W');
  });
});
