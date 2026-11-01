import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import ts from 'typescript';
import {
  changesExamples,
  changesKit,
  checkDocs,
  checkReport,
  EXAMPLES_DIR,
  EXAMPLES_OUTPUT_DIR,
  extractExamples,
  extractKit,
  generate,
  highlight,
  highlightCss,
  OUTPUT_DIR,
  SHELL_EXTRA,
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
 * @if (ready) { <p>Ready</p> }
 * @for (row of rows; track row) { {{ row }} }
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
      // At column 0 these would read as tags if the fence were not tracked.
      '@if (ready) { <p>Ready</p> }',
      '@for (row of rows; track row) { {{ row }} }',
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
    'projects/neat-ui/src/lib/view.ts:29: NeatView mentions `TONE_CLASSES`, which is not public',
    'projects/neat-ui/src/lib/view.ts:33: NeatView.size mentions `SIZE_STEPS`, which is not public',
    'projects/neat-ui/src/lib/view.ts:36: NeatView.bare has no doc comment',
    'projects/neat-ui/src/lib/view.ts:59: NeatBare has no doc comment',
  ]);
});

// A tag on the comment's own opening line (`/** @internal x */`) is a tag, not body text.
const ONE_LINE = kitWith({
  'vendor/index.ts': `import { Directive, input } from '@angular/core';

@Directive({ selector: '[brnOne]' })
export class BrnOne {
  readonly size = input(1);
}
`,
  'src/public-api.ts': "export * from './lib/one';\n",
  'src/lib/one.ts': `import { Component, Directive, inject, input, TemplateRef } from '@angular/core';
import { BrnOne } from 'vendor';

/**
 * The prose of a one-line tag's class, indented @ text:
 *
 *   @if (x) { y }
 *
 * @input size Steps, from the class's own tag lines.
 */
@Directive({ selector: '[neatTagged]', hostDirectives: [{ directive: BrnOne, inputs: ['size'] }] })
export class NeatTagged {}

/** A view. */
@Component({ selector: 'neat-one', template: '' })
export class NeatOne {
  /** @internal Read by the host only. */
  readonly template = inject(TemplateRef);
  /** @deprecated Use \`tone\`. */
  readonly colour = input('neutral');
  /** The tone. */
  readonly tone = input('neutral');
  /** @unknown Not a tag the docs know. */
  readonly odd = input(0);
}
`,
});
const oneLine = once(() => extractKit(ONE_LINE));
const one = () => partOf(oneLine(), 'primary', 'NeatOne');

test('a tag alone on a one-line doc comment is read as a tag: @internal hides the member', () => {
  assert.equal(
    one().properties?.some((m) => m.name === 'template'),
    undefined,
  );
  assert.equal(
    JSON.stringify(one()).includes('Read by the host only'),
    false,
    'its text must not become body text',
  );
});

test('a one-line @deprecated is the deprecation, not the body; an unknown one-line tag is a problem', () => {
  const colour = one().inputs.find((m) => m.name === 'colour');
  assert.deepEqual(colour.doc, []);
  assert.deepEqual(colour.deprecated, [
    {
      kind: 'paragraph',
      spans: [
        { kind: 'text', text: 'Use ' },
        { kind: 'code', text: 'tone' },
        { kind: 'text', text: '.' },
      ],
    },
  ]);
  assert.ok(
    oneLine().problems.some((p) =>
      /one\.ts:\d+: NeatOne\.odd has the unknown tag @unknown/.test(p),
    ),
    oneLine().problems.join('\n'),
  );
});

test('only the opening line is stripped: an indented @ line further down stays prose', () => {
  const tagged = partOf(oneLine(), 'primary', 'NeatTagged');
  assert.equal(JSON.stringify(tagged.doc).includes('@if (x) { y }'), true);
  assert.deepEqual(tagged.inputs[0].doc, plain("Steps, from the class's own tag lines."));
});

test('a one-line @input tag documents the forwarded input', () => {
  const kit = kitWith({
    'vendor/index.ts': `import { Directive, input } from '@angular/core';

@Directive({ selector: '[brnOne]' })
export class BrnOne {
  readonly size = input(1);
}
`,
    'src/public-api.ts': "export * from './lib/one';\n",
    'src/lib/one.ts': `import { Directive } from '@angular/core';
import { BrnOne } from 'vendor';

/** @input size Steps. */
@Directive({ selector: '[neatOne]', hostDirectives: [{ directive: BrnOne, inputs: ['size'] }] })
export class NeatOne {}
`,
  });
  const result = extractKit(kit);
  assert.deepEqual(partOf(result, 'primary', 'NeatOne').inputs[0].doc, plain('Steps.'));
  assert.ok(
    !result.problems.some((p) => /no `@input size` tag/.test(p)),
    result.problems.join('\n'),
  );
});

