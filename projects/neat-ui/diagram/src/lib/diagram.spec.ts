import { Component, signal } from '@angular/core';
import type { MockInstance } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { zoomTransform } from 'd3-zoom';
import { ɵSTALE_CLASSES } from '@sima/neat-ui';
import { NeatDiagramView } from './diagram';
import diagramStyles from './diagram.css' with { loader: 'text' };
import frameStyles from './frames.css' with { loader: 'text' };
import { fitTransform } from './fit';
import { layoutEdges } from './layout';
import { TIP_GAP } from './hover';
import type { NeatDiagram, NeatDiagramHighlight, NeatDiagramNode, NeatDiagramSet } from './model';
import { resetReported } from './report';
import { resize, stubResizeObserver } from './resize-observer.testing';
import { pointAlong } from './route';
import { NeatDiagramEdgeTipTemplate, NeatDiagramNoteTemplate } from './templates';

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
    // The success tone's tint (NeatStatusChip's own classes): a block's chips are tinted, so a
    // card of several reads as labels rather than as a row of solid badges.
    expect(chips[0].classList).toContain('bg-neat-tint-success-accent');
    expect(chips[0].classList).toContain('text-success');
    expect(node('detect').querySelector('neat-status-chip')).toBeNull();
  });

  it('titles a frame in the base text size, a step above the blocks’ labels', async () => {
    const { node } = await render();
    expect(node('board').querySelector('.title')).not.toBeNull();
    const rule = /\n\.frame \.title \{([^}]*)\}/.exec(frameStyles)?.[1] ?? '';
    expect(rule).toMatch(/font-size:\s*var\(--neat-text-base\);/);
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
    expect(one('svg.edges').style.getPropertyValue('--diagram-zoom')).toBe(String(t.k));
    expect(one('.content').style.getPropertyValue('--diagram-zoom')).toBe('');
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
    // Its width is divided by the zoom, which the edges' SVG carries: a CSS transform on an HTML
    // ancestor is not undone by `vector-effect: non-scaling-stroke` (checked in Chromium).
    const rule = /\n\.hit \{([^}]*)\}/.exec(diagramStyles)?.[1] ?? '';
    expect(rule).toMatch(/stroke-width: calc\(12px \/ var\(--diagram-zoom\)\);/);
  });
});

const block = (id: string, label: string, x: number, more: Partial<NeatDiagramNode> = {}) =>
  ({ id, role: 'block', label, x, y: 0, w: 120, h: 40, ...more }) as NeatDiagramNode;

/**
 * A board frame behind Camera → Decode → Sink, Decode opening "stages", which opens "inner";
 * a note on the second edge. "orphan" is a level no block opens.
 */
const LEVELS: NeatDiagramSet = {
  overview: {
    nodes: [
      { id: 'board', role: 'frame', label: 'Board', x: -20, y: -40, w: 580, h: 120 },
      block('camera', 'Camera', 0, { detail: 'USB' }),
      block('decode', 'Decode', 200, {
        opens: 'stages',
        chips: [{ label: 'HW', tone: 'success' }],
      }),
      block('sink', 'Sink', 400),
    ],
    edges: [
      { id: 'frames', from: 'camera', to: 'decode', label: '1080p' },
      { id: 'images', from: 'decode', to: 'sink' },
    ],
    notes: [{ id: 'rate', edges: ['images'], dy: 60 }],
  },
  levels: {
    stages: {
      nodes: [
        block('resize', 'Resize', 0, { opens: 'inner', detail: '640 × 640' }),
        block('yolox', 'YOLOX', 200, { chips: [{ label: 'MLA', tone: 'info' }] }),
      ],
      edges: [{ id: 'tensors', from: 'resize', to: 'yolox', label: 'image' }],
    },
    inner: { nodes: [block('tile', 'Tile', 0)], edges: [] },
    orphan: { nodes: [block('lost', 'Lost', 0)], edges: [] },
  },
};

@Component({
  imports: [NeatDiagramView, NeatDiagramEdgeTipTemplate, NeatDiagramNoteTemplate],
  template: `
    <neat-diagram [diagram]="diagram()" label="Levels" [highlight]="highlight()" [(level)]="level">
      <ng-template neatDiagramEdgeTip let-edge
        ><b class="said">About {{ edge.id }}</b></ng-template
      >
      <ng-template neatDiagramNote let-note>Note {{ note.id }}</ng-template>
    </neat-diagram>
  `,
})
class LevelsHost {
  readonly diagram = signal<NeatDiagramSet>(LEVELS);
  readonly level = signal<string[]>([]);
  readonly highlight = signal<NeatDiagramHighlight>('all');
}

