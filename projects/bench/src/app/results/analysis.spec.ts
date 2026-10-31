import {
  analyseCampaign,
  capacityOf,
  flatTrend,
  median,
  phaseRows,
  SPREAD_FLAG_PCT,
  stat,
  stepMeanFps,
  stepTier,
  summariseCapacity,
} from './analysis';
import { campaign, climb, INTERVAL_MS, phase, step, withPhases } from './results.testing';

describe('stepTier', () => {
  it('is the worst tier of its phases, so a smooth idle cannot hide a rough pan', () => {
    const rough = withPhases(step('smooth', 1), { pan: phase('usable') });

    expect(stepTier(rough, INTERVAL_MS)).toBe('usable');
    expect(stepTier(step('smooth', 1), INTERVAL_MS)).toBe('smooth');
    expect(stepTier(step('failing', 1), INTERVAL_MS)).toBe('failing');
  });

  it('fails a step that was aborted, or that has no phase to judge', () => {
    expect(stepTier(step('smooth', 1, { aborted: 'unresponsive' }), INTERVAL_MS)).toBe('failing');
    expect(stepTier(step('smooth', 1, { aborted: 'watchdog', phases: {} }), INTERVAL_MS)).toBe(
      'failing',
    );
    expect(stepTier(step('smooth', 1, { phases: {} }), INTERVAL_MS)).toBe('failing');
  });

  it('judges against the run’s own refresh interval', () => {
    // 28 ms frames: smooth on a 30 Hz display (1.25 × 33 ms), not on a 60 Hz one.
    const slow = step('smooth', 1, {}, { p50: 28, p95: 28, p99: 28, fps: 35 });

    expect(stepTier(slow, 1000 / 30)).toBe('smooth');
    expect(stepTier(slow, 1000 / 60)).toBe('usable');
  });
});

describe('stepMeanFps', () => {
  it('weights each phase by the time it ran for, not by how many phases there are', () => {
    // 3 s at 60 fps (180 frames) and 1 s at 30 fps (30 frames): 210 frames in 4 s.
    const mixed = step('smooth', 1, {
      phases: {
        a: phase('smooth', { frames: 180, fps: 60 }),
        b: phase('smooth', { frames: 30, fps: 30 }),
      },
    });

    expect(stepMeanFps(mixed)).toBeCloseTo(52.5, 9);
  });

  it('is zero for a step with no frames', () => {
    expect(stepMeanFps(step('smooth', 1, { phases: {} }))).toBe(0);
  });
});

describe('capacityOf (the largest load held, with every smaller one held too)', () => {
  const steps = (...tiers: ('smooth' | 'usable' | 'failing')[]) =>
    tiers.map((tier, index) => ({ level: 2 ** index, tier }));

  it('is the last level that met the tier, with the first miss ending it', () => {
    const climbed = steps('smooth', 'smooth', 'usable', 'failing');

    expect(capacityOf(climbed, 'smooth')).toEqual({ level: 2, atCap: false });
    expect(capacityOf(climbed, 'usable')).toEqual({ level: 4, atCap: false });
  });

  it('is at least the top level where no step missed: the climb ended at its cap', () => {
    expect(capacityOf(steps('smooth', 'smooth'), 'smooth')).toEqual({ level: 2, atCap: true });
  });

  it('is none where even the first level missed', () => {
    expect(capacityOf(steps('usable', 'usable'), 'smooth')).toEqual({ level: null, atCap: false });
  });

  it('does not count a smooth step above a miss: noise past the knee is not capacity', () => {
    expect(capacityOf(steps('smooth', 'usable', 'smooth'), 'smooth')).toEqual({
      level: 1,
      atCap: false,
    });
  });

  it('puts the levels in order first, refinement steps among them', () => {
    const climbed = [
      { level: 8, tier: 'failing' as const },
      { level: 4, tier: 'smooth' as const },
      { level: 6, tier: 'smooth' as const },
      { level: 1, tier: 'smooth' as const },
    ];

    expect(capacityOf(climbed, 'smooth')).toEqual({ level: 6, atCap: false });
  });

  it('has nothing where there are no steps', () => {
    expect(capacityOf([], 'smooth')).toEqual({ level: null, atCap: false });
  });
});

