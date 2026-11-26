import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  NgZone,
  output,
  type Signal,
  signal,
  untracked,
} from '@angular/core';
import { NeatButton, NeatIcon, NeatTooltip, neatDuration, ɵreducedMotion } from '@sima/neat-ui';
import { type ListeningDrawing, runListeningEngine } from './voice/listening';
import { MIC_WORDS } from './voice/media-problem';
import { MIC_DEPS } from './voice/mic-deps';
import { MicRecorder, type MicState } from './voice/mic-recorder';

/**
 * How push-to-talk shows the voice while it records:
 *
 * - `in-message-box`, the default: a ring round the button that swells with the voice and, inside
 *   `neat-message-box`, a waveform where the box's text was (alone, the ring only);
 * - `radial`: bars round the button, pulsing with the voice.
 *
 * Under reduced motion none moves: beside the button it says "Recording" and how long,
 * "Recording 3 s".
 */
export type NeatListeningMotion = 'in-message-box' | 'radial';

/** Every listening motion, the default first, for a picker. */
export const NEAT_LISTENING_MOTIONS: readonly NeatListeningMotion[] = ['in-message-box', 'radial'];

/** A release later than this after the press ends a hold; a quicker one is a tap. */
export const HOLD_MS = 300;

/** What push-to-talk is doing, on its host's `data-state`. */
type TalkState = 'idle' | 'asking' | 'recording' | 'transcribing';

/** Numbers each push-to-talk, for its note's id. */
let nextTalk = 0;

/**
 * The button a visitor holds to ask by voice, or taps once to start and again to stop.
 *
 * ```html
 * <neat-push-to-talk
 *   [transcribing]="transcribing()"
 *   (recorded)="transcribe($event)"
 * />
 * ```
 *
 * **Pressing:** a press starts recording. A release more than 300 ms after the press stops it (a
 * hold); a quicker one leaves it recording until the next press (a tap to start, a tap to stop).
 * Space and Enter work the same as the pointer, and Escape while recording cancels. The pointer is
 * captured, so a release outside the button still counts. A hold released while the browser still
 * asks for the microphone records nothing.
 *
 * **States**, on the host's `data-state`: `idle` ("Record question"), `asking` and `recording`
 * ("Stop recording"), and `transcribing` ("Transcribing", `aria-busy`), each the button's name and
 * tooltip. While `transcribing` or `disabled` a press does nothing; `disabled` (or the part's end)
 * while recording cancels.
 *
 * **The recording:** the kit asks for the microphone, records it (WebM/Opus in Chrome) and emits
 * one `recorded` Blob per recording of at least half a second, up to `maxSeconds`. The app turns it
 * into text (speech-to-text on the board) and sets `transcribing` meanwhile. What went wrong is
 * said in place, beside the button: "Microphone blocked", "No microphone", "Microphone in use",
 * "Microphone needs HTTPS", "Recording not supported", "Recording failed" or "Too short", until the
 * next press. The microphone exists only in a secure context (HTTPS or localhost).
 *
 * **The voice** shows while it records as `listeningMotion` says (`NeatListeningMotion`): a ring
 * round the button by default, with the box's waveform inside `neat-message-box`. Under reduced motion it says "Recording 3 s" beside the button instead.
 *
 * Inside `neat-message-box` (its `talk`), the box sets `data-in-box` on the host: the visual comes
 * before the button and is the height of the box's row.
 */