describe('NeatDiagramView’s hover, levels and words', () => {
  beforeEach(() => {
    stubResizeObserver();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  async function renderLevels(level: string[] = []) {
    const fixture = TestBed.createComponent(LevelsHost);
    fixture.componentInstance.level.set(level);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const one = (selector: string) => root.querySelector<HTMLElement>(selector) as HTMLElement;
    const all = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
    const host = one('neat-diagram');
    const stable = () => fixture.whenStable();
    return {
      fixture,
      host,
      one,
      all,
      stable,
      node: (id: string) => one(`[data-node="${id}"]`),
      edge: (id: string) => one(`g[data-edge="${id}"]`),
      label: (id: string) => one(`.edge-label[data-edge="${id}"]`),
      note: (id: string) => one(`.note[data-note="${id}"]`),
      /** What carries the class `dim`, by its data id. */
      dimmed: () =>
        all('.dim').map(
          (el) => el.dataset['node'] ?? el.dataset['note'] ?? `${el.tagName}:${el.dataset['edge']}`,
        ),
      async pointer(type: string, target: Element, init: PointerEventInit = {}) {
        const event = new PointerEvent(type, {
          bubbles: type !== 'pointerleave',
          pointerType: 'mouse',
          ...init,
        });
        target.dispatchEvent(event);
        await stable();
      },
      async click(element: HTMLElement) {
        element.click();
        await stable();
      },
      level: () => fixture.componentInstance.level(),
      shownIds: () => all('[data-node]').map((el) => el.dataset['node']),
    };
  }

  describe('hover', () => {
    it('dims all but a hovered block and its edges to 0.25, until it leaves', async () => {
      const view = await renderLevels();
      expect(view.dimmed()).toEqual([]);

      await view.pointer('pointerover', view.node('camera').querySelector('.label')!);

      // Its edge and that edge's label stay; the other blocks, edges and notes fade. A frame is
      // the ground the parts sit on and never fades.
      expect(view.dimmed().sort()).toEqual(['decode', 'g:images', 'rate', 'sink']);
      expect(view.node('board').classList).not.toContain('dim');

      await view.pointer('pointerleave', view.host);
      expect(view.dimmed()).toEqual([]);
      // At the diagram's dim, which the messaging layer's dots take too.
      const rule = /\n\.dim \{([^}]*)\}/.exec(diagramStyles)?.[1] ?? '';
      expect(rule).toMatch(/opacity: var\(--diagram-dim\);/);
      const host = /\n:host \{([^}]*)\}/.exec(diagramStyles)?.[1] ?? '';
      expect(host).toMatch(/--diagram-dim: 0\.25;/);
    });

    it('puts an edge in focus with its ends and its notes, by its hit path', async () => {
      const view = await renderLevels();
      await view.pointer('pointerover', view.edge('images').querySelector('.hit')!);
      expect(view.dimmed().sort()).toEqual(['CODE:frames', 'camera', 'g:frames']);
      expect(view.note('rate').classList).not.toContain('dim');

      // Onto the empty box: nothing is in focus.
      await view.pointer('pointermove', view.one('.content'));
      expect(view.dimmed()).toEqual([]);
    });

    it('puts nothing in focus for a touch or while a button is held (a drag)', async () => {
      const view = await renderLevels();
      await view.pointer('pointerover', view.node('camera'), { pointerType: 'touch' });
      expect(view.dimmed()).toEqual([]);
      await view.pointer('pointermove', view.node('camera'), { buttons: 1 });
      expect(view.dimmed()).toEqual([]);
    });

    it('puts a block in focus while its open button has the keyboard’s focus', async () => {
      const view = await renderLevels();
      const decode = view.node('decode');
      // As the keyboard moves the focus: Tab, then the focus (jsdom judges :focus-visible so).
      view.host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      decode.focus();
      await view.stable();
      expect(view.dimmed().sort()).toEqual(['camera', 'sink']);

      // Its keys are the button's: an arrow does not pan the box.
      const arrow = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        cancelable: true,
      });
      decode.dispatchEvent(arrow);
      expect(arrow.defaultPrevented).toBe(false);

      decode.blur();
      await view.stable();
      expect(view.dimmed()).toEqual([]);
    });

    it('puts nothing in focus when a press focuses an open button (a pan from a block)', async () => {
      const view = await renderLevels();
      const decode = view.node('decode');
      // d3-zoom follows a press on the event's window, which jsdom refuses in the constructor.
      const press = (type: string) => {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'view', { value: window });
        return event;
      };
      decode.dispatchEvent(press('mousedown'));
      decode.focus();
      window.dispatchEvent(press('mouseup'));
      await view.stable();
      expect(document.activeElement).toBe(decode);
      expect(view.dimmed()).toEqual([]);
    });
  });

  describe('highlight', () => {
    const tab = (view: { host: HTMLElement }) =>
      view.host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    it('is none by default: nothing dims, for a block, an edge or the keyboard', async () => {
      const fixture = TestBed.createComponent(NeatDiagramView);
      fixture.componentRef.setInput('diagram', LEVELS);
      fixture.componentRef.setInput('label', 'Plain');
      await fixture.whenStable();
      expect(fixture.componentInstance.highlight()).toBe('none');
    });

    it('none: dims nothing for a block, an edge or a focused open button, but still tips', async () => {
      const view = await renderLevels();
      view.fixture.componentInstance.highlight.set('none');
      await view.stable();

      await view.pointer('pointerover', view.node('camera').querySelector('.label')!);
      expect(view.dimmed()).toEqual([]);

      await view.pointer('pointerover', view.edge('images').querySelector('.hit')!);
      expect(view.dimmed()).toEqual([]);
      expect(view.one('.edge-tip').textContent?.trim()).toBe('About images');

      await view.pointer('pointerleave', view.host);
      tab(view);
      view.node('decode').focus();
      await view.stable();
      expect(view.dimmed()).toEqual([]);
    });

    it('edges: dims all but a hovered edge, its blocks and its notes; a block dims nothing', async () => {
      const view = await renderLevels();
      view.fixture.componentInstance.highlight.set('edges');
      await view.stable();

      await view.pointer('pointerover', view.edge('images').querySelector('.hit')!);
      expect(view.dimmed().sort()).toEqual(['CODE:frames', 'camera', 'g:frames']);

      await view.pointer('pointerleave', view.host);
      await view.pointer('pointerover', view.node('camera').querySelector('.label')!);
      expect(view.dimmed()).toEqual([]);

      await view.pointer('pointerleave', view.host);
      tab(view);
      view.node('decode').focus();
      await view.stable();
      expect(view.dimmed()).toEqual([]);
    });

    it('all: dims for a block as for an edge', async () => {
      const view = await renderLevels();
      await view.pointer('pointerover', view.node('camera').querySelector('.label')!);
      expect(view.dimmed().sort()).toEqual(['decode', 'g:images', 'rate', 'sink']);
    });
  });

  describe('the edge tip', () => {
    it('shows the app’s template for the edge under the pointer, and only then', async () => {
      const view = await renderLevels();
      expect(view.one('.edge-tip')).toBeNull();

      await view.pointer('pointerover', view.edge('images').querySelector('.hit')!);
      expect(view.one('.edge-tip').textContent?.trim()).toBe('About images');
      // Presentational: the hidden list says each edge in words.
      expect(view.one('.edge-tip').getAttribute('aria-hidden')).toBe('true');

      // An edge's label is the edge too.
      await view.pointer('pointerover', view.label('frames'));
      expect(view.one('.edge-tip').textContent?.trim()).toBe('About frames');

      await view.pointer('pointerover', view.node('sink'));
      expect(view.one('.edge-tip')).toBeNull();
      await view.pointer('pointerover', view.edge('frames').querySelector('.hit')!);
      await view.pointer('pointerleave', view.host);
      expect(view.one('.edge-tip')).toBeNull();
    });

    it('places the tip by the pointer, in the box, outside the zoomed content', async () => {
      const view = await renderLevels();
      for (const [name, value] of [
        ['clientWidth', 800],
        ['clientHeight', 600],
      ] as const) {
        Object.defineProperty(view.host, name, { configurable: true, value });
      }
      const hit = view.edge('frames').querySelector('.hit')!;
      await view.pointer('pointerover', hit, { clientX: 50, clientY: 30 });
      const tip = view.one('.edge-tip');
      expect(tip.parentElement).toBe(view.host);
      expect({ left: tip.style.left, top: tip.style.top }).toEqual({
        left: `${50 + TIP_GAP}px`,
        top: `${30 + TIP_GAP}px`,
      });

      await view.pointer('pointermove', hit, { clientX: 70, clientY: 40 });
      expect(tip.style.left).toBe(`${70 + TIP_GAP}px`);
    });
  });

  describe('levels', () => {
    it('draws a block that opens a level as a button that opens it', async () => {
      const view = await renderLevels();
      const decode = view.node('decode');
      expect(decode.tagName).toBe('BUTTON');
      expect(decode.getAttribute('type')).toBe('button');
      expect(decode.getAttribute('aria-label')).toBe('Open Decode');
      expect(view.node('camera').tagName).toBe('DIV');
      expect(view.one('.bar')).toBeNull();

      decode.focus();
      await view.click(decode);

      expect(view.level()).toEqual(['stages']);
      expect(view.shownIds()).toEqual(['resize', 'yolox']);
      // The button went with its level; the focus stays in the diagram, on its box.
      expect(document.activeElement).toBe(view.host);
      expect(view.dimmed()).toEqual([]);

      await view.click(view.node('resize'));
      expect(view.level()).toEqual(['stages', 'inner']);
      expect(view.shownIds()).toEqual(['tile']);
    });

    it('goes back a level by the bar’s back button, named after the level it goes to', async () => {
      const view = await renderLevels(['stages', 'inner']);
      const back = () => view.one('.bar button[neatButton]');
      expect(back().textContent?.trim()).toBe('Decode');
      expect(back().getAttribute('aria-label')).toBe('Back to Decode');

      await view.click(back());
      expect(view.level()).toEqual(['stages']);
      expect(back().textContent?.trim()).toBe('Overview');
      expect(back().getAttribute('aria-label')).toBe('Back to Overview');

      await view.click(back());
      expect(view.level()).toEqual([]);
      expect(view.one('.bar')).toBeNull();
      expect(view.shownIds()).toEqual(['board', 'camera', 'decode', 'sink']);
    });

    it('shows the path as breadcrumbs, each but the last a button that goes there', async () => {
      const view = await renderLevels(['stages', 'inner']);
      const crumbs = view.all('.bar nav li');
      expect(view.one('.bar nav').getAttribute('aria-label')).toBe('Levels');
      expect(
        crumbs.map((li) => li.querySelector('button, [aria-current] > span')?.textContent?.trim()),
      ).toEqual(['Decode', 'Resize']);
      expect(crumbs[0].querySelector('button')).not.toBeNull();
      expect(crumbs[1].querySelector('button')).toBeNull();
      expect(crumbs[1].querySelector('[aria-current="location"]')).not.toBeNull();
      // The last crumb is where the user is: its opener's label, then its detail (muted).
      expect(crumbs[1].querySelector('[aria-current]')?.textContent).toBe('Resize 640 × 640');

      await view.click(crumbs[0].querySelector('button')!);
      expect(view.level()).toEqual(['stages']);
    });

    it('cuts a stale path to its valid start and says so through the model', async () => {
      const view = await renderLevels(['stages', 'gone']);
      expect(view.level()).toEqual(['stages']);
      expect(view.shownIds()).toEqual(['resize', 'yolox']);

      view.fixture.componentInstance.level.set(['orphan']);
      await view.stable();
      expect(view.level()).toEqual([]);
      expect(view.shownIds()).toEqual(['board', 'camera', 'decode', 'sink']);
    });

    it('keeps the open level, its parts and the user’s view given an equal diagram', async () => {
      const view = await renderLevels(['stages']);
      const emitted = vi.fn();
      const diagram: NeatDiagramView = view.fixture.debugElement.query(
        By.directive(NeatDiagramView),
      ).componentInstance;
      const subscription = diagram.level.subscribe(emitted);
      const resizeBlock = view.node('resize');
      view.host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      const moved = zoomTransform(view.host);

      view.fixture.componentInstance.diagram.set(structuredClone(LEVELS));
      await view.stable();

      expect(emitted).not.toHaveBeenCalled();
      expect(view.level()).toEqual(['stages']);
      expect(view.node('resize')).toBe(resizeBlock);
      expect(zoomTransform(view.host)).toEqual(moved);
      subscription.unsubscribe();
    });

    it('fits a level it opens, whatever the user did with the last one', async () => {
      const view = await renderLevels();
      for (const [name, value] of [
        ['clientWidth', 800],
        ['clientHeight', 600],
      ] as const) {
        Object.defineProperty(view.host, name, { configurable: true, value });
      }
      resize(new Map([[view.host, { w: 800, h: 600 }]]));
      view.host.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));

      await view.click(view.node('decode'));
      const opened = zoomTransform(view.host);
      const diagram: NeatDiagramView = view.fixture.debugElement.query(
        By.directive(NeatDiagramView),
      ).componentInstance;
      diagram.fit();

      expect(zoomTransform(view.host)).toEqual(opened);
    });
  });

  describe('the box', () => {
    it('clips what lies outside without scrolling, so focus never scrolls the drawing', () => {
      // `hidden` would make the box a scroll container, which a focused part scrolls into view.
      const host = /\n:host \{([^}]*)\}/.exec(diagramStyles)?.[1] ?? '';
      expect(host).toMatch(/overflow: clip;/);
    });

    it('puts the level bar first in the tab order, painted over the drawing', async () => {
      const view = await renderLevels(['stages']);
      expect(view.one('.bar').compareDocumentPosition(view.one('.content'))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      const bar = /\n\.bar \{([^}]*)\}/.exec(diagramStyles)?.[1] ?? '';
      expect(bar).toMatch(/z-index: 1;/);
    });
  });

  describe('a stale node', () => {
    const staleCard = (stale: boolean): NeatDiagramSet => ({
      overview: {
        nodes: [
          {
            id: 'a',
            role: 'block',
            label: 'Decode',
            detail: 'HW',
            x: 0,
            y: 0,
            w: 120,
            h: 40,
            stale,
          },
          {
            id: 'b',
            role: 'block',
            label: 'Sink',
            x: 200,
            y: 0,
            w: 120,
            h: 40,
            opens: 'in',
            stale,
          },
          { id: 'c', role: 'bracket', label: 'Graph', x: 0, y: 60, w: 320, h: 30, stale },
          { id: 'd', role: 'block', label: 'Fresh', x: 400, y: 0, w: 120, h: 40 },
        ],
        edges: [],
      },
      levels: { in: { nodes: [], edges: [] } },
    });

    it('greys out the whole card as [neatStale] does, and says so in the hidden list', async () => {
      const view = await renderLevels();
      view.fixture.componentInstance.diagram.set(staleCard(true));
      await view.stable();
      for (const id of ['a', 'b', 'c']) {
        for (const name of ɵSTALE_CLASSES.split(' '))
          expect(view.node(id).classList).toContain(name);
      }
      expect(view.node('d').className).not.toContain('opacity-55');
      const items = () =>
        Array.from(view.one('.sr-only ul[aria-label="Parts"]').querySelectorAll('li')).map((li) =>
          li.textContent?.trim(),
        );
      expect(items()).toEqual(['Decode, HW, stale', 'Sink, stale', 'Graph, stale', 'Fresh']);

      view.fixture.componentInstance.diagram.set(staleCard(false));
      await view.stable();
      expect(view.node('a').className).not.toContain('opacity-55');
      expect(view.node('b').className).not.toContain('opacity-55');
      expect(view.node('c').className).not.toContain('opacity-55');
      expect(items()).toEqual(['Decode, HW', 'Sink', 'Graph', 'Fresh']);
    });
  });

  describe('the hidden list', () => {
    it('says each node and edge of the level shown in words, after the drawing', async () => {
      const view = await renderLevels();
      const list = view.one('.sr-only');
      expect(view.one('.content').compareDocumentPosition(list)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      const items = (name: string) =>
        Array.from(list.querySelectorAll(`ul[aria-label="${name}"] li`)).map((li) =>
          li.textContent?.trim(),
        );
      expect(items('Parts')).toEqual(['Board', 'Camera, USB', 'Decode, HW', 'Sink']);
      expect(items('Connections')).toEqual(['Camera to Decode, 1080p', 'Decode to Sink']);

      await view.click(view.node('decode'));
      expect(items('Parts')).toEqual(['Resize, 640 × 640', 'YOLOX, MLA']);
      expect(items('Connections')).toEqual(['Resize to YOLOX, image']);
    });
  });
});
