import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { NeatIcon } from '../icon/icon';
import { NeatRailItem } from '../shell/rail-item';
import type { NeatTone } from '../theme/tone';

/**
 * How the app stands with its board, the kit's words for it.
 *
 * - `loading`: the app has not read its board settings yet.
 * - `not-selected`: no board is chosen.
 * - `not-checked`: a board is chosen and nobody has looked whether it answers.
 * - `checking`: the app is looking.
 * - `connecting`: the app is making the connection.
 * - `connected`: the board answers and the app is connected.
 * - `unreachable`: the board does not answer.
 */
export type NeatBoardConnection =
  | 'loading'
  | 'not-selected'
  | 'not-checked'
  | 'checking'
  | 'connecting'
  | 'connected'
  | 'unreachable';

/** What the app says about its board beyond the connection: words and the tone of their dot. */
export interface NeatBoardStatus {
  /** The words, short enough for a rail's second line ("Loading models"). */
  readonly text: string;
  /** The tone of the item's dot while the status is set. */
  readonly tone: NeatTone;
}

/** The kit's words and tone for each connection. */
const CONNECTIONS: Readonly<Record<NeatBoardConnection, { text: string; tone: NeatTone }>> = {
  loading: { text: 'Loading…', tone: 'neutral' },
  'not-selected': { text: 'Not selected', tone: 'neutral' },
  'not-checked': { text: 'Not checked', tone: 'neutral' },
  checking: { text: 'Checking…', tone: 'warning' },
  connecting: { text: 'Connecting…', tone: 'warning' },
  connected: { text: 'Connected', tone: 'success' },
  unreachable: { text: 'Not reachable', tone: 'danger' },
};

/**
 * The shell's rail block for the board an app works with: its name, its address and how the app
 * stands with it.
 *
 * ```html
 * <neat-board-item neatRailEnd name="DevKit" address="192.168.1.20" connection="connected"
 *                  (activated)="openBoardDialog()" />
 * ```
 *
 * Put it in the rail's end slot with `neatRailEnd`, as any rail item. It is a rail item with the
 * kit's `board` icon, so it looks and tabs like the others, and says the board's state three
 * ways:
 *
 * - The dot takes the tone of `status` while the app sets one, else of `connection`.
 * - The second line is the status's text, else the address while connected, else the connection's
 *   words.
 * - The name and the tooltip are one sentence: the name, the address, the connection's words (with
 *   `reason` after a colon) and the status's text, joined by commas, empty parts left out
 *   ("DevKit, 192.168.1.20, Connected, Loading models").
 *
 * A polite live region says that sentence whenever it changes, so an app builds no region of its
 * own. It says nothing on the first render and nothing when an input changes to an equal value.
 *
 * Why a button: it opens the app's dialog for choosing and checking the board, as the app's
 * `activated` handler decides (`aria-haspopup="dialog"`). An app with a Board page lists that page
 * among its pages, and its dialog links there; the item itself is no link.
 */
@Component({
  selector: 'neat-board-item',
  imports: [NeatIcon, NeatRailItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      neatRailItem
      type="button"
      aria-haspopup="dialog"
      [label]="label()"
      [text]="name()"
      [detail]="second()"
      [tone]="tone()"
      (click)="activated.emit()"
    >
      <neat-icon name="board" />
    </button>
    <span class="sr-only" role="status" aria-live="polite">{{ announcement() }}</span>
  `,
  styleUrl: './board-item.css',
})
export class NeatBoardItem {
  /** The board's name, the item's first line ("DevKit"). */
  readonly name = input.required<string>();
  /** The board's address, shown as the second line while connected; null while there is none. */
  readonly address = input<string | null>(null);
  /** How the app stands with the board: the kit's words and the dot's tone follow from it. */
  readonly connection = input.required<NeatBoardConnection>();
  /** Why the connection is as it is ("Timed out"), added to its words in the name and tooltip. */
  readonly reason = input<string | null>(null);
  /**
   * What the app says beyond the connection ("Loading models"). While set it outranks the
   * connection in the second line and the dot, and ends the name and tooltip.
   */
  readonly status = input<NeatBoardStatus | null>(null);
  /** Emitted when the item is pressed (a click, Enter or Space): the app opens its dialog. */
  readonly activated = output<void>();

  private readonly connectionWords = computed(() => CONNECTIONS[this.connection()]);

  protected readonly tone = computed(() => this.status()?.tone ?? this.connectionWords().tone);

  protected readonly second = computed(() => {
    const address = this.address();
    return (
      this.status()?.text ??
      (this.connection() === 'connected' && address ? address : this.connectionWords().text)
    );
  });

  protected readonly label = computed(() => {
    const reason = this.reason();
    const words = this.connectionWords().text;
    return [
      this.name(),
      this.address(),
      reason ? `${words}: ${reason}` : words,
      this.status()?.text,
    ]
      .filter((part) => !!part)
      .join(', ');
  });

  /**
   * The live region's text: empty at first, then each new label. Only a different label writes it,
   * since a computed signal does not change for an equal string.
   */
  protected readonly announcement = linkedSignal<string, string>({
    source: this.label,
    computation: (label, previous) => (previous === undefined ? '' : label),
  });
}
