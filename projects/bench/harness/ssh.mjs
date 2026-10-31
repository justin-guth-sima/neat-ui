// ssh, the one way the harness reaches the board: key login only (it never asks for a password),
// a connect timeout so a board that is off does not hang a campaign, and the host after `--` so
// nothing the user typed can be read as an option.
import { spawn } from 'node:child_process';

const BASE = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15'];

export function sshArgs(host, extra = []) {
  return [...BASE, ...extra, '--', host];
}

/**
 * Runs `script` with `sh -s` on the host (the script on stdin, so nothing needs shell quoting).
 * Resolves with `{ code, stdout, stderr }` whatever the script's exit; rejects only where ssh
 * could not be started or took longer than `timeoutMs`.
 */
export function sshRun(host, script, { timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', [...sshArgs(host), 'sh', '-s'], { stdio: ['pipe', 'pipe', 'pipe'] });
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
