import type { Climb } from './analysis';
import { isClearlySlower, fallbackVerdict, supportingEvidence } from './verdict';
import type { Capacity } from './analysis';

const cap = (level: number | null, atCap = false): Capacity => ({ level, atCap });

describe('isClearlySlower', () => {
  it.each([
    ['one doubling step below', cap(4), cap(8), true],
    ['more than one step below', cap(2), cap(16), true],
    ['less than a doubling below (a refined knee)', cap(6), cap(8), false],
    ['equal', cap(8), cap(8), false],
    ['above', cap(16), cap(8), false],
    ['unable to meet the first level, where vflow can', cap(null), cap(1), true],
    ['unable to meet the first level, as vflow is', cap(null), cap(null), false],
    ['vflow unable to meet the first level, the kit able', cap(1), cap(null), false],
    [
      'one doubling step below, at the lighter rungs (×1/4 against ×1/2)',
      cap(0.25),
      cap(0.5),
      true,
    ],
    [
      'less than a doubling below at the lighter rungs (a refined knee)',
      cap(0.375),
      cap(0.5),
      false,
    ],
    ['unable to meet ×1/8, where vflow can', cap(null), cap(0.125), true],
    ['zero notes against four (ladder C)', cap(0), cap(4), true],
    ['zero against zero (ladder C)', cap(0), cap(0), false],
    ['the kit never failing, vflow at its top too', cap(32, true), cap(32, true), false],
    ['the kit never failing, whatever vflow reached', cap(8, true), cap(32), false],
  ])('%s', (_, kit, vflow, expected) => {
    expect(isClearlySlower(kit, vflow)).toBe(expected);
  });
});

/** A climb with only what the verdict reads: its repeat and its capacities. */
function climbOf(
  renderer: string,
  repeat: number,
  smooth: Capacity,
  options: { failed?: boolean } = {},
): Climb {
  return {
    ladder: 'A',
    renderer,
    repeat,
    failed: options.failed ?? false,
    steps: [],
    smooth,
    usable: smooth,
  };
}

describe('fallbackVerdict (the kit is clearly slower where it is, in 2 of 3 repeats)', () => {
  const kit = (...levels: number[]): Climb[] =>
    levels.map((level, repeat) => climbOf('kit', repeat, cap(level)));
  const vflow = (...levels: number[]): Climb[] =>
    levels.map((level, repeat) => climbOf('vflow', repeat, cap(level)));

  it('says clearly slower when two of three repeats are a step or more below', () => {
    const verdict = fallbackVerdict(kit(4, 4, 8), vflow(8, 8, 8), 'smooth');

    expect(verdict.kind).toBe('slower');
    expect(verdict.slowerCount).toBe(2);
    expect(verdict.pairs.map((pair) => pair.slower)).toEqual([true, true, false]);
  });

  it('says not clearly slower when only one of three repeats is', () => {
    const verdict = fallbackVerdict(kit(4, 8, 8), vflow(8, 8, 8), 'smooth');

    expect(verdict.kind).toBe('not-slower');
    expect(verdict.slowerCount).toBe(1);
  });

  it('pairs the repeats by their number, not by their order in the file', () => {
    const verdict = fallbackVerdict(kit(4, 8, 4).reverse(), vflow(8, 8, 8), 'smooth');

    expect(verdict.pairs.map((pair) => [pair.repeat, pair.slower])).toEqual([
      [0, true],
      [1, false],
      [2, true],
    ]);
  });

  it('keeps asking for the third repeat while two of three is still possible', () => {
    // One repeat in, one slower: the other two could still make two of three.
    expect(fallbackVerdict(kit(4), vflow(8), 'smooth').kind).toBe('inconclusive');
    // Two in, one slower and one not: the third decides.
    expect(fallbackVerdict(kit(4, 8), vflow(8, 8), 'smooth').kind).toBe('inconclusive');
  });

  it('decides early where two repeats already settle it', () => {
    expect(fallbackVerdict(kit(4, 4), vflow(8, 8), 'smooth').kind).toBe('slower');
    // Two in, neither slower: at most one of three could be.
    expect(fallbackVerdict(kit(8, 8), vflow(8, 8), 'smooth').kind).toBe('not-slower');
  });

  it('is inconclusive with nothing to compare', () => {
    expect(fallbackVerdict(kit(4), [], 'smooth').kind).toBe('inconclusive');
    expect(fallbackVerdict([], vflow(8), 'smooth').pairs).toEqual([]);
  });

  it('judges the tier it is asked about', () => {
    const climbs = {
      kit: [{ ...climbOf('kit', 0, cap(1)), usable: cap(8) }],
      vflow: [{ ...climbOf('vflow', 0, cap(8)), usable: cap(8) }],
    };

    expect(fallbackVerdict(climbs.kit, climbs.vflow, 'smooth').slowerCount).toBe(1);
    expect(fallbackVerdict(climbs.kit, climbs.vflow, 'usable').slowerCount).toBe(0);
  });

  describe('where vflow meets no level (nothing to compare)', () => {
    const none = (n: number): Climb[] =>
      Array.from({ length: n }, (_, repeat) => climbOf('vflow', repeat, cap(null)));
    const kitNone = (n: number): Climb[] =>
      Array.from({ length: n }, (_, repeat) => climbOf('kit', repeat, cap(null)));

    it('says neither meets the tier, not "not slower", when no repeat compares', () => {
      const verdict = fallbackVerdict(kitNone(3), none(3), 'smooth');

      expect(verdict.kind).toBe('neither');
      expect(verdict.comparableCount).toBe(0);
      expect(verdict.pairs.map((pair) => pair.comparable)).toEqual([false, false, false]);
    });

    it('says not slower, not "neither", where the kit meets a level and vflow none', () => {
      const verdict = fallbackVerdict(kit(1, 1, 1), none(3), 'smooth');

      expect(verdict.kind).toBe('not-slower');
      expect(verdict.comparableCount).toBe(3);
    });

    it('says it for the usable tier too, the smooth tier being met', () => {
      const climbs = {
        kit: [0, 1, 2].map((r) => ({ ...climbOf('kit', r, cap(4)), usable: cap(null) })),
        vflow: [0, 1, 2].map((r) => ({ ...climbOf('vflow', r, cap(4)), usable: cap(null) })),
      };

      expect(fallbackVerdict(climbs.kit, climbs.vflow, 'smooth').kind).toBe('not-slower');
      expect(fallbackVerdict(climbs.kit, climbs.vflow, 'usable').kind).toBe('neither');
    });

    it('decides as soon as too few repeats can still compare: two of three', () => {
      expect(fallbackVerdict(kitNone(2), none(2), 'smooth').kind).toBe('neither');
      // One repeat without a comparison leaves two that could still make two of three.
      expect(fallbackVerdict(kitNone(1), none(1), 'smooth').kind).toBe('inconclusive');
    });

    it('keeps "not slower" while two of three repeats compare and the kit is not slower', () => {
      const verdict = fallbackVerdict(
        [...kit(8, 8), ...kitNone(3).slice(2)],
        [...vflow(8, 8), ...none(3).slice(2)],
        'smooth',
      );

      expect(verdict.kind).toBe('not-slower');
      expect(verdict.comparableCount).toBe(2);
    });

    it('lets two comparable slower repeats stand against one without a comparison', () => {
      const verdict = fallbackVerdict(
        kit(4, 4, 4),
        [...vflow(8, 8), ...none(3).slice(2)],
        'smooth',
      );

      expect(verdict.kind).toBe('slower');
    });

    it('scales the two thirds with more repeats: four of six', () => {
      // Three of six have no comparison: three comparable cannot make four.
      const vflowSix = [...vflow(8, 8, 8), ...none(6).slice(3)];

      const kitSix = [...kit(8, 8, 8), ...kitNone(6).slice(3)];
      expect(fallbackVerdict(kitSix, vflowSix, 'smooth').kind).toBe('neither');
      // Two of six: four comparable can still make four, and the kit is not slower.
      const vflowFour = [...vflow(8, 8, 8, 8), ...none(6).slice(4)];
      const kitFour = [...kit(8, 8, 8, 8), ...kitNone(6).slice(4)];
      expect(fallbackVerdict(kitFour, vflowFour, 'smooth').kind).toBe('not-slower');
    });
  });

  it('marks a pair in which a run failed, and still counts it', () => {
    const verdict = fallbackVerdict(
      [climbOf('kit', 0, cap(1), { failed: true })],
      vflow(8),
      'smooth',
    );

    expect(verdict.pairs[0]).toMatchObject({ slower: true, failed: true });
  });
});

