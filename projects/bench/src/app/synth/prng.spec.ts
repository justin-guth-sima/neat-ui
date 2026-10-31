import { mulberry32, randomInt, shuffled } from './prng';

describe('mulberry32', () => {
  it('gives the reference implementation’s sequence, so every machine draws the same', () => {
    // From bryc's published mulberry32, which the bench's runs must match bit for bit.
    const one = mulberry32(1);
    expect([one(), one(), one()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
    const answer = mulberry32(42);
    expect([answer(), answer(), answer()]).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    ]);
  });

  it('repeats a sequence for a seed and gives another for another seed', () => {
    const draw = (seed: number): number[] => {
      const rand = mulberry32(seed);
      return Array.from({ length: 100 }, () => rand());
    };

    expect(draw(7)).toEqual(draw(7));
    expect(draw(7)).not.toEqual(draw(8));
  });

  it('draws in [0, 1)', () => {
    const rand = mulberry32(3);
    for (let i = 0; i < 10_000; i++) {
      const value = rand();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('refuses a seed that is not a 32-bit unsigned integer, which it would change silently', () => {
    for (const seed of [0.5, -1, 2 ** 32, Number.NaN]) {
      expect(() => mulberry32(seed)).toThrow(RangeError);
    }
  });
});

describe('randomInt', () => {
  it('draws every integer from min to max, both included, and nothing else', () => {
    const rand = mulberry32(5);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(randomInt(rand, 2, 5));

    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('gives min when the range is one number', () => {
    expect(randomInt(mulberry32(5), 4, 4)).toBe(4);
  });
});

describe('shuffled', () => {
  it('returns a seeded permutation and leaves the input as it was', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);

    const once = shuffled(mulberry32(9), items);

    expect(once).toEqual(shuffled(mulberry32(9), items));
    expect(once).not.toEqual(items);
    expect([...once].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
});
