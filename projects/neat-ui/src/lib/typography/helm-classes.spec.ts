import {
  classSet,
  helmConstant,
  helmCvaBase,
  helmCvaVariant,
  helmHostClasses,
  takenFromHelm,
} from './helm-classes.testing';

/** A helm file in the shapes the vendored ones have. */
const SOURCE = `
export const hlmThing = 'a b  c';

const thingVariants = cva(
  "base [&_x:not([class*='text-'])]:y",
  {
    variants: {
      variant: {
        default: 'plain',
        icon: "bg-muted [&_neat-icon:not([class*='text-'])]:size-4",
        list: ['one two', 'three'],
      },
    },
  },
);

export class HlmFirst {
  constructor() {
    classes(() => 'first one');
  }
}

export class HlmSecond {
  constructor() {
    classes(() => [
      'text-sm [[data-variant=legend]+&]:-mt-1.5',
      'last:mt-0 (ignored) ',
    ]);
  }
}
`;

describe('the helm class helper', () => {
  it('reads an exported constant, the first one or the one named', () => {
    expect(helmConstant(SOURCE)).toEqual(['a', 'b', 'c']);
    expect(helmConstant(SOURCE, 'hlmThing')).toEqual(['a', 'b', 'c']);
    expect(() => helmConstant(SOURCE, 'hlmOther')).toThrow(/no class constant/);
  });

  it('reads the cva base and a variant, quotes inside a string and arrays included', () => {
    expect(helmCvaBase(SOURCE)).toEqual(['base', "[&_x:not([class*='text-'])]:y"]);
    expect(helmCvaVariant(SOURCE, 'icon')).toEqual([
      'bg-muted',
      "[&_neat-icon:not([class*='text-'])]:size-4",
    ]);
    expect(helmCvaVariant(SOURCE, 'list')).toEqual(['one', 'two', 'three']);
    expect(() => helmCvaVariant(SOURCE, 'missing')).toThrow(/no "missing:"/);
  });

  it('reads a directive’s classes() call, a string or an array, by the class it is in', () => {
    expect(helmHostClasses(SOURCE)).toEqual(['first', 'one']);
    expect(helmHostClasses(SOURCE, 'HlmSecond')).toEqual([
      'text-sm',
      '[[data-variant=legend]+&]:-mt-1.5',
      'last:mt-0',
      '(ignored)',
    ]);
    expect(() => helmHostClasses(SOURCE, 'HlmThird')).toThrow(/no class HlmThird/);
  });

  it('takes helm’s set less the departures and plus the additions, and keeps both lists true', () => {
    const helm = ['a', 'b', 'c'];
    expect(takenFromHelm(helm, { departures: ['b'], additions: ['z', 'd'] })).toEqual([
      'a',
      'c',
      'd',
      'z',
    ]);
    expect(() => takenFromHelm(helm, { departures: ['x'] })).toThrow(/no longer has/);
    expect(() => takenFromHelm(helm, { additions: ['a'] })).toThrow(/no addition/);
    expect(classSet(['b', 'a', 'b'])).toEqual(['a', 'b']);
  });
});
