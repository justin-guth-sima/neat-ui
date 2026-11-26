<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Transcript

_Components › Chat_ · [All topics](../README.md)

A conversation with a model, drawn from the app's messages: the visitor's questions as bubbles on the end side with their pictures, the model's replies as Markdown across the width.

```html
<neat-page scroll="none">
  <neat-chat-transcript [messages]="conversation.messages()" />
  <neat-message-box (send)="conversation.ask($event)" />
</neat-page>
```

<picture>
<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="../images/transcript/conversation.dark.webp">
<source media="(prefers-reduced-motion: reduce)" srcset="../images/transcript/conversation.light.webp">
<source media="(prefers-color-scheme: dark)" srcset="../images/transcript/conversation.dark.animated.webp">
<img src="../images/transcript/conversation.light.animated.webp" alt="Transcript: Conversation" width="868">
</picture>

```ts
import { NeatChatTranscript, NeatChatMessageFooter, NeatChatErrorActions, NEAT_PICTURE_MOTIONS } from '@sima/neat-ui/chat';
```

## Examples

### Conversation

A question with a picture and its reply streaming in, as the app writes it: the whole text so far, once per piece. While the reply waits, the picture comes into focus as the board reads it and an orb counts to the first word. Once it is done, the app's line under it gives the board's figures. The conversation starts again after a pause, with a new reply.

<picture>
<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="../images/transcript/conversation.dark.webp">
<source media="(prefers-reduced-motion: reduce)" srcset="../images/transcript/conversation.light.webp">
<source media="(prefers-color-scheme: dark)" srcset="../images/transcript/conversation.dark.animated.webp">
<img src="../images/transcript/conversation.light.animated.webp" alt="Transcript: Conversation" width="868">
</picture>

<details>
<summary>Code</summary>

`1-conversation.example.ts`

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  NeatChatMessageFooter,
  NeatChatTranscript,
  type NeatChatMessage,
} from '@sima/neat-ui/chat';

/** The reply this example streams. */
const REPLY =
  'Three jars of dried pasta, a bottle of **olive oil** and canned tomatoes. Together that is most ' +
  'of a *pasta al pomodoro*: sauté the garlic in the oil, add the tomatoes, and let them simmer ' +
  'while the pasta boils.';

const PIECES = REPLY.match(/\s+|\S+/g) ?? [];

