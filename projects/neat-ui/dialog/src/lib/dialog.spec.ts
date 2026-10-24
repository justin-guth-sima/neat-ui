import {
  Component,
  computed,
  inject,
  input,
  type OnInit,
  TemplateRef,
  type Type,
  viewChild,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import helmContent from '../../../src/lib/ui/dialog/src/lib/hlm-dialog-content.ts?source' with {
  loader: 'text',
};
import helmFooter from '../../../src/lib/ui/dialog/src/lib/hlm-dialog-footer.ts?source' with {
  loader: 'text',
};
import helmHeader from '../../../src/lib/ui/dialog/src/lib/hlm-dialog-header.ts?source' with {
  loader: 'text',
};
import helmOverlay from '../../../src/lib/ui/dialog/src/lib/hlm-dialog-overlay.ts?source' with {
  loader: 'text',
};
import helmTitle from '../../../src/lib/ui/dialog/src/lib/hlm-dialog-title.ts?source' with {
  loader: 'text',
};
import { NeatButton, contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { NeatConfirm } from '@sima/neat-ui/confirm';
import { MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatDialog, type NeatDialogOptions } from './dialog';
import { DIALOG_HELM_CLASSES } from './dialog-panel';
import { NeatDialogActions, NeatDialogBody } from './dialog-parts';
import { NeatDialogRef } from './dialog-ref';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];

const RENAME: NeatDialogOptions = { title: 'Rename source' };

/** The variants on the colour classes of the dialog and its buttons; none opens a menu. */
const VOCABULARY = {
  dark: 'dark',
  hover: 'hover',
  'focus-visible': 'focus',
  '*': false,
  'aria-expanded': false,
  'data-[matches-spartan-invalid=true]': false,
};

/** Dialog content as a component: it takes the ref from injection, as an app's dialogs do. */
@Component({
  selector: 'neat-rename-form',
  imports: [NeatButton, NeatDialogActions, NeatDialogBody],
  template: `
    <neat-dialog-body>
      <label>
        Name
        <input class="name" />
      </label>
    </neat-dialog-body>
    <neat-dialog-actions>
      <button neatButton type="button" variant="outlined" class="cancel" (click)="dialog.close()">
        Cancel
      </button>
      <button neatButton type="button" class="save" (click)="dialog.close('Front door')">
        Save
      </button>
    </neat-dialog-actions>
  `,
})
class RenameForm {
  protected readonly dialog = inject<NeatDialogRef<string>>(NeatDialogRef);
}

/** Content that takes inputs from its opener: the slot it is for, and the tab it starts on. */
@Component({
  selector: 'neat-source-form',
  imports: [NeatDialogBody],
  template: `<neat-dialog-body
    ><p class="for">src{{ slot() }}, {{ tab() }} tab, {{ heading() }}</p></neat-dialog-body
  >`,
})
class SourceForm implements OnInit {
  readonly slot = input.required<number>();
  readonly tab = input<'local' | 'youtube'>('local');
  protected readonly heading = computed(() => (this.tab() === 'youtube' ? 'YouTube' : 'Local'));

  ngOnInit(): void {
    seenOnInit.push(`${this.slot()} ${this.tab()}`);
  }
}

/** What each `SourceForm` read from its inputs in its init hook. */
const seenOnInit: string[] = [];

/** Content that styles its own host, as components commonly do. */
@Component({
  selector: 'neat-block-host-form',
  imports: [NeatDialogBody],
  styleUrl: './block-host-form.spec.css',
  template: `<neat-dialog-body>Body</neat-dialog-body>`,
})
class BlockHostForm {}

/** A page with an opener and two ways to give a dialog its content: a template or a component. */
@Component({
  imports: [NeatButton, NeatDialogActions, NeatDialogBody],
  template: `
    <button type="button" class="opener">Rename…</button>
    <button type="button" class="elsewhere">Elsewhere</button>
    <button neatButton type="button" class="reference-primary">Primary</button>
    <ng-template #form let-dialog>
      <neat-dialog-body>
        <label>
          Name
          <input class="name" />
        </label>
      </neat-dialog-body>
      <neat-dialog-actions>
        <button neatButton type="button" class="cancel" (click)="dialog.close()">Cancel</button>
        <button neatButton type="button" class="save" (click)="dialog.close('Front door')">
          Save
        </button>
      </neat-dialog-actions>
    </ng-template>
  `,
})
class DialogHost {
  readonly dialogs = inject(NeatDialog);
  readonly form = viewChild.required<TemplateRef<unknown>>('form');
}

/** A template, for the type checks: nothing renders it. */
declare const fixtureTemplate: TemplateRef<unknown>;

/** Whether a promise has settled yet, and with what, without waiting for it. */
function track<T>(promise: Promise<T>) {
  const state: { settled: boolean; value?: T } = { settled: false };
  void promise.then((value) => Object.assign(state, { settled: true, value }));
  return state;
}

describe('NeatDialog', () => {
  const dialogs = () => document.querySelectorAll<HTMLElement>('[role="dialog"]');
  const dialog = (): HTMLElement | null => dialogs()[0] ?? null;
  const button = (name: string) =>
    Array.from(dialog()?.querySelectorAll('button') ?? []).find(
      (candidate) => candidate.textContent?.trim() === name || candidate.ariaLabel === name,
    );

  async function render() {
    const fixture = TestBed.createComponent(DialogHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const opener = root.querySelector<HTMLButtonElement>('.opener')!;
    /** Runs pending timers and render hooks: focus moves after render, closing waits a frame. */
    const settle = async () => {
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      }
    };
    const host = fixture.componentInstance;
    /** Opens as an app does: from a click on the opener, which has focus. */
    const open = async <R = string>(
      content: TemplateRef<unknown> | Type<unknown> = host.form(),
      options: NeatDialogOptions = RENAME,
    ) => {
      opener.focus();
      const ref = host.dialogs.open<R>(content, options);
      await settle();
      return ref;
    };
    return { fixture, root, opener, settle, open };
  }

  const escape = () =>
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
  const clickBackdrop = () => {
    const backdrop = document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!;
    backdrop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    backdrop.click();
  };

  /**
   * Tab or Shift+Tab as the browser does it, which jsdom does not: focus moves to the next (or
   * previous) element in document order that takes focus from the keyboard. The CDK focus trap's
   * anchors are such elements, so this is what sends focus through them.
   */
  const tab = (backwards = false) => {
    const order = Array.from(
      document.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex]'),
    ).filter((element) => element.tabIndex >= 0);
    const index = order.indexOf(document.activeElement as HTMLElement);
    order[(index + (backwards ? order.length - 1 : 1)) % order.length].focus();
  };

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('opens a modal named by its title, traps focus and restores it to the opener on close', async () => {
    const { root, opener, settle, open } = await render();
    // jsdom lays nothing out, and the focus trap only moves focus to elements it can see.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
    expect(dialog()).toBeNull();

    const ref = await open();

    expect(dialogs()).toHaveLength(1);
    const panel = dialog()!;
    expect(panel.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(panel.getAttribute('aria-labelledby')!);
    expect(title?.textContent?.trim()).toBe('Rename source');
    expect(title?.tagName).toBe('H2');
    expect(panel.contains(title)).toBe(true);
    // The page behind is hidden from assistive technology while the dialog is open.
    expect(root.closest('[aria-hidden="true"]')).not.toBeNull();

    // Focus starts on the first control of the content and Tab cycles through the dialog only.
    const name = panel.querySelector<HTMLInputElement>('.name')!;
    const cancel = button('Cancel')!;
    const save = button('Save')!;
    const close = button('Close')!;
    expect(document.activeElement).toBe(name);
    tab();
    expect(document.activeElement).toBe(cancel);
    tab();
    expect(document.activeElement).toBe(save);
    tab();
    expect(document.activeElement).toBe(close);
    tab();
    expect(document.activeElement).toBe(name);
    tab(true);
    expect(document.activeElement).toBe(close);

    ref.close();
    await settle();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);

    // Focus returns to whatever had it, not to a fixed element.
    const elsewhere = root.querySelector<HTMLButtonElement>('.elsewhere')!;
    elsewhere.focus();
    const again = TestBed.inject(NeatDialog).open(RenameForm, RENAME);
    await settle();
    again.close();
    await settle();
    expect(document.activeElement).toBe(elsewhere);
  });

  it('names a component by its title too, and a component can inject its ref', async () => {
    const { settle, open } = await render();

    const ref = await open<string>(RenameForm);
    expect(
      document.getElementById(dialog()!.getAttribute('aria-labelledby')!)?.textContent?.trim(),
    ).toBe('Rename source');
    const closed = track(ref.closed);

    button('Save')!.click();
    await settle();
    expect(closed).toEqual({ settled: true, value: 'Front door' });
  });

  it('sets the inputs the opener gives a component before the component first runs', async () => {
    const { fixture, settle } = await render();
    const dialogs = fixture.componentInstance.dialogs;

    const ref = dialogs.open(SourceForm, {
      title: 'Change source',
      inputs: { slot: 3, tab: 'youtube' },
    });
    await settle();
    expect(dialog()!.querySelector('.for')?.textContent).toBe('src3, youtube tab, YouTube');

    ref.close();
    await settle();
    // An input left out keeps its default.
    dialogs.open(SourceForm, { title: 'Change source', inputs: { slot: 5 } });
    await settle();
    expect(dialog()!.querySelector('.for')?.textContent).toBe('src5, local tab, Local');
  });

  it('has the component see its inputs in its init hook', async () => {
    const { fixture, settle } = await render();
    seenOnInit.length = 0;

    fixture.componentInstance.dialogs.open(SourceForm, {
      title: 'Change source',
      inputs: { slot: 2, tab: 'youtube' },
    });
    await settle();
    expect(seenOnInit).toEqual(['2 youtube']);
  });

  it('types the inputs by the component and the result by the second type argument', () => {
    // Checked when the spec compiles; never called.
    const check = (dialogs: NeatDialog) => {
      const ref: NeatDialogRef<string> = dialogs.open<SourceForm, string>(SourceForm, {
        title: 'Change source',
        inputs: { slot: 1 },
      });
      // @ts-expect-error: the component has no input of that name.
      dialogs.open(SourceForm, { title: 'Change source', inputs: { slots: 1 } });
      // @ts-expect-error: the input takes a number.
      dialogs.open(SourceForm, { title: 'Change source', inputs: { slot: '1' } });
      // @ts-expect-error: a template has no inputs.
      dialogs.open(fixtureTemplate, { title: 'Rename source', inputs: { slot: 1 } });
      return ref;
    };
    expect(check).toBeTypeOf('function');
  });

  it('Escape and the backdrop close a dismissible dialog and do nothing while setDismissible(false)', async () => {
    const { opener, settle, open } = await render();

    const byEscape = await open();
    const escaped = track(byEscape.closed);
    escape();
    await settle();
    expect(escaped).toEqual({ settled: true, value: undefined });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);

    const byBackdrop = await open();
    const clicked = track(byBackdrop.closed);
    clickBackdrop();
    await settle();
    expect(clicked).toEqual({ settled: true, value: undefined });
    expect(dialog()).toBeNull();

    // Busy: neither closes it, and the close button is dimmed and does nothing.
    const busy = await open();
    const stayed = track(busy.closed);
    expect(button('Close')!.hasAttribute('aria-disabled')).toBe(false);
    busy.setDismissible(false);
    await settle();
    expect(busy.dismissible()).toBe(false);
    expect(button('Close')!.getAttribute('aria-disabled')).toBe('true');
    // The dimmed look is neatButton's own for aria-disabled, not a second copy in the dialog.
    expect(button('Close')!.classList).toContain('aria-disabled:opacity-50');
    escape();
    clickBackdrop();
    button('Close')!.click();
    await settle();
    expect(dialog()).not.toBeNull();
    expect(stayed.settled).toBe(false);

    // The dialog's own buttons and close() still work, and so does Escape once it is free again.
    busy.setDismissible(true);
    await settle();
    expect(button('Close')!.hasAttribute('aria-disabled')).toBe(false);
    escape();
    await settle();
    expect(stayed).toEqual({ settled: true, value: undefined });
    expect(dialog()).toBeNull();
  });

  it('dismissible: false opens a dialog that Escape and the backdrop leave open', async () => {
    const { settle, open } = await render();
    const ref = await open(undefined, { ...RENAME, dismissible: false });

    escape();
    clickBackdrop();
    await settle();
    expect(dialog()).not.toBeNull();
    expect(button('Close')!.getAttribute('aria-disabled')).toBe('true');

    ref.close('done');
    await settle();
    expect(dialog()).toBeNull();
  });

  it('a handled Escape stops at the dialog: document and window listeners never see it, busy or not', async () => {
    const { settle, open } = await render();
    const seen = vi.fn();
    document.addEventListener('keydown', seen);
    window.addEventListener('keydown', seen);
    try {
      const ref = await open();
      escape();
      await settle();
      expect(dialog()).toBeNull();
      expect(seen).not.toHaveBeenCalled();

      const busy = await open(undefined, { ...RENAME, dismissible: false });
      escape();
      await settle();
      expect(dialog()).not.toBeNull();
      expect(seen).not.toHaveBeenCalled();

      // Other keys are the page's own.
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
      );
      expect(seen).toHaveBeenCalledTimes(2);
      busy.close();
      void ref;
    } finally {
      document.removeEventListener('keydown', seen);
      window.removeEventListener('keydown', seen);
    }
  });

  it('keeps focus in the dialog when it turns busy while the close button has it', async () => {
    const { settle, open } = await render();
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
    const ref = await open();
    const close = button('Close')!;
    close.focus();

    ref.setDismissible(false);
    await settle();

    expect(close.isConnected).toBe(true);
    expect(document.activeElement).toBe(close);
    // Tab still cycles inside the dialog.
    tab();
    expect(dialog()!.contains(document.activeElement)).toBe(true);
  });

  it('navigation closes a dialog even when it is not dismissible, as a dismissal', async () => {
    const { settle, open } = await render();
    const ref = await open(undefined, { ...RENAME, dismissible: false });
    const closed = track(ref.closed);

    window.dispatchEvent(new PopStateEvent('popstate'));
    await settle();

    expect(closed).toEqual({ settled: true, value: undefined });
    expect(dialog()).toBeNull();
  });

  it('closed resolves with the result given to close(), once the dialog has closed', async () => {
    const { opener, settle, open } = await render();
    const ref = await open();
    const closed = track(ref.closed);

    button('Save')!.click();
    expect(closed.settled).toBe(false);
    await settle();
    expect(closed).toEqual({ settled: true, value: 'Front door' });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);

    // Closing again changes nothing, and a result given late does not replace the first.
    ref.close('late');
    expect(await ref.closed).toBe('Front door');
  });

  it('the close button closes a dismissible dialog without a result', async () => {
    const { settle, open } = await render();
    const ref = await open();
    const closed = track(ref.closed);

    button('Close')!.click();
    await settle();
    expect(closed).toEqual({ settled: true, value: undefined });
  });

  it('Escape closes only the topmost dialog: a confirm asked from a dialog leaves it open', async () => {
    const { settle, open } = await render();
    const ref = await open();
    const closed = track(ref.closed);

    const name = dialog()!.querySelector<HTMLInputElement>('.name')!;
    name.focus();
    const asked = track(
      TestBed.inject(NeatConfirm).ask({
        title: 'Discard?',
        message: 'Sure.',
        confirmLabel: 'Discard',
      }),
    );
    await settle();
    escape();
    await settle();
    expect(asked).toEqual({ settled: true, value: false });
    expect(closed.settled).toBe(false);
    expect(dialog()).not.toBeNull();
    // The confirm gives focus back to where it was in the dialog, so the dialog's trap resumes.
    expect(document.activeElement).toBe(name);
  });

  it('size picks the panel width: medium by default, small and large on request', async () => {
    const { settle, open } = await render();
    const widths = async (size?: NeatDialogOptions['size']) => {
      const ref = await open(undefined, { ...RENAME, size });
      const classes = [...document.querySelector('[data-slot="dialog-content"]')!.classList];
      ref.close();
      await settle();
      return classes;
    };

    expect(await widths()).toEqual(expect.arrayContaining(['sm:w-lg']));
    expect(await widths('medium')).toEqual(expect.arrayContaining(['sm:w-lg']));
    expect(await widths('small')).toEqual(expect.arrayContaining(['sm:w-sm']));
    expect(await widths('large')).toEqual(expect.arrayContaining(['sm:w-3xl']));
  });

  it('draws the dialog with helm’s dialog classes, the panel outlined in --border', async () => {
    const { open } = await render();
    await open();

    const panel = document.querySelector('[data-slot="dialog-content"]')!;
    expect([...panel.classList]).toEqual(
      expect.arrayContaining(['bg-popover', 'text-popover-foreground', 'ring-1', 'ring-border']),
    );
    expect(panel.classList).not.toContain('ring-foreground/10');
    expect(panel.getAttribute('data-state')).toBe('open');
    expect(document.querySelector('.cdk-overlay-backdrop')!.classList).toContain('bg-black/10');
  });

  it('lays a component’s own element out as part of the panel, and the body scrolls on its own', async () => {
    const { open } = await render();
    await open<string>(RenameForm);

    const host = document.querySelector<HTMLElement>('neat-rename-form')!;
    expect(host.style.display).toBe('contents');
    const body = document.querySelector('neat-dialog-body')!;
    expect([...body.classList]).toEqual(expect.arrayContaining(['min-h-0', 'overflow-y-auto']));
    expect(body.parentElement).toBe(host);
    expect(document.querySelector('neat-dialog-actions')!.className).toBe(
      DIALOG_HELM_CLASSES.footer,
    );
  });

  it('a component’s own `:host { display: block }` does not undo its layout as part of the panel', async () => {
    const { open } = await render();
    await open<string>(BlockHostForm);

    const host = document.querySelector<HTMLElement>('neat-block-host-form')!;
    expect(getComputedStyle(host).display).toBe('contents');
  });

  it('helm drift: the copied class strings still appear in the vendored helm dialog', () => {
    expect(helmContent).toContain(DIALOG_HELM_CLASSES.content);
    expect(helmContent).toContain(DIALOG_HELM_CLASSES.closeButton);
    expect(helmHeader).toContain(DIALOG_HELM_CLASSES.header);
    expect(helmTitle).toContain(DIALOG_HELM_CLASSES.title);
    expect(helmFooter).toContain(DIALOG_HELM_CLASSES.footer);
    expect(helmOverlay).toContain(DIALOG_HELM_CLASSES.overlay);
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const q = (on: string[]) => ({ tokens, vocabulary: VOCABULARY, on });
      const on = (...states: string[]) => (scheme === 'dark' ? ['dark', ...states] : states);

      it(`${scheme}: the title, the body text and the buttons meet the theme contrast rules`, async () => {
        const { open } = await render();
        await open();
        const classesOf = (element: Element) => [...element.classList];
        const panel = classesOf(document.querySelector('[data-slot="dialog-content"]')!);
        const title = classesOf(
          document.getElementById(dialog()!.getAttribute('aria-labelledby')!)!,
        );

        const fill = stateColor(panel, 'bg', q(on()), tokens['background']);
        expect(fill).toBe(tokens['popover']);
        const panelText = stateColor(panel, 'text', q(on()), fill);
        const titleText = stateColor(title, 'text', q(on()), fill, panelText);
        expect(contrastRatio(panelText, fill), `${scheme}: body text`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(titleText, fill), `${scheme}: title`).toBeGreaterThanOrEqual(4.5);

        for (const name of ['Cancel', 'Save', 'Close']) {
          const classes = classesOf(button(name)!);
          for (const hover of [[], ['hover']]) {
            const buttonFill = stateColor(classes, 'bg', q(on(...hover)), fill);
            const text = stateColor(classes, 'text', q(on(...hover)), buttonFill, panelText);
            expect(
              contrastRatio(text, buttonFill),
              `${scheme}: ${name} ${hover.join('')} ${text} on ${buttonFill}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
          const ring = stateColor(classes, 'ring', q(on('focus')), fill);
          expect(
            contrastRatio(ring, fill),
            `${scheme}: ${name} focus ring ${ring} on ${fill}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });
    }
  });
});
