import { isDevMode } from '@angular/core';

/** The problems already reported, so each is said once however often the diagram is laid out. */
const reported = new Set<string>();

/**
 * Says in dev mode that a part of the app's diagram is left out, and why (an id that names
 * nothing). The diagram never throws for it: a stale or half-built diagram still draws what it
 * can, and an app that recomputes its diagram on every poll does not repeat the message.
 */
export function reportLeftOut(problem: string): void {
  if (!isDevMode() || reported.has(problem)) return;
  reported.add(problem);
  console.error(`neat-diagram: ${problem}`);
}

/**
 * The parts with the first of each id. A later part with an id already taken is left out and
 * named once: the diagram keys everything by id, so letting the last one win would silently swap
 * which part an edge or a note refers to.
 */
export function firstOfEachId<T extends { readonly id: string }>(
  parts: readonly T[],
  kind: 'node' | 'edge' | 'note',
): T[] {
  const seen = new Set<string>();
  return parts.filter((part) => {
    if (!seen.has(part.id)) {
      seen.add(part.id);
      return true;
    }
    reportLeftOut(`${kind} "${part.id}" is left out: an earlier ${kind} has the same id`);
    return false;
  });
}

/**
 * Forgets the problems already said. For specs only: the spec runner shares this module between
 * spec files, so without it one file's message would silence the same message in a later file.
 */
export function resetReported(): void {
  reported.clear();
}
