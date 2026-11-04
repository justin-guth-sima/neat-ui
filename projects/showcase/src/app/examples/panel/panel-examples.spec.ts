import { TestBed } from '@angular/core/testing';
import { PanelExample } from './1-panel.example';

describe('the panel example', () => {
  it('shows a panel with an action in its header and one without an actions area', async () => {
    const fixture = TestBed.createComponent(PanelExample);
    await fixture.whenStable();
    const panels = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('neat-panel'));

    expect(panels.map((panel) => panel.getAttribute('role'))).toEqual(['region', 'region']);
    expect(panels[0].querySelector('[data-slot="panel-actions"] button')?.textContent).toContain(
      'Clear',
    );
    expect(panels[1].querySelector('[data-slot="panel-actions"]')).toBeNull();
  });
});
