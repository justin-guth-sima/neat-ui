import { Component, signal } from '@angular/core';
import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { zoomTransform } from 'd3-zoom';
import { NeatDiagramView } from './diagram';
import diagramStyles from './diagram.css' with { loader: 'text' };
import { fitTransform } from './fit';
import { layoutEdges } from './layout';
import type { NeatDiagram, NeatDiagramSet } from './model';
import { resetReported } from './report';
import { resize, stubResizeObserver } from './resize-observer.testing';
import { pointAlong } from './route';

@Component({
  imports: [NeatDiagramView],
  template: `<neat-diagram [diagram]="diagram()" label="Modalix pipeline" />`,
})
class DiagramHost {
  readonly diagram = signal<NeatDiagramSet>({ overview: { nodes: [], edges: [] } });
}

/**
 * A board (accent frame) holding a dashed group three frames deep with a block in it, a ghost block
 * that opens a level, a band below and a bracket under the blocks; edges with and without a series,
 * a label and tips.
 */
const OVERVIEW: NeatDiagram = {
  nodes: [
    {
      id: 'board',
      role: 'frame',
      look: 'accent',
      label: 'Modalix',
      detail: 'DevKit',
      x: 100,
      y: 50,
      w: 500,
      h: 300,
    },
    { id: 'group', role: 'frame', look: 'dashed', label: 'Neat', parent: 'board', x: 20, y: 60 },
    {
      id: 'decode',
      role: 'block',
      label: 'Decode',
      detail: 'H.264',
      chips: [{ label: 'HW', tone: 'success' }],
      parent: 'group',
      x: 10,
      y: 50,
      w: 120,
      h: 40,
    },
    {
      id: 'detect',
      role: 'block',
      look: 'ghost',
      label: 'Detect',
      opens: 'stages',
      parent: 'board',
      x: 300,
      y: 110,
      w: 120,
      h: 40,
    },
    {
      id: 'tracker',
      role: 'block',
      look: 'muted',
      label: 'Tracker',
      x: 700,
      y: 160,
      w: 120,
      h: 40,
    },
    { id: 'cable', role: 'band', label: 'Ethernet', x: 0, y: 400, w: 600, h: 30 },
    { id: 'riser', role: 'band', label: 'PCIe', x: 650, y: 0, w: 30, h: 300 },
    {
      id: 'graph',
      role: 'bracket',
      label: 'Neat graph',
      detail: '12.4 ms',
      x: 130,
      y: 210,
      w: 390,
      h: 40,
    },
  ].map((node) => ({ w: 300, h: 200, ...node })) as NeatDiagram['nodes'],
  edges: [
    { id: 'decode-detect', from: 'decode', to: 'detect', series: 3, label: '1×3×640×640' },
    { id: 'detect-tracker', from: 'detect', to: 'tracker', line: 'dashed', labelAt: 0.25 },
    {
      id: 'tracker-cable',
      from: 'tracker',
      to: 'cable',
      series: 8,
      line: 'ghost',
      start: 'dot',
      end: 'none',
    },
  ],
};

const SET: NeatDiagramSet = { overview: OVERVIEW, levels: { stages: { nodes: [], edges: [] } } };

async function render(diagram: NeatDiagramSet = SET) {
  const fixture = TestBed.createComponent(DiagramHost);
  fixture.componentInstance.diagram.set(diagram);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const one = (selector: string) => root.querySelector<HTMLElement>(selector) as HTMLElement;
  return {
    fixture,
    host: one('neat-diagram'),
    one,
    all: (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector)),
    node: (id: string) => one(`[data-node="${id}"]`),
    edge: (id: string) => one(`g[data-edge="${id}"]`),
    set: async (next: NeatDiagramSet) => {
      fixture.componentInstance.diagram.set(next);
      await fixture.whenStable();
    },
  };
}

/** An element's box as its inline style places it. */
const box = (element: HTMLElement) => ({
  x: parseFloat(element.style.left),
  y: parseFloat(element.style.top),
  w: parseFloat(element.style.width),
  h: parseFloat(element.style.height),
});

/** The numbers of an SVG path's `d`, in order. */
const numbers = (d: string | null) => (d ?? '').match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];

