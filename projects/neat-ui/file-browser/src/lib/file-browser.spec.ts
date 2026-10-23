import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { NeatColumn } from '@sima/neat-ui/select-list';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatFileBrowser, type NeatFileBrowserLabels } from './file-browser';
import type { NeatFileNode } from './file-tree';

const file = (path: string, extra: Partial<NeatFileNode> = {}): NeatFileNode => ({
  name: path.split('/').pop()!,
  path,
  type: 'file',
  ...extra,
});
const folder = (path: string, children: NeatFileNode[]): NeatFileNode => ({
  name: path.split('/').pop()!,
  path,
  type: 'folder',
  children,
});
const unsupported = { disabled: true, tag: 'NOT STREAMABLE' };

const TREE: readonly NeatFileNode[] = [
  folder('120FPS-720p-h264', [file('120FPS-720p-h264/drone.mp4')]),
  folder('30FPS', [
    folder('30FPS/indoor', [
      folder('30FPS/indoor/cam-a', [file('30FPS/indoor/cam-a/deep.mp4')]),
      file('30FPS/indoor/lobby.mp4'),
      file('30FPS/indoor/notes.txt', unsupported),
    ]),
    file('30FPS/highway.mp4'),
  ]),
  folder('empty', []),
  file('video.mp4'),
  file('Readme.md', unsupported),
];

@Component({
  imports: [NeatFileBrowser, NeatColumn],
  template: `
    <neat-file-browser
      rootLabel="Media Root"
      filterPlaceholder="Filter files…"
      [root]="root()"
      [mode]="mode()"
      [labels]="labels()"
      [(folder)]="folder"
      [(selected)]="selected"
      [(checked)]="checked"
    >
      @if (withColumn()) {
        <ng-template neatColumn="type" header="Type" width="4rem" let-file>{{
          file.name.split('.').pop()
        }}</ng-template>
      }
    </neat-file-browser>
  `,
})
class BrowserHost {
  readonly root = signal<readonly NeatFileNode[]>(TREE);
  readonly mode = signal<'pick' | 'manage'>('pick');
  readonly labels = signal<Partial<NeatFileBrowserLabels>>({});
  readonly withColumn = signal(false);
  readonly folder = signal('');
  readonly selected = signal<string | null>(null);
  readonly checked = signal<readonly string[]>([]);
}

@Component({
  imports: [NeatFileBrowser],
  template: `
    <neat-file-browser
      rootLabel="Library"
      [root]="root"
      [countLabel]="countLabel"
      [(folder)]="folder"
    />
  `,
})
class CountHost {
  readonly root = TREE;
  readonly folder = signal('');
  readonly countLabel = vi.fn((folder: string, count: number) => `${count} videos in ${folder}`);
}

