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
import { RouterLink } from '@angular/router';
import {
  NeatButton,
  type NeatButtonSize,
  type NeatButtonVariant,
  NeatConfirm,
  NeatIcon,
  NeatInlineButton,
  NeatInput,
  NeatLine,
  NeatLineEnd,
  NeatLineList,
  NeatNumberField,
  NeatPage,
  NeatPopover,
  NeatPopoverContent,
  NeatPopoverTrigger,
  NeatSegmented,
  type NeatSegmentedOption,
  NeatSlider,
  NeatSwitch,
  NeatTab,
  NeatTabs,
  NeatTooltip,
  type NeatTooltipPosition,
} from '@sima/neat-ui';
import {
  NeatRoiEditor,
  type NeatRoiDrawMode,
  type NeatRoiPolygon,
  NeatTileGrid,
  type NeatTileLayout,
  type NeatTileState,
  NeatVideoTile,
} from '@sima/neat-ui/video';
import { TestPatternSource } from './test-pattern-source';

const VARIANTS: NeatButtonVariant[] = ['primary', 'secondary', 'outlined', 'text', 'danger'];
/** The surfaces a button sits on, as the contrast tests have it: the page and a card. */
const SURFACES = ['page', 'card'] as const;
const SIZES: NeatButtonSize[] = ['small', 'medium', 'large', 'touch'];
const ICON_SIZES = [16, 20, 24] as const;
const TOOLTIP_POSITIONS: NeatTooltipPosition[] = ['top', 'right', 'bottom', 'left'];
const TILE_COUNT = 48;
const PLACEHOLDER_TILES = Array.from({ length: TILE_COUNT }, (_, index) => index + 1);
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
    NeatIcon,
    NeatInlineButton,
    NeatInput,
    NeatLine,
    NeatLineEnd,
    NeatLineList,
    NeatNumberField,
    NeatPage,
    NeatPopover,
    NeatPopoverContent,
    NeatPopoverTrigger,
    NeatSegmented,
    NeatSlider,
    NeatSwitch,
    NeatTab,
    NeatTabs,
    NeatTileGrid,
    NeatTooltip,
    NeatRoiEditor,
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
            With a <code>neat-icon</code> before the label, disabled, and as a link, per variant.
          </p>
          @for (variant of variants; track variant) {
            <div class="showcase-row">
              <button neatButton type="button" [variant]="variant">
                <neat-icon name="streaming" [size]="16" />
                With icon
              </button>
              <button neatButton type="button" [variant]="variant" disabled>Disabled</button>
              <!-- Links back to this page, so trying it navigates nowhere. -->
              <a neatButton [variant]="variant" routerLink="/components">Link</a>
            </div>
          }
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
            <p class="inline-note">
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
            page field accepts 1 to {{ pageCount }}.
          </p>
          <div class="showcase-row">
            <neat-number-field
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
          </div>
          <p class="showcase-code showcase-muted">
            Page {{ page() }}, commits so far {{ pageCommits() }}; channel {{ drawChannel() }}
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
            takes each closed polygon from <code>regionsChange</code>. The tile plays the same test
            pattern as the one above, so pausing that source also stops this one, and the editor,
            which needs the image, goes with it.
          </p>
          <div class="showcase-row">
            <neat-segmented label="Drawing mode" [options]="roiModes" [(value)]="roiMode" />
            <button neatButton type="button" variant="outlined" (click)="roiRegions.set([])">
              Clear regions
            </button>
          </div>
          <p class="showcase-code showcase-muted" aria-live="polite">{{ roiSummary() }}</p>
          <div class="video-demo">
            <div class="video-demo-cell">
              <neat-video-tile [source]="testPattern" [bars]="false">
                <neat-roi-editor
                  neatTileOverlay
                  [regions]="roiRegions()"
                  [mode]="roiMode()"
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
  protected readonly confirmAnswer = signal('Not asked yet');
  private readonly confirm = inject(NeatConfirm);

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
  protected readonly roiSummary = computed(() => {
    const regions = this.roiRegions();
    const count = (type: NeatRoiPolygon['type']) =>
      regions.filter((region) => region.type === type).length;
    return `Regions: ${regions.length} (${count('inclusion')} inclusion, ${count('exclusion')} exclusion)`;
  });

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
