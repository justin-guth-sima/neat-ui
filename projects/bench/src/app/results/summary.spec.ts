import { analyseCampaign } from './analysis';
import { campaign, climb, phase, step, withPhases } from './results.testing';
import { summaryMarkdown } from './summary';

/** The kit a step short of vflow's capacity in all three repeats, the way a slow renderer looks. */
function slowKit() {
  return campaign(
    [
      ...[0, 1, 2].flatMap((repeat) => climb('kit', repeat, ['smooth', 'usable', 'failing'])),
      ...[0, 1, 2].flatMap((repeat) =>
        climb('vflow', repeat, ['smooth', 'smooth', 'smooth', 'usable', 'failing']),
      ),
    ],
    {
      warnings: ['kit A r0: the CPU fell from 4800 MHz to 3600 MHz', 'a | pipe, in a warning'],
      notComparable: ['Hover dimming exists only in the kit.', 'Labels differ in z-order.'],
    },
  );
}

const markdown = (file = slowKit()) => summaryMarkdown(file, analyseCampaign(file));

describe('summaryMarkdown', () => {
  it('heads the page with the machine and the day of the run', () => {
    expect(markdown().split('\n')[0]).toBe('# Rendering bench: rig, 2026-10-31');
  });

  it('says how the machine and the build were set up', () => {
    const text = markdown();

    expect(text).toContain('Chromium 156');
    expect(text).toContain('8 cores');
    expect(text).toContain('1920×1080 at DPR 1');
    expect(text).toContain('60 Hz');
    expect(text).toContain('production build');
    expect(text).toContain('a1b2c3d');
    expect(text).toContain('kit 0.23.0');
    expect(text).toContain('ngx-vflow 2.7.0');
    expect(text).toContain('headed');
    expect(text).toContain('3 repeats');
    expect(text).toContain('in-page gestures');
  });

  it('tables each ladder’s capacity per renderer in both tiers', () => {
    const text = markdown();

    expect(text).toContain('## Capacity');
    expect(text).toContain('| Ladder | Renderer | Smooth | Usable |');
    expect(text).toMatch(/\| A: diagram size \| kit \| ×1 \(30 blocks\) \| ×2 \(60 blocks\) \|/);
    expect(text).toMatch(
      /\| A: diagram size \| vflow \| ×4 \(120 blocks\) \| ×8 \(240 blocks\) \|/,
    );
  });

  it('says where the repeats did not agree on a capacity', () => {
    const file = campaign([
      ...climb('kit', 0, ['smooth', 'smooth', 'failing']),
      ...climb('kit', 1, ['smooth', 'failing']),
      ...climb('kit', 2, ['smooth', 'smooth', 'failing']),
    ]);

    expect(markdown(file)).toMatch(/×2 \(60 blocks\) \(×1 to ×2\)/);
  });

  it('writes a capacity of a climb that never failed as at least, and none as none', () => {
    const file = campaign([
      ...climb('kit', 0, ['smooth', 'smooth']),
      ...climb('vflow', 0, ['usable', 'usable']),
    ]);

    const text = markdown(file);

    expect(text).toMatch(/\| kit \| at least ×2 \(60 blocks\) \| at least ×2 \(60 blocks\) \|/);
    expect(text).toMatch(/\| vflow \| none \| at least ×2 \(60 blocks\) \|/);
  });

  it('states the fallback rule and each ladder’s verdict', () => {
    const text = markdown();

    expect(text).toContain('## Fallback verdict: the kit against vflow');
    expect(text).toContain('at least one doubling step below');
    expect(text).toContain('2 of 3 repeats');
    expect(text).toMatch(/\| A: diagram size \| Clearly slower \| 3 of 3 \|/);
  });

  it('says a ladder where the kit is not slower is not', () => {
    const file = campaign([
      ...[0, 1, 2].flatMap((repeat) => climb('kit', repeat, ['smooth', 'smooth', 'failing'])),
      ...[0, 1, 2].flatMap((repeat) => climb('vflow', repeat, ['smooth', 'smooth', 'failing'])),
    ]);

    expect(markdown(file)).toMatch(/\| A: diagram size \| Not clearly slower \| 0 of 3 \|/);
  });

  it('says a verdict that waits for more repeats', () => {
    const file = campaign([
      ...climb('kit', 0, ['smooth', 'failing']),
      ...climb('vflow', 0, ['smooth', 'smooth', 'failing']),
    ]);

    expect(markdown(file)).toMatch(
      /\| A: diagram size \| Inconclusive \(1 of 3 repeats run\) \| 1 of 1 \|/,
    );
  });

  it('lists the warnings and the not-comparable notes', () => {
    const text = markdown();

    expect(text).toContain('## Warnings');
    expect(text).toContain('- kit A r0: the CPU fell from 4800 MHz to 3600 MHz');
    expect(text).toContain('## Not comparable');
    expect(text).toContain('- Hover dimming exists only in the kit.');
    expect(text).toContain('- Labels differ in z-order.');
  });

  it('keeps a pipe in a name from ending its table cell', () => {
    const file = campaign(climb('kit', 0, ['smooth'], { ladder: 'X|Y' }));

    expect(markdown(file)).toContain('| X\\|Y: ladder | kit |');
  });

  it('leaves out the warnings section where there are none', () => {
    const text = markdown(campaign(climb('kit', 0, ['smooth']), { warnings: [] }));

    expect(text).not.toContain('## Warnings');
  });

  it('says how the numbers were taken', () => {
    const text = markdown();

    expect(text).toContain('## How the numbers were taken');
    expect(text).toContain('Long animation frames limits.');
    expect(text).toContain('buildMs runs from the input change to the first frame.');
  });

  it('says what each traced run’s recorder check found, and where it was not made', () => {
    const file = campaign(climb('kit', 0, ['smooth']), {
      runs: [
        {
          ladder: 'A',
          renderer: 'kit',
          repeat: 0,
          status: 'ok',
          purpose: 'trace',
          recorderCheck: { ok: true, tolerance: 0.03, compared: 12, worstPct: -1.4 },
        },
        {
          ladder: 'A',
          renderer: 'vflow',
          repeat: 0,
          status: 'ok',
          purpose: 'trace',
          recorderCheck: { ok: false, tolerance: 0.03, compared: 12, worstPct: -30.2 },
        },
        {
          ladder: 'A',
          renderer: 'none',
          repeat: 0,
          status: 'ok',
          purpose: 'trace',
          recorderCheck: {
            ok: null,
            tolerance: 0.03,
            compared: 0,
            worstPct: 0,
            skipped: 'the none host draws nothing the gestures move',
          },
        },
      ],
    });

    const text = markdown(file);

    expect(text).toContain(
      '- Recorder against trace, kit A r0: within 3 % over 12 phases (worst -1.4 %).',
    );
    expect(text).toContain(
      '- Recorder against trace, vflow A r0: outside 3 % over 12 phases (worst -30.2 %).',
    );
    expect(text).toContain(
      '- Recorder against trace, none A r0: not checked (the none host draws nothing',
    );
  });

  it('says no run was traced, so the recorder’s rate alone decided every tier', () => {
    expect(markdown()).toContain('No run was traced');
  });

  it('says the traces gave no presented rate, where they were taken and showed none', () => {
    const file = campaign(climb('kit', 0, ['smooth']), {
      runs: [{ ladder: 'A', renderer: 'kit', repeat: 0, status: 'ok', purpose: 'trace' }],
    });

    expect(markdown(file)).toContain('gave no presented rate');
  });

  it('says which value decided: where the presented rate set a tier, and where it set none', () => {
    const traced = (presentedFps: number) =>
      campaign(
        [
          ...climb('kit', 0, ['smooth', 'smooth']).map((s) =>
            s.level === 2 ? withPhases(s, { pan: phase('smooth', { presentedFps }) }) : s,
          ),
        ],
        {
          runs: [{ ladder: 'A', renderer: 'kit', repeat: 0, status: 'ok', purpose: 'trace' }],
        },
      );

    const decided = markdown(traced(50));
    const agreed = markdown(traced(59.8));

    expect(decided).toContain('lower of the recorder’s rate and the display’s presented rate');
    expect(decided).toContain('decided the tier of: kit on ladder A at ×2');
    expect(agreed).toContain('lower of the recorder’s rate and the display’s presented rate');
    expect(agreed).toContain('decided no tier');
  });

  it('says which levels the recorder alone decided, where a traced one has no rate', () => {
    const rated = (presentedFps: number) =>
      climb('kit', 0, ['smooth', 'smooth', 'smooth']).map((s) =>
        s.level < 4
          ? withPhases(s, {
              pan: phase('smooth', { presentedFps }),
              zoom: phase('smooth', { presentedFps }),
            })
          : s,
      );
    const traced = {
      runs: [{ ladder: 'A', renderer: 'kit', repeat: 0, status: 'ok', purpose: 'trace' }],
    };

    const text = markdown(campaign(rated(59.9), traced as never));

    expect(text).toContain('The recorder’s rate alone decided: kit on ladder A at ×4');
    expect(text).toContain('no presented rate');
  });

  it('does not list levels for the recorder where every level has a presented rate', () => {
    const file = campaign(
      climb('kit', 0, ['smooth', 'smooth']).map((s) =>
        withPhases(s, {
          pan: phase('smooth', { presentedFps: 59.9 }),
          zoom: phase('smooth', { presentedFps: 59.9 }),
        }),
      ),
    );

    expect(markdown(file)).not.toContain('alone decided:');
  });

  it('says what a soak did over its phases, the heap with the frame rate', () => {
    const phases = Object.fromEntries(
      [13.1, 13.3, 13.2].map((mb, i) => [
        `soak-${i + 1}`,
        phase('smooth', { cdp: { heapBytes: mb * 1e6 } as never }),
      ]),
    );
    const file = campaign([step('smooth', 1, { ladder: 'E', phases })], {
      config: { ...campaign([]).config, ladders: ['E'], renderers: ['kit'] },
    });

    const text = markdown(file);

    expect(text).toContain('## Soak');
    expect(text).toMatch(/3 phases.*frame rate held.*heap held.*13\.1 MB.*13\.2 MB/);
  });

  it('says the heap grew where a soak’s heap did', () => {
    const phases = Object.fromEntries(
      [13, 15, 17, 19].map((mb, i) => [
        `soak-${i + 1}`,
        phase('smooth', { cdp: { heapBytes: mb * 1e6 } as never }),
      ]),
    );
    const file = campaign([step('smooth', 1, { ladder: 'E', phases })]);

    expect(markdown(file)).toMatch(/heap grew from 13\.0 MB to 19\.0 MB/);
  });

  it('says a heap that ended lower or moved without a trend did not grow', () => {
    const soak = (heaps: number[]) => {
      const phases = Object.fromEntries(
        heaps.map((mb, i) => [
          `soak-${i + 1}`,
          phase('smooth', { cdp: { heapBytes: mb * 1e6 } as never }),
        ]),
      );
      return markdown(campaign([step('smooth', 1, { ladder: 'E', phases })]));
    };

    const fell = soak([9.3, 8, 7, 6.1]);
    const varied = soak([9, 13, 8.5, 9.2]);

    expect(fell).toMatch(/heap ended lower.*9\.3 MB.*6\.1 MB/);
    expect(fell).not.toContain('grew');
    expect(varied).toMatch(/heap moved without a trend.*9\.0 MB.*9\.2 MB/);
    expect(varied).not.toContain('grew');
  });

  it('gives the levels of the 85 % rows in words and counts one step as one', () => {
    const file = campaign([
      ...climb('kit', 0, ['smooth', 'usable', 'smooth']),
      ...climb('vflow', 0, ['smooth', 'smooth', 'smooth']),
    ]);

    expect(markdown(file)).toContain('at 1 step, not consecutive');
    expect(markdown()).toContain('in consecutive steps (×2, ×4)');
  });

  it('says a trace showed no display draw where the check could not read it', () => {
    const file = campaign(climb('kit', 0, ['smooth']), {
      runs: [
        {
          ladder: 'A',
          renderer: 'kit',
          repeat: 0,
          status: 'ok',
          purpose: 'trace',
          recorderCheck: { ok: true, tolerance: 0.03, compared: 10, worstPct: -1, unreadable: 2 },
        },
      ],
    });

    expect(markdown(file)).toContain('Trace unreadable for 2 phases');
  });

  it('warns first that a campaign that did not finish is not the whole of it', () => {
    const file = campaign(climb('kit', 0, ['smooth']), {
      harness: { ...campaign([]).harness!, complete: false },
    });

    expect(markdown(file)).toContain('This campaign did not finish');
  });
});
