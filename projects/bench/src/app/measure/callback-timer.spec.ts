import { CallbackTimer, type FrameHost } from './callback-timer';

/** A window whose frames run only when the spec says so. */
function fakeHost(): FrameHost & { run(time: number): void } {
  const pending: FrameRequestCallback[] = [];
  return {
    requestAnimationFrame(callback) {
      pending.push(callback);
      return pending.length;
    },
    run(time) {
      for (const callback of pending.splice(0)) callback(time);
    },
  };
}

describe('CallbackTimer', () => {
  it('adds up the callbacks of each frame asked for while installed, and none after', () => {
    const host = fakeHost();
    let clock = 0;
    const timer = new CallbackTimer(host, 8, () => clock);
    timer.install();
    host.requestAnimationFrame(() => (clock += 3));
    host.requestAnimationFrame(() => (clock += 5));
    host.run(16);
    host.requestAnimationFrame(() => (clock += 4));
    host.run(32);
    timer.uninstall();
    host.requestAnimationFrame(() => (clock += 7));
    host.run(48);
    expect([...timer.results()]).toEqual([8, 4]);
  });

  it('passes the frame time on, and times a callback that throws', () => {
    const host = fakeHost();
    let clock = 0;
    const timer = new CallbackTimer(host, 8, () => clock);
    timer.install();
    let seen = 0;
    host.requestAnimationFrame((time) => (seen = time));
    host.requestAnimationFrame(() => {
      clock += 2;
      throw new Error('boom');
    });
    expect(() => host.run(48)).toThrow('boom');
    expect(seen).toBe(48);
    expect([...timer.results()]).toEqual([2]);
  });

  it('keeps no more than its capacity, and starts afresh on reset', () => {
    const host = fakeHost();
    const timer = new CallbackTimer(host, 2, () => 0);
    timer.install();
    for (let i = 0; i < 3; i++) {
      host.requestAnimationFrame(() => undefined);
      host.run(16 * (i + 1));
    }
    expect(timer.timed).toBe(2);
    timer.reset();
    expect(timer.results()).toHaveLength(0);
  });
});
