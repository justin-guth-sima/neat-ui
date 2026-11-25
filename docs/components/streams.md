<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Streams

_Components › Chat_ · [All topics](../README.md)

A streamed reply to a POST, as OpenAI-style servers send one (a chat completion with `stream: true`): `body` goes as JSON, and each `data:` line of the answer is yielded as its parsed JSON, until `data: [DONE]` or the end of the answer.

```ts
for await (const chunk of neatStreamPost('/v1/chat/completions', request, { signal })) {
  text += chunk.choices[0]?.delta?.content ?? '';
}
```

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/streams/stream-post.dark.webp">
<img src="../images/streams/stream-post.light.webp" alt="Streams: Stream post" width="78">
</picture>

```ts
import { neatStreamPost, NeatStreamError, NeatEventStream } from '@sima/neat-ui/stream';
```

## Examples

### Stream post

A streamed reply to a POST, read piece by piece into a `neat-markdown`. Stop aborts the request and the loop ends quietly; a failure would come as a [`NeatStreamError`](../components/streams.md#neatstreamerror) with the server's code and message.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/streams/stream-post.dark.webp">
<img src="../images/streams/stream-post.light.webp" alt="Streams: Stream post" width="78">
</picture>

<details>
<summary>Code</summary>

`1-stream-post.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatMarkdown } from '@sima/neat-ui/markdown';
import { neatStreamPost, NeatStreamError } from '@sima/neat-ui/stream';

/** The chunks an OpenAI-style server streams for this example's reply. */
const PIECES = 'The board reads the **shelf**: dried pasta, olive oil, tomatoes and garlic.'.match(
  /\s+|\S+/g,
)!;

/**
 * A stand-in for the server, so the example runs without one: it answers a POST with a streamed
 * reply, one `data:` line per piece, 60 ms apart, then `data: [DONE]`. An app leaves `fetch` out.
 */
const fakeServer: typeof fetch = async (_url, init) => {
  const encoder = new TextEncoder();
  const signal = init?.signal;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const piece of PIECES) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        if (signal?.aborted) return;
        const chunk = { choices: [{ delta: { content: piece } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
};

/** A chunk of an OpenAI-style streamed chat completion. */
interface Chunk {
  readonly choices?: readonly { readonly delta?: { readonly content?: string } }[];
}

@Component({
  selector: 'app-stream-post',
  imports: [NeatButton, NeatMarkdown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-stream-post.example.html',
  styleUrl: './stream-post.example.css',
})
export class StreamPost {
  protected readonly text = signal('');
  protected readonly running = signal(false);
  protected readonly failure = signal('');
  private abort: AbortController | null = null;

  protected async ask(): Promise<void> {
    this.abort = new AbortController();
    this.text.set('');
    this.failure.set('');
    this.running.set(true);
    const request = { model: 'qwen3-vl-4b', stream: true, messages: [] };
    try {
      for await (const chunk of neatStreamPost('/v1/chat/completions', request, {
        signal: this.abort.signal,
        fetch: fakeServer,
      })) {
        const piece = (chunk as Chunk).choices?.[0]?.delta?.content ?? '';
        this.text.update((text) => text + piece);
      }
    } catch (error) {
      this.failure.set(error instanceof NeatStreamError ? error.message : String(error));
    } finally {
      this.running.set(false);
    }
  }

  protected stop(): void {
    this.abort?.abort();
  }
}
```

`1-stream-post.example.html`

```html
<div class="actions">
  @if (running()) {
    <button neatButton variant="danger" size="small" type="button" (click)="stop()">Stop</button>
  } @else {
    <button neatButton size="small" type="button" (click)="ask()">Ask</button>
  }
</div>
<neat-markdown [text]="text()" [streaming]="running()" />
@if (failure()) {
  <p class="failure">{{ failure() }}</p>
}
```

`stream-post.example.css`

```css
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
  min-height: 6rem;
}

.failure {
  color: var(--destructive);
}
```

</details>

### Event stream

An app server's events, each a JSON object with a `type`: `on` calls a listener for one type, `connected` says whether the stream is open, and the stream reopens by itself when the connection drops. Closed when the page goes.

<details>
<summary>Code</summary>

`2-event-stream.example.ts`

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NeatEventStream } from '@sima/neat-ui/stream';

/** The app server's events in this example. */
type BoardEvent =
  | { readonly type: 'status'; readonly state: string }
  | { readonly type: 'chat.end'; readonly tokens: number; readonly ms: number };

/**
 * A stand-in for the server's `/api/events`: the events of one reply as a `data:` URL, so the
 * example runs without a server (its `retry` keeps the browser from opening it again for an hour).
 * An app gives its own address.
 */
