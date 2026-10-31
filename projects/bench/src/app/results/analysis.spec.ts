import {
  analyseCampaign,
  capacityOf,
  flatTrend,
  median,
  recorderDecisions,
  soakTrend,
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

describe('stepTier with the display’s presented rate', () => {
  const panPresented = (presentedFps: number | undefined) =>
    withPhases(step('smooth', 1), { pan: phase('smooth', { presentedFps }) });

  it('uses the lower of the recorder’s rate and the presented one, so what was seen decides', () => {
    // The recorder counted 60 fps in the pan, the display drew 54 of them: 10 % showed nothing new.
    expect(stepTier(panPresented(54), INTERVAL_MS)).toBe('usable');
    expect(stepTier(panPresented(29), INTERVAL_MS)).toBe('failing');
  });

  it('falls back to the recorder where no presented rate was measured', () => {
    expect(stepTier(panPresented(undefined), INTERVAL_MS)).toBe('smooth');
  });

  it('never lifts a tier: a presented rate above the recorder’s changes nothing', () => {
    const rough = withPhases(step('smooth', 1), { pan: phase('usable', { presentedFps: 60 }) });

    expect(stepTier(rough, INTERVAL_MS)).toBe('usable');
  });
});

describe('stepMeanFps', () => {
  it('takes the lower of the recorder’s and the presented rate in each phase', () => {
    // 3 s at 60 fps, of which the display presented 30 fps (90 frames), and 1 s at 60: 150 over 4 s.
    const seen = step('smooth', 1, {
      phases: {
        a: phase('smooth', { frames: 180, fps: 60, presentedFps: 30 }),
        b: phase('smooth', { frames: 60, fps: 60 }),
      },
    });

    expect(stepMeanFps(seen)).toBeCloseTo(37.5, 9);
  });

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

describe('a step the presented rate decided', () => {
  const decided = (repeat: number, presentedFps: number | undefined) =>
    climb('kit', repeat, ['smooth']).map((s) =>
      withPhases(s, { pan: phase('smooth', { presentedFps }) }),
    );

  it('shows the effective fps and says the presented rate decided the tier', () => {
    const steps = [0, 1, 2].flatMap((repeat) => decided(repeat, 54));

    const cell = analyseCampaign(campaign(steps)).ladders[0].renderers[0].cells[0];

    expect(cell.tier).toBe('usable');
    expect(cell.presentedDecided).toBe(true);
    expect(cell.fps.median).toBeLessThan(60);
  });

  it('does not say so where the recorder’s tier was the same', () => {
    // 59.6 of 60: the display kept up as far as a count over a window can tell.
    const steps = [0, 1, 2].flatMap((repeat) => decided(repeat, 59.6));

    const cell = analyseCampaign(campaign(steps)).ladders[0].renderers[0].cells[0];

    expect(cell.tier).toBe('smooth');
    expect(cell.presentedDecided).toBe(false);
  });

  it('says nothing where no run was traced', () => {
    const cell = analyseCampaign(campaign(decided(0, undefined))).ladders[0].renderers[0].cells[0];

    expect(cell.presentedDecided).toBe(false);
  });

  it('lowers the capacity: the knee is where the display stopped keeping up', () => {
    const traced = climb('vflow', 0, ['smooth', 'smooth', 'smooth']).map((s, index) =>
      index === 2 ? withPhases(s, { pan: phase('smooth', { presentedFps: 45 }) }) : s,
    );

    const vflow = analyseCampaign(campaign(traced)).ladders[0].renderers[0];

    expect(vflow.smooth?.median).toEqual({ level: 2, atCap: false });
    expect(vflow.usable?.median).toEqual({ level: 4, atCap: true });
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

  it('ranks a refined level above the ladder level it refines, whatever its cap', () => {
    // A refined knee just above a ladder level, against a climb that held the level below it.
    const summary = summariseCapacity([cap(4.1), cap(4, true)]);

    expect(summary?.min).toEqual(cap(4, true));
    expect(summary?.max).toEqual(cap(4.1));
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

  it('counts a repeat whose page load died before any step as a climb with no capacity', () => {
    const steps = [
      ...climb('vflow', 0, ['smooth', 'smooth', 'smooth', 'smooth']),
      ...climb('vflow', 1, ['smooth', 'smooth', 'smooth', 'smooth']),
      ...climb('vflow', 2, ['smooth', 'smooth', 'smooth', 'smooth']),
      ...climb('kit', 0, ['smooth', 'usable']),
      ...climb('kit', 1, ['smooth', 'usable']),
    ];
    const file = campaign(steps, {
      runs: [
        { ladder: 'A', renderer: 'kit', repeat: 2, status: 'failed', error: 'the page crashed' },
      ],
    });

    const a = analyseCampaign(file).ladders[0];

    expect(a.renderers.find((r) => r.renderer === 'kit')?.climbs).toHaveLength(3);
    expect(a.verdict?.pairs).toHaveLength(3);
    expect(a.verdict?.kind).toBe('slower');
    expect(a.verdict?.pairs[2]).toMatchObject({ failed: true, slower: true });
  });

  it('lists the trend of median fps by level, for the capacity table’s sparkline', () => {
    const steps = climb('kit', 0, ['smooth', 'usable', 'failing']);

    expect(analyseCampaign(campaign(steps)).ladders[0].renderers[0].trend).toEqual([60, 40, 12]);
  });
});

describe('the dropped share where the presented rate decided', () => {
  /** Level 1 presented at 54.7 of 60 in the pan, as vflow's recorder overstates it. */
  const traced = () =>
    climb('kit', 0, ['smooth']).map((s) =>
      withPhases(s, { pan: phase('smooth', { presentedFps: 54.7 }) }),
    );
  const shortfall = (1 - 54.7 / 60) * 100;

  it('shows a step’s effective dropped share, the recorder’s beside it', () => {
    const cell = analyseCampaign(campaign(traced())).ladders[0].renderers[0].cells[0];

    expect(cell.droppedPct).toBeCloseTo(shortfall, 6);
    expect(cell.recorderDroppedPct).toBe(0);
  });

  it('shows a phase’s effective dropped share, the recorder’s beside it', () => {
    const kit = analyseCampaign(campaign(traced())).ladders[0].renderers[0];

    const rows = phaseRows(kit.climbs, INTERVAL_MS);

    expect(rows.find((r) => r.phase === 'pan')).toMatchObject({ recorderDroppedPct: 0 });
    expect(rows.find((r) => r.phase === 'pan')?.droppedPct).toBeCloseTo(shortfall, 6);
    expect(rows.find((r) => r.phase === 'idle')).toMatchObject({
      droppedPct: 0,
      recorderDroppedPct: 0,
    });
  });
});

describe('recorderDecisions (levels of a traced renderer with no presented rate)', () => {
  const kitSteps = () => climb('kit', 0, ['smooth', 'smooth', 'smooth']);
  const presented = (s: ReturnType<typeof step>) =>
    withPhases(s, {
      pan: phase('smooth', { presentedFps: 59 }),
      zoom: phase('smooth', { presentedFps: 59 }),
    });
  const withRate = (s: ReturnType<typeof step>, level: number) =>
    s.level === level ? presented(s) : s;

  it('names a level the traced run did not reach, where it reached others', () => {
    const steps = kitSteps().map((s) => withRate(withRate(s, 1), 2));

    const analysis = analyseCampaign(campaign(steps));

    expect(recorderDecisions(analysis)).toEqual([{ ladder: 'A', renderer: 'kit', levels: [4] }]);
    expect(analysis.ladders[0].renderers[0].cells.map((c) => c.recorderDecided)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('does not expect a rate from an idle phase, or from a renderer that was not traced', () => {
    const untraced = analyseCampaign(campaign(kitSteps()));
    const panned = analyseCampaign(campaign(kitSteps().map(presented)));

    expect(recorderDecisions(untraced)).toEqual([]);
    expect(recorderDecisions(panned)).toEqual([]);
  });

  it('expects a rate from every phase of a step with messages in flight', () => {
    const moving = (s: ReturnType<typeof step>) => ({
      ...s,
      params: { ...s.params, msgsPerSec: 500 },
    });
    const steps = kitSteps().map((s) =>
      moving(s.level === 1 ? withPhases(s, { idle: phase('smooth', { presentedFps: 59 }) }) : s),
    );

    expect(recorderDecisions(analyseCampaign(campaign(steps)))).toEqual([
      { ladder: 'A', renderer: 'kit', levels: [1, 2, 4] },
    ]);
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

describe('phaseRows with the presented rate and the heap', () => {
  it('shows the median presented rate beside the recorder’s, and the tier it decides', () => {
    const steps = [0, 1, 2].flatMap((repeat) =>
      climb('kit', repeat, ['smooth']).map((s) =>
        withPhases(s, { pan: phase('smooth', { presentedFps: [50, 54, 58][repeat] }) }),
      ),
    );
    const kit = analyseCampaign(campaign(steps)).ladders[0].renderers[0];

    const rows = phaseRows(kit.climbs, INTERVAL_MS);

    const pan = rows.find((r) => r.phase === 'pan')!;
    const idle = rows.find((r) => r.phase === 'idle')!;
    expect(pan).toMatchObject({
      fps: 60,
      presentedFps: 54,
      tier: 'usable',
      presentedDecided: true,
    });
    expect(idle).toMatchObject({ presentedFps: null, tier: 'smooth', presentedDecided: false });
  });

  it('shows the median heap at the phase’s end, nothing where it was not read', () => {
    const steps = [0, 1, 2].flatMap((repeat) =>
      climb('kit', repeat, ['smooth']).map((s) =>
        withPhases(s, {
          idle: phase('smooth', { cdp: { heapBytes: [10, 12, 11][repeat] * 1e6 } as never }),
        }),
      ),
    );
    const kit = analyseCampaign(campaign(steps)).ladders[0].renderers[0];

    const rows = phaseRows(kit.climbs, INTERVAL_MS);

    expect(rows.find((r) => r.phase === 'idle')?.heapBytes).toBe(11e6);
    expect(rows.find((r) => r.phase === 'pan')?.heapBytes).toBeNull();
  });
});

describe('soakTrend (the soak’s flat check, fps and heap)', () => {
  const rows = (fps: number[], heapMb: (number | null)[]) =>
    fps.map((f, i) => ({ fps: f, heapBytes: heapMb[i] === null ? null : heapMb[i]! * 1e6 }));

  it('calls a soak flat where the frame rate and the heap hold over its phases', () => {
    const trend = soakTrend(rows([60, 60, 59.9, 60], [13.1, 13.4, 12.9, 13.2]));

    expect(trend).toMatchObject({ phases: 4, fpsFlat: true, heap: 'held' });
    expect(trend?.heapFirstBytes).toBe(13.1e6);
    expect(trend?.heapLastBytes).toBe(13.2e6);
  });

  it('says the heap grew where it climbs by more than a tenth over the phases', () => {
    const trend = soakTrend(rows([60, 60, 60, 60], [13, 15, 17, 19]));

    expect(trend?.fpsFlat).toBe(true);
    expect(trend?.heap).toBe('grew');
  });

  it('says the heap fell, not grew, where it ends more than a tenth below where it began', () => {
    const trend = soakTrend(rows([60, 60, 60, 60], [9.3, 8, 7, 6.1]));

    expect(trend?.heap).toBe('fell');
  });

  it('says the heap varied where it swings by more than a tenth and ends where it began', () => {
    const trend = soakTrend(rows([60, 60, 60, 60], [9, 13, 8.5, 9.2]));

    expect(trend?.heap).toBe('varied');
  });

  it('says the frame rate fell where it does, with a flat heap', () => {
    const trend = soakTrend(rows([60, 58, 52, 45], [13, 13, 13, 13]));

    expect(trend).toMatchObject({ fpsFlat: false, heap: 'held' });
  });

  it('has no heap verdict where the heap was read at fewer than two phases', () => {
    const trend = soakTrend(rows([60, 60, 60], [null, 13, null]));

    expect(trend?.heap).toBeNull();
  });

  it('has nothing without phases', () => {
    expect(soakTrend([])).toBeNull();
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