@Component({
  selector: 'app-conversation',
  imports: [NeatChatTranscript, NeatChatMessageFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-conversation.example.html',
  styleUrl: './conversation.example.css',
})
export class Conversation {
  private readonly reply = signal<NeatChatMessage>({
    id: 'reply-1',
    role: 'assistant',
    text: '',
    state: 'waiting',
  });

  protected readonly messages = computed<NeatChatMessage[]>(() => [
    {
      id: 'q1',
      role: 'user',
      text: "What's on this shelf, and what could I cook with it?",
      pictures: [{ id: 'shelf', src: 'examples/shelf.webp', name: 'A kitchen shelf' }],
    },
    this.reply(),
  ]);

  constructor() {
    let tick = 0;
    let round = 1;
    const timer = setInterval(() => {
      tick++;
      const shown = tick - 10; // a first word after 0.4 s
      if (shown > 0 && shown <= PIECES.length) {
        this.reply.set({
          id: `reply-${round}`,
          role: 'assistant',
          text: PIECES.slice(0, shown).join(''),
          state: shown === PIECES.length ? 'done' : 'streaming',
        });
      } else if (shown > PIECES.length + 60) {
        tick = 0;
        round++;
        // A new reply, so the transcript sees it wait and reads the picture again.
        this.reply.set({ id: `reply-${round}`, role: 'assistant', text: '', state: 'waiting' });
      }
    }, 40);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
```

`1-conversation.example.html`

```html
<neat-chat-transcript [messages]="messages()">
  <ng-template neatChatMessageFooter let-message>
    @if (message.role === 'assistant' && message.state === 'done') {
      <span>first word 0.22 s · 24.6 words/s</span>
    }
  </ng-template>
</neat-chat-transcript>
```

`conversation.example.css`

```css
/* The transcript scrolls itself, so its parent gives it a height. */
:host {
  display: flex;
  flex-direction: column;
  height: 22rem;
}
```

</details>

### States

The other states of a reply: one the visitor stopped, one that failed, with the app's New chat button in its callout, and one still waiting for its first word.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/transcript/states.dark.webp">
<img src="../images/transcript/states.light.webp" alt="Transcript: States" width="868">
</picture>

<details>
<summary>Code</summary>

`2-states.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatChatErrorActions, NeatChatTranscript, type NeatChatMessage } from '@sima/neat-ui/chat';

/** A conversation that holds every state a reply has. */
const CONVERSATION: NeatChatMessage[] = [
  { id: 'q1', role: 'user', text: 'Describe the picture in detail.' },
  { id: 'a1', role: 'assistant', text: 'A kitchen shelf with three jars of', state: 'stopped' },
  { id: 'q2', role: 'user', text: 'And now in one sentence?' },
  {
    id: 'a2',
    role: 'assistant',
    text: '',
    state: 'error',
    error: 'The conversation is too long for the model. Start a new chat to go on.',
  },
  { id: 'q3', role: 'user', text: 'What do you see?' },
  { id: 'a3', role: 'assistant', text: '', state: 'waiting' },
];

@Component({
  selector: 'app-states',
  imports: [NeatButton, NeatChatErrorActions, NeatChatTranscript],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-states.example.html',
  styleUrl: './states.example.css',
})
export class States {
  protected readonly messages = signal<NeatChatMessage[]>(CONVERSATION);

  protected newChat(): void {
    this.messages.set([]);
    setTimeout(() => this.messages.set(CONVERSATION), 1500);
  }
}
```

`2-states.example.html`

```html
<neat-chat-transcript [messages]="messages()">
  <ng-template neatChatErrorActions>
    <button neatButton variant="secondary" size="small" type="button" (click)="newChat()">
      New chat
    </button>
  </ng-template>
</neat-chat-transcript>
```

`states.example.css`

```css
/* The transcript scrolls itself, so its parent gives it a height. */
:host {
  display: flex;
  flex-direction: column;
  height: 36rem;
}
```

</details>

### Motion

The transcript's motions: while the reply waits, its question's picture shows the board reading it (`pictureMotion`), its patches flying into the reply's orb with `pictureFlight`, and the reply counts to its first word; then its text streams in the `textMotion`. Pick any, and the next round shows it. Each round's reply is a new message, so the transcript sees it wait.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/transcript/motion.dark.webp">
<img src="../images/transcript/motion.light.webp" alt="Transcript: Motion" width="884">
</picture>

<details>
<summary>Code</summary>

`3-motion.example.ts`

```ts
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
import { NeatSwitch } from '@sima/neat-ui/switch';

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
  none: 'None',
};

@Component({
  selector: 'app-motion',
  imports: [NeatChatTranscript, NeatSelect, NeatSwitch],
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
  protected readonly pictureFlight = signal(true);

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
```

`3-motion.example.html`

```html
<div class="controls">
  <neat-select
    label="Text motion"
    showLabel
    labelPosition="inline"
    [options]="textMotions"
    [(value)]="textMotion"
  />
  <neat-select
    label="Picture motion"
    showLabel
    labelPosition="inline"
    [options]="pictureMotions"
    [(value)]="pictureMotion"
  />
  <button neatSwitch [(checked)]="pictureFlight">Patches fly to the reply</button>
</div>
<neat-chat-transcript
  [messages]="messages()"
  [textMotion]="textMotion() ?? 'plain'"
  [pictureMotion]="pictureMotion() ?? 'none'"
  [pictureFlight]="pictureFlight()"
/>
```

`motion.example.css`

```css
/* The transcript scrolls itself, so its parent gives it a height. */
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
  height: 26rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--neat-space-4);
}
```

</details>

### Heard question

A heard question (`heard`, a question the visitor spoke) arriving in the transcript's `listeningMotion`: its words coming into focus one by one (radial), again every few seconds. The bubble has its whole size from the start. In the message box, the text flies out of the box's text area as its words come into focus.

<picture>
<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="../images/transcript/heard-question.dark.webp">
<source media="(prefers-reduced-motion: reduce)" srcset="../images/transcript/heard-question.light.webp">
<source media="(prefers-color-scheme: dark)" srcset="../images/transcript/heard-question.dark.animated.webp">
<img src="../images/transcript/heard-question.light.animated.webp" alt="Transcript: Heard question" width="884">
</picture>

<details>
<summary>Code</summary>

`4-heard-question.example.ts`

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NeatChatMessageFooter,
  NeatChatTranscript,
  type NeatChatMessage,
  type NeatListeningMotion,
} from '@sima/neat-ui/chat';

/** The question as speech-to-text heard it. */
const HEARD = "What's on this shelf, and which of it would you cook with?";
/** The motion the example arrives in: radial; in the message box needs the box's text area. */
const MOTION: NeatListeningMotion = 'radial';
/** How long each heard question stays before the next. */
const ROUND_MS = 3000;

const NAMES: Record<NeatListeningMotion, string> = {
  radial: 'Radial',
  'in-message-box': 'In the message box',
};

@Component({
  selector: 'app-heard-question',
  imports: [NeatChatTranscript, NeatChatMessageFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-heard-question.example.html',
  styleUrl: './heard-question.example.css',
})
export class HeardQuestion {
  protected readonly motion = signal<NeatListeningMotion>(MOTION);
  protected readonly messages = signal<NeatChatMessage[]>([]);
  protected readonly names = NAMES;

  constructor() {
    let round = 0;
    const ask = () => {
      // A new id each round: the transcript sees a new heard question arrive.
      this.messages.set([{ id: `heard-${round}`, role: 'user', text: HEARD, heard: true }]);
      round++;
    };
    // The first round starts after the transcript's first render, so its question arrives.
    let timer = setTimeout(ask, 100);
    const interval = setInterval(() => {
      clearTimeout(timer);
      timer = setTimeout(ask);
    }, ROUND_MS);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      clearInterval(interval);
    });
  }
}
```

`4-heard-question.example.html`

```html
<p class="motion">{{ names[motion()] }}</p>
<neat-chat-transcript [messages]="messages()" [listeningMotion]="motion()">
  <ng-template neatChatMessageFooter let-message>
    @if (message.heard) {
      <span>heard in 0.31 s · English</span>
    }
  </ng-template>
</neat-chat-transcript>
```

`heard-question.example.css`

```css
/* The transcript scrolls itself, so its parent gives it a height; the motion's name above it. */
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
  height: 12rem;
}

.motion {
  font-size: var(--neat-text-sm);
  color: var(--muted-foreground);
}
```

</details>

### Read aloud

A reply read aloud: its sentences come from [`neatSpeakable`](../components/markdown.md#neatspeakable), and each is "spoken" in turn at the pace of a voice, with a pretend voice's samples. The app gives the sentence being said to the reply as its `speech`, and the transcript shows it in the `speakingMotion`: the sentence, the equalizer, word by word, or the waveform's strip under the reply. Pick one; the reply is read again after a pause.

<picture>
<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="../images/transcript/read-aloud.dark.webp">
<source media="(prefers-reduced-motion: reduce)" srcset="../images/transcript/read-aloud.light.webp">
<source media="(prefers-color-scheme: dark)" srcset="../images/transcript/read-aloud.dark.animated.webp">
<img src="../images/transcript/read-aloud.light.animated.webp" alt="Transcript: Read aloud" width="900">
</picture>

<details>
<summary>Code</summary>

`5-read-aloud.example.ts`

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { NeatChatTranscript, type NeatChatMessage } from '@sima/neat-ui/chat';
import {
  NEAT_SPEAKING_MOTIONS,
  neatSpeakable,
  type NeatSpeakingMotion,
  type NeatSpeech,
} from '@sima/neat-ui/markdown';
import { NeatSelect, type NeatSelectOption } from '@sima/neat-ui/select';

/** The reply read aloud: the moments mockup's two sentences. */
const REPLY =
  'Three jars of dried pasta, a bottle of olive oil, canned tomatoes and a braid of garlic. ' +
  'Together that is most of a *pasta al pomodoro*.';
/** How long a sentence takes to say: 55 ms a character, the mockup's pace. */
const MS_PER_CHARACTER = 55;
/** The pretend voice: its sample rate, its pitch, and the strip's bars its loudness follows. */
const SAMPLE_RATE = 8000;
const PITCH = 220;
const BARS = 90;
/** The pause after the reply before it is read again. */
const PAUSE_MS = 600;

const NAMES: Record<NeatSpeakingMotion, string> = {
  sentence: 'Sentence',
  equalizer: 'Equalizer',
  'word-by-word': 'Word by word',
  waveform: 'Waveform',
};

/** A seeded random, so the pretend voice is the same each time (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A pretend voice for sentence `k` lasting `ms`: a tone whose loudness follows the mockup's waveform. */
function voice(k: number, ms: number): Float32Array {
  const random = seeded(k + 1);
  const shape = Array.from({ length: BARS }, (_, i) =>
    Math.max(0.05, Math.abs(Math.sin(i * 0.35) * Math.sin(i * 0.11 + k)) * (0.5 + random() * 0.5)),
  );
  const samples = new Float32Array(Math.round((ms / 1000) * SAMPLE_RATE));
  for (let j = 0; j < samples.length; j++) {
    const bar = Math.min(BARS - 1, Math.floor((j / samples.length) * BARS));
    samples[j] = shape[bar] * Math.sin((2 * Math.PI * PITCH * j) / SAMPLE_RATE);
  }
  return samples;
}

@Component({
  selector: 'app-read-aloud',
  imports: [NeatChatTranscript, NeatSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './5-read-aloud.example.html',
  styleUrl: './read-aloud.example.css',
})
export class ReadAloud {
  protected readonly motions: readonly NeatSelectOption<NeatSpeakingMotion>[] =
    NEAT_SPEAKING_MOTIONS.map((motion) => ({ value: motion, label: NAMES[motion] }));
  protected readonly motion = signal<NeatSpeakingMotion | null>('waveform');
  private readonly speech = signal<NeatSpeech | null>(null);

  protected readonly messages = computed<NeatChatMessage[]>(() => {
    const speech = this.speech();
    return [
      { id: 'question', role: 'user', text: "What's on this shelf?" },
      { id: 'reply', role: 'assistant', text: REPLY, ...(speech ? { speech } : {}) },
    ];
  });

  constructor() {
    const sentences = neatSpeakable(REPLY);
    let timer: ReturnType<typeof setTimeout>;
    const say = (k: number) => {
      if (k === sentences.length) {
        this.speech.set(null);
        timer = setTimeout(() => say(0), PAUSE_MS);
        return;
      }
      const sentence = sentences[k];
      const ms = sentence.text.length * MS_PER_CHARACTER;
      this.speech.set({
        from: sentence.from,
        to: sentence.to,
        startedAt: performance.now(),
        audio: { samples: voice(k, ms), sampleRate: SAMPLE_RATE },
      });
      timer = setTimeout(() => say(k + 1), ms);
    };
    timer = setTimeout(() => say(0), 500);
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
```

`5-read-aloud.example.html`

```html
<neat-select
  label="Speaking motion"
  showLabel
  labelPosition="inline"
  [options]="motions"
  [(value)]="motion"
/>
<neat-chat-transcript [messages]="messages()" [speakingMotion]="motion() ?? 'sentence'" />
```

`read-aloud.example.css`

```css
/* The transcript scrolls itself, so its parent gives it a height; the choice above it. */
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
  height: 18rem;
}
```

</details>

## API

### `NeatChatTranscript`

Component from `@sima/neat-ui/chat`, selector `neat-chat-transcript`.

**The messages are plain data the app owns** ([`NeatChatMessage`](../components/transcript.md#neatchatmessage)). While a reply streams, the app writes its whole text so far, once for each piece that arrives; the transcript shows what is new and keeps what it already drew. A reply is `waiting` (an orb and clock, the seconds since it began to wait, until its first word), `streaming` (its newest text in the `textMotion`), `done`, `stopped` ("Stopped" after its text) or `error` (the message's `error` in a danger callout, with the app's `neatChatErrorActions` buttons). `neatChatMessageFooter` adds the app's own line under each message.

**Its ****`textMotion`** is how a reply's newest text appears ([`NeatTextMotion`](../components/markdown.md#neattextmotion), `plain` by default), for every reply the transcript saw waiting or streaming; a reply it first sees mid-stream (a page opened late) shows whole, and only its later pieces move. A motion changed while a reply streams moves what comes after the change. **Its ****`pictureMotion`** shows the model reading a question's pictures while the reply waits ([`NeatPictureMotion`](../components/transcript.md#neatpicturemotion), coming into focus by default), finishing soon after the first word. Under reduced motion the text and the pictures are plain, and the orb stands still while its clock counts. **Its ****`listeningMotion`** is how a heard question (`heard`, spoken by the visitor) arrives when it joins the conversation: its words come into focus one by one (`radial`), or its text flies out of the message box's text area while its words come into focus (`in-message-box`, the default); reduced motion shows it plain, as is a heard question restored with the conversation. The bubble has its whole size from the start, and the text is plain again once it has arrived.

**Read aloud:** a reply's `speech` ([`NeatSpeech`](../components/markdown.md#neatspeech), from the app's read aloud) is the sentence being said; the reply shows it in the `speakingMotion` ([`NeatSpeakingMotion`](../components/markdown.md#neatspeakingmotion)), the text after it muted, and with `waveform` a strip of the sentence's audio grows in under the reply, its playhead where the voice is, and shrinks away when the speech goes.

**It scrolls itself**, as the page's one scroll area (put it in `neat-page scroll="none"` with its parent giving it the height): it follows a growing reply (and a picture that loads) while the reader is at the end, stops as soon as they scroll up, and then shows Latest, which goes back to the end and follows again. A question the visitor sends brings it back to the end too.

**For assistive technology** it is a `log` named by `label` that is not live, so a reply is not read token by token, and a tab stop, so it scrolls by keys; once a reply is done, a polite announcement reads "Reply finished:" and its beginning, and "Reply failed:" and why when it fails. Latest leaves the focus on the log.

**Inputs**

- **`messages`** `readonly NeatChatMessage[]`, required

  The conversation, oldest first.

- **`label`** `string`, default `'Conversation'`

  The name of the conversation for assistive technology.

- **`textMotion`** `NeatTextMotion`, default `'plain'`

  How a streaming reply's newest text appears: `plain`, the default, or one of the kit's text motions ([`NEAT_TEXT_MOTIONS`](../components/markdown.md#neat_text_motions)), for the replies the transcript saw waiting or streaming.

- **`cloudWords`** `number`, default `12`

  How many words float in the word cloud (`textMotion` `word-cloud`): 1 to 40, 12 by default.

- **`pictureMotion`** `NeatPictureMotion`, default `'coming-into-focus'`

  How a question's pictures show that the model reads them while its reply waits ([`NeatPictureMotion`](../components/transcript.md#neatpicturemotion)): `coming-into-focus`, the default, another of [`NEAT_PICTURE_MOTIONS`](../components/transcript.md#neat_picture_motions), or `none`. A reading begins when the transcript first sees the reply waiting and ends soon after its first word; a motion changed meanwhile applies to the next.

- **`pictureFlight`** `boolean`, default `false`

  Whether patches of a question's pictures fly into the reply's orb while they are read, in any `pictureMotion` (the data going into the model): every third tile revealed, or one from each region the viewfinder hops to. Off by default; a change applies to the next reading.

- **`pictureScale`** `number`, default `1`

  How large a message's pictures show: each keeps its proportions within a 20 × 14 rem box times this, 1 by default, and never wider than the conversation. Each also has an Expand button that shows it over the whole window ([`NeatExpand`](../layout/expand.md#neatexpand)), Close or Escape putting it back.

- **`listeningMotion`** `NeatListeningMotion`, default `'in-message-box'`

  How a heard question arrives when it joins the conversation ([`NeatListeningMotion`](../components/push-to-talk.md#neatlisteningmotion)), matching push-to-talk's motion of the same name: `in-message-box`, the default, flies out of the box's text area. Under reduced motion it shows plain.

- **`speakingMotion`** `NeatSpeakingMotion`, default `'sentence'`

  How a reply being read aloud (its `speech`) shows how far the voice got ([`NeatSpeakingMotion`](../components/markdown.md#neatspeakingmotion)): `sentence`, the default and the still form, `equalizer`, `word-by-word`, or `waveform`, which adds a strip of the sentence's audio under the reply. Under reduced motion every motion is `sentence`.

### `NeatChatMessage`

Interface from `@sima/neat-ui/chat`.

One message of a conversation, plain data the app owns: a question or a reply. While a reply streams, the app writes its whole text so far with each piece that arrives (a new object each time, the same `id`); the transcript shows what is new.

**Members**

- **`id`** `string`

  Stable for the message's life: the transcript keeps its elements by it.

- **`role`** `NeatChatRole`

- **`text`** `string`

  A reply's text is Markdown; a question's is shown as written.

- **`pictures`** `readonly NeatChatPicture[]`, optional

- **`state`** `NeatChatState`, optional

  `done` when not given.

- **`error`** `string`, optional

  Why the reply failed, shown while `state` is `error`: the server's message, as it is.

- **`heard`** `boolean`, optional

- **`speech`** `NeatSpeech`, optional

  What read aloud is saying of this reply now ([`NeatSpeech`](../components/markdown.md#neatspeech)): keep it on the last sentence played until the next begins, and clear it when reading ends.

### `NeatChatRole`

Type from `@sima/neat-ui/chat`.

Who wrote a message: the visitor (`user`) or the model (`assistant`), as OpenAI's API says.

```ts
type NeatChatRole = 'user' | 'assistant'
```

### `NeatChatState`

Type from `@sima/neat-ui/chat`.

Where a reply is:

- `waiting`: sent, no word yet;
- `streaming`: its text grows;
- `done`: complete (a message without a state is done);
- `stopped`: cut short by the visitor (Stop), its text as far as it came;
- `error`: it failed, and `error` says why.

```ts
type NeatChatState = 'waiting' | 'streaming' | 'done' | 'stopped' | 'error'
```

### `NeatChatMessageFooter`

Template directive from `@sima/neat-ui/chat`, selector `ng-template[neatChatMessageFooter]`.

The app's line under a message, given the message: a reply's figures ("first word 0.22 s · 24.6 words/s"), how a spoken question was heard. One template for every message; match the message inside it.

```html
<ng-template neatChatMessageFooter let-message>
  @if (figures(message.id); as f) { first word {{ f.firstWord }} s }
</ng-template>
```

**Template context**

- **`$implicit`** `NeatChatMessage`

### `NeatChatErrorActions`

Template directive from `@sima/neat-ui/chat`, selector `ng-template[neatChatErrorActions]`.

The app's buttons in a failed reply's callout, given the message: "New chat" when the conversation outgrew the model, "Try again" for a lost connection.

**Template context**

- **`$implicit`** `NeatChatMessage`

### `NeatPictureMotion`

Type from `@sima/neat-ui/chat`.

How the transcript shows that the model reads a question's pictures, from the moment the reply begins to wait until its first word ([`NeatChatTranscript`](../components/transcript.md#neatchattranscript)'s `pictureMotion`):

- `coming-into-focus`, the default: the picture starts blurred, gray and dim, and comes into focus tile by tile in a ragged sweep from left to right;
- `beam-and-patches`: a beam sweeps over the picture while its patches light up one by one;
- `viewfinder`: the picture dims and a viewfinder's brackets hop from region to region, the region's position in the picture's pixels above them;
- `none`: the picture stays as it is.

With the transcript's `pictureFlight`, patches of the picture also fly into the reply's orb, where the reply will come: every third tile revealed, or one from each region the viewfinder hops to. Under reduced motion the picture stays as it is.

```ts
type NeatPictureMotion = 'coming-into-focus' | 'beam-and-patches' | 'viewfinder' | 'none'
```

### `NEAT_PICTURE_MOTIONS`

Constant from `@sima/neat-ui/chat`.

Every picture motion, in the order a picker lists them.

```ts
const NEAT_PICTURE_MOTIONS: readonly NeatPictureMotion[]
```
