import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { NeatButton, NeatIcon } from '@sima/neat-ui';
import { NeatPopover, NeatPopoverContent, NeatPopoverTrigger } from '@sima/neat-ui/popover';
import { NeatSlider } from '@sima/neat-ui/slider';
import { NEAT_DIAGRAM_MESSAGE_DEFAULTS, type NeatDiagramMessageSettings } from './messages';

/** The range of each number, for the sliders and for settings read back from storage. */
const LIMITS = {
  speed: { min: 50, max: 1000, step: 10 },
  size: { min: 0.5, max: 2, step: 0.1 },
  every: { min: 1, max: 10, step: 1 },
} as const;

type NumberKey = keyof typeof LIMITS;

/**
 * `raw` as message settings, for the parse of an app's `neatStoredSignal`.
 *
 * ```ts
 * readonly settings = neatStoredSignal('app.dots', NEAT_DIAGRAM_MESSAGE_DEFAULTS,
 *   neatParseMessageSettings);
 * ```
 *
 * It keeps the known keys of the right type, and clamps the numbers to the sliders' range, with
 * `every` rounded to a whole number. The rest take `defaults`, the kit's unless the app gives its
 * own. So a stored signal reads whatever an older version wrote.
 *
 * An app with defaults of its own gives them here too, as it gives them to the panel's
 * `defaults`:
 *
 * ```ts
 * const DOTS = { ...NEAT_DIAGRAM_MESSAGE_DEFAULTS, speed: 140 };
 * readonly settings = neatStoredSignal('app.dots', DOTS, (raw) =>
 *   neatParseMessageSettings(raw, DOTS));
 * ```
 */
export function neatParseMessageSettings(
  raw: unknown,
  defaults: NeatDiagramMessageSettings = NEAT_DIAGRAM_MESSAGE_DEFAULTS,
): NeatDiagramMessageSettings {
  if (typeof raw !== 'object' || raw === null) return defaults;
  const record = raw as Record<string, unknown>;
  const pick = (key: NumberKey): number => {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return defaults[key];
    }
    const { min, max } = LIMITS[key];
    return Math.min(max, Math.max(min, key === 'every' ? Math.round(value) : value));
  };
  return {
    speed: pick('speed'),
    size: pick('size'),
    every: pick('every'),
  };
}

/**
 * The Animation panel for `neat-diagram-messages`: sliders for the dots, behind an icon button.
 *
 * ```html
 * <neat-diagram-animation-settings [(settings)]="dots" />
 * <neat-diagram-messages [settings]="dots()" />
 * ```
 *
 * The sliders set the dots' speed, size and messages per dot, and a reset returns them to
 * `defaults`. Dots always go on through the blocks' steps, where a diagram has them.
 *
 * `settings` is the model both ways, and changes apply as the sliders move. The panel keeps
 * nothing. An app that remembers the choice per browser makes the model a `neatStoredSignal`,
 * parsed by `neatParseMessageSettings`. Place it in a toolbar or beside the diagram.
 *
 * An app whose dots start otherwise than the kit's gives its starting settings as `defaults`, so
 * a reset returns to them:
 *
 * ```html
 * <neat-diagram-animation-settings [(settings)]="dots" [defaults]="calm" />
 * ```
 */
@Component({
  selector: 'neat-diagram-animation-settings',
  imports: [NeatButton, NeatIcon, NeatPopover, NeatPopoverContent, NeatPopoverTrigger, NeatSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './animation-settings.css',
  template: `
    <neat-popover label="Animation" align="end">
      <button
        neatButton
        neatPopoverTrigger
        variant="text"
        size="small"
        iconOnly
        type="button"
        aria-label="Animation"
      >
        <neat-icon name="palette" [size]="16" />
      </button>
      <ng-template neatPopoverContent>
        @let s = settings();
        <div class="tuning">
          <div class="heading">Animation</div>
          <div class="row">
            <span>Speed</span><span class="value">{{ s.speed }} px/s</span>
          </div>
          <neat-slider
            label="Speed of the dots"
            [min]="limits.speed.min"
            [max]="limits.speed.max"
            [step]="limits.speed.step"
            [value]="s.speed"
            (valueChange)="set({ speed: $event })"
          />
          <div class="row">
            <span>Dot size</span><span class="value">× {{ s.size.toFixed(1) }}</span>
          </div>
          <neat-slider
            label="Dot size"
            [min]="limits.size.min"
            [max]="limits.size.max"
            [step]="limits.size.step"
            [value]="s.size"
            (valueChange)="set({ size: $event })"
          />
          <div class="row">
            <span>Messages per dot</span>
            <span class="value">1 dot = {{ s.every }} {{ s.every === 1 ? 'msg' : 'msgs' }}</span>
          </div>
          <neat-slider
            label="Messages per dot: an edge shows a dot for every Nth message on it"
            [min]="limits.every.min"
            [max]="limits.every.max"
            [step]="limits.every.step"
            [value]="s.every"
            (valueChange)="set({ every: $event })"
          />
          <button
            neatButton
            variant="outlined"
            size="small"
            type="button"
            (click)="settings.set(defaults())"
          >
            Reset to defaults
          </button>
        </div>
      </ng-template>
    </neat-popover>
  `,
})
export class NeatDiagramAnimationSettings {
  /** The dots' tuning; what the sliders write, and the layer's `settings`. */
  readonly settings = model<NeatDiagramMessageSettings>(NEAT_DIAGRAM_MESSAGE_DEFAULTS);
  /**
   * What the reset returns to: the app's starting settings, `NEAT_DIAGRAM_MESSAGE_DEFAULTS` unless
   * it gives its own.
   */
  readonly defaults = input<NeatDiagramMessageSettings>(NEAT_DIAGRAM_MESSAGE_DEFAULTS);

  protected readonly limits = LIMITS;

  protected set(change: Partial<NeatDiagramMessageSettings>): void {
    this.settings.update((settings) => ({ ...settings, ...change }));
  }
}
