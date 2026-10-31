import { parseCampaign } from './result-file';
import { campaign, climb } from './results.testing';

const file = (value: unknown): string => JSON.stringify(value);

describe('parseCampaign', () => {
  it('reads what the harness writes', () => {
    const written = campaign(climb('kit', 0, ['smooth', 'usable']));

    const parsed = parseCampaign(file(written));

    expect(parsed).toEqual({ ok: true, campaign: written });
  });

  it('reads a campaign whose runs all failed, which has no measurement to give', () => {
    const written = { ...campaign([]), measurement: null, notComparable: [] };

    const parsed = parseCampaign(file(written));

    expect(parsed.ok).toBe(true);
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
