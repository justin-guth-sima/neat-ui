// What a campaign started (its server, the board's browser, the browser here) and a signal or the
// end must undo, last started first. A cleanup that fails is said and counted: the caller exits
// non-zero for it, so a board left unclean is never a green run.

/** Runs and empties `cleanups`; resolves with how many of them failed. */
export async function runCleanups(cleanups, log) {
  let failed = 0;
  for (const undo of cleanups.splice(0).reverse()) {
    try {
      await undo();
    } catch (error) {
      failed += 1;
      log(`cleanup failed: ${error.message}`);
    }
  }
  return failed;
}
