import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NeatDiagramMessages, NeatDiagramView } from '@sima/neat-ui/diagram';
import { App } from '../../app';
import { appConfig } from '../../app.config';
import { LivePipeline } from './1-live-pipeline.example';

/** jsdom has no ResizeObserver; these specs check what the example draws and does, not sizes. */
class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('the live pipeline example', () => {
  let fixture: ComponentFixture<LivePipeline>;

  const root = (): HTMLElement => fixture.nativeElement;
  const pipeline = (): HTMLElement => root().querySelector('neat-diagram') as HTMLElement;
  const button = (name: string): HTMLButtonElement =>
    Array.from(root().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === name || b.getAttribute('aria-label') === name,
    ) as HTMLButtonElement;
  /** Runs the fake clock on and renders, which `whenStable` cannot do on a stopped clock. */
  const settle = async (ms = 0): Promise<void> => {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  };
  const open = async (): Promise<void> => {
    (pipeline().querySelector('button[aria-label="Open Detector"]') as HTMLElement).click();
    await settle();
  };

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    // The feed is a timer of the browser's clock: fake, so a test says how long it has run.
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: appConfig.providers });
    fixture = TestBed.createComponent(LivePipeline);
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('moves the messages, the notes reading an edge’s rate', () => {
    expect(pipeline().querySelector('neat-diagram-messages canvas')).not.toBeNull();
    for (const [note, label] of [
      ['tracker-rate', 'Into Tracker'],
      ['camera-rate', 'Camera → Decode'],
    ]) {
      const card = pipeline().querySelector(`[data-note="${note}"] neat-diagram-rate-card`);
      expect(card?.querySelector('.label')?.textContent, note).toBe(label);
      expect(card?.querySelector('.numbers')?.textContent, note).toMatch(
        /\d+ msg\/s\s*[\d.]+ MB\/s/,
      );
      expect(card?.querySelector('neat-sparkline'), note).not.toBeNull();
    }
  });

  it('gives the pipeline’s Decode a figure from the example’s block template', () => {
    expect(pipeline().querySelector('[data-node="decode"] .body')?.textContent?.trim()).toBe(
      '30.0 fps · 1080p',
    );
  });

  it('feeds the edges a batch of messages every 99 ms', async () => {
    const push = vi.spyOn(NeatDiagramMessages.prototype, 'push');

    await vi.advanceTimersByTimeAsync(99);
    // Three frames on each of three edges, and a result on each of four.
    expect(push).toHaveBeenCalledTimes(13);
    await vi.advanceTimersByTimeAsync(99);
    expect(push).toHaveBeenCalledTimes(26);
  });

  it('shows a step’s rate card with its stage time in the Detector’s level', async () => {
    await open();
    expect(pipeline().querySelector('[data-note="yolox-rate"] .stage')).toBeNull();

    // The feed’s first batch sets the stage time shown.
    await settle(99);
    const card = pipeline().querySelector('[data-note="yolox-rate"] neat-diagram-rate-card');
    expect(card?.querySelector('.label')?.textContent).toBe('YOLOX → NMS');
    expect(card?.querySelector('.stage')?.textContent).toMatch(/Stage\s+1[4-6]\.\d\s+ms/);
    expect(card?.querySelector('.numbers')?.textContent).toMatch(/\d+ msg\/s/);
    expect(card?.querySelector('neat-sparkline')).toBeNull();
  });

  it('tunes the dots from the Animation panel', async () => {
    const trigger = button('Animation');
    expect(trigger).toBeTruthy();

    trigger.click();
    await settle();

    expect(document.querySelector('[role="dialog"][aria-label="Animation"]')).not.toBeNull();
  });

  it('pushes four hundred messages in one tick from Burst', () => {
    const push = vi.spyOn(NeatDiagramMessages.prototype, 'push');

    button('Burst').click();

    expect(push).toHaveBeenCalledTimes(400);
  });

  it('fits the drawing again from fit()', () => {
    const fit = vi.spyOn(NeatDiagramView.prototype, 'fit');

    fixture.componentInstance.fit();

    expect(fit).toHaveBeenCalledTimes(1);
  });
});

describe('the messaging topic', () => {
  it('fits its example again from the top bar’s Fit', async () => {
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    TestBed.configureTestingModule({ providers: appConfig.providers });
    const app = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/components/diagram/messaging');
    await app.whenStable();
    const fit = vi.spyOn(NeatDiagramView.prototype, 'fit');
    const button = Array.from(
      (app.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('header button'),
    ).find((b) => b.textContent?.trim() === 'Fit') as HTMLButtonElement;

    button.click();

    expect(fit).toHaveBeenCalledTimes(1);
    app.destroy();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
