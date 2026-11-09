import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  untracked,
  viewChild,
} from '@angular/core';
import {
  neatThemeColors,
  type NeatRgb,
  ThemeService,
  ɵNeatOverlayColors as NeatOverlayColors,
} from '@sima/neat-ui';
import type { NeatOverlayClassStyle } from '@sima/neat-ui/video';
import { BevCanvas, type BevInputs, type BevTheme } from './bev-canvas';
import { LabelColours } from './colours';
import { type BevView, defaultView, plotArea, spokeList } from './geometry';
import type { NeatBevFrame, NeatBevSensor, NeatBevShape, NeatBevSpoke } from './model';

/** The theme's tokens the plot draws its own parts in. */
const TOKENS = {
  line: '--border',
  strong: '--input',
  text: '--muted-foreground',
  ego: '--foreground',
  halo: '--neat-surface',
} as const;

/** The zoom and pan on top of the default view: none yet. */
const IDENTITY = { k: 1, tx: 0, ty: 0 } as const;

/**
 * A bird's-eye view around a vehicle: what it sees (`frame`: objects, points, lines and grids),
 * what its sensors cover (`sensors`), and rings or a metric grid to read distances by (`shape`),
 * in the vehicle's own frame (metres, x forward and y left, forward up on the screen). Labels pick
 * colours as the video overlays' classes do, from the page's class colours, so "car" has one colour
 * in the view and in every tile; `styles` sets a label's colour and line as the tiles' class rows
 * do. It draws on one canvas outside change detection, at the next animation frame after anything
 * changes and never while the page is hidden. Give it a height, or it is as tall as it is wide.
 *
 * ```html
 * <neat-bev [frame]="frame()" [sensors]="cameras" [spokes]="seams" [range]="60" />
 * ```
 */
@Component({
  selector: 'neat-bev',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'img', '[attr.aria-label]': 'label()' },
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styleUrl: './bev.css',
})
export class NeatBev {
  /** What to draw now; null draws only the plot. Give a new object for each moment. */
  readonly frame = input<NeatBevFrame | null>(null);
  /** The sensors' wedges, drawn faintly under everything else. */
  readonly sensors = input<readonly NeatBevSensor[]>([]);
  /**
   * The spokes: a number spaces that many evenly from straight ahead (12, every 30°, by default;
   * 0 for none); a list places each one, from its own origin if it has one (a rig's seams between
   * its cameras, or lines from where they are mounted).
   */
  readonly spokes = input<number | readonly NeatBevSpoke[]>(12);
  /** Metres from the vehicle to the plot's nearer edge. */
  readonly range = input(60);
  /** Rings around the vehicle in the largest square that fits (`'round'`), or a grid that fills the box. */
  readonly shape = input<NeatBevShape>('round');
  /** A label's colour, line and width, as the video overlays' class rows set them for the tiles. */
  readonly styles = input<readonly NeatOverlayClassStyle[]>([]);
  /** The plot's accessible name. */
  readonly label = input("Bird's-eye view");

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly colours = new LabelColours(inject(NeatOverlayColors));
  private readonly themeColours = neatThemeColors(TOKENS, () => this.host);
  private readonly scheme = inject(ThemeService).scheme;

  /** The plot's own colours and font, as the canvas takes them; a new object for a new theme. */
  private readonly theme = computed<BevTheme>(() => {
    const colours = this.themeColours();
    const style = getComputedStyle(this.host);
    const fallback = style.color;
    const css = (rgb: NeatRgb | null): string => (rgb ? cssColour(rgb) : fallback);
    return {
      line: css(colours.line),
      strong: css(colours.strong),
      text: css(colours.text),
      ego: css(colours.ego),
      halo: css(colours.halo),
      font: `${style.fontSize} ${style.fontFamily}`,
    };
  });

  private readonly inputs = computed<BevInputs>(() => ({
    shape: this.shape(),
    range: this.range(),
    sensors: this.sensors(),
    spokes: spokeList(this.spokes()),
  }));

  private canvas: BevCanvas | null = null;
  /** The style rows the colours were last given. */
  private stylesGiven: readonly NeatOverlayClassStyle[] | null = null;
  private width = 0;
  private height = 0;
  private request = 0;
  private destroyed = false;

  constructor() {
    // Anything that changes what is drawn asks for a frame; new style rows apply from it on.
    effect(() => {
      const styles = this.styles();
      this.frame();
      this.inputs();
      // The scheme, not the colours: they are resolved (on a canvas) only when a frame draws.
      this.scheme();
      untracked(() => {
        if (styles !== this.stylesGiven) this.colours.setStyles((this.stylesGiven = styles));
        this.schedule();
      });
    });
    let observer: ResizeObserver | null = null;
    afterNextRender(() =>
      this.zone.runOutsideAngular(() => {
        if (this.destroyed) return;
        this.canvas = new BevCanvas(this.canvasElement().nativeElement);
        observer = new ResizeObserver((entries) => {
          const box = entries.at(-1)?.borderBoxSize?.[0];
          if (!box) return;
          this.width = box.inlineSize;
          this.height = box.blockSize;
          this.canvas?.size(this.width, this.height);
          this.schedule();
        });
        observer.observe(this.host);
        this.document.addEventListener('visibilitychange', this.visibility);
        this.schedule();
      }),
    );
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      if (this.request !== 0) cancelAnimationFrame(this.request);
      this.request = 0;
      observer?.disconnect();
      this.document.removeEventListener('visibilitychange', this.visibility);
    });
  }

  /** A frame, unless one is coming, the page is hidden, there is no canvas yet or it is gone. */
  private schedule(): void {
    if (this.request !== 0 || this.destroyed || !this.canvas || this.document.hidden) return;
    this.request = this.zone.runOutsideAngular(() => requestAnimationFrame(this.tick));
  }

  private readonly visibility = (): void => {
    if (!this.document.hidden) this.schedule();
  };

  private readonly tick = (): void => {
    this.request = 0;
    if (this.destroyed || !this.canvas) return;
    const ratio =
      typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const inputs = untracked(this.inputs);
    const view: BevView = {
      ...defaultView(plotArea(this.width, this.height, inputs.shape), inputs.range),
      ...IDENTITY,
    };
    this.colours.begin(performance.now());
    this.canvas.draw(
      ratio,
      view,
      inputs,
      untracked(this.theme),
      this.colours,
      untracked(this.frame),
      -1,
    );
  };
}

/** A colour from 0..1 channels as CSS. */
function cssColour([red, green, blue]: NeatRgb): string {
  return `rgb(${Math.round(red * 255)} ${Math.round(green * 255)} ${Math.round(blue * 255)})`;
}
