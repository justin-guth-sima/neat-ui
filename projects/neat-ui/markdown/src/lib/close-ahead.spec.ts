import { closeAhead } from './close-ahead';

describe('closeAhead', () => {
  it.each([
    ['closes bold', '**bo', '**bo**'],
    ['closes emphasis with a star', 'an *em', 'an *em*'],
    ['closes emphasis with an underscore', 'an _em', 'an _em_'],
    ['closes bold inside emphasis in the right order', '**bold *both', '**bold *both***'],
    ['closes a code span with as many backticks', 'run ``a `b', 'run ``a `b``'],
    ['closes an open fence on a new line', '```py\nx = 1', '```py\nx = 1\n```'],
    ['closes an open tilde fence with its own fence', '~~~~\nx', '~~~~\nx\n~~~~'],
    ['shows a link whose address is incomplete as its text', 'see [docs](https://exa', 'see docs'],
    ['leaves an unclosed link text as it is', 'see [docs', 'see [docs'],
    ['drops a lone trailing star', 'trailing *', 'trailing'],
    ['drops a lone trailing double star', 'trailing **', 'trailing'],
    ['drops a lone trailing underscore', 'trailing _', 'trailing'],
    ['drops a lone trailing backtick', 'trailing `', 'trailing'],
    ['closes after the last word, not after trailing spaces', '**bold ', '**bold**'],
  ])('%s', (_name, tail, closed) => {
    expect(closeAhead(tail)).toBe(closed);
  });

  it.each([
    [
      'closes a fence inside a list item at its indentation',
      '1. Run:\n\n   ```bash\n   ls -la',
      '1. Run:\n\n   ```bash\n   ls -la\n   ```',
    ],
    ['closes a fence inside a quote', '> ```\n> code', '> ```\n> code\n> ```'],
    [
      'leaves marks inside a fence in a list item alone',
      '- step\n\n  ```\n  **x',
      '- step\n\n  ```\n  **x\n  ```',
    ],
    ['keeps a fence its language only once the line is complete', '```pyth', '```'],
    [
      'keeps a nested fence its language only once the line is complete',
      '1. a\n\n   ```py',
      '1. a\n\n   ```',
    ],
    [
      'closes marks after a fence that closed',
      '- a\n  ```\n  x\n  ```\n  **b',
      '- a\n  ```\n  x\n  ```\n  **b**',
    ],
    [
      'closes marks only in the last paragraph',
      '2 ** 3 is 8\n\nAnd **bold',
      '2 ** 3 is 8\n\nAnd **bold**',
    ],
  ])('%s', (_name, tail, closed) => {
    expect(closeAhead(tail)).toBe(closed);
  });

  it('leaves balanced Markdown alone', () => {
    for (const text of [
      '**a** and *b* and `c`',
      'a [link](https://sima.ai) here',
      '```\ncode\n```',
      '- a list\n- of items',
      '* a star list',
      'snake_case and file_name.py',
      '2 * 3 = 6',
    ]) {
      expect(closeAhead(text), text).toBe(text);
    }
  });

  it('does not touch marks inside a closed code span', () => {
    expect(closeAhead('a `**x` b')).toBe('a `**x` b');
    expect(closeAhead('a `_x` and **b')).toBe('a `_x` and **b**');
  });

  it('does not touch marks inside an open fence', () => {
    expect(closeAhead('```\n**x _y')).toBe('```\n**x _y\n```');
  });

  it('skips escaped marks', () => {
    expect(closeAhead('a \\*b')).toBe('a \\*b');
  });
});