const EVENTS =
  'data:text/event-stream,' +
  encodeURIComponent(
    'retry: 3600000\n\n' +
      'data: {"type":"status","state":"ready"}\n\n' +
      'data: {"type":"chat.end","tokens":42,"ms":1710}\n\n',
  );

@Component({
  selector: 'app-event-stream',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-event-stream.example.html',
})
export class EventStream {
  protected readonly lines = signal<string[]>([]);
  private readonly events = new NeatEventStream<BoardEvent>(EVENTS);
  protected readonly connected = this.events.connected;

  constructor() {
    this.events.on<Extract<BoardEvent, { type: 'status' }>>('status', (event) =>
      this.lines.update((lines) => [...lines, `Board ${event.state}`]),
    );
    this.events.on<Extract<BoardEvent, { type: 'chat.end' }>>('chat.end', (event) =>
      this.lines.update((lines) => [...lines, `Reply: ${event.tokens} tokens in ${event.ms} ms`]),
    );
    inject(DestroyRef).onDestroy(() => this.events.close());
  }
}
```

`2-event-stream.example.html`

```html
<p>{{ connected() ? 'Connected' : 'Connecting…' }}</p>
<ul>
  @for (line of lines(); track $index) {
    <li>{{ line }}</li>
  }
</ul>
```

</details>

## API

### `neatStreamPost`

Function from `@sima/neat-ui/stream`.

Aborting `signal` ends the loop quietly, which is how Stop works. A failure, before the first line or during the reply, throws a [`NeatStreamError`](../components/streams.md#neatstreamerror): an error answer, a `data:` line that carries an error (`{"error": {"code", "message"}}`, how a reply that fails after it started says so), and an answer that ends before `data: [DONE]`, since a complete reply always ends with it. Comment lines (`: keep-alive`) and blank lines are skipped.

```ts
neatStreamPost(url: string, body: unknown, options: NeatStreamPostOptions = {}): AsyncGenerator<unknown, void, undefined>
```

### `NeatEventStream`

Class from `@sima/neat-ui/stream`.

An app's server-sent events, each event's data one JSON object with a `type` (an app server's `/api/events`):

```ts
const events = new NeatEventStream<BoardEvent>('/api/events');
events.on<TokensEvent>('chat.tokens', (event) => feed.push(event));
```

`on` calls a listener for each message of one type and returns its unsubscribe function; `messages` is the last message and `connected` whether the connection is open. The browser's `EventSource` reconnects by itself after a dropped connection; when it gives up (it closes the source, on an HTTP error for example) a new one is opened after a second. Data that is not JSON, or has no string `type`, is ignored. Where the browser has no `EventSource` (a page rendered on a server) the stream stays disconnected. `close()` stops for good; call it when the page that made the stream goes (`DestroyRef.onDestroy`).

**Properties**

- **`messages`** `Signal<T | null>`

  The last message received, or null before the first.

- **`connected`** `Signal<boolean>`

  True while the connection is open; false while connecting or reconnecting.

**Methods**

- **`on`**

  ```ts
  on<M extends T = T>(type: M['type'], listener: (message: M) => void): () => void
  ```

  Calls `listener` for every message of `type`; returns the function that unsubscribes it.

- **`close`**

  ```ts
  close(): void
  ```

  Stops for good: the source is closed and no new one is opened.

### `NeatStreamPostOptions`

Interface from `@sima/neat-ui/stream`.

Options of [`neatStreamPost`](../components/streams.md#neatstreampost).

**Members**

- **`signal`** `AbortSignal`, optional

  Aborting it stops the reply: the request is canceled and the stream ends without an error.

- **`headers`** `Readonly<Record<string, string>>`, optional

  Headers sent besides `Content-Type: application/json`.

- **`fetch`** `typeof fetch`, optional

  The `fetch` to send the request with, the browser's own by default. Give one to read the answer's headers as well, or to feed a stream that does not come from a server (an example, a test).

### `NeatStreamError`

Class from `@sima/neat-ui/stream`.

Why a streamed reply failed. `code` is the server's own (`error.code` of an `{error: {code, message}}` answer, such as `models_restarting`), else `http_<status>` for an error answer without one, `connection_lost` when no answer came or the connection broke during the reply, and `invalid_reply` for a `data:` line that is not JSON. The `message` is the server's where it gave one, so it can be shown as it is.

**Properties**

- **`code`** `string`

  The reason as a code (see the class).

- **`status`** `number | null`

  The answer's HTTP status, or null when no answer came.
