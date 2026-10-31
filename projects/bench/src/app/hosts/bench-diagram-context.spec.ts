import { Component, inject, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import {
  DIAGRAM_MESSAGES_CONTEXT,
  type DiagramMessagesContext,
  type DiagramTransform,
  type MessagesLevel,
  type Rect,
} from '@bench/diagram-seam';
import { BenchDiagramContext } from './bench-diagram-context';

/** Stands where the dot layer would, and keeps the context it was given. */
@Component({ selector: 'bench-layer-probe', template: '' })
class LayerProbe {
  readonly context = inject(DIAGRAM_MESSAGES_CONTEXT);
}

@Component({
  imports: [BenchDiagramContext, LayerProbe],
  template: `
    <div
      benchDiagramContext
      [level]="level()"
      [covers]="covers()"
      [edgeIds]="edgeIds()"
      [viewTransform]="view()"
    >
      <bench-layer-probe />
    </div>
  `,
})
class Host {
  readonly level = signal<MessagesLevel>({
    key: 'overview',
    edges: [{ id: 'e0', from: 'a', to: 'b', series: 1, line: 'solid', points: [] }],
  });
  readonly covers = signal<readonly Rect[]>([{ x: 1, y: 2, w: 3, h: 4 }]);
  readonly edgeIds = signal<ReadonlySet<string>>(new Set(['e0', 'e1']));
  readonly view = signal<DiagramTransform>({ k: 0.5, x: 10, y: 20 });
}

describe('BenchDiagramContext', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let context: DiagramMessagesContext;
  let benchContext: BenchDiagramContext;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
    context = fixture.debugElement.children[0].children[0].injector.get(LayerProbe).context;
    benchContext = fixture.debugElement.children[0].injector.get(BenchDiagramContext);
  });

  it('gives the layer under it the level, covers and edge ids its host binds', () => {
    expect(context.level()).toBe(host.level());
    expect(context.covers()).toBe(host.covers());
    expect(context.edgeIds()).toBe(host.edgeIds());
  });

  it('reads the transform now, and keeps nothing in focus (the bench exercises no hover)', () => {
    expect(context.transform()).toEqual({ k: 0.5, x: 10, y: 20 });
    expect(context.focus()).toBeNull();
  });

  it('tells each listener of a new transform until it stops listening', async () => {
    const heard: DiagramTransform[] = [];
    const stop = context.onTransform(() => heard.push(context.transform()));

    host.view.set({ k: 2, x: 0, y: 0 });
    await fixture.whenStable();
    stop();
    host.view.set({ k: 3, x: 0, y: 0 });
    await fixture.whenStable();

    expect(heard).toEqual([{ k: 2, x: 0, y: 0 }]);
  });

  describe('setTransform', () => {
    it('is the transform now, and tells the listeners at once, with no change detection', () => {
      const heard: DiagramTransform[] = [];
      context.onTransform(() => heard.push(context.transform()));

      benchContext.setTransform({ k: 2, x: 5, y: 6 });

      expect(context.transform()).toEqual({ k: 2, x: 5, y: 6 });
      expect(heard).toEqual([{ k: 2, x: 5, y: 6 }]);
    });

    it('writes no signal: the bound transform is untouched and nothing is scheduled', async () => {
      benchContext.setTransform({ k: 2, x: 5, y: 6 });

      expect(benchContext.viewTransform()).toEqual({ k: 0.5, x: 10, y: 20 });
      expect(fixture.isStable()).toBe(true);
    });

    it('gives way to the host’s binding when that changes', async () => {
      const heard: DiagramTransform[] = [];
      context.onTransform(() => heard.push(context.transform()));
      benchContext.setTransform({ k: 2, x: 5, y: 6 });

      host.view.set({ k: 0.25, x: 1, y: 2 });
      await fixture.whenStable();

      expect(context.transform()).toEqual({ k: 0.25, x: 1, y: 2 });
      expect(heard[heard.length - 1]).toEqual({ k: 0.25, x: 1, y: 2 });
    });
  });
});
