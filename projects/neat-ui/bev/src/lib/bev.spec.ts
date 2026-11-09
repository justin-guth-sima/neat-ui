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
import type { NeatBevFrame, NeatBevShape } from './model';

@Component({
  imports: [NeatBev],
  template: `<neat-bev
    [frame]="frame()"
    [range]="range()"
    [shape]="shape()"
    [spokes]="spokes()"
    [styles]="styles()"
  />`,
})
class Host {
  readonly frame = signal<NeatBevFrame | null>(null);
  readonly range = signal(60);
  readonly shape = signal<NeatBevShape>('round');
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

  it('is a figure named by its label, and a tab stop for its keys', () => {
    expect(element.getAttribute('role')).toBe('figure');
    expect(element.getAttribute('aria-label')).toBe("Bird's-eye view");
    expect(element.tabIndex).toBe(0);
    expect(element.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
  });

  describe('zoomed', () => {
    const key = (name: string) =>
      element.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
    const resetButton = () => element.querySelector<HTMLButtonElement>('button.reset');

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
      frames.run();
      await settle();
      expect(resetButton()).toBeNull();
      expect(draws.at(-1)![1].k).toBe(1);
      expect(document.activeElement).toBe(element);
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
    host.shape.set('square');
    await settle();
    expect(draws).toHaveLength(1);
    frames.run();
    expect(draws).toHaveLength(2);
    const [, view, inputs, , , drawn] = draws[1];
    expect(drawn).toBe(frame);
    expect(inputs).toMatchObject({ range: 30, shape: 'square' });
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

  it('draws again on a resize', () => {
    resize(element, 600, 300);
    frames.run();
    expect(draws).toHaveLength(2);
    expect(draws[1][1].cx).toBe(300);
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
