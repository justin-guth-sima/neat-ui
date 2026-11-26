import { TestBed } from '@angular/core/testing';
import { Reply } from './1-reply.example';
import { Streaming } from './2-streaming.example';
import { TextMotion } from './3-text-motion.example';
import { ReadAloud } from './4-read-aloud.example';

describe('the Markdown examples', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

  it('the text motion example renders its pieces in the chosen motion', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(TextMotion);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const markdown = () => host.querySelector('neat-markdown') as HTMLElement;
    await vi.advanceTimersByTimeAsync(500);
    fixture.detectChanges();
    expect(markdown().getAttribute('data-motion')).toBe('focus');
    expect(markdown().querySelector('span.piece')).not.toBeNull();
    expect(host.querySelector('neat-select')).not.toBeNull();
    expect(host.querySelector('neat-slider')).not.toBeNull();
    fixture.componentInstance['motion'].set('focus');
    await vi.advanceTimersByTimeAsync(200);
    fixture.detectChanges();
    expect(markdown().getAttribute('data-motion')).toBe('focus');
    expect(markdown().querySelector('span.piece')).not.toBeNull();
  });

  it("the read aloud example lists the streaming reply's sentences and marks the complete ones", async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(ReadAloud);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const rows = () => [...host.querySelectorAll('.sentences li')];
    await vi.advanceTimersByTimeAsync(600);
    fixture.detectChanges();
    expect(rows().length).toBeGreaterThan(0);
    expect(rows().at(-1)!.hasAttribute('data-complete')).toBe(false);
    await vi.advanceTimersByTimeAsync(2400);
    fixture.detectChanges();
    expect(rows().map((row) => row.querySelector('.words')!.textContent)).toEqual([
      'Three jars of dried pasta, a bottle of olive oil and canned tomatoes.',
      'Together that is most of a pasta al pomodoro:',
      'Sauté the garlic in the oil.',
      'Add the tomatoes and let them simmer.',
    ]);
    expect(rows().every((row) => row.hasAttribute('data-complete'))).toBe(true);
  });

  it('the read aloud example speaks its sentences one after another in the chosen motion', async () => {
    // jsdom has no ResizeObserver, which the select's list measures by.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(ReadAloud);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const speaking = () =>
      host.querySelector('.sentences li[data-speaking] .words')?.textContent ?? null;
    expect(host.querySelector('neat-markdown')!.getAttribute('data-speaking-motion')).toBe(
      'karaoke',
    );
    await vi.advanceTimersByTimeAsync(1200);
    fixture.detectChanges();
    expect(speaking()).toBe(
      'Three jars of dried pasta, a bottle of olive oil and canned tomatoes.',
    );
    // 69 characters at 55 ms each.
    await vi.advanceTimersByTimeAsync(69 * 55);
    fixture.detectChanges();
    expect(speaking()).toBe('Together that is most of a pasta al pomodoro:');
  });
});
