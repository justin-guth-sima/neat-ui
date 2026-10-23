import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import helmContent from '../../../src/lib/ui/alert-dialog/src/lib/hlm-alert-dialog-content.ts?source' with {
  loader: 'text',
};
import helmDescription from '../../../src/lib/ui/alert-dialog/src/lib/hlm-alert-dialog-description.ts?source' with {
  loader: 'text',
};
import helmFooter from '../../../src/lib/ui/alert-dialog/src/lib/hlm-alert-dialog-footer.ts?source' with {
  loader: 'text',
};
import helmHeader from '../../../src/lib/ui/alert-dialog/src/lib/hlm-alert-dialog-header.ts?source' with {
  loader: 'text',
};
import helmOverlay from '../../../src/lib/ui/alert-dialog/src/lib/hlm-alert-dialog-overlay.ts?source' with {
  loader: 'text',
};
import helmTitle from '../../../src/lib/ui/alert-dialog/src/lib/hlm-alert-dialog-title.ts?source' with {
  loader: 'text',
};
import { NeatButton, contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor, stateValue } from '../../../src/lib/theme/state-colors';
import { CONFIRM_HELM_CLASSES, NeatConfirm, type NeatConfirmOptions } from './confirm';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
/** The surfaces the dialog opens over: the page and a card, both dimmed by its backdrop. */
const SURFACES = ['background', 'card'] as const;

/** The bulk reset the viewer's inspector asks about. */
const RESET_ALL: NeatConfirmOptions = {
  title: 'Reset all channels to global?',
  message: "4 settings on 3 channels go back to the global values. This can't be undone.",
  confirmLabel: 'Reset',
  tone: 'danger',
};

/**
 * The variants on the colour classes of the dialog and its buttons. The message's `*:` classes
 * style links inside it, which it never has; the buttons never open a menu or fail validation.
 */
const VOCABULARY = {
  dark: 'dark',
  hover: 'hover',
  'focus-visible': 'focus',
  '*': false,
  'aria-expanded': false,
  'data-[matches-spartan-invalid=true]': false,
};

/** A page with an opener, and buttons of the kit's primary and danger variants to compare with. */
@Component({
  imports: [NeatButton],
  template: `
    <button type="button" class="opener">Reset all channels to global…</button>
    <button type="button" class="elsewhere">Elsewhere</button>
    <button neatButton type="button" class="reference-primary">Primary</button>
    <button neatButton type="button" variant="danger" class="reference-danger">Danger</button>
  `,
})
class ConfirmHost {
  readonly confirm = inject(NeatConfirm);
}

/** Whether a promise has settled yet, and with what, without waiting for it. */
function track(promise: Promise<boolean>) {
  const state: { settled: boolean; value?: boolean } = { settled: false };
  void promise.then((value) => Object.assign(state, { settled: true, value }));
  return state;
}

