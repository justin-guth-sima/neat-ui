import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import ts from 'typescript';
import {
  checkDocs,
  checkReport,
  extractKit,
  generate,
  OUTPUT_DIR,
  writeDocs,
} from './docs-emit.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MODEL = 'projects/showcase/src/app/docs/model.ts';

const roots = [];
after(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function write(root, path, content) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

/**
 * Writes a kit to a temp dir: `files` maps a path under `projects/neat-ui` to its content. Each
 * `<name>/src/public-api.ts` becomes a secondary entry (its ng-package.json and path mapping are
 * written too), and `vendor/` beside the kit stands for a third-party package such as brain, so
 * its declarations lie outside the kit. The repo's node_modules is linked in for @angular/core.
 */
function kitWith(files) {
  const root = mkdtempSync(join(tmpdir(), 'docs-emit-'));
  roots.push(root);
  symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');
  const paths = { '@sima/neat-ui': ['./projects/neat-ui/src/public-api.ts'], vendor: ['./vendor'] };
  for (const path of Object.keys(files)) {
    const entry = path.match(/^([\w-]+)\/src\/public-api\.ts$/)?.[1];
    if (!entry || entry === 'src') continue;
    paths[`@sima/neat-ui/${entry}`] = [`./projects/neat-ui/${entry}/src/public-api.ts`];
    write(root, `projects/neat-ui/${entry}/ng-package.json`, '{}\n');
  }
  write(
    root,
    'tsconfig.json',
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        module: 'preserve',
        experimentalDecorators: true,
        skipLibCheck: true,
        paths,
      },
    }),
  );
  write(
    root,
    'projects/neat-ui/tsconfig.lib.json',
    JSON.stringify({
      extends: '../../tsconfig.json',
      compilerOptions: { types: [] },
      include: ['src/**/*.ts', '*/src/**/*.ts'],
      exclude: ['**/*.spec.ts'],
    }),
  );
  for (const [path, content] of Object.entries(files)) {
    write(root, path.startsWith('vendor/') ? path : `projects/neat-ui/${path}`, content);
  }
  return root;
}

/** The part `name` of entry `entry` ("primary" or a secondary's folder name). */
function partOf(result, entry, name) {
  const found = result.entries.find((e) => e.entry === entry)?.parts.find((p) => p.name === name);
  assert.ok(found, `${entry} has no part ${name}`);
  return found;
}

/** `make()`, computed on first use, so that a fixture that fails to extract fails its own tests. */
function once(make) {
  let value;
  return () => (value ??= make());
}

/** A doc made of one paragraph of plain text, as the extractor gives it. */
const plain = (text) => [{ kind: 'paragraph', spans: [{ kind: 'text', text }] }];

// --- signal members (review focus 1) ----------------------------------------------------------

const SIGNALS = kitWith({
  'src/public-api.ts': "export * from './lib/card';\nexport type { NeatTone } from './lib/tone';\n",
  'src/lib/tone.ts': "/** A tone. */\nexport type NeatTone = 'neutral' | 'danger';\n",
  'src/lib/card.ts': `import {
  booleanAttribute, Component, input, model, numberAttribute, output,
} from '@angular/core';
import type { NeatTone } from './tone';

/** Not Angular's \`input\`: a member made with it is a plain property. */
function local<T>(value: T): T {
  return value;
}
const helpers = { input: local };

/** A card. */
@Component({ selector: 'neat-card', exportAs: 'neatCard', template: '' })
export class NeatCard {
  /** The card's key. */
  readonly key = input.required<string>({ alias: 'neatCard' });
  /** The tone. */
  readonly tone = input<NeatTone>('neutral');
  /** The title. */
  readonly title = input('');
  /** The count. */
  readonly count = input<number>();
  /** The items. */
  readonly items = input<readonly string[]>([]);
  /** Whether it can be chosen. */
  readonly selectable = input(false, { transform: booleanAttribute });
  /** The width. */
  readonly width = input(0, { transform: numberAttribute });
  /** The size, given as text or a number. */
  readonly size = input(1, { transform: (value: string | number) => Number(value) });
  /** The open path. */
  readonly level = model<string[]>([]);
  /** The chosen id. */
  readonly chosen = model.required<string>();
  /** Emits on activation. */
  readonly activate = output<string>();
  /** Emits on close. */
  readonly closed = output({ alias: 'close' });
  /** A local helper's value. */
  readonly plain = helpers.input('x');
}
`,
});
const card = once(() => partOf(extractKit(SIGNALS), 'primary', 'NeatCard'));
const member = (list, name) => {
  const found = card()[list]?.find((m) => m.name === name);
  assert.ok(found, `NeatCard has no ${list} member ${name}`);
  return found;
};