// --- what --watch reacts to ---------------------------------------------------------------------

test('the watch reacts to the kit and example sources, and to example stylesheets', () => {
  assert.equal(changesKit('collapsible/src/lib/collapsible.ts'), true);
  assert.equal(changesKit('collapsible/src/lib/collapsible.spec.ts'), false);
  assert.equal(changesKit('collapsible/src/lib/collapsible.html'), false);
  assert.equal(changesExamples('examples/time-chart/chart-card.css'), true);
  assert.equal(changesExamples('examples/time-chart/data.ts'), true);
  // The shell's own source is one more example of its topic.
  assert.equal(changesExamples('app.ts'), true);
  assert.equal(changesExamples('app.config.ts'), false);
  assert.equal(changesExamples('examples/time-chart/data.spec.ts'), false);
  // Not the generated modules beside the examples, nor a stylesheet of the app.
  assert.equal(changesExamples('docs/generated/examples/time-chart.ts'), false);
  assert.equal(changesExamples('styles.css'), false);
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
  // The schema imports Angular's `Type`.
  symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');
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
    'The committed docs are stale; run `npm run docs:emit`:',
    `  - ${OUTPUT_DIR}/primary.ts differs`,
    `  - ${OUTPUT_DIR}/video.ts is not generated`,
  ]);

  writeDocs(kit);
  assert.deepEqual(checkDocs(kit), { stale: [], problems: [] });
  assert.deepEqual(checkReport({ stale: [], problems: [] }), []);
  assert.deepEqual(checkReport({ stale: [], problems: ['x.ts:1: NEAT_B has no doc comment'] }), [
    'Doc problems:',
    '  - x.ts:1: NEAT_B has no doc comment',
  ]);
});

// --- examples and their snippets (review focus 5) --------------------------------------------

/** Source text from lines, with the final newline a file has. */
const source = (...lines) => `${lines.join('\n')}\n`;
/** What a snippet's tokens spell. */
const spelled = (tokens) => tokens.map(([, text]) => text).join('');
/** A component file the examples tests need no more of than its class and caption. */
const component = (name, caption = 'A caption.') =>
  source(
    `/** ${caption} */`,
    "@Component({ selector: 'app-x', template: '' })",
    `export class ${name} {}`,
  );

const CAPTION = [
  '/**',
  ' * The six tones, the words carrying the state. `NeatStatusChip` takes `tone`, and',
  ' * **`NeatTone`** names them.',
  ' */',
];
const TONES = source(
  "import { ChangeDetectionStrategy, Component } from '@angular/core';",
  "import type { NeatTone } from '@sima/neat-ui';",
  "import { NeatStatusChip } from '@sima/neat-ui/status-chip';",
  '',
  ...CAPTION,
  '@Component({',
  "  selector: 'app-status-chip-tones',",
  '  imports: [NeatStatusChip],',
  '  changeDetection: ChangeDetectionStrategy.OnPush,',
  '  template: `',
  '    @for (tone of tones; track tone) {',
  '      <neat-status-chip [tone]="tone">{{ tone }}</neat-status-chip>',
  '    }',
  '  `,',
  '})',
  'export class StatusChipTones {',
  "  // The order is the design's.",
  "  protected readonly tones: readonly NeatTone[] = ['neutral', 'danger'];",
  '}',
);
const SIZES = source(
  "import { Component } from '@angular/core';",
  "import { NeatStatusChip as Chip } from '@sima/neat-ui/status-chip';",
  "import { SIZES } from './sizes-data';",
  '',
  '/** Both sizes. */',
  "@Component({ selector: 'app-sizes', imports: [Chip], template: '' })",
  'export class Sizes {',
  '  protected readonly sizes = SIZES;',
  '}',
);
const SIZES_DATA = source(
  "import type { Size } from './shapes';",
  '',
  "export const SIZES: readonly Size[] = ['sm', 'md'];",
);
const SHAPES = source("export type Size = 'sm' | 'md';");

const EXAMPLE_KIT = {
  'src/public-api.ts': "export * from './lib/tone';\n",
  'src/lib/tone.ts': "/** A tone. */\nexport type NeatTone = 'neutral' | 'danger';\n",
  'status-chip/src/public-api.ts': "export * from './lib/chip';\n",
  'status-chip/src/lib/chip.ts': source(
    "import { Component, input } from '@angular/core';",
    '',
    '/** A chip. */',
    "@Component({ selector: 'neat-status-chip', template: '' })",
    'export class NeatStatusChip {',
    '  /** The tone. */',
    "  readonly tone = input('neutral');",
    '}',
  ),
};

