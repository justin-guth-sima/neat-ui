import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { composite, contrastRatio } from '../theme/color';
import { spartanThemeTokens } from '../theme/spartan-theme';
import searchStyles from './search.css' with { loader: 'text' };
import type { NeatFieldWidth } from '../form/field-width';
import { NeatSearch, type NeatSearchSize, type NeatSearchVariant } from './search';

@Component({
  imports: [NeatSearch],
  // Counts the keydowns that reach the search's parent.
  host: { '(keydown)': 'passed.set(passed() + 1)' },
  template: `
    <neat-search
      label="Filter streams"
      placeholder="Name or channel"
      [size]="size()"
      [variant]="variant()"
      [width]="width()"
      [status]="status()"
      [(value)]="query"
    />
  `,
})
class SearchHost {
  readonly query = signal('');
  readonly size = signal<NeatSearchSize>('medium');
  readonly variant = signal<NeatSearchVariant>('filled');
  readonly width = signal<NeatFieldWidth>('fill');
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

  it('takes the kit field heights, and a large one with larger text and glyph', async () => {
    const { fixture, host, root, field } = await render();
    const glyphSize = () => root.querySelector('neat-icon.glyph svg')?.getAttribute('width');
    expect(field().classList).toContain('h-9');
    expect(glyphSize()).toBe('16');

    host.size.set('small');
    await fixture.whenStable();
    expect(field().classList).toContain('h-8');
    expect(field().classList).not.toContain('h-9');

    host.size.set('large');
    await fixture.whenStable();
    expect(field().classList).toContain('h-12');
    expect(field().classList).toContain('text-base');
    expect(glyphSize()).toBe('20');
    expect(root.querySelector('neat-search')?.getAttribute('data-size')).toBe('large');
  });

  it('is filled by default, and takes each look', async () => {
    const { fixture, host, root, field } = await render();
    const classes = () => Array.from(field().classList);
    expect(root.querySelector('neat-search')?.getAttribute('data-variant')).toBe('filled');
    expect(classes()).toEqual(
      expect.arrayContaining(['rounded-full', 'bg-foreground/8', 'border-transparent']),
    );

    host.variant.set('outlined');
    await fixture.whenStable();
    expect(classes()).toEqual(expect.arrayContaining(['rounded-md', 'border-input']));
    expect(classes()).not.toContain('bg-foreground/8');

    host.variant.set('underlined');
    await fixture.whenStable();
    expect(classes()).toEqual(
      expect.arrayContaining(['rounded-none', 'border-x-0', 'border-t-0', 'focus-visible:ring-0']),
    );

    host.variant.set('raised');
    await fixture.whenStable();
    expect(classes()).toEqual(expect.arrayContaining(['bg-card', 'shadow-sm', 'rounded-xl']));
    expect(classes()).not.toContain('rounded-md');
  });

  it('fills its container by default, and is as wide as the browser makes its input with width content', async () => {
    const { fixture, host, root, field } = await render();
    const search = root.querySelector('neat-search')!;
    expect(search.classList).toContain('w-full');
    // The input fills the search either way.
    expect(field().classList).toContain('w-full');

    host.width.set('content');
    await fixture.whenStable();
    expect(search.classList).toContain('w-fit');
    expect(search.classList).not.toContain('w-full');
    expect(field().classList).toContain('w-full');
  });

  it('leaves room for the glyph and the clear button in its stylesheet, over the field padding', () => {
    expect(searchStyles).toMatch(
      /input \{\s*padding-inline: var\(--search-text-start\) var\(--search-text-end\);/,
    );
    for (const look of ['filled', 'underlined']) {
      expect(searchStyles).toContain(`:host([data-variant='${look}'])`);
    }
    expect(searchStyles).toContain(":host([data-size='large'])");
  });

  // The filled look's tint, the text color at 8% (12% on hover) over the surface it sits on.
  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: the filled look keeps its hint at 4.5:1 on the page, a card and a popover`, () => {
      const tokens = spartanThemeTokens(scheme) as Record<string, string>;
      for (const surface of ['background', 'card', 'popover']) {
        for (const tint of [0.08, 0.12]) {
          const fill = composite(tokens['foreground'], tint, tokens[surface]);
          expect(
            contrastRatio(tokens['muted-foreground'], fill),
            `${tint} on --${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  it('gives each field its own id', async () => {
    const first = await render();
    const second = await render();

    expect(first.field().id).not.toBe(second.field().id);
  });

  it('is a combobox over the listbox it drives, naming the option the keys are on', async () => {
    @Component({
      imports: [NeatSearch],
      template: `<neat-search label="Search docs" listbox="results" [activeOption]="active()" />`,
    })
    class ComboHost {
      readonly active = signal<string | null>(null);
    }
    const fixture = TestBed.createComponent(ComboHost);
    await fixture.whenStable();
    const field = (fixture.nativeElement as HTMLElement).querySelector('input')!;

    expect(field.getAttribute('role')).toBe('combobox');
    expect(field.getAttribute('aria-controls')).toBe('results');
    expect(field.getAttribute('aria-expanded')).toBe('true');
    expect(field.getAttribute('aria-autocomplete')).toBe('list');
    expect(field.getAttribute('aria-activedescendant')).toBeNull();

    fixture.componentInstance.active.set('result-2');
    await fixture.whenStable();
    expect(field.getAttribute('aria-activedescendant')).toBe('result-2');
  });

  it('is a plain search field without a listbox', async () => {
    const { field } = await render();

    expect(field().getAttribute('role')).toBeNull();
    expect(field().getAttribute('aria-controls')).toBeNull();
    expect(field().getAttribute('aria-activedescendant')).toBeNull();
  });
});
