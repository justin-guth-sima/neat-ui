<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Message box

_Components › Chat_ · [All topics](../README.md)

Where the visitor writes a question, adds pictures to it, sends it, or stops the reply.

```html
<neat-message-box
  [activity]="conversation.activity()"
  (send)="conversation.ask($event)"
  (stop)="conversation.stop()"
/>
```

<picture>
<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="../images/message-box/message-box.dark.webp">
<source media="(prefers-reduced-motion: reduce)" srcset="../images/message-box/message-box.light.webp">
<source media="(prefers-color-scheme: dark)" srcset="../images/message-box/message-box.dark.animated.webp">
<img src="../images/message-box/message-box.light.animated.webp" alt="Message box: Message box" width="480">
</picture>

```ts
import { NeatMessageBox, NEAT_MESSAGE_BOX_GLOWS, pictureFromFile } from '@sima/neat-ui/chat';
```

## Examples

### Message box

The message box while a pretend board works through a question again and again: the comet runs round its edge until the first word and faster while the reply arrives, and Send turns into Stop meanwhile. Type a question and press Enter, or drop a picture on the box.

<picture>
<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="../images/message-box/message-box.dark.webp">
<source media="(prefers-reduced-motion: reduce)" srcset="../images/message-box/message-box.light.webp">
<source media="(prefers-color-scheme: dark)" srcset="../images/message-box/message-box.dark.animated.webp">
<img src="../images/message-box/message-box.light.animated.webp" alt="Message box: Message box" width="480">
</picture>

<details>
<summary>Code</summary>

`1-message-box.example.ts`

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NeatMessageBox,
  type NeatChatDraft,
  type NeatMessageBoxActivity,
} from '@sima/neat-ui/chat';

/** How long the example's pretend board spends on each activity, in ms. */
const PHASES: readonly (readonly [NeatMessageBoxActivity, number])[] = [
  ['idle', 800],
  ['waiting', 1200],
  ['streaming', 2000],
];

@Component({
  selector: 'app-message-box',
  imports: [NeatMessageBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-message-box.example.html',
  styleUrl: './message-box.example.css',
})
export class MessageBox {
  protected readonly activity = signal<NeatMessageBoxActivity>('idle');
  protected readonly sent = signal<NeatChatDraft[]>([]);

  constructor() {
    let phase = 0;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      this.activity.set(PHASES[phase][0]);
      timer = setTimeout(next, PHASES[phase][1]);
      phase = (phase + 1) % PHASES.length;
    };
    next();
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  protected onSend(draft: NeatChatDraft): void {
    this.sent.update((sent) => [...sent, draft]);
  }
}
```

`1-message-box.example.html`

```html
<neat-message-box [activity]="activity()" (send)="onSend($event)" (stop)="activity.set('idle')" />
@if (sent().length) {
  <ul class="sent" aria-label="Sent">
    @for (draft of sent(); track $index) {
      <li>Sent: {{ draft.text || '(no text)' }} · {{ draft.pictures.length }} pictures</li>
    }
  </ul>
}
```

`message-box.example.css`

```css
/* A message box a little narrower than a conversation's column, to keep its animation small. */
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
  max-width: 30rem;
  padding: var(--neat-space-4);
}

.sent {
  font-size: var(--neat-text-sm);
  color: var(--muted-foreground);
}
```

</details>

### Restoring a draft

A draft the app hands the box: its text and a picture made with [`pictureFromFile`](../components/message-box.md#picturefromfile) from an image file (here one fetched from the page's own files), at most two pictures. Remove the picture with its button, or add another by choosing or dropping one.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/message-box/restoring-a-draft.dark.webp">
<img src="../images/message-box/restoring-a-draft.light.webp" alt="Message box: Restoring a draft" width="640">
</picture>

<details>
<summary>Code</summary>

`2-restoring-a-draft.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatMessageBox, pictureFromFile, type NeatChatPicture } from '@sima/neat-ui/chat';

