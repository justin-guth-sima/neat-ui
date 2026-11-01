import { TestBed } from '@angular/core/testing';
import { Channels } from './1-channels.example';
import { OnACard } from './2-on-a-card.example';
import { Narrowing } from './3-narrowing.example';
import { NoItems } from './4-no-items.example';
import { Checked } from './5-checked.example';
import { Capped } from './6-capped.example';
import { Grouped } from './7-grouped.example';
import { Toned } from './8-toned.example';

async function render<T>(component: new () => T) {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const listbox = (name: string) =>
    host.querySelector<HTMLElement>(`[role="listbox"][aria-label="${name}"]`)!;
  const options = () => Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'));
  const readout = () =>
    host.querySelector('.showcase-code')?.textContent?.replace(/\s+/g, ' ').trim();
  const press = async (target: HTMLElement, key: string): Promise<void> => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await fixture.whenStable();
  };
  /** The text of an option's cells, as a screen reader reads the row. */
  const textOf = (option: HTMLElement) =>
    Array.from(option.children, (cell) => cell.textContent?.trim()).join(' ');
  return { fixture, host, listbox, options, readout, press, textOf };
}

describe('the select list examples', () => {
  it('select with the arrow keys, activate with Enter, keep the selection on Start', async () => {
    const { fixture, listbox, options, readout, press, textOf } = await render(Channels);
    const list = listbox('Channels');

    expect(readout()).toBe('Selected: none; nothing activated yet');
    await press(list, 'ArrowDown');
    expect(readout()).toBe('Selected: Channel 1; nothing activated yet');
    await press(list, 'Enter');
    expect(readout()).toBe('Selected: Channel 1; Activated Channel 1');

    expect(textOf(options()[0])).toBe('Channel 1 Idle Start');
    options()[0].querySelector('button')!.click();
    await fixture.whenStable();

    // The row's object was replaced, as a poll's answer would be: the selection stays on it.
    expect(textOf(options()[0])).toBe('Channel 1 Live Stop');
    expect(readout()).toBe('Selected: Channel 1; Activated Channel 1');
    expect(options()[0].getAttribute('aria-selected')).toBe('true');
  });

  it('put the list on a card, which sets the surface its header fills with', async () => {
    const { host, listbox, options } = await render(OnACard);

    expect(host.querySelector('.card')?.contains(listbox('Channels on a card'))).toBe(true);
    expect(options()).not.toHaveLength(0);
    expect(host.querySelector('[data-slot="select-list-header"]')).not.toBeNull();
  });

  it('give the list a narrower box when narrowed, and back', async () => {
    const { fixture, host } = await render(Narrowing);
    const box = host.querySelector('.box')!;
    const toggle = host.querySelector<HTMLButtonElement>('button[role="switch"]')!;

    expect([box.classList.contains('wide'), box.classList.contains('slim')]).toEqual([true, false]);
    toggle.click();
    await fixture.whenStable();
    expect([box.classList.contains('wide'), box.classList.contains('slim')]).toEqual([false, true]);
  });

  it('say why there are no rows', async () => {
    const { host, options } = await render(NoItems);

    expect(options()).toHaveLength(0);
    expect(host.textContent).toContain('No cameras enabled yet.');
  });

  it('check rows with Space, none for the type without files', async () => {
    const { listbox, options, readout, press } = await render(Checked);
    const list = listbox('Asset types');
    const checked = () => options().map((option) => option.getAttribute('aria-selected'));

    expect(readout()).toBe('Checked: cars');
    // Drones has no files, so no box and no aria-selected.
    expect(checked()).toEqual(['true', 'false', null, 'false', 'false']);

    await press(list, 'ArrowDown');
    await press(list, ' ');
    expect(readout()).toBe('Checked: none');
    await press(list, 'ArrowDown');
    await press(list, ' ');
    expect(readout()).toBe('Checked: people');
  });

  it('block the other boxes at the cap and give the reason as the rows description', async () => {
    const { listbox, options, readout, press } = await render(Capped);
    const list = listbox('Types to compare');
    const blocked = () => options().map((option) => option.getAttribute('aria-disabled'));

    expect(readout()).toBe('Compared: cars, people');
    expect(blocked()).toEqual([null, null, null, 'true', 'true']);

    await press(list, 'ArrowDown');
    await press(list, ' ');
    expect(readout()).toBe('Compared: people');
    expect(blocked()).toEqual([null, null, null, null, null]);
  });

  it('put the devices under their headings, the muted one last', async () => {
    const { host, options, listbox, press, textOf } = await render(Grouped);
    const headings = Array.from(
      host.querySelectorAll('[role="group"]'),
      (group) =>
        group.getAttribute('aria-label') ??
        group.querySelector('[role="presentation"]')?.textContent,
    );

    expect(headings.map((heading) => heading?.trim())).toEqual([
      'Cameras · 3',
      'Microphones · 1',
      'LiDAR · none found',
    ]);
    // Scan order was camera, microphone, camera, camera: the list sorts them into their groups.
    expect(options().map(textOf)).toEqual([
      'IMX219 MIPI CSI',
      'Logitech C920 USB 3.0',
      'Arducam USB USB 2.0',
      'C920 microphone USB',
    ]);

    for (let i = 0; i < 4; i++) await press(listbox('Devices'), 'ArrowDown');
    expect(options()[3].getAttribute('aria-selected')).toBe('true');
  });

  it('tint each row by its stream state and keep the fourth selected', async () => {
    const { options, textOf } = await render(Toned);
    const rows = options();

    expect(rows.map(textOf)[3]).toBe('src4 VID External');
    expect(rows.map((row) => row.getAttribute('aria-selected'))).toEqual(
      [false, false, false, true, false, false, false, false].map(String),
    );
    // The neutral rows (3 and 8) have no tint, the rest have one.
    const tinted = rows.map((row) => /tint/.test(row.className));
    expect(tinted).toEqual([true, true, false, true, true, true, true, false]);
  });
});
