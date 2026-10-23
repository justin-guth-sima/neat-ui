import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatNumberField } from './number-field';

@Component({
  imports: [NeatNumberField],
  template: `
    <neat-number-field
      label="Page"
      [value]="value()"
      [accept]="accept()"
      (commit)="commits.push($event)"
    >
      <span neatNumberFieldSuffix>of 9</span>
    </neat-number-field>
  `,
})
class FieldHost {
  readonly value = signal(3);
  readonly accept = signal<(n: number) => boolean>(() => true);
  readonly commits: number[] = [];
}

@Component({
  imports: [NeatNumberField],
  template: `<neat-number-field label="Draw on channel" [value]="2" />`,
})
class PlainHost {}

async function render(setup: (host: FieldHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(FieldHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const input = root.querySelector('input') as HTMLInputElement;
  return { fixture, host: fixture.componentInstance, root, input };
}

/** The user types `text` into the field. */
function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const enter = (input: HTMLInputElement) =>
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
const blur = (input: HTMLInputElement) => input.dispatchEvent(new FocusEvent('blur'));

describe('NeatNumberField', () => {
  it('names its input by its label and shows the value', async () => {
    const { input } = await render();

    expect(input.getAttribute('aria-label')).toBe('Page');
    // Wrapped by its label, so a click on the label text focuses the field.
    expect(input.labels?.length).toBe(1);
    expect(input.value).toBe('3');
  });

  it('shows the label before the input and projects the suffix after it', async () => {
    const { root } = await render();

    const text = root.textContent?.replace(/\s+/g, ' ').trim();
    expect(text).toBe('Page of 9');
    const input = root.querySelector('input') as HTMLElement;
    const suffix = root.querySelector('[neatNumberFieldSuffix]') as HTMLElement;
    expect(input.compareDocumentPosition(suffix) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no suffix slot content to show when none is given', async () => {
    const fixture = TestBed.createComponent(PlainHost);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent.trim()).toBe('Draw on channel');
  });

  it('is a small numeric kit input', async () => {
    const { input } = await render();

    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.dataset['slot']).toBe('input');
    expect(input.classList).toContain('h-8');
  });

  it('commits an accepted whole number on Enter', async () => {
    const { input, host } = await render();

    type(input, '7');
    enter(input);

    expect(host.commits).toEqual([7]);
  });

  it('commits an accepted whole number on blur', async () => {
    const { input, host } = await render();

    type(input, ' 5 ');
    blur(input);

    expect(host.commits).toEqual([5]);
  });

  it('commits a number equal to the current value, so the owner can pin a choice it already shows', async () => {
    const { input, host } = await render();

    type(input, '3');
    enter(input);

    expect(host.commits).toEqual([3]);
  });

  it('commits once for Enter followed by the blur that comes with leaving the field', async () => {
    const { input, host } = await render();

    type(input, '4');
    enter(input);
    blur(input);

    expect(host.commits).toEqual([4]);
  });

  it('shows the number as the owner will read it', async () => {
    const { input } = await render();

    type(input, '007');
    enter(input);

    expect(input.value).toBe('7');
  });

  it.each(['4x', '', '   ', '-1', '1.5', '1e3', '99999999999999999999'])(
    'puts the value back for %j and commits nothing',
    async (text) => {
      const { input, host } = await render();

      type(input, text);
      enter(input);
      expect(input.value).toBe('3');

      type(input, text);
      blur(input);
      expect(input.value).toBe('3');

      expect(host.commits).toEqual([]);
    },
  );

  it('puts the value back for a number accept() refuses, and passes accept the number', async () => {
    const asked: number[] = [];
    const { input, host } = await render((h) =>
      h.accept.set((n) => {
        asked.push(n);
        return n >= 1 && n <= 9;
      }),
    );

    type(input, '12');
    enter(input);
    expect(input.value).toBe('3');
    type(input, '0');
    blur(input);
    expect(input.value).toBe('3');
    type(input, '9');
    enter(input);

    expect(asked).toEqual([12, 0, 9]);
    expect(host.commits).toEqual([9]);
  });

  it('does not commit on blur when nothing was typed, so tabbing through pins nothing', async () => {
    const { input, host } = await render();

    blur(input);

    expect(host.commits).toEqual([]);
  });

  it('commits the shown value on Enter without typing', async () => {
    const { input, host } = await render();

    enter(input);

    expect(host.commits).toEqual([3]);
  });

  it('follows the value, dropping what was typed but not committed', async () => {
    const { fixture, host, input } = await render();

    type(input, '8');
    host.value.set(5);
    await fixture.whenStable();
    expect(input.value).toBe('5');
    blur(input);

    expect(host.commits).toEqual([]);
  });
});
