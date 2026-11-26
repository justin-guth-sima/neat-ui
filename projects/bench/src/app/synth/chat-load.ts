/*
 * The chat page's load: a reply the way a model streams it, as pieces from the tokenizer of the
 * mockup the motions were chosen from (genai-studio's `token-motion.html`), over a corpus drawn
 * from a seed, and the time before each piece, at `rate` pieces a second with the mockup's
 * jitter (0.6 to 1.4 of an interval). The same seed gives the same reply and the same timing on
 * every machine (`prng.ts`).
 */
import { mulberry32, type Prng, randomInt } from './prng';

/**
 * Which reply: prose (paragraphs, a list and bold), a paragraph and a growing Python block, or the
 * moments mockup's two sentences (the listening and speaking comparisons).
 */
export type ChatReply = 'prose' | 'code' | 'mockup';

/** The moments mockup's reply, the two sentences its speaking motions read. */
export const MOCKUP_REPLY =
  'Three jars of dried pasta, a bottle of olive oil, canned tomatoes and a braid of garlic. ' +
  'Together that is most of a pasta al pomodoro.';

export interface ChatLoadOptions {
  readonly reply: ChatReply;
  /** How many pieces a prose reply has (a code reply has its own length). */
  readonly pieces: number;
  /** Pieces a second. */
  readonly rate: number;
}

/** The budget's load: 500 pieces at 50 a second, prose. */
export const CHAT_LOAD: ChatLoadOptions = { reply: 'prose', pieces: 500, rate: 50 };

/** About how many pieces the code reply's Python block has. */
const CODE_PIECES = 400;

/**
 * The mockup's tokenizer: each word with the space before it, a word longer than seven letters
 * split in two or three, so pieces come about as a model's subword tokens do.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const word of text.match(/\s*[^\s]+/g) ?? []) {
    const core = word.trim();
    if (core.length <= 7) {
      out.push(word);
      continue;
    }
    const lead = word.slice(0, word.length - core.length);
    const head = Math.ceil(core.length / 2.2);
    out.push(lead + core.slice(0, head));
    let rest = core.slice(head);
    while (rest.length > 5) {
      out.push(rest.slice(0, 4));
      rest = rest.slice(4);
    }
    if (rest) out.push(rest);
  }
  return out;
}

/** The words the prose is drawn from: a kitchen shelf's, as the reply the mockup streamed. */
// prettier-ignore
const WORDS = [
  'three', 'jars', 'of', 'dried', 'pasta', 'a', 'bottle', 'olive', 'oil', 'and',
  'canned', 'tomatoes', 'braid', 'garlic', 'together', 'that', 'is', 'most', 'the', 'sauce',
  'simmer', 'for', 'fifteen', 'minutes', 'toss', 'in', 'finish', 'with', 'splash', 'water',
  'shelf', 'label', 'basil', 'pepper', 'salt', 'onion', 'slowly', 'until', 'golden', 'then',
  'add', 'stir', 'taste', 'serve', 'warm', 'fresh', 'parmesan', 'kitchen', 'counter', 'pan',
];

const CODE_LINES = [
  'def simmer(sauce, minutes=15):',
  '    for minute in range(minutes):',
  '        sauce.stir(speed=0.5)',
  '        if sauce.temperature > 95:',
  '            sauce.lower_heat(step=1)',
  '    return sauce.taste()',
  'pantry = {"pasta": 3, "olive_oil": 1, "tomatoes": 2}',
  'print(f"{len(pantry)} things on the shelf")',
];

export class ChatLoad {
  /** The reply's whole text, longer than its pieces for prose. */
  readonly corpus: string;
  /** The reply's pieces, in the order they arrive. */
  readonly pieces: readonly string[];
  /** How long before each piece arrives, ms: the first after the wait, each next after the last. */
  readonly intervals: Float64Array;

  constructor(seed = 1, options: ChatLoadOptions = CHAT_LOAD) {
    const rand = mulberry32(seed);
    if (options.reply === 'code') {
      this.corpus = codeReply(rand);
      this.pieces = tokenize(this.corpus);
    } else if (options.reply === 'mockup') {
      this.corpus = MOCKUP_REPLY;
      this.pieces = tokenize(this.corpus);
    } else {
      this.corpus = proseReply(rand, options.pieces);
      this.pieces = tokenize(this.corpus).slice(0, options.pieces);
    }
    this.intervals = Float64Array.from(
      this.pieces,
      () => (1000 / options.rate) * (0.6 + rand() * 0.8),
    );
  }

  /** The text of the first `count` pieces, as the app writes it. */
  textAt(count: number): string {
    return this.pieces.slice(0, count).join('');
  }
}

/** Prose of at least `pieces` pieces: two paragraphs and a list, again and again, with bold. */
function proseReply(rand: Prng, pieces: number): string {
  const blocks: string[] = [];
  let length = 0;
  while (length < pieces) {
    const block =
      blocks.length % 3 === 2
        ? Array.from({ length: randomInt(rand, 3, 5) }, () => `- ${sentence(rand, 4, 9)}`).join(
            '\n',
          )
        : Array.from({ length: randomInt(rand, 3, 5) }, () => sentence(rand, 8, 16)).join(' ');
    blocks.push(block);
    length += tokenize(block).length;
  }
  return blocks.join('\n\n');
}

/** A sentence of `min` to `max` words, a word in five of them bold. */
function sentence(rand: Prng, min: number, max: number): string {
  const words = Array.from({ length: randomInt(rand, min, max) }, (_, i) => {
    const word = WORDS[randomInt(rand, 0, WORDS.length - 1)];
    return i > 0 && rand() < 0.2 ? `**${word}**` : word;
  });
  const text = words.join(' ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

/** A paragraph, then a Python block of about `CODE_PIECES` pieces. */
function codeReply(rand: Prng): string {
  const lines: string[] = [];
  let length = 0;
  while (length < CODE_PIECES) {
    const line = CODE_LINES[randomInt(rand, 0, CODE_LINES.length - 1)];
    lines.push(line);
    length += tokenize(line).length;
  }
  return `${sentence(rand, 12, 18)}\n\n\`\`\`python\n${lines.join('\n')}\n\`\`\``;
}
