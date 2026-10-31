// Long animation frames name a script by the built chunk's URL and a character position in it
// (design 1.2); in a production build that says nothing a person can use. The bench builds with
// source maps and named chunks, so the harness maps each position back to the source file and
// line from the build's own folder (`dist/bench/browser`, whatever machine rendered the page). A
// chunk without a map, or a position that maps to nothing, keeps its key and is counted as not
// mapped; the invoker-only keys ("FrameRequestCallback") pass through.
import { posix } from 'node:path';
import { join } from 'node:path';
import { SourceMapConsumer } from 'source-map';

/** `{ fn, url, pos }` from the page's key (`loafResult`), or null where it names no script. */
export function parseScriptKey(key) {
  const match = /^(?:(.*?)\s+)?([a-z][a-z0-9+.-]*:\/\/\S*?):(\d+)$/i.exec(key);
  if (!match) return null;
  return { fn: match[1] ?? '', url: match[2], pos: Number(match[3]) };
}

/** The 1-based line and 0-based column of character `pos` in `text`, as a source map reads them. */
export function lineColumnOf(text, pos) {
  let line = 1;
  let start = 0;
  for (let i = text.indexOf('\n'); i !== -1 && i < pos; i = text.indexOf('\n', i + 1)) {
    line++;
    start = i + 1;
  }
  return { line, column: pos - start };
}

/** The chunk's file in the build's folder: its name only, so no URL can name another folder. */
function chunkName(url) {
  try {
    const name = posix.basename(decodeURIComponent(new URL(url).pathname));
    return name && name !== '.' && name !== '..' ? name : null;
  } catch {
    return null;
  }
}

/** A source path as a person reads it: the build's `../../` climbing out of its folder removed. */
const readable = (source) => posix.normalize(source).replace(/^(\.\.\/)+/, '');

/**
 * Maps script keys through the maps in `distDir`. `readFile(path)` gives a file's text and
 * rejects where there is none; the consumers are kept until `close()`.
 */
export async function createMapper({ distDir, readFile }) {
  const chunks = new Map();

  async function chunk(name) {
    if (!chunks.has(name)) {
      chunks.set(
        name,
        (async () => {
          try {
            const [text, map] = await Promise.all([
              readFile(join(distDir, name)),
              readFile(join(distDir, `${name}.map`)),
            ]);
            return { text, consumer: await new SourceMapConsumer(JSON.parse(map)) };
          } catch {
            return null;
          }
        })(),
      );
    }
    return chunks.get(name);
  }

  return {
    async map(key) {
      const parsed = parseScriptKey(key);
      const name = parsed && chunkName(parsed.url);
      const found = name && (await chunk(name));
      if (!parsed || !found) return { key, mapped: false };
      const at = found.consumer.originalPositionFor(lineColumnOf(found.text, parsed.pos));
      if (!at.source) return { key, mapped: false };
      const fn = at.name ?? parsed.fn;
      const place = `${readable(at.source)}:${at.line}:${at.column}`;
      return { key: fn ? `${fn} ${place}` : place, mapped: true };
    },
    close() {
      for (const pending of chunks.values()) {
        pending.then((found) => found?.consumer.destroy());
      }
      chunks.clear();
    },
  };
}

/** The steps with each phase's top scripts mapped; the unmapped key is as the page wrote it. */
export async function mapSteps(steps, mapper) {
  return Promise.all(
    steps.map(async (step) => {
      const phases = {};
      for (const [name, phase] of Object.entries(step.phases)) {
        const scripts = phase.loaf?.topScripts;
        if (!scripts) {
          phases[name] = phase;
          continue;
        }
        const topScripts = await Promise.all(
          scripts.map(async (script) => {
            const { key, mapped } = await mapper.map(script.key);
            return mapped ? { key, raw: script.key, ms: script.ms } : script;
          }),
        );
        phases[name] = { ...phase, loaf: { ...phase.loaf, topScripts } };
      }
      return { ...step, phases };
    }),
  );
}