@Component({
  selector: 'app-restoring-a-draft',
  imports: [NeatMessageBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-restoring-a-draft.example.html',
  styleUrl: './restoring-a-draft.example.css',
})
export class RestoringADraft {
  protected readonly text = signal('What could I cook with this?');
  protected readonly pictures = signal<readonly NeatChatPicture[]>([]);

  constructor() {
    void this.restore();
  }

  private async restore(): Promise<void> {
    try {
      const answer = await fetch('examples/shelf.webp');
      const file = new File([await answer.blob()], 'shelf.webp', { type: 'image/webp' });
      this.pictures.set([pictureFromFile(file)]);
    } catch {
      // Without the picture the draft is its text alone.
    }
  }
}
```

`2-restoring-a-draft.example.html`

```html
<neat-message-box [maxPictures]="2" [(text)]="text" [(pictures)]="pictures" />
```

`restoring-a-draft.example.css`

```css
/* A message box as wide as a conversation's column. */
:host {
  display: block;
  max-width: 40rem;
  padding: var(--neat-space-4);
}
```

</details>

### Glows

The four glows ([`NEAT_MESSAGE_BOX_GLOWS`](../components/message-box.md#neat_message_box_glows)) while a pretend board works through a question again and again: each moves while the board reads the question, faster while the reply arrives, and goes once it is done. Under reduced motion each shows its colors still.

<picture>
<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="../images/message-box/glows.dark.webp">
<source media="(prefers-reduced-motion: reduce)" srcset="../images/message-box/glows.light.webp">
<source media="(prefers-color-scheme: dark)" srcset="../images/message-box/glows.dark.animated.webp">
<img src="../images/message-box/glows.light.animated.webp" alt="Message box: Glows" width="480">
</picture>

<details>
<summary>Code</summary>

`3-glows.example.ts`

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NEAT_MESSAGE_BOX_GLOWS,
  NeatMessageBox,
  type NeatMessageBoxActivity,
  type NeatMessageBoxGlow,
} from '@sima/neat-ui/chat';

/** How long the example's pretend board spends on each activity, in ms. */
const PHASES: readonly (readonly [NeatMessageBoxActivity, number])[] = [
  ['idle', 800],
  ['waiting', 1200],
  ['streaming', 2000],
];

/** Each glow's name in words. */
const NAMES: Record<NeatMessageBoxGlow, string> = {
  comet: 'Comet',
  ring: 'Glow ring',
  aurora: 'Aurora',
  sheen: 'Sheen',
  none: 'None',
};

@Component({
  selector: 'app-glows',
  imports: [NeatMessageBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-glows.example.html',
  styleUrl: './glows.example.css',
})
export class Glows {
  protected readonly glows = NEAT_MESSAGE_BOX_GLOWS.map((glow) => ({ glow, name: NAMES[glow] }));
  protected readonly activity = signal<NeatMessageBoxActivity>('idle');

  constructor() {
    let phase = 0;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      this.activity.set(PHASES[phase][0]);
      timer = setTimeout(next, PHASES[phase][1]);
      phase = (phase + 1) % PHASES.length;
    };
    next();
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }
}
```

`3-glows.example.html`

```html
@for (item of glows; track item.glow) {
  <div class="glow">
    <span class="name">{{ item.name }}</span>
    <neat-message-box
      [glow]="item.glow"
      [activity]="activity()"
      [label]="'Message, ' + item.name"
    />
  </div>
}
```

`glows.example.css`

```css
/* The boxes a little narrower than a conversation's column, with room for the aurora below each. */
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-6);
  max-width: 30rem;
  padding: var(--neat-space-4);
}

.glow {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-2);
}

.name {
  font-size: var(--neat-text-sm);
  color: var(--muted-foreground);
}
```

</details>

### Voice and camera

The message box with push-to-talk (`talk`) and the camera (`camera`): hold the microphone and speak, or tap it twice, and the box emits the recording, which an app sends to speech-to-text while `transcribing` (the example pretends for a moment and shows its size). Camera opens a dialog with the laptop camera's preview, and Take adds the photo to the draft. Pick how the voice shows while it records; in the message box, the waveform takes the text's place.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/message-box/voice-and-camera.dark.webp">
<img src="../images/message-box/voice-and-camera.light.webp" alt="Message box: Voice and camera" width="482">
</picture>

<details>
<summary>Code</summary>

`4-voice-and-camera.example.ts`

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NEAT_LISTENING_MOTIONS,
  NeatMessageBox,
  type NeatChatPicture,
  type NeatListeningMotion,
} from '@sima/neat-ui/chat';
import { NeatSelect, type NeatSelectOption } from '@sima/neat-ui/select';

const NAMES: Record<NeatListeningMotion, string> = {
  'ring-and-waveform': 'Ring and waveform',
  radial: 'Radial',
  'in-message-box': 'In the message box',
};