describe('NeatConfirm', () => {
  const dialogs = () => document.querySelectorAll<HTMLElement>('[role="alertdialog"]');
  const dialog = (): HTMLElement | null => dialogs()[0] ?? null;
  const button = (name: string) =>
    Array.from(dialog()?.querySelectorAll('button') ?? []).find(
      (candidate) => candidate.textContent?.trim() === name,
    );

  async function render() {
    const fixture = TestBed.createComponent(ConfirmHost);
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
    /** Asks as an app does: from a click on the opener, which has focus. */
    const ask = async (options: NeatConfirmOptions = RESET_ALL) => {
      opener.focus();
      const answer = track(fixture.componentInstance.confirm.ask(options));
      await settle();
      return answer;
    };
    return { fixture, root, opener, settle, ask };
  }

  const escape = () =>
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );

  /**
   * Tab or Shift+Tab as the browser does it, which jsdom does not: focus moves to the next (or
   * previous) element in document order that takes focus from the keyboard. The CDK focus trap's
   * anchors are such elements, so this is what sends focus through them.
   */
  const tab = (backwards = false) => {
    const order = Array.from(
      document.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]'),
    ).filter((element) => element.tabIndex >= 0);
    const index = order.indexOf(document.activeElement as HTMLElement);
    order[(index + (backwards ? order.length - 1 : 1)) % order.length].focus();
  };

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('ask shows an alertdialog named by the title and described by the message, focus on Cancel', async () => {
    const { ask } = await render();
    expect(dialog()).toBeNull();

    await ask();

    expect(dialogs()).toHaveLength(1);
    const alert = dialog()!;
    expect(alert.getAttribute('aria-modal')).toBe('true');
    const title = document.getElementById(alert.getAttribute('aria-labelledby')!);
    const message = document.getElementById(alert.getAttribute('aria-describedby')!);
    expect(title?.textContent?.trim()).toBe('Reset all channels to global?');
    expect(message?.textContent?.trim()).toBe(RESET_ALL.message);
    expect(alert.contains(title)).toBe(true);
    expect(alert.contains(message)).toBe(true);

    // The default cancel label, and the confirm label as given.
    expect(button('Cancel')).toBeDefined();
    expect(button('Reset')).toBeDefined();
    expect(button('Cancel')!.type).toBe('button');
    expect(button('Reset')!.type).toBe('button');
    expect(document.activeElement).toBe(button('Cancel'));
  });

  it('a cancelLabel replaces Cancel', async () => {
    const { ask } = await render();

    await ask({ ...RESET_ALL, cancelLabel: 'Keep them' });

    expect(button('Cancel')).toBeUndefined();
    expect(document.activeElement).toBe(button('Keep them'));
  });

  it('Reset resolves true, Cancel and Escape resolve false; focus returns to the opener', async () => {
    const { root, opener, settle, ask } = await render();

    const confirmed = await ask();
    button('Reset')!.click();
    await settle();
    expect(confirmed).toEqual({ settled: true, value: true });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);

    const cancelled = await ask();
    button('Cancel')!.click();
    await settle();
    expect(cancelled).toEqual({ settled: true, value: false });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);

    const escaped = await ask();
    escape();
    await settle();
    expect(escaped).toEqual({ settled: true, value: false });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);

    // Focus returns to whatever had it, not to a fixed element.
    const elsewhere = root.querySelector<HTMLButtonElement>('.elsewhere')!;
    elsewhere.focus();
    const fromElsewhere = track(TestBed.inject(NeatConfirm).ask(RESET_ALL));
    await settle();
    escape();
    await settle();
    expect(fromElsewhere).toEqual({ settled: true, value: false });
    expect(document.activeElement).toBe(elsewhere);
  });

  it('a backdrop click leaves it open; Tab stays inside the dialog', async () => {
    const { root, settle, ask } = await render();
    // jsdom lays nothing out, and the focus trap only moves focus to elements it can see.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
    const answer = await ask();

    const backdrop = document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!;
    expect(backdrop).not.toBeNull();
    backdrop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    backdrop.click();
    await settle();
    expect(dialog()).not.toBeNull();
    expect(answer.settled).toBe(false);

    // Modal: the page behind is hidden from assistive technology while the dialog is open.
    expect(root.closest('[aria-hidden="true"]')).not.toBeNull();

    const cancel = button('Cancel')!;
    const reset = button('Reset')!;
    expect(document.activeElement).toBe(cancel);
    tab();
    expect(document.activeElement).toBe(reset);
    tab();
    expect(document.activeElement).toBe(cancel);
    tab(true);
    expect(document.activeElement).toBe(reset);
    tab(true);
    expect(document.activeElement).toBe(cancel);
    expect(answer.settled).toBe(false);
  });

  it('tone=danger renders the confirm button destructive; default renders it primary', async () => {
    const { root, settle, ask } = await render();
    const classesOf = (element: Element) => [...element.classList].sort();
    const danger = classesOf(root.querySelector('.reference-danger')!).filter(
      (name) => name !== 'reference-danger',
    );
    const primary = classesOf(root.querySelector('.reference-primary')!).filter(
      (name) => name !== 'reference-primary',
    );

    await ask();
    expect(classesOf(button('Reset')!)).toEqual(danger);
    expect(button('Reset')!.classList).toContain('text-destructive');
    escape();
    await settle();

    await ask({ ...RESET_ALL, tone: undefined });
    expect(classesOf(button('Reset')!)).toEqual(primary);
    expect(button('Reset')!.classList).toContain('bg-primary');
    escape();
    await settle();

    await ask({ ...RESET_ALL, tone: 'default' });
    expect(classesOf(button('Reset')!)).toEqual(primary);
  });

  it('a second ask resolves the first false and shows the second', async () => {
    const { opener, settle, ask } = await render();
    const first = await ask();

    const second = track(
      TestBed.inject(NeatConfirm).ask({
        title: 'Reset Confidence on 2 channels?',
        message: "They go back to the global value (50 %). This can't be undone.",
        confirmLabel: 'Reset',
        tone: 'danger',
      }),
    );
    expect(first).toEqual({ settled: false });
    await Promise.resolve();
    expect(first).toEqual({ settled: true, value: false });

    await settle();
    expect(dialogs()).toHaveLength(1);
    const title = document.getElementById(dialog()!.getAttribute('aria-labelledby')!);
    expect(title?.textContent?.trim()).toBe('Reset Confidence on 2 channels?');
    expect(document.activeElement).toBe(button('Cancel'));

    // The second gives focus back to where the first came from, not to the first's buttons.
    button('Reset')!.click();
    await settle();
    expect(second).toEqual({ settled: true, value: true });
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('an ask while a pressed Reset is still closing keeps that answer true', async () => {
    const { opener, settle, ask } = await render();
    const first = await ask();

    // Reset starts the exit animation; the next ask comes before it ends.
    button('Reset')!.click();
    const second = track(TestBed.inject(NeatConfirm).ask(RESET_ALL));
    await Promise.resolve();
    expect(first).toEqual({ settled: true, value: true });

    await settle();
    expect(dialogs()).toHaveLength(1);
    expect(document.activeElement).toBe(button('Cancel'));
    escape();
    await settle();
    expect(second).toEqual({ settled: true, value: false });
    expect(document.activeElement).toBe(opener);
  });

  it('draws the dialog with helm’s alert-dialog classes, the panel outlined in --border', async () => {
    const { ask } = await render();
    await ask();

    const panel = dialog()!.querySelector('[data-slot="alert-dialog-content"]')!;
    expect([...panel.classList]).toEqual(
      expect.arrayContaining(['bg-popover', 'text-popover-foreground', 'ring-1', 'ring-border']),
    );
    expect(panel.classList).not.toContain('ring-foreground/10');
    expect(panel.getAttribute('data-state')).toBe('open');
    const backdrop = document.querySelector('.cdk-overlay-backdrop')!;
    expect(backdrop.classList).toContain('bg-black/10');
  });

  it('helm drift: the copied class strings still appear in the vendored helm alert dialog', () => {
    expect(helmContent).toContain(CONFIRM_HELM_CLASSES.content);
    expect(helmHeader).toContain(CONFIRM_HELM_CLASSES.header);
    expect(helmTitle).toContain(CONFIRM_HELM_CLASSES.title);
    expect(helmDescription).toContain(CONFIRM_HELM_CLASSES.description);
    expect(helmFooter).toContain(CONFIRM_HELM_CLASSES.footer);
    expect(helmOverlay).toContain(CONFIRM_HELM_CLASSES.overlay);
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const q = (on: string[]) => ({ tokens, vocabulary: VOCABULARY, on });
      const on = (...states: string[]) => (scheme === 'dark' ? ['dark', ...states] : states);

      it(`${scheme}: title, message and buttons meet the theme contrast rules`, async () => {
        const { ask } = await render();
        await ask();
        const alert = dialog()!;
        const classesOf = (element: Element) => [...element.classList];
        const panel = classesOf(alert.querySelector('[data-slot="alert-dialog-content"]')!);
        const title = classesOf(document.getElementById(alert.getAttribute('aria-labelledby')!)!);
        const message = classesOf(
          document.getElementById(alert.getAttribute('aria-describedby')!)!,
        );

        // What the panel covers: the page or a card, under the backdrop's tint.
        const backdrop = classesOf(document.querySelector('.cdk-overlay-backdrop')!);
        const dimmed = SURFACES.map((surface) =>
          stateColor(backdrop, 'bg', q(on()), tokens[surface]),
        );
        expect(dimmed).not.toContain(tokens['background']);

        const fill = stateColor(panel, 'bg', q(on()), tokens['background']);
        expect(fill).toBe(tokens['popover']);
        const panelText = stateColor(panel, 'text', q(on()), fill);
        const titleText = stateColor(title, 'text', q(on()), fill, panelText);
        const messageText = stateColor(message, 'text', q(on()), fill, panelText);
        for (const [name, text] of [
          ['title', titleText],
          ['message', messageText],
        ]) {
          expect(
            contrastRatio(text, fill),
            `${scheme}: ${name} ${text} on ${fill}`,
          ).toBeGreaterThanOrEqual(4.5);
        }

        // The outline, as the popover's: the theme's border token, visible against the panel and
        // the dimmed surfaces around it.
        expect(stateValue(panel, 'ring', q(on()))).toBe('border');
        const border = stateColor(panel, 'ring', q(on()), fill);
        for (const surface of [fill, ...dimmed]) {
          expect(
            contrastRatio(border, surface),
            `${scheme}: border ${border} on ${surface}`,
          ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
        }

        for (const name of ['Cancel', 'Reset']) {
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
