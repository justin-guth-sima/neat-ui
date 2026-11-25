import { NeatEventStream } from './event-stream';

/** An `EventSource` the test drives: it opens, delivers messages and fails on command. */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];

  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  open(): void {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }
  send(data: string): void {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
  /** The browser gives up: the source is closed and an error fires. */
  giveUp(): void {
    this.readyState = FakeEventSource.CLOSED;
    this.onerror?.();
  }
  /** A dropped connection the browser reopens by itself. */
  drop(): void {
    this.readyState = FakeEventSource.CONNECTING;
    this.onerror?.();
  }
  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }
}

type Event = { type: 'status'; ok: boolean } | { type: 'tokens'; n: number };

describe('NeatEventStream', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('routes each message to the listeners of its type', () => {
    const stream = new NeatEventStream<Event>('/api/events');
    const tokens: number[] = [];
    const off = stream.on<Extract<Event, { type: 'tokens' }>>('tokens', (m) => tokens.push(m.n));
    const source = FakeEventSource.instances[0];
    source.send('{"type":"tokens","n":3}');
    source.send('{"type":"status","ok":true}');
    off();
    source.send('{"type":"tokens","n":4}');
    expect(tokens).toEqual([3]);
    expect(stream.messages()).toEqual({ type: 'tokens', n: 4 });
    stream.close();
  });

  it('ignores data that is not JSON or has no type', () => {
    const stream = new NeatEventStream<Event>('/api/events');
    const source = FakeEventSource.instances[0];
    source.send('not json');
    source.send('{"n":1}');
    expect(stream.messages()).toBeNull();
    stream.close();
  });

  it('connected follows open and error', () => {
    const stream = new NeatEventStream<Event>('/api/events');
    const source = FakeEventSource.instances[0];
    expect(stream.connected()).toBe(false);
    source.open();
    expect(stream.connected()).toBe(true);
    source.drop();
    expect(stream.connected()).toBe(false);
    expect(FakeEventSource.instances).toHaveLength(1);
    stream.close();
  });

  it('opens a new source 1 s after the browser closed one', () => {
    vi.useFakeTimers();
    const stream = new NeatEventStream<Event>('/api/events');
    FakeEventSource.instances[0].giveUp();
    vi.advanceTimersByTime(999);
    expect(FakeEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[1].url).toBe('/api/events');
    stream.close();
  });

  it('stays disconnected, without throwing, where the browser has no EventSource', () => {
    vi.stubGlobal('EventSource', undefined);
    const stream = new NeatEventStream<Event>('/api/events');
    expect(stream.connected()).toBe(false);
    expect(stream.messages()).toBeNull();
    stream.close();
  });

  it('close stops for good', () => {
    vi.useFakeTimers();
    const stream = new NeatEventStream<Event>('/api/events');
    const source = FakeEventSource.instances[0];
    source.open();
    stream.close();
    expect(source.closed).toBe(true);
    expect(stream.connected()).toBe(false);
    source.giveUp();
    vi.advanceTimersByTime(5000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