/** The fixture kit with `examples` (paths under the showcase's examples folder) beside it. */
function kitWithExamples(examples) {
  const root = kitWith(EXAMPLE_KIT);
  for (const [path, content] of Object.entries(examples)) {
    write(root, `${EXAMPLES_DIR}/${path}`, content);
  }
  return root;
}

const EXAMPLES = kitWithExamples({
  'status-chip/2-sizes.example.ts': SIZES,
  'status-chip/1-tones.example.ts': TONES,
  'status-chip/sizes-data.ts': SIZES_DATA,
  'status-chip/shapes.ts': SHAPES,
  'status-chip/notes.txt': 'not a source',
});
const examples = once(() => extractExamples(EXAMPLES));
const chipExamples = () => examples().topics.find((t) => t.topic === 'status-chip').examples;
const example = (id) => chipExamples().find((e) => e.id === id);

test('an example is its file: id without the numeric prefix, in file-name order, with its title', () => {
  assert.deepEqual(examples().problems, []);
  assert.deepEqual(
    examples().topics.map((t) => t.topic),
    ['status-chip'],
  );
  assert.deepEqual(
    chipExamples().map((e) => [e.id, e.component, e.title]),
    [
      ['tones', 'StatusChipTones', 'Status chip tones'],
      ['sizes', 'Sizes', 'Sizes'],
    ],
  );
  assert.deepEqual(
    chipExamples().map((e) => e.files[0].name),
    ['1-tones.example.ts', '2-sizes.example.ts'],
  );
});

test('a numeric prefix orders the examples as a number: 2 before 10', () => {
  const kit = kitWithExamples({
    'roi/10-last.example.ts': component('Last'),
    'roi/2-second.example.ts': component('Second'),
    'roi/1-first.example.ts': component('First'),
    'roi/b-plain.example.ts': component('Plain'),
    'roi/a-plain.example.ts': component('Other'),
  });
  const { topics, problems } = extractExamples(kit);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    topics[0].examples.map((e) => e.id),
    ['first', 'second', 'last', 'a-plain', 'b-plain'],
  );
});

test('the title is the class name in words, an acronym kept', () => {
  const kit = kitWithExamples({
    'roi/a.example.ts': component('ROIEditorBasics'),
    'roi/b.example.ts': component('MessagingPipeline'),
    'roi/c.example.ts': component('Grid2x2Layout'),
  });
  const { topics, problems } = extractExamples(kit);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    topics[0].examples.map((e) => e.title),
    ['ROI editor basics', 'Messaging pipeline', 'Grid2x2 layout'],
  );
});

test("the class's doc is the caption as blocks, references resolved, and not in the snippet", () => {
  assert.deepEqual(example('tones').caption, [
    {
      kind: 'paragraph',
      spans: [
        { kind: 'text', text: 'The six tones, the words carrying the state. ' },
        { kind: 'ref', text: 'NeatStatusChip', name: 'NeatStatusChip' },
        { kind: 'text', text: ' takes ' },
        { kind: 'code', text: 'tone' },
        { kind: 'text', text: ', and ' },
        { kind: 'ref', text: 'NeatTone', name: 'NeatTone', strong: true },
        { kind: 'text', text: ' names them.' },
      ],
    },
  ]);
  assert.deepEqual(example('sizes').caption, plain('Both sizes.'));
});

test('`shows` lists what the file imports from the kit, as import path and name', () => {
  assert.deepEqual(example('tones').shows, [
    '@sima/neat-ui#NeatTone',
    '@sima/neat-ui/status-chip#NeatStatusChip',
  ]);
  // The name is the kit's, not the file's alias; Angular and side-effect imports show nothing.
  assert.deepEqual(example('sizes').shows, ['@sima/neat-ui/status-chip#NeatStatusChip']);
});

test('the snippet is the file as written, less the caption comment', () => {
  const [file] = example('tones').files;
  const caption = `${CAPTION.join('\n')}\n`;
  assert.ok(TONES.includes(`\n${caption}@Component`));
  // Nothing else differs: put the caption back and the file is the file, byte for byte.
  assert.equal(spelled(file.code).replace('\n@Component', `\n${caption}@Component`), TONES);
  assert.doesNotMatch(spelled(file.code), /six tones/);
});

