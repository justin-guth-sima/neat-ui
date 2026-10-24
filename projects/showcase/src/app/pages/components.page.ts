import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
  TemplateRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  NeatButton,
  type NeatButtonSize,
  type NeatButtonVariant,
  NeatIcon,
  NeatInlineButton,
  NeatNote,
  NeatPage,
  type NeatTone,
  NeatTooltip,
  type NeatTooltipPosition,
} from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatConfirm } from '@sima/neat-ui/confirm';
import { NeatDetails } from '@sima/neat-ui/details';
import {
  NeatDialog,
  NeatDialogActions,
  NeatDialogBody,
  type NeatDialogRef,
} from '@sima/neat-ui/dialog';
import { NeatDropZone } from '@sima/neat-ui/drop-zone';
import { NeatErrorNote, NeatField } from '@sima/neat-ui/field';
import { NeatFileBrowser } from '@sima/neat-ui/file-browser';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatLevelMeter } from '@sima/neat-ui/level-meter';
import { NeatLine, NeatLineEnd, NeatLineList } from '@sima/neat-ui/line-list';
import { NeatNumberField } from '@sima/neat-ui/number-field';
import { NeatPopover, NeatPopoverContent, NeatPopoverTrigger } from '@sima/neat-ui/popover';
import { NeatProgress } from '@sima/neat-ui/progress';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';
import { NeatSelect, type NeatSelectOption } from '@sima/neat-ui/select';
import { NeatColumn, NeatSelectList, type NeatSelectListGroup } from '@sima/neat-ui/select-list';
import { NeatSlider } from '@sima/neat-ui/slider';
import { NeatStatusChip, NeatStatusChipButton } from '@sima/neat-ui/status-chip';
import { NeatSwitch } from '@sima/neat-ui/switch';
import { NeatTab, NeatTabs } from '@sima/neat-ui/tabs';
import { NeatToasts } from '@sima/neat-ui/toast';
import {
  NeatRoiEditor,
  type NeatRoiDrawMode,
  type NeatRoiPolygon,
  neatRoiNames,
  NeatRoiSwatch,
  NeatTileGrid,
  type NeatTileLayout,
  type NeatTileState,
  NeatVideoTile,
} from '@sima/neat-ui/video';
import { DEMO_TREE, demoSize } from './demo-tree';
import { SourceDialog, type SourceKind } from './source-dialog';
import { TestPatternSource } from './test-pattern-source';

