import { ChangeDetectionStrategy, Component, effect, inject, input, model } from '@angular/core';
import {
  BrnSlider,
  BrnSliderRange,
  BrnSliderThumb,
  BrnSliderTrack,
} from '@spartan-ng/brain/slider';
import { hlm } from '../ui/utils/src';

/**
 * Helm's slider classes (`lib/ui/slider/src/lib/hlm-slider.ts`), copied because helm keeps them
 * inline in its template. slider.spec checks that each string still appears in the vendored helm,
 * so a helm update that changes one fails until this table is reviewed. The kit's slider is
 * horizontal with one thumb and no ticks; helm's vertical and tick classes stay as they are.
 */
export const SLIDER_HELM_CLASSES = {
  root: 'group flex w-full touch-none flex-col select-none data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-row data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  frame:
    'relative flex w-full items-center group-data-vertical:w-auto group-data-vertical:flex-col',
  track:
    'bg-muted rounded-full data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5 relative grow overflow-hidden',
  range:
    'bg-primary absolute select-none data-draggable-range:cursor-move data-horizontal:h-full data-vertical:w-full',
  thumb:
    'border-primary ring-ring/50 size-4 rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden absolute block shrink-0 select-none after:absolute after:-inset-2',
} as const;

/**
 * Where the kit departs from helm's slider; each override exists because slider.spec failed
 * without it.
 * - Track: `bg-muted` is 1.10:1 on white and is the card colour itself in dark, so on a card the
 *   empty part of the track vanishes. `--border` stays visible on every surface. (The empty track
 *   cannot also reach 3:1 against the filled range; the thumb and the filled range carry the
 *   value, each at 3:1 or more against what surrounds them.)
 * - Thumb fill: white is 2.8:1 against the dark scheme's filled range, so the thumb does not stand
 *   out where the range ends. The page background is white in light and reaches 5:1 or more on
 *   the range in both schemes.
 * - Focus ring: helm's `ring-ring/50` is about 1.85:1 on white; the kit draws full `--ring` on
 *   focus, which the theme holds to 3:1. Helm's hover ring keeps its softer colour.
 */
const TRACK_CLASSES = hlm(SLIDER_HELM_CLASSES.track, 'bg-border');
const THUMB_CLASSES = hlm(SLIDER_HELM_CLASSES.thumb, 'bg-background focus-visible:ring-ring');

/**
 * A horizontal slider for one number: `<neat-slider label="Tile width" [min]="120" [max]="480"
 * [step]="10" [(value)]="width" />`. `label` is the accessible name (it is not displayed); arrows
 * step, Page Up and Down and Shift step by ten, Home and End jump to the ends.
 *
 * `value` changes on every step of a drag, not only when the pointer is released, so whatever it
 * drives (the tile grid's repacking, for one) previews live. A value outside `min`..`max` is shown
 * clamped and stays as it is until the user moves the slider.
 *
 * Brain's slider is the host directive; its track, range and thumb directives draw it with helm's
 * classes. Brain holds a list of values (it also does ranges), so the kit's single number is kept
 * in step with it here.
 */
@Component({
  selector: 'neat-slider',
  imports: [BrnSliderTrack, BrnSliderRange, BrnSliderThumb],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: BrnSlider,
      // `label` feeds brain's `aria-label`, which brain puts on the thumb. The kit's own required
      // `label` below has the same public name, so a missing label is a compile error.
      inputs: ['min', 'max', 'step', 'disabled', 'aria-label: label'],
    },
  ],
  host: { '[class]': 'rootClasses' },
  template: `
    <div [class]="frameClasses">
      <div brnSliderTrack [class]="trackClasses">
        <div brnSliderRange [class]="rangeClasses"></div>
      </div>
      <span brnSliderThumb [class]="thumbClasses"></span>
    </div>
  `,
})
export class NeatSlider {
  readonly value = model(0);
  /** The accessible name, announced with the value. */
  readonly label = input.required<string>();

  protected readonly rootClasses = SLIDER_HELM_CLASSES.root;
  protected readonly frameClasses = SLIDER_HELM_CLASSES.frame;
  protected readonly trackClasses = TRACK_CLASSES;
  protected readonly rangeClasses = SLIDER_HELM_CLASSES.range;
  protected readonly thumbClasses = THUMB_CLASSES;

  constructor() {
    const slider = inject(BrnSlider);
    effect(() => slider.value.set([this.value()]));
    // Brain's output lives on this same host, so the subscription ends with it.
    slider.valueChange.subscribe(([value]) => this.value.set(value));
  }
}