test('a file that imports a data file of its folder carries it, and what it imports, as extras', () => {
  const sizes = example('sizes');
  assert.deepEqual(
    sizes.files.map((f) => f.name),
    ['2-sizes.example.ts', 'sizes-data.ts', 'shapes.ts'],
  );
  // The extras are exactly their files.
  assert.equal(spelled(sizes.files[1].code), SIZES_DATA);
  assert.equal(spelled(sizes.files[2].code), SHAPES);
  // An example that imports nothing relative has no extras.
  assert.deepEqual(
    example('tones').files.map((f) => f.name),
    ['1-tones.example.ts'],
  );
});

test('the stylesheets a component names are extras after its imports, once each, as comments and text', () => {
  const css = source('/* The card. */', '.card {', '  content: "in";', '}');
  const kit = kitWithExamples({
    'a/one.example.ts': source(
      "import { d } from './data';",
      '/** One. */',
      "@Component({ selector: 'app-one', template: '', styleUrl: './one.example.css' })",
      'export class One {}',
    ),
    'a/two.example.ts': source(
      '/** Two. */',
      "@Component({ selector: 'app-two', template: '', styleUrls: ['./shared/card.css', './one.example.css'] })",
      'export class Two {}',
    ),
    'a/data.ts': 'export const d = 1;\n',
    'a/one.example.css': 'p {}\n',
    'a/shared/card.css': css,
  });
  const { topics, problems } = extractExamples(kit);
  assert.deepEqual(problems, []);
  const [one, two] = topics[0].examples;
  assert.deepEqual(
    one.files.map((f) => f.name),
    ['one.example.ts', 'data.ts', 'one.example.css'],
  );
  assert.deepEqual(
    two.files.map((f) => f.name),
    ['two.example.ts', 'shared/card.css', 'one.example.css'],
  );
  assert.equal(spelled(two.files[1].code), css);
  // A property named like a keyword is no keyword in a stylesheet.
  assert.deepEqual(two.files[1].code, [
    ['comment', '/* The card. */'],
    ['text', '\n.card {\n  content: "in";\n}\n'],
  ]);
});

test('a stylesheet that is no file of the topic folder is a problem', () => {
  const kit = kitWithExamples({
    'a/gone.example.ts': source(
      '/** Gone. */',
      "@Component({ selector: 'app-gone', template: '', styleUrl: './gone.css' })",
      'export class Gone {}',
    ),
    'a/out.example.ts': source(
      '/** Out. */',
      "@Component({ selector: 'app-out', template: '', styleUrl: '../b/out.css' })",
      'export class Out {}',
    ),
    'b/out.css': 'p {}\n',
  });
  assert.deepEqual(extractExamples(kit).problems, [
    `${EXAMPLES_DIR}/a/gone.example.ts:2: names the stylesheet './gone.css', which is no file of its topic folder`,
    `${EXAMPLES_DIR}/a/out.example.ts:2: names the stylesheet '../b/out.css', which is no file of its topic folder`,
  ]);
});

test('stylesheet highlighting spells the text again, with no run empty', () => {
  assert.deepEqual(highlightCss(''), []);
  assert.deepEqual(highlightCss('/* a */'), [['comment', '/* a */']]);
  const text = '/* a */\n/* b */\np { color: red; }\n/* c */';
  assert.equal(
    highlightCss(text)
      .map(([, t]) => t)
      .join(''),
    text,
  );
  assert.deepEqual(
    highlightCss(text).map(([k]) => k),
    ['comment', 'text', 'comment', 'text', 'comment'],
  );
});

