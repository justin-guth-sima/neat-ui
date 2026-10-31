import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { NeatButton, NeatNote, type NeatTone } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatSparkline } from '@sima/neat-ui/charts';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatDetails } from '@sima/neat-ui/details';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';
import { NeatNumeric, NeatTable } from '@sima/neat-ui/table';
import type { Tier } from '../measure/stats';
import {
  type Capacity,
  type CampaignAnalysis,
  type CapacitySummary,
  capacitySummaryText,
  capacityText,
  flatTrend,
  LADDER_NAMES,
  levelText,
  type LadderAnalysis,
  phaseRows,
  type StepCell,
} from './analysis';
import { copyText } from './clipboard';
import type { CampaignResult } from './result-file';
import {
  browserName,
  presentedLines,
  recorderLine,
  shortSha,
  soakText,
  summaryMarkdown,
} from './summary';
import { RULE, type VerdictKind } from './verdict';

const TIER_TONE: Record<Tier, NeatTone> = {
  smooth: 'success',
  usable: 'warning',
  failing: 'danger',
};
const VERDICT_TONE: Record<VerdictKind, NeatTone> = {
  slower: 'danger',
  'not-slower': 'success',
  inconclusive: 'neutral',
};
const VERDICT_LABEL: Record<VerdictKind, string> = {
  slower: 'Clearly slower',
  'not-slower': 'Not clearly slower',
  inconclusive: 'Inconclusive',
};

/** How long "Copied" stays on the button. */
const COPIED_MS = 2500;

/** What a screenshot of a run needs to be shown: where it was named, and by which run. */
interface Shot {
  readonly renderer: string;
  readonly name: string;
  readonly repeat: number;
}

/**
 * One loaded result file, as the results page shows it (design 4.3): the machine, its capacities
 * in the two tiers, the verdict of the fallback rule (the kit against vflow, 2 of 3 repeats), the
 * steps and their phases at the median of the repeats, the warnings and what the renderers do not
 * share, with a markdown summary to copy. The numbers come from `analyseCampaign`, once, in the
 * page; this only lays them out.
 */