describe('NeatDiagramView', () => {
  let error: MockInstance<typeof console.error>;
  beforeEach(() => {
    stubResizeObserver();
    error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    error.mockRestore();
    resetReported();
    vi.unstubAllGlobals();
  });

  it('is a figure named by its label', async () => {
    const { host } = await render();
    expect(host.getAttribute('role')).toBe('figure');
    expect(host.getAttribute('aria-label')).toBe('Modalix pipeline');
  });

  it('draws each role with its class at its place in the level, parents added up', async () => {
    const { node } = await render();
    expect(node('board').classList).toContain('frame');
    expect(box(node('board'))).toEqual({ x: 100, y: 50, w: 500, h: 300 });
    expect(box(node('group'))).toEqual({ x: 120, y: 110, w: 300, h: 200 });
    expect(node('decode').classList).toContain('block');
    expect(box(node('decode'))).toEqual({ x: 130, y: 160, w: 120, h: 40 });
    expect(box(node('detect'))).toEqual({ x: 400, y: 160, w: 120, h: 40 });
    expect(node('cable').classList).toContain('band');
    expect(box(node('cable'))).toEqual({ x: 0, y: 400, w: 600, h: 30 });
    expect(node('graph').classList).toContain('bracket');
    expect(box(node('graph'))).toEqual({ x: 130, y: 210, w: 390, h: 40 });
  });

  it('puts frames and bands behind the edges, blocks and brackets in front of them', async () => {
    const { one, node } = await render();
    const svg = one('svg.edges');
    const before = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    for (const id of ['board', 'group', 'cable']) expect(before(node(id), svg), id).toBe(true);
    for (const id of ['decode', 'graph']) expect(before(svg, node(id)), id).toBe(true);
    // A frame inside another comes after it, so it is drawn over its parent's fill.
    expect(before(node('board'), node('group'))).toBe(true);
    // One container holds every layer, for pan and zoom to move as one.
    const content = one('.content');
    for (const part of [node('board'), svg, node('decode')])
      expect(content.contains(part)).toBe(true);
  });

  it('draws a frame’s title and detail, and a band’s label along its long side', async () => {
    const { node } = await render();
    expect(node('board').querySelector('.title')?.textContent?.trim()).toBe('Modalix');
    expect(node('board').querySelector('.detail')?.textContent?.trim()).toBe('DevKit');
    expect(node('group').querySelector('.detail')).toBeNull();
    expect(node('cable').textContent?.trim()).toBe('Ethernet');
    expect(node('cable').classList).not.toContain('upright');
    expect(node('riser').classList).toContain('upright');
  });

  it('gives each node its look, default when unset', async () => {
    const { node } = await render();
    expect(node('board').dataset['look']).toBe('accent');
    expect(node('group').dataset['look']).toBe('dashed');
    expect(node('decode').dataset['look']).toBe('default');
    expect(node('detect').dataset['look']).toBe('ghost');
    expect(node('tracker').dataset['look']).toBe('muted');
  });

  it('draws a block’s label, detail and chips, each the kit’s status chip in its tone', async () => {
    const { node } = await render();
    expect(node('decode').querySelector('.label')?.textContent?.trim()).toBe('Decode');
    expect(node('decode').querySelector('.detail')?.textContent?.trim()).toBe('H.264');
    const chips = Array.from(node('decode').querySelectorAll('neat-status-chip'));
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['HW']);
    // The success tone's fill (NeatStatusChip's own classes).
    expect(chips[0].classList).toContain('bg-success');
    expect(node('detect').querySelector('neat-status-chip')).toBeNull();
  });

  it('marks a block that opens a level, with "›"; one naming no level is drawn plain', async () => {
    const stale: NeatDiagramSet = { overview: OVERVIEW };
    const { node, set } = await render();
    expect(node('detect').hasAttribute('data-opens')).toBe(true);
    expect(node('detect').querySelector('.more')?.textContent?.trim()).toBe('›');
    expect(node('decode').hasAttribute('data-opens')).toBe(false);
    expect(node('decode').querySelector('.more')).toBeNull();
    expect(error).not.toHaveBeenCalled();

    await set(stale);
    expect(node('detect').hasAttribute('data-opens')).toBe(false);
    expect(node('detect').querySelector('.more')).toBeNull();
    await set({ overview: { ...OVERVIEW } });
    const about = error.mock.calls
      .map((call) => String(call[0]))
      .filter((m) => m.includes('"detect"'));
    expect(about).toHaveLength(1);
    expect(about[0]).toContain('"stages"');
  });

  it('draws the brace and the bracket’s label with its detail', async () => {
    const { node } = await render();
    const path = node('graph').querySelector('svg path');
    // The brace spans the bracket's width: from x 1 to x w - 1.
    const xs = numbers(path?.getAttribute('d') ?? null).filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBe(1);
    expect(Math.max(...xs)).toBe(389);
    expect(node('graph').textContent?.replace(/\s+/g, ' ').trim()).toBe('Neat graph · 12.4 ms');
  });

  it('draws one edge per laid-out edge in one SVG, along the layout’s path', async () => {
    const { all, edge } = await render();
    const layouts = layoutEdges(OVERVIEW);
    expect(all('svg.edges g[data-edge]').map((g) => g.dataset['edge'])).toEqual([
      'decode-detect',
      'detect-tracker',
      'tracker-cable',
    ]);
    for (const [id, layout] of layouts) {
      expect(edge(id).querySelector('path.line')?.getAttribute('d'), id).toBe(layout.path);
    }
  });

  it('colours an edge by its series token, else the muted colour', async () => {
    const { edge } = await render();
    expect(edge('decode-detect').style.getPropertyValue('--edge')).toBe('var(--neat-series-3)');
    expect(edge('detect-tracker').style.getPropertyValue('--edge')).toBe('var(--muted-foreground)');
  });

  it('draws a ghost edge in the muted colour whatever its series, its tips with it', async () => {
    const { edge } = await render();
    // tracker-cable is a ghost with series 8: a part that does not run stays quiet.
    const ghost = edge('tracker-cable');
    expect(ghost.style.getPropertyValue('--edge')).toBe('var(--muted-foreground)');
    // Line and tips take their colour from the group's --edge (diagram.css), never their own.
    const tips = Array.from(ghost.querySelectorAll('.tip'));
    expect(tips).toHaveLength(1);
    for (const part of [ghost.querySelector('path.line'), ...tips]) {
      expect(part?.parentElement).toBe(ghost);
      expect((part as SVGElement).style.getPropertyValue('--edge')).toBe('');
    }
  });

  it('draws a series outside 1 to 8 in the muted colour and says so once', async () => {
    const odd: NeatDiagramSet = {
      overview: { ...OVERVIEW, edges: [{ ...OVERVIEW.edges[0], series: 9 }] },
    };
    const { edge, set } = await render(odd);
    expect(edge('decode-detect').style.getPropertyValue('--edge')).toBe('var(--muted-foreground)');
    await set(structuredClone(odd));
    const about = error.mock.calls.map((call) => String(call[0]));
    expect(about.filter((m) => m.includes('"decode-detect"'))).toHaveLength(1);
  });

  it('gives each edge its line', async () => {
    const { edge } = await render();
    expect(edge('decode-detect').dataset['line']).toBe('solid');
    expect(edge('detect-tracker').dataset['line']).toBe('dashed');
    expect(edge('tracker-cable').dataset['line']).toBe('ghost');
  });

  it('ends an edge with an arrow into its target and starts it plain, unless it says', async () => {
    const { edge } = await render();
    const layouts = layoutEdges(OVERVIEW);
    const plain = edge('decode-detect');
    expect(plain.querySelector('[data-tip="start"]')).toBeNull();
    const arrow = plain.querySelector('[data-tip="end"]') as SVGPathElement;
    expect(arrow.dataset['shape']).toBe('arrow');
    // Its point is the target's port; its base lies back along the edge, outside the target.
    const { target } = layouts.get('decode-detect')!;
    const [tx, ty, ...base] = numbers(arrow.getAttribute('d'));
    expect({ x: tx, y: ty }).toEqual(target);
    expect(base.filter((_, i) => i % 2 === 0).every((x) => x < target.x)).toBe(true);

    const dotted = edge('tracker-cable');
    expect(dotted.querySelector('[data-tip="end"]')).toBeNull();
    const dot = dotted.querySelector('[data-tip="start"]') as SVGCircleElement;
    expect(dot.dataset['shape']).toBe('dot');
    // The dot sits against the source's side (its left), outside it.
    const { source, sourceSide } = layouts.get('tracker-cable')!;
    expect(sourceSide).toBe('left');
    const r = Number(dot.getAttribute('r'));
    expect(r).toBeGreaterThan(0);
    expect(Number(dot.getAttribute('cx'))).toBe(source.x - r);
    expect(Number(dot.getAttribute('cy'))).toBe(source.y);
  });

  it('puts an edge’s label at the middle of its route, or at labelAt', async () => {
    const labelled: NeatDiagramSet = {
      overview: {
        ...OVERVIEW,
        edges: OVERVIEW.edges.map((e) =>
          e.id === 'detect-tracker' ? { ...e, label: 'boxes' } : e,
        ),
      },
    };
    const { one, all } = await render(labelled);
    const layouts = layoutEdges(labelled.overview);
    expect(all('.edge-label').map((l) => l.dataset['edge'])).toEqual([
      'decode-detect',
      'detect-tracker',
    ]);
    const middle = one('.edge-label[data-edge="decode-detect"]');
    expect(middle.textContent?.trim()).toBe('1×3×640×640');
    const half = pointAlong(layouts.get('decode-detect')!.points, 0.5);
    expect({ x: parseFloat(middle.style.left), y: parseFloat(middle.style.top) }).toEqual(half);
    const quarter = one('.edge-label[data-edge="detect-tracker"]');
    const at = pointAlong(layouts.get('detect-tracker')!.points, 0.25);
    expect({ x: parseFloat(quarter.style.left), y: parseFloat(quarter.style.top) }).toEqual(at);
  });

  it('keeps every drawn element given an equal diagram again (a poll recomputing it)', async () => {
    const { node, edge, one, set } = await render();
    const before = [
      node('board'),
      node('decode'),
      node('cable'),
      node('graph'),
      edge('decode-detect'),
      edge('decode-detect').querySelector('path.line'),
      one('.edge-label'),
    ];
    await set(structuredClone(SET));
    const after = [
      node('board'),
      node('decode'),
      node('cable'),
      node('graph'),
      edge('decode-detect'),
      edge('decode-detect').querySelector('path.line'),
      one('.edge-label'),
    ];
    after.forEach((element, i) => expect(element, String(i)).toBe(before[i]));
  });

  it('follows a change to a node by id: the same element, moved', async () => {
    const { node, set } = await render();
    const decode = node('decode');
    await set({
      ...SET,
      overview: {
        ...OVERVIEW,
        nodes: OVERVIEW.nodes.map((n) => (n.id === 'decode' ? { ...n, x: 20 } : n)),
      },
    });
    expect(node('decode')).toBe(decode);
    expect(box(decode).x).toBe(140);
  });

  it('skips parts whose ids name nothing, saying each once, and draws the rest', async () => {
    const broken: NeatDiagramSet = {
      overview: {
        nodes: [
          ...OVERVIEW.nodes,
          { id: 'lost', role: 'block', label: 'Lost', parent: 'nowhere', x: 0, y: 0, w: 9, h: 9 },
          { id: 'decode', role: 'block', label: 'Twin', x: 0, y: 0, w: 9, h: 9 },
        ],
        edges: [
          ...OVERVIEW.edges,
          { id: 'to-ghost', from: 'decode', to: 'ghost' },
          { id: 'to-lost', from: 'decode', to: 'lost' },
        ],
      },
    };
    const { all, node, set } = await render(broken);
    expect(all('[data-node="lost"]')).toEqual([]);
    expect(all('[data-node="decode"]')).toHaveLength(1);
    expect(node('decode').querySelector('.label')?.textContent?.trim()).toBe('Decode');
    expect(all('g[data-edge]').map((g) => g.dataset['edge'])).toEqual([
      'decode-detect',
      'detect-tracker',
      'tracker-cable',
    ]);
    await set(structuredClone(broken));
    const messages = error.mock.calls.map((call) => String(call[0]));
    for (const id of ['"lost"', '"to-ghost"', '"to-lost"', 'node "decode"']) {
      expect(messages.filter((m) => m.includes(id)).length, id).toBeGreaterThan(0);
    }
    expect(new Set(messages).size).toBe(messages.length);
  });
});

