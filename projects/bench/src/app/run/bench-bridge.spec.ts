import type { GestureTarget } from './gesture-player';
import {
  type BenchEvent,
  bridgeGestures,
  type InputEvent,
  maxSteps,
  plannedStepMs,
  windowEventSink,
  windowInputSink,
} from './bench-bridge';
import type { LadderPlan } from './step-machine';

const PLAN: LadderPlan = {
  levels: [1, 2, 4],
  phases: [
    { name: 'idle', ms: 3000 },
    { name: 'pan', ms: 3000 },
  ],
  warmupMs: 3000,
  refine: false,
  stopFps: 15,
};

describe('plannedStepMs and maxSteps', () => {
  it('plans a step as its warm-up and phases, which the harness bounds its waits by', () => {
    expect(plannedStepMs(PLAN)).toBe(9000);
  });

  it('counts the levels and, when the knee is refined, the two bisections', () => {
    expect(maxSteps(PLAN)).toBe(3);
    expect(maxSteps({ ...PLAN, refine: true })).toBe(5);
  });
});

describe('the window sinks', () => {
  afterEach(() => {
    delete window.benchEvent;
    delete window.benchInput;
  });

  const END: BenchEvent = { type: 'run-end' };

  it('hands an event to the binding the harness exposed', () => {
    const seen: BenchEvent[] = [];
    window.benchEvent = (event) => seen.push(event);
    windowEventSink(window)(END);
    expect(seen).toEqual([END]);
  });

  it('does nothing where no harness exposed one: a board without a harness runs the same code', () => {
    expect(() => windowEventSink(window)(END)).not.toThrow();
    expect(() => windowInputSink(window)({ kind: 'press', x: 1, y: 2 })).not.toThrow();
  });

  it('never lets a binding that throws or rejects stop the run', async () => {
    window.benchEvent = () => {
      throw new Error('detached');
    };
    expect(() => windowEventSink(window)(END)).not.toThrow();
    window.benchEvent = () => Promise.reject(new Error('closed'));
    expect(() => windowEventSink(window)(END)).not.toThrow();
    // The rejection is handled: nothing is left to surface as an unhandled one.
    await Promise.resolve();
  });

  it('hands an input to the harness’s input binding', () => {
    const seen: InputEvent[] = [];
    window.benchInput = (event) => seen.push(event);
    windowInputSink(window)({ kind: 'wheel', x: 1, y: 2, deltaY: -30 });
    expect(seen).toEqual([{ kind: 'wheel', x: 1, y: 2, deltaY: -30 }]);
  });
});

describe('bridgeGestures', () => {
  const inner = (): GestureTarget & { calls: string[] } => {
    const calls: string[] = [];
    return {
      calls,
      rect: () => ({ left: 10, top: 20, width: 300, height: 200 }),
      transform: () => ({ k: 2, x: 3, y: 4 }),
      press: () => calls.push('press'),
      drag: () => calls.push('drag'),
      release: () => calls.push('release'),
      wheel: () => calls.push('wheel'),
    };
  };

  it('reads the view from the host and sends the pointer to the harness instead', () => {
    const host = inner();
    const sent: InputEvent[] = [];
    const target = bridgeGestures(host, (event) => sent.push(event));

    expect(target.rect()).toEqual(host.rect());
    expect(target.transform()).toEqual({ k: 2, x: 3, y: 4 });
    target.press(1, 2);
    target.drag(3, 4);
    target.release(5, 6);
    target.wheel(7, 8, -50, host.rect());

    expect(sent).toEqual([
      { kind: 'press', x: 1, y: 2 },
      { kind: 'drag', x: 3, y: 4 },
      { kind: 'release', x: 5, y: 6 },
      { kind: 'wheel', x: 7, y: 8, deltaY: -50 },
    ]);
    // No synthetic event reached the renderer: the browser's own input does that.
    expect(host.calls).toEqual([]);
  });
});
