import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DIAGRAM_MESSAGES_CONTEXT, type DiagramTransform, ZOOM_LIMITS } from '@bench/diagram-seam';
import { NeatDiagramMessages } from '@sima/neat-ui/diagram';
import { By } from '@angular/platform-browser';
import { type BenchHost, BenchHosts, readTransform, startMatches } from './bench-host';
import { BenchLoad } from './bench-load';
import { stubBoxSize, stubLayout } from './browser.testing';
import { KitHost } from './kit-host';
import { NoneHost } from './none-host';
import { startTransform } from './scene';
import { VflowHost } from './vflow-host';

const host = (id: BenchHost['id']): BenchHost => ({
  id,
  gestures: {
    rect: () => ({ left: 0, top: 0, width: 1, height: 1 }),
    transform: () => ({ k: 1, x: 0, y: 0 }),
    press: () => undefined,
    drag: () => undefined,
    release: () => undefined,
    wheel: () => undefined,
  },
  startTransform: () => null,
  fit: () => undefined,
});

describe('BenchHosts', () => {
  it('hands over the host that is drawn, once it is registered, and not after it is gone', async () => {
    const hosts = TestBed.inject(BenchHosts);
    const waiting = hosts.whenHost();
    const kit = host('kit');
    const unregister = hosts.register(kit);

    expect(await waiting).toBe(kit);
    expect(hosts.current).toBe(kit);
    unregister();
    expect(hosts.current).toBeNull();
  });

  it('answers at once when a host is already there', async () => {
    const hosts = TestBed.inject(BenchHosts);
    const none = host('none');
    hosts.register(none);
    expect(await hosts.whenHost()).toBe(none);
  });

  it('lets a later host take over, and the earlier one’s unregistering not remove it', () => {
    const hosts = TestBed.inject(BenchHosts);
    const first = hosts.register(host('kit'));
    const second = host('vflow');
    hosts.register(second);
    first();
    expect(hosts.current).toBe(second);
  });
});

describe('readTransform', () => {
  it('reads what the kit writes to its content’s style and what d3-zoom gives vflow’s group', () => {
    expect(readTransform('translate(24px, 299.5px) scale(0.605)')).toEqual({
      k: 0.605,
      x: 24,
      y: 299.5,
    });
    expect(readTransform('translate(-1080.25,16) scale(1.318e0)')).toEqual({
      k: 1.318,
      x: -1080.25,
      y: 16,
    });
    expect(readTransform('translate(1e-7px, -2.5E+2px) scale(3)')).toEqual({
      k: 3,
      x: 1e-7,
      y: -250,
    });
  });

  it('is the identity where nothing is set yet, as d3-zoom’s is', () => {
    expect(readTransform('')).toEqual({ k: 1, x: 0, y: 0 });
    expect(readTransform(null)).toEqual({ k: 1, x: 0, y: 0 });
    expect(readTransform(undefined)).toEqual({ k: 1, x: 0, y: 0 });
  });

  it('refuses a transform it cannot read, so a changed format does not read as the identity', () => {
    expect(() => readTransform('matrix(1, 0, 0, 1, 5, 5)')).toThrow(/matrix/);
  });
});

describe('startMatches', () => {
  const start: DiagramTransform = { k: 0.8, x: 100, y: 50 };

  it('holds a transform within 1 % in scale and 2 px as the start (the harness’s bound)', () => {
    expect(startMatches(start, start)).toBe(true);
    expect(startMatches({ k: 0.8 * 1.009, x: 101.9, y: 48.1 }, start)).toBe(true);
  });

  it('refuses a scale off by more, or a translation off by more', () => {
    expect(startMatches({ k: 0.8 * 1.02, x: 100, y: 50 }, start)).toBe(false);
    expect(startMatches({ k: 0.8, x: 102.5, y: 50 }, start)).toBe(false);
    expect(startMatches({ k: 0.8, x: 100, y: 47.5 }, start)).toBe(false);
  });

  it('is false while there is no start to compare with', () => {
    expect(startMatches(start, null)).toBe(false);
  });
});

