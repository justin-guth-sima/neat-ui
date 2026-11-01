import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import {
  NeatButton,
  NeatEasedNumber,
  NeatIcon,
  NeatInlineButton,
  NeatLiveDot,
  NeatNote,
  NeatPage,
  NeatStale,
  type NeatTone,
  neatStoredSignal,
} from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatDetails } from '@sima/neat-ui/details';
import { NeatFileBrowser } from '@sima/neat-ui/file-browser';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatLevelMeter } from '@sima/neat-ui/level-meter';
import { NeatLine, NeatLineEnd, NeatLineList } from '@sima/neat-ui/line-list';
import { NeatProgress } from '@sima/neat-ui/progress';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';
import { NeatColumn, NeatSelectList, type NeatSelectListGroup } from '@sima/neat-ui/select-list';
import { NeatSlider } from '@sima/neat-ui/slider';
import {
  NeatStatusChip,
  NeatStatusChipButton,
  type NeatStatusChipVariant,
} from '@sima/neat-ui/status-chip';
import { NeatSwitch } from '@sima/neat-ui/switch';
import { NeatFigure, NeatNumeric, NeatTable } from '@sima/neat-ui/table';
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
import { TestPatternSource } from './test-pattern-source';

/** The surfaces a button sits on, as the contrast tests have it: the page and a card. */
const SURFACES = ['page', 'card'] as const;
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
const CHIP_VARIANTS: NeatStatusChipVariant[] = ['solid', 'tinted'];
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
/** How many types the capped list's demo compares at most. */
const TYPE_CAP = 2;
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

const INITIAL_REGIONS = ['Inclusion 1', 'Exclusion 1', 'Exclusion 2'];
const ROI_MODES: NeatSegmentedOption<NeatRoiDrawMode>[] = [
  { value: 'off', label: 'Off' },
  { value: 'inclusion', label: 'Inclusion' },
  { value: 'exclusion', label: 'Exclusion' },
];
/** The eased number's demo values, in turn: steps up and down, small and large. */
const FPS_VALUES = [24, 29.9, 12.4, 18.2];

