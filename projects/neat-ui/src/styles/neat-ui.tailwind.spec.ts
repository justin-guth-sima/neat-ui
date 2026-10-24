import stylesheet from './neat-ui.tailwind.css' with { loader: 'text' };
import { spartanThemeTokens } from '../lib/theme/spartan-theme';

/** The `@apply` list of the base layer's universal rule. */
function universalBaseUtilities(): string[] {
  const withoutComments = stylesheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = /\n\s*\*\s*\{([^}]*)\}/.exec(withoutComments)?.[1] ?? '';
  return /@apply\s+([^;]+);/.exec(rule)?.[1].trim().split(/\s+/) ?? [];
}

describe('the kit stylesheet', () => {
  it('draws browser focus outlines in the full ring colour, which the theme holds to 3:1', () => {
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

  it('maps the highlight tone and every row tint to a Tailwind colour, so their utilities exist', () => {
    // Spartan's preset maps its own variables; the kit's extensions need a mapping each, or a
    // class such as `bg-neat-tint-success` compiles to nothing.
    const names = Object.keys(spartanThemeTokens('light')).filter(
      (name) => name.startsWith('highlight') || name.startsWith('neat-tint-'),
    );
    expect(names).toEqual(expect.arrayContaining(['highlight', 'neat-tint-success-accent']));
    for (const name of names) {
      expect(stylesheet, name).toContain(`--color-${name}: var(--${name});`);
    }
  });
});
