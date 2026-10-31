// The one kind of directory the harness makes on the board, and the only kind its scripts may
// delete: `<parent>/neat-bench-<run>`. Shared by the scripts of the browser (`remote.mjs`), the
// bare X server (`board-x.mjs`), the board's static server (`board-server.mjs`) and the guard
// (`board-teardown.mjs`).

export const DEFAULT_PARENTS = ['/tmp', '/var/tmp'];

export function remoteDirFor(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/.test(runId)) {
    throw new Error(`run id "${runId}" cannot name a directory`);
  }
  return `/tmp/neat-bench-${runId}`;
}

/** Throws unless `dir` is `<parent>/neat-bench-<id>`: the only kind of directory it may delete. */
export function assertRemoteDir(dir, parents = DEFAULT_PARENTS) {
  const match = /^(\/[A-Za-z0-9/_.-]*[A-Za-z0-9_.-])\/neat-bench-[A-Za-z0-9-]+$/.exec(dir);
  const parent = match?.[1];
  if (!parent || !parents.includes(parent) || parent.split('/').includes('..')) {
    throw new Error(`not a directory this harness makes: "${dir}"`);
  }
}

/**
 * The opening of every script that starts something in a run the board's guard watches
 * (`board-teardown.mjs`): it refuses to start once the teardown's `stop` file is there, and holds
 * `start.lock` (its pid) while it runs, which the guard waits for before it tears down, so a
 * teardown never races a start into leaving something behind. `not_stopping` is also called
 * before each thing the script starts. Needs `$dir`.
 */
export function startLockFragment() {
  return `not_stopping() {
  [ ! -e "$dir/stop" ] && return
  echo "note the run is being torn down: nothing more is started"
  exit 1
}
not_stopping
echo $$ >"$dir/start.lock"
trap 'rm -f "$dir/start.lock"' EXIT
`;
}
