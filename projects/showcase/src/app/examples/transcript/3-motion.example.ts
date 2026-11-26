import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  NEAT_PICTURE_MOTIONS,
  NeatChatTranscript,
  type NeatChatMessage,
  type NeatPictureMotion,
} from '@sima/neat-ui/chat';
import { NEAT_TEXT_MOTIONS, type NeatTextMotion } from '@sima/neat-ui/markdown';
import { NeatSelect, type NeatSelectOption } from '@sima/neat-ui/select';

/** The reply this example streams. */
const REPLY =
  'Three jars of dried pasta, a bottle of **olive oil** and canned tomatoes. Together that is most ' +
  'of a *pasta al pomodoro*: sauté the garlic in the oil, add the tomatoes, and let them simmer ' +
  'while the pasta boils.';

const PIECES = REPLY.match(/\s+|\S+/g) ?? [];

/** How long the board reads the picture before the first word, and the pause after a reply. */
const WAIT_MS = 1300;
const PAUSE_MS = 3000;
/** How often a piece arrives: 25 a second. */
const PIECE_MS = 40;

const TEXT_NAMES: Record<NeatTextMotion, string> = {
  plain: 'Plain',
  focus: 'Focus',
  decrypt: 'Decrypt',
  'reverse-explosion': 'Reverse explosion',
  'token-flash': 'Token flash',
  'drop-in': 'Drop-in',
  'word-cloud': 'Word cloud',
};

const PICTURE_NAMES: Record<NeatPictureMotion, string> = {
  'coming-into-focus': 'Coming into focus',
  'beam-and-patches': 'Beam and patches',
  viewfinder: 'Viewfinder',
  'patches-into-model': 'Patches into the model',
  none: 'None',
};

/**
 * The transcript's motions: while the reply waits, its question's picture shows the board reading
 * it (`pictureMotion`) and the reply counts to its first word; then its text streams in the
 * `textMotion`. Pick either, and the next round shows it. Each round's reply is a new message, so
 * the transcript sees it wait.
 */
@Component({
  selector: 'app-motion',
  imports: [NeatChatTranscript, NeatSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-motion.example.html',
  styleUrl: './motion.example.css',
})
export class Motion {
  protected readonly textMotions: NeatSelectOption<NeatTextMotion>[] = NEAT_TEXT_MOTIONS.map(
    (motion) => ({ value: motion, label: TEXT_NAMES[motion] }),
  );
  protected readonly pictureMotions: NeatSelectOption<NeatPictureMotion>[] =
    NEAT_PICTURE_MOTIONS.map((motion) => ({ value: motion, label: PICTURE_NAMES[motion] }));
  protected readonly textMotion = signal<NeatTextMotion | null>('focus');
  protected readonly pictureMotion = signal<NeatPictureMotion | null>('coming-into-focus');

  private readonly reply = signal<NeatChatMessage>({
    id: 'reply-1',
    role: 'assistant',
    text: '',
    state: 'waiting',
  });

  protected readonly messages = computed<NeatChatMessage[]>(() => [
    {
      id: 'question',
      role: 'user',
      text: "What's on this shelf, and what could I cook with it?",
      pictures: [{ id: 'shelf', src: 'examples/shelf.webp', name: 'A kitchen shelf' }],
    },
    this.reply(),
  ]);

  constructor() {
    let round = 1;
    let timer: ReturnType<typeof setTimeout>;
    const stream = (shown: number) => {
      const id = `reply-${round}`;
      this.reply.set({
        id,
        role: 'assistant',
        text: PIECES.slice(0, shown).join(''),
        state: shown === PIECES.length ? 'done' : 'streaming',
      });
      if (shown < PIECES.length) timer = setTimeout(() => stream(shown + 1), PIECE_MS);
      else timer = setTimeout(wait, PAUSE_MS);
    };
    const wait = () => {
      round++;
      this.reply.set({ id: `reply-${round}`, role: 'assistant', text: '', state: 'waiting' });
      timer = setTimeout(() => stream(1), WAIT_MS);
    };
    timer = setTimeout(() => stream(1), WAIT_MS);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