test('an example with no caption, a bad class or a bad relative import is a problem', () => {
  const kit = kitWithExamples({
    'a/none.example.ts': source('@Component({})', 'export class None {}'),
    'a/two.example.ts': source(
      '/** Two. */',
      '@Component({})',
      'export class One {}',
      'export class Two {}',
    ),
    'a/zero.example.ts': source('/** Zero. */', 'class Hidden {}'),
    'a/plain.example.ts': source('/** Plain. */', 'export class Plain {}'),
    'a/tagged.example.ts': source(
      '/**',
      ' * Tagged.',
      ' * @internal',
      ' */',
      '@Component({})',
      'export class Tagged {}',
    ),
    'a/lost.example.ts': source("import { x } from './missing';", component('Lost')),
    'a/out.example.ts': source("import { y } from '../b/data';", component('Out')),
    'a/other.example.ts': source("import { Fine } from './fine.example';", component('Other')),
    'a/fine.example.ts': component('Fine'),
    'a/data.ts': source("import { z } from './gone';", 'export const d = 1;'),
    'a/uses-data.example.ts': source("import { d } from './data';", component('UsesData')),
    'b/data.ts': 'export const y = 1;\n',
    'b/b.example.ts': component('Same'),
    'b/c.example.ts': component('Same'),
    'b/1-d.example.ts': component('D1'),
    'b/d.example.ts': component('D2'),
  });
  const { problems } = extractExamples(kit);
  const base = EXAMPLES_DIR;
  assert.deepEqual(problems, [
    `${base}/a/data.ts:1: imports './gone', which is no file of its topic folder`,
    `${base}/a/lost.example.ts:1: imports './missing', which is no file of its topic folder`,
    `${base}/a/none.example.ts:2: None has no caption: write its doc comment`,
    `${base}/a/other.example.ts:1: imports './fine.example', which is another example`,
    `${base}/a/out.example.ts:1: imports '../b/data', which is no file of its topic folder`,
    `${base}/a/plain.example.ts:2: Plain is not a component`,
    `${base}/a/tagged.example.ts:6: Tagged's doc has the tag @internal; an example's doc is its caption`,
    `${base}/a/two.example.ts:4: has more than one exported class; an example is one component`,
    `${base}/a/zero.example.ts:2: has no exported class; an example is one component`,
    `${base}/b/c.example.ts:3: Same is already an example of this topic (b.example.ts)`,
    `${base}/b/d.example.ts:3: the id d is already an example of this topic (1-d.example.ts)`,
  ]);
});

// --- the caption check ----------------------------------------------------------------------

test('a caption that names a non-public kit name, as a code span or a bare word, is a problem', () => {
  const kit = kitWith({
    ...EXAMPLE_KIT,
    'src/lib/tone.ts': source(
      '/** A tone. */',
      "export type NeatTone = 'neutral' | 'danger';",
      '/** Shared with the entries. */',
      'export const ɵshared = 1;',
      'const TONE_CLASSES = {};',
      'function packTiles() {}',
    ),
  });
  write(
    kit,
    `${EXAMPLES_DIR}/a/leaky.example.ts`,
    source(
      '/**',
      ' * Reads `TONE_CLASSES` and `ɵshared`, and calls packTiles on the way.',
      ' * - A list item names `TONE_CLASSES.neutral` too.',
      ' */',
      "@Component({ selector: 'app-leaky', template: '' })",
      'export class Leaky {}',
    ),
  );
  write(
    kit,
    `${EXAMPLES_DIR}/a/clean.example.ts`,
    source(
      '/** Takes `tone`, the `NeatTone` and `NeatStatusChip.tone`, which are public, and a plain word. */',
      "@Component({ selector: 'app-clean', template: '' })",
      'export class Clean {}',
    ),
  );
  assert.deepEqual(extractExamples(kit).problems, [
    `${EXAMPLES_DIR}/a/leaky.example.ts:6: Leaky's caption mentions \`TONE_CLASSES\`, which is not public`,
    `${EXAMPLES_DIR}/a/leaky.example.ts:6: Leaky's caption mentions \`ɵshared\`, which is not public`,
    `${EXAMPLES_DIR}/a/leaky.example.ts:6: Leaky's caption mentions \`packTiles\`, which is not public`,
    `${EXAMPLES_DIR}/a/leaky.example.ts:6: Leaky's caption mentions \`TONE_CLASSES.neutral\`, which is not public`,
  ]);
});

test('a caption naming a member of a public part passes, as a part doc does', () => {
  // `along` is also an internal function's name, but the note's own public input here.
  const kit = kitWith({
    ...EXAMPLE_KIT,
    'src/lib/tone.ts': source(
      '/** A tone. */',
      "export type NeatTone = 'neutral' | 'danger';",
      'function along() {}',
    ),
    'status-chip/src/lib/chip.ts': source(
      "import { Component, input } from '@angular/core';",
      '',
      '/** A chip. */',
      "@Component({ selector: 'neat-status-chip', template: '' })",
      'export class NeatStatusChip {',
      '  /** Where it sits. */',
      "  readonly along = input('x');",
      '}',
    ),
  });
  write(kit, `${EXAMPLES_DIR}/a/x.example.ts`, component('X', 'Sets `along`.'));
  assert.deepEqual(extractExamples(kit).problems, []);
});

// --- the shell's extra example ------------------------------------------------------------------

