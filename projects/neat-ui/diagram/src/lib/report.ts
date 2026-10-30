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
