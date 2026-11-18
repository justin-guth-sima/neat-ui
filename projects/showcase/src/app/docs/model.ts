/*
 * The shape of the kit's API docs and of the showcase's examples, which `npm run docs:emit`
 * (tools/docs-emit.mjs) writes into `generated/api/` (from the kit's source, one module per entry
 * point) and `generated/examples/` (from the examples' files, one module per topic). Each
 * generated module is typed with `DocsEntry` or `DocsExample`, so a generator change that breaks
 * the shape fails the build instead of a page. Written by hand; the generator follows it.
 */
import type { Type } from '@angular/core';

/** One entry point's public API. */
export interface DocsEntry {
  /** `primary`, or the secondary entry's folder name (`charts`). */
  readonly entry: string;
  /** What an app imports it as: `@sima/neat-ui` or `@sima/neat-ui/<entry>`. */
  readonly import: string;
  /** Sorted by name. */
  readonly parts: readonly DocsPart[];
}

export type DocsPart =
  | DocsClass
  | DocsFunction
  | DocsConst
  | DocsTypeAlias
  | DocsInterface
  | DocsPackageReexport
  | DocsReexport;

/** A part as its owner entry documents it: anything but a re-export stub. */
export type DocsDeclaredPart = Exclude<DocsPart, DocsReexport>;

/** What every part declared in its entry has. */
interface DocsOwnPart {
  readonly name: string;
  /** Its doc comment; empty when it has none. */
  readonly doc: readonly DocBlock[];
  /** Present when it is deprecated: the `@deprecated` text, which says what to use instead. */
  readonly deprecated?: readonly DocBlock[];
  /** The file that declares it, from the repository's root. */
  readonly source: string;
  /** The other entries that still export it; new code imports it from this entry. */
  readonly alsoExportedFrom?: readonly DocsReexportNote[];
}

/**
 * A class. `template` is a directive on `ng-template[...]` that hands the parent a template,
 * `structural` one used with `*` (it injects its `TemplateRef`), `service` an `@Injectable`.
 * Member groups that would be empty are left out.
 */
export interface DocsClass extends DocsOwnPart {
  readonly kind: 'component' | 'directive' | 'structural' | 'template' | 'service' | 'class';
  /** As written: `T`, `K extends keyof T = keyof T`. */
  readonly typeParameters?: readonly string[];
  /** The class it extends, as written; its members are documented there. */
  readonly extends?: readonly string[];
  readonly selector?: string;
  readonly exportAs?: string;
  /** Its own inputs in source order, then those it forwards from a primitive it hosts. */
  readonly inputs?: readonly DocsMember[];
  /** Two-way bindings, `[(name)]`. */
  readonly models?: readonly DocsMember[];
  /** `type` is what the output emits. */
  readonly outputs?: readonly DocsMember[];
  /** A template directive's `let-` variables; `$implicit` is the bare `let-x`. */
  readonly context?: readonly DocsMember[];
  readonly properties?: readonly DocsMember[];
  readonly methods?: readonly DocsMethod[];
}

export interface DocsFunction extends DocsOwnPart {
  readonly kind: 'function';
  /** As written, type parameters included; one line per overload. */
  readonly signature: string;
}

export interface DocsConst extends DocsOwnPart {
  readonly kind: 'const';
  readonly type: string;
}

export interface DocsTypeAlias extends DocsOwnPart {
  readonly kind: 'type';
  readonly typeParameters?: readonly string[];
  /** The right-hand side as written. */
  readonly definition: string;
}

export interface DocsInterface extends DocsOwnPart {
  readonly kind: 'interface';
  readonly typeParameters?: readonly string[];
  /** The interfaces it extends, as written; their members are documented there. */
  readonly extends?: readonly string[];
  readonly members: readonly DocsMember[];
  readonly methods?: readonly DocsMethod[];
}

/** A part another entry owns, still exported here: documented there, under `from`. */
export interface DocsReexport {
  readonly kind: 'reexport';
  readonly name: string;
  /** The owner's import path. */
  readonly from: string;
  /** The comment written above the re-export: why it is still there. */
  readonly note: readonly DocBlock[];
}

/**
 * A whole package an entry re-exports (`export * from 'lucide'`), named after the package. Its
 * names are the package's own, so nothing documents them one by one; the doc is the statement's,
 * and says what the entry offers them for. It is a part of its entry, where a `DocsReexport`
 * is a stub.
 */
export interface DocsPackageReexport extends DocsOwnPart {
  readonly kind: 'reexport';
  readonly package: true;
  /** The import path of the entry that re-exports it. */
  readonly import: string;
}

export interface DocsReexportNote {
  /** The re-exporting entry's import path. */
  readonly import: string;
  readonly note: readonly DocBlock[];
}

/** An input, model, output, template variable, property or interface member. */
export interface DocsMember {
  /** The name a template or caller uses: an input's alias when it has one. */
  readonly name: string;
  /** The class property behind an aliased input or output. */
  readonly property?: string;
  /** As written where the source writes it, else as the compiler infers it. */
  readonly type: string;
  /** An input or model the template must bind. */
  readonly required?: true;
  /** An interface member marked `?`. */
  readonly optional?: true;
  /** The initial value as written (`'neutral'`, `[]`); absent when it starts unset. */
  readonly default?: string;
  /** An input's transform as written: `booleanAttribute` means the attribute alone is true. */
  readonly transform?: string;
  /** What a template may bind to an input whose transform is not an attribute one. */
  readonly accepts?: string;
  /** Bound on a primitive the part hosts; its doc is the part's `@input` or `@output` tag. */
  readonly forwarded?: true;
  readonly doc: readonly DocBlock[];
  readonly deprecated?: readonly DocBlock[];
}

