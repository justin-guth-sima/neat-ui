import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DIAGRAM_MESSAGES_CONTEXT } from '@bench/diagram-seam';
import { NeatDiagramMessages } from '@sima/neat-ui/diagram';
import { BenchLoad } from './bench-load';
import { stubBoxSize, stubLayout } from './browser.testing';
import { NoneHost } from './none-host';
import { startTransform } from './scene';

describe('NoneHost', () => {
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
    const fixture = TestBed.createComponent(NoneHost);
    await fixture.whenStable();
    const layer = fixture.debugElement.query(By.directive(NeatDiagramMessages));
    return { element: fixture.nativeElement as HTMLElement, layer };
  }

  it('draws nothing but the kit’s dot layer, over an empty box', async () => {
    const { element, layer } = await render();

    expect(layer).not.toBeNull();
    expect(element.querySelector('neat-diagram, vflow, svg')).toBeNull();
  });

  it('gives the layer the scene the other hosts draw: routes, covers and edge ids', async () => {
    const { layer } = await render();
    const context = layer.injector.get(DIAGRAM_MESSAGES_CONTEXT);
    const scene = TestBed.inject(BenchLoad).scene();

    expect(context.level()).toBe(scene.level);
    expect(context.covers()).toBe(scene.covers);
    expect(context.edgeIds()).toBe(scene.edgeIds);
  });

  it('shows the scene at the kit’s fit for its box, as the other hosts start', async () => {
    stubBoxSize(1920, 1080);
    const { layer } = await render();
    const context = layer.injector.get(DIAGRAM_MESSAGES_CONTEXT);
    const scene = TestBed.inject(BenchLoad).scene();

    expect(context.transform()).toEqual(startTransform(scene, { w: 1920, h: 1080 }));
  });

  it('feeds its layer the step’s messages', async () => {
    const push = vi.spyOn(NeatDiagramMessages.prototype, 'push');
    await render();

    const { messageEdges } = TestBed.inject(BenchLoad).synth();
    expect(push).toHaveBeenCalled();
    for (const [edge] of push.mock.calls) expect(messageEdges).toContain(edge);
  });
});