@Component({
  selector: 'bench-campaign-view',
  imports: [
    NeatButton,
    NeatCallout,
    NeatCollapsible,
    NeatDetails,
    NeatNote,
    NeatNumeric,
    NeatSegmented,
    NeatSparkline,
    NeatStatusChip,
    NeatTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './campaign-view.css',
  template: `
    @let c = campaign();
    @let a = analysis();
    <article [attr.aria-labelledby]="headingId">
      <header>
        <h2 [id]="headingId">{{ c.machine.label }}</h2>
        @if (fileName()) {
          <span neatNote>{{ fileName() }}</span>
        }
        <div class="chips">
          <neat-status-chip [tone]="c.bench.build === 'production' ? 'neutral' : 'warning'">
            {{ c.bench.build }} build
          </neat-status-chip>
          @if (c.harness?.headless !== undefined) {
            <neat-status-chip [tone]="c.harness?.headless ? 'warning' : 'neutral'">
              {{ c.harness?.headless ? 'headless' : 'headed' }}
            </neat-status-chip>
          }
          <neat-status-chip>{{ repeats() }}</neat-status-chip>
          <neat-status-chip>{{
            c.config.input === 'cdp' ? 'CDP input' : 'in-page input'
          }}</neat-status-chip>
        </div>
        <div class="actions">
          <button neatButton variant="outlined" size="small" type="button" (click)="copy()">
            {{ copyLabel() }}
          </button>
          <button
            neatButton
            variant="text"
            size="small"
            type="button"
            data-remove
            (click)="remove.emit()"
          >
            Remove
          </button>
          <span class="sr-only" role="status">{{ copyAnnouncement() }}</span>
        </div>
      </header>

      @if (c.harness?.complete === false) {
        <neat-callout tone="danger" heading="Not a finished campaign">
          The file holds the runs done when the campaign stopped.
        </neat-callout>
      }
      @if (c.warnings.length > 0) {
        <neat-callout tone="warning" [heading]="warningHeading()">
          <ul>
            @for (warning of c.warnings; track $index) {
              <li>{{ warning }}</li>
            }
          </ul>
        </neat-callout>
      }

      <neat-collapsible label="Machine and run" [open]="true">
        <dl neatDetails>
          <dt>Browser</dt>
          <dd>{{ browser() }}</dd>
          <dt>CPU cores</dt>
          <dd>{{ c.machine.cores }}</dd>
          @if (c.machine.deviceMemory) {
            <dt>Memory</dt>
            <dd>{{ c.machine.deviceMemory }} GB (as the browser reports it)</dd>
          }
          @if (c.machine.webgl) {
            <dt>GPU</dt>
            <dd>{{ c.machine.webgl.renderer }}</dd>
          }
          <dt>Display</dt>
          <dd>
            {{ c.machine.viewport.w }}×{{ c.machine.viewport.h }} px at DPR {{ c.machine.dpr }},
            {{ c.machine.refreshHz }} Hz measured ({{ fmt(a.intervalMs, 2) }} ms)
          </dd>
          <dt>Build</dt>
          <dd>
            {{ c.bench.build }}, commit {{ commit() }}, kit {{ c.bench.kitVersion }}, ngx-vflow
            {{ c.bench.vflowVersion }}
          </dd>
          <dt>Run</dt>
          <dd>
            {{ c.config.repeats }} repeats, seed {{ c.config.seed }}, ladders
            {{ c.config.ladders.join(', ') }}, started {{ c.startedAt }}
          </dd>
        </dl>
      </neat-collapsible>

      <section aria-labelledby="{{ headingId }}-capacity">
        <h3 [id]="headingId + '-capacity'">Capacity</h3>
        <p neatNote>
          The largest load that held in every phase, with every smaller load holding too, as the
          median of the repeats (and their range where they differ). Smooth: p95 frame within 1.25
          refresh intervals and at most 5 % dropped. Usable: 30 fps or more and p99 within 100 ms.
        </p>
        <div class="scroll">
          <table neatTable aria-label="Capacity per renderer">
            <thead>
              <tr>
                <th scope="col">Ladder</th>
                <th scope="col">Renderer</th>
                <th scope="col">Smooth</th>
                <th scope="col">Usable</th>
                <th scope="col">Median fps by step</th>
              </tr>
            </thead>
            <tbody>
              @for (ladder of a.ladders; track ladder.ladder) {
                @for (renderer of ladder.renderers; track renderer.renderer) {
                  <tr>
                    <th scope="row">{{ ladderName(ladder.ladder) }}</th>
                    <td>{{ renderer.renderer }}</td>
                    <td>{{ summary(ladder, renderer.smooth) }}</td>
                    <td>{{ summary(ladder, renderer.usable) }}</td>
                    <td class="trend">
                      @if (renderer.trend.length === 0) {
                        <span class="range">no step ran</span>
                      } @else if (flat(renderer.trend)) {
                        <span class="range">{{ fmt(renderer.trend[0], 0) }} fps at every step</span>
                      } @else {
                        <neat-sparkline
                          [values]="renderer.trend"
                          [label]="renderer.renderer + ' on ladder ' + ladder.ladder"
                        />
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </section>

      @if (judged().length > 0) {
        <section aria-labelledby="{{ headingId }}-verdict">
          <h3 [id]="headingId + '-verdict'">Fallback verdict: the kit against vflow</h3>
          <p neatNote>
            The kit is clearly slower where its smooth capacity is at least one doubling step below
            vflow's in {{ rule.needed }} of {{ rule.of }} repeats. The fps comparison is supporting
            evidence only; how the kit pans is for hands on the board.
          </p>
          @for (ladder of judged(); track ladder.ladder) {
            @let verdict = ladder.verdict!;
            <div class="verdict" data-slot="verdict">
              <div class="verdict-head">
                <h4>{{ ladderName(ladder.ladder) }}</h4>
                <neat-status-chip [tone]="verdictTone[verdict.kind]">
                  {{ verdictLabel[verdict.kind] }}
                </neat-status-chip>
                <span>
                  {{ verdict.slowerCount }} of {{ verdict.pairs.length }} repeats a doubling step or
                  more below vflow
                  @if (verdict.kind === 'inconclusive') {
                    (the rule asks for {{ rule.needed }} of {{ rule.of }})
                  }
                </span>
              </div>
              @if (verdict.kind === 'inconclusive' && c.harness?.complete === true) {
                <p neatNote>
                  The campaign is finished with {{ verdict.pairs.length }} of the rule's
                  {{ rule.of }} repeats, so no more will come: run it with
                  <code>--repeats {{ rule.of }}</code> for a verdict.
                </p>
              }
              <div class="scroll">
                <table neatTable [attr.aria-label]="'Repeats of ladder ' + ladder.ladder">
                  <thead>
                    <tr>
                      <th scope="col" neatNumeric>Repeat</th>
                      <th scope="col">Kit, smooth capacity</th>
                      <th scope="col">vflow, smooth capacity</th>
                      <th scope="col">A step or more below</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (pair of verdict.pairs; track pair.repeat) {
                      <tr>
                        <td neatNumeric>{{ pair.repeat + 1 }}</td>
                        <td>{{ capacity(ladder, pair.kit) }}</td>
                        <td>{{ capacity(ladder, pair.vflow) }}</td>
                        <td>
                          {{ pair.slower ? 'yes' : 'no' }}
                          @if (pair.failed) {
                            <neat-status-chip tone="warning" variant="tinted"
                              >run failed</neat-status-chip
                            >
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <p neatNote>
                On the usable tier: {{ verdictLabel[ladder.usableVerdict!.kind].toLowerCase() }} ({{
                  ladder.usableVerdict!.slowerCount
                }}
                of {{ ladder.usableVerdict!.pairs.length }}).
                @let evidence = ladder.evidence!;
                @if (evidence.consecutive) {
                  Supporting: the kit's median fps was under 85 % of vflow's at consecutive steps
                  ({{ belowLevels(ladder) }}).
                } @else {
                  Supporting: the kit's median fps was not under 85 % of vflow's at two consecutive
                  steps ({{ evidence.compared }} steps compared).
                }
              </p>
              @let shotsOfLadder = shots(ladder.ladder);
              @if (shotsOfLadder.length > 0) {
                <div class="shots">
                  @for (shot of shotsOfLadder; track shot.renderer) {
                    <figure>
                      @if (images().get(shot.name); as src) {
                        <img
                          [src]="src"
                          [alt]="
                            'The ' +
                            shot.renderer +
                            ' renderer after the last step of ladder ' +
                            ladder.ladder
                          "
                        />
                      } @else {
                        <p neatNote>{{ shot.name }} was not dropped with the result.</p>
                      }
                      <figcaption neatNote>
                        {{ shot.renderer }}: the last step of ladder {{ ladder.ladder }}, repeat
                        {{ shot.repeat + 1 }}
                      </figcaption>
                    </figure>
                  }
                </div>
              }
            </div>
          }
        </section>
      }

      @if (ladder(); as current) {
        <section aria-labelledby="{{ headingId }}-steps">
          <h3 [id]="headingId + '-steps'">Steps</h3>
          @if (a.ladders.length > 1) {
            <neat-segmented label="Ladder" [options]="ladderOptions()" [(value)]="chosenLadder" />
          }
          <p neatNote>
            Median of the repeats per step; each fps is the mean over the step's phases, the other
            figures are the worst phase's (the busy share, the busiest). Ranges and spreads over 10
            % are flagged. A phase counts at the lower of the recorder's rate and the display's
            presented rate where a traced run gave one (the phases table has both); “presented”
            marks a step whose tier that rate decided.
          </p>
          <div class="scroll">
            <table neatTable [attr.aria-label]="'Steps of ladder ' + current.ladder">
              <thead>
                <tr>
                  <th scope="col" rowspan="2">Load</th>
                  @for (renderer of current.renderers; track renderer.renderer) {
                    <th scope="colgroup" colspan="5" class="group">{{ renderer.renderer }}</th>
                  }
                </tr>
                <tr>
                  @for (renderer of current.renderers; track renderer.renderer) {
                    <th scope="col" neatNumeric class="group-start">fps</th>
                    <th scope="col" neatNumeric>p95 ms</th>
                    <th scope="col" neatNumeric>dropped %</th>
                    <th scope="col" neatNumeric>busy %</th>
                    <th scope="col" neatNumeric>build ms</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of stepRows(); track row.level) {
                  <tr>
                    <th scope="row" class="load">{{ row.load }}</th>
                    @for (cell of row.cells; track $index) {
                      @if (cell) {
                        <td neatNumeric class="group-start">
                          <neat-status-chip [tone]="tierTone[cell.tier]">{{
                            cell.aborted ? 'aborted' : cell.tier
                          }}</neat-status-chip>
                          @if (cell.presentedDecided) {
                            <neat-status-chip variant="tinted">presented</neat-status-chip>
                          }
                          {{ fmt(cell.fps.median, 1, 1) }}
                          @if (cell.repeats > 1) {
                            <span class="range"
                              >({{ fmt(cell.fps.min) }}–{{ fmt(cell.fps.max) }})</span
                            >
                          }
                          @if (cell.spreadFlag) {
                            <neat-status-chip tone="warning" variant="tinted">
                              spread {{ fmt(cell.fps.spreadPct, 0) }} %
                            </neat-status-chip>
                          }
                        </td>
                        <td neatNumeric>{{ fmt(cell.p95Ms, 1, 1) }}</td>
                        <td neatNumeric>{{ fmt(cell.droppedPct) }}</td>
                        <td neatNumeric>{{ percent(cell.busyShare) }}</td>
                        <td neatNumeric>{{ fmt(cell.buildMs, 0) }}</td>
                      } @else {
                        <td class="group-start" colspan="5">not run</td>
                      }
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (current.soak; as soak) {
            <p neatNote>Soak, {{ current.renderers[0].renderer }}: {{ soakSentence(soak) }}</p>
          }

          <neat-collapsible label="Phases" summary="each phase of each step, median of the repeats">
            @if (current.renderers.length > 1) {
              <neat-segmented
                label="Renderer"
                [options]="rendererOptions()"
                [(value)]="chosenRenderer"
              />
            }
            <div class="scroll">
              <table
                neatTable
                [attr.aria-label]="'Phases of ladder ' + current.ladder + ' on ' + chosenRenderer()"
              >
                <thead>
                  <tr>
                    <th scope="col">Load</th>
                    <th scope="col">Phase</th>
                    <th scope="col">Tier</th>
                    <th scope="col" neatNumeric>recorder fps</th>
                    <th scope="col" neatNumeric>presented fps</th>
                    <th scope="col" neatNumeric>p50 ms</th>
                    <th scope="col" neatNumeric>p95 ms</th>
                    <th scope="col" neatNumeric>p99 ms</th>
                    <th scope="col" neatNumeric>dropped %</th>
                    <th scope="col" neatNumeric>janks</th>
                    <th scope="col" neatNumeric>stalls</th>
                    <th scope="col" neatNumeric>busy %</th>
                    <th scope="col" neatNumeric>long frames</th>
                    <th scope="col" neatNumeric>heap MB</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of phaseTable(); track $index) {
                    <tr>
                      <th scope="row" class="load">{{ row.load }}</th>
                      <td>{{ row.phase }}</td>
                      <td>
                        <neat-status-chip [tone]="tierTone[row.tier]">{{
                          row.tier
                        }}</neat-status-chip>
                        @if (row.presentedDecided) {
                          <neat-status-chip variant="tinted">presented</neat-status-chip>
                        }
                        @if (row.spreadFlag) {
                          <neat-status-chip tone="warning" variant="tinted"
                            >spread</neat-status-chip
                          >
                        }
                      </td>
                      <td neatNumeric>{{ fmt(row.fps, 1, 1) }}</td>
                      <td neatNumeric>{{ fmt(row.presentedFps, 1, 1) }}</td>
                      <td neatNumeric>{{ fmt(row.p50, 1, 1) }}</td>
                      <td neatNumeric>{{ fmt(row.p95, 1, 1) }}</td>
                      <td neatNumeric>{{ fmt(row.p99, 1, 1) }}</td>
                      <td neatNumeric>{{ fmt(row.droppedPct) }}</td>
                      <td neatNumeric>{{ row.janks }}</td>
                      <td neatNumeric>{{ row.stalls }}</td>
                      <td neatNumeric>{{ percent(row.busyShare) }}</td>
                      <td neatNumeric>{{ fmt(row.loafCount, 0) }}</td>
                      <td neatNumeric>{{ megabytes(row.heapBytes) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </neat-collapsible>
        </section>
      }

      @if (c.notComparable.length > 0) {
        <section aria-labelledby="{{ headingId }}-notcomparable">
          <h3 [id]="headingId + '-notcomparable'">Not comparable</h3>
          <p neatNote>What the two renderers do not share, and which way it leans.</p>
          <ul>
            @for (note of c.notComparable; track $index) {
              <li>{{ note }}</li>
            }
          </ul>
        </section>
      }

      @if (c.measurement; as m) {
        <neat-collapsible label="How the numbers were taken">
          <ul>
            <li>{{ m.build }}</li>
            <li>{{ m.loaf.limits }}</li>
            @for (line of presented(); track $index) {
              <li>{{ line }}</li>
            }
            @for (note of recorderNotes(); track $index) {
              <li>{{ note }}</li>
            }
            @if (traces().length > 0) {
              <li>Traces, beside the result file: {{ traces().join(', ') }}.</li>
            }
          </ul>
        </neat-collapsible>
      }
    </article>
  `,
})
export class CampaignView {
  readonly campaign = input.required<CampaignResult>();
  readonly analysis = input.required<CampaignAnalysis>();
  /** The file it was read from, which tells two results of one machine apart. */
  readonly fileName = input('');
  /** Screenshots dropped with the result, by file name, as object URLs. */
  readonly images = input<ReadonlyMap<string, string>>(new Map());
  readonly remove = output();

  private static nextId = 0;
  protected readonly headingId = `bench-campaign-${CampaignView.nextId++}`;
  protected readonly flat = flatTrend;
  protected readonly rule = RULE;
  protected readonly tierTone = TIER_TONE;
  protected readonly verdictTone = VERDICT_TONE;
  protected readonly verdictLabel = VERDICT_LABEL;

  private readonly document = inject(DOCUMENT);
  private readonly copyState = signal<'idle' | 'copied' | 'failed'>('idle');
  private copyTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly copyLabel = computed(
    () =>
      ({ idle: 'Copy as markdown', copied: 'Copied', failed: 'Could not copy' })[this.copyState()],
  );
  protected readonly copyAnnouncement = computed(() =>
    this.copyState() === 'copied' ? 'The summary is on the clipboard.' : '',
  );

  /** The ladder the steps are shown for: the first, until the segmented control chooses. */
  protected readonly chosenLadder = linkedSignal<readonly LadderAnalysis[], string>({
    source: () => this.analysis().ladders,
    computation: (ladders, previous) =>
      ladders.some((l) => l.ladder === previous?.value)
        ? (previous?.value as string)
        : (ladders[0]?.ladder ?? ''),
  });
  protected readonly ladder = computed(
    () => this.analysis().ladders.find((l) => l.ladder === this.chosenLadder()) ?? null,
  );
  protected readonly chosenRenderer = linkedSignal<LadderAnalysis | null, string>({
    source: this.ladder,
    computation: (ladder, previous) =>
      ladder?.renderers.some((r) => r.renderer === previous?.value)
        ? (previous?.value as string)
        : (ladder?.renderers[0]?.renderer ?? ''),
  });

  protected readonly ladderOptions = computed<NeatSegmentedOption<string>[]>(() =>
    this.analysis().ladders.map((l) => ({ value: l.ladder, label: this.ladderName(l.ladder) })),
  );
  protected readonly rendererOptions = computed<NeatSegmentedOption<string>[]>(() =>
    (this.ladder()?.renderers ?? []).map((r) => ({ value: r.renderer, label: r.renderer })),
  );

  /** The ladders the kit and vflow both ran: where the rule has something to judge. */
  protected readonly judged = computed(() =>
    this.analysis().ladders.filter((l) => l.verdict !== null),
  );

  protected readonly browser = computed(() => browserName(this.campaign()));
  protected readonly commit = computed(() => shortSha(this.campaign().bench.gitSha));

  protected readonly repeats = computed(() => {
    const n = this.campaign().config.repeats;
    return n === 1 ? '1 repeat' : `${n} repeats`;
  });

  protected readonly warningHeading = computed(() => {
    const n = this.campaign().warnings.length;
    return n === 1 ? '1 warning' : `${n} warnings`;
  });

  /** The chosen ladder's levels, each with a cell per renderer (null where it did not run it). */
  protected readonly stepRows = computed(() => {
    const ladder = this.ladder();
    if (!ladder) return [];
    const levels = [...new Set(ladder.renderers.flatMap((r) => r.cells.map((c) => c.level)))].sort(
      (a, b) => a - b,
    );
    return levels.map((level) => ({
      level,
      load: this.load(ladder, level),
      cells: ladder.renderers.map<StepCell | null>(
        (r) => r.cells.find((c) => c.level === level) ?? null,
      ),
    }));
  });

  protected readonly phaseTable = computed(() => {
    const ladder = this.ladder();
    const renderer = ladder?.renderers.find((r) => r.renderer === this.chosenRenderer());
    if (!ladder || !renderer) return [];
    return phaseRows(renderer.climbs, this.analysis().intervalMs).map((row) => ({
      ...row,
      load: this.load(ladder, row.level),
    }));
  });

  protected readonly traces = computed(() =>
    (this.campaign().runs ?? []).flatMap((run) => (run.trace ? [run.trace] : [])),
  );

  protected readonly presented = computed(() => presentedLines(this.campaign(), this.analysis()));

  protected readonly recorderNotes = computed(() =>
    (this.campaign().runs ?? []).flatMap((run) =>
      run.recorderCheck
        ? [recorderLine(run.recorderCheck, `${run.renderer} ${run.ladder} r${run.repeat}`)]
        : [],
    ),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.copyTimer));
  }

  protected ladderName(ladder: string): string {
    return `${ladder}: ${LADDER_NAMES[ladder] ?? 'ladder'}`;
  }

  protected summary(ladder: LadderAnalysis, summary: CapacitySummary | null): string {
    return capacitySummaryText(summary, ladder.ladder, ladder.paramsAt);
  }

  protected capacity(ladder: LadderAnalysis, capacity: Capacity): string {
    return capacityText(capacity, ladder.ladder, ladder.paramsAt);
  }

  protected belowLevels(ladder: LadderAnalysis): string {
    return (ladder.evidence?.below ?? []).map((b) => levelText(ladder.ladder, b.level)).join(', ');
  }

  /** A figure for a cell: `digits` decimals at most (`least` at least), a dash for none. */
  protected fmt(value: number | null, digits = 1, least = 0): string {
    return value === null
      ? '–'
      : value.toLocaleString('en', { minimumFractionDigits: least, maximumFractionDigits: digits });
  }

  /** A heap size in bytes as megabytes, a dash where it was not read. */
  protected megabytes(bytes: number | null): string {
    return this.fmt(bytes === null ? null : bytes / 1e6, 1, 1);
  }

  protected readonly soakSentence = soakText;

  /** A share from 0 to 1 as whole percent. */
  protected percent(share: number | null): string {
    return share === null ? '–' : this.fmt(share * 100, 0);
  }

  /** A level with what it put on the page: from the ladder's own parameters. */
  private load(ladder: LadderAnalysis, level: number): string {
    return capacityText({ level, atCap: false }, ladder.ladder, ladder.paramsAt);
  }

  /**
   * The screenshot each renderer's first run of `ladder` left, where the result names one: the
   * page after the run's last step, for the "looks bad" check beside the numbers.
   */
  protected shots(ladder: string): Shot[] {
    const seen = new Set<string>();
    const shots: Shot[] = [];
    for (const run of this.campaign().runs ?? []) {
      if (run.ladder !== ladder || run.purpose === 'trace' || !run.screenshot) continue;
      if (run.renderer !== 'kit' && run.renderer !== 'vflow') continue;
      if (seen.has(run.renderer)) continue;
      seen.add(run.renderer);
      shots.push({ renderer: run.renderer, name: run.screenshot, repeat: run.repeat });
    }
    return shots;
  }

  protected async copy(): Promise<void> {
    const ok = await copyText(this.document, summaryMarkdown(this.campaign(), this.analysis()));
    this.copyState.set(ok ? 'copied' : 'failed');
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copyState.set('idle'), COPIED_MS);
  }
}
