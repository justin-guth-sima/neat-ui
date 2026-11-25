import { TestBed } from '@angular/core/testing';
import { Reply } from './1-reply.example';
import { Streaming } from './2-streaming.example';

describe('the Markdown examples', () => {
  afterEach(() => vi.useRealTimers());

  it('the reply shows its heading, list, table and code', () => {
    const fixture = TestBed.createComponent(Reply);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h4')?.textContent).toBe('Pasta al pomodoro');
    expect(host.querySelectorAll('li')).toHaveLength(3);
    expect(host.querySelector('table')).not.toBeNull();
    expect(host.querySelector('neat-code-block')).not.toBeNull();
  });

  it('the streaming example reaches the whole reply', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Streaming);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    await vi.advanceTimersByTimeAsync(400);
    fixture.detectChanges();
    expect(host.querySelector('neat-markdown')?.hasAttribute('data-streaming')).toBe(true);
    await vi.advanceTimersByTimeAsync(4000);
    fixture.detectChanges();
    expect(host.querySelector('neat-markdown')?.hasAttribute('data-streaming')).toBe(false);
    expect(host.querySelector('neat-code-block')?.textContent).toContain('minutes = 15');
    expect(host.querySelector('strong')?.textContent).toBe('dried pasta');
  });
});
