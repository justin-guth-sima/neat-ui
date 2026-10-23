import {
  bufferSettleMs,
  lateNoticeDetails,
  nextWarningActive,
  suggestedBufferMs,
} from './metadata-lateness';

// The helpers tolerate values that are not numbers (an unset setting, a failed measurement); the
// signatures say number, so these tests have to cast to pass them.
const notANumber = undefined as unknown as number;

describe('nextWarningActive', () => {
  it('turns on when half of the messages are late', () => {
    expect(nextWarningActive(false, 0.5)).toBe(true);
    expect(nextWarningActive(false, 0.92)).toBe(true);
  });

  it('stays off below half', () => {
    expect(nextWarningActive(false, 0.49)).toBe(false);
  });

  it('turns off only below a tenth', () => {
    expect(nextWarningActive(true, 0.1)).toBe(true);
    expect(nextWarningActive(true, 0.3)).toBe(true);
    expect(nextWarningActive(true, 0.09)).toBe(false);
    expect(nextWarningActive(true, 0)).toBe(false);
  });

  it('keeps its state while no share can be calculated', () => {
    expect(nextWarningActive(true, null)).toBe(true);
    expect(nextWarningActive(false, null)).toBe(false);
    expect(nextWarningActive(true, notANumber)).toBe(true);
  });
});

describe('suggestedBufferMs', () => {
  it('covers the lateness plus a margin, in 50 ms steps', () => {
    expect(suggestedBufferMs(350, 195)).toBe(600);
    expect(suggestedBufferMs(350, 150)).toBe(550);
    expect(suggestedBufferMs(350, 151)).toBe(600);
  });

  it('is always above the current buffer', () => {
    expect(suggestedBufferMs(350, 0)).toBe(400);
    expect(suggestedBufferMs(0, 0)).toBe(50);
    expect(suggestedBufferMs(375, 0.4)).toBe(450);
  });

  it('makes no suggestion above the 4000 ms maximum', () => {
    expect(suggestedBufferMs(3000, 950)).toBe(4000);
    expect(suggestedBufferMs(3000, 951)).toBeNull();
    expect(suggestedBufferMs(4000, 0)).toBeNull();
  });

  it('makes no suggestion without a lateness measurement', () => {
    expect(suggestedBufferMs(350, null)).toBeNull();
    expect(suggestedBufferMs(350, Number.NaN)).toBeNull();
    expect(suggestedBufferMs(notANumber, 100)).toBeNull();
  });
});

describe('lateNoticeDetails', () => {
  const measured = { recentLateShare: 1, recentLatenessMedianMs: 150, recentLatenessP90Ms: 195 };
  const beyondMaximum = {
    recentLateShare: 1,
    recentLatenessMedianMs: 1200,
    recentLatenessP90Ms: 1300,
  };
  const unmeasured = {
    recentLateShare: 1,
    recentLatenessMedianMs: null,
    recentLatenessP90Ms: null,
  };

  it('carries the panel values', () => {
    const snapshot = {
      recentLateShare: 0.918,
      recentLatenessMedianMs: 153.4,
      recentLatenessP90Ms: 195,
    };

    expect(lateNoticeDetails(snapshot, 350, true, 350)).toStrictEqual({
      latenessMs: 153,
      latePercent: 92,
      bufferMs: 350,
      suggestedBufferMs: 600,
      blockedBy: null,
      globalAction: { kind: 'raise', valueMs: 600 },
    });
  });

  it('raises the global value when the followed value is below the suggestion', () => {
    expect(lateNoticeDetails(measured, 350, true, 500).globalAction).toStrictEqual({
      kind: 'raise',
      valueMs: 600,
    });
  });

  it('follows the global value when it is above the suggestion', () => {
    expect(lateNoticeDetails(measured, 350, true, 1000).globalAction).toStrictEqual({
      kind: 'follow',
      valueMs: 1000,
    });
  });

  it('follows the global value when it equals the suggestion', () => {
    expect(lateNoticeDetails(measured, 350, true, 600).globalAction).toStrictEqual({
      kind: 'follow',
      valueMs: 600,
    });
  });

  it('offers no global action without a suggestion', () => {
    expect(lateNoticeDetails(beyondMaximum, 3000, true, 350).globalAction).toBeNull();
    expect(lateNoticeDetails(measured, 350, false, 350).globalAction).toBeNull();
  });

  it('offers the raise when the followed value is missing', () => {
    const raise = { kind: 'raise', valueMs: 600 };

    expect(lateNoticeDetails(measured, 350, true).globalAction).toStrictEqual(raise);
    expect(lateNoticeDetails(measured, 350, true, null).globalAction).toStrictEqual(raise);
    expect(lateNoticeDetails(measured, 350, true, Number.NaN).globalAction).toStrictEqual(raise);
  });

  it('names the maximum as the blocker', () => {
    const details = lateNoticeDetails(beyondMaximum, 3000, true);

    expect(details.suggestedBufferMs).toBeNull();
    expect(details.blockedBy).toBe('maximum');
  });

  it('names the browser as the blocker', () => {
    const snapshot = { ...measured, recentLatenessP90Ms: 150 };

    const details = lateNoticeDetails(snapshot, 350, false);

    expect(details.suggestedBufferMs).toBeNull();
    expect(details.blockedBy).toBe('unsupported');
  });

  it('survives a window without lateness samples', () => {
    expect(lateNoticeDetails(unmeasured, 350, true, 350)).toStrictEqual({
      latenessMs: null,
      latePercent: 100,
      bufferMs: 350,
      suggestedBufferMs: null,
      blockedBy: 'unmeasured',
      globalAction: null,
    });
  });

  it('names unmeasured as the blocker', () => {
    const snapshot = { ...unmeasured, recentLatenessP90Ms: Number.NaN };

    const details = lateNoticeDetails(snapshot, 350, true);

    expect(details.suggestedBufferMs).toBeNull();
    expect(details.blockedBy).toBe('unmeasured');
    expect(details.globalAction).toBeNull();
  });

  it('lets unsupported win over an unmeasured window', () => {
    const details = lateNoticeDetails(unmeasured, 350, false);

    expect(details.suggestedBufferMs).toBeNull();
    expect(details.blockedBy).toBe('unsupported');
    expect(details.globalAction).toBeNull();
  });
});

describe('bufferSettleMs', () => {
  it('needs time in proportion to a raise', () => {
    expect(bufferSettleMs(350, 600)).toBe(3500);
    expect(bufferSettleMs(0, 4000)).toBe(41000);
  });

  it('settles a lowered or unchanged buffer after the base time', () => {
    expect(bufferSettleMs(600, 350)).toBe(1000);
    expect(bufferSettleMs(350, 350)).toBe(1000);
  });

  it('survives values that are not numbers', () => {
    expect(bufferSettleMs(notANumber, 600)).toBe(1000);
    expect(bufferSettleMs(350, Number.NaN)).toBe(1000);
  });
});
