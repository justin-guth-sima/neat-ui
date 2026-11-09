import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NeatBev } from '@sima/neat-ui/bev';
import { By } from '@angular/platform-browser';
import {
  BEV_MEASURE_MS,
  BEV_WARMUP_MS,
  BevHost,
  NO_FRAMES,
  describe as describeResult,
  loadSize,
} from './bev-host';

describe('BevHost', () => {
  it('feeds the view the load at 20 Hz', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })),
    );
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(BevHost);
    fixture.detectChanges();
    TestBed.tick();
    const view = fixture.debugElement.query(By.directive(NeatBev)).componentInstance as NeatBev;
    const first = view.frame();
    expect(first?.objects).toHaveLength(100);
    vi.advanceTimersByTime(50);
    fixture.detectChanges();
    expect(view.frame()).not.toBe(first);
    fixture.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("takes the load's size from the query, the budget's where it says none or nonsense", () => {
    const query = (values: Record<string, string>) => ({
      get: (name: string) => values[name] ?? null,
    });
    expect(loadSize(query({}))).toEqual({ objects: 100, points: 30_000 });
    expect(loadSize(query({ points: '0', objects: '400' }))).toEqual({ objects: 400, points: 0 });
    expect(loadSize(query({ points: '-1', objects: 'many' }))).toEqual({
      objects: 100,
      points: 30_000,
    });
  });

  it('says so when too few frames come to measure by', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })),
    );
    // Frames that never come, as in a browser without a display.
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(BevHost);
    fixture.detectChanges();
    TestBed.tick();
    vi.advanceTimersByTime(BEV_WARMUP_MS + BEV_MEASURE_MS);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.bev-result')?.textContent).toBe(
      NO_FRAMES,
    );
    expect(window.benchBev).toBeUndefined();
    fixture.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('warms up for two seconds and measures for ten', () => {
    expect([BEV_WARMUP_MS, BEV_MEASURE_MS]).toEqual([2000, 10_000]);
  });

  it('says its result in a line', () => {
    const line = describeResult({
      hz: 60,
      frames: {
        frames: 598,
        fps: 59.8,
        p50: 16.7,
        p95: 17.2,
        p99: 18,
        worst: 25,
        dropped: 2,
        droppedPct: 0.3,
        janks: 0,
        stalls: 0,
      },
      script: { p50: 1.24, p95: 2.51, worst: 6 },
    });
    expect(line).toBe(
      '59.8 fps at 60 Hz, frame p95 17.2 ms, 2 dropped, script p50 1.2 / p95 2.5 / worst 6.0 ms',
    );
  });
});
