import { APP_BASE_HREF } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NeatViewport } from '@sima/neat-ui';
import helmOverlay from '../../../src/lib/ui/dialog/src/lib/hlm-dialog-overlay.ts?source' with {
  loader: 'text',
};
import {
  BACKDROP_HELM_CLASSES,
  NeatSearchPalette,
  type NeatSearchGroup,
  type NeatSearchItem,
} from './search-palette';

const item = (label: string, path: string): NeatSearchItem => ({
  id: path,
  label,
  detail: 'Components › Forms',
  icon: 'search',
  path,
});

/** Topics and parts whose label holds the query, ignoring case. */
function search(query: string): readonly NeatSearchGroup[] {
  const topics = ['Search', 'Select', 'Segmented', 'Slider', 'Switch', 'Select list'].map((label) =>
    item(label, `/components/forms/${label.toLowerCase().replace(' ', '-')}`),
  );
  const parts = [item('NeatSearch', '/components/forms/search#api-NeatSearch')];
  const keep = (items: readonly NeatSearchItem[]) =>
    items.filter((it) => it.label.toLowerCase().includes(query.toLowerCase()));
  return [
    { label: 'Topics', items: keep(topics) },
    { label: 'API', items: keep(parts) },
  ];
}

@Component({
  imports: [NeatSearchPalette],
  template: `
    <neat-search-palette
      label="Search docs"
      allResults="/search"
      [search]="search"
      [limit]="limit()"
      [shortcut]="shortcut()"
      [(open)]="open"
      (picked)="picked.set($event)"
    />
  `,
})
class PaletteHost {
  readonly search = search;
  readonly limit = signal(5);
  readonly shortcut = signal(true);
  readonly open = signal(false);
  readonly picked = signal<NeatSearchItem | null>(null);
}

async function render(narrow = false) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: APP_BASE_HREF, useValue: '/' },
      { provide: NeatViewport, useValue: { narrow: signal(narrow) } },
    ],
  });
  const fixture = TestBed.createComponent(PaletteHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const settle = () => fixture.whenStable();
  const trigger = () => root.querySelector('button.trigger') as HTMLButtonElement;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const field = () => dialog()?.querySelector('neat-search input') as HTMLInputElement;
  const options = () =>
    Array.from(dialog()?.querySelectorAll<HTMLAnchorElement>('[role="option"]') ?? []);
  const type = async (text: string) => {
    field().value = text;
    field().dispatchEvent(new Event('input'));
    await settle();
  };
  const press = async (key: string, target: Element = field()) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    await settle();
    return event;
  };
  const openPalette = async () => {
    trigger().click();
    await settle();
  };
  return {
    fixture,
    host: fixture.componentInstance,
    root,
    settle,
    trigger,
    dialog,
    field,
    options,
    type,
    press,
    openPalette,
  };
}

