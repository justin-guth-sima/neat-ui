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
 * - Track: `bg-muted` is 1.10:1 on white and is the card colour itself in dark, so the bar's extent
 *   vanishes. An outline in `--input`, the theme's form-control boundary, which is held to 3:1 on
 *   every surface, marks it. The outline is outside the track, since the fill covers an inner one.
 */
const TRACK_CLASSES = hlm(PROGRESS_HELM_CLASSES.track, 'ring-1 ring-input');

/**
 * Helm moves the fill with `animate-indeterminate` (a keyframes animation of the preset) while the
 * value is unknown. With reduced motion the segment would sit still and look like a bar stuck at
 * some value, so it is replaced by a full-width bar at half strength: pending, not partway.
 */
const INDETERMINATE_CLASSES =
  'animate-indeterminate motion-reduce:animate-none motion-reduce:bg-primary/50';

/**
 * A horizontal progress bar: `<neat-progress label="Uploading clip.mp4" [value]="percent" />`.
 * `value` is 0 to 100, or `null` while the work cannot say how far along it is (the bar then
 * moves on its own). A value outside the range is held to it, and one that is not a number counts
 * as unknown, so a sloppy caller gets a bar, not an error.
 *
 * `label` is the accessible name. The bar is `role="progressbar"` with `aria-valuenow` (left out
 * while unknown), `aria-valuemin` and `aria-valuemax`, and a percent as `aria-valuetext`. It
 * announces nothing as it changes, which is a progressbar's way; a status that must be announced
 * belongs in a live region of its own, as the toasts' is. It fills the width its container
 * gives it, from the left: the kit has no right-to-left layout.
 *
 * Brain's progress is the element inside, which owns the role and the values; its range check
 * throws for a value out of range, which is why the kit's own input, held to the range, feeds it.
 */
@Component({
  selector: 'neat-progress',
  imports: [BrnProgress, BrnProgressIndicator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <brn-progress
      data-slot="progress"
      [class]="trackClasses"
      [value]="shown()"
      [attr.aria-label]="label()"
    >
      <brn-progress-indicator
        data-slot="progress-indicator"
        [class]="indicatorClasses()"
        [style.transform]="transform()"
      />
    </brn-progress>
  `,
})
export class NeatProgress {
  /** 0 to 100, or `null` while unknown. */
  readonly value = input.required<number | null>();
  /** The accessible name, announced with the value. */
  readonly label = input.required<string>();

  protected readonly trackClasses: string = TRACK_CLASSES;

  /** The value the bar shows: within the range, or `null` when unknown. */
  protected readonly shown = computed(() => {
    const value = this.value();
    return value === null || !Number.isFinite(value) ? null : Math.min(100, Math.max(0, value));
  });
  protected readonly indicatorClasses = computed(() =>
    hlm(PROGRESS_HELM_CLASSES.indicator, this.shown() === null ? INDETERMINATE_CLASSES : ''),
  );
  /** The fill is as wide as the track and pushed out of it by the part that is not done. */
  protected readonly transform = computed(() => `translateX(-${100 - (this.shown() ?? 100)}%)`);
}