const APP_SOURCE = source(
  "import { Component } from '@angular/core';",
  "import { RouterOutlet } from '@angular/router';",
  "import { NeatShell } from '@sima/neat-ui';",
  "import { NeatStatusChip } from '@sima/neat-ui/status-chip';",
  "import { GROUPS } from './docs/topics';",
  '',
  '/**',
  ' * The root: `NeatShell` with the docs in its rail.',
  ' */',
  "@Component({ selector: 'app-root', imports: [NeatShell, NeatStatusChip, RouterOutlet], template: '' })",
  'export class App {',
  '  protected readonly groups = GROUPS;',
  '}',
);
const SHELL_APP = `projects/showcase/src/app/${SHELL_EXTRA.file}`;

/** The fixture kit with the shell topic's folder, and the showcase's app.ts. */
function kitWithShell(app = APP_SOURCE, topics = { 'shell/1-rail.example.ts': component('Rail') }) {
  const kit = kitWithExamples(topics);
  if (app !== null) write(kit, SHELL_APP, app);
  return kit;
}

test("the showcase's app.ts is one more example of the shell topic: code only, no component", () => {
  const { topics, problems } = extractExamples(kitWithShell());
  assert.deepEqual(problems, []);
  const shell = topics.find((t) => t.topic === SHELL_EXTRA.topic);
  assert.deepEqual(
    shell.examples.map((e) => [e.id, e.title]),
    [
      ['rail', 'Rail'],
      [SHELL_EXTRA.id, "The showcase's shell"],
    ],
  );
  const app = shell.examples[1];
  // The class doc is the caption, as an example's is, and the file the snippet less it.
  assert.deepEqual(app.caption, [
    {
      kind: 'paragraph',
      spans: [
        { kind: 'text', text: 'The root: ' },
        { kind: 'code', text: 'NeatShell' },
        { kind: 'text', text: ' with the docs in its rail.' },
      ],
    },
  ]);
  assert.deepEqual(app.shows, [
    '@sima/neat-ui#NeatShell',
    '@sima/neat-ui/status-chip#NeatStatusChip',
  ]);
  assert.equal(app.component, undefined);
  // Only app.ts: its relative imports are the showcase's own, not files of a topic folder.
  assert.deepEqual(
    app.files.map((f) => f.name),
    ['app.ts'],
  );
  assert.equal(
    spelled(app.files[0].code),
    APP_SOURCE.replace(/\/\*\*\n \* The root.*\n \*\/\n/, ''),
  );
});

test('the shell module renders the extra with no component and no import of app.ts', () => {
  const { files } = generate(kitWithShell());
  const text = files.get(`${EXAMPLES_OUTPUT_DIR}/shell.ts`);
  assert.match(
    text,
    /^import \{ Rail \} from '\.\.\/\.\.\/\.\.\/examples\/shell\/1-rail\.example';$/m,
  );
  assert.doesNotMatch(text, /app'/);
  assert.match(text, /"id": "app"/);
  assert.equal(text.match(/"component":/g).length, 1);
  assert.ok(text.indexOf('"id": "rail"') < text.indexOf('"id": "app"'));
});

test('without an examples folder for the shell topic the extra writes no module and no problem', () => {
  const kit = kitWithShell(APP_SOURCE, { 'status-chip/x.example.ts': component('X') });
  const { files, problems } = generate(kit);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    [...files.keys()].filter((p) => p.startsWith(EXAMPLES_OUTPUT_DIR)),
    [`${EXAMPLES_OUTPUT_DIR}/status-chip.ts`],
  );
  // No examples at all: as before.
  const bare = kitWith({ ...EXAMPLE_KIT });
  write(bare, SHELL_APP, APP_SOURCE);
  assert.deepEqual(extractExamples(bare), { topics: [], problems: [] });
});

test('the extra is held to what an example is: one component with a caption, public names only', () => {
  const noCaption = APP_SOURCE.replace(/\/\*\*\n \* The root.*\n \*\/\n/, '');
  assert.deepEqual(extractExamples(kitWithShell(noCaption)).problems, [
    `${SHELL_APP}:8: App has no caption: write its doc comment`,
  ]);
  const hidden = kitWith({
    ...EXAMPLE_KIT,
    'src/lib/tone.ts': "/** A tone. */\nexport type NeatTone = 'a';\nconst SHELL_GAP = 1;\n",
  });
  write(hidden, `${EXAMPLES_DIR}/shell/x.example.ts`, component('X'));
  write(hidden, SHELL_APP, APP_SOURCE.replace('with the docs', 'with `SHELL_GAP`'));
  assert.deepEqual(extractExamples(hidden).problems, [
    `${SHELL_APP}:11: App's caption mentions \`SHELL_GAP\`, which is not public`,
  ]);
  // The topic is there and its extra is not: a renamed file must not drop out unnoticed.
  assert.deepEqual(extractExamples(kitWithShell(null)).problems, [
    `${SHELL_APP}:1: is the ${SHELL_EXTRA.topic} topic's extra example and does not exist`,
  ]);
});

