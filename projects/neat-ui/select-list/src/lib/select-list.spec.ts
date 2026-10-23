import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatColumn, NeatSelectList } from './select-list';

interface Slot {
  readonly id: number;
  readonly name: string;
  readonly state: string;
}

const slot = (id: number, state = 'Idle'): Slot => ({ id, name: `src${id}`, state });
const SLOTS = [slot(1), slot(2, 'Live'), slot(3), slot(4), slot(5)];

@Component({
  imports: [NeatSelectList, NeatColumn],
  template: `
    <neat-select-list
      label="Streaming slots"
      emptyLabel="No slots."
      [items]="items()"
      [trackBy]="byId"
      [(selected)]="selected"
      (activated)="activated.push($event.id)"
    >
      <ng-template neatColumn="name" header="Slot" let-item>{{ item.name }}</ng-template>
      <ng-template neatColumn="state" [header]="stateHeader()" width="6rem" let-item>
        <button type="button" (click)="pressed.push(item.id)">{{ item.state }}</button>
      </ng-template>
    </neat-select-list>
  `,
})
class ListHost {
  readonly items = signal<readonly Slot[]>(SLOTS);
  readonly selected = signal<Slot | null>(null);
  readonly stateHeader = signal('State');
  readonly activated: number[] = [];
  readonly pressed: number[] = [];
  readonly byId = vi.fn((item: Slot) => item.id);
}

@Component({
  imports: [NeatSelectList, NeatColumn],
  template: `
    <neat-select-list label="Cameras" [items]="[1]" [trackBy]="id">
      <ng-template neatColumn="n" let-n>{{ n }}</ng-template>
    </neat-select-list>
  `,
})
class HeaderlessHost {
  readonly id = (n: number) => n;
}

let scrolled: HTMLElement[];

beforeEach(() => {
  // jsdom does not implement scrollIntoView.
  scrolled = [];
  Element.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
    scrolled.push(this);
  });
});