describe('NeatDiagramView’s pan, zoom and fit', () => {
  /** Two blocks and the edge between them, which stays between them: 420 × 140 from the origin. */
  const PAIR: NeatDiagramSet = {
    overview: {
      nodes: [
        { id: 'camera', role: 'block', label: 'Camera', x: 0, y: 0, w: 120, h: 40 },
        { id: 'decode', role: 'block', label: 'Decode', x: 300, y: 100, w: 120, h: 40 },
      ],
      edges: [{ id: 'frames', from: 'camera', to: 'decode', series: 1 }],
    },
  };
  const FITTED = fitTransform({ x: 0, y: 0, w: 420, h: 140 }, { w: 800, h: 600 })!;

  beforeEach(() => {
    stubResizeObserver();
    // Fit and zoom jump instead of animating, so each step is checked at once.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  /** The diagram drawn in an 800 × 600 box, as a browser reports it after the first layout. */
  async function renderSized() {
    const { fixture, host, one } = await render(PAIR);
    for (const [name, value] of [
      ['clientWidth', 800],
      ['clientHeight', 600],
    ] as const) {
      Object.defineProperty(host, name, { configurable: true, value });
    }
    resize(new Map([[host, { w: 800, h: 600 }]]));
    const view: NeatDiagramView = fixture.debugElement.query(
      By.directive(NeatDiagramView),
    ).componentInstance;
    return { fixture, host, one, view };
  }

  it('is a tab stop, for the keys that pan and zoom it', async () => {
    const { host } = await render(PAIR);
    expect(host.getAttribute('tabindex')).toBe('0');
  });

  it('fits the level to its box on first render, moving the content container', async () => {
    const { host, one } = await renderSized();
    const t = zoomTransform(host);
    expect(t.k).toBeCloseTo(FITTED.k, 6);
    expect(t.x).toBeCloseTo(FITTED.x, 6);
    expect(t.y).toBeCloseTo(FITTED.y, 6);
    expect(one('.content').style.transform).toBe(`translate(${t.x}px, ${t.y}px) scale(${t.k})`);
    expect(one('.content').style.getPropertyValue('--diagram-zoom')).toBe(String(t.k));
  });

  it('keeps the user’s view when an equal diagram arrives (a poll recomputing it)', async () => {
    const { fixture, host } = await renderSized();
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const moved = zoomTransform(host);

    fixture.componentInstance.diagram.set(structuredClone(PAIR));
    await fixture.whenStable();

    expect(zoomTransform(host)).toEqual(moved);
  });

  it('fits again by fit(), for an app’s Fit button', async () => {
    const { host, view } = await renderSized();
    host.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
    expect(zoomTransform(host).k).toBeCloseTo(FITTED.k * 1.25, 6);

    view.fit();

    expect(zoomTransform(host).k).toBeCloseTo(FITTED.k, 6);
    expect(zoomTransform(host).x).toBeCloseTo(FITTED.x, 6);
  });

  it('gives each edge a hit path along its line, 12 px wide on screen at any zoom', async () => {
    const { one } = await render(PAIR);
    const edge = one('g[data-edge="frames"]');
    const hit = edge.querySelector('path.hit');
    expect(hit?.getAttribute('d')).toBe(edge.querySelector('path.line')?.getAttribute('d'));
    // Under the line, so the line is drawn over it.
    expect(edge.firstElementChild).toBe(hit);
    // Its width is divided by the zoom, which the content container carries: a CSS transform on
    // an HTML ancestor is not undone by `vector-effect: non-scaling-stroke` (checked in Chromium).
    const rule = /\n\.hit \{([^}]*)\}/.exec(diagramStyles)?.[1] ?? '';
    expect(rule).toMatch(/stroke-width: calc\(12px \/ var\(--diagram-zoom\)\);/);
  });
});