@Component({
  selector: 'app-voice-and-camera',
  imports: [NeatMessageBox, NeatSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-voice-and-camera.example.html',
  styleUrl: './voice-and-camera.example.css',
})
export class VoiceAndCamera {
  protected readonly motions: readonly NeatSelectOption<NeatListeningMotion>[] =
    NEAT_LISTENING_MOTIONS.map((motion) => ({ value: motion, label: NAMES[motion] }));
  protected readonly motion = signal<NeatListeningMotion | null>('in-message-box');
  protected readonly pictures = signal<readonly NeatChatPicture[]>([]);
  protected readonly transcribing = signal(false);
  protected readonly last = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onRecorded(recording: Blob): void {
    // An app sends the recording to speech-to-text here; the example pretends for 0.6 s.
    this.transcribing.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.transcribing.set(false), 600);
    this.last.set(`${Math.round(recording.size / 1000)} kB`);
  }
}
```

`4-voice-and-camera.example.html`

```html
<neat-select
  label="Listening motion"
  showLabel
  labelPosition="inline"
  [options]="motions"
  [(value)]="motion"
/>
<neat-message-box
  talk
  camera
  [listeningMotion]="motion() ?? 'in-message-box'"
  [transcribing]="transcribing()"
  [(pictures)]="pictures"
  (recorded)="onRecorded($event)"
/>
@if (last(); as size) {
  <p class="last">Last recording: {{ size }}</p>
}
```

`voice-and-camera.example.css`

```css
/* A message box a little narrower than a conversation's column, with its choice above it. */
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
  max-width: 30rem;
  padding: var(--neat-space-4);
}

