import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** How a key is shown and how a screen reader should say it, on a Mac and elsewhere. */
interface KeyText {
  readonly shown: string;
  readonly spoken: string;
}

/**
 * The keys whose text differs from their name, by the names `aria-keyshortcuts` uses, plus `Mod`:
 * a Mac shows its modifiers as symbols, which a screen reader would read as their Unicode names
 * ("place of interest sign"), so each also has the word to say.
 */
const KEYS = new Map<string, { readonly mac: KeyText; readonly other: KeyText }>([
  ['Mod', { mac: text('⌘', 'Command'), other: text('Ctrl', 'Control') }],
  ['Control', { mac: text('⌃', 'Control'), other: text('Ctrl', 'Control') }],
  ['Meta', { mac: text('⌘', 'Command'), other: text('Meta', 'Meta') }],
  ['Alt', { mac: text('⌥', 'Option'), other: text('Alt', 'Alt') }],
  ['Shift', { mac: text('⇧', 'Shift'), other: text('Shift', 'Shift') }],
  ['Escape', both(text('Esc', 'Escape'))],
  ['ArrowUp', both(text('↑', 'Up arrow'))],
  ['ArrowDown', both(text('↓', 'Down arrow'))],
  ['ArrowLeft', both(text('←', 'Left arrow'))],
  ['ArrowRight', both(text('→', 'Right arrow'))],
]);

function text(shown: string, spoken: string): KeyText {
  return { shown, spoken };
}

function both(keyText: KeyText) {
  return { mac: keyText, other: keyText };
}

/**
 * A keyboard shortcut's keys, each drawn as a key, with what a screen reader says for them.
 *
 * ```html
 * <neat-shortcut [keys]="['Mod', 'K']" />
 * ```
 *
 * `keys` are named as `aria-keyshortcuts` names them: the browser's key values (`Control`, `Alt`,
 * `Shift`, `Meta`, `Escape`, `ArrowUp`, `K`, `F1`), plus `Mod`, the platform's own modifier. `Mod`
 * shows ⌘ on a Mac and Ctrl elsewhere, as an app's handler that takes either key expects. On a
 * Mac the modifiers are its symbols (⌃ ⌥ ⇧ ⌘). `Escape` is Esc, and the arrows are arrows. A
 * single letter is shown in capitals, and any other name as it is written.
 *
 * Each key is a `kbd`, hidden from assistive technology, since a screen reader would read "⌘" by
 * its Unicode name. Visually hidden text says the keys in words instead ("Control K", "Command
 * K").
 *
 * Inside a control whose `aria-keyshortcuts` already names the shortcut, put `aria-hidden="true"`
 * on the part, so the control's name does not say it twice:
 *
 * ```html
 * <button type="button" aria-keyshortcuts="Control+K Meta+K">
 *   Search <neat-shortcut aria-hidden="true" [keys]="['Mod', 'K']" />
 * </button>
 * ```
 *
 * It only shows the keys: listening for them is the app's.
 */
@Component({
  selector: 'neat-shortcut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sr-only">{{ spoken() }}</span>
    @for (key of shown(); track $index) {
      <kbd aria-hidden="true">{{ key }}</kbd>
    }
  `,
  styleUrl: './shortcut.css',
})
export class NeatShortcut {
  /** The keys, in the order they are pressed (`['Mod', 'Shift', 'P']`). */
  readonly keys = input.required<readonly string[]>();

  private readonly platform = isMac() ? 'mac' : 'other';
  private readonly texts = computed(() => this.keys().map((key) => this.textOf(key)));
  protected readonly shown = computed(() => this.texts().map((key) => key.shown));
  protected readonly spoken = computed(() =>
    this.texts()
      .map((key) => key.spoken)
      .join(' '),
  );

  private textOf(key: string): KeyText {
    const known = KEYS.get(key);
    if (known) return known[this.platform];
    const shown = key.length === 1 ? key.toUpperCase() : key;
    return { shown, spoken: shown };
  }
}

/** A Mac, an iPhone or an iPad, whose shortcuts take ⌘ where others take Ctrl. */
function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
}
