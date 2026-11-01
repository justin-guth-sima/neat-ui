/*
 * The bench's one source of randomness. Runs on the board, a laptop and another day must put the
 * same load on the renderer, so every draw comes from a seed. mulberry32 uses only 32-bit integer
 * arithmetic (`Math.imul`, shifts), which every JavaScript engine computes the same: never mix in
 * `Math.random`, and never `Math.sin`, `exp` or `log`, whose precision the language leaves to the
 * engine. A spec pins what each stream draws (the diagram's and the messages'); re-pinning one
 * means results from before no longer compare with those after.
 */

/** Draws numbers in [0, 1). */
export type Prng = () => number;

/** bryc's mulberry32: a fast, small generator, plenty for shaping a load. */
export function mulberry32(seed: number): Prng {
  if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) {
    throw new RangeError(`a seed is a 32-bit unsigned integer, not ${seed}`);
  }
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An integer from `min` to `max`, both included. */
export function randomInt(rand: Prng, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/** `items` in a seeded order (Fisher–Yates), as a new array. */
export function shuffled<T>(rand: Prng, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(rand, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
