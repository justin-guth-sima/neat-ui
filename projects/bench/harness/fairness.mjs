// Acting on the fairness check (design 3.2): before any frames are compared the kit and vflow
// draw ladder A up to ×1, and the page judges the two fingerprints (`benchCompare`). An
// unfair pair stops the campaign, loudly, before an hour of numbers that cannot be compared;
// `--allow-unfair` goes on, and the report and every problem stay in the result's warnings.

/**
 * The report from the two fairness runs: the page's judgment (from the vflow page, which was
 * given the kit's fingerprint), or a failed report where either run itself failed.
 */
export function fairnessReport(kit, vflow) {
  if (!kit.ok) {
    return {
      ok: false,
      problems: [`the kit's fairness run failed: ${kit.error}`],
      dom: {},
      drawn: {},
    };
  }
  if (!vflow?.ok) {
    return {
      ok: false,
      problems: [`vflow's fairness run failed: ${vflow?.error ?? 'it did not run'}`],
      dom: {},
      drawn: {},
    };
  }
  return vflow.inspected;
}

/** Whether to stop, and the lines to print either way. */
export function fairnessVerdict(report, allowUnfair) {
  if (report.ok) {
    const { nodes, edges } = report.drawn.kit;
    return {
      stop: false,
      lines: [`fairness check passed: ${nodes} blocks and ${edges} edges drawn alike`],
    };
  }
  const lines = [
    'FAIRNESS CHECK FAILED: the kit and vflow do not draw the same picture:',
    ...report.problems.map((problem) => `  ${problem}`),
  ];
  lines.push(
    allowUnfair
      ? 'going on because --allow-unfair was given; the problems are in the result’s warnings'
      : 'stopping before anything is measured (--allow-unfair goes on regardless)',
  );
  return { stop: !allowUnfair, lines };
}
