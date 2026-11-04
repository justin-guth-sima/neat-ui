import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { stylesheet } from '../../../charts/src/lib/css.testing';
import { NeatPanel } from './panel';
import panelStyles from './panel.css' with { loader: 'text' };

const { rule, declared } = stylesheet(panelStyles);

// Only NeatPanel is imported: the actions attribute is the panel's own selector.
@Component({
  imports: [NeatPanel],
  template: `
    <neat-panel heading="Detections">
      @if (withActions()) {
        <button type="button" neatPanelActions>Clear</button>
      }
      <p>Nothing yet.</p>
    </neat-panel>
  `,
})
class PanelHost {
  readonly withActions = signal(true);
}

async function render(withActions = true) {
  const fixture = TestBed.createComponent(PanelHost);
  fixture.componentInstance.withActions.set(withActions);
  await fixture.whenStable();
  const panel: HTMLElement = fixture.nativeElement.querySelector('neat-panel');
  return { fixture, panel };
}

describe('NeatPanel', () => {
  it('renders the heading and names the section by it', async () => {
    const { panel } = await render();

    const heading = panel.querySelector<HTMLElement>('[data-slot="panel-heading"]')!;
    expect(heading.textContent!.trim()).toBe('Detections');
    expect(panel.getAttribute('role')).toBe('region');
    expect(heading.id).not.toBe('');
    expect(panel.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('projects actions into the header', async () => {
    const { panel } = await render();

    const header = panel.querySelector('[data-slot="panel-header"]')!;
    expect(header.querySelector('button[neatPanelActions]')?.textContent).toBe('Clear');
    expect(panel.querySelector('[data-slot="panel-body"] button')).toBeNull();
  });

  it('shows no visible actions area or gap without actions', async () => {
    const { fixture, panel } = await render(false);
    const area = panel.querySelector<HTMLElement>('[data-slot="panel-actions"]')!;

    // The area is always rendered; it is empty and the stylesheet hides an empty one, so it takes
    // no room and the header's gap has nothing beside the heading to separate.
    expect(area.childElementCount).toBe(0);
    expect(area.textContent!.trim()).toBe('');
    expect(declared('.actions:empty', 'display')).toBe('none');

    // The area follows the projected content, not just its first state.
    fixture.componentInstance.withActions.set(true);
    await fixture.whenStable();
    expect(area.querySelector('button')).not.toBeNull();
  });

  it('keeps the header as tall with actions as without', () => {
    expect(declared('.header', 'min-height')).toBe('2rem');
  });

  it('sets the surface and the text colour of the card it draws', () => {
    expect(declared(':host', '--neat-surface')).toBe('var(--card)');
    expect(declared(':host', 'background')).toBe('var(--card)');
    expect(declared(':host', 'color')).toBe('var(--card-foreground)');
    expect(rule(':host')).not.toContain('!important');
  });

  it('projects the body', async () => {
    const { panel } = await render();

    expect(panel.querySelector('[data-slot="panel-body"]')!.textContent!.trim()).toBe(
      'Nothing yet.',
    );
  });
});
