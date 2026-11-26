import { vi } from 'vitest';

/*
 * What the speaking motions' specs share: the CSS Custom Highlight API, which jsdom lacks, as a
 * registry of plain sets the spec can read back. Internal, for specs only.
 */

/** A Highlight: the ranges it holds. */
export class FakeHighlight extends Set<AbstractRange> {
  constructor(...ranges: AbstractRange[]) {
    super(ranges);
  }
}

/** Installs `CSS.highlights` and `Highlight` until `vi.unstubAllGlobals()`; gives the registry. */
export function installHighlights(): Map<string, FakeHighlight> {
  const registry = new Map<string, FakeHighlight>();
  vi.stubGlobal('CSS', { highlights: registry, supports: () => false, escape: (s: string) => s });
  vi.stubGlobal('Highlight', FakeHighlight);
  return registry;
}

/** The text a highlight covers, its ranges in document order joined. */
export function litText(registry: Map<string, FakeHighlight>, name: string): string {
  const ranges = [...(registry.get(name) ?? [])] as Range[];
  ranges.sort((a, b) => a.compareBoundaryPoints(Range.START_TO_START, b));
  return ranges.map((range) => range.toString()).join('');
}