test('highlighting is lossless: keywords, strings, comments, and a template string as one run', () => {
  const tokens = highlight(TONES);
  assert.equal(spelled(tokens), TONES);
  const of = (kind) => tokens.filter(([k]) => k === kind).map(([, t]) => t);
  assert.ok(of('keyword').includes('import'));
  assert.ok(of('keyword').includes('readonly'));
  assert.ok(of('string').includes("'@angular/core'"));
  assert.deepEqual(of('comment'), [CAPTION.join('\n'), "// The order is the design's."]);
  // The Angular template, control flow and bindings included, is a single run.
  const template = of('string').find((t) => t.startsWith('`'));
  assert.match(
    template,
    /^`\n {4}@for \(tone of tones; track tone\) \{\n[\s\S]*\{\{ tone \}\}[\s\S]*\n {2}`$/,
  );
  // Neighbours never share a kind, so runs are as long as they can be.
  tokens.slice(1).forEach(([kind], i) => assert.notEqual(kind, tokens[i][0]));
});

test('highlighting keeps nested template strings and braces in one run, and names after a dot plain', () => {
  const text = source(
    'const row = `a ${ items.map((i) => `<${i}>`).join("") } b ${ { k: 1 }.k } c`;',
    'const t = obj.type;',
    'const o = { type: 1, from: 2 };',
    '/* block',
    '   comment */ let last = 1; // tail',
  );
  const tokens = highlight(text);
  assert.equal(spelled(tokens), text);
  assert.deepEqual(
    tokens.filter(([k]) => k === 'string').map(([, t]) => t),
    ['`a ${ items.map((i) => `<${i}>`).join("") } b ${ { k: 1 }.k } c`'],
  );
  const keywords = tokens.filter(([k]) => k === 'keyword').map(([, t]) => t);
  assert.deepEqual(keywords, ['const', 'const', 'const', 'let']);
  assert.deepEqual(
    tokens.filter(([k]) => k === 'comment').map(([, t]) => t),
    ['/* block\n   comment */', '// tail'],
  );
});

test('the examples module imports each component beside its data, in order, and is deterministic', () => {
  const { files } = generate(EXAMPLES);
  const path = `${EXAMPLES_OUTPUT_DIR}/status-chip.ts`;
  assert.deepEqual(
    [...files.keys()].filter((p) => p.startsWith(EXAMPLES_OUTPUT_DIR)),
    [path],
  );
  assert.deepEqual(files, generate(EXAMPLES).files);
  const text = files.get(path);
  assert.match(text, /^\/\/ Generated by `npm run docs:emit`\. Do not edit\.\n/);
  assert.match(text, /^import type \{ DocsExample \} from '\.\.\/\.\.\/model';$/m);
  assert.match(
    text,
    /^import \{ StatusChipTones \} from '\.\.\/\.\.\/\.\.\/examples\/status-chip\/1-tones\.example';$/m,
  );
  assert.match(text, /^export const EXAMPLES: readonly DocsExample\[\] = \[$/m);
  assert.ok(text.indexOf('"id": "tones"') < text.indexOf('"id": "sizes"'));
  assert.match(text, /^ {4}"component": StatusChipTones,$/m);
  assert.doesNotMatch(text, /\r|20\d\d-\d\d-\d\d/);
});

test('every example module type-checks against the schema, its component a Type', () => {
  const root = kitWithExamples({
    'status-chip/1-tones.example.ts': TONES,
    'status-chip/2-sizes.example.ts': SIZES,
    'status-chip/sizes-data.ts': SIZES_DATA,
    'status-chip/shapes.ts': SHAPES,
    'other/x.example.ts': component('X'),
    'shell/x.example.ts': component('Rail'),
  });
  write(root, SHELL_APP, APP_SOURCE);
  write(root, MODEL, readFileSync(join(ROOT, MODEL), 'utf8'));
  writeDocs(root);
  const read = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(read.config, ts.sys, root).options;
  const generated = ['status-chip', 'other', 'shell'].map((t) =>
    join(root, EXAMPLES_OUTPUT_DIR, `${t}.ts`),
  );
  const program = ts.createProgram(generated, {
    ...options,
    noEmit: true,
    noPropertyAccessFromIndexSignature: true,
    exactOptionalPropertyTypes: true,
  });
  // The examples' own files are the showcase build's to check; the modules are what is ours.
  const own = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file && d.file.fileName.includes(`${EXAMPLES_OUTPUT_DIR}/`));
  assert.deepEqual(
    own.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
    [],
  );
  assert.ok(generated.every((file) => program.getSourceFile(file)));
});

