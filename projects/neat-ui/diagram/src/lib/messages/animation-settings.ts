import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { NeatButton, NeatIcon } from '@sima/neat-ui';
import { NeatPopover, NeatPopoverContent, NeatPopoverTrigger } from '@sima/neat-ui/popover';
import { NeatSlider } from '@sima/neat-ui/slider';
import { NeatSwitch } from '@sima/neat-ui/switch';
import { NEAT_DIAGRAM_MESSAGE_DEFAULTS, type NeatDiagramMessageSettings } from './messages';

/** The range of each number, for the sliders and for settings read back from storage. */
const LIMITS = {
  speed: { min: 50, max: 1000, step: 10 },
  size: { min: 0.5, max: 2, step: 0.1 },
  every: { min: 1, max: 10, step: 1 },
} as const;

type NumberKey = keyof typeof LIMITS;

/**
 * `raw` as settings: the known keys of the right type, the numbers clamped to the sliders' range
 * (`every` rounded to a whole number), and the defaults for the rest. For the parse of an app's
 * `neatStoredSignal`, which gets whatever an older version wrote:
 *
 * ```ts
 * readonly settings = neatStoredSignal('app.dots', NEAT_DIAGRAM_MESSAGE_DEFAULTS,
 *   neatParseMessageSettings);
 * ```
 */
export function neatParseMessageSettings(raw: unknown): NeatDiagramMessageSettings {
  if (typeof raw !== 'object' || raw === null) return NEAT_DIAGRAM_MESSAGE_DEFAULTS;
  const record = raw as Record<string, unknown>;
  const pick = (key: NumberKey): number => {
    const value = record[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return NEAT_DIAGRAM_MESSAGE_DEFAULTS[key];
    }
    const { min, max } = LIMITS[key];
    return Math.min(max, Math.max(min, key === 'every' ? Math.round(value) : value));
  };
  return {
    speed: pick('speed'),
    size: pick('size'),
    every: pick('every'),
    steps:
      typeof record['steps'] === 'boolean' ? record['steps'] : NEAT_DIAGRAM_MESSAGE_DEFAULTS.steps,
  };
}

/**
 * The Animation panel for `neat-diagram-messages`: an icon button that opens sliders for the
 * dots' speed, size and messages per dot, a switch for the dots through the blocks' steps, and a
 * reset to the defaults:
 *
 * ```html
 * <neat-diagram-animation-settings [(settings)]="dots" />
 * <neat-diagram-messages [settings]="dots()" />
 * ```
 *
 * `settings` is the model both ways, and changes apply as the sliders move. The panel keeps
 * nothing: an app that remembers the choice per browser makes the model a `neatStoredSignal`
 * (parsed by `neatParseMessageSettings`). Place it in a toolbar or beside the diagram.
 */
@Component({
  selector: 'neat-diagram-animation-settings',
  imports: [
    NeatButton,
    NeatIcon,
    NeatPopover,
    NeatPopoverContent,
    NeatPopoverTrigger,
    NeatSlider,
    NeatSwitch,
  ],
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
            neatSwitch
            type="button"
            [checked]="s.steps"
            (checkedChange)="set({ steps: $event })"
          >
            Dots inside the blocks
          </button>
          <button
            neatButton
            variant="outlined"
            size="small"
            type="button"
            (click)="settings.set(defaults)"
          >
            Reset to defaults
          </button>
        </div>
      </ng-template>
    </neat-popover>
  `,
})
export class NeatDiagramAnimationSettings {
  /** The dots' tuning; what the sliders and the switch write, and the layer's `settings`. */
  readonly settings = model<NeatDiagramMessageSettings>(NEAT_DIAGRAM_MESSAGE_DEFAULTS);

  protected readonly limits = LIMITS;
  protected readonly defaults = NEAT_DIAGRAM_MESSAGE_DEFAULTS;

  protected set(change: Partial<NeatDiagramMessageSettings>): void {
    this.settings.update((settings) => ({ ...settings, ...change }));
  }
}