test('a component is recorded with its selector and exportAs', () => {
  assert.equal(card().kind, 'component');
  assert.equal(card().selector, 'neat-card');
  assert.equal(card().exportAs, 'neatCard');
  assert.equal(card().source, 'projects/neat-ui/src/lib/card.ts');
});

test('an aliased input is listed by its public name, the property kept', () => {
  assert.deepEqual(member('inputs', 'neatCard'), {
    name: 'neatCard',
    property: 'key',
    type: 'string',
    required: true,
    doc: plain("The card's key."),
  });
});

test('an aliased output is listed by its public name, the property kept', () => {
  assert.deepEqual(member('outputs', 'close'), {
    name: 'close',
    property: 'closed',
    type: 'void',
    doc: plain('Emits on close.'),
  });
});

test('the required forms are required and have no default', () => {
  assert.equal(member('inputs', 'neatCard').required, true);
  assert.equal(member('inputs', 'neatCard').default, undefined);
  assert.equal(member('models', 'chosen').required, true);
  assert.equal(member('models', 'chosen').default, undefined);
});

test('a default is the first argument as written, and an input without one has none', () => {
  assert.equal(member('inputs', 'tone').default, "'neutral'");
  assert.equal(member('inputs', 'items').default, '[]');
  assert.equal(member('inputs', 'title').default, "''");
  assert.equal('default' in member('inputs', 'count'), false);
  assert.equal(member('inputs', 'count').required, undefined);
});

test('an explicit type argument is kept as written, else the type is inferred', () => {
  assert.equal(member('inputs', 'tone').type, 'NeatTone');
  assert.equal(member('inputs', 'items').type, 'readonly string[]');
  assert.equal(member('inputs', 'title').type, 'string');
  assert.equal(member('inputs', 'count').type, 'number');
});

test('an attribute transform is recorded by name, any other with the type it accepts', () => {
  const selectable = member('inputs', 'selectable');
  assert.equal(selectable.type, 'boolean');
  assert.equal(selectable.default, 'false');
  assert.equal(selectable.transform, 'booleanAttribute');
  assert.equal('accepts' in selectable, false);
  assert.equal(member('inputs', 'width').transform, 'numberAttribute');
  const size = member('inputs', 'size');
  assert.equal(size.type, 'number');
  assert.equal(size.transform, '(value: string | number) => Number(value)');
  assert.equal(size.accepts, 'string | number');
});

test('models are their own group', () => {
  assert.deepEqual(member('models', 'level'), {
    name: 'level',
    type: 'string[]',
    default: '[]',
    doc: plain('The open path.'),
  });
  assert.equal(
    card().inputs.some((m) => m.name === 'level'),
    false,
  );
});

test("an output's type is what it emits", () => {
  assert.deepEqual(member('outputs', 'activate'), {
    name: 'activate',
    type: 'string',
    doc: plain('Emits on activation.'),
  });
});

test("only Angular's own input() makes an input; a local helper of the same name does not", () => {
  assert.equal(
    card().inputs.some((m) => m.name === 'plain'),
    false,
  );
  assert.deepEqual(
    card().properties.map((p) => p.name),
    ['plain'],
  );
});

