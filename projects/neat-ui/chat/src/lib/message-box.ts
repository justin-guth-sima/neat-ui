import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NeatButton, NeatIcon, NeatTooltip } from '@sima/neat-ui';
import { pictureFromFile, revokePicture } from './pictures';
import { type NeatListeningMotion, NeatPushToTalk } from './push-to-talk';
import type { NeatChatDraft, NeatChatPicture } from './types';
import { HeardOrigin } from './voice/heard-origin';
import { runListeningEngine } from './voice/listening';

/**
 * What the board is doing with the last question: `idle` (nothing), `waiting` (sent, no word yet)
 * or `streaming` (the reply arrives).
 */
export type NeatMessageBoxActivity = 'idle' | 'waiting' | 'streaming';

/**
 * How the box shows that the board works on a reply:
 *
 * - `comet`, the default: a bright head with a colored tail running round its edge;
 * - `ring`: the series colors turning round the whole edge in a soft halo;
 * - `aurora`: the series colors along the edge, with their light drifting below the box;
 * - `sheen`: the series colors along the edge, and a band of light crossing the box;
 * - `none`: no glow.
 *
 * Each breathes or turns while the board reads the question and runs faster while the reply
 * arrives; under reduced motion it shows its colors still.
 */
export type NeatMessageBoxGlow = 'comet' | 'ring' | 'aurora' | 'sheen' | 'none';

/** Every glow of the message box, the default first, for a picker. */
export const NEAT_MESSAGE_BOX_GLOWS: readonly NeatMessageBoxGlow[] = [
  'comet',
  'ring',
  'aurora',
  'sheen',
];

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
 * Enter sends nothing. The `glow` shows it too (`NeatMessageBoxGlow`): the comet runs round the
 * edge while the board reads the question (`waiting`) and once every `glowTurnMs` × 0.6 while the
 * reply arrives (`streaming`); the ring, the aurora and the sheen breathe while it waits and turn,
 * drift or sweep once every `glowTurnMs` while it streams, each the look and pace of the mockup it
 * was chosen from.
 *
 * **Pictures** come from the Picture button (the system's file chooser) or a drop of image files
 * on the box, up to `maxPictures`, each a thumbnail with a button that removes it. Files that are
 * no images are left out. The pictures' object URLs are the box's until it sends them; then they
 * are the app's (see `pictureFromFile`).
 *
 * **Push-to-talk** (`talk`) sits beside Send: the visitor holds it, or taps it twice, to ask by
 * voice (`NeatPushToTalk`). The box emits the recording as `recorded` for the app to turn into a
 * question, and forwards `recording` (both ways), `transcribing` and `listeningMotion` to it;
 * `disabled` disables it too. A spoken question does not take the typed draft, which stays in the
 * box. With the `in-message-box` listening motion, the voice shows as a waveform where the text
 * was, the text area see-through beneath it (it keeps its size and stays in the accessibility
 * tree); on release the bars collapse and stay so while `transcribing`, and the heard question
 * then flies out of the box into the transcript. Under reduced motion it is push-to-talk's level
 * meter. Recording does not change the glow, which is the board's.
 *
 * `text` and `pictures` are models, so an app can keep or restore a draft.
 */
@Component({
  selector: 'neat-message-box',
  imports: [NeatButton, NeatIcon, NeatTooltip, NeatPushToTalk],
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
   * The glow round the box while the board works (`NeatMessageBoxGlow`): `comet`, the default,
   * `ring`, `aurora`, `sheen` or `none`. It moves until the first word and faster while the reply
   * arrives, at its own pace, not the reply's. Still under reduced motion.
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
  /** Shows push-to-talk beside Send, for asking by voice. */
  readonly talk = input(false, { transform: booleanAttribute });
  /** Push-to-talk asks for the microphone or records; set it to start or stop, as its own. */
  readonly recording = model(false);
  /** The app's speech-to-text is working on the last recording. */
  readonly transcribing = input(false, { transform: booleanAttribute });
  /**
   * How the voice shows while push-to-talk records (`NeatListeningMotion`): `level`, the default,
   * or `in-message-box`, a waveform where the text was, or push-to-talk's own others.
   */
  readonly listeningMotion = input<NeatListeningMotion>('level');
  /** A recording made in the box, for the app to turn into a question. */
  readonly recorded = output<Blob>();
  /** A draft was sent: its text (trimmed) and its pictures, which are the app's from now on. */
  readonly send = output<NeatChatDraft>();
  /** Stop was pressed while the board worked. */
  readonly stop = output<void>();

  protected readonly id = `neat-message-box-${nextBox++}`;
  private readonly talker = viewChild(NeatPushToTalk);
  private readonly area = viewChild.required<ElementRef<HTMLTextAreaElement>>('area');
  private readonly origin = inject(HeardOrigin);
  /** Whether the waveform over the text area is drawn (while recording, and after it collapses). */
  protected readonly wave = runListeningEngine(
    computed(() => (this.listeningMotion() === 'in-message-box' ? 'in-message-box' : 'level')),
    computed(() => this.talker()?.listening() ?? false),
    () => this.talker()?.level() ?? null,
    this.transcribing,
  );
  protected readonly dragging = signal(false);
  protected readonly note = signal('');
  protected readonly idle = computed(() => this.activity() === 'idle');
  protected readonly sendable = computed(
    () =>
      !this.disabled() && this.idle() && (this.text().trim() !== '' || this.pictures().length > 0),
  );

  protected onRecorded(recording: Blob): void {
    // The heard question will fly out of the text area, where the waveform was.
    if (this.listeningMotion() === 'in-message-box') this.origin.note(this.area().nativeElement);
    this.recorded.emit(recording);
  }

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
