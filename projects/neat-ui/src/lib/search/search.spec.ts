import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatSearch, type NeatSearchSize } from './search';

@Component({
  imports: [NeatSearch],
  // Counts the keydowns that reach the search's parent.
  host: { '(keydown)': 'passed.set(passed() + 1)' },
  template: `
    <neat-search
      label="Filter streams"
      placeholder="Name or channel"
      [size]="size()"
      [status]="status()"
      [(value)]="query"
    />
  `,
})
class SearchHost {
  readonly query = signal('');
  readonly size = signal<NeatSearchSize>('medium');
  readonly status = signal<string | undefined>(undefined);
  /** Keydowns that reached the search's parent. */
  readonly passed = signal(0);
}

async function render() {
  const fixture = TestBed.createComponent(SearchHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const field = () => root.querySelector('input') as HTMLInputElement;
  const clear = () => root.querySelector<HTMLButtonElement>('button.clear');
  const status = () => root.querySelector<HTMLElement>('.status');
  const type = async (text: string) => {
    field().value = text;
    field().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const escape = async () => {
    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
  };
  return { fixture, host: fixture.componentInstance, root, field, clear, status, type, escape };
}

describe('NeatSearch', () => {
  it('is a search field named by its label, with the hint as placeholder', async () => {
    const { field } = await render();

    expect(field().type).toBe('search');
    expect(field().getAttribute('aria-label')).toBe('Filter streams');
    expect(field().placeholder).toBe('Name or channel');
  });

  it('draws the search glyph hidden from assistive technology', async () => {
    const { root } = await render();
    const glyph = root.querySelector('neat-icon.glyph svg')!;

    expect(glyph.getAttribute('aria-hidden')).toBe('true');
    expect(glyph.getAttribute('role')).toBeNull();
  });

  it('writes what is typed to the value, and shows the value the app sets', async () => {
    const { fixture, host, field, type } = await render();

    await type('door');
    expect(host.query()).toBe('door');

    host.query.set('yard');
    await fixture.whenStable();
    expect(field().value).toBe('yard');
  });

  it('shows the clear button only while the field holds text', async () => {
    const { clear, type } = await render();

    expect(clear()).toBeNull();
    await type('door');
    expect(clear()?.getAttribute('aria-label')).toBe('Clear search');
    expect(clear()?.type).toBe('button');
    await type('');
    expect(clear()).toBeNull();
  });

  it('clears on the button and puts the focus back in the field', async () => {
    const { fixture, host, field, clear, type } = await render();
    await type('door');

    clear()!.focus();
    clear()!.click();
    await fixture.whenStable();

    expect(host.query()).toBe('');
    expect(field().value).toBe('');
    expect(document.activeElement).toBe(field());
    expect(clear()).toBeNull();
  });

  it('clears on Escape and keeps the key from its ancestors', async () => {
    const { host, type, escape } = await render();
    await type('door');
    const before = host.passed();

    await escape();

    expect(host.query()).toBe('');
    expect(host.passed()).toBe(before);
  });

  it('lets Escape pass in an empty field', async () => {
    const { host, escape } = await render();
    const before = host.passed();

    await escape();

    expect(host.passed()).toBe(before + 1);
  });

  it('has no status line until the app gives one, then announces it politely', async () => {
    const { fixture, host, field, status } = await render();
    expect(status()).toBeNull();
    expect(field().getAttribute('aria-describedby')).toBeNull();

    host.status.set('3 streams');
    await fixture.whenStable();

    expect(status()?.textContent?.trim()).toBe('3 streams');
    expect(status()?.getAttribute('aria-live')).toBe('polite');
    expect(field().getAttribute('aria-describedby')).toBe(status()!.id);
  });

  it('keeps the status line while it is empty, so a later status is announced', async () => {
    const { fixture, host, status } = await render();

    host.status.set('');
    await fixture.whenStable();

    expect(status()).not.toBeNull();
    expect(status()?.textContent?.trim()).toBe('');
  });

  it('takes the kit field heights, with room for the glyph and the clear button', async () => {
    const { fixture, host, field } = await render();
    expect(field().classList).toContain('h-9');
    // The start and end padding refine the field's `px`, which Tailwind orders before them.
    expect(field().classList).toContain('ps-8');
    expect(field().classList).toContain('pe-9');

    host.size.set('small');
    await fixture.whenStable();

    expect(field().classList).toContain('h-8');
    expect(field().classList).not.toContain('h-9');
  });

  it('gives each field its own id', async () => {
    const first = await render();
    const second = await render();

    expect(first.field().id).not.toBe(second.field().id);
  });
});