beforeEach(() => {
  // jsdom does not implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

async function render(setup: (host: BrowserHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(BrowserHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const element: HTMLElement = fixture.nativeElement;
  const view = {
    fixture,
    host: fixture.componentInstance,
    element,
    listbox: () => element.querySelector<HTMLElement>('[role="listbox"]')!,
    options: () => [...element.querySelectorAll<HTMLElement>('[role="option"]')],
    /** What each row shows as its name. */
    names: () =>
      view.options().map((option) => option.querySelector('.truncate')!.textContent!.trim()),
    count: () => element.querySelector('[data-slot="file-browser-count"]')!.textContent!.trim(),
    /** The breadcrumb’s names, the separators left out. */
    crumbs: () =>
      [...element.querySelectorAll('nav li')].map((li) =>
        li.querySelector('button, [aria-current]')!.textContent!.trim(),
      ),
    filter: () => element.querySelector<HTMLInputElement>('input[type="text"]')!,
    row: (name: string) =>
      view.options().find((o) => view.names()[view.options().indexOf(o)] === name)!,
    checkbox: (name: string) =>
      view.row(name).querySelector<HTMLInputElement>('input[type="checkbox"]'),
    async settle() {
      await fixture.whenStable();
    },
    async type(text: string) {
      const input = view.filter();
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
    },
    async click(name: string) {
      view.row(name).click();
      await fixture.whenStable();
    },
    async press(key: string, target: HTMLElement = view.listbox()) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      await fixture.whenStable();
      return event;
    },
  };
  return view;
}

describe('NeatFileBrowser', () => {
  describe('the rows', () => {
    it('lists folders first, then files, each by name ignoring case, with the folders’ counts', async () => {
      const { names, options } = await render();

      expect(names()).toEqual(['120FPS-720p-h264', '30FPS', 'empty', 'Readme.md', 'video.mp4']);
      const counts = options().map((o) => o.querySelector('.tabular-nums')?.textContent);
      expect(counts).toEqual(['1', '3', '0', undefined, undefined]);
    });

    it('tells a folder from a file to a screen reader, which an icon alone does not', async () => {
      const { options } = await render();

      expect(options()[1].textContent).toContain('Folder');
      expect(options()[4].textContent).not.toContain('Folder');
    });

    it('is a listbox named by labels.files', async () => {
      const { listbox, host, fixture } = await render();
      expect(listbox().getAttribute('aria-label')).toBe('Files');

      host.labels.set({ files: 'Library files' });
      await fixture.whenStable();
      expect(listbox().getAttribute('aria-label')).toBe('Library files');
    });

    it('greys a disabled file and shows its tag, yet it stays selectable', async () => {
      const { click, row, host } = await render();
      const name = row('Readme.md').querySelector<HTMLElement>('[data-slot="file-name"]')!;

      expect(name.classList).toContain('text-muted-foreground');
      expect(row('video.mp4').querySelector('[data-slot="file-name"]')!.classList).not.toContain(
        'text-muted-foreground',
      );
      expect(row('Readme.md').querySelector('[data-slot="file-tag"]')!.textContent).toBe(
        'NOT STREAMABLE',
      );
      expect(row('video.mp4').querySelector('[data-slot="file-tag"]')).toBeNull();

      await click('Readme.md');
      expect(host.selected()).toBe('Readme.md');
    });
  });

  describe('the count', () => {
    it('counts the enabled files in the folder and below, by default as files', async () => {
      const { count, host, settle } = await render();
      // video.mp4, drone.mp4, highway.mp4, lobby.mp4 and deep.mp4; the two disabled ones do not count.
      expect(count()).toBe('5 files');

      host.folder.set('30FPS/indoor/cam-a');
      await settle();
      expect(count()).toBe('1 file');
    });

    it('is worded by countLabel from the folder’s name and the count', async () => {
      const fixture = TestBed.createComponent(CountHost);
      await fixture.whenStable();
      const text = () =>
        fixture.nativeElement.querySelector('[data-slot="file-browser-count"]').textContent.trim();

      expect(text()).toBe('5 videos in Library');
      expect(fixture.componentInstance.countLabel).toHaveBeenCalledWith('Library', 5);

      fixture.componentInstance.folder.set('30FPS/indoor');
      await fixture.whenStable();
      expect(text()).toBe('2 videos in indoor');
    });

    it('is a polite live region, so a screen reader hears the count change as the filter does', async () => {
      const { element } = await render();
      expect(
        element.querySelector('[data-slot="file-browser-count"]')!.getAttribute('aria-live'),
      ).toBe('polite');
    });
  });

  describe('navigating', () => {
    it('opens a folder with a click on its row, and the breadcrumb follows', async () => {
      const { host, click, names, crumbs } = await render();

      await click('30FPS');

      expect(host.folder()).toBe('30FPS');
      expect(names()).toEqual(['indoor', 'highway.mp4']);
      expect(crumbs()).toEqual(['Media Root', '30FPS']);
    });

    it('opens the folder the keyboard is on with Enter', async () => {
      const { host, press, names } = await render();

      await press('ArrowDown');
      await press('ArrowDown');
      await press('Enter');

      expect(host.folder()).toBe('30FPS');
      expect(names()).toEqual(['indoor', 'highway.mp4']);
    });

    it('goes up by a breadcrumb; the current folder is plain text marked as the location', async () => {
      const { host, element, settle } = await render((host) =>
        host.folder.set('30FPS/indoor/cam-a'),
      );
      const buttons = () => [...element.querySelectorAll<HTMLElement>('nav button')];
      expect(buttons().map((b) => b.textContent!.trim())).toEqual([
        'Media Root',
        '30FPS',
        'indoor',
      ]);
      expect(element.querySelector('nav [aria-current="location"]')!.textContent).toBe('cam-a');
      expect(element.querySelector('nav [aria-current="location"]')!.tagName).toBe('SPAN');

      buttons()[1].click();
      await settle();
      expect(host.folder()).toBe('30FPS');

      buttons()[0].click();
      await settle();
      expect(host.folder()).toBe('');
      expect(buttons()).toHaveLength(0);
    });

    it('goes up one folder with Backspace in the list, and stays at the root', async () => {
      const { host, press } = await render((host) => host.folder.set('30FPS/indoor'));

      expect((await press('Backspace')).defaultPrevented).toBe(true);
      expect(host.folder()).toBe('30FPS');
      await press('Backspace');
      expect(host.folder()).toBe('');
      await press('Backspace');
      expect(host.folder()).toBe('');
    });

    it('leaves Backspace to the filter field, which edits its text with it', async () => {
      const { host, press, filter } = await render((host) => host.folder.set('30FPS'));

      expect((await press('Backspace', filter())).defaultPrevented).toBe(false);
      expect(host.folder()).toBe('30FPS');
    });

    it('falls back to the nearest folder that exists when the one shown vanishes', async () => {
      const { host, fixture, names } = await render((host) =>
        host.folder.set('30FPS/indoor/cam-a'),
      );
      expect(names()).toEqual(['deep.mp4']);

      host.root.set(
        TREE.filter((node) => node.path !== '30FPS').concat(
          folder('30FPS', [folder('30FPS/indoor', [file('30FPS/indoor/lobby.mp4')])]),
        ),
      );
      await fixture.whenStable();

      expect(host.folder()).toBe('30FPS/indoor');
      expect(names()).toEqual(['lobby.mp4']);
    });

    it('falls back from a folder it is given that does not exist', async () => {
      const { host, names } = await render((host) => host.folder.set('30FPS/nope/deeper'));

      expect(host.folder()).toBe('30FPS');
      expect(names()).toEqual(['indoor', 'highway.mp4']);
    });

    it('goes back to the root when the tree is empty', async () => {
      const { host, fixture, options } = await render((host) => host.folder.set('30FPS'));

      host.root.set([]);
      await fixture.whenStable();

      expect(host.folder()).toBe('');
      expect(options()).toHaveLength(0);
    });
  });

  describe('the filter', () => {
    it('lists the files below the current folder that match, by their path relative to it', async () => {
      const { type, names, count, host } = await render((host) => host.folder.set('30FPS'));

      await type('mp4');

      expect(names()).toEqual(['highway.mp4', 'indoor/cam-a/deep.mp4', 'indoor/lobby.mp4']);
      expect(count()).toBe('3 matches in 30FPS');
      expect(host.selected()).toBeNull();
    });

    it('matches without regard to case, ignores surrounding spaces and shows no folders', async () => {
      const { type, names } = await render();

      await type('  CAM-A ');

      expect(names()).toEqual(['30FPS/indoor/cam-a/deep.mp4']);
    });

    it('says when nothing matches', async () => {
      const { type, element, count } = await render();

      await type('zzz');

      expect(element.querySelector('[data-slot="select-list-empty"]')!.textContent!.trim()).toBe(
        'No files match the filter.',
      );
      expect(count()).toBe('0 matches in Media Root');
    });

    it('says when the folder is empty', async () => {
      const { element } = await render((host) => host.folder.set('empty'));

      expect(element.querySelector('[data-slot="select-list-empty"]')!.textContent!.trim()).toBe(
        'This folder is empty.',
      );
    });

    it('clears when the folder is navigated, by a click, a breadcrumb or a key, or set from outside', async () => {
      const { type, click, filter, names, element, press, settle, host } = await render();

      await type('indoor');
      expect(names()).toEqual([
        '30FPS/indoor/cam-a/deep.mp4',
        '30FPS/indoor/lobby.mp4',
        '30FPS/indoor/notes.txt',
      ]);
      host.folder.set('30FPS');
      await settle();
      expect(filter().value).toBe('');
      expect(names()).toEqual(['indoor', 'highway.mp4']);

      await type('mp4');
      element.querySelector<HTMLElement>('nav button')!.click();
      await settle();
      expect(filter().value).toBe('');
      expect(host.folder()).toBe('');

      await click('30FPS');
      await type('indoor');
      await press('Backspace');
      expect(filter().value).toBe('');
      expect(host.folder()).toBe('');
    });

    it('selects a match like any file', async () => {
      const { type, click, host } = await render();
      await type('lobby');

      await click('30FPS/indoor/lobby.mp4');

      expect(host.selected()).toBe('30FPS/indoor/lobby.mp4');
    });

    it('takes its accessible name from labels.filter and its hint from filterPlaceholder', async () => {
      const { filter, host, fixture } = await render();
      expect(filter().getAttribute('aria-label')).toBe(
        'Filter files in the current folder and its subfolders',
      );
      expect(filter().placeholder).toBe('Filter files…');

      host.labels.set({ filter: 'Filter the library' });
      await fixture.whenStable();
      expect(filter().getAttribute('aria-label')).toBe('Filter the library');
    });
  });

  describe('selecting', () => {
    it('selects a file with a click in pick mode, and has no checkboxes', async () => {
      const { click, host, row, element } = await render();

      await click('video.mp4');

      expect(host.selected()).toBe('video.mp4');
      expect(row('video.mp4').getAttribute('aria-selected')).toBe('true');
      expect(element.querySelector('input[type="checkbox"]')).toBeNull();
    });

    it('selects one file at a time and keeps it selected across folders', async () => {
      const { click, host, names, row } = await render();
      await click('video.mp4');
      await click('30FPS');

      expect(host.selected()).toBe('video.mp4');
      expect(names()).toEqual(['indoor', 'highway.mp4']);

      await click('highway.mp4');
      expect(host.selected()).toBe('30FPS/highway.mp4');
      expect(row('highway.mp4').getAttribute('aria-selected')).toBe('true');
    });

    it('shows a selection the app sets', async () => {
      const { host, fixture, row } = await render();

      host.selected.set('video.mp4');
      await fixture.whenStable();

      expect(row('video.mp4').getAttribute('aria-selected')).toBe('true');
    });

    it('selects the files the arrow keys pass, and leaves the selection alone on a folder, which it highlights', async () => {
      const { press, host, row, options } = await render();

      await press('End');
      expect(host.selected()).toBe('video.mp4');

      await press('ArrowUp');
      expect(host.selected()).toBe('Readme.md');
      await press('ArrowUp');
      expect(host.selected()).toBe('Readme.md');
      expect(row('empty').getAttribute('aria-selected')).toBe('true');
      expect(row('Readme.md').getAttribute('aria-selected')).toBe('false');
      expect(options().filter((o) => o.getAttribute('aria-selected') === 'true')).toHaveLength(1);

      await press('ArrowDown');
      expect(row('Readme.md').getAttribute('aria-selected')).toBe('true');
      expect(row('empty').getAttribute('aria-selected')).toBe('false');
    });

    it('keeps the selected file when a folder is opened, and the folder’s own highlight does not outlast it', async () => {
      const { click, host, options } = await render();
      await click('video.mp4');

      await click('30FPS');

      expect(host.selected()).toBe('video.mp4');
      expect(host.folder()).toBe('30FPS');
      expect(options().filter((o) => o.getAttribute('aria-selected') === 'true')).toEqual([]);
    });

    it('does not open a file on Enter', async () => {
      const { press, host } = await render();
      await press('End');

      await press('Enter');

      expect(host.folder()).toBe('');
      expect(host.selected()).toBe('video.mp4');
    });
  });

  describe('manage mode', () => {
    const manage = (host: BrowserHost) => host.mode.set('manage');

    it('puts a checkbox on each file, not on folders, that no Tab stop reaches', async () => {
      const { options, checkbox, element } = await render(manage);

      expect(element.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
      expect(checkbox('video.mp4')!.tabIndex).toBe(-1);
      expect(options()[0].querySelector('input')).toBeNull();
    });

    it('checks a file with a click on its box without selecting or opening anything', async () => {
      const { checkbox, host, fixture } = await render(manage);

      checkbox('video.mp4')!.click();
      await fixture.whenStable();

      expect(host.checked()).toEqual(['video.mp4']);
      expect(host.selected()).toBeNull();
      expect(host.folder()).toBe('');
      expect(checkbox('video.mp4')!.checked).toBe(true);

      checkbox('video.mp4')!.click();
      await fixture.whenStable();
      expect(host.checked()).toEqual([]);
    });

    it('selects a file with a click on its row without checking it', async () => {
      const { click, host } = await render(manage);

      await click('video.mp4');

      expect(host.selected()).toBe('video.mp4');
      expect(host.checked()).toEqual([]);
    });

    it('gives the focus back to the list after a click on a box, so the arrow keys keep working', async () => {
      const { fixture, checkbox, press, host, listbox } = await render(manage);
      document.body.append(fixture.nativeElement);
      const box = checkbox('video.mp4')!;
      box.focus();

      box.click();
      await fixture.whenStable();
      expect(document.activeElement).toBe(listbox());

      await press('End');
      expect(host.selected()).toBe('video.mp4');
      fixture.nativeElement.remove();
    });

    it('checks the file the list is on with Space, without moving the selection, and unchecks it with the next', async () => {
      const { press, host, checkbox } = await render(manage);
      await press('End');

      expect((await press(' ')).defaultPrevented).toBe(true);
      expect(host.checked()).toEqual(['video.mp4']);
      expect(checkbox('video.mp4')!.checked).toBe(true);
      expect(host.selected()).toBe('video.mp4');

      await press('ArrowUp');
      await press(' ');
      expect(host.checked()).toEqual(['video.mp4', 'Readme.md']);

      await press('ArrowDown');
      await press(' ');
      expect(host.checked()).toEqual(['Readme.md']);
    });

    it('checks the file the list returns to after passing a folder, not the folder', async () => {
      const { press, host } = await render(manage);
      await press('End');
      await press('ArrowUp');
      await press('ArrowUp');

      await press('ArrowDown');
      await press(' ');

      expect(host.checked()).toEqual(['Readme.md']);
    });

    it('does nothing on Space over a folder, or with nothing under the list, and opens nothing', async () => {
      const { press, host } = await render(manage);

      await press(' ');
      await press('ArrowDown');
      await press(' ');

      expect(host.checked()).toEqual([]);
      expect(host.folder()).toBe('');
    });

    it('leaves Space alone in pick mode', async () => {
      const { press, host } = await render();
      await press('End');

      expect((await press(' ')).defaultPrevented).toBe(false);
      expect(host.checked()).toEqual([]);
    });

    it('gives each box a name from labels.selectFile, and says a checked file is checked', async () => {
      const { checkbox, row, host, fixture } = await render(manage);
      expect(checkbox('video.mp4')!.getAttribute('aria-label')).toBe('Select video.mp4');
      expect(row('video.mp4').textContent).not.toContain('Checked');

      host.labels.set({ selectFile: (path) => `Select ${path} for deletion` });
      host.checked.set(['video.mp4']);
      await fixture.whenStable();

      expect(checkbox('video.mp4')!.getAttribute('aria-label')).toBe(
        'Select video.mp4 for deletion',
      );
      expect(row('video.mp4').textContent).toContain('Checked');
    });

    it('keeps files checked across folders and filters, and on the files that are shown', async () => {
      const { checkbox, click, type, host, fixture } = await render(manage);
      host.checked.set(['30FPS/highway.mp4']);
      await fixture.whenStable();

      await click('30FPS');
      expect(checkbox('highway.mp4')!.checked).toBe(true);

      await type('highway');
      expect(checkbox('highway.mp4')!.checked).toBe(true);
      expect(host.checked()).toEqual(['30FPS/highway.mp4']);
    });

    it('drops checked paths that are no longer in the tree', async () => {
      const { host, fixture } = await render(manage);
      host.checked.set(['video.mp4', '30FPS/highway.mp4']);
      await fixture.whenStable();

      host.root.set(TREE.filter((node) => node.path !== 'video.mp4'));
      await fixture.whenStable();

      expect(host.checked()).toEqual(['30FPS/highway.mp4']);
    });
  });

  describe('columns', () => {
    it('adds the app’s columns after the name for files, with a header row', async () => {
      const { element, options, fixture, host } = await render();
      expect(element.querySelector('[data-slot="select-list-header"]')).toBeNull();

      host.withColumn.set(true);
      await fixture.whenStable();

      const header = element.querySelector('[data-slot="select-list-header"]')!;
      expect([...header.firstElementChild!.children].map((c) => c.textContent!.trim())).toEqual([
        'Name',
        'Type',
      ]);
      const cells = options().map((o) => o.children[1]?.textContent?.trim());
      expect(cells).toEqual(['', '', '', 'md', 'mp4']);
    });

    it('takes the name column’s heading from labels.name', async () => {
      const { element } = await render((host) => {
        host.withColumn.set(true);
        host.labels.set({ name: 'File' });
      });

      expect(
        element.querySelector('[data-slot="select-list-header"]')!.firstElementChild!.children[0]
          .textContent,
      ).toBe('File');
    });
  });

  describe('a folder of a thousand files', () => {
    const big = [
      folder(
        'big',
        Array.from({ length: 1000 }, (_, index) =>
          file(`big/clip-${String(index).padStart(4, '0')}.mp4`),
        ),
      ),
    ];

    it('shows them all, keeps their rows when one is checked or selected, and filters them', async () => {
      const { host, fixture, options, press, checkbox, type, names } = await render((host) => {
        host.root.set(big);
        host.folder.set('big');
        host.mode.set('manage');
      });
      expect(options()).toHaveLength(1000);
      const before = options();

      checkbox('clip-0003.mp4')!.click();
      await press('ArrowDown');
      await press('ArrowDown');
      await fixture.whenStable();

      expect(host.checked()).toEqual(['big/clip-0003.mp4']);
      expect(host.selected()).toBe('big/clip-0001.mp4');
      expect(options().every((option, index) => option === before[index])).toBe(true);

      await type('clip-099');
      expect(names()).toHaveLength(10);
    });
  });

  describe('contrast, from the emitted theme tokens', () => {
    const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
    const VOCABULARY = { dark: 'dark', checked: 'checked', 'focus-visible': 'focus' };

    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const on = scheme === 'dark' ? ['dark'] : [];
      // A row sits on the surface, and is --accent when hovered or selected.
      const FILLS = ['background', 'card', 'accent'] as const;

      it(`${scheme}: a disabled file’s name, a tag, a folder’s count and the count line reach 4.5:1`, async () => {
        const { row, element } = await render();
        const cases = {
          'disabled name': row('Readme.md').querySelector('[data-slot="file-name"]')!,
          tag: row('Readme.md').querySelector('[data-slot="file-tag"]')!,
          'folder count': row('30FPS').querySelector('.tabular-nums')!,
          'count line': element.querySelector('[data-slot="file-browser-count"]')!,
        };
        for (const [what, node] of Object.entries(cases)) {
          const classes = [...node.classList];
          for (const fill of FILLS) {
            // The count line sits on the surface, never on a row’s fill.
            if (what === 'count line' && fill === 'accent') continue;
            const under = tokens[fill];
            const text = stateColor(
              classes,
              'text',
              { tokens, vocabulary: VOCABULARY, on },
              under,
              tokens['foreground'],
            );
            expect(
              contrastRatio(text, under),
              `${scheme} ${what}: ${text} on --${fill}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      });

      it(`${scheme}: a file's checkbox shows against every surface (3:1), unchecked by its border and checked by its fill, and its tick reaches 4.5:1`, async () => {
        const { checkbox, host, fixture, row } = await render((host) => host.mode.set('manage'));
        host.checked.set(['video.mp4']);
        await fixture.whenStable();
        const classes = [...checkbox('video.mp4')!.classList];
        const q = (...states: string[]) => ({
          tokens,
          vocabulary: VOCABULARY,
          on: [...on, ...states],
        });
        for (const fill of FILLS) {
          const under = tokens[fill];
          const border = stateColor(classes, 'border', q(), under);
          expect(
            contrastRatio(border, under),
            `${scheme} unchecked border ${border} on --${fill}`,
          ).toBeGreaterThanOrEqual(3);
          const fillColor = stateColor(classes, 'bg', q('checked'), under);
          expect(
            contrastRatio(fillColor, under),
            `${scheme} checked fill ${fillColor} on --${fill}`,
          ).toBeGreaterThanOrEqual(3);
        }
        const tickClasses = [...row('video.mp4').querySelector('input + neat-icon')!.classList];
        const tickOn = tokens['primary'];
        const tickColor = stateColor(tickClasses, 'text', q(), tickOn);
        expect(
          contrastRatio(tickColor, tickOn),
          `${scheme} tick ${tickColor} on ${tickOn}`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
});
