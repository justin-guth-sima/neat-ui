/*
 * The kit's four speech highlights in the CSS Custom Highlight API, shared by every instance on a
 * page: one `Highlight` per name in the document's registry, which `speech.css` styles. Each
 * instance adds and removes only its own ranges. Without the API (jsdom, an older browser) nothing
 * is lit and nothing throws. Internal.
 */

/**
 * The highlights: the sentence being said, the reply after it, its words still to come, the word
 * being said.
 */
export type SpeechHighlightName =
  | 'neat-speech-sentence'
  | 'neat-speech-ahead'
  | 'neat-speech-pending'
  | 'neat-speech-word';

interface HighlightApi {
  readonly registry: Map<string, Set<AbstractRange>>;
  readonly make: new (...ranges: AbstractRange[]) => Set<AbstractRange>;
}

/** The document's registry and the Highlight constructor, or null without the API. */
function apiOf(document: Document): HighlightApi | null {
  const view = document.defaultView as
    | (Window & {
        CSS?: { highlights?: Map<string, Set<AbstractRange>> };
        Highlight?: HighlightApi['make'];
      })
    | null;
  const registry = view?.CSS?.highlights;
  const make = view?.Highlight;
  return registry && make ? { registry, make } : null;
}

/** One instance's ranges in the shared highlights. */
export class HighlightRanges {
  private readonly api: HighlightApi | null;
  private readonly own = new Map<SpeechHighlightName, readonly Range[]>();

  constructor(document: Document) {
    this.api = apiOf(document);
  }

  /** This instance's ranges of highlight `name` are now `ranges`. */
  set(name: SpeechHighlightName, ranges: readonly Range[]): void {
    const api = this.api;
    if (!api) return;
    let highlight = api.registry.get(name);
    if (!highlight) {
      highlight = new api.make();
      api.registry.set(name, highlight);
    }
    for (const range of this.own.get(name) ?? []) highlight.delete(range);
    for (const range of ranges) highlight.add(range);
    this.own.set(name, ranges);
  }

  /** Removes every range of this instance. */
  clear(): void {
    for (const name of [...this.own.keys()]) this.set(name, []);
  }
}
