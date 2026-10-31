import { EdgeRates, HISTORY_SECONDS, RATE_WINDOW_MS } from './rates';

describe('EdgeRates', () => {
  it('counts messages and bytes of the last second', () => {
    expect(RATE_WINDOW_MS).toBe(1000);
    const rates = new EdgeRates();
    rates.count('a', 1000, 0);
    rates.count('a', 3000, 500);
    rates.count('b', 7, 600);
    expect(rates.snapshot('a', 900)).toEqual({ msgsPerSec: 2, bytesPerSec: 4000 });
    expect(rates.snapshot('b', 900)).toEqual({ msgsPerSec: 1, bytesPerSec: 7 });
    // The first leaves the window at 1000 ms.
    expect(rates.snapshot('a', 1000)).toEqual({ msgsPerSec: 1, bytesPerSec: 3000 });
  });

  it('does not count a message that is still to come', () => {
    const rates = new EdgeRates();
    rates.count('a', 10, 2000);
    expect(rates.snapshot('a', 1000)).toEqual({ msgsPerSec: 0, bytesPerSec: 0 });
    expect(rates.snapshot('a', 2000)).toEqual({ msgsPerSec: 1, bytesPerSec: 10 });
  });

  it('forgets the oldest once an edge holds its capacity', () => {
    const rates = new EdgeRates(2);
    rates.count('a', 1, 0);
    rates.count('a', 1, 1);
    rates.count('a', 1, 2);
    expect(rates.snapshot('a', 10).msgsPerSec).toBe(2);
  });

  it('counts an edge no diagram draws, and gives an edge never counted zeros', () => {
    const rates = new EdgeRates();
    rates.count('on-another-level', 64, 100);
    expect(rates.snapshot('on-another-level', 500)).toEqual({ msgsPerSec: 1, bytesPerSec: 64 });
    expect(rates.snapshot('never', 500)).toEqual({ msgsPerSec: 0, bytesPerSec: 0 });
    expect(rates.history('never', 5000)).toEqual([]);
  });

  it('starts an edge with a small ring and doubles it on demand, up to its capacity', () => {
    const rates = new EdgeRates(100);
    expect(rates.ringLength('a')).toBe(0);
    rates.count('a', 1, 0);
    expect(rates.ringLength('a')).toBe(32);
    for (let i = 1; i < 33; i++) rates.count('a', 1, i);
    expect(rates.ringLength('a')).toBe(64);
    // Every message is still there after the ring grew.
    expect(rates.snapshot('a', 100).msgsPerSec).toBe(33);
    for (let i = 33; i < 300; i++) rates.count('a', 2, i);
    expect(rates.ringLength('a')).toBe(100);
    // Full at its capacity: the latest 100, all of 2 bytes.
    expect(rates.snapshot('a', 300)).toEqual({ msgsPerSec: 100, bytesPerSec: 200 });
  });

  it('keeps a ring small for a steady 30 Hz edge, however long it runs', () => {
    const rates = new EdgeRates();
    // Three simulated minutes, each message counted as it starts: only the last second can be in
    // a rate, so a ring that holds a little over a second's messages is all it needs.
    for (let i = 0; i < 30 * 180; i++) rates.count('a', 1, (i * 1000) / 30);
    expect(rates.ringLength('a')).toBeLessThan(256);
    expect(rates.snapshot('a', (5399 * 1000) / 30).msgsPerSec).toBe(30);
  });

  it('grows for a burst, so every message of the window is counted', () => {
    const rates = new EdgeRates();
    for (let i = 0; i < 1500; i++) rates.count('a', 2, 5000 + (i % 10));
    expect(rates.snapshot('a', 5100)).toEqual({ msgsPerSec: 1500, bytesPerSec: 3000 });
  });

  it('grows for messages counted ahead of their start, judged by the time it is now', () => {
    const rates = new EdgeRates();
    // A step dot is counted when it is placed, starting seconds ahead: none has left the window
    // by the time `nowMs` says, so every one stays counted.
    for (let i = 0; i < 200; i++) rates.count('a', 1, 10_000 + i * 10, 0);
    expect(rates.ringLength('a')).toBeGreaterThanOrEqual(200);
    expect(rates.snapshot('a', 11_000).msgsPerSec).toBe(100);
  });

  it('keeps its messages in order when a ring that wrapped without growing grows later', () => {
    const rates = new EdgeRates();
    // Old messages first: the ring wraps over them, in place.
    for (let i = 0; i < 40; i++) rates.count('a', 1, i * 100);
    expect(rates.ringLength('a')).toBe(32);
    // Then a burst in one window: the ring grows, and loses none of it.
    for (let i = 0; i < 100; i++) rates.count('a', 1, 10_000 + i);
    expect(rates.snapshot('a', 10_100).msgsPerSec).toBe(100);
  });

  it('does not count a message without a finite time', () => {
    const rates = new EdgeRates();
    rates.count('a', 5, NaN);
    rates.count('a', 5, Infinity);
    expect(rates.ringLength('a')).toBe(0);
    expect(rates.history('a', 5000)).toEqual([]);
  });

  it('writes a snapshot into the object it is given', () => {
    const rates = new EdgeRates();
    rates.count('a', 5, 0);
    const into = { msgsPerSec: 9, bytesPerSec: 9 };
    expect(rates.snapshot('a', 10, into)).toBe(into);
    expect(into).toEqual({ msgsPerSec: 1, bytesPerSec: 5 });
  });

  it('keeps a history of messages per whole second from the first one counted', () => {
    const rates = new EdgeRates();
    rates.count('a', 1, 10_100);
    rates.count('a', 1, 10_900);
    rates.count('a', 1, 12_500);
    // Seconds 10, 11 and 12 are complete at 13.2 s; the one under way is not shown.
    expect(rates.history('a', 13_200)).toEqual([2, 0, 1]);
    expect(rates.history('a', 10_500)).toEqual([]);
  });

  it('holds the last 60 seconds of history', () => {
    expect(HISTORY_SECONDS).toBe(60);
    const rates = new EdgeRates();
    for (let s = 0; s < 100; s++) for (let i = 0; i <= s % 3; i++) rates.count('a', 1, s * 1000);
    const history = rates.history('a', 100_000);
    expect(history).toHaveLength(60);
    expect(history[0]).toBe((40 % 3) + 1);
    expect(history[59]).toBe((99 % 3) + 1);
  });

  it('counts a message still to come in its own second once that has passed', () => {
    const rates = new EdgeRates();
    rates.count('a', 1, 1000);
    rates.count('a', 1, 4500);
    expect(rates.history('a', 3000)).toEqual([1, 0]);
    expect(rates.history('a', 5000)).toEqual([1, 0, 0, 1]);
  });

  it('gives the same history while no second has passed and nothing changed it', () => {
    const rates = new EdgeRates();
    rates.count('a', 1, 1000);
    const first = rates.history('a', 2100);
    expect(rates.history('a', 2900)).toBe(first);
    rates.count('a', 1, 2500);
    expect(rates.history('a', 2950)).toBe(first);
    rates.count('a', 1, 1500);
    const changed = rates.history('a', 2990);
    expect(changed).not.toBe(first);
    expect(changed).toEqual([2]);
    expect(rates.history('a', 3000)).toEqual([2, 1]);
  });

  it('forgets every edge on clear', () => {
    const rates = new EdgeRates();
    rates.count('a', 1, 0);
    rates.clear();
    expect(rates.snapshot('a', 10).msgsPerSec).toBe(0);
    expect(rates.history('a', 5000)).toEqual([]);
  });
});