describe('summariseCapacity', () => {
  const cap = (level: number | null, atCap = false) => ({ level, atCap });

  it('takes the lower median, min and max, so a claim is the conservative one', () => {
    const summary = summariseCapacity([cap(8), cap(4), cap(8), cap(16)]);

    expect(summary).toMatchObject({ median: cap(8), min: cap(4), max: cap(16), repeats: 4 });
  });

  it('puts none below every level, and a climb that never failed above one that did', () => {
    const summary = summariseCapacity([cap(null), cap(4, true), cap(4)]);

    expect(summary?.min).toEqual(cap(null));
    expect(summary?.median).toEqual(cap(4));
    expect(summary?.max).toEqual(cap(4, true));
  });

  it('has nothing without repeats', () => {
    expect(summariseCapacity([])).toBeNull();
  });
});

describe('median and stat', () => {
  it('takes the middle, or the mean of the two middle ones', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
  });

  it('gives min, max and the spread as a share of the median', () => {
    const s = stat([58, 60, 62]);

    expect(s).toMatchObject({ median: 60, min: 58, max: 62, n: 3 });
    expect(s?.spreadPct).toBeCloseTo((4 / 60) * 100, 9);
  });

  it('measures the spread against the 10 % that flags a cell', () => {
    expect(SPREAD_FLAG_PCT).toBe(10);
    expect(stat([54, 60, 61])?.spreadPct).toBeGreaterThan(SPREAD_FLAG_PCT);
    expect(stat([57, 60, 63])?.spreadPct).toBeCloseTo(10, 9);
    expect(stat([59, 60, 61])?.spreadPct).toBeLessThan(SPREAD_FLAG_PCT);
  });

  it('has no spread to speak of where the median is zero and the values are all of it', () => {
    expect(stat([0, 0, 0])?.spreadPct).toBe(0);
    expect(stat([])).toBeNull();
  });
});

/** Both renderers, three repeats each, ladder A. */
function twoRenderers() {
  return campaign([
    ...[0, 1, 2].flatMap((repeat) =>
      climb('kit', repeat, ['smooth', 'smooth', 'usable', 'failing']),
    ),
    ...[0, 1, 2].flatMap((repeat) =>
      climb('vflow', repeat, ['smooth', 'smooth', 'smooth', 'smooth', 'usable', 'failing']),
    ),
  ]);
}

