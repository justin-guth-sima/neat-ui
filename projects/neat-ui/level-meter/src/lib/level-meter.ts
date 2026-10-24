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
  if (levelDbfs === null || levelDbfs === undefined || !Number.isFinite(Number(levelDbfs))) return 0;
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
 * lighting it replaces that with its tone's, so no class has to outweigh another. Literals, so
 * that Tailwind finds them.
 */
const UNLIT_FILL = 'bg-muted';
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
 * A live audio level as a bar of segments, from -50 dBFS (dark) to full scale (all lit), green to
 * 70 % of the bar, amber to 90 %, red above:
 *
 * ```html
 * <neat-level-meter [sample]="micTest.level" />
 * ```
 *
 * `sample` reads the current level in dBFS, or null for none (the meter is dark). While it is set
 * and the meter is rendered, the meter calls it once per animation frame, so one input serves a
 * value the app polls and keeps in a field as well as a Web Audio analyser read on demand. Pass
 * null to stop. The meter calls the function on its own, never as a method of the app's object:
 * give it an arrow function (`readonly level = () => this.lastLevel`), not a method.
 *
 * Each frame writes the segments straight to the DOM, outside change detection: sixty change
 * detections a second for a bar of colour would cost more than everything else on the page.
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
        class="h-full min-w-0.5 flex-1 rounded-xs bg-muted"
      ></span>
    }
  `,
})
export class NeatLevelMeter {
  /** Reads the level in dBFS, once per frame; null leaves the meter dark. */
  readonly sample = input<(() => number | null) | null>(null);

  /** One entry per segment, for the template to repeat. */
  protected readonly segments = LIT_FILLS;
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
      elements[index].nativeElement.classList.replace(
        on ? UNLIT_FILL : LIT_FILLS[index],
        on ? LIT_FILLS[index] : UNLIT_FILL,
      );
    }
    this.lit = lit;
  }
}
