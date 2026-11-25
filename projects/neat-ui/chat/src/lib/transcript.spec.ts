import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatChatErrorActions, NeatChatMessageFooter, NeatChatTranscript } from './transcript';
import type { NeatChatMessage } from './types';

@Component({
  imports: [NeatChatTranscript, NeatChatMessageFooter, NeatChatErrorActions],
  template: `
    <neat-chat-transcript [messages]="messages()">
      <ng-template neatChatMessageFooter let-message>
        <span class="footer">footer of {{ message.id }}</span>
      </ng-template>
      <ng-template neatChatErrorActions let-message>
        <button type="button" class="new-chat">New chat after {{ message.id }}</button>
      </ng-template>
    </neat-chat-transcript>
  `,
})
class Host {
  readonly messages = signal<NeatChatMessage[]>([]);
}

function render(messages: NeatChatMessage[]) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.messages.set(messages);
  fixture.detectChanges();
  const element = fixture.nativeElement.querySelector('neat-chat-transcript') as HTMLElement;
  const set = (next: NeatChatMessage[]) => {
    fixture.componentInstance.messages.set(next);
    fixture.detectChanges();
  };
  return { fixture, element, set };
}

/** The transcript's scrolling log, given sizes jsdom does not lay out: 1000 high in 400, at the end. */
function scrollable(element: HTMLElement): HTMLElement {
  const log = element.querySelector('[role="log"]') as HTMLElement;
  let top = 600;
  Object.defineProperties(log, {
    scrollHeight: { configurable: true, get: () => 1000 },
    clientHeight: { configurable: true, get: () => 400 },
    scrollTop: {
      configurable: true,
      get: () => top,
      set: (value: number) => (top = Math.min(value, 600)),
    },
  });
  log.scrollTo = ((options: ScrollToOptions) => {
    log.scrollTop = options.top ?? top;
    log.dispatchEvent(new Event('scroll'));
  }) as typeof log.scrollTo;
  // The follow rule read the box before the sizes existed: a scroll at the end lets it start there.
  log.dispatchEvent(new Event('scroll'));
  return log;
}

const question: NeatChatMessage = {
  id: 'q1',
  role: 'user',
  text: "What's on this shelf?",
  pictures: [{ id: 'p1', src: 'blob:shelf', name: 'shelf.jpg' }],
};

