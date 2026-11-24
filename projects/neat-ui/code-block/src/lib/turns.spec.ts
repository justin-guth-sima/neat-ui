import { nextTurn } from './turns';

/** Lets the promise callbacks queued so far run, and those they queue. */
async function microtasks() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** One task of the browser's: the timers due now (none they set), then the microtasks after. */
async function task() {
  vi.runOnlyPendingTimers();
  await microtasks();
}

describe('nextTurn', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('gives each caller a task of its own, in the order they asked', async () => {
    const taken: number[] = [];
    [0, 1, 2].forEach((i) => nextTurn().then(() => taken.push(i)));

    await microtasks();
    expect(taken).toEqual([]);
    await task();
    expect(taken).toEqual([0]);
    await task();
    expect(taken).toEqual([0, 1]);
    await task();
    expect(taken).toEqual([0, 1, 2]);
  });

  it('lets a turn finish its own work before the next turn starts', async () => {
    const steps: string[] = [];
    void nextTurn().then(() => {
      steps.push('first');
      return Promise.resolve().then(() => steps.push('first, then'));
    });
    void nextTurn().then(() => steps.push('second'));

    await microtasks();
    await task();
    expect(steps).toEqual(['first', 'first, then']);
    await task();
    expect(steps).toEqual(['first', 'first, then', 'second']);
  });
});
