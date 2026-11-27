import helmBlockquote from '../ui/typography/src/lib/hlm-blockquote.ts?source' with { loader: 'text' };
import helmCode from '../ui/typography/src/lib/hlm-code.ts?source' with { loader: 'text' };
import helmH1 from '../ui/typography/src/lib/hlm-h1.ts?source' with { loader: 'text' };
import helmH2 from '../ui/typography/src/lib/hlm-h2.ts?source' with { loader: 'text' };
import helmH3 from '../ui/typography/src/lib/hlm-h3.ts?source' with { loader: 'text' };
import helmH4 from '../ui/typography/src/lib/hlm-h4.ts?source' with { loader: 'text' };
import helmP from '../ui/typography/src/lib/hlm-p.ts?source' with { loader: 'text' };
import helmUl from '../ui/typography/src/lib/hlm-ul.ts?source' with { loader: 'text' };
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import proseStyles from './prose.css' with { loader: 'text' };
import { NeatProse } from './prose';

/** A rule of the prose's flow, its `&` replaced by the flow, as the stylesheet compiles it. */
interface FlowRule {
  readonly selector: string;
  readonly declarations: ReadonlyMap<string, string>;
}

/**
 * The rules nested in the flow's `:where(…)` block of the components layer, flattened the way
 * Tailwind's compiler flattens them, so `matches` can test which elements each one reaches.
 */
function flowRules(): FlowRule[] {
  const css = proseStyles.replace(/\/\*[\s\S]*?\*\//g, '');
  const layer = css.slice(css.indexOf('@layer components'));
  const flow = /:where\(([^{]*)\)\s*\{/.exec(layer);
  if (!flow) throw new Error('prose.css has no flow block');
  const body = layer.slice(flow.index + flow[0].length);
  return [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, block]) => {
    const declarations = new Map<string, string>();
    for (const [, property, value] of block.matchAll(/(@apply|[\w-]+)\s*:?\s*([^;]+);/g)) {
      declarations.set(property, value.trim());
    }
    return {
      selector: selector.trim().replaceAll('&', `:where(${flow[1].trim()})`),
      declarations,
    };
  });
}

const RULES = flowRules();

/**
 * The declarations prose gives an element, `::marker` ones under `marker` and `:focus-visible`
 * ones under `focus`.
 */
function styleOf(element: Element): Map<string, string> {
  const style = new Map<string, string>();
  for (const { selector, declarations } of RULES) {
    const prefix = selector.includes('::marker')
      ? 'marker '
      : selector.includes(':focus-visible')
        ? 'focus '
        : '';
    const plain = selector.replaceAll('::marker', '').replaceAll(':focus-visible', '');
    if (!element.matches(plain)) continue;
    for (const [property, value] of declarations) style.set(prefix + property, value);
  }
  return style;
}

/** The classes every rule that reaches an element applies to it, in no particular order. */
function applied(element: Element): string[] {
  return RULES.filter(({ selector }) => !/::marker|:focus-visible/.test(selector))
    .filter(({ selector }) => element.matches(selector))
    .flatMap(({ declarations }) => declarations.get('@apply')?.split(/\s+/) ?? [])
    .sort();
}

/** The class string a vendored helm typography file states, read from its text. */
function helmClasses(source: string): string[] {
  const match = /export const hlm\w+\s*=\s*'([^']*)'/.exec(source);
  if (!match) throw new Error('no class constant in the helm file');
  return match[1].split(/\s+/);
}

/**
 * Spartan's space between blocks. Helm states it on each element (a paragraph's top margin unless
 * it is first, a quote's top margin, a list's margins above and below, a list item's top margin);
 * prose states it once, as its flow's gap before every block but the first, so a container's
 * edges stay free (a chat bubble, a card), and keeps the kit's space between list items.
 */
const HELM_GAPS = new Map([
  [helmP, ['[&:not(:first-child)]:mt-6']],
  [helmBlockquote, ['mt-6']],
  [helmUl, ['my-6', '[&>li]:mt-2']],
]);
const FLOW_GAP = 'mt-6';