afterEach(() => {
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

async function render(setup: (host: ListHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(ListHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const element: HTMLElement = fixture.nativeElement;
  return {
    fixture,
    host: fixture.componentInstance,
    element,
    list: element.querySelector<HTMLElement>('neat-select-list')!,
    listbox: () => element.querySelector<HTMLElement>('[role="listbox"]')!,
    options: () => [...element.querySelectorAll<HTMLElement>('[role="option"]')],
    selectedNames: () =>
      [...element.querySelectorAll<HTMLElement>('[role="option"][aria-selected="true"]')].map(
        cellTexts,
      ),
  };
}

/** A row’s cells’ texts, joined by a space. */
function cellTexts(element: Element): string {
  return [...element.children].map((cell) => cell.textContent!.trim()).join(' ');
}

function press(target: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('NeatSelectList', () => {
  describe('structure', () => {
    it('is a listbox named by label, with one option per item and the column templates in its cells', async () => {
      const { listbox, options } = await render();

      expect(listbox().getAttribute('aria-label')).toBe('Streaming slots');
      expect(options()).toHaveLength(5);
      expect(options()[1].textContent).toContain('src2');
      expect(options()[1].querySelector('button')!.textContent).toBe('Live');
    });

    it('lays each row out on the columns’ widths, the first filling what is left', async () => {
      const { list, options } = await render();

      expect(list.style.getPropertyValue('--neat-select-list-columns')).toBe('1fr 6rem');
      expect(options()[0].children).toHaveLength(2);
    });

    it('shows a header row from the columns’ headers, hidden from assistive technology', async () => {
      const { element } = await render();

      const header = element.querySelector<HTMLElement>('[data-slot="select-list-header"]')!;
      expect(cellTexts(header.firstElementChild!)).toBe('Slot State');
      expect(header.getAttribute('aria-hidden')).toBe('true');
      expect(element.querySelector('[role="listbox"] [data-slot="select-list-header"]')).toBeNull();
    });

    it('has no header row when no column has a header', async () => {
      const fixture = TestBed.createComponent(HeaderlessHost);
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('[role="option"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-slot="select-list-header"]')).toBeNull();
    });

    it('says why it is empty, and keeps the (empty) listbox so focus has somewhere to stay', async () => {
      const { fixture, host, element, listbox } = await render();

      host.items.set([]);
      await fixture.whenStable();

      expect(listbox().querySelectorAll('[role="option"]')).toHaveLength(0);
      const message = element.querySelector<HTMLElement>('[data-slot="select-list-empty"]')!;
      expect(message.textContent!.trim()).toBe('No slots.');
      expect(listbox().getAttribute('aria-describedby')).toBe(message.id);
    });
  });

  describe('selection', () => {
    it('marks the selected item’s row aria-selected and names it as the listbox’s active descendant', async () => {
      const { host, fixture, options, listbox, selectedNames } = await render();
      expect(selectedNames()).toEqual([]);
      expect(listbox().hasAttribute('aria-activedescendant')).toBe(false);

      host.selected.set(SLOTS[2]);
      await fixture.whenStable();

      expect(selectedNames()).toEqual(['src3 Idle']);
      expect(listbox().getAttribute('aria-activedescendant')).toBe(options()[2].id);
      expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual([
        'false',
        'false',
        'true',
        'false',
        'false',
      ]);
    });

    it('selects a row on click and tells activated, but not for a click on a control in the row', async () => {
      const { host, fixture, options } = await render();

      options()[3].click();
      await fixture.whenStable();
      expect(host.selected()).toBe(SLOTS[3]);
      expect(host.activated).toEqual([4]);

      options()[1].querySelector('button')!.click();
      await fixture.whenStable();
      expect(host.pressed).toEqual([2]);
      expect(host.selected()).toBe(SLOTS[3]);
      expect(host.activated).toEqual([4]);
    });

    it('follows an item by its key when the list is replaced by new objects', async () => {
      const { host, fixture, options, selectedNames } = await render();
      host.selected.set(SLOTS[1]);
      await fixture.whenStable();
      const before = options()[1];

      host.items.set([slot(1), slot(2, 'Stopping'), slot(3), slot(4), slot(5)]);
      await fixture.whenStable();

      expect(options()[1]).toBe(before);
      expect(selectedNames()).toEqual(['src2 Stopping']);
      expect(options()[1].querySelector('button')!.textContent).toBe('Stopping');
    });

    it('selects nothing visible when the selected item is no longer in the list', async () => {
      const { host, fixture, selectedNames, listbox } = await render();
      host.selected.set(SLOTS[4]);
      await fixture.whenStable();

      host.items.set(SLOTS.slice(0, 3));
      await fixture.whenStable();

      expect(selectedNames()).toEqual([]);
      expect(listbox().hasAttribute('aria-activedescendant')).toBe(false);
    });
  });

  describe('keyboard', () => {
    it('is one tab stop: the listbox, which holds the focus while the arrow keys move the selection', async () => {
      const { listbox, options } = await render();

      expect(listbox().tabIndex).toBe(0);
      expect(options().every((o) => o.tabIndex === -1 || !o.hasAttribute('tabindex'))).toBe(true);
    });

    it('moves the selection with arrow keys and Home/End and scrolls it into view', async () => {
      const { host, fixture, listbox, options } = await render();
      host.selected.set(SLOTS[1]);
      await fixture.whenStable();
      scrolled.length = 0;

      expect(press(listbox(), 'ArrowDown').defaultPrevented).toBe(true);
      await fixture.whenStable();
      expect(host.selected()).toBe(SLOTS[2]);
      expect(scrolled.at(-1)).toBe(options()[2]);
      expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' });

      press(listbox(), 'ArrowUp');
      press(listbox(), 'ArrowUp');
      await fixture.whenStable();
      expect(host.selected()).toBe(SLOTS[0]);
      expect(scrolled.at(-1)).toBe(options()[0]);

      press(listbox(), 'End');
      await fixture.whenStable();
      expect(host.selected()).toBe(SLOTS[4]);
      expect(scrolled.at(-1)).toBe(options()[4]);
      expect(listbox().getAttribute('aria-activedescendant')).toBe(options()[4].id);

      press(listbox(), 'Home');
      await fixture.whenStable();
      expect(host.selected()).toBe(SLOTS[0]);
      expect(scrolled.at(-1)).toBe(options()[0]);
    });

    it('stops at the ends instead of wrapping', async () => {
      const { host, fixture, listbox } = await render();
      host.selected.set(SLOTS[4]);
      await fixture.whenStable();

      press(listbox(), 'ArrowDown');
      expect(host.selected()).toBe(SLOTS[4]);

      press(listbox(), 'Home');
      press(listbox(), 'ArrowUp');
      expect(host.selected()).toBe(SLOTS[0]);
    });

    it('starts from the ends when nothing is selected: Down picks the first, Up the last', async () => {
      const { host, fixture, listbox } = await render();

      press(listbox(), 'ArrowDown');
      await fixture.whenStable();
      expect(host.selected()).toBe(SLOTS[0]);

      host.selected.set(null);
      await fixture.whenStable();
      press(listbox(), 'ArrowUp');
      expect(host.selected()).toBe(SLOTS[4]);
    });

    it('does not scroll again to a selected row that only moved when the list was replaced', async () => {
      const { host, fixture } = await render();
      host.selected.set(SLOTS[3]);
      await fixture.whenStable();
      scrolled.length = 0;

      host.items.set([slot(9), ...SLOTS]);
      await fixture.whenStable();

      expect(scrolled).toEqual([]);
    });

    it('scrolls to a selection that was set before its item arrived', async () => {
      const { host, fixture, options } = await render((host) => {
        host.items.set([]);
        host.selected.set(SLOTS[3]);
      });
      scrolled.length = 0;

      host.items.set(SLOTS);
      await fixture.whenStable();

      expect(scrolled).toEqual([options()[3]]);
    });

    it('also scrolls a selection the app sets into view', async () => {
      const { host, fixture, options } = await render();
      scrolled.length = 0;

      host.selected.set(SLOTS[3]);
      await fixture.whenStable();

      expect(scrolled).toEqual([options()[3]]);
    });

    it('tells activated on Enter for the selected row, and on nothing when none is selected', async () => {
      const { host, fixture, listbox } = await render();

      expect(press(listbox(), 'Enter').defaultPrevented).toBe(false);
      expect(host.activated).toEqual([]);

      host.selected.set(SLOTS[2]);
      await fixture.whenStable();
      expect(press(listbox(), 'Enter').defaultPrevented).toBe(true);
      expect(host.activated).toEqual([3]);
    });

    it('leaves the keys of a control in a cell to the control', async () => {
      const { host, fixture, options } = await render();
      host.selected.set(SLOTS[1]);
      await fixture.whenStable();
      const button = options()[1].querySelector('button')!;

      for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter']) {
        expect(press(button, key).defaultPrevented, key).toBe(false);
      }
      expect(host.selected()).toBe(SLOTS[1]);
      expect(host.activated).toEqual([]);
    });

    it('ignores arrow keys with a modifier, which belong to the browser and the system', async () => {
      const { host, listbox } = await render();

      for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
        press(listbox(), 'ArrowDown', { [modifier]: true });
      }

      expect(host.selected()).toBeNull();
    });

    it('does nothing on an empty list', async () => {
      const { fixture, host, listbox } = await render();
      host.items.set([]);
      await fixture.whenStable();

      expect(press(listbox(), 'ArrowDown').defaultPrevented).toBe(false);
      expect(press(listbox(), 'End').defaultPrevented).toBe(false);
      expect(host.selected()).toBeNull();
    });

    it('focus() puts the focus on the listbox', async () => {
      const { fixture, listbox } = await render();
      document.body.append(fixture.nativeElement);
      const list = fixture.debugElement.children[0].componentInstance as NeatSelectList<Slot>;

      list.focus();

      expect(document.activeElement).toBe(listbox());
      fixture.nativeElement.remove();
    });
  });

  describe('a long list', () => {
    const files = Array.from({ length: 1000 }, (_, index) => slot(index + 1));

    it('derives each row’s key once per list, not once per change detection or selection change', async () => {
      const { fixture, host, listbox, options } = await render((host) => host.items.set(files));
      expect(options()).toHaveLength(1000);
      expect(host.byId).toHaveBeenCalledTimes(1000);
      host.byId.mockClear();

      press(listbox(), 'ArrowDown');
      press(listbox(), 'ArrowDown');
      press(listbox(), 'End');
      await fixture.whenStable();
      fixture.detectChanges();

      // The selected item’s key is read; the other 999 rows’ are not.
      expect(host.byId.mock.calls.length).toBeLessThanOrEqual(3);
      expect(host.selected()).toBe(files[999]);
    });

    it('keeps the rows and their cells when only the selection changes', async () => {
      const { fixture, host, listbox, options } = await render((host) => host.items.set(files));
      const before = options();

      press(listbox(), 'ArrowDown');
      await fixture.whenStable();

      expect(options().every((option, index) => option === before[index])).toBe(true);
      expect(host.selected()).toBe(files[0]);
    });
  });

  describe('contrast, from the emitted theme tokens', () => {
    const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
    const SURFACES = ['background', 'card'] as const;
    const VOCABULARY = { dark: 'dark', hover: 'hover', 'aria-selected': 'selected' };

    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const on = (...states: string[]) => (scheme === 'dark' ? ['dark', ...states] : states);
      const q = (on: string[]) => ({ tokens, vocabulary: VOCABULARY, on });

      it(`${scheme}: a row’s text reaches 4.5:1 at rest, hovered and selected`, async () => {
        const { options } = await render();
        const classes = [...options()[0].classList];
        for (const state of [on(), on('hover'), on('selected')]) {
          for (const surface of SURFACES) {
            const under = tokens[surface];
            const fill = stateColor(classes, 'bg', q(state), under);
            const text = stateColor(classes, 'text', q(state), fill, tokens['foreground']);
            expect(
              contrastRatio(text, fill),
              `${scheme}, [${state.join(', ')}] ${text} on ${fill} (--${surface})`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      });

      it(`${scheme}: the selected row shows against the surface by a fill (${MIN_FILL_CONTRAST}:1) and by a bar on its start edge (${MIN_NON_TEXT_CONTRAST}:1, against the fill and the surface)`, async () => {
        const { options } = await render();
        const classes = [...options()[0].classList];
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const fill = stateColor(classes, 'bg', q(on('selected')), under);
          const bar = stateColor(classes, 'border', q(on('selected')), fill);
          expect(contrastRatio(fill, under), `fill ${fill} on --${surface}`).toBeGreaterThanOrEqual(
            MIN_FILL_CONTRAST,
          );
          expect(contrastRatio(bar, fill), `bar ${bar} on ${fill}`).toBeGreaterThanOrEqual(
            MIN_NON_TEXT_CONTRAST,
          );
          expect(contrastRatio(bar, under), `bar ${bar} on --${surface}`).toBeGreaterThanOrEqual(
            MIN_NON_TEXT_CONTRAST,
          );
        }
      });

      it(`${scheme}: an unselected row’s start edge shows no bar`, async () => {
        const { options } = await render();
        const classes = [...options()[0].classList];
        const under = tokens['background'];
        expect(stateColor(classes, 'border', q(on()), under)).toBe(under);
      });

      it(`${scheme}: the header’s text reaches 4.5:1 on the surfaces`, async () => {
        const { element } = await render();
        const classes = [
          ...element.querySelector<HTMLElement>('[data-slot="select-list-header"]')!.classList,
        ];
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const text = stateColor(classes, 'text', q(on()), under, tokens['foreground']);
          expect(contrastRatio(text, under), `${text} on --${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it(`${scheme}: the empty message reaches 4.5:1 on the surfaces`, async () => {
        const { fixture, host, element } = await render();
        host.items.set([]);
        await fixture.whenStable();
        const classes = [
          ...element.querySelector<HTMLElement>('[data-slot="select-list-empty"]')!.classList,
        ];
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const text = stateColor(classes, 'text', q(on()), under, tokens['foreground']);
          expect(contrastRatio(text, under), `${text} on --${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  });
});
