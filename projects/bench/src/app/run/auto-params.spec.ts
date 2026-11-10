import { assertHostRuns, autoParams } from './auto-params';

describe('autoParams', () => {
  it('is null without `auto=1`: a person opening the page gets the page', () => {
    expect(autoParams('')).toBeNull();
    expect(autoParams('?host=kit&ladder=A')).toBeNull();
    expect(autoParams('?auto=0')).toBeNull();
  });

  it('reads the host, ladder, seed, steps, machine label and refinement', () => {
    expect(
      autoParams('?auto=1&host=vflow&ladder=B&seed=7&steps=3&machine=laptop&refine=1'),
    ).toEqual({
      host: 'vflow',
      ladder: 'B',
      seed: 7,
      steps: 3,
      machine: 'laptop',
      refine: true,
      input: 'page',
      repeat: 0,
    });
  });

  it('defaults to the kit on ladder A, seed 1, every step, no refinement', () => {
    expect(autoParams('?auto=1')).toEqual({
      host: 'kit',
      ladder: 'A',
      seed: 1,
      steps: undefined,
      machine: 'unlabeled',
      refine: false,
      input: 'page',
      repeat: 0,
    });
  });

  it('reads which repeat this is and whether the harness replays the gestures', () => {
    expect(autoParams('?auto=1&repeat=2&input=cdp')).toMatchObject({ repeat: 2, input: 'cdp' });
  });

  it('refuses an input that is not one, and the browser’s input on the host with no zoom box', () => {
    expect(() => autoParams('?auto=1&input=touch')).toThrow(/input is one of page, cdp/);
    expect(() => autoParams('?auto=1&host=none&input=cdp')).toThrow(/none/);
    expect(() => autoParams('?auto=1&repeat=-1')).toThrow(/repeat/);
  });

  it('takes the ladder in either case', () => {
    expect(autoParams('?auto=1&ladder=c')?.ladder).toBe('C');
  });

  it('says vflow-virt is not built yet, without pointing at a plan task', () => {
    expect(() => autoParams('?auto=1&host=vflow-virt')).toThrow(/not built yet/);
    expect(() => autoParams('?auto=1&host=vflow-virt')).not.toThrow(/Task/);
  });

  it('runs ladder E, the soak, on the kit only', () => {
    expect(autoParams('?auto=1&ladder=E&host=kit')?.ladder).toBe('E');
    expect(autoParams('?auto=1&ladder=E')?.host).toBe('kit');
    for (const host of ['vflow', 'none']) {
      expect(() => autoParams(`?auto=1&ladder=E&host=${host}`)).toThrow(
        new RegExp(`ladder E.*kit only.*${host}`),
      );
    }
  });

  it.each([
    ['host=chrome', /host/],
    ['host=vflow-virt', /vflow-virt/],
    ['ladder=Z', /ladder/],
    ['seed=1.5', /seed/],
    ['seed=abc', /seed/],
    ['steps=0', /steps/],
    ['steps=2.5', /steps/],
  ])('refuses %s, saying which parameter', (query, message) => {
    expect(() => autoParams(`?auto=1&${query}`)).toThrow(message);
  });
});

describe('assertHostRuns', () => {
  it('refuses a host the ladder is not for, and lets the others through', () => {
    expect(() => assertHostRuns('E', 'vflow')).toThrow(/kit only/);
    expect(() => assertHostRuns('E', 'kit')).not.toThrow();
    expect(() => assertHostRuns('A', 'none')).not.toThrow();
  });
});
