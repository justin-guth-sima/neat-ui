import { analyzeCampaign } from './analysis';
import { parseCampaign } from './result-file';
import { campaign, climb } from './results.testing';
import { summaryMarkdown } from './summary';

const file = (value: unknown): string => JSON.stringify(value);

/** `value` without the named fields, as a file of another harness would leave them out. */
const without = (value: object, ...keys: string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

describe('parseCampaign', () => {
  it('reads what the harness writes', () => {
    const written = campaign(climb('kit', 0, ['smooth', 'usable']));

    const parsed = parseCampaign(file(written));

    expect(parsed).toEqual({ ok: true, campaign: written });
  });

  it('says no page load finished for a campaign of failed runs, as the harness writes it', () => {
    // `merge.mjs` takes the machine from the first run that finished: here only the label is left.
    const written = {
      ...campaign([]),
      machine: { label: 'rig', gpu: {}, launchArgs: [] },
      measurement: null,
      notComparable: [],
      warnings: ['kit A r0 failed: the page crashed'],
      runs: [{ ladder: 'A', renderer: 'kit', repeat: 0, status: 'failed', error: 'crashed' }],
    };

    const parsed = parseCampaign(file(written));

    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? '' : parsed.error).toMatch(/no page load.*finished/);
    expect(parsed.ok ? '' : parsed.error).toContain('the page crashed');
  });

  it('fills in the lists a file may leave out, which then say there is nothing to report', () => {
    const bare = without(campaign(climb('kit', 0, ['smooth'])), 'warnings', 'notComparable');

    const parsed = parseCampaign(file(bare));

    expect(parsed.ok ? [parsed.campaign.warnings, parsed.campaign.notComparable] : null).toEqual([
      [],
      [],
    ]);
  });

  it('reads a hand-trimmed file, and everything it reads can be laid out', () => {
    // Only what the page cannot do without: no runs, harness, measurement, fairness or screenshot.
    const full = campaign([
      ...climb('kit', 0, ['smooth', 'usable']),
      ...climb('vflow', 0, ['smooth', 'smooth']),
    ]);
    const trimmed = without(full, 'runs', 'harness', 'fairness', 'measurement');

    const parsed = parseCampaign(file(trimmed));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const analysis = analyzeCampaign(parsed.campaign);
    expect(summaryMarkdown(parsed.campaign, analysis)).toContain('## Capacity');
  });

  it.each([
    ['text that is not JSON', 'not json at all', /not JSON/],
    ['JSON that is not an object', '[1, 2]', /not a bench result/],
    ['a result of another schema', file({ ...campaign([]), schema: 2 }), /schema 2/],
    ['a result without steps', file({ ...campaign([]), steps: undefined }), /steps/],
    ['a result without a machine', file({ ...campaign([]), machine: undefined }), /machine/],
    [
      'a result whose refresh rate is no number',
      file({ ...campaign([]), machine: { ...campaign([]).machine, refreshHz: 'fast' } }),
      /refreshHz/,
    ],
    [
      'a step without phases',
      file(campaign([{ ...climb('kit', 0, ['smooth'])[0], phases: undefined } as never])),
      /step 0.*phases/,
    ],
    ['a result without a start time', file({ ...campaign([]), startedAt: undefined }), /startedAt/],
    ['a result without bench information', file({ ...campaign([]), bench: undefined }), /bench/],
    ['a result without a config', file({ ...campaign([]), config: undefined }), /config/],
    [
      'a machine without a viewport',
      file({ ...campaign([]), machine: { ...campaign([]).machine, viewport: undefined } }),
      /viewport/,
    ],
    [
      'a refresh rate of zero, which would judge every step against an interval of infinity',
      file({ ...campaign([]), machine: { ...campaign([]).machine, refreshHz: 0 } }),
      /refreshHz is 0/,
    ],
    [
      'a measurement with nothing in it',
      file({ ...campaign([]), measurement: {} }),
      /measurement has no refresh/,
    ],
    [
      'a phase that is null',
      file(
        campaign([
          { ...climb('kit', 0, ['smooth'])[0], phases: { idle: null, pan: null } } as never,
        ]),
      ),
      /step 0, phase idle is not an object/,
    ],
    [
      'a phase without a p95',
      file(
        campaign([
          {
            ...climb('kit', 0, ['smooth'])[0],
            phases: { idle: { ...climb('kit', 0, ['smooth'])[0].phases['idle'], p95: undefined } },
          } as never,
        ]),
      ),
      /step 0, phase idle has no p95/,
    ],
    [
      'a phase whose fps was written as null',
      file(
        campaign([
          {
            ...climb('kit', 0, ['smooth'])[0],
            phases: { idle: { ...climb('kit', 0, ['smooth'])[0].phases['idle'], fps: null } },
          } as never,
        ]),
      ),
      /phase idle has no fps|fps is not a number/,
    ],
    [
      'a recorder check without its figures',
      file(
        campaign([], {
          runs: [
            {
              ladder: 'A',
              renderer: 'kit',
              repeat: 0,
              status: 'ok',
              recorderCheck: { ok: true },
            } as never,
          ],
        }),
      ),
      /run 0: recorderCheck has no tolerance/,
    ],
    [
      'warnings that are no list',
      file({ ...campaign([]), warnings: 'none' }),
      /warnings is not an array/,
    ],
    [
      'a step without a level',
      file(campaign([{ ...climb('kit', 0, ['smooth'])[0], level: 'big' } as never])),
      /step 0.*level/,
    ],
  ])('refuses %s, saying what is wrong', (_, text, message) => {
    const parsed = parseCampaign(text);

    expect(parsed.ok).toBe(false);
    expect(parsed.ok ? '' : parsed.error).toMatch(message);
  });
});