describe('NeatSearchPalette', () => {
  afterEach(() => {
    // A dialog left open by a test is closed with the fixture; its overlay container stays.
    document.querySelectorAll('.cdk-overlay-container').forEach((node) => (node.innerHTML = ''));
  });

  it('is a trigger that names the search and shows its keys', async () => {
    const { trigger } = await render();

    expect(trigger().textContent).toContain('Search docs');
    expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger().getAttribute('aria-keyshortcuts')).toBe('Control+K Meta+K');
    expect(trigger().querySelector('.keys')?.getAttribute('aria-hidden')).toBe('true');
    expect(trigger().querySelectorAll('kbd')).toHaveLength(2);
  });

  it('is an icon button on a narrow screen, named by its label', async () => {
    const { trigger } = await render(true);

    expect(trigger().getAttribute('aria-label')).toBe('Search docs');
    expect(trigger().querySelector('.label')).toBeNull();
    expect(trigger().querySelector('neat-icon')).not.toBeNull();
  });

  it('opens a dialog named by the label, with a combobox over an empty listbox', async () => {
    const { host, dialog, field, openPalette } = await render();

    await openPalette();

    expect(host.open()).toBe(true);
    expect(dialog()?.getAttribute('aria-label')).toBe('Search docs');
    expect(dialog()?.getAttribute('aria-modal')).toBe('true');
    expect(field().getAttribute('role')).toBe('combobox');
    const listbox = dialog()!.querySelector('[role="listbox"]')!;
    expect(field().getAttribute('aria-controls')).toBe(listbox.id);
    expect(dialog()!.textContent).toContain('Type to search.');
  });

  it('shows the matches in their groups, at most `limit` of each, and counts them', async () => {
    const { host, settle, dialog, options, type, openPalette } = await render();
    host.limit.set(2);
    await settle();
    await openPalette();

    await type('s');

    const groups = Array.from(dialog()!.querySelectorAll('[role="group"]'));
    expect(groups.map((group) => group.querySelector('.group-label')?.textContent)).toEqual([
      'Topics',
      'API',
    ]);
    expect(groups[0].querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(
      options().map((option) => [
        option.querySelector('.option-label')?.textContent,
        option.querySelector('.option-detail')?.textContent,
      ]),
    ).toEqual([
      ['Search', 'Components › Forms'],
      ['Select', 'Components › Forms'],
      ['NeatSearch', 'Components › Forms'],
    ]);
    expect(dialog()!.querySelector('neat-search .status')?.textContent?.trim()).toBe('3 results');
    expect(groups[0].getAttribute('aria-labelledby')).toBe(
      groups[0].querySelector('.group-label')!.id,
    );
  });

  it('moves through the results with the arrow keys, round the ends', async () => {
    const { field, options, type, press, openPalette } = await render();
    await openPalette();
    await type('se');
    const active = () =>
      options().findIndex((option) => option.getAttribute('aria-selected') === 'true');

    expect(active()).toBe(0);
    expect(field().getAttribute('aria-activedescendant')).toBe(options()[0].id);
    await press('ArrowDown');
    expect(active()).toBe(1);
    expect(field().getAttribute('aria-activedescendant')).toBe(options()[1].id);
    await press('ArrowUp');
    await press('ArrowUp');
    expect(active()).toBe(options().length - 1);
  });

  it('opens the active result on Enter, tells the app, and closes', async () => {
    const { host, dialog, type, press, openPalette } = await render();
    await openPalette();
    await type('slider');

    await press('Enter');

    expect(TestBed.inject(Router).url).toBe('/components/forms/slider');
    expect(host.picked()?.label).toBe('Slider');
    expect(host.open()).toBe(false);
    expect(dialog()).toBeNull();
  });

  it('opens a result on a plain click, and leaves a Ctrl-click to the browser', async () => {
    const { host, settle, options, type, openPalette } = await render();
    await openPalette();
    await type('switch');
    const option = options()[0];
    expect(option.getAttribute('href')).toBe('/components/forms/switch');

    const ctrlClick = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    option.dispatchEvent(ctrlClick);
    expect(ctrlClick.defaultPrevented).toBe(false);
    expect(host.open()).toBe(true);

    option.click();
    await settle();
    expect(TestBed.inject(Router).url).toBe('/components/forms/switch');
    expect(host.open()).toBe(false);
  });

  it('links all results to the app’s page with the search, and goes there on Enter with none', async () => {
    const { dialog, type, press, openPalette } = await render();
    await openPalette();

    await type('nothing here');
    const link = Array.from(dialog()!.querySelectorAll('.foot a'))[0] as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('See all results');
    expect(link.getAttribute('href')).toBe('/search?q=nothing%20here');
    expect(dialog()!.querySelector('neat-search .status')?.textContent?.trim()).toBe(
      'Nothing matches',
    );

    await press('Enter');
    expect(TestBed.inject(Router).url).toBe('/search?q=nothing%20here');
  });

  it('clears the field on Escape, then closes and gives the focus back', async () => {
    const { host, trigger, dialog, field, type, press, openPalette } = await render();
    trigger().focus();
    await openPalette();
    await type('se');

    await press('Escape');
    expect(field().value).toBe('');
    expect(host.open()).toBe(true);

    await press('Escape');
    expect(host.open()).toBe(false);
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('opens on Ctrl K or ⌘K from anywhere, unless the shortcut is off', async () => {
    const { host, settle } = await render();
    const key = (init: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        bubbles: true,
        cancelable: true,
        ...init,
      });
      document.body.dispatchEvent(event);
      return event;
    };

    expect(key({ ctrlKey: true }).defaultPrevented).toBe(true);
    await settle();
    expect(host.open()).toBe(true);
    host.open.set(false);
    await settle();

    key({ metaKey: true });
    await settle();
    expect(host.open()).toBe(true);
    host.open.set(false);
    await settle();

    key({ ctrlKey: true, shiftKey: true });
    key({ key: 'j', ctrlKey: true });
    host.shortcut.set(false);
    await settle();
    key({ ctrlKey: true });
    await settle();
    expect(host.open()).toBe(false);
  });

  it('opens and closes when the app sets `open`', async () => {
    const { host, settle, dialog } = await render();

    host.open.set(true);
    await settle();
    expect(dialog()).not.toBeNull();

    host.open.set(false);
    await settle();
    expect(dialog()).toBeNull();
  });

  it('copies the backdrop of helm’s dialog verbatim', () => {
    expect(helmOverlay).toContain(BACKDROP_HELM_CLASSES);
  });
});
