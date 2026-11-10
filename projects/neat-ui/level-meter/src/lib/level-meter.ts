import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  NgZone,
  viewChildren,
} from '@angular/core';

/** The level of the bar's start: a quiet room lights a segment or two, speech most of the bar. */
const METER_FLOOR_DBFS = -50;
/** The segments in the bar. */
const METER_SEGMENTS = 28;

/** Which part of the bar a segment is in, as a level meter reads: low, nearly full, at the end. */
export type MeterTone = 'low' | 'mid' | 'high';

// The scale is ported unchanged from the Insight #170 microphone test (peripherals/model.js).

/** How many of `count` meter segments a level lights. */
export function meterSegments(levelDbfs: number | null | undefined, count: number): number {
  if (levelDbfs === null || levelDbfs === undefined || !Number.isFinite(Number(levelDbfs)))
    return 0;
  const fraction = (Number(levelDbfs) - METER_FLOOR_DBFS) / -METER_FLOOR_DBFS;
  return Math.round(Math.max(0, Math.min(1, fraction)) * count);
}

/** Green for most of the bar, amber near the top, red at the end, as a level meter reads. */
export function segmentTone(index: number, count: number): MeterTone {
  if (index < Math.round(count * 0.7)) return 'low';
  if (index < Math.round(count * 0.9)) return 'mid';
  return 'high';
}

/*
 * A segment holds exactly one fill class at a time: the template gives it the unlit one, and
 * lighting it swaps that for its tone's, so no class has to outweigh another. Literals, so that
 * Tailwind finds them. Unlit is the border color, not `--muted`, which is faint on the light
 * page and is the card, dialog and popover fill in dark, where the bar would vanish.
 */
const UNLIT_FILL = 'bg-border';
const TONE_FILLS: Record<MeterTone, string> = {
  low: 'bg-success',
  mid: 'bg-warning',
  high: 'bg-destructive',
};
/** Each segment's fill when lit, by its place in the bar. */
const LIT_FILLS = Array.from(
  { length: METER_SEGMENTS },
  (_, index) => TONE_FILLS[segmentTone(index, METER_SEGMENTS)],
);

/**
 * Calls `onFrame` on every animation frame until the returned function is called. The next frame
 * is asked for before `onFrame` runs, so a frame that throws does not end the loop.
 */
function everyAnimationFrame(onFrame: () => void): () => void {
  let pending = requestAnimationFrame(function frame() {
    pending = requestAnimationFrame(frame);
    onFrame();
  });
  return () => cancelAnimationFrame(pending);
}

/**
 * A live audio level, as a bar of segments.
 *
 * ```html
 * <neat-level-meter [sample]="micTest.level" />
 * ```
 *
 * The bar has 28 segments, from -50 dBFS (dark) to full scale (all lit). They light green to 70 %
 * of the bar, amber to 90 %, and red above. The segments not lit are in the border color.
 *
 * `sample` reads the current level in dBFS, or null for none, which leaves the meter dark. Pass
 * null instead of a function to stop.
 *
 * While `sample` is set and the meter is rendered, the meter calls it once per animation frame. So
 * one input serves both a value the app polls and keeps in a field, and a Web Audio analyzer read
 * on demand.
 *
 * The meter calls the function on its own, never as a method of the app's object. So give it an
 * arrow function (`readonly level = () => this.lastLevel`), not a method.
 *
 * Return null when the source is gone, such as an audio context that closed, rather than throw.
 * The loop outlives a throw, so a sample that keeps throwing reports an error every frame.
 *
 * A meter that is rendered samples even where it cannot be seen: under a `display: none`
 * ancestor, or in a closed collapsible. So render it only while there is a level to show
 * (`@if (recording || playing)`), instead of hiding it.
 *
 * Each frame writes the segments straight to the DOM, outside change detection. Sixty change
 * detections a second for a bar of color would cost more than everything else on the page.
 *
 * The meter is `aria-hidden`: a level read out every frame would be noise. Say what is happening
 * (recording, playing, silence) in text beside it.
 */
@Component({
  selector: 'neat-level-meter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex h-3.5 gap-0.5',
    'aria-hidden': 'true',
  },
  template: `
    @for (segment of segments; track $index) {
      <span
        #segment
        data-slot="level-meter-segment"
        class="h-full min-w-0.5 flex-1 rounded-xs bg-border"
      ></span>
    }
  `,
})
export class NeatLevelMeter {
  /** Reads the level in dBFS, once per frame; null leaves the meter dark. */
  readonly sample = input<(() => number | null) | null>(null);

  protected readonly segments = Array.from({ length: METER_SEGMENTS });
  private readonly segmentElements = viewChildren<ElementRef<HTMLElement>>('segment');
  /** How many segments are lit now, so a frame touches only the segments that change. */
  private lit = 0;

  constructor() {
    const zone = inject(NgZone);
    // After render: the segments exist, and a meter that is not rendered does not sample.
    afterRenderEffect((onCleanup) => {
      const sample = this.sample();
      if (sample === null) return;
      const stop = zone.runOutsideAngular(() =>
        everyAnimationFrame(() => this.show(meterSegments(sample(), METER_SEGMENTS))),
      );
      onCleanup(() => {
        stop();
        this.show(0);
      });
    });
  }

  /** Lights the first `lit` segments and darkens the rest, writing only the ones that change. */
  private show(lit: number): void {
    const elements = this.segmentElements();
    for (let index = Math.min(lit, this.lit); index < Math.max(lit, this.lit); index++) {
      const on = index < lit;
      // Remove, then add: `replace` does nothing when the old class is missing, which would
      // leave a segment in the wrong color without a sign.
      const { classList } = elements[index].nativeElement;
      classList.remove(on ? UNLIT_FILL : LIT_FILLS[index]);
      classList.add(on ? LIT_FILLS[index] : UNLIT_FILL);
    }
    this.lit = lit;
  }
}