const VARIANTS: NeatButtonVariant[] = ['primary', 'secondary', 'outlined', 'text', 'danger'];
/** The surfaces a button sits on, as the contrast tests have it: the page and a card. */
const SURFACES = ['page', 'card'] as const;
const SIZES: NeatButtonSize[] = ['small', 'medium', 'large', 'touch'];
const ICON_SIZES = [16, 20, 24] as const;
const TOOLTIP_POSITIONS: NeatTooltipPosition[] = ['top', 'right', 'bottom', 'left'];
const TILE_COUNT = 48;
const PLACEHOLDER_TILES = Array.from({ length: TILE_COUNT }, (_, index) => index + 1);
/** A channel of the select list's demo. */
interface DemoChannel {
  readonly id: number;
  readonly name: string;
  readonly state: 'Idle' | 'Live';
}
const DEMO_CHANNELS: readonly DemoChannel[] = Array.from({ length: 24 }, (_, index) => ({
  id: index + 1,
  name: `Channel ${index + 1}`,
  state: index % 5 === 1 ? 'Live' : 'Idle',
}));
const TONES: NeatTone[] = ['neutral', 'success', 'warning', 'danger', 'info', 'highlight'];
/** What each tone says in the demo, as Streaming's slot states do. */
const TONE_LABELS: Record<NeatTone, string> = {
  neutral: 'Idle',
  success: 'Live',
  warning: 'Unreachable',
  danger: 'Auth failed',
  info: 'Connecting',
  highlight: 'External',
};
/** A stream of the toned list's demo: its state's tone tints the row and colours its chip. */
interface DemoStream {
  readonly id: number;
  readonly name: string;
  readonly tone: NeatTone;
  readonly state: string;
}
const DEMO_STREAMS: readonly DemoStream[] = (
  ['success', 'success', 'neutral', 'highlight', 'warning', 'danger', 'info', 'neutral'] as const
).map((tone, index) => ({
  id: index + 1,
  name: `src${index + 1}`,
  tone,
  state: TONE_LABELS[tone],
}));
/** An asset type of the checked list's demo; one has no files, so nothing to check. */
interface DemoType {
  readonly id: string;
  readonly name: string;
  readonly files: number;
}
const DEMO_TYPES: readonly DemoType[] = [
  { id: 'cars', name: 'Cars', files: 12 },
  { id: 'people', name: 'People', files: 8 },
  { id: 'drones', name: 'Drones', files: 0 },
  { id: 'boats', name: 'Boats', files: 3 },
  { id: 'trucks', name: 'Trucks', files: 5 },
];
/** A device of the grouped list's demo, in scan order: the list groups them by kind. */
interface DemoDevice {
  readonly id: number;
  readonly name: string;
  readonly kind: 'camera' | 'microphone' | 'lidar';
  readonly connection: string;
}
const DEMO_DEVICES: readonly DemoDevice[] = [
  { id: 1, name: 'IMX219', kind: 'camera', connection: 'MIPI CSI' },
  { id: 2, name: 'C920 microphone', kind: 'microphone', connection: 'USB' },
  { id: 3, name: 'Logitech C920', kind: 'camera', connection: 'USB 3.0' },
  { id: 4, name: 'Arducam USB', kind: 'camera', connection: 'USB 2.0' },
];
/** The demo's groups: the app writes each label, its count included; LiDAR has none, muted. */
const DEVICE_GROUPS: readonly NeatSelectListGroup[] = [
  { key: 'camera', label: 'Cameras · 3' },
  { key: 'microphone', label: 'Microphones · 1' },
  { key: 'lidar', label: 'LiDAR · none found', muted: true },
];
const CLIP_LENGTHS: NeatSelectOption<number>[] = [
  { value: 60, label: '1 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
];

/** A demo choice for the segmented control; the kit's tiles are always 16:9. */
type Shape = '16:9' | '1:1';

const SHAPES: NeatSegmentedOption<Shape>[] = [
  { value: '16:9', label: '16:9', icon: 'aspect-wide' },
  { value: '1:1', label: '1:1', icon: 'aspect-square' },
];
const OVERLAYS: NeatSegmentedOption<string>[] = [
  { value: 'off', label: 'Off' },
  { value: 'boxes', label: 'Boxes' },
  { value: 'masks', label: 'Masks' },
];
const SOURCE_OPTIONS: NeatSelectOption<string>[] = [
  { value: 'camera', label: 'Front camera' },
  { value: 'clip', label: 'Warehouse clip' },
  { value: 'rtsp', label: 'RTSP stream' },
  { value: 'usb', label: 'USB camera (unavailable)', disabled: true },
  { value: 'file', label: 'Loading dock recording' },
];
const INITIAL_REGIONS = ['Inclusion 1', 'Exclusion 1', 'Exclusion 2'];
const ROI_MODES: NeatSegmentedOption<NeatRoiDrawMode>[] = [
  { value: 'off', label: 'Off' },
  { value: 'inclusion', label: 'Inclusion' },
  { value: 'exclusion', label: 'Exclusion' },
];

@Component({
  selector: 'app-components-page',
  imports: [
    NeatButton,
    NeatCallout,
    NeatCollapsible,
    NeatDetails,
    NeatDialogActions,
    NeatDialogBody,
    NeatColumn,
    NeatDropZone,
    NeatErrorNote,
    NeatField,
    NeatFileBrowser,
    NeatIcon,
    NeatInlineButton,
    NeatInput,
    NeatLevelMeter,
    NeatLine,
    NeatLineEnd,
    NeatLineList,
    NeatNote,
    NeatNumberField,
    NeatPage,
    NeatPopover,
    NeatPopoverContent,
    NeatPopoverTrigger,
    NeatProgress,
    NeatSegmented,
    NeatSelect,
    NeatSelectList,
    NeatSlider,
    NeatStatusChip,
    NeatStatusChipButton,
    NeatSwitch,
    NeatTab,
    NeatTabs,
    NeatTileGrid,
    NeatTooltip,
    NeatRoiEditor,
    NeatRoiSwatch,
    NeatVideoTile,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Button</h2>
          <p class="showcase-muted">
            <code>neatButton</code> on a <code>button</code> or <code>a</code>: five variants in
            four sizes, then icon-only and rounded. Primary is the app's accent; secondary is the
            neutral choice; touch is a 48 px target for kiosk and touch screens.
          </p>
          @for (variant of variants; track variant) {
            <h3>{{ variant }}</h3>
            <div class="showcase-row">
              @for (size of sizes; track size) {
                <button neatButton type="button" [variant]="variant" [size]="size">
                  {{ size }}
                </button>
              }
              @for (size of sizes; track size) {
                <button
                  neatButton
                  type="button"
                  [variant]="variant"
                  [size]="size"
                  iconOnly
                  [attr.aria-label]="'Stream, ' + size"
                >
                  <neat-icon name="streaming" />
                </button>
              }
              <button neatButton type="button" [variant]="variant" rounded>rounded</button>
              <button
                neatButton
                type="button"
                [variant]="variant"
                rounded
                iconOnly
                aria-label="Stream, rounded"
              >
                <neat-icon name="streaming" />
              </button>
            </div>
          }
        </section>

        <section class="showcase-section">
          <h2>Button states</h2>
          <p class="showcase-muted">
            With a <code>neat-icon</code> before the label, disabled, waiting and as a link, per
            variant. Waiting is <code>aria-disabled="true"</code>: it looks disabled with a
            not-allowed cursor, keeps the focus (Tab reaches it) and its hover, so a tooltip on it
            still opens, for a button that waits without dropping the focus; a click, Enter and
            Space still fire its click handler, which the app ignores while it waits.
          </p>
          @for (variant of variants; track variant) {
            <div class="showcase-row">
              <button neatButton type="button" [variant]="variant">
                <neat-icon name="streaming" [size]="16" />
                With icon
              </button>
              <button neatButton type="button" [variant]="variant" disabled>Disabled</button>
              <button neatButton type="button" [variant]="variant" aria-disabled="true">
                Waiting
              </button>
              <!-- Links back to this page, so trying it navigates nowhere. -->
              <a neatButton [variant]="variant" routerLink="/components">Link</a>
            </div>
          }
        </section>

        <section class="showcase-section">
          <h2>Note</h2>
          <p class="showcase-muted">
            <code>neatNote</code> on a <code>p</code> or any element: a short note under a control
            or a heading, with no margin, in the muted text colour and the small text size. A
            <code>neatInlineButton</code> inside takes the note's size and colour.
          </p>
          <div class="card note-demo">
            <label class="showcase-row">
              Delay
              <input neatInput type="text" value="600" aria-describedby="note-delay" />
            </label>
            <p neatNote id="note-delay">
              Applies to every channel that has no value of its own.
              <button neatInlineButton type="button">Show channels</button>
            </p>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Status chip</h2>
          <p class="showcase-muted">
            <code>neat-status-chip</code>: a short status on a status fill, in six tones, the text
            being the content; it truncates rather than widen what holds it. <code>highlight</code>,
            the brand purple, is for a state that is none of the statuses but should stand out. As
            <code>button[neatStatusChip]</code> it is a button that looks the same, for a status
            that opens more about itself (a video tile's "Metadata late"). The words carry the
            state; the colour repeats it.
          </p>
          @for (surface of surfaces; track surface) {
            <div class="showcase-row" [class.card]="surface === 'card'">
              @for (tone of tones; track tone) {
                <neat-status-chip [tone]="tone">{{ toneLabels[tone] }}</neat-status-chip>
              }
              <button
                neatStatusChip
                type="button"
                tone="warning"
                (click)="toasts.status('The late notice would open here.')"
              >
                Metadata late
              </button>
            </div>
          }
          <div class="chip-cell">
            <neat-status-chip tone="highlight"
              >External publisher on a very narrow column</neat-status-chip
            >
          </div>
        </section>

        <section class="showcase-section">
          <h2>Details</h2>
          <p class="showcase-muted">
            <code>neatDetails</code> on a <code>dl</code>: facts about the selected thing, as a side
            panel shows them. The terms are muted, the values beside them take the rest of the
            width, wrap anywhere when long and keep their figures aligned. The pairs are your own
            <code>dt</code> and <code>dd</code> elements, conditional ones too.
          </p>
          <div class="card details-demo">
            <dl neatDetails>
              <dt>Source</dt>
              <dd><code>rtsp://192.168.1.10:554/stream1</code></dd>
              <dt>Status</dt>
              <dd>Pulling</dd>
              <dt>URL</dt>
              <dd class="details-url">
                <code>rtsp://neat.local:8554/src3</code>
                <button neatInlineButton type="button">Copy</button>
              </dd>
              <dt>Live for</dt>
              <dd>1:02:41</dd>
              <dt>Bitrate</dt>
              <dd>4.2 Mbit/s</dd>
            </dl>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Collapsible</h2>
          <p class="showcase-muted">
            <code>neat-collapsible</code>: a section that a full-width button opens and closes, for
            what is not needed every day. While closed, <code>summary</code> says what it holds. The
            content stays instantiated while closed, so gate an expensive one on <code>open</code>.
            Closing it from inside (Save below) puts the focus on its button.
          </p>
          <div class="card details-demo">
            <neat-collapsible
              label="Details"
              summary="IMX219 · MIPI CSI · NV12"
              [(open)]="detailsOpen"
            >
              <dl neatDetails>
                <dt>Model</dt>
                <dd>IMX219</dd>
                <dt>Receiver</dt>
                <dd><code>imx219 1-0010</code></dd>
              </dl>
            </neat-collapsible>
            <neat-collapsible label="Change board" [(open)]="boardOpen">
              <div class="showcase-row">
                <input neatInput type="text" value="192.168.1.20" aria-label="Board address" />
                <button neatButton type="button" (click)="boardOpen.set(false)">Save</button>
              </div>
            </neat-collapsible>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Callout</h2>
          <p class="showcase-muted">
            <code>neat-callout</code>: a note set apart on a status tint, with an icon by tone, an
            optional <code>heading</code> (a real heading, at <code>headingLevel</code>) and actions
            marked <code>neatCalloutActions</code>. <code>region</code> makes it a landmark named by
            its heading (the first one here); <code>announce</code> (<code>status</code> or
            <code>alert</code>) makes it a live region for news, rendered when the news happens.
          </p>
          <div class="callout-demo">
            <neat-callout tone="warning" heading="Board changed" region>
              The board at 192.168.1.20 replaced the previous one. Devices are from the last scan.
              <button neatButton neatCalloutActions type="button" size="small">Refresh</button>
            </neat-callout>
            @for (tone of tones; track tone) {
              <neat-callout [tone]="tone">A {{ tone }} note: {{ toneLabels[tone] }}.</neat-callout>
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Level meter</h2>
          <p class="showcase-muted">
            <code>neat-level-meter</code>: a live audio level as 28 segments from -50 dBFS to full
            scale, green, then amber, then red. <code>sample</code> is a function the meter calls once
            per animation frame (here a sine wave); <code>null</code> stops it and leaves it dark. It
            is hidden from assistive technology, so say the state in text beside it.
          </p>
          <div class="meter-demo">
            <neat-level-meter [sample]="meterRunning() ? sineLevel : null" />
            <button neatButton type="button" size="small" (click)="meterRunning.update((on) => !on)">
              {{ meterRunning() ? 'Stop' : 'Start' }}
            </button>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Inline button</h2>
          <p class="showcase-muted">
            <code>neatInlineButton</code> on a <code>button</code> or <code>a</code>: a text action
            set into a line, as tall as its text, in the line's size and colour, underlined on
            hover. For dense lists where a <code>neatButton</code> would set the line height. The
            actions here do nothing; the third is disabled, and the link leads back to this page.
          </p>
          <div class="card inline-demo">
            <p neatNote>
              Overridden on 2 channels ·
              <button neatInlineButton type="button">Show</button>
            </p>
            <ul neatLineList>
              <li neatLine>
                Channel 3 <span class="showcase-muted">900 ms</span>
                <button neatInlineButton neatLineEnd type="button">Use global</button>
              </li>
              <li neatLine>
                Channel 7 <span class="showcase-muted">600 ms</span>
                <button neatInlineButton neatLineEnd type="button">Use global</button>
              </li>
              <li neatLine>
                <button neatInlineButton type="button" disabled>Reset on 2 channels…</button>
              </li>
              <li neatLine>
                <a neatInlineButton routerLink="/components">All components</a>
              </li>
            </ul>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Line list</h2>
          <p class="showcase-muted">
            <code>neatLineList</code> on a <code>ul</code> or <code>ol</code>, with
            <code>neatLine</code> on its <code>li</code>s: small lines under a thin rule, at least
            1.5rem high. <code>neatLineEnd</code> pushes an element, usually a
            <code>neatInlineButton</code>, to the end of its line. Delete a region to see the list
            shrink.
          </p>
          <div class="card list-demo">
            @if (regions().length === 0) {
              <p class="showcase-muted">No regions.</p>
            } @else {
              <ul neatLineList>
                @for (region of regions(); track region) {
                  <li neatLine>
                    <span>{{ region }}</span>
                    <button
                      neatInlineButton
                      neatLineEnd
                      type="button"
                      [attr.aria-label]="'Delete ' + region"
                      (click)="deleteRegion(region)"
                    >
                      Delete
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
          <div class="showcase-row">
            <button
              neatButton
              type="button"
              variant="outlined"
              size="small"
              (click)="resetRegions()"
            >
              Restore regions
            </button>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Pressed buttons</h2>
          <p class="showcase-muted">
            <code>[pressed]</code> on a toggle: it sets <code>aria-pressed</code> and inverts the
            fill, so the state does not rest on colour alone. Click each one. Leave the input unset
            on a button that is not a toggle. Primary is a solid fill already, so its pressed look
            is the least distinct: toggles belong on the other variants. The last button uses the
            <code>close</code> icon.
          </p>
          @for (surface of surfaces; track surface) {
            <div class="showcase-row" [class.card]="surface === 'card'">
              @for (variant of variants; track variant) {
                <button
                  neatButton
                  type="button"
                  [variant]="variant"
                  [pressed]="pressedVariants().has(variant)"
                  (click)="togglePressed(variant)"
                >
                  {{ variant }}
                </button>
              }
              <button
                neatButton
                type="button"
                variant="outlined"
                iconOnly
                aria-label="Close"
                neatTooltip="Close"
              >
                <neat-icon name="close" />
              </button>
            </div>
          }
        </section>

        <section class="showcase-section">
          <h2>Buttons on a card</h2>
          <p class="showcase-muted">
            On the card surface, which differs from the page background in dark mode. Hover each
            one: the fill must stay visible.
          </p>
          <div class="card showcase-row">
            @for (variant of variants; track variant) {
              <button neatButton type="button" [variant]="variant">{{ variant }}</button>
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Tooltip</h2>
          <p class="showcase-muted">
            <code>neatTooltip</code>: on mouse hover and on keyboard focus, never on touch, so it
            repeats the control's accessible name rather than adding to it. In all four positions.
          </p>
          <div class="showcase-row">
            @for (position of tooltipPositions; track position) {
              <button
                neatButton
                type="button"
                variant="outlined"
                [neatTooltip]="'Tooltip on the ' + position"
                [neatTooltipPosition]="position"
              >
                {{ position }}
              </button>
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Switch</h2>
          <p class="showcase-muted">
            <code>neatSwitch</code> on a <code>button</code>: on or off, applied at once. The
            content is the label and the accessible name; without content, give it an
            <code>aria-label</code>. Space and Enter toggle it.
          </p>
          <div class="showcase-row">
            <button neatSwitch [(checked)]="bars">Bars</button>
            <button neatSwitch [(checked)]="hideEmpty">Hide empty</button>
            <button
              neatSwitch
              aria-label="Bars, without a visible label"
              [(checked)]="bars"
            ></button>
            <button neatSwitch disabled>Disabled</button>
            <button neatSwitch disabled [checked]="true">Disabled, on</button>
          </div>
          <p class="showcase-code showcase-muted">
            Bars {{ bars() ? 'on' : 'off' }}, hide empty {{ hideEmpty() ? 'on' : 'off' }}
          </p>
        </section>

        <section class="showcase-section">
          <h2>Slider</h2>
          <p class="showcase-muted">
            <code>neat-slider</code>: one number in a range, its <code>label</code> the accessible
            name. The value changes on every step of a drag, so what it drives previews live (the
            tile grid below repacks as you drag). Arrows step, Page Up and Down step by ten, Home
            and End jump to the ends.
          </p>
          <div class="slider-field">
            <span>Opacity</span>
            <neat-slider label="Opacity" [min]="0" [max]="100" [step]="5" [(value)]="opacity" />
            <span class="showcase-code showcase-muted">{{ opacity() }} %</span>
          </div>
          <div class="slider-field">
            <span>Described</span>
            <neat-slider
              label="Gain"
              describedBy="gain-note"
              [min]="0"
              [max]="100"
              [step]="5"
              [(value)]="gain"
            />
            <span id="gain-note" class="showcase-muted">
              <code>describedBy</code> names this note, announced after the value.
            </span>
          </div>
          <div class="slider-field">
            <span>Disabled</span>
            <neat-slider label="Disabled" [min]="0" [max]="100" [step]="5" [value]="40" disabled />
          </div>
        </section>

        <section class="showcase-section">
          <h2>Segmented</h2>
          <p class="showcase-muted">
            <code>neat-segmented</code>: one of a few choices, side by side, each with a label and
            an optional icon. A radio group named by <code>label</code>: one tab stop, and the arrow
            keys move the choice.
          </p>
          <div class="showcase-row">
            <neat-segmented #shapeControl label="Tile shape" [options]="shapes" [(value)]="shape" />
            <neat-segmented label="Overlays" [options]="overlays" [(value)]="overlay" />
            <neat-segmented label="Tile shape, disabled" [options]="shapes" value="1:1" disabled />
            <button
              neatButton
              type="button"
              variant="outlined"
              size="small"
              (click)="shapeControl.focus()"
            >
              Focus the tile shape
            </button>
          </div>
          <p class="showcase-code showcase-muted">Shape {{ shape() }}, overlays {{ overlay() }}</p>
        </section>

        <section class="showcase-section">
          <h2>Tabs</h2>
          <p class="showcase-muted">
            <code>neat-tabs</code> with <code>neat-tab</code> children; the open tab is underlined.
            Each panel is an <code>ng-template</code>, created only while its tab is open. Arrow
            keys move between tabs and open them; disabled tabs are skipped.
          </p>
          <neat-tabs label="Channel settings" [(value)]="tab">
            <neat-tab label="Metadata" value="metadata">
              <ng-template>
                <p class="showcase-muted">Overlay types, confidence thresholds and tracking.</p>
              </ng-template>
            </neat-tab>
            <neat-tab label="General" value="general">
              <ng-template>
                <p class="showcase-muted">Video sync buffer, metadata retention and line width.</p>
              </ng-template>
            </neat-tab>
            <neat-tab label="ROI" value="roi" disabled>
              <ng-template><p class="showcase-muted">Regions of interest.</p></ng-template>
            </neat-tab>
          </neat-tabs>
        </section>

        <section class="showcase-section">
          <h2>Popover</h2>
          <p class="showcase-muted">
            <code>neat-popover</code>: a panel of controls below a
            <code>neatPopoverTrigger</code> button, open while they are used. A non-modal dialog
            named by <code>label</code>; focus moves into it, and Escape, a click outside or the
            trigger close it and give focus back to the trigger; Tab out of it closes it and focus
            goes on to the element after the trigger; Shift+Tab out goes back to the trigger.
            <code>align</code> lines it up with the trigger's start, centre or end. The content is
            an <code>ng-template</code>, so its values live in the page.
          </p>
          <div class="showcase-row">
            <neat-popover label="View options" [(open)]="viewOptionsOpen">
              <button
                neatButton
                neatPopoverTrigger
                type="button"
                variant="text"
                iconOnly
                aria-label="View options"
                neatTooltip="View options"
              >
                <neat-icon name="more" />
              </button>
              <ng-template neatPopoverContent>
                <div class="popover-fields">
                  <button neatSwitch [(checked)]="bars">Bars</button>
                  <button neatSwitch [(checked)]="hideEmpty">Hide empty slots</button>
                </div>
              </ng-template>
            </neat-popover>
            <neat-popover label="Go to channel" align="end" [(open)]="channelOpen">
              <button
                neatButton
                neatPopoverTrigger
                type="button"
                variant="text"
                iconOnly
                aria-label="Go to channel"
                neatTooltip="Go to channel"
              >
                <neat-icon name="search" />
              </button>
              <ng-template neatPopoverContent>
                <div class="popover-fields">
                  <label class="popover-fields">
                    <span>Channel</span>
                    <input
                      #channelField
                      neatInput
                      size="small"
                      type="number"
                      inputmode="numeric"
                      min="0"
                      max="15"
                      placeholder="0–15"
                      aria-describedby="channel-hint"
                      [value]="channel()"
                      (input)="channel.set(channelField.value)"
                    />
                  </label>
                  <span id="channel-hint" class="showcase-muted">
                    Aligned to the trigger's end edge.
                  </span>
                </div>
              </ng-template>
            </neat-popover>
          </div>
          <p class="showcase-code showcase-muted">
            View options {{ viewOptionsOpen() ? 'open' : 'closed' }}, go to channel
            {{ channelOpen() ? 'open' : 'closed' }}; bars {{ bars() ? 'on' : 'off' }}, channel
            {{ channel() || 'none' }}
          </p>
        </section>

        <section class="showcase-section">
          <h2>Confirm</h2>
          <p class="showcase-muted">
            <code>NeatConfirm.ask(options)</code> asks before an action and resolves
            <code>true</code> for the confirm button, <code>false</code> for cancel or Escape. A
            modal alert dialog: focus starts on cancel and stays inside, a click on the backdrop
            does nothing, and focus goes back to the button that asked. <code>tone: 'danger'</code>
            is for actions that destroy or cannot be undone.
          </p>
          <div class="showcase-row">
            <button neatButton type="button" variant="outlined" (click)="askResetAll()">
              Reset all channels to global…
            </button>
            <button neatButton type="button" variant="outlined" (click)="askApplyToAll()">
              Apply to all channels…
            </button>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">{{ confirmAnswer() }}</p>
        </section>

        <section class="showcase-section">
          <h2>Dialog</h2>
          <p class="showcase-muted">
            <code>NeatDialog.open(content, options)</code> opens a modal dialog around your own
            content, a template or a component, named by <code>title</code>. Build the content from
            <code>neat-dialog-body</code> (the part that scrolls) and
            <code>neat-dialog-actions</code>. Focus stays inside, Escape and the backdrop close it
            while it is dismissible, and focus goes back to the button that opened it. The
            <code>NeatDialogRef</code> closes it with a result and, while the dialog is busy,
            <code>setDismissible(false)</code> blocks Escape, the backdrop and the close button. A
            component takes values for its inputs from the opener (<code>inputs</code>, typed by the
            component): "Change source of src3…" opens one on the Camera kind. For a yes/no question
            use Confirm.
          </p>
          <div class="showcase-row">
            <button neatButton type="button" variant="outlined" (click)="openRename(renameDialog)">
              Rename source…
            </button>
            <button neatButton type="button" variant="outlined" (click)="openLong(longDialog)">
              Large dialog with long content…
            </button>
            <button neatButton type="button" variant="outlined" (click)="openSource()">
              Change source of src3…
            </button>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">{{ dialogResult() }}</p>

          <ng-template #renameDialog let-dialog>
            <neat-dialog-body>
              <div class="dialog-form">
                <label class="dialog-field">
                  <span>Name</span>
                  <input neatInput #name value="Front door" [readOnly]="saving()" />
                </label>
                <button
                  neatSwitch
                  [disabled]="saving()"
                  [checked]="dialog.dismissible()"
                  (checkedChange)="dialog.setDismissible($event)"
                >
                  Escape and the backdrop close this dialog
                </button>
              </div>
            </neat-dialog-body>
            <neat-dialog-actions>
              <button
                neatButton
                type="button"
                variant="outlined"
                [attr.aria-disabled]="saving() || null"
                (click)="saving() || dialog.close()"
              >
                Cancel
              </button>
              <button
                neatButton
                type="button"
                [attr.aria-disabled]="saving() || null"
                (click)="saving() || save(dialog, name.value)"
              >
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
            </neat-dialog-actions>
          </ng-template>

          <ng-template #longDialog let-dialog>
            <neat-dialog-body>
              <ul class="dialog-list">
                @for (line of longContent; track line) {
                  <li>{{ line }}</li>
                }
              </ul>
            </neat-dialog-body>
            <neat-dialog-actions>
              <button neatButton type="button" (click)="dialog.close()">Done</button>
            </neat-dialog-actions>
          </ng-template>
        </section>

        <section class="showcase-section">
          <h2>Toast</h2>
          <p class="showcase-muted">
            <code>NeatToasts</code> shows short messages without taking the user's attention:
            <code>error</code> and <code>warning</code> (each led by its kind's icon) clear after
            4.6 s, <code>status</code> after 3.2 s, and <code>progress</code> stays until
            <code>done</code> or <code>fail</code>, so work that outlives its page keeps reporting,
            or until <code>dismiss</code> removes it with no outcome (work a dialog took back). The
            app renders one <code>neat-toast-host</code> beside the shell; it shows the newest three
            in the bottom-right corner and announces them politely. A new toast comes to the front,
            above an open dialog; one that was already showing when a dialog opened stays under it.
            Clicks pass through toasts.
          </p>
          <div class="showcase-row">
            <button
              neatButton
              type="button"
              variant="outlined"
              (click)="
                toasts.error('Could not start src3: the stream is held by another publisher.')
              "
            >
              Error
            </button>
            <button
              neatButton
              type="button"
              variant="outlined"
              (click)="toasts.status('Stopped 2 sources.')"
            >
              Status
            </button>
            <button
              neatButton
              type="button"
              variant="outlined"
              (click)="
                toasts.warning('Uploaded clip.mp4, but could not restart src2: it is in use.')
              "
            >
              Warning
            </button>
            <button neatButton type="button" variant="outlined" (click)="runProgress('done')">
              Progress, succeeding
            </button>
            <button neatButton type="button" variant="outlined" (click)="runProgress('fail')">
              Progress, failing
            </button>
            <button neatButton type="button" variant="outlined" (click)="runProgress('unknown')">
              Progress, unknown length
            </button>
            <button neatButton type="button" variant="outlined" (click)="runProgress('dismiss')">
              Progress, dismissed
            </button>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Input</h2>
          <p class="showcase-muted">
            <code>neatInput</code> on an <code>input</code>: text or number, in two sizes. Native
            attributes such as <code>type</code>, <code>inputmode</code> and <code>min</code> keep
            their meaning. Name it with a label or an <code>aria-label</code>.
          </p>
          <div class="showcase-row input-row">
            <label class="input-field">
              <span>Stream name</span>
              <input neatInput placeholder="Front door" />
            </label>
            <label class="input-field">
              <span>Go to page</span>
              <input neatInput size="small" type="number" inputmode="numeric" min="1" value="1" />
            </label>
            <label class="input-field">
              <span>Disabled</span>
              <input neatInput disabled value="Read only" />
            </label>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Number field</h2>
          <p class="showcase-muted">
            <code>neat-number-field</code>: a small field for jumping to one whole number, its label
            before it and naming it. Enter or leaving the field commits a whole number that
            <code>accept</code> takes, even the one already shown; anything else puts the shown
            value back. Content marked <code>neatNumberFieldSuffix</code> follows the input. This
            page field accepts 1 to {{ pageCount }}. <code>focus()</code> focuses the input with its
            number selected, for a shortcut that jumps to the field.
          </p>
          <div class="showcase-row">
            <neat-number-field
              #pageField
              label="Page"
              [value]="page()"
              [accept]="acceptPage"
              (commit)="commitPage($event)"
            >
              <span neatNumberFieldSuffix>of {{ pageCount }}</span>
            </neat-number-field>
            <neat-number-field
              label="Draw on channel"
              [value]="drawChannel()"
              (commit)="drawChannel.set($event)"
            />
            <button neatButton type="button" variant="outlined" (click)="pageField.focus()">
              Focus the page field
            </button>
          </div>
          <p class="showcase-code showcase-muted">
            Page {{ page() }}, commits so far {{ pageCommits() }}; channel {{ drawChannel() }}
          </p>
        </section>

        <section class="showcase-section">
          <h2>Field</h2>
          <p class="showcase-muted">
            <code>neat-field</code>: a control under its visible name, inside a label that names it,
            with an optional <code>hint</code> and <code>error</code> under it that describe the
            control (and mark it invalid). Its name is drawn as a shown select's is, so in a row of
            controls of one <code>size</code>, aligned at their bottom edge, the names share a
            baseline and the controls their edges: below, a field, two selects, a number field and a
            button, small and then medium. <code>neat-error-note</code> says a failure in place: an
            alert in the danger colour that keeps the message's line breaks.
          </p>
          <div class="field-demo">
            <neat-field label="Stream URL" hint="RTSP and RTSPS only.">
              <input
                neatInput
                size="small"
                type="url"
                placeholder="rtsp://192.168.1.10:554/stream1"
              />
            </neat-field>
            <neat-field label="Start Time" error="Use minutes and seconds, as 1:30.">
              <input neatInput size="small" value="90s" />
            </neat-field>
          </div>
          @for (size of fieldSizes; track size) {
            <div class="field-row" [attr.data-size]="size">
              <neat-field class="field-narrow" label="Start Time"
                ><input neatInput [size]="size" placeholder="0:00"
              /></neat-field>
              <neat-select
                class="field-wide"
                label="Target Resolution & FPS"
                showLabel
                [size]="size"
                [options]="sourceOptions"
                [(value)]="source"
              />
              <neat-select
                class="field-narrow"
                label="Clip Length"
                showLabel
                [size]="size"
                [options]="clipLengths"
                [value]="300"
              />
              @if (size === 'small') {
                <neat-number-field
                  label="Page"
                  [value]="page()"
                  [accept]="acceptPage"
                  (commit)="commitPage($event)"
                />
              }
              <button neatButton type="button" variant="outlined" [size]="size">Validate</button>
            </div>
          }
          <neat-error-note>{{ validateError }}</neat-error-note>
        </section>

        <section class="showcase-section">
          <h2>Select</h2>
          <p class="showcase-muted">
            <code>neat-select</code>: a choice of one value from a list, no free text. Its
            <code>label</code> is the accessible name of the select and its list;
            <code>showLabel</code> also shows it above the select. The arrow keys, Home and End move
            through the options (a disabled one is skipped), typing a few letters jumps to a label,
            Enter or Space picks and Escape closes the list without picking. It fills its
            container's width, and <code>size</code> (small or medium) matches the input's and the
            button's (see Field). Inside a dialog its list shows above the dialog, and Escape closes
            the list only; the next Escape closes the dialog.
          </p>
          <div class="showcase-row select-row">
            <neat-select
              label="Source"
              placeholder="Pick a source"
              showLabel
              [options]="sourceOptions"
              [(value)]="source"
            />
            <neat-select
              label="Source, label hidden"
              placeholder="Pick a source"
              [options]="sourceOptions"
              [(value)]="source"
            />
            <neat-select label="Disabled" disabled [options]="sourceOptions" [value]="'rtsp'" />
            <button neatButton type="button" variant="outlined" (click)="openAssign(assignDialog)">
              Assign a source…
            </button>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">
            Selected: {{ source() ?? 'none' }}; {{ assignResult() }}
          </p>

          <ng-template #assignDialog let-dialog>
            <neat-dialog-body>
              <neat-select
                label="Source for channel 3"
                showLabel
                placeholder="Pick a source"
                [options]="sourceOptions"
                [(value)]="dialogSource"
              />
            </neat-dialog-body>
            <neat-dialog-actions>
              <button neatButton type="button" variant="outlined" (click)="dialog.close()">
                Cancel
              </button>
              <button neatButton type="button" (click)="dialog.close(dialogSource())">
                Assign
              </button>
            </neat-dialog-actions>
          </ng-template>
        </section>

        <section class="showcase-section">
          <h2>Progress</h2>
          <p class="showcase-muted">
            <code>neat-progress</code>: a bar for work with a known share done (<code>value</code>,
            0 to 100) or without one (<code>null</code>: the bar moves on its own, and without
            motion it is a still bar of stripes). <code>label</code> is the accessible name; a
            screen reader reads the value when it reaches the bar but is not told of every change.
            The toasts' progress bar is this one. With a <code>heading</code> it is a titled
            readout: the heading (a polite status) with the whole percent at its end, a
            <code>detail</code> line that cuts with its full text as a tooltip, then the bar; the
            progress toast renders through it.
          </p>
          <div class="progress-demo">
            <span>Known, from the slider</span>
            <neat-progress label="Upload" [value]="progress()" />
            <neat-slider
              class="progress-slider"
              label="Progress value"
              [min]="0"
              [max]="100"
              [step]="5"
              [(value)]="progress"
            />
            <span>Complete</span>
            <neat-progress label="Import" [value]="100" />
            <span>Unknown</span>
            <neat-progress label="Preparing" [value]="null" />
            <span>Titled</span>
            <neat-progress
              heading="Encoding clip.mp4"
              detail="0:41 / 1:37 · h264_v4l2m2m, at 30 fps, a very long detail that cuts at the end"
              [value]="progress()"
            />
            <neat-progress heading="Preparing" detail="Probing the file" [value]="null" />
          </div>
        </section>

        <section class="showcase-section">
          <h2>Drop zone</h2>
          <p class="showcase-muted">
            <code>neat-drop-zone</code>: drop files on it, or click it (or press Enter or Space on
            it) for the system's file chooser. <code>files</code> emits what was dropped or chosen;
            <code>accept</code> filters what is dropped, <code>multiple</code> allows several, and
            <code>rejected</code> lists what was not taken (the first zone takes one video, so drop
            a text file on it to see it). Files being dragged over it light it up. Disabled, it
            ignores clicks and drops.
          </p>
          <div class="drop-demo">
            <neat-drop-zone
              label="Drop one video here, or click to choose"
              accept="video/*,.mkv"
              (rejected)="logDrop('Not accepted', $event)"
              (files)="logDrop('Received', $event)"
            />
            <neat-drop-zone
              label="Drop any files here, or click to choose"
              multiple
              (files)="logDrop('Received', $event)"
            />
            <neat-drop-zone label="Uploads are paused" disabled />
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">
            @for (line of dropLog(); track $index) {
              {{ line }}<br />
            } @empty {
              Nothing dropped yet
            }
          </p>
        </section>

        <section class="showcase-section">
          <h2>Select list</h2>
          <p class="showcase-muted">
            <code>neat-select-list</code>: rows in columns that the app lays out with
            <code>neatColumn</code> templates, one selected. It fills its container and scrolls its
            rows under a header that stays put, filled with <code>--neat-surface</code> (the card
            sets it to its own fill). Focus the list with Tab: Up and Down move the selection, Home
            and End jump to the ends, Enter and a click tell <code>activated</code>. A button in a
            row keeps its own keys and clicks (Tab reaches it after the list). With no items it says
            why.
          </p>
          <div class="showcase-row list-row">
            <div class="list-box">
              <neat-select-list
                label="Channels"
                [items]="listChannels()"
                [trackBy]="channelId"
                [(selected)]="listChannel"
                (activated)="listLog.set('Activated ' + $event.name)"
              >
                <ng-template neatColumn="name" header="Channel" let-channel>{{
                  channel.name
                }}</ng-template>
                <ng-template neatColumn="state" header="State" width="6rem" let-channel>{{
                  channel.state
                }}</ng-template>
                <ng-template neatColumn="action" width="4rem" let-channel>
                  <button neatInlineButton type="button" (click)="toggleChannel(channel)">
                    {{ channel.state === 'Live' ? 'Stop' : 'Start' }}
                  </button>
                </ng-template>
              </neat-select-list>
            </div>
            <div class="list-box card">
              <neat-select-list
                label="Channels on a card"
                [items]="listChannels()"
                [trackBy]="channelId"
                [(selected)]="listChannel"
              >
                <ng-template neatColumn="name" header="Channel" let-channel>{{
                  channel.name
                }}</ng-template>
                <ng-template neatColumn="state" header="State" width="6rem" let-channel>{{
                  channel.state
                }}</ng-template>
              </neat-select-list>
            </div>
            <div class="list-box" [class.list-box-narrow]="narrowList()">
              <neat-select-list
                label="Channels, narrowing"
                [items]="listChannels()"
                [trackBy]="channelId"
                [(selected)]="listChannel"
              >
                <ng-template neatColumn="name" header="Channel" let-channel>{{
                  channel.name
                }}</ng-template>
                <ng-template
                  neatColumn="rate"
                  header="Rate"
                  width="4rem"
                  [hideBelow]="300"
                  let-channel
                  >30</ng-template
                >
                <ng-template neatColumn="state" header="State" width="5rem" let-channel>{{
                  channel.state
                }}</ng-template>
              </neat-select-list>
            </div>
            <div class="list-box list-box-short">
              <neat-select-list
                label="Cameras"
                emptyLabel="No cameras enabled yet."
                [items]="noChannels"
                [trackBy]="channelId"
              >
                <ng-template neatColumn="name" let-channel>{{ channel.name }}</ng-template>
              </neat-select-list>
            </div>
          </div>
          <div class="showcase-row">
            <button neatSwitch [(checked)]="narrowList">Narrow the third list</button>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">
            Selected: {{ listChannel()?.name ?? 'none' }}; {{ listLog() }}
          </p>
          <h3>Checked</h3>
          <p class="showcase-muted">
            With <code>checkable</code>, each row that <code>canCheck</code> allows has a box, and
            <code>checked</code> holds their keys. The arrow keys move the row the keyboard is on
            (the bar); Space checks or unchecks it, as a click on its box does. Drones has no files,
            so nothing to check. The header and the rows share one grid, so Files sizes to its
            widest heading or count (<code>width="max-content"</code>), and
            <code>align="end"</code> puts both at the column's end, as numbers read best.
          </p>
          <div class="showcase-row list-row">
            <div class="list-box list-box-checked">
              <neat-select-list
                label="Asset types"
                checkable
                [items]="demoTypes"
                [trackBy]="typeId"
                [canCheck]="hasFiles"
                [(checked)]="checkedTypes"
              >
                <ng-template neatColumn="name" header="Type" let-type>{{ type.name }}</ng-template>
                <ng-template
                  neatColumn="files"
                  header="Files"
                  width="max-content"
                  align="end"
                  let-type
                  >{{ type.files }}</ng-template
                >
              </neat-select-list>
            </div>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">
            Checked: {{ checkedTypes().length ? checkedTypes().join(', ') : 'none' }}
          </p>
          <h3>Grouped</h3>
          <p class="showcase-muted">
            <code>groups</code> puts the rows under headings, in the groups' order, and
            <code>groupOf</code> names each item's group. The label is the app's own (the count
            too); a <code>muted</code> group, such as one with nothing found, greys its heading. The
            arrow keys cross the groups and never stop on a heading.
          </p>
          <div class="showcase-row list-row">
            <div class="list-box list-box-grouped">
              <neat-select-list
                label="Devices"
                [items]="demoDevices"
                [trackBy]="deviceId"
                [groups]="deviceGroups"
                [groupOf]="deviceKind"
                [(selected)]="device"
              >
                <ng-template neatColumn="name" header="Device" let-device>{{
                  device.name
                }}</ng-template>
                <ng-template neatColumn="connection" header="Connection" width="6rem" let-device>{{
                  device.connection
                }}</ng-template>
              </neat-select-list>
            </div>
          </div>
          <h3>Toned</h3>
          <p class="showcase-muted">
            <code>rowTone</code> gives each row a tone (<code>NeatTone</code>, as the status chip
            has): a toned row has a soft tint of it, a neutral one none. Give a row and its chip the
            same tone. Hover and selection still show, with more of the tone, and the selected row
            keeps its bar. The tints are mixed over the content background, so a toned list sits on
            the page, not on a card.
          </p>
          <div class="showcase-row list-row">
            <div class="list-box list-box-toned">
              <neat-select-list
                label="Streams"
                [items]="demoStreams"
                [trackBy]="streamId"
                [rowTone]="streamTone"
                [(selected)]="stream"
              >
                <ng-template neatColumn="name" header="Slot" let-stream>{{
                  stream.name
                }}</ng-template>
                <ng-template neatColumn="kind" header="Kind" width="3rem" let-stream>
                  <span class="showcase-muted">VID</span>
                </ng-template>
                <ng-template neatColumn="state" header="State" width="7rem" let-stream>
                  <neat-status-chip [tone]="stream.tone">{{ stream.state }}</neat-status-chip>
                </ng-template>
              </neat-select-list>
            </div>
          </div>
        </section>

        <section class="showcase-section">
          <h2>File browser</h2>
          <p class="showcase-muted">
            <code>neat-file-browser</code>: a tree of folders and files, with a breadcrumb, a count,
            and a filter over the current folder and below that shows paths relative to it and
            empties when you navigate. Folders list first, by name ignoring case, each with the
            number of usable files in it. Click a folder or press Enter on it to open it; click a
            crumb or press Backspace in the list to go up. The arrow keys move the selection, which
            is a file (they leave it as it is while passing a folder). Files marked
            <code>unavailable</code> are greyed, with their <code>tag</code> as a neutral status
            chip, and can still be selected. The second browser is in <code>manage</code> mode, the
            select list's checked mode: a box per file that Space toggles from the keyboard (the
            boxes are not tab stops), and extra columns, after which a folder's count follows its
            name. The <code>archive</code> folder has a thousand files.
          </p>
          <div class="showcase-row list-row">
            <div class="browser-box">
              <neat-file-browser
                rootLabel="Media Root"
                filterPlaceholder="Filter files…"
                [root]="demoTree"
                [(folder)]="pickFolder"
                [(selected)]="pickSelected"
              />
            </div>
            <div class="browser-box card">
              <neat-file-browser
                rootLabel="Media Root"
                mode="manage"
                filterPlaceholder="Filter files…"
                [root]="demoTree"
                [countLabel]="videoCount"
                [(folder)]="manageFolder"
                [(selected)]="manageSelected"
                [(checked)]="manageChecked"
                [(filter)]="manageFilter"
              >
                <ng-template neatColumn="type" header="Type" width="4rem" let-file>{{
                  fileType(file.name)
                }}</ng-template>
                <ng-template neatColumn="size" header="Size" width="5.5rem" let-file>{{
                  fileSize(file.path)
                }}</ng-template>
              </neat-file-browser>
            </div>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">
            Picked: {{ pickSelected() ?? 'none' }} (in /{{ pickFolder() }}); managing: selected
            {{ manageSelected() ?? 'none' }}, {{ manageChecked().length }} checked, filter
            {{ manageFilter() ? '“' + manageFilter() + '”' : 'empty' }}
          </p>
        </section>

        <section class="showcase-section">
          <h2>Controls on a card</h2>
          <p class="showcase-muted">
            On the card surface, which differs from the page background in dark mode.
          </p>
          <div class="card showcase-row">
            <button neatSwitch [(checked)]="bars">Bars</button>
            <neat-slider
              class="card-slider"
              label="Opacity"
              [min]="0"
              [max]="100"
              [step]="5"
              [(value)]="opacity"
            />
            <neat-segmented label="Tile shape" [options]="shapes" [(value)]="shape" />
            <div class="card-field">
              <input neatInput size="small" aria-label="Jump to channel" placeholder="Channel" />
            </div>
            <neat-select
              class="card-select"
              label="Source, on a card"
              placeholder="Pick a source"
              [options]="sourceOptions"
              [(value)]="source"
            />
          </div>
          <div class="card card-stack">
            <neat-progress label="Upload, on a card" [value]="progress()" />
            <neat-progress label="Preparing, on a card" [value]="null" />
            <neat-drop-zone label="Drop files here, on a card" multiple />
          </div>
          <div class="card">
            <neat-tabs label="Channel settings, on a card" [(value)]="tab">
              <neat-tab label="Metadata" value="metadata">
                <ng-template><p class="showcase-muted">Metadata settings.</p></ng-template>
              </neat-tab>
              <neat-tab label="General" value="general">
                <ng-template><p class="showcase-muted">General settings.</p></ng-template>
              </neat-tab>
            </neat-tabs>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Icon</h2>
          <p class="showcase-muted">
            At 16, 20 and 24 px. Without a label an icon is decorative and hidden from assistive
            technology; with one it is exposed as an image with that name.
          </p>
          <div class="showcase-row">
            @for (size of iconSizes; track size) {
              <div class="icon-sample">
                <neat-icon name="board" [size]="size" />
                <span class="showcase-code showcase-muted">{{ size }} px</span>
              </div>
            }
          </div>
          <div class="showcase-row">
            @for (size of iconSizes; track size) {
              <div class="icon-sample">
                <neat-icon name="board" [size]="size" label="Board" />
                <span class="showcase-code showcase-muted">{{ size }} px, label</span>
              </div>
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Tile grid</h2>
          <p class="showcase-muted">
            <code>neat-tile-grid</code> packs tiles of a chosen width into its own box with no
            overflow and no scrolling, centring what is left over. The count per page follows from
            the width (<code>layout</code>), so the page slices its items to <code>perPage</code>.
            The box below is fixed in height; resize the window to repack.
          </p>
          <div class="slider-field">
            <span>Tile width</span>
            <neat-slider
              label="Tile width"
              [min]="120"
              [max]="480"
              [step]="10"
              [(value)]="tileWidth"
            />
            <span class="showcase-code showcase-muted">{{ tileWidth() }} px</span>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">{{ layoutSummary() }}</p>
          <div class="tile-demo">
            <neat-tile-grid
              [tileWidth]="tileWidth()"
              [count]="visibleTiles().length"
              (layout)="layout.set($event)"
            >
              @for (tile of visibleTiles(); track tile) {
                <div class="demo-tile">{{ tile }}</div>
              }
            </neat-tile-grid>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Video tile</h2>
          <p class="showcase-muted">
            <code>neat-video-tile</code> plays a source's video with its metadata drawn over the
            frames it describes, and fills the box it is given. The first tile plays a canvas test
            pattern with a detection every other frame, held in between; pause it and it goes
            stopped after 1.8 s without a frame. The second has no stream, so it is empty. With bars
            off a tile is only video and overlay.
          </p>
          <div class="showcase-row">
            <button neatSwitch [(checked)]="tileBars">Bars</button>
            <button neatSwitch [(checked)]="tileSelected">Selected</button>
            <button neatSwitch (checkedChange)="testPattern.setPaused($event)">
              Pause the source
            </button>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">{{ tileSummary() }}</p>
          <div class="video-demo">
            <div class="video-demo-cell">
              <neat-video-tile
                [source]="testPattern"
                label="1"
                status="Test pattern · 640×360 · 30 fps"
                [bars]="tileBars()"
                [selected]="tileSelected()"
                (stateChange)="tileState.set($event)"
              >
                <span neatTileChip class="demo-chip">Demo</span>
              </neat-video-tile>
            </div>
            <div class="video-demo-cell">
              <neat-video-tile label="2" status="Waiting for stream" [bars]="tileBars()" />
            </div>
          </div>
        </section>

        <section class="showcase-section">
          <h2>ROI editor</h2>
          <p class="showcase-muted">
            <code>neat-roi-editor</code> draws regions of interest on a tile's image and adds
            polygons by clicks: one per point, a click on the first point or a double-click to close
            it (three points at least), Escape to cancel. It is placed in the tile with
            <code>neatTileOverlay</code> and follows the image, not the letterbox, so the points
            stay on the picture when the tile resizes. It owns no regions: the page keeps them and
            takes each closed polygon from <code>regionsChange</code>. In every mode, Off included,
            hovering a region highlights it (<code>highlighted</code>, two-way, for the app's list)
            and a right-click on one offers Delete. The tile plays the same test pattern as the one
            above: pause that source and the tile stops, and the editor keeps working on the tile's
            full box. <code>neat-roi-swatch</code> is the dot a region list puts before each name.
          </p>
          <div class="showcase-row">
            <neat-segmented label="Drawing mode" [options]="roiModes" [(value)]="roiMode" />
            <button neatButton type="button" variant="outlined" (click)="roiRegions.set([])">
              Clear regions
            </button>
            <span class="roi-key"><neat-roi-swatch type="inclusion" />Inclusion</span>
            <span class="roi-key"><neat-roi-swatch type="exclusion" />Exclusion</span>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">{{ roiSummary() }}</p>
          <div class="video-demo">
            <div class="video-demo-cell">
              <neat-video-tile [source]="testPattern" [bars]="false">
                <neat-roi-editor
                  neatTileOverlay
                  [regions]="roiRegions()"
                  [mode]="roiMode()"
                  [(highlighted)]="roiHighlighted"
                  (regionsChange)="roiRegions.set($event)"
                />
              </neat-video-tile>
            </div>
          </div>
        </section>
      </div>
    </neat-page>
  `,
  styleUrl: './components.page.css',
})
export class ComponentsPage {
  protected readonly variants = VARIANTS;
  protected readonly surfaces = SURFACES;
  protected readonly sizes = SIZES;
  protected readonly iconSizes = ICON_SIZES;
  protected readonly tooltipPositions = TOOLTIP_POSITIONS;
  protected readonly shapes = SHAPES;
  protected readonly tones = TONES;
  protected readonly toneLabels = TONE_LABELS;
  protected readonly fieldSizes = ['small', 'medium'] as const;
  protected readonly clipLengths = CLIP_LENGTHS;
  /** A server's diagnostics, on two lines. */
  protected readonly validateError =
    'Could not validate the URL.\nyt-dlp: ERROR: [youtube] abc123: Video unavailable';
  protected readonly narrowList = signal(false);
  protected readonly detailsOpen = signal(false);
  protected readonly meterRunning = signal(true);
  /** Swings from -50 to 0 dBFS and back about every four seconds, as the meter's demo signal. */
  protected readonly sineLevel = () => -25 + 25 * Math.sin(performance.now() / 600);
  protected readonly boardOpen = signal(false);
  protected readonly demoTypes = DEMO_TYPES;
  protected readonly demoDevices = DEMO_DEVICES;
  protected readonly deviceGroups = DEVICE_GROUPS;
  protected readonly device = signal<DemoDevice | null>(null);
  protected readonly deviceId = (device: DemoDevice) => device.id;
  protected readonly deviceKind = (device: DemoDevice) => device.kind;
  protected readonly typeId = (type: DemoType) => type.id;
  protected readonly hasFiles = (type: DemoType) => type.files > 0;
  protected readonly checkedTypes = signal<readonly string[]>(['cars']);
  protected readonly demoStreams = DEMO_STREAMS;
  protected readonly streamId = (stream: DemoStream) => stream.id;
  protected readonly streamTone = (stream: DemoStream) => stream.tone;
  protected readonly stream = signal<DemoStream | null>(DEMO_STREAMS[3]);
  protected readonly overlays = OVERLAYS;

  protected readonly bars = signal(true);
  protected readonly hideEmpty = signal(false);
  protected readonly opacity = signal(60);
  protected readonly gain = signal(30);
  protected readonly pressedVariants = signal<ReadonlySet<NeatButtonVariant>>(
    new Set(['secondary', 'outlined']),
  );
  protected readonly shape = signal<Shape>('16:9');
  protected readonly overlay = signal('boxes');
  protected readonly tab = signal('metadata');
  protected readonly viewOptionsOpen = signal(false);
  protected readonly channelOpen = signal(false);
  protected readonly channel = signal('');
  protected readonly regions = signal(INITIAL_REGIONS);
  protected readonly pageCount = 9;
  protected readonly page = signal(3);
  protected readonly pageCommits = signal(0);
  protected readonly drawChannel = signal(2);
  protected readonly acceptPage = (n: number) => n >= 1 && n <= this.pageCount;
  protected readonly sourceOptions = SOURCE_OPTIONS;
  protected readonly source = signal<string | null>(null);
  protected readonly dialogSource = signal<string | null>(null);
  protected readonly assignResult = signal('dialog not opened yet');
  protected readonly progress = signal(40);
  protected readonly dropLog = signal<readonly string[]>([]);
  protected readonly listChannels = signal<readonly DemoChannel[]>(DEMO_CHANNELS);
  protected readonly noChannels: readonly DemoChannel[] = [];
  protected readonly listChannel = signal<DemoChannel | null>(null);
  protected readonly listLog = signal('nothing activated yet');
  protected readonly channelId = (channel: DemoChannel) => channel.id;
  protected readonly demoTree = DEMO_TREE;
  protected readonly pickFolder = signal('');
  protected readonly pickSelected = signal<string | null>(null);
  protected readonly manageFolder = signal('clips');
  protected readonly manageSelected = signal<string | null>(null);
  protected readonly manageChecked = signal<readonly string[]>([]);
  protected readonly manageFilter = signal('');
  protected readonly videoCount = (_folder: string, count: number) =>
    `${count} ${count === 1 ? 'video' : 'videos'}`;
  protected readonly fileType = (name: string) => name.split('.').pop()!.toUpperCase();
  protected readonly fileSize = demoSize;
  protected readonly confirmAnswer = signal('Not asked yet');
  private readonly confirm = inject(NeatConfirm);
  private readonly dialogs = inject(NeatDialog);
  protected readonly toasts = inject(NeatToasts);
  protected readonly dialogResult = signal('Not opened yet');
  protected readonly saving = signal(false);
  protected readonly longContent = Array.from(
    { length: 40 },
    (_, index) => `Source src${index + 1}: assigned, waiting to start`,
  );

  protected readonly tileWidth = signal(240);
  protected readonly layout = signal<NeatTileLayout | null>(null);
  protected readonly visibleTiles = computed(() =>
    PLACEHOLDER_TILES.slice(0, this.layout()?.perPage ?? TILE_COUNT),
  );
  protected readonly layoutSummary = computed(() => {
    const layout = this.layout();
    return layout
      ? `${layout.columns} × ${layout.rows} = ${layout.perPage} per page of ${TILE_COUNT}, gap ${layout.gap} px`
      : 'Measuring';
  });

  protected readonly testPattern = new TestPatternSource();
  protected readonly tileBars = signal(true);
  protected readonly tileSelected = signal(false);
  protected readonly tileState = signal<NeatTileState>('empty');
  protected readonly tileSummary = computed(() => `First tile: ${this.tileState()}`);

  protected readonly roiModes = ROI_MODES;
  protected readonly roiMode = signal<NeatRoiDrawMode>('inclusion');
  protected readonly roiRegions = signal<readonly NeatRoiPolygon[]>([]);
  protected readonly roiHighlighted = signal<number | null>(null);
  protected readonly roiSummary = computed(() => {
    const regions = this.roiRegions();
    const count = (type: NeatRoiPolygon['type']) =>
      regions.filter((region) => region.type === type).length;
    const index = this.roiHighlighted();
    // Named as the editor's Delete and an app's region list name it.
    const highlighted = (index === null ? undefined : neatRoiNames(regions)[index]) ?? 'none';
    return `Regions: ${regions.length} (${count('inclusion')} inclusion, ${count('exclusion')} exclusion) · highlighted: ${highlighted}`;
  });

  /** A new object per change, as a poll's answer would be: the rows are kept, their cells update. */
  protected toggleChannel(channel: DemoChannel): void {
    const state = channel.state === 'Live' ? 'Idle' : 'Live';
    this.listChannels.update((channels) =>
      channels.map((candidate) =>
        candidate.id === channel.id ? { ...candidate, state } : candidate,
      ),
    );
  }

  protected async askResetAll(): Promise<void> {
    const reset = await this.confirm.ask({
      title: 'Reset all channels to global?',
      message: "4 settings on 3 channels go back to the global values. This can't be undone.",
      confirmLabel: 'Reset',
      tone: 'danger',
    });
    this.confirmAnswer.set(`Reset all: ${reset ? 'confirmed' : 'cancelled'}`);
  }

  protected async askApplyToAll(): Promise<void> {
    const apply = await this.confirm.ask({
      title: 'Apply to all channels?',
      message: 'Every channel takes the global overlay settings.',
      confirmLabel: 'Apply',
      cancelLabel: 'Not now',
    });
    this.confirmAnswer.set(`Apply to all: ${apply ? 'confirmed' : 'cancelled'}`);
  }

  protected async openRename(content: TemplateRef<unknown>): Promise<void> {
    const name = await this.dialogs.open<string>(content, { title: 'Rename source' }).closed;
    this.dialogResult.set(name === undefined ? 'Rename: dismissed' : `Rename: saved "${name}"`);
  }

  protected async openAssign(content: TemplateRef<unknown>): Promise<void> {
    const source = await this.dialogs.open<string | null>(content, { title: 'Assign a source' })
      .closed;
    this.assignResult.set(
      source === undefined ? 'dialog dismissed' : `dialog assigned ${source ?? 'nothing'}`,
    );
  }

  protected async openSource(): Promise<void> {
    const kind = await this.dialogs.open<SourceDialog, SourceKind>(SourceDialog, {
      title: 'Change source',
      inputs: { slot: 3, startOn: 'camera' },
    }).closed;
    this.dialogResult.set(kind === undefined ? 'Source: dismissed' : `Source: ${kind}`);
  }

  /** Newest first, as a log: a drop can report what it took and what it did not. */
  protected logDrop(what: 'Received' | 'Not accepted', files: File[]): void {
    const names = files.map((file) => file.name).join(', ');
    this.dropLog.update((log) => [`${what}: ${names}`, ...log].slice(0, 4));
  }

  protected async openLong(content: TemplateRef<unknown>): Promise<void> {
    await this.dialogs.open(content, { title: 'Sources', size: 'large' }).closed;
    this.dialogResult.set('Sources: closed');
  }

  /**
   * Saving takes a moment, during which the dialog may not be dismissed. The buttons are marked
   * `aria-disabled` rather than `disabled`: the button that was pressed has focus, and a disabled
   * control loses it, which would leave the keyboard outside the dialog.
   */
  protected save(dialog: NeatDialogRef<string>, name: string): void {
    this.saving.set(true);
    dialog.setDismissible(false);
    setTimeout(() => {
      this.saving.set(false);
      dialog.close(name);
    }, 1500);
  }

  /**
   * Simulates work: it reports for a few seconds and then settles, or, for `dismiss`, is taken
   * away halfway. It runs on its own, as an upload does, so leaving the page does not stop the
   * toast from reporting the outcome.
   */
  protected runProgress(outcome: 'done' | 'fail' | 'unknown' | 'dismiss'): void {
    const toast = this.toasts.progress('Uploading 3 files');
    const known = outcome !== 'unknown';
    let percent = 0;
    const timer = setInterval(() => {
      percent += 8;
      if (outcome === 'dismiss' && percent >= 48) {
        // As when a dialog takes the work back: the toast goes, with no outcome.
        clearInterval(timer);
        toast.dismiss();
        return;
      }
      if (percent < 100) {
        const file = Math.min(3, Math.floor(percent / 34) + 1);
        toast.update(`clip-${file}.mp4 · file ${file} of 3`, known ? percent : null);
        return;
      }
      clearInterval(timer);
      if (outcome === 'fail') toast.fail('Upload failed: no space left on the device.');
      else toast.done('Uploaded 3 files.');
    }, 250);
  }

  protected deleteRegion(region: string): void {
    this.regions.update((regions) => regions.filter((name) => name !== region));
  }

  protected resetRegions(): void {
    this.regions.set(INITIAL_REGIONS);
  }

  protected commitPage(page: number): void {
    this.page.set(page);
    this.pageCommits.update((count) => count + 1);
  }

  protected togglePressed(variant: NeatButtonVariant): void {
    this.pressedVariants.update((pressed) => {
      const next = new Set(pressed);
      if (!next.delete(variant)) next.add(variant);
      return next;
    });
  }

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.testPattern.start(document));
    inject(DestroyRef).onDestroy(() => this.testPattern.stop());
  }
}