@Component({
  selector: 'neat-push-to-talk',
  imports: [NeatButton, NeatIcon, NeatTooltip],
  host: {
    class: 'push-to-talk',
    '[attr.data-state]': 'state()',
  },
  templateUrl: './push-to-talk.html',
  styleUrl: './push-to-talk.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeatPushToTalk {
  /**
   * True while it asks for the microphone or records. Set it true to start and false to stop and
   * emit the recording.
   */
  readonly recording = model(false);
  /** The app's speech-to-text is working on the last recording: a press does nothing meanwhile. */
  readonly transcribing = input(false, { transform: booleanAttribute });
  /** No recording; one going on is canceled. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /**
   * How the voice shows while it records (`NeatListeningMotion`): `in-message-box`, the default,
   * a ring round the button (and, inside the message box, the box's waveform), or `radial`.
   */
  readonly listeningMotion = input<NeatListeningMotion>('in-message-box');
  /** The longest recording, in seconds; a recording stops by itself then. */
  readonly maxSeconds = input(30);
  /** A finished recording, the browser's audio (WebM/Opus in Chrome). */
  readonly recorded = output<Blob>();

  /** @internal The level now (0 to 1), for the message box's waveform. */
  readonly level = (): number | null => this.mic.level();
  /** @internal Whether the microphone records now (not while it is asked for). */
  readonly listening: Signal<boolean> = computed(() => this.micState() === 'recording');

  protected readonly noteId = `neat-push-to-talk-${nextTalk++}-note`;
  protected readonly note = signal('');
  /** The recorder's state, mirrored for the template. */
  private readonly micState = signal<MicState>('idle');
  protected readonly state = computed<TalkState>(() => {
    const mic = this.micState();
    if (mic === 'asking' || mic === 'recording') return mic;
    return this.transcribing() ? 'transcribing' : 'idle';
  });
  protected readonly blocked = computed(() => this.disabled() || this.transcribing());
  protected readonly name = computed(() => {
    const state = this.state();
    if (state === 'idle') return 'Record question';
    return state === 'transcribing' ? 'Transcribing' : 'Stop recording';
  });
  /** What is drawn round the button: the ring (`in-message-box`), or the radial bars. */
  protected readonly drawing = computed<ListeningDrawing>(() =>
    this.listeningMotion() === 'radial' ? 'radial' : 'ring',
  );
  /** Whether the motion's engine runs, so its elements are rendered (also while it folds). */
  protected readonly layer: Signal<boolean>;
  /** The whole seconds recorded, which the still form says under reduced motion. */
  private readonly seconds = signal(0);
  /** "Recording 3 s" while recording under reduced motion, where no motion moves; else null. */
  protected readonly elapsed = computed(() =>
    this.state() === 'recording' && ɵreducedMotion()
      ? `Recording ${neatDuration(this.seconds())}`
      : null,
  );

  private readonly zone = inject(NgZone);
  private readonly mic: MicRecorder;
  /** When the press that started (or is about to stop) a recording began; null between presses. */
  private pressedAt: number | null = null;
  private readonly clock = inject(MIC_DEPS).clock;

  constructor() {
    const deps = inject(MIC_DEPS);
    const maxSeconds = this.maxSeconds;
    const back = (run: () => void) => this.zone.run(run);
    this.mic = new MicRecorder(
      deps,
      {
        started: () =>
          back(() => {
            this.seconds.set(0);
            this.sync();
          }),
        second: (seconds) => back(() => this.seconds.set(seconds)),
        recorded: (blob) =>
          back(() => {
            this.sync();
            this.recorded.emit(blob);
          }),
        ended: (reason) =>
          back(() => {
            this.sync();
            if (reason !== 'canceled') this.note.set(MIC_WORDS[reason]);
          }),
      },
      {
        get maxMs() {
          return maxSeconds() * 1000;
        },
      },
    );
    // The app sets `recording`: start or stop to match.
    effect(() => {
      const wanted = this.recording();
      untracked(() => {
        const mic = this.mic.state;
        if (wanted && mic === 'idle') {
          if (this.blocked()) this.recording.set(false);
          else this.start();
        } else if (!wanted && (mic === 'asking' || mic === 'recording')) {
          this.outside(() => this.mic.stop());
        }
      });
    });
    effect(() => {
      if (this.disabled()) untracked(() => this.outside(() => this.mic.cancel()));
    });
    inject(DestroyRef).onDestroy(() => this.mic.destroy());
    this.layer = runListeningEngine(this.drawing, this.listening, this.level);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    this.press();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.mic.state === 'idle') return;
      event.preventDefault();
      this.pressedAt = null;
      this.outside(() => this.mic.cancel());
      return;
    }
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) this.press();
  }

  protected onKeyup(event: KeyboardEvent): void {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    this.release();
  }

  /** A press: start when idle, or stop the recording a tap started. */
  private press(): void {
    if (this.blocked()) return;
    const mic = this.mic.state;
    if (mic === 'idle') {
      this.pressedAt = this.clock.now();
      this.start();
    } else if (mic === 'asking' || mic === 'recording') {
      this.pressedAt = null;
      this.outside(() => this.mic.stop());
    }
  }

  /** A release: the end of a hold stops the recording; the end of a tap leaves it going. */
  protected release(): void {
    const pressedAt = this.pressedAt;
    this.pressedAt = null;
    if (pressedAt === null || this.clock.now() - pressedAt <= HOLD_MS) return;
    this.outside(() => this.mic.stop());
  }

  private start(): void {
    this.note.set('');
    this.outside(() => this.mic.start());
    this.sync();
  }

  /** Mirrors the recorder's state into the template and the `recording` model. */
  private sync(): void {
    const mic = this.mic.state;
    this.micState.set(mic);
    this.recording.set(mic === 'asking' || mic === 'recording');
  }

  private outside(run: () => void): void {
    this.zone.runOutsideAngular(run);
    this.sync();
  }
}
