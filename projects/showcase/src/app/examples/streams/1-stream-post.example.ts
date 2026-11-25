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

/**
 * A streamed reply to a POST, read piece by piece into a `neat-markdown`. Stop aborts the request
 * and the loop ends quietly; a failure would come as a `NeatStreamError` with the server's code and
 * message.
 */
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
