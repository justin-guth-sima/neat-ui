import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatInlineButton } from '../button/inline-button';
import { NeatNote } from './note';

@Component({
  imports: [NeatNote, NeatInlineButton],
  template: `
    <p neatNote class="host-class">
      Overridden on 2 channels ·
      <button neatInlineButton type="button">Show</button>
    </p>
    <span neatNote>On any element</span>
  `,
})
class NoteHost {}

async function render() {
  const fixture = TestBed.createComponent(NoteHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  return {
    paragraph: root.querySelector('p') as HTMLElement,
    span: root.querySelector('span') as HTMLElement,
    button: root.querySelector('button') as HTMLButtonElement,
  };
}

describe('NeatNote', () => {
  it('is margin-free, in the muted text colour and the small text size', async () => {
    const { paragraph } = await render();

    expect([...paragraph.classList]).toEqual(
      expect.arrayContaining(['m-0', 'text-muted-foreground', 'text-(length:--neat-text-xs)']),
    );
  });

  it('keeps classes the host sets alongside its own', async () => {
    const { paragraph } = await render();

    expect([...paragraph.classList]).toEqual(
      expect.arrayContaining(['host-class', 'text-muted-foreground']),
    );
  });

  it('works on any element, not only a paragraph', async () => {
    const { paragraph, span } = await render();

    const own = (element: HTMLElement) =>
      [...element.classList].filter((name) => name !== 'host-class');
    expect(own(span)).toEqual(own(paragraph));
  });

  it('leaves the colour and size to an inline button inside, which inherits them', async () => {
    const { button } = await render();

    expect([...button.classList]).toEqual(
      expect.arrayContaining(['text-inherit', 'text-[length:inherit]']),
    );
  });
});
