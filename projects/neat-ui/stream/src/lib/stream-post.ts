/** Options of `neatStreamPost`. */
export interface NeatStreamPostOptions {
  /** Aborting it stops the reply: the request is canceled and the stream ends without an error. */
  readonly signal?: AbortSignal;
  /** Headers sent besides `Content-Type: application/json`. */
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * The `fetch` to send the request with, the browser's own by default. Give one to read the
   * answer's headers as well, or to feed a stream that does not come from a server (an example, a
   * test).
   */
  readonly fetch?: typeof fetch;
}

/**
 * Why a streamed reply failed. `code` is the server's own (`error.code` of an
 * `{error: {code, message}}` answer, such as `models_restarting`), else `http_<status>` for an
 * error answer without one, `connection_lost` when no answer came or the connection broke during
 * the reply, and `invalid_reply` for a `data:` line that is not JSON. The `message` is the
 * server's where it gave one, so it can be shown as it is.
 */
export class NeatStreamError extends Error {
  /** The reason as a code (see the class). */
  readonly code: string;
  /** The answer's HTTP status, or null when no answer came. */
  readonly status: number | null;

  constructor(code: string, message: string, status: number | null = null) {
    super(message);
    this.name = 'NeatStreamError';
    this.code = code;
    this.status = status;
  }
}

/**
 * A streamed reply to a POST, as OpenAI-style servers send one (a chat completion with
 * `stream: true`): `body` goes as JSON, and each `data:` line of the answer is yielded as its
 * parsed JSON, until `data: [DONE]` or the end of the answer.
 *
 * ```ts
 * for await (const chunk of neatStreamPost('/v1/chat/completions', request, { signal })) {
 *   text += chunk.choices[0]?.delta?.content ?? '';
 * }
 * ```
 *
 * Aborting `signal` ends the loop quietly, which is how Stop works. A failure, before the first
 * line or during the reply, throws a `NeatStreamError`. Comment lines (`: keep-alive`) and blank
 * lines are skipped.
 */
export async function* neatStreamPost(
  url: string,
  body: unknown,
  options: NeatStreamPostOptions = {},
): AsyncGenerator<unknown, void, undefined> {
  const { signal } = options;
  if (signal?.aborted) return;
  const send = options.fetch ?? globalThis.fetch.bind(globalThis);
  let answer: Response;
  try {
    answer = await send(url, {
      method: 'POST',
      headers: { ...options.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) return;
    throw new NeatStreamError('connection_lost', describe(error));
  }
  if (!answer.ok) throw await errorOf(answer);
  if (!answer.body) return;

  // The body's own reader, not a piped one: canceling it reaches the connection at once.
  const reader = answer.body.getReader();
  const decoder = new TextDecoder();
  const cancel = () => void reader.cancel().catch(() => undefined);
  signal?.addEventListener('abort', cancel, { once: true });
  let pending = '';
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        if (signal?.aborted) return;
        throw new NeatStreamError('connection_lost', describe(error));
      }
      if (signal?.aborted) return;
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true });
      const lines = pending.split(/\r\n|\r|\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        const data = dataOf(line);
        if (data === null) continue;
        if (data === '[DONE]') return;
        yield parseData(data);
        if (signal?.aborted) return;
      }
    }
    const last = dataOf(pending + decoder.decode());
    if (last !== null && last !== '[DONE]') yield parseData(last);
  } finally {
    signal?.removeEventListener('abort', cancel);
    cancel();
  }
}

/** The data of a `data:` line, or null for any other line. */
function dataOf(line: string): string | null {
  if (!line.startsWith('data:')) return null;
  const data = line.slice(5);
  return data.startsWith(' ') ? data.slice(1) : data;
}

function parseData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    throw new NeatStreamError('invalid_reply', 'The server sent a reply that is not JSON.');
  }
}

async function errorOf(answer: Response): Promise<NeatStreamError> {
  const fallback = new NeatStreamError(
    `http_${answer.status}`,
    `The server answered ${answer.status}${answer.statusText ? ` ${answer.statusText}` : ''}.`,
    answer.status,
  );
  let parsed: unknown;
  try {
    parsed = await answer.json();
  } catch {
    return fallback;
  }
  const error = (parsed as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  if (typeof error?.code !== 'string') return fallback;
  const message = typeof error.message === 'string' ? error.message : fallback.message;
  return new NeatStreamError(error.code, message, answer.status);
}

function describe(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'The connection was lost.';
}
