import { TestBed } from '@angular/core/testing';
import { SelectableCards } from './1-selectable-cards.example';

async function render() {
  const fixture = TestBed.createComponent(SelectableCards);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const card = (heading: string) =>
    Array.from(host.querySelectorAll<HTMLElement>('neat-chart-card')).find((c) =>
      c.querySelector('[data-slot="card-title"]')?.textContent?.includes(heading),
    )!;
  const chosen = () => host.querySelector('.chosen')?.textContent?.trim();
  const click = async (element: Element) => {
    (element as HTMLElement).click();
    await fixture.whenStable();
  };
  return { host, card, chosen, click };
}

describe('the chart card examples', () => {
  it('choose a card by its heading, marking it with aria-current', async () => {
    const { card, chosen, click } = await render();

    expect(chosen()).toBe('Chosen: cpu');
    await click(card('MLA temperature').querySelector('button')!);

    expect(chosen()).toBe('Chosen: mla');
    expect(card('MLA temperature').querySelector('button')?.getAttribute('aria-current')).toBe(
      'true',
    );
    expect(card('CPU usage').querySelector('button')?.hasAttribute('aria-current')).toBe(false);
  });

  it('choose a card by a click anywhere on it, its chart’s plot included', async () => {
    const { card, chosen, click } = await render();

    await click(card('Fan speed').querySelector('.caption')!);
    expect(chosen()).toBe('Chosen: fan');

    await click(card('MLA temperature').querySelector('neat-sparkline')!);
    expect(chosen()).toBe('Chosen: mla');

    await click(card('CPU usage').querySelector('[role="group"]')!);
    expect(chosen()).toBe('Chosen: cpu');
  });

  it('leave a card that is not selectable with a text heading that takes no click', async () => {
    const { card, chosen, click } = await render();
    const power = card('Board power');

    expect(power.querySelector('button')).toBeNull();
    await click(power);
    expect(chosen()).toBe('Chosen: cpu');
  });
});
