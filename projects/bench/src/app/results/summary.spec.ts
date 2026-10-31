import { analyseCampaign } from './analysis';
import { campaign, climb } from './results.testing';
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

  it('warns first that a campaign that did not finish is not the whole of it', () => {
    const file = campaign(climb('kit', 0, ['smooth']), {
      harness: { ...campaign([]).harness!, complete: false },
    });

    expect(markdown(file)).toContain('This campaign did not finish');
  });
});
