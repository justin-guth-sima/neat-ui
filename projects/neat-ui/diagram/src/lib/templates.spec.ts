import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatDiagramView } from './diagram';
import { layoutEdges } from './layout';
import type { NeatDiagram, NeatDiagramSet } from './model';
import { placeNotes } from './notes';
import { resetReported } from './report';
import { resize, stubResizeObserver, watched } from './resize-observer.testing';
import { NeatDiagramBlockTemplate, NeatDiagramNoteTemplate } from './templates';

/** Two blocks and an edge between them; notes about the edge and about a point. */
const OVERVIEW: NeatDiagram = {
  nodes: [
    { id: 'camera', role: 'block', label: 'Camera', x: 0, y: 0, w: 120, h: 40 },
    { id: 'decode', role: 'block', label: 'Decode', x: 300, y: 0, w: 120, h: 40 },
    { id: 'graph', role: 'bracket', label: 'Graph', x: 0, y: 60, w: 420, h: 30 },
  ],
  edges: [{ id: 'frames', from: 'camera', to: 'decode', series: 1 }],
  notes: [
    { id: 'rate', edges: ['frames'], dy: 60 },
    { id: 'quiet', anchor: { x: 60, y: 40 }, dy: 50 },
  ],
};

@Component({
  imports: [NeatDiagramView, NeatDiagramBlockTemplate, NeatDiagramNoteTemplate],
  template: `
    <neat-diagram [diagram]="diagram()" label="Camera pipeline">
      <ng-template neatDiagramBlock let-node>
        @if (node.id === 'decode') {
          <span class="figure">{{ node.label }}: 30 fps</span>
        }
      </ng-template>
      @if (notes()) {
        <ng-template neatDiagramNote let-note>
          @if (note.id === 'rate') {
            <b>{{ note.id }}</b> 30 msg/s
          }
        </ng-template>
      }
    </neat-diagram>
  `,
})
class TemplatesHost {
  readonly diagram = signal<NeatDiagramSet>({ overview: OVERVIEW });
  readonly notes = signal(true);
}

async function render() {
  const fixture = TestBed.createComponent(TemplatesHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const one = (selector: string) => root.querySelector<HTMLElement>(selector) as HTMLElement;
  return {
    fixture,
    one,
    all: (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector)),
    note: (id: string) => one(`.note[data-note="${id}"]`),
    refresh: () => fixture.whenStable(),
  };
}

describe('the diagram’s templates', () => {
  beforeEach(() => stubResizeObserver());
  afterEach(() => {
    vi.unstubAllGlobals();
    resetReported();
  });

  it('renders the block template in each block, below its label, with the node', async () => {
    const { one } = await render();
    const decode = one('[data-node="decode"]');
    const figure = decode.querySelector('.text .body .figure');
    expect(figure?.textContent?.trim()).toBe('Decode: 30 fps');
    const label = decode.querySelector('.text .label') as Element;
    expect(
      label.compareDocumentPosition(figure as Element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // A block the template has nothing for gets an empty body, which takes no room (CSS).
    expect(one('[data-node="camera"] .figure')).toBeNull();
    // Brackets take no body.
    expect(one('[data-node="graph"] .body')).toBeNull();
  });

  it('renders the note template for each note and measures it before placing it', async () => {
    const { note, refresh } = await render();
    expect(note('rate').textContent?.replace(/\s+/g, ' ').trim()).toBe('rate 30 msg/s');
    // Not placed until measured: hidden, no leader.
    expect(note('rate').classList).not.toContain('placed');
    expect(watched()).toContain(note('rate'));

    resize(new Map([[note('rate'), { w: 100, h: 40 }]]));
    await refresh();
    const placement = placeNotes(
      OVERVIEW,
      layoutEdges(OVERVIEW),
      new Map([['rate', { w: 100, h: 40 }]]),
    ).get('rate')!;
    expect(note('rate').classList).toContain('placed');
    expect(parseFloat(note('rate').style.left)).toBe(placement.box.x);
    expect(parseFloat(note('rate').style.top)).toBe(placement.box.y);
    // The dotted leader from the anchor (a dot) to the box, in the edges' SVG.
    const leader = document.querySelector('svg.edges [data-note="rate"]') as SVGGElement;
    const [from, to] = placement.leader!;
    const line = leader.querySelector('line') as SVGLineElement;
    expect(['x1', 'y1', 'x2', 'y2'].map((a) => Number(line.getAttribute(a)))).toEqual([
      from.x,
      from.y,
      to.x,
      to.y,
    ]);
    const dot = leader.querySelector('circle') as SVGCircleElement;
    expect([Number(dot.getAttribute('cx')), Number(dot.getAttribute('cy'))]).toEqual([
      from.x,
      from.y,
    ]);
  });

  it('draws no note the template renders nothing for, and no leader for it', async () => {
    const { note, refresh } = await render();
    resize(
      new Map([
        [note('rate'), { w: 100, h: 40 }],
        [note('quiet'), { w: 20, h: 12 }],
      ]),
    );
    await refresh();
    expect(note('quiet').classList).not.toContain('placed');
    expect(document.querySelector('svg.edges [data-note="quiet"]')).toBeNull();
    expect(note('rate').classList).toContain('placed');
  });

  it('draws no notes without a note template, and stops measuring them', async () => {
    const { all, note, fixture, refresh } = await render();
    expect(all('.note')).toHaveLength(2);
    resize(new Map([[note('rate'), { w: 100, h: 40 }]]));
    await refresh();
    expect(all('svg.edges .leader')).toHaveLength(1);
    fixture.componentInstance.notes.set(false);
    await refresh();
    expect(all('.note')).toEqual([]);
    expect(all('svg.edges .leader')).toEqual([]);
    expect(watched()).toEqual([]);
  });

  it('keeps a measured note placed when an equal diagram arrives', async () => {
    const { note, fixture, refresh } = await render();
    const rate = note('rate');
    const leader = () => document.querySelector('svg.edges [data-note="rate"]');
    resize(new Map([[rate, { w: 100, h: 40 }]]));
    await refresh();
    const drawn = leader();
    expect(drawn).not.toBeNull();
    fixture.componentInstance.diagram.set(structuredClone({ overview: OVERVIEW }));
    await refresh();
    expect(note('rate')).toBe(rate);
    expect(rate.classList).toContain('placed');
    expect(leader()).toBe(drawn);
  });
});