export interface DocsMethod {
  readonly name: string;
  /** As written, return type inferred where the source leaves it out; one line per overload. */
  readonly signature: string;
  readonly doc: readonly DocBlock[];
  readonly deprecated?: readonly DocBlock[];
}

/** The Markdown the kit's doc comments use: paragraphs, fenced code and one level of lists. */
export type DocBlock =
  | { readonly kind: 'paragraph'; readonly spans: readonly DocSpan[] }
  | { readonly kind: 'code'; readonly language?: string; readonly code: string }
  | { readonly kind: 'list'; readonly items: readonly (readonly DocSpan[])[] };

/**
 * Running text. A code span that is exactly a public part's name, or `Name.member`, is a `ref`
 * to that part; `strong` is text between `**`.
 */
export type DocSpan =
  | { readonly kind: 'text'; readonly text: string; readonly strong?: true }
  | { readonly kind: 'code'; readonly text: string; readonly strong?: true }
  | {
      readonly kind: 'ref';
      readonly text: string;
      readonly name: string;
      readonly member?: string;
      readonly strong?: true;
    };

/**
 * One example of a topic: a standalone component in `examples/<topic>/<id>.example.ts`, which the
 * page renders, and its own source, which the page shows. The source is what the file says, so the
 * two cannot drift apart; the generated module is checked against the files.
 */
export interface DocsExample {
  /** The file name less `.example.ts` and a numeric prefix (`1-basics` is `basics`). */
  readonly id: string;
  /** The component's class name in words: `MessagingPipeline` is "Messaging pipeline". */
  readonly title: string;
  /**
   * What the page renders. Absent for an example the page cannot render because it already sits
   * in it (the showcase's own shell): the card says so and shows the code.
   */
  readonly component?: Type<unknown>;
  /**
   * The live area has no inset, for an example that fills it to its edges (a drawing); the
   * example's class doc says so with the bare tag `@unpadded`.
   */
  readonly unpadded?: true;
  /**
   * The example needs a whole page (its own toolbar, tabs, panel or shell), so it is routed at
   * `/demo/<topic>/<id>` and its card links there instead of rendering it; the bare tag `@page`.
   */
  readonly page?: true;
  /**
   * The example whose picture stands for its topic in the README's gallery, at most one per
   * topic; the bare tag `@gallery`. The page itself does not read it.
   */
  readonly gallery?: true;
  /**
   * The example's point is motion, so the Markdown docs show it as an animation, beside its still
   * picture for a reader who asked for reduced motion; the bare tag `@animated`. The page itself
   * does not read it.
   */
  readonly animated?: true;
  /**
   * The Markdown docs show the example without a picture, for one whose point is what a widget
   * reports to the app; the bare tag `@unpictured`. The page itself does not read it.
   */
  readonly unpictured?: true;
  /** The animation's length and rate where they are not the capture's defaults (`@animated 6s 20fps`). */
  readonly animation?: { readonly seconds?: number; readonly fps?: number };
  /**
   * The script the docs' pictures run, one `@play` tag a step: hover or click a target (at a point
   * of its box, in percent), or wait. A still shows the state after it; an animation shows it run.
   * The page itself does not read it.
   */
  readonly play?: readonly (
    | {
        readonly action: 'hover' | 'click';
        readonly target: string;
        readonly at?: { readonly x: number; readonly y: number };
      }
    | { readonly action: 'wait'; readonly ms: number }
  )[];
  /** The controls the docs' pictures hide, which `play` still drives (`@hide <selector>`). */
  readonly hide?: string;
  /**
   * What the docs' picture of the example does first (`@capture click <selector>` or `hover`),
   * for an example whose content opens in an overlay; the page itself does not read it.
   */
  readonly capture?: { readonly action: 'click' | 'hover'; readonly target: string };
  /** The component's doc comment less those tags: prose for the page, left out of the snippet. */
  readonly caption: readonly DocBlock[];
  /**
   * The kit parts the file imports, as `<import path>#<name>`:
   * `@sima/neat-ui/status-chip#NeatStatusChip`.
   */
  readonly shows: readonly string[];
  /**
   * The example's file first, then its template, the files of its topic folder that it imports
   * and its stylesheets.
   */
  readonly files: readonly DocsExampleFile[];
}

/** A source file of an example, as highlighted runs that spell the file again. */
export interface DocsExampleFile {
  /** From the topic folder: `tones.example.ts`, `tones.example.html`, `data/pipeline.ts`. */
  readonly name: string;
  readonly code: readonly DocsToken[];
}

/** A run of source of one kind; a template string is one `string` run. */
export type DocsToken = readonly [kind: 'keyword' | 'string' | 'comment' | 'text', text: string];

/**
 * One entry of the docs' search index, which `docs:emit` writes from the kit's docs and the
 * examples; the showcase places each by its topics. `text` is the first sentence of its doc or
 * caption, empty without one.
 */
export type DocsSearchEntry =
  | {
      readonly kind: 'part';
      readonly name: string;
      readonly partKind: DocsPart['kind'];
      readonly text: string;
    }
  | { readonly kind: 'member'; readonly name: string; readonly part: string; readonly text: string }
  | {
      readonly kind: 'example';
      readonly name: string;
      readonly topic: string;
      readonly id: string;
      readonly text: string;
    };

/** A file of a step of the tutorial, as the reader's app has it; `docs:emit` reads them. */
export interface DocsTutorialFile {
  /** Its path in the reader's app (`src/app/app.routes.ts`). */
  readonly path: string;
  readonly text: string;
}