test('members are in source order', () => {
  assert.deepEqual(
    card().inputs.map((m) => m.name),
    ['neatCard', 'tone', 'title', 'count', 'items', 'selectable', 'width', 'size'],
  );
});

// --- forwarded bindings (review focus 1) ------------------------------------------------------

const FORWARDED = kitWith({
  'vendor/index.ts': `import { Directive, input, model, output } from '@angular/core';

export type BrnPosition = 'top' | 'bottom' | 'left' | 'right';
export type BooleanInput = string | boolean | null | undefined;

@Directive({ selector: '[brnTip]' })
export class BrnTip {
  /** Brain's own doc, not the kit's. */
  readonly position = input<BrnPosition>('top');
  readonly disabled = input<boolean, BooleanInput>(false, { transform: (v: BooleanInput) => !!v });
  readonly label = input('');
  readonly expanded = model(false);
  readonly shown = output<boolean>();
}
`,
  'src/public-api.ts': "export { NeatTip } from './lib/tip';\n",
  'src/lib/tip.ts': `import { Directive, input } from '@angular/core';
import { BrnTip } from 'vendor';

/**
 * A tip.
 *
 * @input neatTipPosition Where the tip sits.
 * @input open Whether it is open.
 * @output neatTipShown Emits when it shows.
 */
@Directive({
  selector: '[neatTip]',
  hostDirectives: [
    {
      directive: BrnTip,
      inputs: [
        'position: neatTipPosition',
        'disabled',
        'label',
        'expanded: open',
      ],
      outputs: ['expandedChange: openChange', 'shown: neatTipShown'],
    },
  ],
})
export class NeatTip {
  /** The kit's label. */
  readonly label = input.required<string>();
}
`,
});
const forwarded = once(() => extractKit(FORWARDED));
const tip = once(() => partOf(forwarded(), 'primary', 'NeatTip'));

