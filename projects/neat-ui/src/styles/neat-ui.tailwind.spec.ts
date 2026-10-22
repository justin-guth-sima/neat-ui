import stylesheet from './neat-ui.tailwind.css' with { loader: 'text' };

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
});
