import type { NeatSpeech } from '@sima/neat-ui/markdown';

/** Who wrote a message: the visitor (`user`) or the model (`assistant`), as OpenAI's API says. */
export type NeatChatRole = 'user' | 'assistant';

/**
 * Where a reply is:
 * - `waiting`: sent, no word yet;
 * - `streaming`: its text grows;
 * - `done`: complete (a message without a state is done);
 * - `stopped`: cut short by the visitor (Stop), its text as far as it came;
 * - `error`: it failed, and `error` says why.
 */
export type NeatChatState = 'waiting' | 'streaming' | 'done' | 'stopped' | 'error';

/**
 * A picture attached to a question: shown as a thumbnail in the message box and in the message.
 * `src` is what an `img` shows (an object URL from `pictureFromFile`, or any address), `name` its
 * alternative text, and `file` the picture itself, for the app to send.
 */
export interface NeatChatPicture {
  /** Unique among the pictures shown together. */
  readonly id: string;
  readonly src: string;
  readonly name: string;
  readonly file?: File;
}

/**
 * One message of a conversation, plain data the app owns: a question or a reply. While a reply
 * streams, the app writes its whole text so far with each piece that arrives (a new object each
 * time, the same `id`); the transcript shows what is new.
 */
export interface NeatChatMessage {
  /** Stable for the message's life: the transcript keeps its elements by it. */
  readonly id: string;
  readonly role: NeatChatRole;
  /** A reply's text is Markdown; a question's is shown as written. */
  readonly text: string;
  readonly pictures?: readonly NeatChatPicture[];
  /** `done` when not given. */
  readonly state?: NeatChatState;
  /** Why the reply failed, shown while `state` is `error`: the server's message, as it is. */
  readonly error?: string; /**
   * A question the visitor spoke: its text is what speech-to-text heard, and it arrives in the
   * transcript's `listeningMotion`.
   */
  readonly heard?: boolean;
  /**
   * What read aloud is saying of this reply now (`NeatSpeech`): keep it on the last sentence
   * played until the next begins, and clear it when reading ends.
   */
  readonly speech?: NeatSpeech;
}

/** What the message box sends: the question's text and its pictures. */
export interface NeatChatDraft {
  readonly text: string;
  readonly pictures: readonly NeatChatPicture[];
}
