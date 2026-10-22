import type { NeatMetadataMessage } from './metadata-message';
import {
  createMetadataQueue,
  enqueueMetadata,
  holdOverlays,
  metadataQueueSnapshot,
  NeatHeldOverlays,
  NeatMetadataItem,
  OVERLAY_HOLD_MS,
  resetLatenessWindow,
  takeMetadataForFrame,
} from './metadata-sync';

/**
 * A message with the fields the queue looks at. `type` is empty for the many tests that do not
 * care about it, which the queue treats as an untyped message.
 */
function message({
  rtp,
  type = '',
  data = null,
}: { rtp?: number; type?: string; data?: unknown } = {}): NeatMetadataMessage {
  return rtp === undefined ? { type, data } : { type, data, _insight: { rtp_timestamp: rtp } };
}

const messages = (items: NeatMetadataItem[]) => items.map((item) => item.data);
const types = (items: NeatMetadataItem[]) => items.map((item) => item.data.type);

describe('metadata queue', () => {
  it('selects timestamped metadata only for its decoded RTP frame', () => {
    const queue = createMetadataQueue();
    const detection = message({ type: 'object-detection', data: { objects: [] }, rtp: 1234 });

    enqueueMetadata(queue, detection, 10);

    expect(takeMetadataForFrame(queue, 4321, 0, 20)).toStrictEqual([]);
    expect(takeMetadataForFrame(queue, 1234, 0, 20)[0]?.data).toStrictEqual(detection);
    expect(takeMetadataForFrame(queue, 1234, 0, 20)).toStrictEqual([]);
  });

  it('falls back to the next video frame for metadata without a source timestamp', () => {
    const queue = createMetadataQueue();
    const classification = message({ type: 'classification', data: { top_classes: [] } });

    enqueueMetadata(queue, classification, 10);

    expect(takeMetadataForFrame(queue, 1234, 20, 0)[0]?.data).toStrictEqual(classification);
  });

  it('falls back when the decoded frame has no RTP timestamp', () => {
    const queue = createMetadataQueue();
    const detection = message({ type: 'object-detection', data: { objects: [] }, rtp: 1234 });

    enqueueMetadata(queue, detection, 10);

    expect(takeMetadataForFrame(queue, null, 0, 20)[0]?.data).toStrictEqual(detection);
    expect(metadataQueueSnapshot(queue).timestampedPending).toBe(0);
  });

  it('selects the newest arrival across both queues when the frame has no identity', () => {
    const queue = createMetadataQueue();
    enqueueMetadata(queue, message({ data: 'timestamped', rtp: 1234 }), 10);
    enqueueMetadata(queue, message({ data: 'untimestamped' }), 20);

    expect(takeMetadataForFrame(queue, null, 0, 30)[0]?.data.data).toBe('untimestamped');
    expect(metadataQueueSnapshot(queue)).toStrictEqual({
      timestampMatches: 0,
      arrivalFallbacks: 1,
      frameMisses: 0,
      expired: 0,
      evicted: 0,
      untimestampedReceived: 1,
      late: 0,
      timestampedPending: 0,
      arrivalPending: 0,
      recentLateShare: null,
      recentLatenessMedianMs: null,
      recentLatenessP90Ms: null,
      recentLatenessMaxMs: null,
    });
  });

  it('evicts the oldest timestamped entry at capacity', () => {
    const queue = createMetadataQueue();

    for (let timestamp = 0; timestamp <= 300; timestamp += 1) {
      enqueueMetadata(queue, message({ rtp: timestamp }), timestamp);
    }

    expect(takeMetadataForFrame(queue, 0, 0, 300)).toStrictEqual([]);
    expect(takeMetadataForFrame(queue, 1, 0, 300)[0]?.data._insight?.rtp_timestamp).toBe(1);
  });

  describe('fallback without a frame timestamp', () => {
    it('keeps all types from only the most recently received frame', () => {
      const queue = createMetadataQueue();
      enqueueMetadata(queue, message({ type: 'pose-estimation', rtp: 0xffffffff }), 10);
      const tracking = message({ type: 'tracking', rtp: 0 });
      const detection = message({ type: 'object-detection', rtp: 0 });
      enqueueMetadata(queue, tracking, 20);
      enqueueMetadata(queue, detection, 21);

      expect(messages(takeMetadataForFrame(queue, null, 0, 30))).toStrictEqual([
        tracking,
        detection,
      ]);
      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(0);
      expect(takeMetadataForFrame(queue, null, 0, 31)).toStrictEqual([]);
    });

    it('uses arrival time when a frame receives another metadata type', () => {
      const queue = createMetadataQueue();
      const pose = message({ type: 'pose-estimation', rtp: 1 });
      const tracking = message({ type: 'tracking', rtp: 1 });
      enqueueMetadata(queue, pose, 10);
      enqueueMetadata(queue, message({ type: 'classification', rtp: 2 }), 20);
      enqueueMetadata(queue, tracking, 30);

      expect(messages(takeMetadataForFrame(queue, null, 0, 40))).toStrictEqual([pose, tracking]);
    });

    it('never combines timestamped and untimestamped metadata', () => {
      for (const arrivalTime of [10, 20, 30]) {
        const queue = createMetadataQueue();
        const timestamped = message({ type: 'tracking', rtp: 1 });
        const untimestamped = message({ type: 'pose-estimation' });
        enqueueMetadata(queue, timestamped, 20);
        enqueueMetadata(queue, untimestamped, arrivalTime);

        const expected = arrivalTime >= 20 ? untimestamped : timestamped;
        expect(messages(takeMetadataForFrame(queue, null, 0, 40))).toStrictEqual([expected]);
        expect(metadataQueueSnapshot(queue).timestampedPending).toBe(0);
        expect(metadataQueueSnapshot(queue).arrivalPending).toBe(0);
      }
    });

    it('returns only the latest untimestamped message without inferring a shared frame', () => {
      for (const frameTimestamp of [null, 42]) {
        const queue = createMetadataQueue();
        enqueueMetadata(queue, message({ type: 'pose-estimation' }), 10);
        const latest = message({ type: 'tracking' });
        enqueueMetadata(queue, latest, 20);

        expect(messages(takeMetadataForFrame(queue, frameTimestamp, 0, 30))).toStrictEqual([
          latest,
        ]);
      }
    });

    it('excludes expired types from its selected frame', () => {
      const queue = createMetadataQueue();
      enqueueMetadata(queue, message({ type: 'pose-estimation', rtp: 1 }), 0);
      enqueueMetadata(queue, message({ type: 'classification', rtp: 2 }), 20);
      const tracking = message({ type: 'tracking', rtp: 1 });
      enqueueMetadata(queue, tracking, 40);

      expect(messages(takeMetadataForFrame(queue, null, 50, 60))).toStrictEqual([tracking]);
      expect(metadataQueueSnapshot(queue).expired).toBe(1);
      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(0);
    });
  });

  it('prefers an exact frame match over newer fallback metadata', () => {
    const queue = createMetadataQueue();
    const exact = message({ type: 'pose-estimation', rtp: 1 });
    enqueueMetadata(queue, exact, 10);
    enqueueMetadata(queue, message({ type: 'tracking', rtp: 2 }), 20);
    enqueueMetadata(queue, message({ type: 'classification' }), 30);

    expect(messages(takeMetadataForFrame(queue, 1, 0, 40))).toStrictEqual([exact]);
    expect(metadataQueueSnapshot(queue).timestampedPending).toBe(1);
    expect(metadataQueueSnapshot(queue).arrivalPending).toBe(1);
  });

  describe('retention', () => {
    it('expires unmatched timestamped metadata after the configured time', () => {
      const queue = createMetadataQueue();
      enqueueMetadata(queue, message({ rtp: 1234 }), 10);

      expect(takeMetadataForFrame(queue, 1234, 5000, 5011)).toStrictEqual([]);
    });

    it('keeps metadata until match or capacity eviction with zero retention', () => {
      const queue = createMetadataQueue();
      enqueueMetadata(queue, message({ rtp: 1234 }), 10);

      expect(takeMetadataForFrame(queue, 1234, 0, 500_000)[0]?.data._insight?.rtp_timestamp).toBe(
        1234,
      );
    });

    it('keeps retention ordered by newest arrival when a timestamp is replaced', () => {
      const queue = createMetadataQueue();
      enqueueMetadata(queue, message({ data: 'old', rtp: 1 }), 0);
      enqueueMetadata(queue, message({ data: 'expired', rtp: 2 }), 10);
      enqueueMetadata(queue, message({ data: 'new', rtp: 1 }), 20);

      expect(takeMetadataForFrame(queue, 2, 15, 30)).toStrictEqual([]);
      expect(takeMetadataForFrame(queue, 1, 15, 30)[0]?.data.data).toBe('new');
    });

    it('expires the types of one frame independently', () => {
      const queue = createMetadataQueue();
      enqueueMetadata(queue, message({ type: 'pose-estimation', rtp: 7 }), 0);
      enqueueMetadata(queue, message({ type: 'tracking', rtp: 7 }), 40);

      // Retention 50 at t=60: pose (age 60) is gone, tracking (age 20) is not.
      takeMetadataForFrame(queue, 8, 50, 60);
      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(1);
      const items = takeMetadataForFrame(queue, 7, 50, 60);
      expect(types(items)).toStrictEqual(['tracking']);
      expect(metadataQueueSnapshot(queue).expired).toBe(1);
      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(0);
    });

    it('does not let a stale type hide behind a fresher frame', () => {
      const queue = createMetadataQueue();
      enqueueMetadata(queue, message({ type: 'pose-estimation', rtp: 1 }), 0);
      enqueueMetadata(queue, message({ type: 'pose-estimation', rtp: 2 }), 10);
      // Frame 1 moves behind frame 2 on this arrival, so its stale pose sits
      // after a frame whose entries are all fresh.
      enqueueMetadata(queue, message({ type: 'tracking', rtp: 1 }), 40);

      const items = takeMetadataForFrame(queue, 1, 50, 55);
      expect(types(items)).toStrictEqual(['tracking']);
      expect(metadataQueueSnapshot(queue).expired).toBe(1);
      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(1);
    });
  });

  it('keeps the newest metadata for a duplicate RTP timestamp', () => {
    const queue = createMetadataQueue();
    enqueueMetadata(queue, message({ data: 'old', rtp: 1234 }), 10);
    enqueueMetadata(queue, message({ data: 'new', rtp: 1234 }), 20);

    expect(takeMetadataForFrame(queue, 1234, 0, 30)[0]?.data.data).toBe('new');
  });

  it('reports exact timestamp matches', () => {
    const queue = createMetadataQueue();
    enqueueMetadata(queue, message({ rtp: 1234 }), 10);

    takeMetadataForFrame(queue, 1234, 0, 20);

    expect(metadataQueueSnapshot(queue).timestampMatches).toBe(1);
  });

  it('counts pending messages across types and frames', () => {
    const queue = createMetadataQueue();
    for (const type of ['pose-estimation', 'tracking']) {
      enqueueMetadata(queue, message({ type, rtp: 1 }), 10);
    }
    expect(metadataQueueSnapshot(queue).timestampedPending).toBe(2);

    enqueueMetadata(queue, message({ type: 'tracking', rtp: 1 }), 20);
    expect(metadataQueueSnapshot(queue).timestampedPending).toBe(2);
    enqueueMetadata(queue, message({ type: 'tracking', rtp: 2 }), 30);
    enqueueMetadata(queue, message({ type: 'classification' }), 40);
    expect(metadataQueueSnapshot(queue).timestampedPending).toBe(3);
    expect(metadataQueueSnapshot(queue).arrivalPending).toBe(1);

    takeMetadataForFrame(queue, 1, 0, 50);
    expect(metadataQueueSnapshot(queue).timestampedPending).toBe(1);
    takeMetadataForFrame(queue, null, 0, 60);
    expect(metadataQueueSnapshot(queue).timestampedPending).toBe(0);
    expect(metadataQueueSnapshot(queue).arrivalPending).toBe(0);
  });

  it('reports fallback, misses, expiry, and capacity eviction', () => {
    const queue = createMetadataQueue();
    enqueueMetadata(queue, message({ type: 'classification' }), 0);
    takeMetadataForFrame(queue, 1, 0, 1);
    takeMetadataForFrame(queue, 2, 0, 2);
    enqueueMetadata(queue, message({ rtp: 3 }), 0);
    takeMetadataForFrame(queue, 4, 1, 2);
    for (let timestamp = 10; timestamp <= 310; timestamp += 1) {
      enqueueMetadata(queue, message({ rtp: timestamp }), timestamp);
    }

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.arrivalFallbacks).toBe(1);
    expect(snapshot.frameMisses).toBe(2);
    expect(snapshot.expired).toBe(1);
    expect(snapshot.evicted).toBe(1);
    expect(snapshot.untimestampedReceived).toBe(1);
    expect(snapshot.timestampedPending).toBe(300);
  });

  describe('several types on one frame', () => {
    it('keeps metadata of every type, not just the last to arrive', () => {
      const queue = createMetadataQueue();
      enqueueMetadata(
        queue,
        message({ type: 'pose-estimation', data: { poses: [] }, rtp: 4242 }),
        10,
      );
      enqueueMetadata(queue, message({ type: 'tracking', data: { tracks: [] }, rtp: 4242 }), 11);

      const items = takeMetadataForFrame(queue, 4242, 0, 12);
      expect(types(items).sort()).toStrictEqual(['pose-estimation', 'tracking']);
    });

    it('preserves the draw order of the retained arrivals when a type is replaced', () => {
      const queue = createMetadataQueue();
      enqueueMetadata(queue, message({ type: 'object-detection', rtp: 1 }), 10);
      const pose = message({ type: 'pose-estimation', rtp: 1 });
      enqueueMetadata(queue, pose, 20);
      const replacement = message({ type: 'object-detection', data: 'updated', rtp: 1 });
      enqueueMetadata(queue, replacement, 30);

      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(2);
      expect(messages(takeMetadataForFrame(queue, 1, 0, 40))).toStrictEqual([pose, replacement]);
    });

    it('cannot exceed queue capacity with distinct types on one unmatched frame', () => {
      const queue = createMetadataQueue();
      for (let i = 0; i < 300; i += 1) {
        enqueueMetadata(queue, message({ type: `type-${i}`, rtp: 7 }), i);
      }
      expect(metadataQueueSnapshot(queue).evicted).toBe(0);
      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(300);

      enqueueMetadata(queue, message({ type: 'overflow', rtp: 7 }), 300);
      expect(metadataQueueSnapshot(queue).evicted).toBe(301);
      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(0);
      expect(takeMetadataForFrame(queue, 7, 0, 301)).toStrictEqual([]);
    });

    it('counts capacity per type across frames and replaces duplicates', () => {
      const queue = createMetadataQueue();
      for (let timestamp = 0; timestamp < 150; timestamp += 1) {
        for (const type of ['pose-estimation', 'tracking']) {
          enqueueMetadata(queue, message({ type, rtp: timestamp }), timestamp);
        }
      }
      enqueueMetadata(queue, message({ type: 'tracking', rtp: 149 }), 150);
      expect(metadataQueueSnapshot(queue).evicted).toBe(0);
      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(300);

      enqueueMetadata(queue, message({ type: 'tracking', rtp: 150 }), 151);
      expect(metadataQueueSnapshot(queue).evicted).toBe(2);
      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(299);
      expect(takeMetadataForFrame(queue, 0, 0, 152)).toStrictEqual([]);
      expect(takeMetadataForFrame(queue, 1, 0, 152).length).toBe(2);
    });

    it.each(['match', 'fallback', 'expiry'] as const)(
      'releases queue capacity on %s',
      (release) => {
        const queue = createMetadataQueue();
        enqueueMetadata(queue, message({ type: 'tracking', rtp: 7 }), 0);
        if (release === 'match') takeMetadataForFrame(queue, 7, 0, 10);
        if (release === 'fallback') takeMetadataForFrame(queue, null, 0, 10);
        if (release === 'expiry') takeMetadataForFrame(queue, 8, 5, 10);

        for (let timestamp = 100; timestamp < 400; timestamp += 1) {
          enqueueMetadata(queue, message({ type: 'tracking', rtp: timestamp }), 20);
        }
        expect(metadataQueueSnapshot(queue).evicted).toBe(0);
        expect(takeMetadataForFrame(queue, 100, 0, 21).length).toBe(1);
      },
    );
  });

  describe('auxiliary messages', () => {
    const auxiliary = (id: unknown, rtp: number) =>
      message({ type: 'auxiliary-visualization', data: { id }, rtp });

    it('keeps one entry per auxiliary id on one frame and replaces a repeated id', () => {
      const queue = createMetadataQueue();
      const pose3d = auxiliary('pose-3d', 5);
      const replacement = auxiliary('pose-3d', 5);
      const depth = auxiliary('depth', 5);
      enqueueMetadata(queue, pose3d, 10);
      enqueueMetadata(queue, depth, 11);
      enqueueMetadata(queue, replacement, 12);

      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(2);
      const taken = messages(takeMetadataForFrame(queue, 5, 0, 20));
      expect(taken).toHaveLength(2);
      expect(taken[0]).toBe(depth);
      expect(taken[1]).toBe(replacement);
    });

    it('collapses auxiliary messages without a usable id into one entry', () => {
      const queue = createMetadataQueue();
      const unusable = [undefined, '  ', 3, 'x'.repeat(129), 'y'.repeat(129)];
      unusable.forEach((id, index) => enqueueMetadata(queue, auxiliary(id, 5), 10 + index));
      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(1);

      enqueueMetadata(queue, auxiliary('x'.repeat(128), 5), 20);
      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(2);
    });

    it('trims the id before keying', () => {
      const queue = createMetadataQueue();
      enqueueMetadata(queue, auxiliary('pose-3d', 5), 10);
      enqueueMetadata(queue, auxiliary(' pose-3d ', 5), 11);

      expect(metadataQueueSnapshot(queue).timestampedPending).toBe(1);
    });
  });
});

