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

/**
 * An app server's events, each a JSON object with a `type`: `on` calls a listener for one type,
 * `connected` says whether the stream is open, and the stream reopens by itself when the
 * connection drops. Closed when the page goes.
 *
 * @unpictured
 */
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
