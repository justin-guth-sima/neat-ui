import { INPUT_CLASSES, INPUT_FRAME_CLASSES, INPUT_IN_FRAME_CLASSES } from './input-classes';

const classes = (list: string) => list.split(/\s+/).filter(Boolean);

/**
 * The small field's classes that style its text and content, not its box: the input inside a
 * frame keeps these, the frame takes the rest. The invalid look (`data-[matches-spartan-invalid]`)
 * stays the input's: the frame draws no invalid state.
 */
const inputOnly = (name: string) =>
  /^(text-base|md:text-sm|w-full|min-w-0|outline-none|px-2\.5|py-1|disabled:pointer-events-none)$/.test(
    name,
  ) ||
  name.startsWith('placeholder:') ||
  name.startsWith('file:') ||
  name.includes('data-[matches-spartan-invalid=true]');

/** The frame's own layout, which the field has no counterpart for. */
const FRAME_OWN = ['flex', 'items-center'];

/** A box class of the field as the frame states it: focus inside, the input inside disabled. */
const onFrame = (name: string) =>
  name.replace(/^focus-visible:/, 'focus-within:').replace(/^disabled:/, 'has-[input:disabled]:');

describe('INPUT_FRAME_CLASSES', () => {
  it('draws the small field’s box: each of its box classes, focus on focus-within, disabled by the input', () => {
    const frame = classes(INPUT_FRAME_CLASSES);
    const boxClasses = classes(INPUT_CLASSES.small).filter((name) => !inputOnly(name));

    expect(boxClasses.length).toBeGreaterThan(0);
    for (const name of boxClasses) expect(frame, name).toContain(onFrame(name));
    expect([...frame].sort()).toEqual([...FRAME_OWN, ...boxClasses.map(onFrame)].sort());
  });
});

describe('INPUT_IN_FRAME_CLASSES', () => {
  it('keeps the field’s text, placeholder and outline', () => {
    const inside = classes(INPUT_IN_FRAME_CLASSES);

    for (const name of [
      'text-base',
      'md:text-sm',
      'placeholder:text-muted-foreground',
      'outline-none',
    ])
      expect(inside).toContain(name);
  });

  it('draws no box of its own: no border, radius, shadow, ring or fade', () => {
    for (const name of classes(INPUT_IN_FRAME_CLASSES))
      expect(name).not.toMatch(/(^|:)(border-(?!0$)|rounded|shadow|ring|opacity)/);
  });
});
