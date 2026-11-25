import { TestBed } from '@angular/core/testing';
import { Conversation } from './1-conversation.example';
import { States } from './2-states.example';

describe('the transcript examples', () => {
  afterEach(() => vi.useRealTimers());

  it('the transcript example renders the conversation and finishes the reply', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Conversation);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('img[alt="A kitchen shelf"]')).not.toBeNull();
    expect(host.textContent).toContain('Waiting for the reply');
    await vi.advanceTimersByTimeAsync(4000);
    fixture.detectChanges();
    expect(host.querySelector('[data-role="assistant"]')?.textContent).toContain('pomodoro');
    expect(host.textContent).toContain('first word 0.22 s');
  });

  it('the states example shows a stopped, a failed and a waiting reply, and New chat empties it', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(States);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.stopped')).not.toBeNull();
    expect(host.querySelector('neat-callout')?.textContent).toContain('too long');
    const button = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('New chat'),
    )!;
    button.click();
    fixture.detectChanges();
    expect(host.querySelectorAll('[data-message]')).toHaveLength(0);
  });
});
