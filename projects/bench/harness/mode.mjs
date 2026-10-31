// What the browser actually is, as opposed to what was asked for: headless or headed, read from
// its own user agent and command line, so a run that came out headless (a remote start without
// `--remote-display`, a CDP target somebody left headless) is said so and recorded as such.
// Pure.

/** `HeadlessChrome` in the user agent, or `--headless` among the launch arguments. */
export function isHeadless({ userAgent, launchArgs }) {
  return (
    /HeadlessChrome/.test(userAgent ?? '') || launchArgs.some((arg) => /^--headless(=|$)/.test(arg))
  );
}

/**
 * The size to give each page (`{ width, height }`), or null for the window's own, with no
 * emulation. A headed browser on the board or behind a tunnel has a display of its own whose size
 * is the measurement; one started here keeps `--viewport`, the laptop profile.
 */
export function pageSize({ viewport, headless, local }) {
  if (viewport === 'native') return null;
  if (!local && !headless) return null;
  return { width: viewport.w, height: viewport.h };
}

const HEADLESS_WARNING =
  'Headless run: Chromium composites and paces frames differently without a window, so these ' +
  'numbers show that the harness works, not how the renderers perform (design 4.1: headed only).';

/** The warnings the browser's real mode calls for. */
export function modeWarnings({ headless, target, options }) {
  const warnings = [];
  if (headless) {
    const forgot =
      target.kind === 'remote' && !options.headless && !options.remote.display
        ? ' --target remote without --remote-display starts the board’s browser headless.'
        : '';
    warnings.push(HEADLESS_WARNING + forgot);
  } else if (target.kind !== 'local' && options.viewport !== 'native') {
    const { w, h } = options.viewport;
    warnings.push(
      'The browser is headed, so the page has its display’s own size: ' +
        `--viewport ${w}x${h} is ignored.`,
    );
  }
  return warnings;
}
