import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeService } from '@sima/neat-ui';
import type { NeatOverlayClassStyle } from '@sima/neat-ui/video';
import { colorProbe } from '../../../src/lib/theme/theme-colors';
import { NeatBev } from './bev';
import { BevCanvas, type BevInputs, type BevTheme } from './bev-canvas';
import { FakeAnimationFrames, resize, stubCanvases, stubResizeObserver } from './canvas.testing';
import type { LabelColours } from './colours';
import type { BevView } from './geometry';
import type {
  NeatBevBounds,
  NeatBevFrame,
  NeatBevObjectId,
  NeatBevOverflow,
  NeatBevPick,
  NeatBevPoint,
  NeatBevShape,
} from './model';

@Component({
  imports: [NeatBev],
  template: `<neat-bev
    [frame]="frame()"
    [range]="range()"
    [shape]="shape()"
    [bounds]="bounds()"
    [overflow]="overflow()"
    [spokes]="spokes()"
    [styles]="styles()"
    [zoom]="zoom()"
    [panBounds]="panBounds()"
    [zoomExtent]="zoomExtent()"
    [(hovered)]="hovered"
    (activated)="picks.push($event)"
    (pointerMove)="points.push($event)"
  />`,
})
class Host {
  readonly frame = signal<NeatBevFrame | null>(null);
  readonly range = signal(60);
  readonly shape = signal<NeatBevShape>('round');
  readonly bounds = signal<NeatBevBounds | null>(null);
  readonly overflow = signal<NeatBevOverflow>('clip');
  readonly zoom = signal(false);
  readonly panBounds = signal<NeatBevBounds | null>(null);
  readonly zoomExtent = signal<readonly [number, number]>([1, 4]);
  readonly hovered = signal<NeatBevObjectId | null>(null);
  readonly picks: NeatBevPick[] = [];
  readonly points: (NeatBevPoint | null)[] = [];
  readonly spokes = signal<number>(12);
  readonly styles = signal<readonly NeatOverlayClassStyle[]>([]);
}

type DrawArgs = [number, BevView, BevInputs, BevTheme, LabelColours, NeatBevFrame | null, number];

