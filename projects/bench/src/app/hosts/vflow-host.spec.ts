import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DIAGRAM_MESSAGES_CONTEXT, type Rect } from '@bench/diagram-seam';
import { NeatDiagramMessages } from '@sima/neat-ui/diagram';
import { VflowComponent } from 'ngx-vflow';
import { D1 } from '../synth/synth-diagram';
import { BenchLoad } from './bench-load';
import { stubLayout } from './browser.testing';
import { VflowHost } from './vflow-host';
import type { VflowGraph } from './vflow-graph';

describe('VflowHost', () => {
  beforeEach(() => {
    stubLayout();
    // Only the feed's interval is faked: change detection's own timers stay real.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    // The host goes first, so nothing it scheduled outlives the stand-ins.
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function render() {
    const fixture = TestBed.createComponent(VflowHost);
    await fixture.whenStable();
    const flow = fixture.debugElement.query(By.directive(VflowComponent));
    const layer = fixture.debugElement.query(By.directive(NeatDiagramMessages));
    return { fixture, flow, layer };
  }

  it('draws the scene with ngx-vflow: frames as SVG, blocks and notes as HTML', async () => {
    const { flow } = await render();
    const element = flow.nativeElement as HTMLElement;

    expect(element.querySelectorAll('rect.frame')).toHaveLength(D1.frames);
    expect(element.querySelectorAll('foreignObject .block')).toHaveLength(D1.blocks);
    expect(element.querySelectorAll('foreignObject .note bench-note')).toHaveLength(D1.notes);
    expect(element.querySelectorAll('g.edge path.line')).toHaveLength(D1.edges);
  });

  it('names every frame by its id, as the kit does, for the fairness check', async () => {
    const { flow } = await render();
    const element = flow.nativeElement as HTMLElement;
    const { nodes } = TestBed.inject(BenchLoad).synth().diagram.overview;

    const frames = Array.from(element.querySelectorAll('rect.frame')).map((frame) =>
      frame.getAttribute('data-node'),
    );
    expect(frames).toEqual(nodes.filter((node) => node.role === 'frame').map((node) => node.id));
  });

  it('draws each edge on the kit’s route, in its colour and line', async () => {
    const { flow } = await render();
    const element = flow.nativeElement as HTMLElement;
    const { drawn } = TestBed.inject(BenchLoad).scene();

    for (const edge of drawn.edges) {
      const group = element.querySelector(`g.edge[data-edge="${edge.id}"]`) as SVGGElement;
      expect(group.querySelector('path.line')?.getAttribute('d')).toBe(edge.path);
      expect(group.getAttribute('data-line')).toBe(edge.line);
      expect(group.style.getPropertyValue('--edge')).toBe(edge.colour);
      expect(group.querySelectorAll('.tip')).toHaveLength(edge.tips.length);
    }
  });

  it('puts the kit’s dot layer over vflow, with the scene and vflow’s viewport', async () => {
    const { flow, layer } = await render();
    const context = layer.injector.get(DIAGRAM_MESSAGES_CONTEXT);
    const scene = TestBed.inject(BenchLoad).scene();
    const viewport = (flow.componentInstance as VflowComponent).viewport();

    expect(context.level()).toBe(scene.level);
    expect(context.covers()).toBe(scene.covers);
    expect(context.edgeIds()).toBe(scene.edgeIds);
    expect(context.transform()).toEqual({ k: viewport.zoom, x: viewport.x, y: viewport.y });
  });

  it('has the dots pass behind exactly the nodes vflow places: covers are their absolute rects', async () => {
    const { fixture, layer } = await render();
    // The nodes the host hands vflow: its `graph`, which the template binds.
    const { nodes } = (fixture.componentInstance as unknown as { graph(): VflowGraph }).graph();
    const byId = new Map(nodes.map((node) => [node.id, node]));
    // vflow places a node at its point plus its parents' points: the absolute rect it draws at.
    const absolute = (node: (typeof nodes)[number]): Rect => {
      let x = node.point().x;
      let y = node.point().y;
      for (let parent = node.parentId?.(); parent; parent = byId.get(parent)?.parentId?.()) {
        const at = byId.get(parent)?.point();
        x += at?.x ?? 0;
        y += at?.y ?? 0;
      }
      const sized = node as { width?: () => number; height?: () => number };
      return { x, y, w: sized.width?.() ?? 0, h: sized.height?.() ?? 0 };
    };
    const placed = nodes.filter((node) => node.type === 'html-template').map(absolute);

    const covers = layer.injector.get(DIAGRAM_MESSAGES_CONTEXT).covers();
    expect(placed.length).toBe(D1.blocks + D1.notes);
    expect(covers).toEqual(placed);
  });

  it('feeds its layer the step’s messages', async () => {
    const push = vi.spyOn(NeatDiagramMessages.prototype, 'push');
    await render();

    const { messageEdges } = TestBed.inject(BenchLoad).synth();
    expect(push).toHaveBeenCalled();
    for (const [edge] of push.mock.calls) expect(messageEdges).toContain(edge);
  });
});