describe('overlay hold', () => {
  const item = (type: string, data: unknown): NeatMetadataItem => ({
    receivedAt: 0,
    data: message({ type, data }),
  });

  it('redraws the last message of a missing type until a new one or the hold expires', () => {
    const held: NeatHeldOverlays = new Map();
    const detection = item('object-detection', { objects: [{ bbox: [1, 2, 3, 4] }] });
    const pose = item('pose-estimation', { poses: [] });
    const noObjects = item('object-detection', { objects: [] });

    expect(holdOverlays(held, [detection], 0)).toStrictEqual([detection]);
    expect(holdOverlays(held, [pose], 100)).toStrictEqual([pose, { ...detection, held: true }]);
    expect(holdOverlays(held, [noObjects], 150)).toStrictEqual([
      noObjects,
      { ...pose, held: true },
    ]);
    expect(holdOverlays(held, [], 150 + OVERLAY_HOLD_MS)).toStrictEqual([
      { ...noObjects, held: true },
    ]);
    expect(holdOverlays(held, [], 151 + OVERLAY_HOLD_MS)).toStrictEqual([]);
  });

  it('holds the auxiliary views of different ids separately', () => {
    const held: NeatHeldOverlays = new Map();
    const view = (id: string) => item('auxiliary-visualization', { id });

    holdOverlays(held, [view('a'), view('b')], 0);

    expect(holdOverlays(held, [view('a')], 50)).toStrictEqual([
      view('a'),
      { ...view('b'), held: true },
    ]);
  });
});