describe('NeatChatTranscript', () => {
  it("renders the user's message as a bubble with its pictures", () => {
    const { element } = render([question]);
    const bubble = element.querySelector('[data-role="user"]')!;
    expect(bubble.textContent).toContain("What's on this shelf?");
    const img = bubble.querySelector('img[alt="shelf.jpg"]') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('blob:shelf');
  });

  it("keeps the user's text as written, not as Markdown", () => {
    const { element } = render([{ id: 'q', role: 'user', text: 'a **b**\nc' }]);
    const bubble = element.querySelector('[data-role="user"]')!;
    expect(bubble.querySelector('strong')).toBeNull();
    expect(bubble.textContent).toContain('a **b**\nc');
  });

  it("renders the assistant's text as neat-markdown, streaming while streaming", () => {
    const { element, set } = render([
      question,
      { id: 'a1', role: 'assistant', text: 'Three **jars**', state: 'streaming' },
    ]);
    const reply = element.querySelector('[data-role="assistant"] neat-markdown')!;
    expect(reply.querySelector('strong')?.textContent).toBe('jars');
    expect(reply.hasAttribute('data-streaming')).toBe(true);
    set([question, { id: 'a1', role: 'assistant', text: 'Three **jars**', state: 'done' }]);
    expect(reply.hasAttribute('data-streaming')).toBe(false);
  });

  it('shows the waiting placeholder with its label', () => {
    const { element } = render([
      question,
      { id: 'a1', role: 'assistant', text: '', state: 'waiting' },
    ]);
    const reply = element.querySelector('[data-role="assistant"]')!;
    expect(reply.querySelector('neat-markdown')).toBeNull();
    expect(reply.textContent).toContain('Waiting for the reply');
  });

  it('says Stopped after a stopped reply', () => {
    const { element } = render([{ id: 'a1', role: 'assistant', text: 'Half a', state: 'stopped' }]);
    const reply = element.querySelector('[data-role="assistant"]')!;
    expect(reply.textContent).toContain('Half a');
    expect(reply.querySelector('.stopped')?.textContent?.trim()).toBe('Stopped');
  });

  it("shows an error in a danger callout with the app's actions", () => {
    const { element } = render([
      {
        id: 'a1',
        role: 'assistant',
        text: '',
        state: 'error',
        error: 'The conversation is too long for the model.',
      },
    ]);
    const callout = element.querySelector('[data-role="assistant"] neat-callout')!;
    expect(callout.textContent).toContain('The conversation is too long for the model.');
    expect(callout.querySelector('button.new-chat')?.textContent).toBe('New chat after a1');
  });

  it('renders the footer template under a message, given the message', () => {
    const { element } = render([question]);
    const bubble = element.querySelector('[data-message="q1"]')!;
    expect(bubble.querySelector('.footer')?.textContent).toBe('footer of q1');
  });

  it('announces a finished reply once, not while streaming', () => {
    const { element, set } = render([question]);
    const live = element.querySelector('[aria-live="polite"]')!;
    let text = '';
    for (let i = 0; i < 10; i++) {
      text += `word${i} `;
      set([question, { id: 'a1', role: 'assistant', text, state: 'streaming' }]);
      expect(live.textContent?.trim()).toBe('');
    }
    set([question, { id: 'a1', role: 'assistant', text: `${text}**done**`, state: 'done' }]);
    expect(live.textContent?.trim()).toBe(`Reply finished: ${text}done`);
    set([
      question,
      { id: 'a1', role: 'assistant', text: `${text}**done**`, state: 'done' },
      { id: 'q2', role: 'user', text: 'More?' },
    ]);
    expect(live.textContent?.trim()).toBe(`Reply finished: ${text}done`);
  });

  it('does not announce a reply that was done from the start', () => {
    const { element } = render([{ id: 'a1', role: 'assistant', text: 'Old reply' }]);
    expect(element.querySelector('[aria-live="polite"]')!.textContent?.trim()).toBe('');
  });

  it('the log is not live, and a tab stop to scroll by keys', () => {
    const { element } = render([question]);
    const log = element.querySelector('[role="log"]')!;
    expect(log.getAttribute('aria-live')).toBe('off');
    expect(log.getAttribute('aria-label')).toBe('Conversation');
    expect(log.getAttribute('tabindex')).toBe('0');
  });

  it('announces a failed reply', () => {
    const { element, set } = render([
      question,
      { id: 'a1', role: 'assistant', text: '', state: 'waiting' },
    ]);
    set([
      question,
      { id: 'a1', role: 'assistant', text: '', state: 'error', error: 'The board went away.' },
    ]);
    expect(element.querySelector('[aria-live="polite"]')!.textContent?.trim()).toBe(
      'Reply failed: The board went away.',
    );
  });

  it('Latest leaves the focus on the conversation', async () => {
    const { element, fixture } = render([question]);
    await fixture.whenStable();
    const log = scrollable(element);
    log.scrollTop = 500;
    log.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    const latest = element.querySelector('button.latest') as HTMLButtonElement;
    latest.focus();
    latest.click();
    fixture.detectChanges();
    expect(element.querySelector('button.latest')).toBeNull();
    expect(document.activeElement).toBe(log);
  });

  it('follows again when the visitor sends a question', async () => {
    const { element, fixture, set } = render([question]);
    await fixture.whenStable();
    const log = scrollable(element);
    log.scrollTop = 500;
    log.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(element.querySelector('button.latest')).not.toBeNull();
    set([question, { id: 'q2', role: 'user', text: 'And now?' }]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('button.latest')).toBeNull();
    expect(log.scrollTop).toBe(600);
  });
});
