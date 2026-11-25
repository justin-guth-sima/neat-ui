import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NeatButton, NeatIcon, NeatTooltip } from '@sima/neat-ui';
import { pictureFromFile, revokePicture } from './pictures';
import type { NeatChatDraft, NeatChatPicture } from './types';

/**
 * What the board is doing with the last question: `idle` (nothing), `waiting` (sent, no word yet)
 * or `streaming` (the reply arrives).
 */
export type NeatMessageBoxActivity = 'idle' | 'waiting' | 'streaming';

/**
 * How the box shows that the board works on a reply: `comet`, a bright head with a colored tail
 * running round its edge, or `none`.
 */
export type NeatMessageBoxGlow = 'comet' | 'none';

/** Numbers each message box, for the ids its parts have. */
let nextBox = 0;

/** The browser grows a text area with its content by itself (`field-sizing`), or not. */
const SIZES_ITSELF = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');

/**
 * Where the visitor writes a question, adds pictures to it, sends it, or stops the reply.
 *
 * ```html
 * <neat-message-box
 *   [activity]="conversation.activity()"
 *   (send)="conversation.ask($event)"
 *   (stop)="conversation.stop()"
 * />
 * ```
 *
 * The text area grows with what is written, up to eight lines, then scrolls. Enter sends,
 * Shift+Enter starts a new line, and Enter while an input method composes (Japanese, say) only
 * composes. A draft is its text and its pictures; one with neither cannot be sent, and Send says so
 * (`aria-disabled`). Sent, the box is empty again.
 *
 * **While the board works** (`activity` other than `idle`) Send is Stop, which emits `stop`, and
 * Enter sends nothing. The `glow` shows it too: the comet breathes round the edge while the board
 * reads the question (`waiting`) and runs once every `glowTurnMs` × 0.6 while the reply arrives
 * (`streaming`), the look and pace of the mockup it was chosen from.
 *
 * **Pictures** come from the Picture button (the system's file chooser) or a drop of image files
 * on the box, up to `maxPictures`, each a thumbnail with a button that removes it. Files that are
 * no images are left out. The pictures' object URLs are the box's until it sends them; then they
 * are the app's (see `pictureFromFile`).
 *
 * `text` and `pictures` are models, so an app can keep or restore a draft.
 */
@Component({
  selector: 'neat-message-box',
  imports: [NeatButton, NeatIcon, NeatTooltip],
  host: {
    '[attr.data-activity]': 'activity()',
    '[attr.data-glow]': "glow() === 'none' ? null : glow()",
    '[style.--neat-glow-turn]': "glowTurnMs() + 'ms'",
  },
  templateUrl: './message-box.html',
  styleUrl: './message-box.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeatMessageBox {
  /** What the board is doing with the last question; Send is Stop while it is not `idle`. */
  readonly activity = input<NeatMessageBoxActivity>('idle');
  /**
   * The glow round the box while the board works: it breathes until the first word and runs while
   * the reply arrives, at its own pace, not the reply's. Still under reduced motion.
   */
  readonly glow = input<NeatMessageBoxGlow>('comet');
  /** How long the glow takes once round the box while the reply arrives, in ms. */
  readonly glowTurnMs = input(2400);
  /** The text area's hint while it is empty. */
  readonly placeholder = input('Ask something…');
  /** The text area's name for assistive technology. */
  readonly label = input('Message');
  /** No writing, no pictures and no sending. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** How many pictures a draft may hold. */
  readonly maxPictures = input(4);
  /** The draft's text. */
  readonly text = model('');
  /** The draft's pictures. */
  readonly pictures = model<readonly NeatChatPicture[]>([]);
  /** A draft was sent: its text (trimmed) and its pictures, which are the app's from now on. */
  readonly send = output<NeatChatDraft>();
  /** Stop was pressed while the board worked. */
  readonly stop = output<void>();

  protected readonly id = `neat-message-box-${nextBox++}`;
  protected readonly dragging = signal(false);
  protected readonly note = signal('');
  protected readonly idle = computed(() => this.activity() === 'idle');
  protected readonly sendable = computed(
    () =>
      !this.disabled() && this.idle() && (this.text().trim() !== '' || this.pictures().length > 0),
  );

  protected onInput(area: HTMLTextAreaElement): void {
    this.text.set(area.value);
    if (!SIZES_ITSELF) {
      area.style.height = 'auto';
      area.style.height = `${area.scrollHeight}px`;
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    // An input method's Enter picks a candidate; 229 is what older browsers report for it.
    if (event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    this.sendDraft();
  }

  protected sendDraft(): void {
    if (!this.sendable()) return;
    this.send.emit({ text: this.text().trim(), pictures: this.pictures() });
    this.text.set('');
    this.pictures.set([]);
    this.note.set('');
  }

  protected onFiles(input: HTMLInputElement): void {
    this.add(input.files);
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    if (this.disabled() || !event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    this.dragging.set(false);
    if (this.disabled() || !event.dataTransfer) return;
    event.preventDefault();
    this.add(event.dataTransfer.files);
  }

  protected remove(picture: NeatChatPicture): void {
    revokePicture(picture);
    this.pictures.update((pictures) => pictures.filter((p) => p.id !== picture.id));
    this.note.set('');
  }

  private add(files: FileList | readonly File[] | null): void {
    const images = [...(files ?? [])].filter((file) => file.type.startsWith('image/'));
    const room = Math.max(0, this.maxPictures() - this.pictures().length);
    if (images.length > room) this.note.set(`Up to ${this.maxPictures()} pictures`);
    if (room === 0 || images.length === 0) return;
    const added = images.slice(0, room).map(pictureFromFile);
    this.pictures.update((pictures) => [...pictures, ...added]);
  }
}