describe('NeatBev', () => {
  const frames = new FakeAnimationFrames();
  let draws: DrawArgs[];
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let element: HTMLElement;
  let hidden = false;

  beforeEach(async () => {
    frames.install();
    stubResizeObserver();
    stubCanvases();
    colorProbe.context = null;
    hidden = false;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    vi.stubGlobal('devicePixelRatio', 2);
    // Zoom and reset jump instead of animating, so each step is checked at once.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    draws = [];
    const draw = BevCanvas.prototype.draw;
    vi.spyOn(BevCanvas.prototype, 'draw').mockImplementation(function (
      this: BevCanvas,
      ...args: DrawArgs
    ) {
      draws.push(args);
      return draw.apply(this, args);
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
    element = fixture.nativeElement.querySelector('neat-bev');
    resize(element, 400, 300);
    frames.run();
  });

  afterEach(() => {
    colorProbe.context = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Lets change detection run the inputs' effects. */
  const settle = (): Promise<void> => fixture.whenStable();

  it('is a figure named by its label, a tab stop only while it zooms', async () => {
    expect(element.getAttribute('role')).toBe('figure');
    expect(element.getAttribute('aria-label')).toBe("Bird's-eye view");
    expect(element.hasAttribute('tabindex')).toBe(false);
    expect(element.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
    host.zoom.set(true);
    await settle();
    expect(element.tabIndex).toBe(0);
  });

  it("takes the shape's proportions for its height", async () => {
    expect(element.style.aspectRatio).toBe('1 / 1');
    host.shape.set('rect');
    host.bounds.set({ x: [-20, 80], y: [-30, 30] });
    await settle();
    expect(element.style.aspectRatio).toBe('0.6 / 1');
  });

  describe('without zoom', () => {
    it('leaves the wheel and the keys to the page, and shows no reset button', () => {
      const wheel = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
      element.dispatchEvent(wheel);
      expect(wheel.defaultPrevented).toBe(false);
      const plus = new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true });
      element.dispatchEvent(plus);
      expect(plus.defaultPrevented).toBe(false);
      frames.run();
      expect(draws.at(-1)![1].k).toBe(1);
      expect(element.querySelector('button.reset')).toBeNull();
    });
  });

  describe('the summary', () => {
    const summary = () => element.querySelector('p.sr-only')!.textContent;
    const car = { x: 10, y: 0, length: 4, width: 2, yaw: 0, label: 'car' };
    let now = 0;
    /** Well after the summary the first frame wrote on the real clock. */
    let base = 0;

    beforeEach(() => {
      base = performance.now() + 10_000;
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      vi.spyOn(performance, 'now').mockImplementation(() => now);
    });

    // Faked timeouts would stall Angular's scheduler: the tests run change detection themselves.
    afterEach(() => vi.useRealTimers());

    it('says what the frame shows within the range, for a screen reader', () => {
      now = base;
      host.frame.set({ objects: [car, { ...car, label: 'bus' }] });
      fixture.detectChanges();
      frames.run();
      expect(summary()).toBe('1 car, 1 bus within 60 m');
    });

    it('changes at most once a second, to the newest frame', () => {
      now = base;
      host.frame.set({ objects: [car] });
      fixture.detectChanges();
      frames.run();
      expect(summary()).toBe('1 car within 60 m');
      now = base + 200;
      host.frame.set({ objects: [car, car] });
      fixture.detectChanges();
      frames.run();
      now = base + 400;
      host.frame.set({ objects: [car, car, car] });
      fixture.detectChanges();
      frames.run();
      expect(summary()).toBe('1 car within 60 m');
      now = base + 1000;
      vi.advanceTimersByTime(800);
      expect(summary()).toBe('3 car within 60 m');
    });
  });

  describe('the readout', () => {
    // In the 400 × 300 box the round plot's centre is (200, 150), at (150 - 12) / 60 px per metre.
    const ppm = (150 - 12) / 60;
    const car = { x: 10, y: 0, length: 4, width: 2, yaw: 0, label: 'car', text: 'Score 0.9' };
    const readout = () => element.querySelector<HTMLElement>('.readout')!;
    const pointer = (type: string, x: number, y: number, pointerType = 'mouse') => {
      const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
      Object.defineProperty(event, 'pointerType', { value: pointerType });
      element.dispatchEvent(event);
    };

    beforeEach(async () => {
      host.frame.set({ objects: [car] });
      await settle();
      frames.run();
    });

    it('reads out the object a mouse hovers, outlined, beside it', async () => {
      expect(readout().hidden).toBe(true);
      pointer('pointermove', 200, 150 - 10 * ppm);
      frames.run();
      expect(draws.at(-1)![6]).toBe(0);
      expect(readout().hidden).toBe(false);
      expect(readout().textContent).toContain('car');
      expect(readout().textContent).toContain('10 m');
      expect(readout().textContent).toContain('Score 0.9');
      expect(readout().getAttribute('aria-hidden')).toBe('true');
      // The kit's swatch, in the label's colour.
      await settle();
      const swatch = readout().querySelector<HTMLElement>('neat-swatch')!;
      expect(swatch.style.getPropertyValue('--swatch')).toBe(draws.at(-1)![4].of('car').colour);
    });

    it('puts it away when the pointer leaves the object or the box, or on Escape', () => {
      pointer('pointermove', 200, 150 - 10 * ppm);
      frames.run();
      pointer('pointermove', 200, 150 + 20 * ppm);
      frames.run();
      expect(readout().hidden).toBe(true);
      expect(draws.at(-1)![6]).toBe(-1);
      pointer('pointermove', 200, 150 - 10 * ppm);
      frames.run();
      pointer('pointerleave', 0, 0);
      frames.run();
      expect(readout().hidden).toBe(true);
      pointer('pointermove', 200, 150 - 10 * ppm);
      frames.run();
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      frames.run();
      expect(readout().hidden).toBe(true);
    });

    it('follows the object under the pointer from frame to frame', async () => {
      pointer('pointermove', 200, 150 - 10 * ppm);
      frames.run();
      host.frame.set({ objects: [{ ...car, x: 30 }] });
      await settle();
      frames.run();
      expect(readout().hidden).toBe(true);
    });

    it('reads out by a tap on a touch screen, not by a finger moving', () => {
      pointer('pointermove', 200, 150 - 10 * ppm, 'touch');
      frames.run();
      expect(readout().hidden).toBe(true);
      pointer('pointerdown', 200, 150 - 10 * ppm, 'touch');
      element.dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 150 - 10 * ppm }),
      );
      frames.run();
      expect(readout().hidden).toBe(false);
    });

    it('tells the app which object is hovered, by its id, once while it stays hovered', async () => {
      host.frame.set({ objects: [{ ...car, id: 'car 7' }] });
      await settle();
      frames.run();
      pointer('pointermove', 200, 150 - 10 * ppm);
      frames.run();
      await settle();
      expect(host.hovered()).toBe('car 7');
      const changes: unknown[] = [];
      const bev = fixture.debugElement.children[0].componentInstance as NeatBev;
      bev.hovered.subscribe((id) => changes.push(id));
      // A new frame with the same object a little further: still the same one.
      host.frame.set({ objects: [{ ...car, id: 'car 7', x: 10.2 }] });
      await settle();
      frames.run();
      expect(changes).toEqual([]);
      pointer('pointerleave', 0, 0);
      frames.run();
      await settle();
      expect(host.hovered()).toBeNull();
    });

    it('names an object without an id by its index', async () => {
      pointer('pointermove', 200, 150 - 10 * ppm);
      frames.run();
      await settle();
      expect(host.hovered()).toBe(0);
    });

    it('outlines and reads out the object the app hovers, while no pointer is over it', async () => {
      host.frame.set({
        objects: [
          { ...car, id: 'a' },
          { ...car, id: 'b', x: -20 },
        ],
      });
      host.hovered.set('b');
      await settle();
      frames.run();
      expect(draws.at(-1)![6]).toBe(1);
      expect(readout().hidden).toBe(false);
      host.hovered.set('nobody');
      await settle();
      frames.run();
      expect(draws.at(-1)![6]).toBe(-1);
      expect(readout().hidden).toBe(true);
      // One beyond the range is not drawn, so not outlined or read out either.
      host.frame.set({ objects: [{ ...car, id: 'far', x: 70 }] });
      host.hovered.set('far');
      await settle();
      frames.run();
      expect(draws.at(-1)![6]).toBe(-1);
      expect(readout().hidden).toBe(true);
    });

    it('tells the app what a click hit, and where, in metres', () => {
      const click = (x: number, y: number) =>
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
      click(200, 150 - 10 * ppm);
      click(200 - 20 * ppm, 150);
      expect(host.picks).toHaveLength(2);
      expect(host.picks[0]).toMatchObject({ object: car, id: 0 });
      expect(host.picks[0].x).toBeCloseTo(10);
      expect(host.picks[1]).toMatchObject({ object: null, id: null });
      expect(host.picks[1].y).toBeCloseTo(20);
    });

    it('reports where a mouse is, in metres, once a frame and only when it moved', () => {
      pointer('pointermove', 200, 150 - 5 * ppm);
      pointer('pointermove', 200, 150 - 6 * ppm);
      frames.run();
      frames.run();
      expect(host.points).toHaveLength(1);
      expect(host.points[0]!.x).toBeCloseTo(6);
      pointer('pointerleave', 0, 0);
      frames.run();
      expect(host.points.at(-1)).toBeNull();
      // A finger's tap is no pointer over the view.
      pointer('pointerdown', 200, 150, 'touch');
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 150 }));
      frames.run();
      expect(host.points).toHaveLength(2);
    });

    it('reads out nothing outside the round plot, unless overflow is visible', async () => {
      host.frame.set({ objects: [{ ...car, x: 0, y: 70, length: 20, width: 20 }] });
      await settle();
      // 70 m to the left is beyond the 60 m edge; the box's left edge is.
      pointer('pointermove', 200 - 70 * ppm, 150);
      frames.run();
      expect(readout().hidden).toBe(true);
      host.overflow.set('visible');
      await settle();
      frames.run();
      expect(readout().hidden).toBe(false);
    });

    it('reads out nothing outside the rectangle', async () => {
      host.shape.set('rect');
      host.bounds.set({ x: [-60, 60], y: [-5, 5] });
      host.frame.set({ objects: [{ ...car, x: 0, y: 8, length: 4, width: 4 }] });
      await settle();
      frames.run();
      const view = draws.at(-1)![1];
      // 8 m to the left, beyond the rectangle's 5 m.
      pointer('pointermove', view.cx - 8 * view.ppm, view.cy);
      frames.run();
      expect(readout().hidden).toBe(true);
    });
  });

  describe('zoomed', () => {
    const key = (name: string) =>
      element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
    const resetButton = () => element.querySelector<HTMLButtonElement>('button.reset');

    beforeEach(async () => {
      host.zoom.set(true);
      await settle();
      frames.run();
    });

    it('takes every wheel over the view', () => {
      const wheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
      element.dispatchEvent(wheel);
      // Already zoomed out as far as it goes: the page still does not scroll.
      expect(wheel.defaultPrevented).toBe(true);
    });

    it('goes back to the default view, and lets go of the wheel, when zoom turns off', async () => {
      key('+');
      frames.run();
      host.zoom.set(false);
      await settle();
      frames.run();
      expect(draws.at(-1)![1].k).toBe(1);
      expect(resetButton()).toBeNull();
      expect(element.hasAttribute('tabindex')).toBe(false);
      const wheel = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
      element.dispatchEvent(wheel);
      expect(wheel.defaultPrevented).toBe(false);
    });

    it("draws the view zoomed about the plot's centre", () => {
      key('+');
      frames.run();
      const [, view] = draws.at(-1)!;
      expect(view.k).toBeCloseTo(1.25);
      // The plot's centre (200, 150) stays put: k · cx + tx = cx.
      expect(view.k * view.cx + view.tx).toBeCloseTo(200);
    });

    it('shows a reset button while zoomed, which goes back to the whole range', async () => {
      expect(resetButton()).toBeNull();
      key('+');
      await settle();
      const button = resetButton()!;
      expect(button.getAttribute('aria-label')).toBe('Reset view');
      button.click();
      // The reset's own click is no click on the view.
      expect(host.picks).toEqual([]);
      frames.run();
      await settle();
      expect(resetButton()).toBeNull();
      expect(draws.at(-1)![1].k).toBe(1);
      expect(document.activeElement).toBe(element);
    });

    it('zooms within the zoom extent, out beyond the default view too', async () => {
      host.zoomExtent.set([0.5, 2]);
      await settle();
      frames.run();
      for (let i = 0; i < 20; i++) key('-');
      frames.run();
      expect(draws.at(-1)![1].k).toBeCloseTo(0.5);
    });

    it('pans over the pan bounds, further than the default view shows', async () => {
      const furthest = () => {
        for (let i = 0; i < 100; i++) key('ArrowUp');
        frames.run();
        return draws.at(-1)![1].ty;
      };
      key('+');
      const within = furthest();
      host.panBounds.set({ x: [-200, 200], y: [-200, 200] });
      await settle();
      frames.run();
      expect(furthest()).toBeGreaterThan(within + 100);
    });

    it('keeps the zoom when the box is resized', () => {
      key('+');
      frames.run();
      resize(element, 300, 300);
      frames.run();
      expect(draws.at(-1)![1].k).toBeCloseTo(1.25);
    });
  });

  it('draws once it has a size, at the pixel ratio, with the vehicle in the round plot', () => {
    expect(draws).toHaveLength(1);
    const [ratio, view, inputs] = draws[0];
    expect(ratio).toBe(2);
    expect(view).toMatchObject({ cx: 200, cy: 150, k: 1, tx: 0, ty: 0 });
    expect(view.ppm).toBeCloseTo((150 - 12) / 60);
    expect(inputs.spokes).toHaveLength(12);
  });

  it('passes a new frame to the next animation frame, once however many inputs change', async () => {
    const frame: NeatBevFrame = { objects: [] };
    host.frame.set(frame);
    host.range.set(30);
    host.shape.set('rect');
    await settle();
    expect(draws).toHaveLength(1);
    frames.run();
    expect(draws).toHaveLength(2);
    const [, view, inputs, , , drawn] = draws[1];
    expect(drawn).toBe(frame);
    expect(inputs.plot).toMatchObject({ range: 30, shape: 'rect', front: 30, left: 30 });
    expect(view.ppm).toBeCloseTo((150 - 12) / 30);
    frames.run();
    expect(draws).toHaveLength(2);
  });

  it('draws nothing while the page is hidden, and catches up when it shows again', async () => {
    hidden = true;
    host.frame.set({ objects: [] });
    await settle();
    frames.run();
    expect(draws).toHaveLength(1);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    frames.run();
    expect(draws).toHaveLength(2);
  });

  it('draws again in the new scheme', async () => {
    TestBed.inject(ThemeService).setScheme('dark', { persist: false });
    await settle();
    frames.run();
    expect(draws).toHaveLength(2);
    expect(draws[1][3]).not.toBe(draws[0][3]);
  });

  it('draws again on a resize at once, before the browser paints the new size', () => {
    resize(element, 600, 300);
    // In the resize's own callback, not at the next frame: no stretched old picture shows.
    expect(draws).toHaveLength(2);
    expect(draws[1][1].cx).toBe(300);
    frames.run();
    expect(draws).toHaveLength(2);
  });

  it('colours a label by its style row', async () => {
    host.styles.set([{ label: 'car', color: '#123456', style: 'solid', width: 3 }]);
    await settle();
    frames.run();
    expect(draws[1][4].of('car')).toMatchObject({ colour: '#123456', width: 3 });
  });

  it('stops drawing once destroyed', () => {
    TestBed.resetTestingModule();
    frames.run();
    resize(element, 500, 500);
    frames.run();
    expect(draws).toHaveLength(1);
  });
});
