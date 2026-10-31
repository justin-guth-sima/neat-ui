import { autoParams } from './auto-params';

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
    });
  });

  it('defaults to the kit on ladder A, seed 1, every step, no refinement', () => {
    expect(autoParams('?auto=1')).toEqual({
      host: 'kit',
      ladder: 'A',
      seed: 1,
      steps: undefined,
      machine: 'unlabelled',
      refine: false,
    });
  });

  it('takes the ladder in either case', () => {
    expect(autoParams('?auto=1&ladder=c')?.ladder).toBe('C');
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
