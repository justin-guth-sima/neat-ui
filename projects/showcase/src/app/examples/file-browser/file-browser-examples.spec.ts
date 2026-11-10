import { TestBed } from '@angular/core/testing';
import { Picking } from './1-picking.example';
import { Managing } from './2-managing.example';

async function render<T>(component: new () => T) {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const options = () => Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'));
  /** A row by the name it shows, which is its first cell. */
  const row = (name: string) =>
    options().find((option) => option.querySelector('.truncate')?.textContent?.trim() === name)!;
  const readout = () =>
    host.querySelector('.showcase-code')?.textContent?.replace(/\s+/g, ' ').trim();
  const click = async (name: string, init: MouseEventInit = {}): Promise<void> => {
    row(name).dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));
    await fixture.whenStable();
  };
  /** A double click, as a browser sends it: the two clicks, then the `dblclick`. */
  const dblclick = async (name: string): Promise<void> => {
    for (const detail of [1, 2]) {
      row(name).dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));
    }
    row(name).dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    await fixture.whenStable();
  };
  return { fixture, host, options, row, readout, click, dblclick };
}

describe('the file browser examples', () => {
  beforeEach(() => {
    // jsdom has no scrollIntoView, which the list calls on the selected row.
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  it('open a folder by double clicking it and pick a file, an unusable one included', async () => {
    const { host, row, readout, click, dblclick } = await render(Picking);

    expect(readout()).toBe('Picked: none (in /)');
    await click('clips');
    expect(readout()).toBe('Picked: none (in /)');
    await dblclick('clips');
    await dblclick('indoor');
    expect(readout()).toBe('Picked: none (in /clips/indoor)');
    await click('warehouse.mp4');
    expect(readout()).toBe('Picked: clips/indoor/warehouse.mp4 (in /clips/indoor)');

    // An unusable file is grayed and tagged, and can still be picked.
    expect(row('notes.txt').textContent).toContain('NOT SUPPORTED');
    await click('notes.txt');
    expect(readout()).toBe('Picked: clips/indoor/notes.txt (in /clips/indoor)');
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('keep the picked file while the folder changes', async () => {
    const { readout, click, dblclick } = await render(Picking);

    await click('demo.mp4');
    await dblclick('clips');

    expect(readout()).toBe('Picked: demo.mp4 (in /clips)');
  });

  it('check files with Ctrl-click without opening a folder, and filter them', async () => {
    const { host, row, readout, click, fixture } = await render(Managing);
    const box = (name: string) => row(name).querySelector('[data-slot="select-list-check"]');

    expect(readout()).toBe('Selected none, 0 checked, filter empty');
    // The count above the list is worded by the example's own label.
    expect(host.querySelector('[data-slot="file-browser-count"]')?.textContent?.trim()).toBe(
      '1005 videos',
    );
    expect(row('overview.mp4').textContent).toContain('MP4');

    await click('overview.mp4', { ctrlKey: true });
    expect(box('overview.mp4')?.hasAttribute('data-checked')).toBe(true);
    await click('indoor', { ctrlKey: true });
    // Ctrl-click checks a folder's row without opening it: the folder's files are still listed.
    expect(row('overview.mp4')).toBeDefined();
    expect(readout()).toBe('Selected clips/overview.mp4, 1 checked, filter empty');

    const filter = host.querySelector<HTMLInputElement>('input[type="text"]')!;
    filter.value = 'high';
    filter.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(readout()).toBe('Selected clips/overview.mp4, 1 checked, filter “high”');
  });
});
