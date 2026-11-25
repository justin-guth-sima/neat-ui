import { signal, type Signal } from '@angular/core';

/** How long after the browser gives up on a source a new one is opened. */
const REOPEN_MS = 1000;

/**
 * An app's server-sent events, each event's data one JSON object with a `type` (an app server's
 * `/api/events`):
 *
 * ```ts
 * const events = new NeatEventStream<BoardEvent>('/api/events');
 * events.on<TokensEvent>('chat.tokens', (event) => feed.push(event));
 * ```
 *
 * `on` calls a listener for each message of one type and returns its unsubscribe function;
 * `messages` is the last message and `connected` whether the connection is open. The browser's
 * `EventSource` reconnects by itself after a dropped connection; when it gives up (it closes the
 * source, on an HTTP error for example) a new one is opened after a second. Data that is not JSON,
 * or has no string `type`, is ignored. `close()` stops for good; call it when the page that made the
 * stream goes (`DestroyRef.onDestroy`).
 */
export class NeatEventStream<T extends { type: string }> {
  private readonly last = signal<T | null>(null);
  private readonly open = signal(false);
  private readonly listeners = new Map<string, Set<(message: T) => void>>();
  private source: EventSource | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  /** The last message received, or null before the first. */
  readonly messages: Signal<T | null> = this.last.asReadonly();
  /** True while the connection is open; false while connecting or reconnecting. */
  readonly connected: Signal<boolean> = this.open.asReadonly();

  /** Opens the stream at `url` at once. */
  constructor(private readonly url: string) {
    this.connect();
  }

  /** Calls `listener` for every message of `type`; returns the function that unsubscribes it. */
  on<M extends T = T>(type: M['type'], listener: (message: M) => void): () => void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    const entry = listener as (message: T) => void;
    set.add(entry);
    return () => set.delete(entry);
  }

  /** Stops for good: the source is closed and no new one is opened. */
  close(): void {
    this.closed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.source?.close();
    this.source = null;
    this.open.set(false);
  }

  private connect(): void {
    const source = new EventSource(this.url);
    this.source = source;
    source.onopen = () => this.open.set(true);
    source.onmessage = (event: MessageEvent) => this.receive(event.data);
    source.onerror = () => {
      this.open.set(false);
      if (source.readyState !== EventSource.CLOSED || this.closed) return;
      source.close();
      if (this.timer !== null) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.connect(), REOPEN_MS);
    };
  }

  private receive(data: unknown): void {
    let message: T;
    try {
      message = JSON.parse(String(data)) as T;
    } catch {
      return;
    }
    if (typeof message?.type !== 'string') return;
    this.last.set(message);
    for (const listener of this.listeners.get(message.type) ?? []) listener(message);
  }
}
