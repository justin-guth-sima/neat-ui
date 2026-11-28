import { InteractivityChecker } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { tabbablesIn } from './overlay-focus';

describe('tabbablesIn', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    root.innerHTML = `
      <a href="/a">A</a>
      <button type="button">B</button>
      <button type="button" disabled>Disabled</button>
      <a href="/c">C</a>
    `;
    document.body.append(root);
  });

  afterEach(() => root.remove());

  const names = (): (string | undefined)[] =>
    tabbablesIn(document, TestBed.inject(InteractivityChecker), root).map((element) =>
      element.textContent?.trim(),
    );

  it('finds the tabbable elements in document order, less the disabled ones', () => {
    expect(names()).toEqual(['A', 'B', 'C']);
  });

  it('leaves out an element the browser does not draw, which Tab skips', () => {
    // `display: none` on it or an ancestor, which jsdom does not compute: the browser's own
    // answer, `checkVisibility()`, stands for it.
    const hidden = root.querySelector('button') as HTMLElement;
    Object.defineProperty(hidden, 'checkVisibility', { value: () => false });

    expect(names()).toEqual(['A', 'C']);
  });
});
