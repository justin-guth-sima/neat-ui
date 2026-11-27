// Tailwind's own default theme, as the package ships it.
import tailwindTheme from '../../../../node_modules/tailwindcss/theme.css' with { loader: 'text' };
import stylesheet from './neat-ui.tailwind.css' with { loader: 'text' };
import { spartanThemeTokens } from '../lib/theme/spartan-theme';

/** A font stack as a list of names, whatever its spacing and quotes. */
function fontStack(value: string): string[] {
  return value.split(',').map((name) => name.trim().replace(/^['"]|['"]$/g, ''));
}

/** The value a stylesheet's text gives a custom property, the first time it declares it. */
function declared(css: string, property: string): string {
  const match = new RegExp(`${property}:\\s*([^;]+);`).exec(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  if (!match) throw new Error(`${property} is not declared`);
  return match[1];
}

/** The `@apply` list of the base layer's universal rule. */
function universalBaseUtilities(): string[] {
  const withoutComments = stylesheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = /\n\s*\*\s*\{([^}]*)\}/.exec(withoutComments)?.[1] ?? '';
  return /@apply\s+([^;]+);/.exec(rule)?.[1].trim().split(/\s+/) ?? [];
}

describe('the kit stylesheet', () => {
  it('draws browser focus outlines in the full ring color, which the theme holds to 3:1', () => {
    // A focus outline is a focus indicator (WCAG 1.4.11). Spartan's default, the ring at 50%,
    // composites to about 1.85:1 on white; the theme spec holds --ring itself to 3:1 on every
    // surface text sits on. It matters for elements without their own focus style, such as a
    // neat-page body that the browser makes focusable because it scrolls.
    const outlines = universalBaseUtilities().filter((name) => name.startsWith('outline-'));

    expect(outlines).toEqual(['outline-ring']);
  });

  it('defines the page aside width token next to the spacing tokens', () => {
    // neat-page's aside takes this width; apps read the same token to lay out beside it.
    expect(stylesheet).toMatch(/--neat-aside-width:\s*22rem;/);
  });

  it('defines --neat-surface, the fill of the surface a component sits on, as the page background', () => {
    // A dialog panel and a popover set it to --popover; a sticky header fills with it.
    expect(stylesheet).toMatch(/:root\s*\{[^}]*--neat-surface:\s*var\(--background\);/);
  });

  it('defines --neat-text-base, Tailwind’s base size, beside the small ones', () => {
    // The diagram's frame titles take it; it is the kit's step above --neat-text-sm.
    expect(stylesheet).toMatch(/--neat-text-base:\s*--theme\(--text-base inline\);/);
  });

  it('maps the highlight tone, every row tint and the chips’ colors to a Tailwind color, so their utilities exist', () => {
    // Spartan's preset maps its own variables; the kit's extensions need a mapping each, or a
    // class such as `bg-neat-tint-success` compiles to nothing.
    const chipColors = ['neat-chip-neutral', 'neat-warning-text'];
    const names = Object.keys(spartanThemeTokens('light')).filter(
      (name) =>
        name.startsWith('highlight') || name.startsWith('neat-tint-') || chipColors.includes(name),
    );
    expect(names).toEqual(
      expect.arrayContaining(['highlight', 'neat-tint-success-accent', ...chipColors]),
    );
    for (const name of names) {
      expect(stylesheet, name).toContain(`--color-${name}: var(--${name});`);
    }
  });

  it('makes the kit’s monospace Tailwind’s default stack, so plain code and pre keep the font they had', () => {
    // Preflight's `code, kbd, samp, pre` read `--default-mono-font-family`, which follows
    // `--font-mono`; before the kit set it, they fell back to this same stack.
    expect(fontStack(declared(stylesheet, '--neat-font-mono'))).toEqual(
      fontStack(declared(tailwindTheme, '--font-mono')),
    );
  });

  it('gives `font-mono` the kit’s monospace, where Spartan’s preset leaves it a cycle', () => {
    expect(stylesheet).toMatch(/@theme inline\s*\{[^}]*--font-mono:\s*var\(--neat-font-mono\);/);
  });
});
