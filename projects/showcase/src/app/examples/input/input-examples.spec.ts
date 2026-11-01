import { TestBed } from '@angular/core/testing';
import { SizesAndStates } from './1-sizes-and-states.example';
import { ControlsOnACard } from './2-controls-on-a-card.example';

async function render<T>(component: new () => T): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('the input examples', () => {
  it('name each field by its label and keep the native attributes on the small one', async () => {
    const host = await render(SizesAndStates);
    const field = (name: string) =>
      Array.from(host.querySelectorAll('label'))
        .find((label) => label.textContent?.trim().startsWith(name))!
        .querySelector('input')!;

    expect(field('Stream name').placeholder).toBe('Front door');
    expect(field('Go to page').type).toBe('number');
    expect(field('Go to page').inputMode).toBe('numeric');
    expect(field('Go to page').min).toBe('1');
    expect(field('Disabled').disabled).toBe(true);
  });

  it('sets a switch, a slider, a segmented control, an input and a select on a card', async () => {
    const host = await render(ControlsOnACard);
    const card = (selector: string) => host.querySelector(`.card ${selector}`);

    expect(card('button[role="switch"]')?.textContent?.trim()).toBe('Bars');
    expect(card('neat-slider')).not.toBeNull();
    expect(card('neat-segmented [role="radiogroup"]')?.getAttribute('aria-label')).toBe(
      'Tile shape',
    );
    expect(card('input')?.getAttribute('aria-label')).toBe('Jump to channel');
    expect(card('neat-select')).not.toBeNull();
    expect(host.querySelectorAll('.card neat-progress')).toHaveLength(2);
    expect(card('neat-drop-zone')).not.toBeNull();
    expect(card('neat-tabs')).not.toBeNull();
  });

  it('toggles the switch on the card and opens the other tab', async () => {
    const fixture = TestBed.createComponent(ControlsOnACard);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const toggle = host.querySelector<HTMLButtonElement>('button[role="switch"]')!;

    expect(toggle.getAttribute('aria-checked')).toBe('true');
    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    expect(host.querySelector('[role="tabpanel"]:not([hidden])')?.textContent).toContain(
      'Metadata settings.',
    );
    const general = Array.from(host.querySelectorAll<HTMLElement>('[role="tab"]')).find(
      (tab) => tab.textContent?.trim() === 'General',
    )!;
    general.click();
    await fixture.whenStable();
    expect(host.querySelector('[role="tabpanel"]:not([hidden])')?.textContent).toContain(
      'General settings.',
    );
  });
});
