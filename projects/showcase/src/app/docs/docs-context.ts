import { InjectionToken } from '@angular/core';
import type { DocsDeclaredPart, DocsEntry, DocsExample } from './model';

/**
 * What a topic hands its docs page: the parts it documents, the API modules of the entries that
 * own them, and its examples module's examples.
 */
export interface DocsTopic {
  /** Export names, in the order the topic reads; each documented in exactly one topic. */
  readonly parts: readonly string[];
  /**
   * The topic's main parts: the body introduces each, and the panel lists them first. Names from
   * `parts`; the rest are reached from the panel's jump list.
   */
  readonly leads: readonly string[];
  /** The generated API modules (`generated/api/<entry>.ts`) that declare those parts. */
  readonly entries: readonly DocsEntry[];
  /** The topic's examples module's `EXAMPLES`, in file-name order. */
  readonly examples: readonly DocsExample[];
  /**
   * The top bar gets a Fit button, which calls `fit()` on each example that has one. The topic's
   * tools go here and not in an example, since a page has one toolbar and an example may not
   * declare it (a second `*neatPageToolbar` throws).
   */
  readonly fit?: true;
  /**
   * Where the topic's full-page examples are routed (`/demo/page`), for examples that need the
   * whole page (a toolbar, tabs, a panel of their own) and so cannot sit in a card: each card then
   * links to `<openBase>/<id>` and shows the code, instead of rendering the example.
   */
  readonly openBase?: string;
}

/** A topic of the page's group, as one of its page tabs. */
export interface DocsTab {
  readonly label: string;
  /** The topic's route, `/diagram/legend`. */
  readonly path: string;
}

/** A part of the topic with the import path of the entry that owns it. */
export interface DocsTopicPart {
  readonly part: DocsDeclaredPart;
  readonly import: string;
}

/** Where a link to a part goes: router commands and the part's anchor, `api-<Name>`. */
export interface DocsTarget {
  /** `[]` for the page that shows the link, else the path of the topic that documents the part. */
  readonly commands: readonly string[] | string;
  readonly fragment: string;
  /** The part is on this page, so following the link reveals it in the API panel. */
  readonly here: boolean;
}

/**
 * What the views of one docs page ask the page: where a part's name links, and to show a part of
 * this page in its API panel. `DocsPage` provides itself as this, so the views stay plain to test.
 */
export abstract class DocsContext {
  /** Where `name` links to; null for a name the docs do not document (`string`, `T`). */
  abstract target(name: string): DocsTarget | null;
  /** Opens the API panel and scrolls the part's section into view, focusing its heading. */
  abstract reveal(name: string): void;
}

/**
 * The path of the topic that documents a part (`/diagram/diagram`), for links to parts that are
 * not on the page; null for a name no topic documents. The topics config provides it; until then
 * only the page's own parts are links.
 */
export const DOCS_TOPIC_OF = new InjectionToken<(name: string) => string | null>('DOCS_TOPIC_OF', {
  providedIn: 'root',
  factory: () => () => null,
});