describe('supportingEvidence (kit under 85 % of vflow’s fps, two steps running)', () => {
  const cell = (level: number, median: number) => ({ level, fps: { median } });
  const evidence = (kit: [number, number][], vflow: [number, number][]) =>
    supportingEvidence(
      kit.map(([level, fps]) => cell(level, fps)),
      vflow.map(([level, fps]) => cell(level, fps)),
    );

  it('finds two consecutive steps below 85 %', () => {
    const found = evidence(
      [
        [1, 60],
        [2, 50],
        [4, 40],
      ],
      [
        [1, 60],
        [2, 60],
        [4, 60],
      ],
    );

    expect(found.consecutive).toBe(true);
    expect(found.below.map((row) => row.level)).toEqual([2, 4]);
    expect(found.below[0].ratio).toBeCloseTo(50 / 60, 9);
  });

  it('does not count one step, or two that are not neighbors', () => {
    const lone = evidence(
      [
        [1, 60],
        [2, 50],
        [4, 60],
      ],
      [
        [1, 60],
        [2, 60],
        [4, 60],
      ],
    );
    const apart = evidence(
      [
        [1, 50],
        [2, 60],
        [4, 50],
      ],
      [
        [1, 60],
        [2, 60],
        [4, 60],
      ],
    );

    expect(lone.consecutive).toBe(false);
    expect(apart.consecutive).toBe(false);
    expect(apart.below.map((row) => row.level)).toEqual([1, 4]);
  });

  it('compares only the levels both ran, neighbors among those', () => {
    const found = evidence(
      [
        [1, 50],
        [4, 50],
        [8, 60],
      ],
      [
        [1, 60],
        [2, 60],
        [4, 60],
      ],
    );

    expect(found.compared).toBe(2);
    expect(found.consecutive).toBe(true);
  });

  it('finds nothing where the kit holds 85 % exactly', () => {
    expect(
      evidence(
        [
          [1, 51],
          [2, 51],
        ],
        [
          [1, 60],
          [2, 60],
        ],
      ).below,
    ).toEqual([]);
  });
});
