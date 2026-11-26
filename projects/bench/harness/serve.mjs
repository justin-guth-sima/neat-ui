// A static server for the built bench (`dist/bench/browser`), so a campaign needs nothing but this
// harness: the page is a handful of files, routed by hash (no fallback to index.html is needed),
// and the browser may be here or across a tunnel. It listens on 127.0.0.1 on a port the system
// chooses, which keeps clear of the dev servers' 4200 and 9900.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, posix } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

/** The file a request path names under `root`, or null for any path that leaves it. */
export function resolveRequest(root, requestPath) {
  let path;
  try {
    path = decodeURIComponent(requestPath.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  if (path.includes('\0') || path.includes('\\')) return null;
  if (path.split('/').includes('..')) return null;
  const clean = posix.normalize(path);
  return join(root, clean === '/' ? 'index.html' : clean);
}

/** Serves `root`; resolves with the address and a `close()` that waits for the server. */
export async function serveDist(root, { host = '127.0.0.1', port = 0 } = {}) {
  const server = createServer(async (request, response) => {
    const file = resolveRequest(root, request.url ?? '/');
    try {
      if (!file || !(await stat(file)).isFile()) throw new Error('not a file');
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const { port: bound } = server.address();
  return {
    port: bound,
    url: `http://${host}:${bound}/`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}
