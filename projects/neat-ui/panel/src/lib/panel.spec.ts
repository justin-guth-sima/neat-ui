import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatPanel, NeatPanelActions } from './panel';

@Component({
  imports: [NeatPanel, NeatPanelActions],
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

  it('has no actions area without actions', async () => {
    const { fixture, panel } = await render(false);
    expect(panel.querySelector('[data-slot="panel-actions"]')).toBeNull();

    // The area follows the projected content, not just its first state.
    fixture.componentInstance.withActions.set(true);
    await fixture.whenStable();
    expect(panel.querySelector('[data-slot="panel-actions"] button')).not.toBeNull();
  });

  it('projects the body', async () => {
    const { panel } = await render();

    expect(panel.querySelector('[data-slot="panel-body"]')!.textContent!.trim()).toBe(
      'Nothing yet.',
    );
  });
});
