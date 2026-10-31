// ssh, the one way the harness reaches the board: key login only (it never asks for a password),
// a connect timeout so a board that is off does not hang a campaign, and the host after `--` so
// nothing the user typed can be read as an option.
//
// Every ssh runs in a process group of its own (`detached`): a Ctrl-C in the terminal goes to the
// whole foreground group, and an ssh in node's group would die with it, cutting the board script
// it carries at its next line of output. Detached, the signal reaches node only, and node decides
// what the board is told (`run.mjs`, the teardown in `remote.mjs`).
import { spawn } from 'node:child_process';

const BASE = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15'];

export function sshArgs(host, extra = []) {
  return [...BASE, ...extra, '--', host];
}

/** Starts `ssh <extra> -- host [command]` detached from the terminal's process group. */
export function spawnSsh(host, { extra = [], command, stdio, spawn: start = spawn }) {
  const args = [...sshArgs(host, extra), ...(command === undefined ? [] : [command])];
  return start('ssh', args, { stdio, detached: true });
}

/**
 * Runs `script` with `sh -s` on the host (the script on stdin, so nothing needs shell quoting).
 * Resolves with `{ code, stdout, stderr }` whatever the script's exit (ssh's own failures are code
 * 255); rejects only where ssh could not be started or took longer than `timeoutMs`.
 */
export function sshRun(host, script, { timeoutMs = 30_000, spawn: start = spawn } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnSsh(host, {
      command: 'sh -s',
      stdio: ['pipe', 'pipe', 'pipe'],
      spawn: start,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`ssh ${host}: no answer in ${timeoutMs} ms`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(script);
  });
}