test('a forwarded input with a third-party type alias is spelled out, its doc from @input', () => {
  assert.deepEqual(
    tip().inputs.find((m) => m.name === 'neatTipPosition'),
    {
      name: 'neatTipPosition',
      type: "'top' | 'bottom' | 'left' | 'right'",
      forwarded: true,
      doc: plain('Where the tip sits.'),
    },
  );
  const disabled = tip().inputs.find((m) => m.name === 'disabled');
  assert.equal(disabled.type, 'string | boolean | null | undefined');
  assert.deepEqual(disabled.doc, []);
  assert.doesNotMatch(JSON.stringify(forwarded()), /Brn|BooleanInput|Brain's own doc/);
});

test('an own input wins over a forwarded one of the same public name', () => {
  const labels = tip().inputs.filter((m) => m.name === 'label');
  assert.equal(labels.length, 1);
  assert.deepEqual(labels[0], {
    name: 'label',
    type: 'string',
    required: true,
    doc: plain("The kit's label."),
  });
  assert.deepEqual(
    tip().inputs.map((m) => m.name),
    ['label', 'neatTipPosition', 'disabled'],
  );
});

test('a forwarded model with its forwarded change output is a two-way binding', () => {
  assert.deepEqual(tip().models, [
    { name: 'open', type: 'boolean', forwarded: true, doc: plain('Whether it is open.') },
  ]);
  assert.deepEqual(tip().outputs, [
    { name: 'neatTipShown', type: 'boolean', forwarded: true, doc: plain('Emits when it shows.') },
  ]);
});

test('a forwarded binding without its tag is a doc problem', () => {
  assert.ok(
    forwarded().problems.some((p) =>
      /tip\.ts:\d+: NeatTip\.disabled is forwarded and has no `@input disabled` tag/.test(p),
    ),
    forwarded().problems.join('\n'),
  );
});

// --- kinds, members and their order -----------------------------------------------------------

const KINDS = kitWith({
  'src/public-api.ts': `export * from './lib/parts';
export { NeatToolbar } from './lib/toolbar';
export { ɵhelper, ɵHidden } from './lib/internal';
`,
  'src/lib/internal.ts': `/** Shared with the entries. */
export const ɵhelper = 1;
/** Shared with the entries. */
export class ɵHidden {}
`,
  'src/lib/toolbar.ts': `import { Directive, inject, TemplateRef } from '@angular/core';

/** Renders its template elsewhere. */
@Directive({ selector: '[neatToolbar]' })
export class NeatToolbar {
  constructor() {
    console.log(inject(TemplateRef));
  }
}
`,
  'src/lib/parts.ts': `import {
  Component, Directive, inject, Injectable, input, OnDestroy, TemplateRef,
} from '@angular/core';

/** A row. */
export interface NeatRow<T = unknown> {
  /** Its id. */
  readonly id: string;
  /** Its value, when there is one. */
  value?: T;
  /** Says it. */
  say(words: string): void;
}

/** A row with more. */
export interface NeatWideRow extends NeatRow<string> {
  /** The more. */
  readonly extra: number;
}

/** A kind of thing. */
export type NeatKind<T> = 'a' | 'b' | T;

/** The default size. */
export const NEAT_SIZE = 4;

/** Typed as written. */
export const NEAT_NAMES: readonly string[] = ['a'];

/** Doubles a number. */
export function neatDouble<T extends number>(value: T, by = 2): number {
  return value * by;
}

/** Halves a number. */
export const neatHalf = (value: number): number => value / 2;

/** Parses one way. */
export function neatParse(value: string): number;
/** Parses the other way. */
export function neatParse(value: number): string;
export function neatParse(value: string | number): string | number {
  return typeof value === 'string' ? Number(value) : String(value);
}

/** What a row's template is given. */
interface RowContext {
  /** The row. */
  readonly $implicit: NeatRow;
  /** Its index. */
  readonly index: number;
}

/** A row's template. */
@Directive({ selector: 'ng-template[neatRow]' })
export class NeatRowTemplate {
  /**
   * Read by the list.
   * @internal
   */
  readonly template = inject(TemplateRef);

  static ngTemplateContextGuard(_d: NeatRowTemplate, context: unknown): context is RowContext {
    return true;
  }
}

/** Marks a thing. */
@Directive({ selector: '[neatMark]' })
export class NeatMark {}

/** A list. */
@Component({ selector: 'neat-list', template: '' })
export class NeatList<T, K extends keyof T = keyof T> implements OnDestroy {
  /** The rows. */
  readonly rows = input<readonly T[]>([]);
  /** The current key, if any. */
  readonly current: K | null = null;
  private readonly secret = 1;
  protected readonly shown = 2;
  static readonly shared = 3;

  /** Scrolls to a row. */
  scrollTo(index: number): void {
    console.log(index, this.secret, this.shown);
  }

  /** Inferred return. */
  count() {
    return 1;
  }

  /** Opens one way. */
  open(id: string): void;
  /** Opens the other way. */
  open(index: number): void;
  open(_target: string | number): void {}

  ngOnDestroy(): void {}

  private hidden(): void {}
}

/** Shows toasts. */
@Injectable({ providedIn: 'root' })
export class NeatToasts {
  /** Shows one. */
  show(text: string): void {
    console.log(text);
  }
}

/** A handle on an open thing. */
export abstract class NeatRef<R = unknown> {
  /** Whether it may close. */
  abstract readonly dismissible: boolean;
  /** Closes it. */
  abstract close(result?: R): void;
}
`,
});
const kinds = once(() => extractKit(KINDS));
const kind = (name) => partOf(kinds(), 'primary', name);

test('each part has its kind', () => {
  assert.deepEqual(Object.fromEntries(kinds().entries[0].parts.map((p) => [p.name, p.kind])), {
    NEAT_NAMES: 'const',
    NEAT_SIZE: 'const',
    NeatKind: 'type',
    NeatList: 'component',
    NeatMark: 'directive',
    NeatRef: 'class',
    NeatRow: 'interface',
    NeatRowTemplate: 'template',
    NeatToasts: 'service',
    NeatToolbar: 'structural',
    NeatWideRow: 'interface',
    neatDouble: 'function',
    neatHalf: 'function',
    neatParse: 'function',
  });
  assert.deepEqual(kinds().problems, []);
});

test('ɵ names never appear', () => {
  assert.doesNotMatch(JSON.stringify(kinds().entries), /ɵ/);
  assert.deepEqual(
    kinds().problems.filter((p) => /ɵ/.test(p)),
    [],
  );
});

test('parts are sorted by name, by code point', () => {
  const names = kinds().entries[0].parts.map((p) => p.name);
  assert.deepEqual(names, [...names].sort());
  assert.ok(names.indexOf('NeatToolbar') < names.indexOf('neatDouble'));
});

test('functions, consts and types carry their signature, type and definition as written', () => {
  assert.equal(
    kind('neatDouble').signature,
    'neatDouble<T extends number>(value: T, by = 2): number',
  );
  assert.equal(kind('neatHalf').signature, 'neatHalf(value: number): number');
  assert.equal(
    kind('neatParse').signature,
    'neatParse(value: string): number\nneatParse(value: number): string',
  );
  assert.deepEqual(kind('neatParse').doc, plain('Parses one way.'));
  assert.equal(kind('NEAT_SIZE').type, '4');
  assert.equal(kind('NEAT_NAMES').type, 'readonly string[]');
  assert.equal(kind('NeatKind').definition, "'a' | 'b' | T");
  assert.deepEqual(kind('NeatKind').typeParameters, ['T']);
});

test('an interface lists its members with their optional flag and doc, and what it extends', () => {
  const row = kind('NeatRow');
  assert.deepEqual(row.typeParameters, ['T = unknown']);
  assert.deepEqual(row.members, [
    { name: 'id', type: 'string', doc: plain('Its id.') },
    { name: 'value', type: 'T', optional: true, doc: plain('Its value, when there is one.') },
  ]);
  assert.deepEqual(row.methods, [
    { name: 'say', signature: 'say(words: string): void', doc: plain('Says it.') },
  ]);
  assert.equal('extends' in row, false);
  assert.deepEqual(kind('NeatWideRow').extends, ['NeatRow<string>']);
});

test('a template directive gives its context as let- variables; @internal members are left out', () => {
  const template = kind('NeatRowTemplate');
  assert.equal(template.selector, 'ng-template[neatRow]');
  assert.deepEqual(template.context, [
    { name: '$implicit', type: 'NeatRow', doc: plain('The row.') },
    { name: 'index', type: 'number', doc: plain('Its index.') },
  ]);
  assert.equal('properties' in template, false);
});

test('public methods and fields are listed; private, protected, static and hooks are not', () => {
  const list = kind('NeatList');
  assert.deepEqual(list.typeParameters, ['T', 'K extends keyof T = keyof T']);
  assert.deepEqual(list.properties, [
    { name: 'current', type: 'K | null', doc: plain('The current key, if any.') },
  ]);
  assert.deepEqual(list.methods, [
    {
      name: 'scrollTo',
      signature: 'scrollTo(index: number): void',
      doc: plain('Scrolls to a row.'),
    },
    { name: 'count', signature: 'count(): number', doc: plain('Inferred return.') },
    {
      name: 'open',
      signature: 'open(id: string): void\nopen(index: number): void',
      doc: plain('Opens one way.'),
    },
  ]);
});

test('services and plain classes list their methods and properties', () => {
  assert.deepEqual(kind('NeatToasts').methods, [
    { name: 'show', signature: 'show(text: string): void', doc: plain('Shows one.') },
  ]);
  const ref = kind('NeatRef');
  assert.deepEqual(ref.typeParameters, ['R = unknown']);
  assert.deepEqual(ref.properties, [
    { name: 'dismissible', type: 'boolean', doc: plain('Whether it may close.') },
  ]);
  assert.deepEqual(ref.methods, [
    { name: 'close', signature: 'close(result?: R): void', doc: plain('Closes it.') },
  ]);
});

// --- re-exports (review focus 3) --------------------------------------------------------------

const REEXPORTS = kitWith({
  'src/public-api.ts': "export { NeatSwatch } from './lib/swatch';\n",
  'src/lib/swatch.ts': `import { Component } from '@angular/core';

/** A swatch. */
@Component({ selector: 'neat-swatch', template: '' })
export class NeatSwatch {}
`,
  'vendor/index.ts': 'export class BrnChart {}\n',
  'charts/src/public-api.ts': `export { NeatChart } from './lib/chart';
export { BrnChart } from 'vendor';
// The swatch moved to the primary; still exported here so the apps that import it from
// \`charts\` keep working.
export { NeatSwatch } from '@sima/neat-ui';
`,
  'charts/src/lib/chart.ts': `import { Component } from '@angular/core';

/** A chart. */
@Component({ selector: 'neat-chart', template: '' })
export class NeatChart {}
`,
});
const reexports = once(() => extractKit(REEXPORTS));

test('a re-export is documented once, at its owner, and the other entry gets a stub with its note', () => {
  const note = [
    {
      kind: 'paragraph',
      spans: [
        {
          kind: 'text',
          text: 'The swatch moved to the primary; still exported here so the apps that import it from ',
        },
        { kind: 'code', text: 'charts' },
        { kind: 'text', text: ' keep working.' },
      ],
    },
  ];
  assert.deepEqual(partOf(reexports(), 'charts', 'NeatSwatch'), {
    name: 'NeatSwatch',
    kind: 'reexport',
    from: '@sima/neat-ui',
    note,
  });
  const owned = partOf(reexports(), 'primary', 'NeatSwatch');
  assert.equal(owned.kind, 'component');
  assert.deepEqual(owned.alsoExportedFrom, [{ import: '@sima/neat-ui/charts', note }]);
  assert.deepEqual(
    reexports().entries.map((e) => [e.entry, e.import]),
    [
      ['primary', '@sima/neat-ui'],
      ['charts', '@sima/neat-ui/charts'],
    ],
  );
});

test("a third-party export is no part of the kit's docs, and a problem", () => {
  assert.equal(JSON.stringify(reexports().entries).includes('BrnChart'), false);
  assert.deepEqual(reexports().problems, [
    "projects/neat-ui/charts/src/public-api.ts:2: BrnChart is declared outside the kit; export only the kit's own parts",
  ]);
});

// --- doc comments (review focus 2) ------------------------------------------------------------

const DOCS = kitWith({
  'src/public-api.ts': "export * from './lib/view';\n",
  'src/lib/view.ts': `import { Component, input } from '@angular/core';

const TONE_CLASSES = { neutral: 'x' };
const SIZE_STEPS = [1, 2];
function along(): number {
  return 0.5;
}

/**
 * The body of a block, see \`NeatView.fit\` and \`NeatOld\`:
 *
 * \`\`\`html
 * <ng-template neatBlock let-node>
 *   @if (node.id === 'decode') { <span>fps</span> }
 *   @for (chip of node.chips; track chip) { {{ chip }} }
 * </ng-template>
 * \`\`\`
 *
 * - **Filter.** Typing filters,
 *   over two lines.
 * - \`fit()\` fits.
 *
 * A **\`manage\` mode** paragraph
 * joined from two lines, colours as in \`TONE_CLASSES\`.
 */
@Component({ selector: 'neat-view', template: '' })
export class NeatView {
  /** The tone. */
  readonly tone = input('neutral');
  /** Steps as SIZE_STEPS lists them, from where it sits \`along\` its edge. */
  readonly size = input(1);
  /** Where it sits on its edge. */
  readonly along = input(0.5);
  readonly bare = input(0);

  /**
   * The old name.
   * @deprecated Use \`tone\`
   *   instead.
   */
  readonly colour = input('neutral');

  /** Fits. */
  fit(): void {
    console.log(TONE_CLASSES, SIZE_STEPS, along());
  }
}

/**
 * The old view.
 *
 * @deprecated Use \`NeatView\`.
 */
@Component({ selector: 'neat-old', template: '' })
export class NeatOld {}

export type NeatBare = string;
`,
});
const docs = once(() => extractKit(DOCS));
const view = once(() => partOf(docs(), 'primary', 'NeatView'));

test('Angular control flow inside a fenced example survives, and tags after the fence are read', () => {
  const code = view().doc.find((b) => b.kind === 'code');
  assert.deepEqual(code, {
    kind: 'code',
    language: 'html',
    code: [
      '<ng-template neatBlock let-node>',
      "  @if (node.id === 'decode') { <span>fps</span> }",
      '  @for (chip of node.chips; track chip) { {{ chip }} }',
      '</ng-template>',
    ].join('\n'),
  });
  assert.equal(view().doc.length, 4);
  assert.deepEqual(partOf(docs(), 'primary', 'NeatOld').deprecated, [
    {
      kind: 'paragraph',
      spans: [
        { kind: 'text', text: 'Use ' },
        { kind: 'ref', text: 'NeatView', name: 'NeatView' },
        { kind: 'text', text: '.' },
      ],
    },
  ]);
});

test('Markdown blocks: paragraphs joined from lines, lists, strong text, code spans and references', () => {
  const [intro, , list, closing] = view().doc;
  assert.deepEqual(intro, {
    kind: 'paragraph',
    spans: [
      { kind: 'text', text: 'The body of a block, see ' },
      { kind: 'ref', text: 'NeatView.fit', name: 'NeatView', member: 'fit' },
      { kind: 'text', text: ' and ' },
      { kind: 'ref', text: 'NeatOld', name: 'NeatOld' },
      { kind: 'text', text: ':' },
    ],
  });
  assert.deepEqual(list, {
    kind: 'list',
    items: [
      [
        { kind: 'text', text: 'Filter.', strong: true },
        { kind: 'text', text: ' Typing filters, over two lines.' },
      ],
      [
        { kind: 'code', text: 'fit()' },
        { kind: 'text', text: ' fits.' },
      ],
    ],
  });
  assert.deepEqual(closing.spans.slice(0, 4), [
    { kind: 'text', text: 'A ' },
    { kind: 'code', text: 'manage', strong: true },
    { kind: 'text', text: ' mode', strong: true },
    { kind: 'text', text: ' paragraph joined from two lines, colours as in ' },
  ]);
});

test('a deprecated member carries its text as blocks', () => {
  const colour = view().inputs.find((m) => m.name === 'colour');
  assert.deepEqual(colour.doc, plain('The old name.'));
  assert.deepEqual(colour.deprecated, [
    {
      kind: 'paragraph',
      spans: [
        { kind: 'text', text: 'Use ' },
        { kind: 'code', text: 'tone' },
        { kind: 'text', text: ' instead.' },
      ],
    },
  ]);
});

// `along` is also an internal function's name, but here it is the view's own public input.
test('doc problems: a part or own input without a doc, and a code span or code-shaped word naming an internal', () => {
  assert.deepEqual(docs().problems, [
    'projects/neat-ui/src/lib/view.ts:27: NeatView mentions `TONE_CLASSES`, which is not public',
    'projects/neat-ui/src/lib/view.ts:31: NeatView.size mentions `SIZE_STEPS`, which is not public',
    'projects/neat-ui/src/lib/view.ts:34: NeatView.bare has no doc comment',
    'projects/neat-ui/src/lib/view.ts:57: NeatBare has no doc comment',
  ]);
});

// --- generated modules, --check and determinism (review focus 4) ------------------------------

test('the generated modules are deterministic and type-check against the showcase schema', () => {
  const first = generate(SIGNALS).files;
  const second = generate(SIGNALS).files;
  assert.deepEqual([...first.keys()], [`${OUTPUT_DIR}/primary.ts`]);
  assert.deepEqual(first, second);
  const text = first.get(`${OUTPUT_DIR}/primary.ts`);
  assert.match(text, /^\/\/ Generated by `npm run docs:emit`\. Do not edit\.\n/);
  assert.match(text, /^export const API: DocsEntry = \{\n {2}"entry": "primary",$/m);
  assert.doesNotMatch(text, /\r|20\d\d-\d\d-\d\d/);

  // Every fixture's output against the real schema, under the showcase's own strictness.
  const root = mkdtempSync(join(tmpdir(), 'docs-emit-types-'));
  roots.push(root);
  write(root, MODEL, readFileSync(join(ROOT, MODEL), 'utf8'));
  const files = [];
  for (const kit of [SIGNALS, FORWARDED, KINDS, REEXPORTS, DOCS]) {
    for (const [path, content] of generate(kit).files) {
      const file = join(root, path.replace(/\.ts$/, `-${files.length}.ts`));
      write(root, file.slice(root.length + 1), content);
      files.push(file);
    }
  }
  const program = ts.createProgram(files, {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.Preserve,
    noPropertyAccessFromIndexSignature: true,
    exactOptionalPropertyTypes: true,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(
    diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
    [],
  );
});

test('--check lists files that differ, are missing or are extra, and doc problems', () => {
  const kit = kitWith({
    'src/public-api.ts': "export * from './lib/a';\n",
    'src/lib/a.ts': '/** A. */\nexport const NEAT_A = 1;\nexport const NEAT_B = 2;\n',
    'charts/src/public-api.ts': "export * from './lib/c';\n",
    'charts/src/lib/c.ts': '/** C. */\nexport const NEAT_C = 1;\n',
  });
  assert.deepEqual(checkDocs(kit).stale, [
    `${OUTPUT_DIR}/charts.ts is missing`,
    `${OUTPUT_DIR}/primary.ts is missing`,
  ]);

  writeDocs(kit);
  assert.deepEqual(checkDocs(kit), {
    stale: [],
    problems: ['projects/neat-ui/src/lib/a.ts:3: NEAT_B has no doc comment'],
  });

  write(kit, 'projects/neat-ui/src/lib/a.ts', '/** A, changed. */\nexport const NEAT_A = 1;\n');
  write(kit, `${OUTPUT_DIR}/video.ts`, 'export {};\n');
  const result = checkDocs(kit);
  assert.deepEqual(result, {
    stale: [`${OUTPUT_DIR}/primary.ts differs`, `${OUTPUT_DIR}/video.ts is not generated`],
    problems: [],
  });
  assert.deepEqual(checkReport(result), [
    'The committed API docs are stale; run `npm run docs:emit`:',
    `  - ${OUTPUT_DIR}/primary.ts differs`,
    `  - ${OUTPUT_DIR}/video.ts is not generated`,
  ]);

  writeDocs(kit);
  assert.deepEqual(checkDocs(kit), { stale: [], problems: [] });
  assert.deepEqual(checkReport({ stale: [], problems: [] }), []);
  assert.deepEqual(checkReport({ stale: [], problems: ['x.ts:1: NEAT_B has no doc comment'] }), [
    'Doc problems in the public API:',
    '  - x.ts:1: NEAT_B has no doc comment',
  ]);
});

// --- the kit itself ---------------------------------------------------------------------------

test('the committed API docs match the kit (run `npm run docs:emit` on failure)', () => {
  assert.deepEqual(checkDocs(ROOT).stale, []);
});

// Turns strict once the kit's doc pass has written the missing docs; until then it reports them
// without failing the run, so the list is visible in every test run.
test(
  'every public part and own input, model and output of the kit has a doc',
  {
    todo: 'the kit doc pass writes the docs still missing',
  },
  () => {
    assert.deepEqual(checkDocs(ROOT).problems, []);
  },
);
