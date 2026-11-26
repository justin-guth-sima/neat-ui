import { describe, expect, it, vi } from 'vitest';
import { cometKeys, STEADY_PX_PER_S, SteadyComet } from './steady-comet';

/** A frame whose glow layers the spec animates by hand: its `animate` calls, and their state. */
function fakeFrame(width: number, height: number) {
  const animations: {
    keyframes: Keyframe[];
    options: KeyframeAnimationOptions;
    playState: string;
    currentTime: number;
    canceled: boolean;
    play(): void;
    pause(): void;
    cancel(): void;
    effect: { setKeyframes(keyframes: Keyframe[]): void; updateTiming(t: EffectTiming): void };
  }[] = [];
  const frame = {
    getBoundingClientRect: () => ({ width, height }) as DOMRect,
    animate(keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      const animation = {
        keyframes,
        options,
        playState: 'running',
        currentTime: 0,
        canceled: false,
        play() {
          this.playState = 'running';
        },
        pause() {
          this.playState = 'paused';
        },
        cancel() {
          this.canceled = true;
        },
        effect: {
          setKeyframes: (next: Keyframe[]) => (animation.keyframes = next),
          updateTiming: (timing: EffectTiming) =>
            (animation.options = { ...animation.options, ...timing } as KeyframeAnimationOptions),
        },
      };
      animations.push(animation);
      return animation as unknown as Animation;
    },
  };
  return { frame: frame as unknown as HTMLElement, animations, resize: (w: number, h: number) => ((width = w), (height = h)) };
}

describe('cometKeys', () => {
  it('keys the angle to points evenly spaced along the edge, from the top middle round to it', () => {
    // A 400 × 100 box: 1000 px round. The top right corner is 200 px on, the bottom right 300.
    const { keys, lapMs } = cometKeys(400, 100);
    expect(lapMs).toBeCloseTo((1000 / STEADY_PX_PER_S) * 1000, 6);
    expect(keys[0]).toEqual({ offset: 0, angle: 0 });
    expect(keys.at(-1)).toEqual({ offset: 1, angle: 360 });
    const at = (offset: number) => keys.find((key) => Math.abs(key.offset - offset) < 1e-9)!.angle;
    const corner = (Math.atan2(200, 50) * 180) / Math.PI;
    expect(at(0.2)).toBeCloseTo(corner, 6);
    expect(at(0.3)).toBeCloseTo(180 - corner, 6);
    expect(at(0.7)).toBeCloseTo(180 + corner, 6);
    expect(at(0.8)).toBeCloseTo(360 - corner, 6);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i].offset).toBeGreaterThan(keys[i - 1].offset);
      expect(keys[i].angle).toBeGreaterThan(keys[i - 1].angle);
    }
  });
});

describe('SteadyComet', () => {
  it('turns both glow layers at one speed along the edge while it runs, and pauses', () => {
    const t = fakeFrame(400, 100);
    const comet = new SteadyComet(t.frame);
    comet.running(true);
    expect(t.animations.map((a) => a.options.pseudoElement)).toEqual(['::before', '::after']);
    for (const animation of t.animations) {
      expect(animation.options.iterations).toBe(Infinity);
      expect(animation.options.duration).toBeCloseTo(cometKeys(400, 100).lapMs, 6);
      expect(animation.options.easing).toBe('linear');
      expect(animation.keyframes[0]).toEqual({ offset: 0, '--neat-glow-angle': '0deg' });
      expect(animation.playState).toBe('running');
    }
    comet.running(false);
    expect(t.animations.map((a) => a.playState)).toEqual(['paused', 'paused']);
    comet.running(true);
    expect(t.animations).toHaveLength(2);
    expect(t.animations.map((a) => a.playState)).toEqual(['running', 'running']);
  });

  it('keys itself again for a new size, keeping its place along the edge', () => {
    const t = fakeFrame(400, 100);
    const comet = new SteadyComet(t.frame);
    comet.running(true);
    const lap = cometKeys(400, 100).lapMs;
    for (const animation of t.animations) animation.currentTime = lap / 4;
    t.resize(600, 100);
    comet.resized();
    const next = cometKeys(600, 100).lapMs;
    for (const animation of t.animations) {
      expect(animation.options.duration).toBeCloseTo(next, 6);
      expect(animation.currentTime).toBeCloseTo(next / 4, 6);
    }
  });

  it('cancels its animations when destroyed, and does nothing without the Web Animations API', () => {
    const t = fakeFrame(400, 100);
    const comet = new SteadyComet(t.frame);
    comet.running(true);
    comet.destroy();
    expect(t.animations.every((a) => a.canceled)).toBe(true);
    const bare = { getBoundingClientRect: () => ({ width: 400, height: 100 }) } as unknown as HTMLElement;
    const none = new SteadyComet(bare);
    expect(() => {
      none.running(true);
      none.resized();
      none.destroy();
    }).not.toThrow();
    vi.restoreAllMocks();
  });
});
