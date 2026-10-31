import { describe, expect, it } from 'vitest';
import { BUILT_FROM } from './build-info';

describe('build-info', () => {
  it('says unknown where the bundle was not made by `npm run bench:build`', () => {
    // No `--define` here (the unit tests run unbundled), as in `ng serve`.
    expect(BUILT_FROM).toBe('unknown');
  });
});