/** Helm's classes for an element less its gaps, plus the flow's gap where the element follows another. */
function spartanInProse(helm: string, follows: boolean): string[] {
  const gaps = HELM_GAPS.get(helm) ?? [];
  const own = helmClasses(helm).filter((name) => !gaps.includes(name));
  return [...own, ...(follows ? [FLOW_GAP] : [])].sort();
}

@Component({
  imports: [NeatProse],
  // `app-part` stands for any component an app places in the prose.
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <p id="before"><a id="outside-link" href="#a">Outside</a> <code id="outside-code">x</code></p>
    <ul id="outside-list">
      <li>Outside</li>
    </ul>
    <article neatProse>
      <h2 id="h2">Connect a camera</h2>
      <h1 id="h1">Cameras</h1>
      <h3 id="h3">RTSP</h3>
      <h4 id="h4">Its address</h4>
      <p id="p">
        Open <a id="link" href="#media">Media</a>, <a id="anchor">no link</a>,
        <code id="code">rtsp://…</code>, <kbd id="kbd">Enter</kbd>.
      </p>
      <ul id="list">
        <li id="item">
          <strong><a id="item-link" href="#b">One</a></strong>
          <ul id="nested">
            <li id="nested-item">Two</li>
            <li id="nested-next">Three</li>
          </ul>
        </li>
        <li id="next-item">
          <pre><code id="block-code">npm start</code></pre>
        </li>
      </ul>
      <ol id="numbered">
        <li id="step">First</li>
        <li id="next-step">Then</li>
      </ol>
      <blockquote id="quote"><p id="quoted">Quoted</p></blockquote>
      <hr id="rule" />
      <h5 id="h5">Fine print</h5>
      <h6 id="h6">Small print</h6>
      <app-part>
        <h3 id="part-heading">A card's title</h3>
        <ul id="legend">
          <li><span>Swatch</span><span id="legend-label">Series</span></li>
        </ul>
        <p><a id="part-link" href="#c">Its own link</a></p>
      </app-part>
    </article>
  `,
})
class ProseHost {}

describe('NeatProse', () => {
  let byId: (id: string) => Element;

  beforeEach(async () => {
    const fixture = TestBed.createComponent(ProseHost);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    byId = (id) => host.querySelector(`#${id}`)!;
  });

  it('marks its host as prose', () => {
    expect(byId('h2').parentElement!.classList).toContain('neat-prose');
  });

  it('touches nothing outside its host: a reset stays a reset there', () => {
    for (const id of ['before', 'outside-link', 'outside-code', 'outside-list']) {
      expect(styleOf(byId(id)), id).toEqual(new Map());
    }
  });

  it('spaces its blocks as Spartan does, 1.5rem apart, with none before the first', () => {
    for (const [helm, gaps] of HELM_GAPS) {
      for (const gap of gaps) expect(helmClasses(helm), gap).toContain(gap);
    }
    expect(applied(byId('h2'))).not.toContain(FLOW_GAP);
    for (const id of ['h1', 'h3', 'p', 'list', 'numbered', 'quote', 'rule', 'h6']) {
      expect(applied(byId(id)), id).toContain(FLOW_GAP);
    }
    // A block of the flow, so no other rule spaces it.
    for (const id of ['p', 'h3', 'rule']) {
      expect(styleOf(byId(id)).has('margin-block-start'), id).toBe(false);
    }
  });

  it('sets h1 to h4 in Spartan’s type: helm’s classes for each', () => {
    expect(applied(byId('h2'))).toEqual(spartanInProse(helmH2, false));
    expect(applied(byId('h1'))).toEqual(spartanInProse(helmH1, true));
    expect(applied(byId('h3'))).toEqual(spartanInProse(helmH3, true));
    expect(applied(byId('h4'))).toEqual(spartanInProse(helmH4, true));
  });

  it('sets a paragraph in Spartan’s type, a quoted one too', () => {
    expect(applied(byId('p'))).toEqual(spartanInProse(helmP, true));
    // First in its quote, so no gap above it.
    expect(applied(byId('quoted'))).toEqual(spartanInProse(helmP, false));
  });

  it('keeps the kit’s h5 and h6, which Spartan has none of: a step below the text, h6 muted', () => {
    for (const id of ['h5', 'h6']) {
      expect(styleOf(byId(id)).get('@apply'), id).toBe('text-(length:--neat-text-sm) font-medium');
    }
    expect(styleOf(byId('h6')).get('color')).toBe('var(--muted-foreground)');
  });

  it('gives a bulleted list Spartan’s inset and bullets, and the lists inside its items too', () => {
    expect(applied(byId('list'))).toEqual(spartanInProse(helmUl, true));
    // Inside an item it follows the kit's step there, not the flow's gap.
    expect(applied(byId('nested'))).toEqual(spartanInProse(helmUl, false));
  });

  it('keeps the kit’s numbered list, its items and their markers, which Spartan has none of', () => {
    expect(styleOf(byId('numbered')).get('list-style')).toBe('decimal');
    expect(styleOf(byId('numbered')).get('padding-inline-start')).toBe('var(--neat-space-6)');
    expect(styleOf(byId('step')).get('marker font-weight')).toBe('500');
    for (const id of ['item', 'step']) {
      expect(styleOf(byId(id)).get('marker color'), id).toBe('var(--muted-foreground)');
    }
    // Items 0.5rem apart, Spartan's `mt-2` between items.
    for (const id of ['next-item', 'nested-next', 'next-step']) {
      expect(styleOf(byId(id)).get('margin-block-start'), id).toBe('var(--neat-space-2)');
    }
  });

  it('keeps blocks inside a list item the kit’s step apart', () => {
    const nested = styleOf(byId('nested'));
    expect(nested.get('margin-block-start')).toBe('var(--neat-space-3)');
  });

  it('underlines a link in medium weight and leaves its color to its text, so it holds the text’s contrast', () => {
    for (const id of ['link', 'item-link']) {
      const style = styleOf(byId(id));
      expect(style.get('text-decoration'), id).toBe('underline');
      expect(style.get('font-weight'), id).toBe('500');
      expect(style.has('color'), id).toBe(false);
      expect(style.get('focus outline'), id).toBe('var(--neat-focus-ring-width) solid var(--ring)');
    }
    // An `a` without `href` is no link.
    expect(styleOf(byId('anchor'))).toEqual(new Map());
  });

  it('puts inline code in the kit’s code look, and leaves code in a pre alone', () => {
    expect(styleOf(byId('code'))).toEqual(new Map([['@apply', 'neat-code']]));
    expect(styleOf(byId('block-code'))).toEqual(new Map());
  });

  it('gives the kit’s code look Spartan’s inline code, wrapping anywhere', () => {
    const css = proseStyles.replace(/\/\*[\s\S]*?\*\//g, '');
    const look = /@utility neat-code\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const classes = /@apply\s+([^;]+);/.exec(look)?.[1].trim().split(/\s+/) ?? [];
    expect(classes.sort()).toEqual(helmClasses(helmCode).sort());
    // Monospace has no spaces to break at, so it wraps anywhere rather than run past its line.
    expect(look).toMatch(/overflow-wrap:\s*anywhere;/);
  });

  it('draws a kbd as the shortcut draws a key', () => {
    expect(styleOf(byId('kbd')).get('@apply')).toBe('neat-key');
  });

  it('sets a quote off as Spartan does: italic, with a border at its start, its text the prose’s color', () => {
    expect(applied(byId('quote'))).toEqual(spartanInProse(helmBlockquote, true));
    expect(styleOf(byId('quote')).has('color')).toBe(false);
  });

  it('leaves what another component inside it draws to that component', () => {
    // The part itself is a block of the flow, spaced as one.
    expect(applied(byId('part-heading').parentElement!)).toEqual([FLOW_GAP]);
    for (const id of ['part-heading', 'legend', 'legend-label', 'part-link']) {
      expect(styleOf(byId(id)), id).toEqual(new Map());
    }
  });

  it('sits in the components layer, under the kit’s utilities and every unlayered style', () => {
    const css = proseStyles.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = css.slice(0, css.indexOf('@layer components'));
    // Before the layer, only the two shared looks.
    expect(
      [...rules.matchAll(/^([^\s{}][^{}]*)\{/gm)].map(([, selector]) => selector.trim()),
    ).toEqual(['@utility neat-code', '@utility neat-key']);
  });
});
