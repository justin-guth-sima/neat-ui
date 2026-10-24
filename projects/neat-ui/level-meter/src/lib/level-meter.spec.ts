import { afterEveryRender, ApplicationRef, Component, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { meterSegments, NeatLevelMeter, segmentTone } from './level-meter';

/** requestAnimationFrame under the test's control: a frame runs only when the test says so. */
class FakeAnimationFrames {
  readonly callbacks = new Map<number, FrameRequestCallback>();
  readonly cancelled: number[] = [];
  private nextId = 1;

  install(): void {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = this.nextId++;
      this.callbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      this.cancelled.push(id);
      this.callbacks.delete(id);
    });
  }

  /** Runs one frame: every pending callback once, as the browser does. */
  run(now = 0): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of pending) callback(now);
  }
}

@Component({
  imports: [NeatLevelMeter],
  template: `
    @if (shown()) {
      <neat-level-meter [sample]="sample()" />
    }
  `,
})
class MeterHost {
  readonly shown = signal(true);
  readonly sample = signal<(() => number | null) | null>(null);
}

/** The fill of each tone's lit segment, and of an unlit one: the theme's tokens. */
const FILLS = { low: 'bg-success', mid: 'bg-warning', high: 'bg-destructive' } as const;
const UNLIT = 'bg-muted';

describe('the meter scale (ported from #170)', () => {
  it('the level meter lights green, then amber, then red, from -50 dBFS to full scale', () => {
    for (const [dbfs, lit] of [
      [null, 0],
      [-80, 0],
      [-50, 0],
      [-25, 10],
      [0, 20],
      [6, 20],
    ] as const) {
      expect(meterSegments(dbfs, 20), String(dbfs)).toBe(lit);
    }
    expect([0, 13, 14, 17, 18, 19].map((index) => segmentTone(index, 20))).toEqual([
      'low',
      'low',
      'mid',
      'mid',
      'high',
      'high',
    ]);
  });
});

describe('NeatLevelMeter', () => {
  let frames: FakeAnimationFrames;

  beforeEach(() => {
    frames = new FakeAnimationFrames();
    frames.install();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  async function render(setup: (host: MeterHost) => void = () => undefined) {
    const fixture = TestBed.createComponent(MeterHost);
    setup(fixture.componentInstance);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const meter = element.querySelector<HTMLElement>('neat-level-meter')!;
    const segments = [...meter.querySelectorAll<HTMLElement>('[data-slot="level-meter-segment"]')];
    const lit = () => segments.filter((segment) => !segment.classList.contains(UNLIT)).length;
    return { fixture, host: fixture.componentInstance, meter, segments, lit };
  }

  it('draws 28 dark segments, hidden from assistive technology, until it is given a sample', async () => {
    const { meter, segments, lit } = await render();
    frames.run();

    expect(meter.getAttribute('aria-hidden')).toBe('true');
    expect(segments).toHaveLength(28);
    expect(lit()).toBe(0);
    for (const segment of segments) expect(segment.classList).toContain(UNLIT);
    // Nothing to sample, so no frame is asked for.
    expect(frames.callbacks.size).toBe(0);
  });

  it('samples once per animation frame while sample is set and lights round((level+50)/50 × 28) segments', async () => {
    let level: number | null = null;
    let calls = 0;
    const { segments, lit } = await render((host) =>
      host.sample.set(() => {
        calls++;
        return level;
      }),
    );

    // Sampling starts with the next frame, not at render.
    expect(calls).toBe(0);
    const cases: [number | null, number][] = [
      [-25, 14],
      [-50, 0],
      [0, 28],
      [-10, 22],
      [null, 0],
      [6, 28],
      [-80, 0],
      [-5, 25],
    ];
    for (const [frame, [next, segmentsLit]] of cases.entries()) {
      level = next;
      frames.run(frame * 16);
      expect(calls, `frame ${frame}`).toBe(frame + 1);
      expect(lit(), `level ${next}`).toBe(segmentsLit);
    }

    // The lit ones are the first 25, in their tones: green to 70 %, amber to 90 %, red above.
    segments.forEach((segment, index) => {
      const tone = index < 20 ? 'low' : index < 25 ? 'mid' : 'high';
      if (index < 25) {
        expect(segment.classList, `segment ${index}`).toContain(FILLS[tone]);
        expect(segment.classList, `segment ${index}`).not.toContain(UNLIT);
      } else {
        expect(segment.classList, `segment ${index}`).toContain(UNLIT);
        expect(segment.classList, `segment ${index}`).not.toContain(FILLS[tone]);
      }
    });
    level = 0;
    frames.run();
    expect(segments.slice(25).every((segment) => segment.classList.contains(FILLS.high))).toBe(
      true,
    );
  });

  it('calls the function it is given unbound, so an arrow-function property works as sample', async () => {
    class MicTest {
      private level = -25;
      readonly read = () => this.level;
    }
    const micTest = new MicTest();
    const { lit } = await render((host) => host.sample.set(micTest.read));

    frames.run();
    expect(lit()).toBe(14);
  });

  it('stops sampling when sample becomes null or the meter is destroyed, and goes dark', async () => {
    let calls = 0;
    const { fixture, host, segments, lit } = await render((h) =>
      h.sample.set(() => {
        calls++;
        return 0;
      }),
    );
    frames.run();
    expect(lit()).toBe(28);

    host.sample.set(null);
    await fixture.whenStable();
    expect(lit()).toBe(0);
    expect(frames.callbacks.size).toBe(0);
    frames.run();
    expect(calls).toBe(1);

    // A new sample starts it again; removing the meter stops it for good.
    host.sample.set(() => {
      calls++;
      return 0;
    });
    await fixture.whenStable();
    frames.run();
    expect(calls).toBe(2);
    expect(lit()).toBe(28);

    host.shown.set(false);
    await fixture.whenStable();
    expect(frames.callbacks.size).toBe(0);
    expect(frames.cancelled.length).toBeGreaterThanOrEqual(2);
    frames.run();
    expect(calls).toBe(2);
    expect(segments.filter((segment) => segment.classList.contains(UNLIT))).toHaveLength(28);
  });

  it('keeps sampling after a sample throws', async () => {
    let calls = 0;
    const { lit } = await render((host) =>
      host.sample.set(() => {
        calls++;
        if (calls === 1) throw new Error('analyser gone');
        return 0;
      }),
    );

    expect(() => frames.run()).toThrow('analyser gone');
    frames.run();
    expect(calls).toBe(2);
    expect(lit()).toBe(28);
  });

  it('never triggers change detection while sampling', async () => {
    let level = -50;
    const { fixture, lit } = await render((host) => host.sample.set(() => level));
    const tick = vi.spyOn(TestBed.inject(ApplicationRef), 'tick');
    // `tick` is the manual entry; the zoneless scheduler runs change detection without calling
    // it, but every pass ends with the render hooks, so counting those catches both.
    let renders = 0;
    afterEveryRender(() => renders++, { injector: fixture.componentRef.injector.get(Injector) });
    // Registering a hook schedules a pass of its own; let it run before counting.
    await fixture.whenStable();
    renders = 0;

    for (const next of [-25, 0, -40, -5]) {
      level = next;
      frames.run();
    }
    // A change detection scheduled by a frame would run on a later timer or frame: let both pass.
    await new Promise((resolve) => setTimeout(resolve));
    frames.run();
    await fixture.whenStable();

    // The positive control: sampling ran and lit segments (-5 dBFS lights 25 of 28).
    expect(lit()).toBe(25);
    expect(tick).not.toHaveBeenCalled();
    expect(renders).toBe(0);
  });
});