test('--check finds a stale, missing or extra examples module, and an edited example', () => {
  const kit = kitWithExamples({
    'status-chip/1-tones.example.ts': TONES,
    'other/x.example.ts': component('X'),
  });
  const module = (topic) => `${EXAMPLES_OUTPUT_DIR}/${topic}.ts`;
  assert.deepEqual(checkDocs(kit).stale, [
    `${OUTPUT_DIR}/primary.ts is missing`,
    `${OUTPUT_DIR}/status-chip.ts is missing`,
    `${module('other')} is missing`,
    `${module('status-chip')} is missing`,
  ]);

  writeDocs(kit);
  assert.deepEqual(checkDocs(kit), { stale: [], problems: [] });

  // The drift this guards: the example changes, the committed snippet does not.
  write(kit, `${EXAMPLES_DIR}/status-chip/1-tones.example.ts`, `${TONES}// edited\n`);
  assert.deepEqual(checkDocs(kit).stale, [`${module('status-chip')} differs`]);
  writeDocs(kit);

  // A removed topic leaves its module behind, extra.
  rmSync(join(kit, EXAMPLES_DIR, 'other'), { recursive: true });
  assert.deepEqual(checkDocs(kit).stale, [`${module('other')} is not generated`]);
  const { removed } = writeDocs(kit);
  assert.deepEqual(removed, [module('other')]);
  assert.deepEqual(checkDocs(kit).stale, []);

  // An example's problems are listed with the doc problems, and `--check` fails on them.
  const bare = `${EXAMPLES_DIR}/status-chip/2-bare.example.ts`;
  write(kit, bare, source('@Component({})', 'export class Bare {}'));
  const result = checkDocs(kit);
  assert.deepEqual(result.problems, [`${bare}:2: Bare has no caption: write its doc comment`]);
  assert.deepEqual(checkReport({ stale: [], problems: result.problems }), [
    'Doc problems:',
    `  - ${result.problems[0]}`,
  ]);
});

test('a kit with no examples folder writes no examples modules', () => {
  const kit = kitWith(EXAMPLE_KIT);
  assert.deepEqual(
    [...generate(kit).files.keys()].filter((p) => p.startsWith(EXAMPLES_OUTPUT_DIR)),
    [],
  );
  assert.deepEqual(extractExamples(kit), { topics: [], problems: [] });

  // The last topic gone, its folder of modules goes too, so the tree is as a fresh checkout's.
  write(kit, `${EXAMPLES_DIR}/a/x.example.ts`, component('X'));
  writeDocs(kit);
  assert.ok(existsSync(join(kit, EXAMPLES_OUTPUT_DIR)));
  rmSync(join(kit, EXAMPLES_DIR), { recursive: true });
  writeDocs(kit);
  assert.ok(!existsSync(join(kit, EXAMPLES_OUTPUT_DIR)));
});

// --- the kit itself ---------------------------------------------------------------------------

test('the committed docs match the kit and the examples (run `npm run docs:emit` on failure)', () => {
  assert.deepEqual(checkDocs(ROOT).stale, []);
});

test('every public part and own input, model and output of the kit has a doc', () => {
  assert.deepEqual(checkDocs(ROOT).problems, []);
});

// A spec is bundled statically, so the showcase's smoke test lists the modules it renders by hand;
// this keeps that list to the modules on disk, a new entry's included.
test("the showcase specs' list of API modules (docs.testing.ts) has every generated one", () => {
  const dir = join(ROOT, 'projects/showcase/src/app/docs/generated/api');
  const onDisk = readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => file.slice(0, -'.ts'.length))
    .sort();
  const spec = readFileSync(join(ROOT, 'projects/showcase/src/app/docs/docs.testing.ts'), 'utf8');
  const imported = [...spec.matchAll(/from '\.\/generated\/api\/([\w-]+)'/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(imported, onDisk);
});

test('every generated examples module is loaded by a topic of the showcase, and every topic has one', () => {
  const onDisk = readdirSync(join(ROOT, EXAMPLES_OUTPUT_DIR))
    .filter((file) => file.endsWith('.ts'))
    .map((file) => file.slice(0, -'.ts'.length))
    .sort();
  const topics = readFileSync(join(ROOT, 'projects/showcase/src/app/docs/topics.ts'), 'utf8');
  const loaded = [...topics.matchAll(/import\('\.\/generated\/examples\/([\w-]+)'\)/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(loaded, onDisk);
});
