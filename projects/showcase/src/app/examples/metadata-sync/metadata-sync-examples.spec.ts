import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LateNotice } from './1-late-notice.example';

describe('the metadata sync examples', () => {
  let fixture: ComponentFixture<LateNotice>;

  const host = (): HTMLElement => fixture.nativeElement;
  const text = (): string => (host().textContent ?? '').replace(/\s+/g, ' ');
  const notice = (): Element | null => host().querySelector('neat-callout');
  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from(host().querySelectorAll('button')).find((b) => b.textContent?.trim() === name);
  /** Runs the fake clock on and renders: `whenStable` would wait on a clock that is stopped. */
  const settle = async (ms = 0): Promise<void> => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  const press = async (slider: string, key: string, times = 1): Promise<void> => {
    const thumb = host().querySelector(`[role="slider"][aria-label="${slider}"]`) as HTMLElement;
    for (let i = 0; i < times; i++) {
      thumb.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }
    await settle();
  };

  beforeEach(async () => {
    // The notice holds the warning off with a timer, which a test moves on by hand.
    vi.useFakeTimers();
    fixture = TestBed.createComponent(LateNotice);
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('warns of the late metadata and offers the suggested buffer and the shared one', () => {
    expect(notice()?.querySelector('[role="heading"], h3')?.textContent).toContain(
      'Metadata is late',
    );
    expect(text()).toContain('arrives 180 ms late for 60% of its messages, with a 0 ms buffer');
    expect(text()).toContain('A buffer of 500 ms would cover nine in ten of them');
    expect(button('Use 500 ms')).toBeDefined();
    expect(button('Follow the shared 1000 ms')).toBeDefined();
  });

  it('goes off below a tenth of the messages late and stays off until half are', async () => {
    await press('Late messages', 'Home');
    expect(text()).toContain('No warning.');

    // 30% is between the two thresholds, so the warning stays as it was.
    await press('Late messages', 'ArrowRight', 6);
    expect(text()).toContain('30%');
    expect(notice()).toBeNull();

    await press('Late messages', 'End');
    expect(notice()).not.toBeNull();
  });

  it('holds the warning off after a buffer change, for as long as the browser needs', async () => {
    button('Use 500 ms')!.click();
    await settle();

    // A second, plus ten times the 500 ms the buffer was raised by.
    expect(notice()).toBeNull();
    expect(text()).toContain('Warning held off for 6000 ms');
    await settle(5999);
    expect(notice()).toBeNull();
    await settle(1);
    expect(text()).toContain('with a 500 ms buffer');
    expect(text()).toContain('A buffer of 1000 ms');
  });

  it('raises the shared buffer when the suggestion passes it, and adopts it', async () => {
    await press('90th percentile lateness', 'Home');
    await press('90th percentile lateness', 'ArrowRight', 30);

    expect(text()).toContain('A buffer of 1550 ms');
    button('Raise the shared buffer to 1550 ms')!.click();
    await settle();

    expect(text()).toContain('Shared buffer: 1550 ms');
    expect(text()).toContain('Video sync buffer 1550 ms');
  });

  it('say why none is suggested: the largest buffer passed, or no browser support', async () => {
    await press('90th percentile lateness', 'End');
    expect(text()).toContain('A buffer that covers it would pass the largest one.');
    expect(button('Use 500 ms')).toBeUndefined();

    await press('90th percentile lateness', 'Home');
    (host().querySelector('button[role="switch"]') as HTMLElement).click();
    await settle();
    expect(text()).toContain('This browser cannot set a buffer.');
    expect(host().querySelector('neat-callout button')).toBeNull();
  });
});
