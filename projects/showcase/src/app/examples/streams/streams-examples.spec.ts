import { TestBed } from '@angular/core/testing';
import { StreamPost } from './1-stream-post.example';

describe('the streams examples', () => {
  afterEach(() => vi.useRealTimers());

  it("the stream-post example's Stop aborts", async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(StreamPost);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('button') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(400);
    fixture.detectChanges();
    const partial = host.querySelector('neat-markdown')?.textContent ?? '';
    expect(partial.length).toBeGreaterThan(0);
    (host.querySelector('button') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(2000);
    fixture.detectChanges();
    expect(host.querySelector('button')?.textContent?.trim()).toBe('Ask');
    expect(host.querySelector('neat-markdown')?.textContent?.length).toBeLessThan(40);
  });

  it('the stream-post example reads the whole reply', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(StreamPost);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    (host.querySelector('button') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(3000);
    fixture.detectChanges();
    expect(host.querySelector('neat-markdown strong')?.textContent).toBe('shelf');
    expect(host.querySelector('neat-markdown')?.textContent).toContain('garlic.');
  });
});
