import { composite } from './color';
import {
  type ColorProperty,
  resolveColor,
  splitVariants,
  stateColor,
  stateValue,
} from './state-colors';

const TOKENS = {
  primary: '#b3541b',
  input: '#687272',
  background: '#ffffff',
  foreground: '#010f0e',
  ring: '#d26728',
};
const VOCABULARY = {
  dark: 'dark',
  'data-checked': 'checked',
  'data-unchecked': 'unchecked',
  hover: 'hover',
  'group-data-[variant=line]/tabs-list': true,
  'data-[matches-spartan-invalid=true]': false,
};

const query = (on: string[], box?: string) => ({ tokens: TOKENS, vocabulary: VOCABULARY, on, box });

describe('splitVariants', () => {
  it('splits at the colons outside brackets', () => {
    expect(splitVariants("[&_neat-icon:not([class*='text-'])]:text-[length:--spacing(4)]")).toEqual(
      {
        variants: ["[&_neat-icon:not([class*='text-'])]"],
        utility: 'text-[length:--spacing(4)]',
      },
    );
    expect(splitVariants('dark:data-checked:bg-primary')).toEqual({
      variants: ['dark', 'data-checked'],
      utility: 'bg-primary',
    });
  });
});

describe('stateValue', () => {
  const classes = [
    'border',
    'border-s-0',
    'ring-3',
    'text-sm',
    'data-checked:bg-primary',
    'data-unchecked:bg-input',
    'dark:data-unchecked:bg-input/80',
    'data-[matches-spartan-invalid=true]:ring-primary',
    'group-data-[variant=line]/tabs-list:ring-ring',
  ];
  const value = (property: ColorProperty, on: string[]) => stateValue(classes, property, query(on));

  it('takes the class naming most of the state', () => {
    expect(value('bg', ['checked'])).toBe('primary');
    expect(value('bg', ['unchecked'])).toBe('input');
    expect(value('bg', ['dark', 'unchecked'])).toBe('input/80');
    expect(value('bg', ['dark', 'checked'])).toBe('primary');
  });

  it('applies variants that always hold and skips those that never do', () => {
    expect(value('ring', [])).toBe('ring');
  });

  it('ignores non-colour utilities of the same family', () => {
    expect(value('border', [])).toBeUndefined();
    expect(value('text', [])).toBeUndefined();
  });

  it('measures a pseudo-element only when asked, and then only its own classes', () => {
    const underline = ['bg-transparent', 'data-checked:bg-input', 'after:bg-foreground'];
    expect(stateValue(underline, 'bg', query(['checked']))).toBe('input');
    expect(stateValue(underline, 'bg', query(['checked'], 'after'))).toBe('foreground');
    expect(stateValue(underline, 'bg', query([], 'placeholder'))).toBeUndefined();
  });

  it('fails on an unknown variant, a tie with different values, and a default palette colour', () => {
    expect(() => stateValue(['focus:bg-primary'], 'bg', query([]))).toThrow(
      /Unknown variant "focus"/,
    );
    expect(() =>
      stateValue(['hover:bg-input', 'data-checked:bg-primary'], 'bg', query(['hover', 'checked'])),
    ).toThrow(/Ambiguous bg/);
    expect(() => stateValue(['bg-zinc-500'], 'bg', query([]))).toThrow(/not a theme colour/);
  });

  it('accepts a tie when both classes give the same value', () => {
    expect(
      stateValue(['hover:bg-input', 'data-checked:bg-input'], 'bg', query(['hover', 'checked'])),
    ).toBe('input');
  });
});

describe('resolveColor and stateColor', () => {
  it('composites alpha over what is under it and shows the surface through transparent', () => {
    expect(resolveColor('input/80', TOKENS, '#ffffff')).toBe(composite('#687272', 0.8, '#ffffff'));
    expect(resolveColor('transparent', TOKENS, '#123456')).toBe('#123456');
    expect(resolveColor('primary', TOKENS, '#ffffff')).toBe('#b3541b');
  });

  it('falls back when no class sets the property', () => {
    expect(stateColor([], 'text', query([]), '#ffffff', '#010f0e')).toBe('#010f0e');
    expect(stateColor([], 'bg', query([]), '#ffffff')).toBe('#ffffff');
  });
});