describe('lateness', () => {
  const FRAME_TICKS = 3600; // 40 ms at the 90 kHz RTP clock

  const timestamped = (rtpTimestamp: number) =>
    message({ type: 'pose-estimation', data: { poses: [] }, rtp: rtpTimestamp });

  // Presents `count` frames 40 ms apart. Each frame's metadata arrives `latenessMs`
  // after the frame when late, or 10 ms before it otherwise.
  function playFrames(
    queue: ReturnType<typeof createMetadataQueue>,
    {
      count,
      startFrame = 0,
      latenessMs = null,
    }: { count: number; startFrame?: number; latenessMs?: number | null },
  ) {
    for (let i = startFrame; i < startFrame + count; i += 1) {
      const rtpTimestamp = i * FRAME_TICKS;
      const presentedAt = i * 40;
      if (latenessMs === null) {
        enqueueMetadata(queue, timestamped(rtpTimestamp), presentedAt - 10);
        takeMetadataForFrame(queue, rtpTimestamp, 0, presentedAt);
      } else {
        takeMetadataForFrame(queue, rtpTimestamp, 0, presentedAt);
        enqueueMetadata(queue, timestamped(rtpTimestamp), presentedAt + latenessMs);
      }
    }
  }

  it('counts metadata for an already presented frame as late and does not queue it', () => {
    const queue = createMetadataQueue();
    takeMetadataForFrame(queue, 9000, 0, 1000);

    enqueueMetadata(queue, timestamped(9000), 1150);

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.late).toBe(1);
    expect(snapshot.timestampedPending).toBe(0);
    expect(snapshot.evicted).toBe(0);
    expect(snapshot.recentLatenessMaxMs).toBe(150);
  });

  it('counts metadata older than the presented frame as late', () => {
    const queue = createMetadataQueue();
    takeMetadataForFrame(queue, 5 * FRAME_TICKS, 0, 200);
    takeMetadataForFrame(queue, 6 * FRAME_TICKS, 0, 240);

    enqueueMetadata(queue, timestamped(5 * FRAME_TICKS), 300);

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.late).toBe(1);
    expect(snapshot.recentLatenessMaxMs).toBe(100);
  });

  it('still queues and matches metadata newer than the presented frame', () => {
    const queue = createMetadataQueue();
    takeMetadataForFrame(queue, 9000, 0, 1000);

    enqueueMetadata(queue, timestamped(9000 + FRAME_TICKS), 1010);

    expect(metadataQueueSnapshot(queue).late).toBe(0);
    expect(takeMetadataForFrame(queue, 9000 + FRAME_TICKS, 0, 1040).length).toBe(1);
  });

  it('judges nothing late before the first frame was presented', () => {
    const queue = createMetadataQueue();

    enqueueMetadata(queue, timestamped(0), 10);

    expect(metadataQueueSnapshot(queue).late).toBe(0);
    expect(metadataQueueSnapshot(queue).timestampedPending).toBe(1);
  });

  it('compares wrap-safely on 32 bits', () => {
    const afterWrap = createMetadataQueue();
    takeMetadataForFrame(afterWrap, 5, 0, 1000);
    enqueueMetadata(afterWrap, timestamped(0xffffff00), 1100);
    expect(metadataQueueSnapshot(afterWrap).late).toBe(1);

    const beforeWrap = createMetadataQueue();
    takeMetadataForFrame(beforeWrap, 0xfffffff0, 0, 1000);
    enqueueMetadata(beforeWrap, timestamped(16), 1010);
    expect(metadataQueueSnapshot(beforeWrap).late).toBe(0);
    expect(metadataQueueSnapshot(beforeWrap).timestampedPending).toBe(1);
  });

  it('judges against the frame presented last, so a backwards jump recovers', () => {
    const queue = createMetadataQueue();
    takeMetadataForFrame(queue, 900_000, 0, 1000);
    takeMetadataForFrame(queue, 1000, 0, 1040); // source restarted with lower timestamps

    enqueueMetadata(queue, timestamped(1000 + FRAME_TICKS), 1050);

    expect(metadataQueueSnapshot(queue).late).toBe(0);
    expect(takeMetadataForFrame(queue, 1000 + FRAME_TICKS, 0, 1080).length).toBe(1);
  });

  it('counts a late message whose frame is no longer remembered without a lateness sample', () => {
    const queue = createMetadataQueue();
    takeMetadataForFrame(queue, 0, 0, 0);
    takeMetadataForFrame(queue, 200 * FRAME_TICKS, 0, 8000); // frame 0 is older than the 5 s memory

    enqueueMetadata(queue, timestamped(0), 8010);

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.late).toBe(1);
    expect(snapshot.recentLatenessMedianMs).toBeNull();
    expect(snapshot.recentLatenessP90Ms).toBeNull();
    expect(snapshot.recentLatenessMaxMs).toBeNull();
  });

  it('counts a late message for a never presented frame without a lateness sample', () => {
    const queue = createMetadataQueue();
    takeMetadataForFrame(queue, 0, 0, 0);
    takeMetadataForFrame(queue, 2 * FRAME_TICKS, 0, 80); // frame 1 was dropped

    enqueueMetadata(queue, timestamped(FRAME_TICKS), 100);

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.late).toBe(1);
    expect(snapshot.recentLatenessMaxMs).toBeNull();
  });

  it('describes the recent window by late share and lateness', () => {
    const queue = createMetadataQueue();
    playFrames(queue, { count: 5 });
    playFrames(queue, { count: 15, startFrame: 5, latenessMs: 150 });

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.timestampMatches).toBe(5);
    expect(snapshot.late).toBe(15);
    expect(snapshot.recentLateShare).toBe(0.75);
    expect(snapshot.recentLatenessMedianMs).toBe(150);
    expect(snapshot.recentLatenessP90Ms).toBe(150);
    expect(snapshot.recentLatenessMaxMs).toBe(150);
  });

  it('calculates no late share from fewer than 10 messages', () => {
    const queue = createMetadataQueue();
    playFrames(queue, { count: 9, latenessMs: 150 });

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.late).toBe(9);
    expect(snapshot.recentLateShare).toBeNull();
  });

  it('forgets outcomes older than 5 s of presented frames', () => {
    const queue = createMetadataQueue();
    playFrames(queue, { count: 20, latenessMs: 150 }); // frames at 0..760 ms

    takeMetadataForFrame(queue, 500 * FRAME_TICKS, 0, 20_000);

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.late).toBe(20); // cumulative counter is kept
    expect(snapshot.recentLateShare).toBeNull();
    expect(snapshot.recentLatenessMaxMs).toBeNull();
  });

  it('does not advance the window while no frame is presented', () => {
    const queue = createMetadataQueue();
    playFrames(queue, { count: 20, latenessMs: 150 });

    // A hidden tab presents no frames; a message arriving a minute later changes nothing.
    enqueueMetadata(queue, timestamped(10_000 * FRAME_TICKS), 60_000);

    expect(metadataQueueSnapshot(queue).recentLateShare).toBe(1);
  });

  it('keeps the cumulative counters when the window is reset', () => {
    const queue = createMetadataQueue();
    playFrames(queue, { count: 20, latenessMs: 150 });

    resetLatenessWindow(queue);

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.late).toBe(20);
    expect(snapshot.recentLateShare).toBeNull();
    expect(snapshot.recentLatenessMedianMs).toBeNull();
  });

  it('uses the nearest rank for percentiles', () => {
    const queue = createMetadataQueue();
    for (let i = 0; i < 10; i += 1) {
      takeMetadataForFrame(queue, i * FRAME_TICKS, 0, i * 40);
      enqueueMetadata(queue, timestamped(i * FRAME_TICKS), i * 40 + (i + 1) * 10); // 10..100 ms
    }

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.recentLatenessMedianMs).toBe(50);
    expect(snapshot.recentLatenessP90Ms).toBe(90);
    expect(snapshot.recentLatenessMaxMs).toBe(100);
  });

  it('counts a type arriving after its frame as late although another type was on time', () => {
    const queue = createMetadataQueue();
    enqueueMetadata(queue, message({ type: 'pose-estimation', rtp: 9000 }), 990);
    expect(takeMetadataForFrame(queue, 9000, 0, 1000).length).toBe(1);

    enqueueMetadata(queue, message({ type: 'tracking', rtp: 9000 }), 1150);

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.late).toBe(1);
    expect(snapshot.timestampedPending).toBe(0);
    expect(snapshot.recentLatenessMaxMs).toBe(150);
  });

  it('counts every type of a matched frame as one message on time', () => {
    const queue = createMetadataQueue();
    // Six frames with two types each on time, then four frames whose single message is late.
    for (let i = 0; i < 6; i += 1) {
      for (const type of ['pose-estimation', 'tracking']) {
        enqueueMetadata(queue, message({ type, rtp: i * FRAME_TICKS }), i * 40 - 10);
      }
      takeMetadataForFrame(queue, i * FRAME_TICKS, 0, i * 40);
    }
    playFrames(queue, { count: 4, startFrame: 6, latenessMs: 150 });

    const snapshot = metadataQueueSnapshot(queue);
    expect(snapshot.timestampMatches).toBe(6);
    expect(snapshot.late).toBe(4);
    expect(snapshot.recentLateShare).toBe(0.25);
  });
});
