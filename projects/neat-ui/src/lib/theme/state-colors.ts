import { composite } from './color';

/**
 * Spec support: the colour a control shows in a state, read from its rendered utility classes and
 * resolved against the emitted theme tokens (`spartanThemeTokens`). Internal, like those tokens:
 * the control specs measure contrast with it, nothing uses it at runtime.
 */

export type ThemeTokens = Readonly<Record<string, string>>;

/** The utility families that carry a colour a contrast rule applies to. */
export type ColorProperty = 'bg' | 'text' | 'border' | 'ring';

/**
 * What a variant on a colour class means for the states a spec models: the name of the state that
 * turns it on (`'checked'`, `'dark'`, `'hover'`), `true` for a condition that always holds on that
 * element (a fixed attribute such as the tab list's line variant), or `false` for one that never
 * does in the modelled states (a failed form validation, a size the control does not use).
 */
export type VariantMeaning = string | boolean;
export type VariantVocabulary = Readonly<Record<string, VariantMeaning>>;

/** Colour values that are not theme tokens but still colours. */
const KEYWORD_COLORS = new Set(['transparent', 'white', 'black', 'current', 'inherit']);
/** Tailwind's default palette (`zinc-500`): never part of the kit's theme, so a helm leak. */
const PALETTE_COLOR = /^[a-z]+-\d{2,3}$/;

/** A class as its variants and utility, split at the colons outside brackets. */
export function splitVariants(name: string): { variants: string[]; utility: string } {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < name.length; i++) {
    if (name[i] === '[') depth++;
    else if (name[i] === ']') depth--;
    else if (name[i] === ':' && depth === 0) {
      parts.push(name.slice(start, i));
      start = i + 1;
    }
  }
  return { variants: parts, utility: name.slice(start) };
}

/**
 * The colour value (`primary`, `input/80`, `transparent`) of a `<property>-` utility, or undefined
 * for a non-colour utility of the same family (`border-s-0`, `text-sm`, `ring-3`). Widths, sizes
 * and arbitrary values are not colours; a value of Tailwind's default palette fails.
 */
function colorValue(utility: string, property: ColorProperty, tokens: ThemeTokens) {
  if (!utility.startsWith(`${property}-`)) return undefined;
  const value = utility.slice(property.length + 1);
  const name = value.split('/')[0];
  if (name in tokens || KEYWORD_COLORS.has(name)) return value;
  if (PALETTE_COLOR.test(name)) {
    throw new Error(`"${utility}" is not a theme colour: the kit's colours come from the theme`);
  }
  return undefined;
}

/** Variants that style a pseudo-element: a box of its own, measured only when asked for. */
const PSEUDO_ELEMENTS = new Set(['before', 'after', 'placeholder', 'file', 'marker', 'selection']);

/** What to measure: the states that hold, what the variants mean, and the tokens to resolve. */
export interface ColorQuery {
  readonly tokens: ThemeTokens;
  readonly vocabulary: VariantVocabulary;
  /** The states that hold, such as `['dark', 'checked']`. */
  readonly on: readonly string[];
  /** A pseudo-element (`after`, `placeholder`) to measure instead of the element itself. */
  readonly box?: string;
}

/**
 * The colour utility value a property takes in a state.
 *
 * Of the colour classes whose variants all hold, the one with the most variants wins: a class that
 * names more of the state is the more specific statement about it, which is how helm and the kit
 * wrappers write overrides (`data-unchecked:bg-input` then `dark:data-unchecked:bg-input/80`).
 * Two winners with different values fail instead of guessing at Tailwind's cascade order: a
 * wrapper then states the combined state outright. Undefined when no class sets the property.
 *
 * A variant missing from the vocabulary fails, so a helm update cannot slip a colour past a test.
 */
export function stateValue(
  classes: readonly string[],
  property: ColorProperty,
  { tokens, vocabulary, on, box }: ColorQuery,
): string | undefined {
  let best: { count: number; values: Set<string>; names: string[] } | undefined;
  for (const name of classes) {
    const { variants, utility } = splitVariants(name);
    const value = colorValue(utility, property, tokens);
    if (value === undefined) continue;
    const pseudo = variants.find((variant) => PSEUDO_ELEMENTS.has(variant));
    if (pseudo !== box) continue;
    const conditions = variants.filter((variant) => variant !== pseudo);
    const holds = conditions.every((variant) => {
      if (!(variant in vocabulary)) {
        throw new Error(`Unknown variant "${variant}" on "${name}": add it to the vocabulary`);
      }
      const meaning = vocabulary[variant];
      return typeof meaning === 'boolean' ? meaning : on.includes(meaning);
    });
    if (!holds) continue;
    if (!best || conditions.length > best.count) {
      best = { count: conditions.length, values: new Set([value]), names: [name] };
    } else if (conditions.length === best.count) {
      best.values.add(value);
      best.names.push(name);
    }
  }
  if (best && best.values.size > 1) {
    throw new Error(`Ambiguous ${property} in [${on.join(', ')}]: ${best.names.join(' vs ')}`);
  }
  return best ? [...best.values][0] : undefined;
}

/** A colour utility value as an opaque `#RRGGBB` over `under` (what shows through alpha). */
export function resolveColor(value: string, tokens: ThemeTokens, under: string): string {
  const [name, alpha] = value.split('/');
  if (name === 'transparent') return under;
  const color = name === 'white' ? '#ffffff' : name === 'black' ? '#000000' : tokens[name];
  if (color === undefined) {
    throw new Error(`Cannot resolve the colour "${value}" (current and inherit depend on context)`);
  }
  return alpha === undefined ? color : composite(color, Number(alpha) / 100, under);
}

/**
 * The opaque colour a property shows in a state, over `under`; `fallback` (the colour inherited or
 * shown through) when no class sets it.
 */
export function stateColor(
  classes: readonly string[],
  property: ColorProperty,
  query: ColorQuery,
  under: string,
  fallback = under,
): string {
  const value = stateValue(classes, property, query);
  return value === undefined ? fallback : resolveColor(value, query.tokens, under);
}
