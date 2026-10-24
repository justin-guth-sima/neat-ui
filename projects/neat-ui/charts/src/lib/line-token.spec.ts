import { lineToken } from './line-token';

describe('lineToken', () => {
  it('maps each tone to its line token, the one place the charts do', () => {
    expect(lineToken('default')).toBe('var(--neat-line)');
    expect(lineToken('warning')).toBe('var(--neat-line-warning)');
    expect(lineToken('danger')).toBe('var(--neat-line-danger)');
  });
});
