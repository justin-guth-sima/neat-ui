import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  isDevMode,
} from '@angular/core';
import { neatEased, NeatEasedNumber, type NeatEasing } from '@sima/neat-ui';
import {
  ARC_RADIUS,
  arcPath,
  GAUGE_CENTER,
  GAUGE_VIEW,
  gaugeShare,
  pointAt,
  validRange,
  zoneAt,
  zoneArcs,
} from './arc';

/**
 * Where a gauge's zones start, each a value from which its zone runs up to `max`: warning to the
 * danger start (or to `max` without one), danger to `max`.
 */
export interface NeatGaugeZones {
  /** The value from which the warning zone starts. */
  readonly warning?: number;
  /** The value from which the danger zone starts. */
  readonly danger?: number;
}

/** The value a figure or a meter can show: a finite number, else none. */
const shown = (value: number | null): number | null =>
  value !== null && Number.isFinite(value) ? value : null;

/** The gauge track: the whole sweep, the same for every gauge. */
const TRACK = arcPath(0, 1, ARC_RADIUS);
/** Where the range's ends stand below the track's ends, in percent of the drawing's width. */
const END_AT = [0, 1].map((share) => (pointAt(share, ARC_RADIUS).x / GAUGE_VIEW.width) * 100);

/**
 * A live value within a range, drawn as a ¾ arc: tokens per second, a frame rate, a power draw or
 * a temperature.
 *
 * ```html
 * <neat-gauge label="Reply speed" [value]="tokensPerSecond()" [max]="60" unit="tokens/s" />
 * ```
 *
 * The gauge track, thick and round-capped, turns from the bottom left clockwise to the bottom
 * right, and the value arc covers it from the start to the value. The figure and its unit stand
 * inside, and `min` and `max` below the track's ends. `zones` adds thin arcs just outside the
 * track, warning and danger, in the threshold lines' colors (`--neat-line-warning`,
 * `--neat-line-danger`).
 *
 * The value arc and the figure move to a new value with `neatEased`, by `easing`, and follow at
 * once under reduced motion. The value arc holds a value outside the range to it; the figure and
 * the words say the value itself. With no value, or one that is no finite number, there is no
 * value arc and the figure says "–". A range with `min` not below `max` draws no value arc and no
 * zones, and says so once in dev mode.
 *
 * The host is a `meter` named by `label`, with the range, the value held to it, and the value in
 * words: "42 tokens/s of 60", with ", warning" or ", danger" while the value is in a zone.
 * `showLabel` also shows the label as a title above the gauge, for a gauge on its own. In a
 * `NeatChartCard` the card's heading says it, so the gauge takes the chart's place.
 *
 * It fills the width it is given and keeps its proportions, the text growing with it (the unit
 * and the range no smaller than `--neat-text-xs`). A row or a centered column gives it no width of
 * its own, so give it one there.
 *
 * A part of the kit's own: Spartan 1.8 has no gauge (brain's progress is a bar), and an arc needs
 * none of the charts' d3, so an app that shows only gauges carries none.
 */
@Component({
  selector: 'neat-gauge',
  imports: [NeatEasedNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'meter',
    '[attr.aria-label]': 'label()',
    '[attr.aria-valuemin]': 'range() ? min() : null',
    '[attr.aria-valuemax]': 'range() ? max() : null',
    '[attr.aria-valuenow]': 'held()',
    '[attr.aria-valuetext]': 'words()',
  },
  template: `
    @if (showLabel()) {
      <div class="label">{{ label() }}</div>
    }
    <div class="dial" [style.aspect-ratio]="aspect">
      <svg [attr.viewBox]="viewBox" aria-hidden="true" focusable="false">
        @for (zone of drawnZones(); track zone.zone) {
          <path class="zone" [attr.data-zone]="zone.zone" [attr.d]="zone.path" />
        }
        <path class="track" [attr.d]="track" />
        @if (arc(); as d) {
          <path class="value" [attr.d]="d" />
        }
      </svg>
      <div class="reading" [style.top.%]="centerTop" aria-hidden="true">
        <neat-eased-number
          class="figure"
          [value]="figure()"
          [digits]="digits()"
          [easing]="easing()"
        />
        @if (unit()) {
          <span class="unit">{{ unit() }}</span>
        }
      </div>
    </div>
    <div class="ends" aria-hidden="true">
      <span class="end" [style.left.%]="endAt[0]">{{ min() }}</span>
      <span class="end" [style.left.%]="endAt[1]">{{ max() }}</span>
    </div>
  `,
  styleUrl: './gauge.css',
})
export class NeatGauge {
  /** The value to show; null while there is none. */
  readonly value = input.required<number | null>();
  /** The low end of the range, where the arc starts. */
  readonly min = input(0);
  /** The high end of the range, where the arc ends. */
  readonly max = input.required<number>();
  /** The value's unit, small beside the figure and in the words: "tokens/s". */
  readonly unit = input('');
  /** What the value is: the meter's accessible name, and its title with `showLabel`. */
  readonly label = input.required<string>();
  /** Shows the label as a title above the gauge, for a gauge on its own. */
  readonly showLabel = input(false, { transform: booleanAttribute });
  /** Digits after the decimal point, in the figure and the words. */
  readonly digits = input(0);
  /** Where the warning and the danger zones start; none by default. */
  readonly zones = input<NeatGaugeZones | null>(null);
  /** The curve the arc and the figure move by: a `NEAT_EASINGS` name, or a function where none fits. */
  readonly easing = input<NeatEasing>('ease-in-out');

  protected readonly viewBox = `0 0 ${GAUGE_VIEW.width} ${GAUGE_VIEW.height}`;
  protected readonly aspect = `${GAUGE_VIEW.width} / ${GAUGE_VIEW.height}`;
  protected readonly centerTop = (GAUGE_CENTER.y / GAUGE_VIEW.height) * 100;
  protected readonly endAt = END_AT;
  protected readonly track = TRACK;

  protected readonly range = computed(() => validRange(this.min(), this.max()));
  protected readonly figure = computed(() => shown(this.value()));
  /** The value held to the range: the value arc's target and `aria-valuenow`. */
  protected readonly held = computed(() => {
    const value = this.figure();
    if (value === null || !this.range()) return null;
    return Math.min(this.max(), Math.max(this.min(), value));
  });
  private readonly eased = neatEased(this.held, { easing: this.easing });

  protected readonly arc = computed(
    () => arcPath(0, gaugeShare(this.eased(), this.min(), this.max()) ?? 0, ARC_RADIUS) || null,
  );
  protected readonly drawnZones = computed(() => zoneArcs(this.zones(), this.min(), this.max()));

  protected readonly words = computed(() => {
    const value = this.figure();
    if (value === null) return '–';
    const unit = this.unit() ? ` ${this.unit()}` : '';
    const range = this.range() ? ` of ${this.max()}` : '';
    const zone = zoneAt(value, this.zones());
    return `${value.toFixed(this.digits())}${unit}${range}${zone ? `, ${zone}` : ''}`;
  });

  constructor() {
    let said = false;
    effect(() => {
      if (said || this.range() || !isDevMode()) return;
      said = true;
      console.error(
        `neat-gauge "${this.label()}": min (${this.min()}) is not below max (${this.max()}), so no arc is drawn`,
      );
    });
  }
}
