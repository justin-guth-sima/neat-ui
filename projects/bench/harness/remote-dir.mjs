// The one kind of directory the harness makes on the board, and the only kind its scripts may
// delete: `<parent>/neat-bench-<run>`. Shared by the scripts of the browser (`remote.mjs`), the
// bare X server (`board-x.mjs`) and the board's static server (`board-server.mjs`).

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
