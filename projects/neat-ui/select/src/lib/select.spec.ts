import { Component, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  contrastRatio,
  type NeatColorScheme,
  ɵFIELD_LABEL_CLASSES as FIELD_LABEL_CLASSES,
} from '@sima/neat-ui';
import { NeatDialog } from '@sima/neat-ui/dialog';
import helmContent from '../../../src/lib/ui/select/src/lib/hlm-select-content.ts?source' with {
  loader: 'text',
};
import helmItem from '../../../src/lib/ui/select/src/lib/hlm-select-item.ts?source' with {
  loader: 'text',
};
import helmTrigger from '../../../src/lib/ui/select/src/lib/hlm-select-trigger.ts?source' with {
  loader: 'text',
};
import { MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import {
  NeatSelect,
  type NeatSelectLabelPosition,
  type NeatSelectOption,
  type NeatSelectSize,
  SELECT_HELM_CLASSES,
} from './select';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const SURFACES = ['background', 'card'] as const;

/** The variants on the select's color classes; validation never applies in these states. */
const VOCABULARY = {
  dark: 'dark',
  hover: 'hover',
  'focus-visible': 'focus',
  'data-placeholder': 'placeholder',
  'data-highlighted': 'highlighted',
  '**': false,
  'not-data-[variant=destructive]': true,
  'data-[matches-spartan-invalid=true]': false,
};

/** The CDK waits this long after the last letter before it matches what was typed (200 ms). */
const TYPE_AHEAD_PAUSE_MS = 250;

const SOURCES: NeatSelectOption<string>[] = [
  { value: 'camera', label: 'Front camera' },
  { value: 'file', label: 'Warehouse clip', disabled: true },
  { value: 'rtsp', label: 'RTSP stream' },
  { value: 'usb', label: 'USB camera' },
];

@Component({
  imports: [NeatSelect],
  template: `
    <button type="button" class="before">Before</button>
    <neat-select
      label="Source"
      placeholder="Pick a source"
      [options]="options"
      [showLabel]="showLabel()"
      [labelPosition]="labelPosition()"
      [disabled]="disabled()"
      [size]="size()"
      [describedBy]="note()"
      [(value)]="source"
    />
    <p id="source-note">Overridden on 2 channels</p>
  `,
})
class SelectHost {
  readonly note = signal<string | undefined>(undefined);
  readonly options = SOURCES;
  readonly source = signal<string | null>(null);
  readonly showLabel = signal(false);
  readonly labelPosition = signal<NeatSelectLabelPosition>('above');
  readonly disabled = signal(false);
  readonly size = signal<NeatSelectSize>('medium');
}

/** A select in a dialog, and a record of the Escapes the page behind it hears. */
@Component({
  imports: [NeatSelect],
  template: `
    <ng-template #form>
      <neat-select label="Source" [options]="options" [(value)]="source" />
    </ng-template>
  `,
})
class DialogHost {
  readonly dialogs = inject(NeatDialog);
  readonly form = viewChild.required<TemplateRef<unknown>>('form');
  readonly options = SOURCES;
  readonly source = signal<string | null>(null);
}

/** Brain sizes the trigger through a ResizeObserver, which jsdom lacks. */
class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

/** Runs pending timers and render hooks: the list opens and closes after a frame. */
async function settle(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }
}

/** The CDK's list key manager reads `keyCode`, as browsers still set it. */
const KEY_CODES: Record<string, number> = {
  Tab: 9,
  Enter: 13,
  Escape: 27,
  ' ': 32,
  PageUp: 33,
  PageDown: 34,
  End: 35,
  Home: 36,
  ArrowUp: 38,
  ArrowDown: 40,
};

