import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BrnProgress, BrnProgressIndicator } from '@spartan-ng/brain/progress';
import { ɵhlm as hlm } from '@sima/neat-ui';

/**
 * Helm's progress classes (`lib/ui/progress/src/lib/hlm-progress.ts` and
 * `hlm-progress-indicator.ts`), copied because helm keeps them inline. progress.spec checks that
 * each string still appears in the vendored helm, so a helm update that changes one fails until
 * this table is reviewed.
 */
export const PROGRESS_HELM_CLASSES = {
  track: 'bg-muted h-1.5 rounded-full relative inline-flex w-full overflow-hidden',
  indicator: 'bg-primary h-full w-full flex-1 transition-all',
} as const;

/**
 * Where the kit departs from helm's bar; each override exists because progress.spec failed
 * without it.
 * - Track: `bg-muted` is 1.10:1 on white and is the card color itself in dark, so the bar's extent
 *   vanishes. An outline in `--input`, the theme's form-control boundary, which is held to 3:1 on
 *   every surface, marks it. The outline is outside the track, since the fill covers an inner one.
 * - Track: `flex` for helm's `inline-flex`, which sits on a text baseline and so takes the line's
 *   height, not its own, when the bar stands bare in a block.
 * - Indicator: no `transition-all`, which would fight `neatEased`.
 */
const TRACK_CLASSES = hlm(PROGRESS_HELM_CLASSES.track, 'flex', 'ring-1 ring-input');
// Easing is `neatEased`'s job: a CSS transition restarted on each of its frames would fight it.
const INDICATOR_CLASSES = PROGRESS_HELM_CLASSES.indicator.replace(' transition-all', '');

/**
 * Helm moves the fill with `animate-indeterminate` (a keyframes animation of the preset) while the
 * value is unknown. With reduced motion the segment would sit still and look like a bar stuck at
 * some value, so the fill becomes diagonal stripes of full-strength `--primary` over the track:
 * neither empty, partway nor complete, and the same color pair the determinate fill is held to
 * at 3:1 against the track and the surface.
 */
const STRIPE_CLASSES =
  'motion-reduce:bg-transparent motion-reduce:bg-[repeating-linear-gradient(135deg,var(--primary)_0_6px,transparent_6px_12px)]';
const INDETERMINATE_CLASSES = `animate-indeterminate motion-reduce:animate-none ${STRIPE_CLASSES}`;

/*
 * The titled readout's classes, literals for Tailwind to find: the heading in the small text size
 * at medium weight with the percent at its line's end (tabular, so it does not jitter), the detail
 * a muted line in the extra-small size that cuts rather than wraps, the parts a small gap apart.
 */
const READOUT_CLASSES = 'flex flex-col gap-(--neat-space-2) text-(length:--neat-text-sm)';
const TITLE_CLASSES = 'm-0 flex justify-between gap-(--neat-space-3) font-medium tabular-nums';
const DETAIL_CLASSES =
  'm-0 truncate text-muted-foreground tabular-nums text-(length:--neat-text-xs)';

/**
 * A horizontal progress bar.
 *
 * ```html
 * <neat-progress label="Uploading clip.mp4" [value]="percent" />
 * ```
 *
 * `value` is 0 to 100, or `null` while the work cannot say how far along it is. The bar then moves
 * on its own. Under a reduced-motion setting it is a still bar of stripes.
 *
 * A value outside the range is held to it, and one that is not a number counts as unknown. So a
 * sloppy caller gets a bar, not an error.
 *
 * With a `heading` it is a titled readout, for work the user watches: an import, an encode, a
 * progress toast. It shows the heading with the whole percent at its line's end, the `detail`
 * under it, then the bar. The detail is one line, cut with its full text as a tooltip, and left out
 * while empty. The progress toast of `NeatToasts` renders through it:
 *
 * ```html
 * <neat-progress heading="Uploading 3 files" [detail]="'clip.mp4 · file 1 of 3'" [value]="41" />
 * ```
 *
 * The heading is a polite `role="status"`: a screen reader hears it when it changes ("Uploading" to
 * "Preparing"), but not the percent or the detail, which change too often to be read out. It is
 * named `heading` rather than `title` so that a static attribute does not also become the native
 * tooltip of the whole element.
 *
 * `label` is the bar's accessible name; it defaults to the heading. The bar is `role="progressbar"`
 * with `aria-valuenow` (left out while unknown), `aria-valuemin` and `aria-valuemax`, and a percent
 * as `aria-valuetext`. A bar alone announces nothing as it changes, which is a progressbar's way;
 * give a bar without a heading a `label`. It fills the width its container gives it, from the
 * left: the kit has no right-to-left layout.
 */
@Component({
  selector: 'neat-progress',
  imports: [BrnProgress, BrnProgressIndicator, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <ng-template #bar>
      <brn-progress
        data-slot="progress"
        [class]="trackClasses"
        [value]="shown()"
        [attr.aria-label]="label() || heading()"
      >
        <brn-progress-indicator
          data-slot="progress-indicator"
          [class]="indicatorClasses()"
          [style.transform]="transform()"
        />
      </brn-progress>
    </ng-template>
    @if (heading()) {
      <div data-slot="progress-readout" [class]="readoutClasses">
        <p data-slot="progress-title" [class]="titleClasses">
          <span role="status" class="min-w-0 truncate" [attr.title]="heading()">{{
            heading()
          }}</span>
          @if (percent() !== null) {
            <span>{{ percent() }}%</span>
          }
        </p>
        @if (detail()) {
          <p data-slot="progress-detail" [class]="detailClasses" [attr.title]="detail()">
            {{ detail() }}
          </p>
        }
        <ng-container [ngTemplateOutlet]="bar" />
      </div>
    } @else {
      <ng-container [ngTemplateOutlet]="bar" />
    }
  `,
})
export class NeatProgress {
  // Brain's progress is the element inside, which owns the role and the values; its range check
  // throws for a value out of range, which is why the kit's own input, held to the range, feeds it.
  /** 0 to 100, or `null` while unknown. */
  readonly value = input.required<number | null>();
  /** The bar's accessible name, announced with the value; the heading by default. */
  readonly label = input('');
  /** Shown over the bar with the percent: a titled readout. None while empty. */
  readonly heading = input('');
  /** A line under the heading: what is being worked on now. None while empty. */
  readonly detail = input('');

  protected readonly trackClasses: string = TRACK_CLASSES;
  protected readonly readoutClasses = READOUT_CLASSES;
  protected readonly titleClasses = TITLE_CLASSES;
  protected readonly detailClasses = DETAIL_CLASSES;

  /** The value the bar shows: within the range, or `null` when unknown. */
  protected readonly shown = computed(() => {
    const value = this.value();
    return value === null || !Number.isFinite(value) ? null : Math.min(100, Math.max(0, value));
  });
  /** The whole percent the readout shows; `null` while unknown. */
  protected readonly percent = computed(() => {
    const shown = this.shown();
    return shown === null ? null : Math.round(shown);
  });
  protected readonly indicatorClasses = computed(() =>
    hlm(INDICATOR_CLASSES, this.shown() === null ? INDETERMINATE_CLASSES : ''),
  );
  /**
   * The fill is as wide as the track and pushed out of it by the part that is not done. This and
   * the unknown state's class switch re-implement helm's `HlmProgressIndicator`; the drift spec
   * covers helm's class strings only, so a change to its logic needs a look at this by hand.
   */
  protected readonly transform = computed(() => `translateX(-${100 - (this.shown() ?? 100)}%)`);
}