@Component({
  selector: 'app-components-page',
  imports: [
    NeatButton,
    NeatCallout,
    NeatCollapsible,
    NeatDetails,
    NeatColumn,
    NeatFigure,
    NeatFileBrowser,
    NeatIcon,
    NeatInlineButton,
    NeatInput,
    NeatLevelMeter,
    NeatLine,
    NeatLineEnd,
    NeatLineList,
    NeatLiveDot,
    NeatStale,
    NeatEasedNumber,
    NeatNote,
    NeatNumeric,
    NeatPage,
    NeatProgress,
    NeatSegmented,
    NeatSelectList,
    NeatSlider,
    NeatStatusChip,
    NeatStatusChipButton,
    NeatSwitch,
    NeatTable,
    NeatTileGrid,
    NeatRoiEditor,
    NeatRoiSwatch,
    NeatVideoTile,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page">
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
          <h2>Live dot</h2>
          <p class="showcase-muted">
            <code>neat-live-dot</code>: a small red dot for something live or recording, hidden from
            assistive technology, so the words beside it say what it means. With
            <code>pulse</code> it beats and a ring grows out of it and fades; under a reduced-motion
            setting it is a still dot. Its red, <code>--neat-live</code>, reads on the page and on
            the video scrim, as in a badge over a picture.
          </p>
          <div class="showcase-row">
            <span class="showcase-row"><neat-live-dot /> Still</span>
            <span class="showcase-row"><neat-live-dot pulse /> Recording 0:34</span>
            <span class="showcase-row showcase-scrim-badge"><neat-live-dot pulse /> Live</span>
            <button neatButton type="button" variant="danger" size="small">
              <neat-icon name="stop" [size]="14" />
              Stop
            </button>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Stale</h2>
          <p class="showcase-muted">
            <code>[neatStale]</code> on any element: while true, what it shows is faded and grey, as
            a figure from before a connection dropped; once fresh it is shown as it is, with no
            transition. It is the look only, so the words beside it say why.
          </p>
          <div class="showcase-row">
            <span [neatStale]="stale()">12.4 fps · 3 objects</span>
            @if (stale()) {
              <span class="showcase-muted">Connection lost</span>
            }
            <button
              neatButton
              type="button"
              variant="outlined"
              size="small"
              [pressed]="stale()"
              (click)="stale.set(!stale())"
            >
              Stale
            </button>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Eased number</h2>
          <p class="showcase-muted">
            <code>neat-eased-number</code>: a figure that eases to each new value in 400 ms instead
            of jumping, in tabular digits so it keeps its width. Its first value shows at once, a
            dash stands in while there is none, and under a reduced-motion setting it follows at
            once. <code>neatEased</code> does the same for any number signal.
          </p>
          <div class="showcase-row">
            <span><neat-eased-number [value]="fps()" [digits]="1" /> fps</span>
            <button neatButton type="button" variant="outlined" size="small" (click)="nextFps()">
              Next value
            </button>
            <button neatButton type="button" variant="text" size="small" (click)="fps.set(null)">
              No value
            </button>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Stored signal</h2>
          <p class="showcase-muted">
            <code>neatStoredSignal(key, initial, parse)</code>: a signal kept in localStorage, for a
            setting an app remembers per browser. Press, then reload the page: the count stays. The
            app's <code>parse</code> judges what is read back, and storage that refuses keeps the
            value for the page load only.
          </p>
          <div class="showcase-row">
            <span>Pressed {{ presses() }} times</span>
            <button
              neatButton
              type="button"
              variant="outlined"
              size="small"
              (click)="presses.set(presses() + 1)"
            >
              Press
            </button>
            <button neatButton type="button" variant="text" size="small" (click)="presses.set(0)">
              Reset
            </button>
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
            state; the colour repeats it. <code>variant="tinted"</code> puts the tone's colour on a
            tint of itself, for chips that label the parts of a card, as a diagram block's do (the
            second pair of rows); neutral is the same grey in both.
          </p>
          @for (variant of chipVariants; track variant) {
            @for (surface of surfaces; track surface) {
              <div class="showcase-row" [class.card]="surface === 'card'">
                @for (tone of tones; track tone) {
                  <neat-status-chip [tone]="tone" [variant]="variant">{{
                    toneLabels[tone]
                  }}</neat-status-chip>
                }
                <button
                  neatStatusChip
                  type="button"
                  tone="warning"
                  [variant]="variant"
                  (click)="toasts.status('The late notice would open here.')"
                >
                  Metadata late
                </button>
              </div>
            }
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
            <code>dt</code> and <code>dd</code> elements, conditional ones too. Several lists line
            up on one term column when an ancestor sets
            <code>--neat-details-term-width</code> (below); a term wider than that column breaks
            inside the word.
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
          <div class="card details-demo details-demo-aligned">
            <dl neatDetails>
              <dt>Model</dt>
              <dd>IMX219</dd>
              <dt>Reconnect_attempts_since_boot</dt>
              <dd>3</dd>
            </dl>
            <dl neatDetails>
              <dt>Receiver</dt>
              <dd><code>imx219 1-0010</code></dd>
              <dt>Format</dt>
              <dd>NV12</dd>
            </dl>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Table</h2>
          <p class="showcase-muted">
            <code>neatTable</code> on a <code>table</code>: a data table, full width with a rule
            under every row, the column headings muted and small. The rows and cells are your own
            <code>tr</code>, <code>th</code> and <code>td</code> elements. <code>neatNumeric</code>
            on a column's heading and cells end-aligns its figures on one line with tabular digits;
            <code>neatFigure</code> gives a cell the same one line and digits but leaves it at the
            start, for a figure with something after it (the Max column's status below). Which
            columns a narrow container gives up is the page's; the kit does not know the container.
          </p>
          <div class="card table-demo">
            <table neatTable aria-label="Metrics of a run">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col" neatNumeric>Mean</th>
                  <th scope="col" neatFigure>Max</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Board power</th>
                  <td neatNumeric>7.9 W</td>
                  <td neatFigure>
                    <div class="table-demo-figure">
                      12.51 W <neat-status-chip tone="success">OK</neat-status-chip>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th scope="row">SoC temperature</th>
                  <td neatNumeric>61.2 °C</td>
                  <td neatFigure>
                    <div class="table-demo-figure">
                      84.0 °C <neat-status-chip tone="warning">Warm</neat-status-chip>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Memory used</th>
                  <td neatNumeric>2.1 GiB</td>
                  <td neatFigure>
                    <div class="table-demo-figure">
                      2.4 GiB <neat-status-chip tone="success">OK</neat-status-chip>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="showcase-section">
          <h2>Collapsible</h2>
          <p class="showcase-muted">
            <code>neat-collapsible</code>: a section that a full-width button opens and closes, for
            what is not needed every day. While closed, <code>summary</code> says what it holds. The
            content stays instantiated while closed, so gate an expensive one on <code>open</code>.
            Closing it from inside (Save below) puts the focus on its button. Controls marked
            <code>neatCollapsibleEnd</code> sit at the end of its button's row, outside the button
            (the log's Add line, and its Clear, shown only while open); where they would leave the
            label no room they drop to a line of their own.
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
            <neat-collapsible
              label="Log"
              [summary]="logLines().length + ' lines'"
              [(open)]="logOpen"
            >
              <button
                neatCollapsibleEnd
                neatButton
                type="button"
                variant="text"
                size="small"
                (click)="addLogLine()"
              >
                Add line
              </button>
              @if (logOpen()) {
                <button
                  neatCollapsibleEnd
                  neatButton
                  type="button"
                  variant="text"
                  size="small"
                  (click)="logLines.set([])"
                >
                  Clear
                </button>
              }
              @for (line of logLines(); track $index) {
                <p neatNote>{{ line }}</p>
              } @empty {
                <p neatNote>No lines.</p>
              }
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
            scale, green, then amber, then red, with the dark ones in the border colour.
            <code>sample</code> is a function the meter calls once per animation frame (here a sine
            wave); <code>null</code> stops it and leaves it dark. Render it only while there is a
            level to show: hidden, it still samples. It is hidden from assistive technology, so say
            the state in text beside it.
          </p>
          <div class="meter-demo">
            <neat-level-meter [sample]="meterRunning() ? sineLevel : null" />
            <button
              neatButton
              type="button"
              size="small"
              (click)="meterRunning.update((on) => !on)"
            >
              {{ meterRunning() ? 'Stop' : 'Start' }}
            </button>
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
            (the bar); Space checks or unchecks it, as a click on its box does, and so does a click
            on the selected row. Ctrl-click (Cmd on a Mac) checks or unchecks any row, Shift-click
            checks the rows from the last one clicked, and Ctrl+A checks them all. Drones has no
            files, so nothing to check. The header and the rows share one grid, so Files sizes to
            its widest heading or count (<code>width="max-content"</code>), and
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
          <h3>Capped</h3>
          <p class="showcase-muted">
            <code>checkBlocked</code> gives the reason a row cannot be ticked now, here a cap of
            two: once two are checked, the others' boxes are drawn disabled, and Space and a click
            on the box do nothing. The row still takes the keys, a click and Enter. A screen reader
            hears the row as disabled (it cannot be checked) with the reason as its description, and
            a pointer sees the reason in the box's tooltip; touch gets no tooltip, so the app says
            the cap in its own text, as the note under the list does.
          </p>
          <div class="showcase-row list-row">
            <div class="list-box list-box-checked">
              <neat-select-list
                label="Types to compare"
                checkable
                [items]="demoTypes"
                [trackBy]="typeId"
                [canCheck]="hasFiles"
                [checkBlocked]="atTypeCap"
                [(checked)]="comparedTypes"
              >
                <ng-template neatColumn="name" header="Type" let-type>{{ type.name }}</ng-template>
              </neat-select-list>
            </div>
          </div>
          <p class="showcase-muted">{{ typeCapNote }}</p>
          <p class="showcase-code showcase-muted" aria-live="polite">
            Compared: {{ comparedTypes().length ? comparedTypes().join(', ') : 'none' }}
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
            boxes are not tab stops) and Ctrl-click, Shift-click and Ctrl+A check without opening a
            folder, and extra columns, after which a folder's count follows its name. The
            <code>archive</code> folder has a thousand files.
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
  protected readonly surfaces = SURFACES;
  protected readonly tones = TONES;
  protected readonly toneLabels = TONE_LABELS;
  protected readonly chipVariants = CHIP_VARIANTS;
  protected readonly narrowList = signal(false);
  protected readonly detailsOpen = signal(false);
  protected readonly meterRunning = signal(true);
  protected readonly stale = signal(true);
  protected readonly fps = signal<number | null>(FPS_VALUES[0]);
  private fpsIndex = 0;
  protected readonly presses = neatStoredSignal('neat-ui-showcase:presses', 0, (stored) =>
    typeof stored === 'number' && Number.isInteger(stored) && stored >= 0 ? stored : undefined,
  );
  /** Swings from -50 to 0 dBFS and back about every four seconds, as the meter's demo signal. */
  protected readonly sineLevel = () => -25 + 25 * Math.sin(performance.now() / 600);
  protected readonly boardOpen = signal(false);
  protected readonly logOpen = signal(false);
  protected readonly logLines = signal(['Pipeline started', 'Frame 1 decoded', 'Frame 2 decoded']);
  protected readonly demoTypes = DEMO_TYPES;
  protected readonly demoDevices = DEMO_DEVICES;
  protected readonly deviceGroups = DEVICE_GROUPS;
  protected readonly device = signal<DemoDevice | null>(null);
  protected readonly deviceId = (device: DemoDevice) => device.id;
  protected readonly deviceKind = (device: DemoDevice) => device.kind;
  protected readonly typeId = (type: DemoType) => type.id;
  protected readonly hasFiles = (type: DemoType) => type.files > 0;
  protected readonly checkedTypes = signal<readonly string[]>(['cars']);
  protected readonly typeCapNote = `At most ${TYPE_CAP} types can be compared.`;
  protected readonly comparedTypes = signal<readonly string[]>(['cars', 'people']);
  /** The cap's reason for a row that is not checked while the cap is reached. */
  protected readonly atTypeCap = (type: DemoType): string | null =>
    this.comparedTypes().length >= TYPE_CAP && !this.comparedTypes().includes(type.id)
      ? this.typeCapNote
      : null;
  protected readonly demoStreams = DEMO_STREAMS;
  protected readonly streamId = (stream: DemoStream) => stream.id;
  protected readonly streamTone = (stream: DemoStream) => stream.tone;
  protected readonly stream = signal<DemoStream | null>(DEMO_STREAMS[3]);

  protected readonly bars = signal(true);
  protected readonly overlay = signal('boxes');
  protected readonly tab = signal('metadata');
  protected readonly regions = signal(INITIAL_REGIONS);
  protected readonly page = signal(3);
  protected readonly source = signal<string | null>(null);
  protected readonly progress = signal(40);
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
  protected readonly toasts = inject(NeatToasts);

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

  protected addLogLine(): void {
    this.logLines.update((lines) => [...lines, `Frame ${lines.length} decoded`]);
  }

  protected nextFps(): void {
    this.fpsIndex = (this.fpsIndex + 1) % FPS_VALUES.length;
    this.fps.set(FPS_VALUES[this.fpsIndex]);
  }

  protected deleteRegion(region: string): void {
    this.regions.update((regions) => regions.filter((name) => name !== region));
  }

  protected resetRegions(): void {
    this.regions.set(INITIAL_REGIONS);
  }

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.testPattern.start(document));
    inject(DestroyRef).onDestroy(() => this.testPattern.stop());
  }
}