describe('analyseCampaign', () => {
  it('reads the interval the run measured, and the display’s rate where it has none', () => {
    expect(analyseCampaign(twoRenderers()).intervalMs).toBe(INTERVAL_MS);
    expect(analyseCampaign({ ...twoRenderers(), measurement: null }).intervalMs).toBeCloseTo(
      1000 / 60,
      9,
    );
  });

  it('gives each ladder its renderers in the order kit, vflow, none', () => {
    const file = campaign([
      ...climb('none', 0, ['smooth']),
      ...climb('vflow', 0, ['smooth']),
      ...climb('kit', 0, ['smooth']),
      ...climb('kit', 0, ['smooth'], { ladder: 'B' }),
    ]);

    const ladders = analyseCampaign(file).ladders;

    expect(ladders.map((l) => l.ladder)).toEqual(['A', 'B']);
    expect(ladders[0].renderers.map((r) => r.renderer)).toEqual(['kit', 'vflow', 'none']);
  });

  it('gives each renderer’s capacity in both tiers over its repeats', () => {
    const a = analyseCampaign(twoRenderers()).ladders[0];
    const kit = a.renderers.find((r) => r.renderer === 'kit');
    const vflow = a.renderers.find((r) => r.renderer === 'vflow');

    expect(kit?.smooth?.median).toEqual({ level: 2, atCap: false });
    expect(kit?.usable?.median).toEqual({ level: 4, atCap: false });
    expect(vflow?.smooth?.median).toEqual({ level: 8, atCap: false });
    expect(vflow?.usable?.median).toEqual({ level: 16, atCap: false });
  });

  it('judges the rule on the ladder: the kit’s smooth capacity two doubling steps below', () => {
    const a = analyseCampaign(twoRenderers()).ladders[0];

    expect(a.verdict?.kind).toBe('slower');
    expect(a.verdict?.slowerCount).toBe(3);
    expect(a.usableVerdict?.kind).toBe('slower');
  });

  it('has no verdict on a ladder run on one renderer', () => {
    const a = analyseCampaign(campaign(climb('kit', 0, ['smooth', 'failing']))).ladders[0];

    expect(a.verdict).toBeNull();
    expect(a.evidence).toBeNull();
  });

  it('takes the median over the repeats for each level, and flags a spread over 10 %', () => {
    const steps = [58, 60, 40].flatMap((fps, repeat) =>
      climb('kit', repeat, ['smooth']).map((s) => ({
        ...s,
        phases: { idle: phase('smooth', { fps, frames: fps * 3 }) },
      })),
    );

    const cell = analyseCampaign(campaign(steps)).ladders[0].renderers[0].cells[0];

    expect(cell.level).toBe(1);
    expect(cell.repeats).toBe(3);
    expect(cell.fps.median).toBe(58);
    expect(cell.fps.min).toBe(40);
    expect(cell.spreadFlag).toBe(true);
  });

  it('shows a step at the worst phase’s numbers, which its tier is also judged by', () => {
    const s = withPhases(step('smooth', 1), {
      pan: phase('usable', { p95: 33, droppedPct: 12, cdp: { busyShare: 0.8 } as never }),
      zoom: phase('smooth', { cdp: { busyShare: 0.3 } as never }),
    });

    const cell = analyseCampaign(campaign([s])).ladders[0].renderers[0].cells[0];

    expect(cell.tier).toBe('usable');
    expect(cell.p95Ms).toBe(33);
    expect(cell.droppedPct).toBe(12);
    expect(cell.busyShare).toBe(0.8);
    expect(cell.buildMs).toBe(40);
  });

  it('keeps the median tier of the repeats, the worse of two', () => {
    const steps = [
      ...climb('kit', 0, ['smooth']),
      ...climb('kit', 1, ['usable']),
      ...climb('kit', 2, ['usable']),
    ];

    expect(analyseCampaign(campaign(steps)).ladders[0].renderers[0].cells[0].tier).toBe('usable');
  });

  it('counts a failed run’s climb as one that never reached the cap, and says it failed', () => {
    const file = campaign(climb('kit', 0, ['smooth', 'smooth'], { failedRun: true }));

    const kit = analyseCampaign(file).ladders[0].renderers[0];

    expect(kit.climbs[0].failed).toBe(true);
    expect(kit.smooth?.median).toEqual({ level: 2, atCap: false });
    expect(analyseCampaign(file).failedRuns).toBe(1);
  });

  it('lists the trend of median fps by level, for the capacity table’s sparkline', () => {
    const steps = climb('kit', 0, ['smooth', 'usable', 'failing']);

    expect(analyseCampaign(campaign(steps)).ladders[0].renderers[0].trend).toEqual([60, 40, 12]);
  });
});

describe('phaseRows', () => {
  it('lists each level’s phases at the median of the repeats, each with its tier', () => {
    const steps = [
      ...climb('kit', 0, ['smooth', 'usable']),
      ...climb('kit', 1, ['smooth', 'usable']),
    ];
    const kit = analyseCampaign(campaign(steps)).ladders[0].renderers[0];

    const rows = phaseRows(kit.climbs, INTERVAL_MS);

    expect(rows.map((r) => [r.level, r.phase, r.tier])).toEqual([
      [1, 'idle', 'smooth'],
      [1, 'pan', 'smooth'],
      [1, 'zoom', 'smooth'],
      [1, 'zoomed-out', 'smooth'],
      [2, 'idle', 'usable'],
      [2, 'pan', 'usable'],
      [2, 'zoom', 'usable'],
      [2, 'zoomed-out', 'usable'],
    ]);
    expect(rows[4]).toMatchObject({ fps: 40, p95: 30, droppedPct: 10 });
  });

  it('leaves out the steps that were aborted before they had a phase', () => {
    const steps = climb('kit', 0, ['smooth', 'smooth']);
    steps[1] = { ...steps[1], phases: {}, aborted: 'watchdog' };
    const kit = analyseCampaign(campaign(steps)).ladders[0].renderers[0];

    expect(new Set(phaseRows(kit.climbs, INTERVAL_MS).map((r) => r.level))).toEqual(new Set([1]));
  });
});

describe('flatTrend', () => {
  it('calls a line flat where its steps differ by under 1 fps, noise a sparkline would stretch', () => {
    expect(flatTrend([60, 59.98, 60])).toBe(true);
    expect(flatTrend([60, 60, 59.5])).toBe(true);
    expect(flatTrend([])).toBe(true);
  });

  it('calls a line that falls or rises by a frame a second or more a trend', () => {
    expect(flatTrend([60, 60, 58.8, 53.6])).toBe(false);
    expect(flatTrend([40, 41])).toBe(false);
  });
});
