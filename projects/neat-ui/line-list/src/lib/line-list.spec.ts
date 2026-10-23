import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatInlineButton } from '@sima/neat-ui';
import { NeatLine, NeatLineEnd, NeatLineList } from './line-list';

@Component({
  imports: [NeatLineList, NeatLine, NeatLineEnd, NeatInlineButton],
  template: `
    <ul neatLineList class="host-list">
      <li neatLine>
        Channel 3
        <button neatInlineButton neatLineEnd type="button">Use global</button>
      </li>
      <li neatLine class="host-line">Channel 7</li>
    </ul>
    <ol neatLineList>
      <li neatLine>Inclusion 1</li>
    </ol>
  `,
})
class LineHost {}

async function render() {
  const fixture = TestBed.createComponent(LineHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  return {
    ul: root.querySelector('ul') as HTMLElement,
    ol: root.querySelector('ol') as HTMLElement,
    lines: Array.from(root.querySelectorAll<HTMLElement>('li')),
    end: root.querySelector('[neatLineEnd]') as HTMLElement,
  };
}

const has = (element: HTMLElement, ...names: string[]) =>
  expect([...element.classList]).toEqual(expect.arrayContaining(names));

describe('the ruled line list', () => {
  it('neatLineList is a bare list under a 2px rule on the inline start, inset, in the small text size', async () => {
    const { ul } = await render();

    has(
      ul,
      'm-0',
      'p-0',
      'list-none',
      'ps-(--neat-space-3)',
      'border-s-2',
      'border-border',
      'text-(length:--neat-text-xs)',
    );
  });

  it('works on an ordered list too', async () => {
    const { ul, ol } = await render();

    const own = (element: HTMLElement) =>
      [...element.classList].filter((name) => name !== 'host-list');
    expect(own(ol)).toEqual(own(ul));
  });

  it('neatLine is a flex row with the small gap and a 1.5rem minimum height', async () => {
    const { lines } = await render();

    for (const line of lines) {
      has(line, 'flex', 'items-center', 'gap-(--neat-space-2)', 'min-h-6');
    }
  });

  it('neatLineEnd pushes its element to the end of the line', async () => {
    const { end } = await render();

    has(end, 'ms-auto');
  });

  it('keeps the classes an app sets on the same elements', async () => {
    const { ul, lines } = await render();

    has(ul, 'host-list', 'list-none');
    has(lines[1], 'host-line', 'flex');
  });

  it('leaves an inline button inside a line with its own classes', async () => {
    const { end } = await render();

    has(end, 'ms-auto', 'font-medium', 'hover:underline');
  });
});
