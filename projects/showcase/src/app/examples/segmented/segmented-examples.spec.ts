import { TestBed } from '@angular/core/testing';
import { Choices } from './1-choices.example';
import { InACrowdedRow } from './2-in-a-crowded-row.example';
import { InANarrowPanel } from './3-in-a-narrow-panel.example';

/** An option's label as it is drawn: the second copy, which reserves width, is not the name. */
const labelOf = (radio: Element) => radio.querySelector('[title]')?.textContent?.trim();

const radios = (group: Element) =>
  Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));

describe('the segmented examples', () => {
  it('move a choice with the arrow keys, share nothing between groups, and disable one', async () => {
    const fixture = TestBed.createComponent(Choices);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const group = (name: string) =>
      host.querySelector(`[role="radiogroup"][aria-label="${name}"]`)!;
    const status = () => host.querySelector('.showcase-code')?.textContent?.trim();

    expect(status()).toBe('Shape 16:9, overlays boxes');

    radios(group('Tile shape'))[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    await fixture.whenStable();

    expect(status()).toBe('Shape 1:1, overlays boxes');
    expect(radios(group('Overlays')).map((radio) => labelOf(radio))).toEqual([
      'Off',
      'Boxes',
      'Masks',
    ]);
    expect(
      radios(group('Tile shape, disabled')).every((radio) => radio.hasAttribute('disabled')),
    ).toBe(true);
  });

  it('put the focus on the checked option of the tile shape from the button', async () => {
    const fixture = TestBed.createComponent(Choices);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const button = Array.from(host.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Focus the tile shape',
    )!;

    button.click();

    expect(document.activeElement).toBe(radios(host.querySelector('neat-segmented')!)[0]);
  });

  it('keep both labels whole in a crowded row, beside the title that gives way', async () => {
    const fixture = TestBed.createComponent(InACrowdedRow);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(radios(host).map((radio) => labelOf(radio))).toEqual(['Live', 'Runs']);
    expect(host.querySelector('.crowded')?.textContent).toContain('Stats for a stream');
  });

  it('give the narrow panel three options, the long label with its full text as a title', async () => {
    const fixture = TestBed.createComponent(InANarrowPanel);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(radios(host)).toHaveLength(3);
    expect(radios(host)[2].querySelector('[title]')?.getAttribute('title')).toBe('Stream URL');
    expect(radios(host)[2].getAttribute('aria-checked')).toBe('true');
  });
});