describe('the hosts register themselves for the run', () => {
  beforeEach(() => {
    stubLayout();
    stubBoxSize(1920, 1080);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function render<T>(type: Type<T>) {
    const fixture = TestBed.createComponent(type);
    await fixture.whenStable();
    return { fixture, registered: TestBed.inject(BenchHosts).current };
  }

  it('the kit host, with its zoom box and the kit’s own key for a fit', async () => {
    const { fixture, registered } = await render(KitHost);
    const scene = TestBed.inject(BenchLoad).scene();

    expect(registered?.id).toBe('kit');
    expect(registered?.startTransform()).toEqual(startTransform(scene, { w: 1920, h: 1080 }));
    const box = fixture.nativeElement.querySelector('neat-diagram') as HTMLElement;
    const keys: string[] = [];
    box.addEventListener('keydown', (event) => keys.push((event as KeyboardEvent).key));
    registered?.fit();
    // The kit fits on its `0` key while its box has focus; a synthetic one goes to the box itself.
    expect(keys).toEqual(['0']);
  });

  it('the vflow host, with its root SVG as the zoom box', async () => {
    const { registered } = await render(VflowHost);
    const scene = TestBed.inject(BenchLoad).scene();

    expect(registered?.id).toBe('vflow');
    expect(registered?.startTransform()).toEqual(startTransform(scene, { w: 1920, h: 1080 }));
  });

  describe('the none host, which has no zoom box and moves by the reducers', () => {
    it('starts at the fit, and a gesture moves the transform without change detection', async () => {
      const { fixture, registered } = await render(NoneHost);
      const layer = fixture.debugElement.query(By.directive(NeatDiagramMessages));
      const context = layer.injector.get(DIAGRAM_MESSAGES_CONTEXT);
      const start = registered?.startTransform();
      const heard: DiagramTransform[] = [];
      context.onTransform(() => heard.push(context.transform()));

      expect(registered?.id).toBe('none');
      expect(context.transform()).toEqual(start);
      const { gestures } = registered as BenchHost;
      gestures.press(500, 500);
      gestures.drag(530, 480);
      gestures.release(530, 480);

      const after = context.transform();
      expect(after.x).toBeCloseTo((start?.x ?? 0) + 30, 9);
      expect(after.y).toBeCloseTo((start?.y ?? 0) - 20, 9);
      expect(heard).toHaveLength(1);
      expect(fixture.isStable()).toBe(true);
    });

    it('wheels to the zoom limit and fits back', async () => {
      const { fixture, registered } = await render(NoneHost);
      const layer = fixture.debugElement.query(By.directive(NeatDiagramMessages));
      const context = layer.injector.get(DIAGRAM_MESSAGES_CONTEXT);
      const { gestures } = registered as BenchHost;

      gestures.wheel(960, 540, 100_000, gestures.rect());
      expect(context.transform().k).toBe(ZOOM_LIMITS[0]);
      registered?.fit();
      expect(context.transform()).toEqual(registered?.startTransform());
    });

    it('fits the next step’s diagram on its own', async () => {
      const { fixture, registered } = await render(NoneHost);
      const layer = fixture.debugElement.query(By.directive(NeatDiagramMessages));
      const context = layer.injector.get(DIAGRAM_MESSAGES_CONTEXT);
      const load = TestBed.inject(BenchLoad);
      const first = context.transform();

      load.step.update((step) => ({ ...step, params: { ...step.params, blocks: 60, frames: 8 } }));
      await fixture.whenStable();

      expect(context.transform()).not.toEqual(first);
      expect(context.transform()).toEqual(registered?.startTransform());
    });

    it('unregisters when it is destroyed', async () => {
      const { fixture } = await render(NoneHost);
      fixture.destroy();
      expect(TestBed.inject(BenchHosts).current).toBeNull();
    });
  });
});