.last {
  font-size: var(--neat-text-sm);
  color: var(--muted-foreground);
}
```

</details>

## API

### `NeatMessageBox`

Component from `@sima/neat-ui/chat`, selector `neat-message-box`.

The text area grows with what is written, up to eight lines, then scrolls. Enter sends, Shift+Enter starts a new line, and Enter while an input method composes (Japanese, say) only composes. A draft is its text and its pictures; one with neither cannot be sent, and Send says so (`aria-disabled`). Sent, the box is empty again.

**While the board works** (`activity` other than `idle`) Send is Stop, which emits `stop`, and Enter sends nothing; so while the app reads a reply aloud (`speaking`), what Stop ends is the app's to say. The `glow` shows it too ([`NeatMessageBoxGlow`](../components/message-box.md#neatmessageboxglow)): the comet runs round the edge while the board reads the question (`waiting`) and once every `glowTurnMs` × 0.6 while the reply arrives (`streaming`); the ring, the aurora and the sheen breathe while it waits and turn, drift or sweep once every `glowTurnMs` while it streams, each the look and pace of the mockup it was chosen from. The glow is the board's, so `speaking` shows none.

**Pictures** come from the Picture button (the system's file chooser) or a drop of image files on the box, up to `maxPictures`, each a thumbnail with a button that removes it. Files that are no images are left out. The pictures' object URLs are the box's until it sends them; then they are the app's (see [`pictureFromFile`](../components/message-box.md#picturefromfile)).

**Push-to-talk** (`talk`) sits beside Send: the visitor holds it, or taps it twice, to ask by voice ([`NeatPushToTalk`](../components/push-to-talk.md#neatpushtotalk)). The box emits the recording as `recorded` for the app to turn into a question, and forwards `recording` (both ways), `transcribing` and `listeningMotion` to it; `disabled` disables it too. A spoken question does not take the typed draft, which stays in the box. With the `in-message-box` listening motion, the voice shows as a waveform where the text was, the text area see-through beneath it (it keeps its size and stays in the accessibility tree); on release the bars collapse and stay so while `transcribing`, and the heard question then flies out of the box into the transcript. Under reduced motion it is push-to-talk's level meter. Recording does not change the glow, which is the board's.

**The camera** (`camera`): a Camera button after Picture opens a dialog with the laptop camera's live preview and Take, which adds the frame to the draft as a picture ("Photo from the camera"). The button waits (`aria-disabled`) while the draft is full, while push-to-talk records and while the box is disabled. The camera stops as the dialog closes; a problem ("Camera blocked", "No camera") is said in the dialog. The camera exists only in a secure context (HTTPS or localhost).

`text` and `pictures` are models, so an app can keep or restore a draft.

**Inputs**

- **`activity`** `NeatMessageBoxActivity`, default `'idle'`

  What the board is doing with the last question; Send is Stop while it is not `idle`.

- **`glow`** `NeatMessageBoxGlow`, default `'comet'`

  The glow round the box while the board works ([`NeatMessageBoxGlow`](../components/message-box.md#neatmessageboxglow)): `comet`, the default, `ring`, `aurora`, `sheen` or `none`. It moves until the first word and faster while the reply arrives, at its own pace, not the reply's. Still under reduced motion.

- **`glowTurnMs`** `number`, default `2400`

  How long the glow takes once round the box while the reply arrives, in ms.

- **`placeholder`** `string`, default `'Ask something…'`

  The text area's hint while it is empty.

- **`label`** `string`, default `'Message'`

  The text area's name for assistive technology.

- **`disabled`** `boolean`, default `false`, transform `booleanAttribute`

  No writing, no pictures and no sending.

- **`maxPictures`** `number`, default `4`

  How many pictures a draft may hold.

- **`camera`** `boolean`, default `false`, transform `booleanAttribute`

  Shows a Camera button after Picture, which takes a photo with the laptop camera.

- **`talk`** `boolean`, default `false`, transform `booleanAttribute`

  Shows push-to-talk beside Send, for asking by voice.

- **`transcribing`** `boolean`, default `false`, transform `booleanAttribute`

  The app's speech-to-text is working on the last recording.

- **`listeningMotion`** `NeatListeningMotion`, default `'in-message-box'`

  How the voice shows while push-to-talk records ([`NeatListeningMotion`](../components/push-to-talk.md#neatlisteningmotion)): `in-message-box`, the default, a waveform where the text was, or push-to-talk's own others.

**Models (two-way)**

- **`text`** `string`, default `''`

  The draft's text.

- **`pictures`** `readonly NeatChatPicture[]`, default `[]`

  The draft's pictures.

- **`recording`** `boolean`, default `false`

  Push-to-talk asks for the microphone or records; set it to start or stop, as its own.

**Outputs**

- **`recorded`** `Blob`

  A recording made in the box, for the app to turn into a question.

- **`send`** `NeatChatDraft`

  A draft was sent: its text (trimmed) and its pictures, which are the app's from now on.

- **`stop`** `void`

  Stop was pressed while the board worked.

### `NeatMessageBoxActivity`

Type from `@sima/neat-ui/chat`.

What the board is doing with the last question: `idle` (nothing), `waiting` (sent, no word yet) or `streaming` (the reply arrives); or `speaking`, the board done but the app still reading the reply aloud, so Stop can end the reading.

```ts
type NeatMessageBoxActivity = 'idle' | 'waiting' | 'streaming' | 'speaking'
```

### `NeatMessageBoxGlow`

Type from `@sima/neat-ui/chat`.

How the box shows that the board works on a reply:

- `comet`, the default: a bright head with a colored tail running round its edge;
- `ring`: the series colors turning round the whole edge in a soft halo;
- `aurora`: the series colors along the edge, with their light drifting below the box;
- `sheen`: the series colors along the edge, and a band of light crossing the box;
- `none`: no glow.

Each breathes or turns while the board reads the question and runs faster while the reply arrives; under reduced motion it shows its colors still.

```ts
type NeatMessageBoxGlow = 'comet' | 'ring' | 'aurora' | 'sheen' | 'none'
```

### `NEAT_MESSAGE_BOX_GLOWS`

Constant from `@sima/neat-ui/chat`.

Every glow of the message box, the default first, for a picker.

```ts
const NEAT_MESSAGE_BOX_GLOWS: readonly NeatMessageBoxGlow[]
```

### `NeatChatDraft`

Interface from `@sima/neat-ui/chat`.

What the message box sends: the question's text and its pictures.

**Members**

- **`text`** `string`

- **`pictures`** `readonly NeatChatPicture[]`

### `NeatChatPicture`

Interface from `@sima/neat-ui/chat`.

A picture attached to a question: shown as a thumbnail in the message box and in the message. `src` is what an `img` shows (an object URL from [`pictureFromFile`](../components/message-box.md#picturefromfile), or any address), `name` its alternative text, and `file` the picture itself, for the app to send.

**Members**

- **`id`** `string`

  Unique among the pictures shown together.

- **`src`** `string`

- **`name`** `string`

- **`file`** `File`, optional

### `pictureFromFile`

Function from `@sima/neat-ui/chat`.

A picture for the message box or a message, from an image file: an object URL to show it, its file name as its alternative text, and the file itself, for the app to send. The object URL lives until it is revoked: the message box revokes a picture removed from it, and once a draft is sent its pictures are the app's, to revoke when they are no longer shown.

```ts
pictureFromFile(file: File): NeatChatPicture
```