const press = (element: Element, key: string) => {
  const event = new KeyboardEvent('keydown', {
    key,
    keyCode: KEY_CODES[key],
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
  return event;
};

const panel = () => document.querySelector<HTMLElement>('[data-slot="select-content"]');
const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]');
const optionLabels = () =>
  Array.from(document.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim());
const activeOption = () => {
  const id = document.querySelector('[role="combobox"]')!.getAttribute('aria-activedescendant');
  return id ? document.getElementById(id)?.textContent?.trim() : undefined;
};

describe('NeatSelect', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    // Brain scrolls the active option into view, which jsdom cannot do.
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  async function render(setup: (host: SelectHost) => void = () => undefined) {
    const fixture = TestBed.createComponent(SelectHost);
    setup(fixture.componentInstance);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const trigger = root.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    return {
      fixture,
      host: fixture.componentInstance,
      root,
      trigger,
      before: root.querySelector<HTMLButtonElement>('.before')!,
      settle: () => settle(fixture),
      /** A key on the trigger, then the render it causes (the active option is a host binding). */
      key: async (key: string) => {
        press(trigger, key);
        await fixture.whenStable();
      },
    };
  }

  it('describedBy puts aria-describedby on the trigger, not on the host, and leaves it off when unset', async () => {
    const { fixture, host, root, trigger } = await render();
    const field = root.querySelector('neat-select')!;
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);

    host.note.set('source-note');
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-describedby')).toBe('source-note');
    expect(field.hasAttribute('aria-describedby')).toBe(false);

    host.note.set(undefined);
    await fixture.whenStable();
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
  });

  it('is a combobox named by label, announcing a listbox, closed at first', async () => {
    const { trigger } = await render();

    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('aria-label')).toBe('Source');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
    expect(listbox()).toBeNull();
  });

  it('shows the placeholder, then the label of the selected option, and follows the bound value', async () => {
    const { fixture, host, trigger } = await render();
    expect(trigger.textContent?.trim()).toBe('Pick a source');
    expect(trigger.hasAttribute('data-placeholder')).toBe(true);

    host.source.set('rtsp');
    await fixture.whenStable();
    expect(trigger.textContent?.trim()).toBe('RTSP stream');
    expect(trigger.hasAttribute('data-placeholder')).toBe(false);

    host.source.set(null);
    await fixture.whenStable();
    expect(trigger.textContent?.trim()).toBe('Pick a source');
  });

  it('showLabel shows the label above the select, and clicking it opens the list', async () => {
    const { root, trigger, settle } = await render((host) => host.showLabel.set(true));
    const label = root.querySelector('label')!;

    expect(label.textContent?.trim()).toBe('Source');
    expect(label.control).toBe(trigger);

    label.click();
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('is as tall as the medium input and button by default, and as the small ones when small', async () => {
    const { fixture, host, trigger } = await render();
    // Helm's trigger sizes itself by data-size: `data-[size=default]:h-9 data-[size=sm]:h-8`.
    expect(trigger.getAttribute('data-size')).toBe('default');

    host.size.set('small');
    await fixture.whenStable();
    expect(trigger.getAttribute('data-size')).toBe('sm');
  });

  it('names itself, when shown, as a field does: the kit’s field label over the trigger', async () => {
    const { root } = await render((host) => host.showLabel.set(true));

    expect([...root.querySelector('label')!.classList].sort()).toEqual(
      FIELD_LABEL_CLASSES.label.split(' ').sort(),
    );
    expect([...root.querySelector('neat-select')!.classList]).toEqual(
      expect.arrayContaining(FIELD_LABEL_CLASSES.stack.split(' ')),
    );
  });

  it('inline: the same label on the trigger’s row, still for the trigger, and a click on it opens the list', async () => {
    // Inline shows the label by itself: no showLabel.
    const { root, trigger, settle } = await render((host) => host.labelPosition.set('inline'));
    const select = root.querySelector('neat-select')!;
    const label = select.querySelector('label')!;

    // One row: the label, then the select taking the rest of it.
    expect([...select.classList]).toEqual(expect.arrayContaining(['flex', 'items-center']));
    expect(select.classList).not.toContain('flex-col');
    expect(label.parentElement).toBe(select);
    expect(label.nextElementSibling?.contains(trigger)).toBe(true);
    // The field label's look, kept whole on its row rather than squeezed by the trigger.
    expect([...label.classList]).toEqual(
      expect.arrayContaining(['text-sm', 'font-medium', 'shrink-0']),
    );
    expect([...label.nextElementSibling!.classList]).toEqual(
      expect.arrayContaining(['min-w-0', 'flex-1']),
    );

    // Still the select's name: the label is for the trigger, and the trigger is named by label.
    expect(label.textContent?.trim()).toBe('Source');
    expect(label.control).toBe(trigger);
    expect(trigger.getAttribute('aria-label')).toBe('Source');

    label.click();
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('puts the label above, with showLabel, when labelPosition returns to above', async () => {
    const { fixture, host, root } = await render((host) => host.labelPosition.set('inline'));
    const select = root.querySelector('neat-select')!;

    host.labelPosition.set('above');
    await fixture.whenStable();
    expect(select.querySelector('label'), 'above needs showLabel').toBeNull();

    host.showLabel.set(true);
    await fixture.whenStable();
    expect([...select.classList]).toEqual(
      expect.arrayContaining(FIELD_LABEL_CLASSES.stack.split(' ')),
    );
    expect([...select.querySelector('label')!.classList].sort()).toEqual(
      FIELD_LABEL_CLASSES.label.split(' ').sort(),
    );
  });

  it('shows the label inline whether or not showLabel is set', async () => {
    const { root } = await render((host) => {
      host.showLabel.set(true);
      host.labelPosition.set('inline');
    });

    expect(root.querySelectorAll('label')).toHaveLength(1);
    expect(root.querySelector('neat-select')!.classList).not.toContain('flex-col');
  });

  it('shows no visible label by default', async () => {
    const { root } = await render();

    expect(root.querySelector('label')).toBeNull();
  });

  it('opens on ArrowDown into a listbox named by label, with one option per entry and the first enabled one active', async () => {
    const { trigger, settle } = await render();

    press(trigger, 'ArrowDown');
    await settle();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(listbox()!.id);
    expect(listbox()!.getAttribute('aria-label')).toBe('Source');
    expect(optionLabels()).toEqual(['Front camera', 'Warehouse clip', 'RTSP stream', 'USB camera']);
    expect(activeOption()).toBe('Front camera');
  });

  it.each(['Enter', 'ArrowUp', ' '])('opens on %j', async (key) => {
    const { trigger, settle } = await render();

    if (key === ' ') {
      // A button opens on Space through its click, which the browser sends after the key.
      trigger.click();
    } else {
      press(trigger, key);
    }
    await settle();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('keyboard: arrows move and wrap, skipping the disabled option; Home, End and the page keys jump; Enter picks and closes', async () => {
    const { host, trigger, settle, key } = await render();
    trigger.focus();
    press(trigger, 'ArrowDown');
    await settle();

    await key('ArrowDown');
    expect(activeOption()).toBe('RTSP stream');
    await key('ArrowDown');
    expect(activeOption()).toBe('USB camera');
    await key('ArrowDown');
    expect(activeOption()).toBe('Front camera');
    await key('ArrowUp');
    expect(activeOption()).toBe('USB camera');
    await key('Home');
    expect(activeOption()).toBe('Front camera');
    await key('End');
    expect(activeOption()).toBe('USB camera');
    await key('PageUp');
    expect(activeOption()).toBe('Front camera');
    await key('PageDown');
    expect(activeOption()).toBe('USB camera');

    const enter = press(trigger, 'Enter');
    await settle();

    expect(enter.defaultPrevented).toBe(true);
    expect(host.source()).toBe('usb');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.textContent?.trim()).toBe('USB camera');
    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Space picks the active option while the list is open', async () => {
    const { host, trigger, settle, key } = await render();
    await key('ArrowDown');
    await settle();
    await key('ArrowDown');

    press(trigger, ' ');
    await settle();

    expect(host.source()).toBe('rtsp');
  });

  it('opens on the selected option, and reflects it on the list', async () => {
    const { trigger, settle } = await render((host) => host.source.set('usb'));
    press(trigger, 'ArrowDown');
    await settle();

    expect(activeOption()).toBe('USB camera');
    const selected = Array.from(document.querySelectorAll('[role="option"]')).filter(
      (option) => option.getAttribute('aria-selected') === 'true',
    );
    expect(selected.map((option) => option.textContent?.trim())).toEqual(['USB camera']);
    expect(selected[0].querySelector('neat-icon')).not.toBeNull();
  });

  it('a disabled option cannot be picked with the pointer either, and says it is disabled', async () => {
    const { host, trigger, settle } = await render();
    press(trigger, 'ArrowDown');
    await settle();
    const disabled = document.querySelectorAll<HTMLElement>('[role="option"]')[1];

    disabled.click();
    await settle();

    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    expect(host.source()).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('a click on an option picks it', async () => {
    const { host, trigger, settle } = await render();
    trigger.click();
    await settle();

    document.querySelectorAll<HTMLElement>('[role="option"]')[2].click();
    await settle();

    expect(host.source()).toBe('rtsp');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('typing the start of a label moves to that option', async () => {
    const { trigger, settle, key } = await render();
    press(trigger, 'ArrowDown');
    await settle();

    await key('u');
    // Brain matches the typed letters once typing has paused.
    await new Promise((resolve) => setTimeout(resolve, TYPE_AHEAD_PAUSE_MS));
    await settle();
    expect(activeOption()).toBe('USB camera');
  });

  it('Escape closes the list without picking, and stops there so listeners higher up never see it', async () => {
    const { host, trigger, settle } = await render((host) => host.source.set('rtsp'));
    const seen = vi.fn();
    document.addEventListener('keydown', seen);
    try {
      press(trigger, 'ArrowDown');
      await settle();
      press(trigger, 'ArrowDown');
      seen.mockClear();

      const escape = press(trigger, 'Escape');
      await settle();

      expect(escape.defaultPrevented).toBe(true);
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(listbox()).toBeNull();
      expect(host.source()).toBe('rtsp');
      expect(seen).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', seen);
    }
  });

  it('Escape on a closed select goes on to whatever is listening', async () => {
    const { trigger } = await render();
    const seen = vi.fn();
    document.addEventListener('keydown', seen);
    try {
      const escape = press(trigger, 'Escape');

      expect(escape.defaultPrevented).toBe(false);
      expect(seen).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', seen);
    }
  });

  it('Tab closes the list and leaves the value as it was', async () => {
    const { host, trigger, settle } = await render();
    press(trigger, 'ArrowDown');
    await settle();

    press(trigger, 'Tab');
    await settle();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(host.source()).toBeNull();
  });

  it('a click outside closes the list', async () => {
    const { before, trigger, settle } = await render();
    trigger.click();
    await settle();

    before.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    before.click();
    await settle();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('disabled: the trigger is disabled and nothing opens', async () => {
    const { fixture, host, trigger, settle } = await render((host) => host.disabled.set(true));

    expect(trigger.disabled).toBe(true);
    trigger.click();
    press(trigger, 'ArrowDown');
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    host.disabled.set(false);
    await fixture.whenStable();
    expect(trigger.disabled).toBe(false);
  });

  it('a value that is not among the options shows the placeholder in the muted color, not as a choice', async () => {
    const { fixture, host, trigger } = await render((host) => host.source.set('gone'));
    const value = trigger.querySelector('[data-slot="select-value"]')!;

    expect(value.textContent?.trim()).toBe('Pick a source');
    expect(value.classList).toContain('text-muted-foreground');

    host.source.set('usb');
    await fixture.whenStable();
    expect(value.classList).not.toContain('text-muted-foreground');
  });

  it('an empty string is a value like any other, not "nothing picked"', async () => {
    @Component({
      imports: [NeatSelect],
      template: `<neat-select label="Preset" [options]="options" [(value)]="value" />`,
    })
    class EmptyValueHost {
      readonly options: NeatSelectOption<string>[] = [
        { value: '', label: 'None' },
        { value: 'fast', label: 'Fast' },
      ];
      readonly value = signal<string | null>('');
    }
    const fixture = TestBed.createComponent(EmptyValueHost);
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector('[role="combobox"]');

    expect(trigger.textContent.trim()).toBe('None');
    expect(trigger.hasAttribute('data-placeholder')).toBe(false);
  });

  describe('in a dialog', () => {
    async function openDialog() {
      const fixture = TestBed.createComponent(DialogHost);
      await fixture.whenStable();
      const ref = fixture.componentInstance.dialogs.open(fixture.componentInstance.form(), {
        title: 'Assign source',
      });
      await settle(fixture);
      const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
      const trigger = dialog()!.querySelector<HTMLButtonElement>('[role="combobox"]')!;
      return { fixture, ref, dialog, trigger, settle: () => settle(fixture) };
    }

    it('Escape closes the open select only; the next Escape closes the dialog', async () => {
      const { dialog, trigger, settle } = await openDialog();
      trigger.focus();
      press(trigger, 'ArrowDown');
      await settle();
      expect(trigger.getAttribute('aria-expanded')).toBe('true');

      press(trigger, 'Escape');
      await settle();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(dialog()).not.toBeNull();

      press(trigger, 'Escape');
      await settle();
      expect(dialog()).toBeNull();
    });

    it('a pick in the open list leaves the dialog open and the choice in the trigger', async () => {
      const { fixture, dialog, trigger, settle } = await openDialog();
      trigger.focus();
      trigger.click();
      await settle();

      document.querySelectorAll<HTMLElement>('[role="option"]')[3].click();
      await settle();

      expect(dialog()).not.toBeNull();
      expect(fixture.componentInstance.source()).toBe('usb');
      expect(trigger.textContent?.trim()).toBe('USB camera');
    });

    it('the list is in the overlay layer, after the dialog, so it shows above it', async () => {
      const { dialog, trigger, settle } = await openDialog();
      trigger.focus();
      trigger.click();
      await settle();

      const list = panel()!;
      const dialogPane = dialog()!.closest('.cdk-global-overlay-wrapper, .cdk-overlay-pane')!;
      const listPane = list.closest('.cdk-overlay-pane')!;
      expect(dialogPane.contains(list)).toBe(false);
      const order = (element: Element) => {
        let node: Element | null = element;
        while (node && node.parentElement?.className !== 'cdk-overlay-container') {
          node = node.parentElement;
        }
        return node;
      };
      const wrappers = Array.from(order(dialogPane)!.parentElement!.children);
      expect(wrappers.indexOf(order(listPane)!)).toBeGreaterThan(
        wrappers.indexOf(order(dialogPane)!),
      );
    });
  });

  it('draws the select with helm’s classes', async () => {
    const { trigger, settle } = await render();

    expect([...trigger.classList]).toEqual(
      expect.arrayContaining(['border-input', 'rounded-md', 'w-full']),
    );
    expect(trigger.classList).not.toContain('w-fit');
    trigger.click();
    await settle();
    expect([...panel()!.classList]).toEqual(expect.arrayContaining(['bg-popover', 'rounded-md']));
    expect([...document.querySelectorAll('[role="option"]')[0].classList]).toEqual(
      expect.arrayContaining(['data-highlighted:bg-accent', 'rounded-sm']),
    );
  });

  it('helm drift: the copied class strings still appear in the vendored helm select', () => {
    expect(helmTrigger).toContain(SELECT_HELM_CLASSES.trigger);
    expect(helmTrigger).toContain(SELECT_HELM_CLASSES.triggerIcon);
    expect(helmContent).toContain(SELECT_HELM_CLASSES.content);
    expect(helmItem).toContain(SELECT_HELM_CLASSES.item);
    expect(helmItem).toContain(SELECT_HELM_CLASSES.itemCheck);
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const on = (...states: string[]) => (scheme === 'dark' ? ['dark', ...states] : states);
      const q = (on: string[], box?: string) => ({ tokens, vocabulary: VOCABULARY, on, box });

      async function parts() {
        const { trigger, settle } = await render();
        trigger.click();
        await settle();
        return {
          trigger: [...trigger.classList],
          icon: [...trigger.querySelector('neat-icon')!.classList],
          panel: [...panel()!.classList],
          item: [...document.querySelectorAll('[role="option"]')[0].classList],
        };
      }

      it(`${scheme}: the trigger's border reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card, at rest and focused`, async () => {
        const { trigger } = await parts();
        for (const state of [on(), on('focus')]) {
          for (const surface of SURFACES) {
            const under = tokens[surface];
            const border = stateColor(trigger, 'border', q(state), under);
            expect(
              contrastRatio(border, under),
              `${scheme}, [${state.join(', ')}] border on --${surface}: ${border}`,
            ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          }
        }
      });

      it(`${scheme}: the selected text reaches 4.5:1, the placeholder 4.5:1 and the arrow ${MIN_NON_TEXT_CONTRAST}:1 on the trigger, at rest and hovered`, async () => {
        const { trigger, icon } = await parts();
        for (const state of [on(), on('hover')]) {
          for (const surface of SURFACES) {
            const under = tokens[surface];
            const fill = stateColor(trigger, 'bg', q(state), under);
            const typed = stateColor(trigger, 'text', q(state), fill, tokens['foreground']);
            const placeholder = stateColor(trigger, 'text', q(on('placeholder')), fill);
            const arrow = stateColor(icon, 'text', q(state), fill);
            expect(
              contrastRatio(typed, fill),
              `${scheme}, [${state.join(', ')}] text on --${surface}`,
            ).toBeGreaterThanOrEqual(4.5);
            expect(
              contrastRatio(placeholder, fill),
              `${scheme}, [${state.join(', ')}] placeholder on --${surface}`,
            ).toBeGreaterThanOrEqual(4.5);
            expect(
              contrastRatio(arrow, fill),
              `${scheme}, [${state.join(', ')}] arrow on --${surface}`,
            ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          }
        }
      });

      it(`${scheme}: the focus ring reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card`, async () => {
        const { trigger } = await parts();
        expect(trigger).toContain('focus-visible:ring-3');
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const ring = stateColor(trigger, 'ring', q(on('focus')), under);
          expect(
            contrastRatio(ring, under),
            `${scheme}, ring on --${surface}: ${ring}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });

      it(`${scheme}: the list is set off from the page by its outline (${MIN_FILL_CONTRAST}:1 or more, as the popover's is), and the highlighted option from the list`, async () => {
        const { panel, item } = await parts();
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const list = stateColor(panel, 'bg', q(on()), under);
          const outline = stateColor(panel, 'ring', q(on()), under);
          expect(
            contrastRatio(outline, under),
            `${scheme}, outline ${outline} on --${surface}`,
          ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
          const highlight = stateColor(item, 'bg', q(on('highlighted')), list);
          expect(
            contrastRatio(highlight, list),
            `${scheme}, highlight ${highlight} on ${list}`,
          ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
        }
      });

      it(`${scheme}: option text reaches 4.5:1 on the list and on the highlight`, async () => {
        const { panel, item } = await parts();
        const list = stateColor(panel, 'bg', q(on()), tokens['background']);
        const rest = stateColor(panel, 'text', q(on()), list);
        const highlight = stateColor(item, 'bg', q(on('highlighted')), list);
        const highlighted = stateColor(item, 'text', q(on('highlighted')), highlight, rest);
        expect(contrastRatio(rest, list), `${scheme}, ${rest} on ${list}`).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(
          contrastRatio(highlighted, highlight),
          `${scheme}, ${highlighted} on ${highlight}`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
});
