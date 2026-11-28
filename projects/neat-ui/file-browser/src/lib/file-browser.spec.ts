import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
const unsupported = { unavailable: true, tag: 'NOT STREAMABLE' };

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
      [folder]="folder()"
      (folderChange)="folder.set($event); folderChanges.push($event)"
      [(selected)]="selected"
      [(checked)]="checked"
      [(filter)]="filter"
    >
      @if (withColumn()) {
        <ng-template neatColumn="type" header="Type" width="4rem" let-file>{{
          file.name.split('.').pop()
        }}</ng-template>
        <ng-template
          neatColumn="size"
          header="Size"
          width="5rem"
          align="end"
          [hideBelow]="hideSizeBelow()"
          >1 MB</ng-template
        >
      }
    </neat-file-browser>
  `,
})
class BrowserHost {
  readonly root = signal<readonly NeatFileNode[]>(TREE);
  readonly mode = signal<'pick' | 'manage'>('pick');
  readonly labels = signal<Partial<NeatFileBrowserLabels>>({});
  readonly withColumn = signal(false);
  readonly hideSizeBelow = signal<number | undefined>(undefined);
  readonly folder = signal('');
  /** The folders the browser reported opening, in order. */
  readonly folderChanges: string[] = [];
  readonly selected = signal<string | null>(null);
  readonly checked = signal<readonly string[]>([]);
  readonly filter = signal('');
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

/**
 * jsdom lays nothing out: rows sit `top + 36 * index` down the list's area, which shows `view`
 * pixels. Returns the undo.
 */
function layOutRows(top: number, view: number): () => void {
  const element = HTMLElement.prototype;
  const saved = (['offsetTop', 'offsetHeight', 'clientHeight'] as const).map(
    (name) => [name, Object.getOwnPropertyDescriptor(element, name)] as const,
  );
  const define = (name: string, value: (el: HTMLElement) => number) =>
    Object.defineProperty(element, name, {
      configurable: true,
      get(this: HTMLElement) {
        return value(this);
      },
    });
  define('offsetTop', (el) => top + 36 * Number(el.getAttribute('data-index') ?? 0));
  define('offsetHeight', () => 36);
  define('clientHeight', () => view);
  return () => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(element, name, descriptor);
      else delete (element as unknown as Record<string, unknown>)[name];
    }
  };
}

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
    filter: () => element.querySelector<HTMLInputElement>('neat-search input')!,
    /** The row that shows `name`, the names read once (a thousand-file folder has 1000 rows). */
    row: (name: string) => view.options()[view.names().indexOf(name)]!,
    /** A row's box, which the list draws in manage mode. */
    box: (name: string) =>
      view.row(name).querySelector<HTMLElement>('[data-slot="select-list-check"]'),
    isChecked: (name: string) => view.box(name)!.hasAttribute('data-checked'),
    async settle() {
      await fixture.whenStable();
    },
    async type(text: string) {
      const input = view.filter();
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
    },
    async click(name: string, init: MouseEventInit = {}) {
      view.row(name).dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));
      await fixture.whenStable();
    },
    /** A double click: the two clicks of it, then the `dblclick`, as a browser sends them. */
    async dblclick(name: string, init: MouseEventInit = {}) {
      for (const detail of [1, 2]) {
        const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail });
        view.row(name).dispatchEvent(down);
        view.row(name).dispatchEvent(new MouseEvent('click', { bubbles: true, detail, ...init }));
      }
      view
        .row(name)
        .dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2, ...init }));
      await fixture.whenStable();
    },
    async press(key: string, target: HTMLElement = view.listbox(), init: KeyboardEventInit = {}) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
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

    it('says what a folder’s count means: to a screen reader after the name, and as a tooltip', async () => {
      const { row } = await render();
      const folder = row('30FPS');

      expect(folder.textContent).toContain('3 files in 30FPS and its subfolders');
      expect(folder.querySelector('.tabular-nums')!.getAttribute('title')).toBe(
        '3 files in 30FPS and its subfolders',
      );
      expect(folder.querySelector('.tabular-nums')!.getAttribute('aria-hidden')).toBe('true');
      expect(row('empty').textContent).toContain('0 files in empty and its subfolders');
    });

    it('puts a folder’s count at the end of the name cell, or right after the name when the app adds columns', async () => {
      const { row, host, fixture } = await render();
      const count = () => row('30FPS').querySelector('.tabular-nums')!;
      expect(count().classList).toContain('ms-auto');

      host.withColumn.set(true);
      await fixture.whenStable();
      // The count reads as the folder's, not as a value in the next column.
      expect(count().classList).not.toContain('ms-auto');
      expect(count().previousElementSibling!.textContent).toBe('30FPS');
    });

    it('adds no description to the list in manage mode: the multi-select listbox says what checking is', async () => {
      const { listbox, host, fixture } = await render();
      expect(listbox().hasAttribute('aria-describedby')).toBe(false);

      host.mode.set('manage');
      await fixture.whenStable();

      expect(listbox().hasAttribute('aria-describedby')).toBe(false);
    });

    it('is a listbox named by labels.files', async () => {
      const { listbox, host, fixture } = await render();
      expect(listbox().getAttribute('aria-label')).toBe('Files');

      host.labels.set({ files: 'Library files' });
      await fixture.whenStable();
      expect(listbox().getAttribute('aria-label')).toBe('Library files');
    });

    it('grays an unavailable file and shows its tag as a neutral badge, yet it stays selectable', async () => {
      const { click, row, host } = await render();
      const name = row('Readme.md').querySelector<HTMLElement>('[data-slot="file-name"]')!;

      expect(name.classList).toContain('text-muted-foreground');
      expect(row('video.mp4').querySelector('[data-slot="file-name"]')!.classList).not.toContain(
        'text-muted-foreground',
      );
      const tag = row('Readme.md').querySelector('neat-badge')!;
      expect(tag.textContent!.trim()).toBe('NOT STREAMABLE');
      // The kit's badge for a fact beside a value, in its neutral tone (badge-classes.spec holds
      // it).
      expect([...tag.classList]).toEqual(
        expect.arrayContaining(['bg-neat-chip-neutral', 'text-muted-foreground']),
      );
      expect(row('video.mp4').querySelector('neat-badge')).toBeNull();

      await click('Readme.md');
      expect(host.selected()).toBe('Readme.md');
    });
  });

  describe('the count', () => {
    it('counts the available files in the folder and below, by default as files', async () => {
      const { count, host, settle } = await render();
      // video.mp4, drone.mp4, highway.mp4, lobby.mp4 and deep.mp4; the two unavailable ones are
      // not counted.
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
    it('opens a folder with a double click on its row, and the breadcrumb follows', async () => {
      const { host, dblclick, names, crumbs } = await render();

      await dblclick('30FPS');

      expect(host.folder()).toBe('30FPS');
      expect(names()).toEqual(['indoor', 'highway.mp4']);
      expect(crumbs()).toEqual(['Media Root', '30FPS']);
    });

    it('only highlights a folder on a single click, and keeps the folder and the selected file', async () => {
      const { host, click, row, names } = await render();
      await click('video.mp4');

      await click('30FPS');

      expect(host.folder()).toBe('');
      expect(names()).toContain('30FPS');
      expect(row('30FPS').getAttribute('aria-selected')).toBe('true');
      expect(host.selected()).toBe('video.mp4');
    });

    it('opens a folder once on a double click, not once per click', async () => {
      const { host, dblclick } = await render();

      await dblclick('30FPS');

      expect(host.folder()).toBe('30FPS');
      expect(host.folderChanges).toEqual(['30FPS']);
    });

    it('opens a folder with a click on the chevron that ends its row, which no other row has', async () => {
      const { host, row, options, settle } = await render();
      const chevron = (name: string) => row(name).querySelector<HTMLButtonElement>('button');

      expect(options().map((o) => o.querySelector('button') !== null)).toEqual([
        true,
        true,
        true,
        false,
        false,
      ]);
      expect(chevron('30FPS')!.getAttribute('aria-label')).toBe('Open 30FPS');
      expect(chevron('30FPS')!.tabIndex).toBe(-1);

      chevron('30FPS')!.click();
      await settle();
      expect(host.folder()).toBe('30FPS');
      expect(host.folderChanges).toEqual(['30FPS']);
    });

    it('opens one folder for a double click on a chevron, whose second click lands on the new listing', async () => {
      const { host, row, settle } = await render();
      const chevron = (name: string) => row(name).querySelector<HTMLButtonElement>('button')!;
      const click = (button: HTMLButtonElement, detail: number) =>
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));

      click(chevron('30FPS'), 1);
      await settle();
      expect(host.folder()).toBe('30FPS');
      // The first row of the new listing is a folder, its chevron where the first one was.
      click(chevron('indoor'), 2);
      await settle();

      expect(host.folder()).toBe('30FPS');
      expect(host.folderChanges).toEqual(['30FPS']);
    });

    it('opens nothing on a double click on a file, and changes no folder', async () => {
      const { host, dblclick } = await render();

      await dblclick('video.mp4');

      expect(host.folderChanges).toEqual([]);
      expect(host.folder()).toBe('');
      expect(host.selected()).toBe('video.mp4');
    });

    it('does not select the text of a row on the second press of a double click', async () => {
      const { row } = await render();
      const press = (detail: number) => {
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail });
        row('30FPS').dispatchEvent(event);
        return event.defaultPrevented;
      };

      expect(press(1)).toBe(false);
      expect(press(2)).toBe(true);
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
      const { type, dblclick, filter, names, element, press, settle, host } = await render();

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

      await dblclick('30FPS');
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

  describe('the focus and the scroll position on navigation', () => {
    /** The browser attached to the document, so that focus is real. */
    async function attached(setup: (host: BrowserHost) => void = () => undefined) {
      const view = await render(setup);
      document.body.append(view.fixture.nativeElement);
      return view;
    }
    const scrollerOf = (element: HTMLElement) =>
      element.querySelector<HTMLElement>('neat-select-list .overflow-y-auto')!;

    afterEach(() => {
      document.body.replaceChildren();
    });

    it('moves the focus to the list when a breadcrumb is pressed, which turns it into text', async () => {
      const { element, listbox, settle, host } = await attached((host) =>
        host.folder.set('30FPS/indoor'),
      );
      const crumb = element.querySelectorAll<HTMLElement>('nav button')[1];
      crumb.focus();
      expect(document.activeElement).toBe(crumb);

      crumb.click();
      await settle();

      expect(host.folder()).toBe('30FPS');
      expect(element.contains(crumb)).toBe(false);
      expect(document.activeElement).toBe(listbox());
    });

    it('does the same for the root crumb, and for a double click on a folder row', async () => {
      const { element, listbox, settle, dblclick } = await attached((host) =>
        host.folder.set('30FPS'),
      );
      const crumb = element.querySelector<HTMLElement>('nav button')!;
      crumb.focus();
      crumb.click();
      await settle();
      expect(document.activeElement).toBe(listbox());

      await dblclick('30FPS');
      expect(document.activeElement).toBe(listbox());
    });

    it('highlights the folder just left after going up by a breadcrumb or Backspace', async () => {
      const { element, row, press, settle } = await attached((host) =>
        host.folder.set('30FPS/indoor/cam-a'),
      );

      element.querySelectorAll<HTMLElement>('nav button')[1].click();
      await settle();
      expect(row('indoor').getAttribute('aria-selected')).toBe('true');

      await press('Backspace');
      expect(row('30FPS').getAttribute('aria-selected')).toBe('true');
    });

    it('does not highlight anything on opening a folder', async () => {
      const { dblclick, options } = await attached();

      await dblclick('30FPS');

      expect(options().some((o) => o.getAttribute('aria-selected') === 'true')).toBe(false);
    });

    it('scrolls the list to the folder just left', async () => {
      const { element, settle } = await attached((host) => host.folder.set('30FPS/indoor'));
      const undo = layOutRows(0, 40);

      try {
        element.querySelector<HTMLElement>('nav button')!.click();
        await settle();

        // 30FPS is the second row, spanning 36…72, in an area 40 high: its bottom meets the
        // view's.
        expect(scrollerOf(element).scrollTop).toBe(32);
      } finally {
        undo();
      }
    });

    it('opens a folder at the top, not at the previous listing’s offset', async () => {
      const { element, dblclick, settle } = await attached();
      const scroller = scrollerOf(element);
      scroller.scrollTop = 180;

      await dblclick('30FPS');
      await settle();

      expect(scroller.scrollTop).toBe(0);
    });

    it('returns to the top when the filter changes, too', async () => {
      const { element, type } = await attached();
      const scroller = scrollerOf(element);
      scroller.scrollTop = 180;

      await type('mp4');

      expect(scroller.scrollTop).toBe(0);
    });

    it('keeps the offset when only the selection changes', async () => {
      const { element, press, settle } = await attached();
      const undo = layOutRows(100, 108);
      const scroller = scrollerOf(element);
      scroller.scrollTop = 90;

      try {
        await press('ArrowDown');
        await settle();

        // The first row spans 100…136, inside the view, so the area stays where it was.
        expect(scroller.scrollTop).toBe(90);
      } finally {
        undo();
      }
    });
  });

  describe('the filter as a model', () => {
    it('is what the field shows, and what an app sets', async () => {
      const { host, fixture, names, filter } = await render((host) => host.folder.set('30FPS'));

      host.filter.set('lobby');
      await fixture.whenStable();

      expect(filter().value).toBe('lobby');
      expect(names()).toEqual(['indoor/lobby.mp4']);
    });

    it('follows typing, so an app can tell whether a filter is active', async () => {
      const { host, type } = await render();
      expect(host.filter()).toBe('');

      await type('mp4');
      expect(host.filter()).toBe('mp4');
    });

    it('is emptied, in the model too, when the folder changes', async () => {
      const { host, type, settle, filter } = await render();
      await type('indoor');

      host.folder.set('30FPS');
      await settle();

      expect(host.filter()).toBe('');
      expect(filter().value).toBe('');
    });

    it('keeps a filter the app gave before any navigation', async () => {
      const { names } = await render((host) => host.filter.set('video'));

      expect(names()).toEqual(['video.mp4']);
    });
  });

  describe('selecting', () => {
    it('selects a file with a click in pick mode, and has no checkboxes', async () => {
      const { click, host, row, element } = await render();

      await click('video.mp4');

      expect(host.selected()).toBe('video.mp4');
      expect(row('video.mp4').getAttribute('aria-selected')).toBe('true');
      expect(element.querySelector('[data-slot="select-list-check"]')).toBeNull();
    });

    it('selects one file at a time and keeps it selected across folders', async () => {
      const { click, dblclick, host, names, row } = await render();
      await click('video.mp4');
      await dblclick('30FPS');

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
      const { click, dblclick, host, options } = await render();
      await click('video.mp4');

      await dblclick('30FPS');

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

    it('is the list’s checked mode: a box on each file, not on folders, and a multi-select listbox', async () => {
      const { options, box, element, listbox } = await render(manage);

      expect(element.querySelectorAll('[data-slot="select-list-check"]')).toHaveLength(2);
      expect(box('video.mp4')!.getAttribute('aria-hidden')).toBe('true');
      expect(options()[0].querySelector('[data-slot="select-list-check"]')).toBeNull();
      expect(listbox().getAttribute('aria-multiselectable')).toBe('true');
      expect(element.querySelector('input[type="checkbox"]')).toBeNull();
    });

    it('says which files are checked through the list: each file is aria-selected while checked, a folder never', async () => {
      const { row, host, fixture } = await render(manage);
      expect(row('video.mp4').getAttribute('aria-selected')).toBe('false');
      expect(row('30FPS').hasAttribute('aria-selected')).toBe(false);

      host.checked.set(['video.mp4']);
      await fixture.whenStable();

      expect(row('video.mp4').getAttribute('aria-selected')).toBe('true');
      expect(row('Readme.md').getAttribute('aria-selected')).toBe('false');
    });

    it('checks a file with a click on its box without selecting or opening anything', async () => {
      const { box, isChecked, host, fixture } = await render(manage);

      box('video.mp4')!.click();
      await fixture.whenStable();

      expect(host.checked()).toEqual(['video.mp4']);
      expect(host.selected()).toBeNull();
      expect(host.folder()).toBe('');
      expect(isChecked('video.mp4')).toBe(true);

      box('video.mp4')!.click();
      await fixture.whenStable();
      expect(host.checked()).toEqual([]);
    });

    it('selects a file with a click on its row without checking it', async () => {
      const { click, host } = await render(manage);

      await click('video.mp4');

      expect(host.selected()).toBe('video.mp4');
      expect(host.checked()).toEqual([]);
    });

    it('checks the selected file with a second click, and unchecks it with the next', async () => {
      const { click, host } = await render(manage);
      await click('video.mp4');

      await click('video.mp4');
      expect(host.checked()).toEqual(['video.mp4']);

      await click('video.mp4');
      expect(host.checked()).toEqual([]);
    });

    it('checks nothing and opens nothing on a double click on a file', async () => {
      const { dblclick, host } = await render(manage);

      await dblclick('video.mp4');

      expect(host.selected()).toBe('video.mp4');
      expect(host.checked()).toEqual([]);
      expect(host.folderChanges).toEqual([]);
    });

    it('checks the file the list is on with Space, without moving the selection, and unchecks it with the next', async () => {
      const { press, host, isChecked } = await render(manage);
      await press('End');

      expect((await press(' ')).defaultPrevented).toBe(true);
      expect(host.checked()).toEqual(['video.mp4']);
      expect(isChecked('video.mp4')).toBe(true);
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

    it('highlights a folder on a Ctrl-click or a Shift-click without opening it, and checks no folder', async () => {
      const { click, host } = await render(manage);

      await click('30FPS', { ctrlKey: true });
      expect(host.folder()).toBe('');
      expect(host.checked()).toEqual([]);

      await click('empty', { shiftKey: true });
      expect(host.folder()).toBe('');
      expect(host.checked()).toEqual([]);
    });

    it('opens the highlighted folder on a double click on it, as on Enter', async () => {
      const { click, dblclick, host } = await render(manage);

      await click('30FPS', { ctrlKey: true });
      expect(host.folder()).toBe('');
      await dblclick('30FPS');

      expect(host.folder()).toBe('30FPS');
    });

    it('checks the files of a Shift-click range and leaves the folders in it alone', async () => {
      const { click, host, isChecked } = await render(manage);

      await click('video.mp4');
      await click('30FPS', { shiftKey: true });

      expect(host.checked()).toEqual(['Readme.md', 'video.mp4']);
      expect(isChecked('video.mp4')).toBe(true);
      expect(host.folder(), 'the folder the range ends at is highlighted, not opened').toBe('');
    });

    it('checks nothing on a click or a double click on the selected file, and opens nothing', async () => {
      const { click, dblclick, host } = await render(manage);

      await click('video.mp4');
      await click('video.mp4');
      await dblclick('video.mp4');

      expect(host.checked()).toEqual([]);
      expect(host.folderChanges).toEqual([]);
      expect(host.selected()).toBe('video.mp4');
    });

    it('checks every file of the folder on Ctrl+A, never a folder, and leaves the key to the browser in pick mode', async () => {
      const { press, host, listbox, fixture } = await render(manage);
      host.checked.set(['30FPS/highway.mp4']);
      await fixture.whenStable();

      expect((await press('a', listbox(), { ctrlKey: true })).defaultPrevented).toBe(true);
      expect(host.checked()).toEqual(['30FPS/highway.mp4', 'Readme.md', 'video.mp4']);
      expect(host.folder()).toBe('');

      host.mode.set('pick');
      await fixture.whenStable();
      expect((await press('a', listbox(), { ctrlKey: true })).defaultPrevented).toBe(false);
    });

    it('checks nothing on Space in pick mode', async () => {
      const { press, host } = await render();
      await press('End');

      await press(' ');

      expect(host.checked()).toEqual([]);
      expect(host.selected()).toBe('video.mp4');
    });

    it('keeps files checked across folders and filters, and on the files that are shown', async () => {
      const { isChecked, dblclick, type, box, host, fixture } = await render(manage);
      host.checked.set(['30FPS/highway.mp4']);
      await fixture.whenStable();

      await dblclick('30FPS');
      expect(isChecked('highway.mp4')).toBe(true);

      await type('highway');
      expect(isChecked('highway.mp4')).toBe(true);
      expect(host.checked()).toEqual(['30FPS/highway.mp4']);

      // A file checked here joins the ones checked elsewhere.
      await type('lobby');
      box('indoor/lobby.mp4')!.click();
      await fixture.whenStable();
      expect(host.checked()).toEqual(['30FPS/highway.mp4', '30FPS/indoor/lobby.mp4']);
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
      expect([...header.children].map((c) => c.textContent!.trim())).toEqual([
        'Name',
        'Type',
        'Size',
      ]);
      const cells = options().map((o) => o.children[1]?.textContent?.trim());
      expect(cells).toEqual(['', '', '', 'md', 'mp4']);
    });

    it('passes a column’s align on to the list', async () => {
      const { element, options } = await render((host) => host.withColumn.set(true));

      const header = element.querySelector('[data-slot="select-list-header"]')!;
      expect([...header.children].map((c) => c.classList.contains('text-end'))).toEqual([
        false,
        false,
        true,
      ]);
      for (const option of options()) {
        expect(option.children[2].classList).toContain('text-end');
        expect(option.children[1].classList).not.toContain('text-end');
      }
    });

    describe('a column that hides when narrow', () => {
      beforeEach(() => {
        vi.stubGlobal(
          'ResizeObserver',
          class {
            observe = vi.fn();
            disconnect = vi.fn();
          },
        );
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
          width: 500,
        } as DOMRect);
      });

      afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      });

      it('passes a column’s hideBelow on to the list', async () => {
        const { element } = await render((host) => {
          host.withColumn.set(true);
          host.hideSizeBelow.set(600);
        });

        const header = element.querySelector('[data-slot="select-list-header"]')!;
        expect([...header.children].map((c) => c.textContent!.trim())).toEqual(['Name', 'Type']);
      });
    });

    it('takes the name column’s heading from labels.name', async () => {
      const { element } = await render((host) => {
        host.withColumn.set(true);
        host.labels.set({ name: 'File' });
      });

      expect(
        element.querySelector('[data-slot="select-list-header"]')!.children[0].textContent,
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
      const { host, fixture, options, press, box, type, names } = await render((host) => {
        host.root.set(big);
        host.folder.set('big');
        host.mode.set('manage');
      });
      expect(options()).toHaveLength(1000);
      const before = options();

      box('clip-0003.mp4')!.click();
      await press('ArrowDown');
      await press('ArrowDown');
      await fixture.whenStable();

      expect(host.checked()).toEqual(['big/clip-0003.mp4']);
      expect(host.selected()).toBe('big/clip-0001.mp4');
      expect(options().every((option, index) => option === before[index])).toBe(true);

      await type('clip-099');
      expect(names()).toHaveLength(10);
    });

    it('reads its columns a few times per render, not once per folder row', async () => {
      const { fixture, host, options } = await render((host) => host.withColumn.set(true));
      // The app's columns come from a content query, and each file row's cells are views of the
      // app's column templates, so every row added marks the query changed: a read of the columns
      // in each folder row collected them anew, walking every row.
      const browser = fixture.debugElement.query(By.directive(NeatFileBrowser))
        .componentInstance as { columns: () => readonly NeatColumn[] };
      const columns = browser.columns;
      let reads = 0;
      Object.defineProperty(browser, 'columns', {
        value: Object.assign(() => (reads++, columns()), columns),
      });

      host.root.set([
        folder('mixed', [
          ...Array.from({ length: 500 }, (_, index) => folder(`mixed/day-${index}`, [])),
          ...Array.from({ length: 500 }, (_, index) => file(`mixed/clip-${index}.mp4`)),
        ]),
      ]);
      host.folder.set('mixed');
      await fixture.whenStable();

      expect(options()).toHaveLength(1000);
      expect(reads).toBeGreaterThan(0);
      expect(reads).toBeLessThanOrEqual(10);
    });
  });

  describe('contrast, from the emitted theme tokens', () => {
    const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
    const VOCABULARY = { dark: 'dark' };

    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const on = scheme === 'dark' ? ['dark'] : [];
      // A row sits on the surface, and is --accent when hovered or selected.
      const FILLS = ['background', 'card', 'accent'] as const;

      it(`${scheme}: an unavailable file’s name, a folder’s count and the count line reach 4.5:1`, async () => {
        const { row, element } = await render();
        const cases = {
          'unavailable name': row('Readme.md').querySelector('[data-slot="file-name"]')!,
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
      // A file's box is the select list's (checked mode); select-list.spec holds it to the theme.
    }
  });
});
