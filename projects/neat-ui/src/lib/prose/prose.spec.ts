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
      <h3 id="h3">RTSP</h3>
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
      <blockquote id="quote"><p id="quoted">Quoted</p></blockquote>
      <hr id="rule" />
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

  it('spaces its blocks a step apart, and a heading or a rule further from what comes before', () => {
    expect(styleOf(byId('h2')).has('margin-block-start')).toBe(false);
    expect(styleOf(byId('p')).get('margin-block-start')).toBe('var(--neat-space-3)');
    expect(styleOf(byId('h3')).get('margin-block-start')).toBe('var(--neat-space-6)');
    expect(styleOf(byId('rule')).get('margin-block-start')).toBe('var(--neat-space-6)');
    expect(styleOf(byId('h6')).get('margin-block-start')).toBe('var(--neat-space-6)');
  });

  it('sizes h3 above the text and h6 below it, muted', () => {
    expect(styleOf(byId('h3')).get('@apply')).toBe('text-lg font-medium');
    expect(styleOf(byId('h6')).get('@apply')).toBe('text-(length:--neat-text-sm) font-medium');
    expect(styleOf(byId('h6')).get('color')).toBe('var(--muted-foreground)');
  });

  it('gives its lists and the lists inside them markers, an inset and spaced items', () => {
    for (const id of ['list', 'nested']) {
      expect(styleOf(byId(id)).get('list-style'), id).toBe('disc');
      expect(styleOf(byId(id)).get('padding-inline-start'), id).toBe('var(--neat-space-6)');
    }
    expect(styleOf(byId('item')).get('marker color')).toBe('var(--muted-foreground)');
    expect(styleOf(byId('next-item')).get('margin-block-start')).toBe('var(--neat-space-2)');
    expect(styleOf(byId('nested-next')).get('margin-block-start')).toBe('var(--neat-space-2)');
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

  it('puts inline code on a chip in the kit’s code look, and leaves code in a pre alone', () => {
    const code = styleOf(byId('code'));
    expect(code.get('@apply')).toBe('neat-code');
    expect(code.get('background')).toBe('var(--muted)');
    expect(styleOf(byId('block-code'))).toEqual(new Map());
  });

  it('draws a kbd as the shortcut draws a key', () => {
    expect(styleOf(byId('kbd')).get('@apply')).toBe('neat-key');
  });

  it('mutes a quote and sets it off by a border, its text still the prose’s', () => {
    expect(styleOf(byId('quote')).get('color')).toBe('var(--muted-foreground)');
    expect(styleOf(byId('quote')).get('border-inline-start')).toBe('0.25rem solid var(--border)');
    expect(styleOf(byId('quoted')).size).toBe(0);
  });

  it('leaves what another component inside it draws to that component', () => {
    // The part itself is a block of the flow, spaced as one.
    expect(styleOf(byId('part-heading').parentElement!).get('margin-block-start')).toBe(
      'var(--neat-space-3)',
    );
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
