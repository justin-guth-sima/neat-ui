import { neatStreamPost, NeatStreamError } from './stream-post';

/** A body the test writes chunk by chunk, and a fake `fetch` that answers with it. */
class FakeBody {
  private controller!: ReadableStreamDefaultController<Uint8Array>;
  canceled = false;
  readonly stream = new ReadableStream<Uint8Array>({
    start: (controller) => (this.controller = controller),
    cancel: () => {
      this.canceled = true;
    },
  });
  private readonly encoder = new TextEncoder();

  /** A write after the reader canceled is dropped, as a server's late bytes would be. */
  write(text: string): void {
    if (this.canceled) return;
    this.controller.enqueue(this.encoder.encode(text));
  }
  end(): void {
    this.controller.close();
  }
  fail(): void {
    this.controller.error(new TypeError('network error'));
  }
}

function fakeFetch(answer: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    return answer();
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

function streamed(body: FakeBody, status = 200): Response {
  return new Response(body.stream, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

async function collect(stream: AsyncIterable<unknown>): Promise<unknown[]> {
  const seen: unknown[] = [];
  for await (const item of stream) seen.push(item);
  return seen;
}

describe('neatStreamPost', () => {
  it('yields each data line as JSON, across chunk boundaries', async () => {
    const body = new FakeBody();
    const { fetch } = fakeFetch(() => streamed(body));
    const reading = collect(neatStreamPost('/v1/chat', {}, { fetch }));
    body.write(': keep-alive\n\ndata: {"a"');
    body.write(':1}\r\n\r\ndata: {"b":2}\n');
    body.write('\ndata: [DONE]\n\n');
    expect(await reading).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('ends at [DONE] without reading further', async () => {
    const body = new FakeBody();
    const { fetch } = fakeFetch(() => streamed(body));
    const reading = collect(neatStreamPost('/v1/chat', {}, { fetch }));
    body.write('data: {"a":1}\n\ndata: [DONE]\n\ndata: {"after":true}\n\n');
    expect(await reading).toEqual([{ a: 1 }]);
    expect(body.canceled).toBe(true);
  });

  it('ends quietly when the signal aborts mid-stream', async () => {
    const body = new FakeBody();
    const { fetch } = fakeFetch(() => streamed(body));
    const abort = new AbortController();
    const seen: unknown[] = [];
    body.write('data: {"a":1}\n\n');
    for await (const item of neatStreamPost('/v1/chat', {}, { fetch, signal: abort.signal })) {
      seen.push(item);
      abort.abort();
      body.write('data: {"b":2}\n\n');
    }
    expect(seen).toEqual([{ a: 1 }]);
    expect(body.canceled).toBe(true);
  });

  it('ends quietly when the signal was aborted before the answer', async () => {
    const { fetch } = fakeFetch(() => streamed(new FakeBody()));
    const abort = new AbortController();
    abort.abort();
    expect(await collect(neatStreamPost('/v1/chat', {}, { fetch, signal: abort.signal }))).toEqual(
      [],
    );
  });

  it("raises NeatStreamError with the server's code and message on a 503", async () => {
    const { fetch } = fakeFetch(
      () =>
        new Response(
          '{"error":{"code":"models_restarting","message":"The models are restarting."}}',
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    const error = await collect(neatStreamPost('/v1/chat', {}, { fetch })).catch((e) => e);
    expect(error).toBeInstanceOf(NeatStreamError);
    expect(error.code).toBe('models_restarting');
    expect(error.status).toBe(503);
    expect(error.message).toBe('The models are restarting.');
  });

  it("raises http_<status> when the error body is not the server's shape", async () => {
    const { fetch } = fakeFetch(() => new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await collect(neatStreamPost('/v1/chat', {}, { fetch })).catch((e) => e);
    expect(error).toBeInstanceOf(NeatStreamError);
    expect(error.code).toBe('http_502');
    expect(error.status).toBe(502);
  });

  it('raises connection_lost when the body errors after some lines', async () => {
    const body = new FakeBody();
    const { fetch } = fakeFetch(() => streamed(body));
    const seen: unknown[] = [];
    body.write('data: {"a":1}\n\n');
    const error = await (async () => {
      for await (const item of neatStreamPost('/v1/chat', {}, { fetch })) {
        seen.push(item);
        body.fail();
      }
    })().catch((e) => e);
    expect(seen).toEqual([{ a: 1 }]);
    expect(error).toBeInstanceOf(NeatStreamError);
    expect(error.code).toBe('connection_lost');
    expect(error.status).toBeNull();
  });

  it('raises connection_lost when no answer comes at all', async () => {
    const fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof globalThis.fetch;
    const error = await collect(neatStreamPost('/v1/chat', {}, { fetch })).catch((e) => e);
    expect(error).toBeInstanceOf(NeatStreamError);
    expect(error.code).toBe('connection_lost');
  });

  it('raises the error a data line carries, with its code and message, before any token', async () => {
    const body = new FakeBody();
    const { fetch } = fakeFetch(() => streamed(body));
    const reading = collect(neatStreamPost('/v1/chat', {}, { fetch }));
    body.write('data: {"error":{"code":"worker_lost","message":"The model worker stopped."}}\n\n');
    body.end();
    const error = await reading.catch((e) => e);
    expect(error).toBeInstanceOf(NeatStreamError);
    expect(error.code).toBe('worker_lost');
    expect(error.message).toBe('The model worker stopped.');
    expect(error.status).toBe(200);
  });

  it('raises the error a data line carries after tokens, which it yielded first', async () => {
    const body = new FakeBody();
    const { fetch } = fakeFetch(() => streamed(body));
    const seen: unknown[] = [];
    body.write('data: {"a":1}\n\ndata: {"error":{"code":"worker_lost","message":"Lost."}}\n\n');
    body.end();
    const error = await (async () => {
      for await (const item of neatStreamPost('/v1/chat', {}, { fetch })) seen.push(item);
    })().catch((e) => e);
    expect(seen).toEqual([{ a: 1 }]);
    expect(error.code).toBe('worker_lost');
  });

  it('raises connection_lost when the answer ends before [DONE]', async () => {
    const body = new FakeBody();
    const { fetch } = fakeFetch(() => streamed(body));
    const seen: unknown[] = [];
    body.write('data: {"a":1}\n\n');
    body.end();
    const error = await (async () => {
      for await (const item of neatStreamPost('/v1/chat', {}, { fetch })) seen.push(item);
    })().catch((e) => e);
    expect(seen).toEqual([{ a: 1 }]);
    expect(error).toBeInstanceOf(NeatStreamError);
    expect(error.code).toBe('connection_lost');
  });

  it('raises invalid_reply on a data line that is not JSON', async () => {
    const body = new FakeBody();
    const { fetch } = fakeFetch(() => streamed(body));
    const reading = collect(neatStreamPost('/v1/chat', {}, { fetch }));
    body.write('data: {nope\n\n');
    const error = await reading.catch((e) => e);
    expect(error).toBeInstanceOf(NeatStreamError);
    expect(error.code).toBe('invalid_reply');
  });

  it('sends the body as JSON with Content-Type application/json and the given headers', async () => {
    const body = new FakeBody();
    const { fetch, calls } = fakeFetch(() => streamed(body));
    const reading = collect(
      neatStreamPost('/v1/chat', { model: 'm' }, { fetch, headers: { 'X-Test': '1' } }),
    );
    body.write('data: [DONE]\n\n');
    await reading;
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/v1/chat');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toBe('{"model":"m"}');
    expect(new Headers(calls[0].init.headers).get('Content-Type')).toBe('application/json');
    expect(new Headers(calls[0].init.headers).get('X-Test')).toBe('1');
  });
});
