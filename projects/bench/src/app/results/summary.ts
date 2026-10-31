import {
  type CampaignAnalysis,
  capacitySummaryText,
  LADDER_NAMES,
  type LadderAnalysis,
} from './analysis';
import type { CampaignResult, RecorderCheck } from './result-file';
import { RULE, type FallbackVerdict } from './verdict';

/*
 * A campaign's summary as markdown, for the page the team reads (design open question 8: the
 * result files stay on the machine, their summary is published). The same numbers the view shows,
 * from the same analysis. Pure.
 */

/** A table cell: a pipe or a line break would end it. */
const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

const row = (...cells: string[]): string => `| ${cells.map(cell).join(' | ')} |`;

const ladderName = (ladder: string): string => `${ladder}: ${LADDER_NAMES[ladder] ?? 'ladder'}`;

/** A commit as the bench stamps it: seven characters, and the `-dirty` mark kept. */
export function shortSha(sha: string): string {
  const match = /^([0-9a-f]{40})(-dirty)?$/.exec(sha);
  return match ? `${sha.slice(0, 7)}${match[2] ?? ''}` : sha;
}

export function browserName(campaign: CampaignResult): string {
  const version = campaign.harness?.browserVersion;
  if (version) return `Chromium ${version}`;
  const major = /Chrome\/(\d+)/.exec(campaign.machine.ua)?.[1];
  return major ? `Chromium ${major}` : campaign.machine.ua;
}

function setup(campaign: CampaignResult, analysis: CampaignAnalysis): string[] {
  const { machine, bench, config, harness } = campaign;
  const memory = machine.deviceMemory ? `, ${machine.deviceMemory} GB` : '';
  const gpu = machine.webgl ? `, ${machine.webgl.renderer}` : '';
  const viewport = harness?.viewport === 'native' ? 'the window’s own size' : machine.viewport;
  const size =
    typeof viewport === 'string' ? viewport : `${viewport.w}×${viewport.h} at DPR ${machine.dpr}`;
  const mode = harness?.headless === undefined ? '' : harness.headless ? ', headless' : ', headed';
  const lines = [
    `- Machine: ${browserName(campaign)}, ${machine.cores} cores${memory}${gpu}`,
    `- Display: ${size}, ${machine.refreshHz} Hz measured${mode}`,
    `- Build: ${bench.build} build, commit ${shortSha(bench.gitSha)}, kit ${bench.kitVersion}, ` +
      `ngx-vflow ${bench.vflowVersion}`,
    `- Run: ${config.repeats} repeats, ${
      config.input === 'cdp'
        ? 'gestures through the ' + 'browser’s input (CDP)'
        : 'in-page gestures'
    }, seed ${config.seed}, ladders ` + `${config.ladders.join(', ')}`,
  ];
  if (analysis.failedRuns > 0) lines.push(`- ${analysis.failedRuns} page loads did not finish`);
  return lines;
}

function capacityTable(analysis: CampaignAnalysis): string[] {
  const lines = [row('Ladder', 'Renderer', 'Smooth', 'Usable'), row('---', '---', '---', '---')];
  for (const ladder of analysis.ladders) {
    for (const renderer of ladder.renderers) {
      lines.push(
        row(
          ladderName(ladder.ladder),
          renderer.renderer,
          capacitySummaryText(renderer.smooth, ladder.ladder, ladder.paramsAt),
          capacitySummaryText(renderer.usable, ladder.ladder, ladder.paramsAt),
        ),
      );
    }
  }
  return lines;
}

function verdictLabel(verdict: FallbackVerdict, long: boolean): string {
  switch (verdict.kind) {
    case 'slower':
      return 'Clearly slower';
    case 'not-slower':
      return 'Not clearly slower';
    case 'inconclusive':
      return long
        ? `Inconclusive (${verdict.pairs.length} of ${RULE.of} repeats run)`
        : 'Inconclusive';
  }
}

function verdictTable(ladders: readonly LadderAnalysis[]): string[] {
  const lines = [
    row('Ladder', 'Verdict', 'Repeats slower', 'Usable tier', 'Kit under 85 % of vflow’s fps'),
    row('---', '---', '---', '---', '---'),
  ];
  for (const ladder of ladders) {
    const { verdict, usableVerdict, evidence } = ladder;
    if (!verdict || !usableVerdict || !evidence) continue;
    lines.push(
      row(
        ladderName(ladder.ladder),
        verdictLabel(verdict, true),
        `${verdict.slowerCount} of ${verdict.pairs.length}`,
        verdictLabel(usableVerdict, false),
        evidence.consecutive
          ? `in consecutive steps (${evidence.below.map((b) => b.level).join(', ')})`
          : evidence.below.length > 0
            ? `at ${evidence.below.length} step, not consecutive`
            : 'no',
      ),
    );
  }
  return lines;
}

/** What the recorder check of a traced run found, in a line. */
export function recorderLine(check: RecorderCheck, label: string): string {
  if (check.skipped) return `Recorder against trace, ${label}: not checked (${check.skipped}).`;
  if (check.ok === null) return `Recorder against trace, ${label}: nothing to compare.`;
  return (
    `Recorder against trace, ${label}: ${check.ok ? 'within' : 'outside'} ` +
    `${check.tolerance * 100} % over ${check.compared} phases ` +
    `(worst ${check.worstPct.toFixed(1)} %).`
  );
}

/** The summary of `campaign`, with `analysis` its `analyseCampaign`. */
export function summaryMarkdown(campaign: CampaignResult, analysis: CampaignAnalysis): string {
  const out: string[] = [
    `# Rendering bench: ${campaign.machine.label}, ${campaign.startedAt.slice(0, 10)}`,
    '',
  ];
  if (campaign.harness?.complete === false) {
    out.push(
      '> This campaign did not finish: the numbers are of the runs done when it stopped.',
      '',
    );
  }
  out.push(...setup(campaign, analysis), '');

  out.push(
    '## Capacity',
    '',
    'The largest load that held in every phase of every smaller step too, as the median of the ' +
      'repeats (with the range where they differ). Smooth: p95 frame within 1.25 refresh ' +
      'intervals and at most 5 % dropped. Usable: 30 fps or more and p99 within 100 ms.',
    '',
    ...capacityTable(analysis),
    '',
  );

  const verdicts = verdictTable(analysis.ladders);
  out.push(
    '## Fallback verdict: the kit against vflow',
    '',
    `The kit is clearly slower where its smooth capacity is at least one doubling step below ` +
      `vflow’s in ${RULE.needed} of ${RULE.of} repeats. The last column is supporting evidence ` +
      'only.',
    '',
  );
  out.push(
    ...(verdicts.length > 2
      ? verdicts
      : ['Needs the kit and vflow on the same ladder; this file has none.']),
    '',
  );

  if (campaign.warnings.length > 0) {
    out.push('## Warnings', '', ...campaign.warnings.map((w) => `- ${w}`), '');
  }
  if (campaign.notComparable.length > 0) {
    out.push('## Not comparable', '', ...campaign.notComparable.map((n) => `- ${n}`), '');
  }

  out.push('## How the numbers were taken', '');
  if (campaign.measurement) {
    out.push(`- ${campaign.measurement.build}`, `- ${campaign.measurement.loaf.limits}`);
  }
  for (const run of campaign.runs ?? []) {
    const check = run.recorderCheck;
    if (!check) continue;
    out.push(`- ${recorderLine(check, `${run.renderer} ${run.ladder} r${run.repeat}`)}`);
  }
  return `${out.join('\n').trimEnd()}\n`;
}
