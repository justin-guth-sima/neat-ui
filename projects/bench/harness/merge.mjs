// One result file for a campaign (design 4.2): the page's runs (one per renderer, ladder and
// repeat, each its own page load), the harness's additions and what the harness saw of its own.
// Nothing is dropped: a run that failed keeps the steps it finished (the page told the harness of
// each as it ended), flagged `failedRun`, with its error in `runs`; a warning from several runs is
// said once with the runs it came from. Pure.
import { join } from 'node:path';

/** Design 2.3: the harness flags a step whose start transforms differ by more than this. */
const SCALE_TOLERANCE = 0.01;
const SHIFT_TOLERANCE_PX = 2;

const label = ({ ladder, renderer, repeat }) => `${renderer} ${ladder} r${repeat}`;

/**
 * Warnings for each pair of the kit's and vflow's steps (same ladder, level and repeat) whose
 * start transforms differ by more than 1 % in scale or 2 px: the two would not be drawing the same
 * part of the diagram, and their frames would not compare.
 */
export function compareStartTransforms(steps) {
  const warnings = [];
  const kit = new Map();
  for (const s of steps) {
    if (s.renderer === 'kit' && s.startTransform) {
      kit.set(`${s.ladder}/${s.level}/${s.repeat}`, s);
    }
  }
  for (const v of steps) {
    if (v.renderer !== 'vflow' || !v.startTransform) continue;
    const k = kit.get(`${v.ladder}/${v.level}/${v.repeat}`);
    if (!k) continue;
    const a = k.startTransform;
    const b = v.startTransform;
    const problems = [];
    if (Math.abs(a.k - b.k) > SCALE_TOLERANCE * a.k) {
      problems.push(`scale ${a.k} against ${b.k}`);
    }
    const shift = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    if (shift > SHIFT_TOLERANCE_PX) problems.push(`${Math.round(shift * 10) / 10} px apart`);
    if (problems.length > 0) {
      warnings.push(
        `ladder ${v.ladder} level ${v.level} repeat ${v.repeat}: the kit and vflow started at ` +
          `different transforms (${problems.join(', ')}), so their frames do not draw the same view.`,
      );
    }
  }
  return warnings;
}

/** A warning's runs as written: a few by name, then a count. */
function runsText(labels) {
  return labels.length <= 4
    ? labels.join(', ')
    : `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`;
}

export function mergeRuns({
  runId,
  startedAt,
  bench,
  options,
  machineExtra,
  fairness,
  skipped,
  warnings: harnessWarnings,
  pageRuns,
  extra = {},
}) {
  // A traced run is listed but never measured: tracing costs a lot (design 1.4).
  const measured = pageRuns.filter((run) => run.purpose !== 'trace');
  const okRuns = measured.filter((run) => run.ok);
  const first = okRuns[0]?.result;

  const steps = measured.flatMap((run) =>
    run.ok ? run.steps : run.steps.map((s) => ({ ...s, failedRun: true })),
  );

  const runs = pageRuns.map((run) => {
    const entry = { ...run.schedule };
    if (run.ok) {
      const { result } = run;
      Object.assign(entry, {
        status: 'ok',
        pageRunId: result.runId,
        end: result.end,
        refineSkipped: result.refineSkipped,
        steps: run.steps.length,
        loaf: { source: result.measurement.loaf.source, lost: result.measurement.loaf.lost },
      });
    } else {
      Object.assign(entry, { status: 'failed', error: run.error, steps: run.steps.length });
    }
    for (const key of ['purpose', 'thermal', 'screenshot', 'trace', 'input', 'wallMs']) {
      if (run[key] !== undefined) entry[key] = run[key];
    }
    return entry;
  });

  const warnings = [...harnessWarnings];
  if (fairness && !fairness.ok) {
    warnings.push(
      'The fairness check between the kit and vflow failed (the campaign went on because ' +
        `--allow-unfair was given): ${fairness.problems.join('; ')}`,
    );
  }
  for (const run of pageRuns) {
    if (!run.ok) warnings.push(`${label(run.schedule)} failed: ${run.error}`);
    if (run.throttleWarning) warnings.push(run.throttleWarning);
    for (const note of run.notes ?? []) warnings.push(`${label(run.schedule)}: ${note}`);
  }
  const byText = new Map();
  for (const run of okRuns) {
    for (const text of run.result.warnings) {
      byText.set(text, [...(byText.get(text) ?? []), label(run.schedule)]);
    }
  }
  for (const [text, labels] of byText) warnings.push(`[${runsText(labels)}] ${text}`);
  const rates = new Map();
  for (const run of okRuns) {
    const hz = run.result.machine.refreshHz;
    rates.set(hz, [...(rates.get(hz) ?? []), label(run.schedule)]);
  }
  if (rates.size > 1) {
    warnings.push(
      'The refresh rates differ between runs: ' +
        [...rates].map(([hz, labels]) => `${hz} Hz (${runsText(labels)})`).join(', ') +
        '. Frame statistics are judged at each run’s own rate, but compare them with care.',
    );
  }
  warnings.push(...compareStartTransforms(steps));

  const dev = okRuns.some((run) => run.result.bench.build === 'development');
  return {
    schema: 1,
    runId,
    startedAt,
    bench: { ...bench, build: dev ? 'development' : 'production' },
    machine: { ...(first?.machine ?? {}), label: options.machine, ...machineExtra },
    config: {
      seed: options.seed,
      ladders: options.ladders,
      renderers: options.renderers,
      repeats: options.repeats,
      warmupMs: first?.config.warmupMs ?? null,
      phases: first?.config.phases ?? [],
      input: options.input,
      ...(options.steps !== undefined ? { steps: options.steps } : {}),
    },
    steps,
    warnings,
    runs,
    skipped,
    fairness,
    measurement: first?.measurement ?? null,
    notComparable: first?.notComparable ?? [],
    ...extra,
  };
}

/**
 * What the page cannot know about the build (design 4.2, `bench`): the commit (marked `-dirty`
 * where tracked files changed, since such a run is not the commit's), the kit's version and the
 * vflow version installed. `git(args)` gives a command's output; each failing read says unknown.
 */
export async function benchInfo({ root, git, readFile }) {
  const version = async (...path) => {
    try {
      return JSON.parse(await readFile(join(root, ...path))).version ?? 'unknown';
    } catch {
      return 'unknown';
    }
  };
  let gitSha = 'unknown';
  try {
    const sha = (await git(['rev-parse', 'HEAD'])).trim();
    const changed = (await git(['status', '--porcelain', '--untracked-files=no'])).trim();
    if (sha) gitSha = changed ? `${sha}-dirty` : sha;
  } catch {
    // Not a checkout, or no git: the result says unknown.
  }
  return {
    gitSha,
    kitVersion: await version('projects', 'neat-ui', 'package.json'),
    vflowVersion: await version('node_modules', 'ngx-vflow', 'package.json'),
  };
}
