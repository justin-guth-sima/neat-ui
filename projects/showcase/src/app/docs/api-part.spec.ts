import { TestBed } from '@angular/core/testing';
import { ApiPart } from './api-part';
import { typeParameters } from './display';
import { API as CALLOUT } from './generated/api/callout';
import { API as CHARTS } from './generated/api/charts';
import { API as COLLAPSIBLE } from './generated/api/collapsible';
import { API as CONFIRM } from './generated/api/confirm';
import { API as DETAILS } from './generated/api/details';
import { API as DIAGRAM } from './generated/api/diagram';
import { API as DIALOG } from './generated/api/dialog';
import { API as DROP_ZONE } from './generated/api/drop-zone';
import { API as FIELD } from './generated/api/field';
import { API as FILE_BROWSER } from './generated/api/file-browser';
import { API as INPUT } from './generated/api/input';
import { API as LEVEL_METER } from './generated/api/level-meter';
import { API as LINE_LIST } from './generated/api/line-list';
import { API as NUMBER_FIELD } from './generated/api/number-field';
import { API as POPOVER } from './generated/api/popover';
import { API as PRIMARY } from './generated/api/primary';
import { API as PROGRESS } from './generated/api/progress';
import { API as SEGMENTED } from './generated/api/segmented';
import { API as SELECT_LIST } from './generated/api/select-list';
import { API as SELECT } from './generated/api/select';
import { API as SLIDER } from './generated/api/slider';
import { API as STATUS_CHIP } from './generated/api/status-chip';
import { API as SWITCH } from './generated/api/switch';
import { API as TABLE } from './generated/api/table';
import { API as TABS } from './generated/api/tabs';
import { API as TOAST } from './generated/api/toast';
import { API as VIDEO } from './generated/api/video';
import type { DocBlock, DocsDeclaredPart, DocsEntry, DocsMember } from './model';
import { FakeDocs, provideFakeDocs } from './docs.testing';

const words = (text: string): DocBlock[] => [
  { kind: 'paragraph', spans: [{ kind: 'text', text }] },
];
const member = (name: string, fields: Partial<DocsMember> = {}): DocsMember => ({
  name,
  type: 'string',
  doc: words(`About ${name}.`),
  ...fields,
});
const SOURCE = 'projects/neat-ui/x/src/lib/x.ts';

const LISTBOX: DocsDeclaredPart = {
  name: 'NeatSelect',
  kind: 'component',
  typeParameters: ['T'],
  selector: 'neat-select',
  exportAs: 'neatSelect',
  doc: words('A labelled listbox.'),
  source: SOURCE,
  inputs: [
    member('options', { type: 'readonly NeatSelectOption<T>[]', required: true }),
    member('placeholder', { default: "'Choose'" }),
    member('describedBy'),
    member('compact', { type: 'boolean', default: 'false', transform: 'booleanAttribute' }),
    member('delay', { type: 'number', transform: 'toMs', accepts: 'number | string' }),
  ],
  models: [member('value', { type: 'T', required: true })],
  outputs: [member('opened', { type: 'void' })],
  methods: [
    {
      name: 'focus',
      signature: 'focus(): void\nfocus(options: FocusOptions): void',
      doc: words('Focuses it.'),
    },
  ],
  properties: [member('open', { type: 'Signal<boolean>' })],
};

/** An element's text, its whitespace runs as one space. */
const text = (element: Element | null): string =>
  element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/** A member's line as read: the texts of its parts (name, type, notes), a space apart. */
const line = (member: Element): string =>
  Array.from(member.querySelector('.line')?.children ?? [], text)
    .filter(Boolean)
    .join(' ');

async function render(part: DocsDeclaredPart, docs = new FakeDocs(), intro = false) {
  TestBed.configureTestingModule({ providers: provideFakeDocs(docs) });
  const fixture = TestBed.createComponent(ApiPart);
  fixture.componentRef.setInput('part', part);
  fixture.componentRef.setInput('intro', intro);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const rows = (title: string): string[] => {
    const heading = Array.from(host.querySelectorAll('h4')).find((h) => h.textContent === title);
    const found: string[] = [];
    for (let next = heading?.nextElementSibling; next?.tagName === 'APP-API-MEMBER';) {
      found.push(line(next));
      next = next.nextElementSibling;
    }
    return found;
  };
  return { fixture, host, rows };
}

describe('ApiPart', () => {
  it('heads a class with its name, type parameters, kind, selector and exportAs', async () => {
    const { host } = await render(LISTBOX);

    expect(host.id).toBe('api-NeatSelect');
    expect(host.querySelector('h3')?.textContent?.trim()).toBe('NeatSelect<T>');
    expect(host.querySelector('h3')?.getAttribute('tabindex')).toBe('-1');
    expect(text(host.querySelector('neat-status-chip'))).toBe('component');
    expect(Array.from(host.querySelectorAll('[data-slot="usage"]'), (u) => u.textContent)).toEqual([
      '<neat-select>',
      '#x="neatSelect"',
    ]);
    expect(text(host)).toContain('A labelled listbox.');
  });

  it('lists inputs, two-way bindings, outputs, methods and properties as bound', async () => {
    const { rows } = await render(LISTBOX);

    expect(rows('Inputs')).toEqual([
      'options readonly NeatSelectOption<T>[] required',
      "placeholder string default 'Choose'",
      'describedBy string unset',
      'compact boolean attribute default false',
      'delay number accepts number | string unset',
    ]);
    expect(rows('Two-way')).toEqual(['[(value)] T required']);
    expect(rows('Outputs')).toEqual(['(opened) void']);
    expect(rows('Methods')).toEqual(['focus(): void focus(options: FocusOptions): void']);
    expect(rows('Properties')).toEqual(['open Signal<boolean>']);
  });

  it('keeps a method overload a line of its own', async () => {
    const { host } = await render(LISTBOX);
    const method = Array.from(host.querySelectorAll('app-api-member .name')).at(-2);

    expect(method?.textContent).toBe('focus(): void\nfocus(options: FocusOptions): void');
  });

  it('links the documented names in types', async () => {
    const { host } = await render(LISTBOX, new FakeDocs(['NeatSelectOption']));

    expect(Array.from(host.querySelectorAll('.type a[href]'), (a) => a.textContent)).toEqual([
      'NeatSelectOption',
    ]);
  });

  it('leaves out the doc the body already shows', async () => {
    const { host } = await render(LISTBOX, new FakeDocs(), true);

    expect(text(host)).not.toContain('A labelled listbox.');
    expect(text(host)).toContain('About options.');
  });

  it("shows a template directive's usage and variables before its doc", async () => {
    const { host, rows } = await render({
      name: 'NeatDiagramBlockTemplate',
      kind: 'template',
      selector: 'ng-template[neatDiagramBlock]',
      context: [member('$implicit', { type: 'NeatDiagramNode', doc: [] })],
      doc: words('The body of the blocks.'),
      source: SOURCE,
    });

    expect(host.querySelector('[data-slot="usage"]')?.textContent).toBe(
      '<ng-template neatDiagramBlock let-node>',
    );
    expect(rows('Context')).toEqual(['let-node NeatDiagramNode implicit']);
    const order = Array.from(host.children, (child) => child.tagName);
    expect(order.indexOf('H4')).toBeLessThan(order.indexOf('APP-DOC-TEXT'));
  });

  it('shows how a structural directive and a service are used', async () => {
    const structural = await render({
      name: 'NeatPageToolbar',
      kind: 'structural',
      selector: '[neatPageToolbar]',
      doc: [],
      source: SOURCE,
    });
    expect(structural.host.querySelector('[data-slot="usage"]')?.textContent).toBe(
      '*neatPageToolbar',
    );
    TestBed.resetTestingModule();

    const service = await render({ name: 'NeatToasts', kind: 'service', doc: [], source: SOURCE });
    expect(service.host.querySelector('[data-slot="usage"]')?.textContent).toBe(
      'inject(NeatToasts)',
    );
  });

  it("boxes a function's signature, a type's definition and a const's type, linked", async () => {
    const docs = new FakeDocs(['NeatDiagram']);
    const fn = await render(
      {
        name: 'neatDrillDownLevel',
        kind: 'function',
        signature: 'neatDrillDownLevel(diagram: NeatDiagram, blockId: string): NeatDiagram',
        doc: [],
        source: SOURCE,
      },
      docs,
    );
    expect(fn.host.querySelector('app-code-box pre')?.textContent).toBe(
      'neatDrillDownLevel(diagram: NeatDiagram, blockId: string): NeatDiagram',
    );
    expect(fn.host.querySelectorAll('app-code-box a[href]')).toHaveLength(2);
    TestBed.resetTestingModule();

    const type = await render({
      name: 'NeatDiagramRole',
      kind: 'type',
      definition: "'frame' | 'block'",
      doc: [],
      source: SOURCE,
    });
    expect(type.host.querySelector('app-code-box pre')?.textContent).toBe("'frame' | 'block'");
    TestBed.resetTestingModule();

    const constant = await render({
      name: 'KIOSK_POINTER_IDLE_MS',
      kind: 'const',
      type: '3000',
      doc: [],
      source: SOURCE,
    });
    expect(constant.host.querySelector('app-code-box pre')?.textContent).toBe('3000');
  });

  it('lists a short interface and folds a long one under its count', async () => {
    const short = await render({
      name: 'NeatDiagramSet',
      kind: 'interface',
      extends: ['NeatBase'],
      members: [member('overview', { type: 'NeatDiagram' }), member('levels', { optional: true })],
      doc: [],
      source: SOURCE,
    });
    expect(Array.from(short.host.querySelectorAll('app-api-member'), line)).toEqual([
      'overview NeatDiagram',
      'levels? string',
    ]);
    expect(text(short.host.querySelector('p[neatNote]'))).toBe('Extends NeatBase');
    expect(short.host.querySelector('neat-collapsible')).toBeNull();
    TestBed.resetTestingModule();

    const long = await render({
      name: 'NeatDiagramNode',
      kind: 'interface',
      members: Array.from({ length: 7 }, (_, index) => member(`m${index}`)),
      doc: [],
      source: SOURCE,
    });
    const fold = long.host.querySelector('neat-collapsible') as HTMLElement;
    expect(text(fold.querySelector('[data-slot="collapsible-trigger"]'))).toBe('7 members');
    expect(fold.querySelectorAll('app-api-member')).toHaveLength(7);
  });

  it('strikes deprecated names through and says what to use instead', async () => {
    const { host } = await render({
      ...LISTBOX,
      deprecated: words('Use NeatCombo.'),
      inputs: [member('size', { deprecated: words('Set the class instead.') })],
    });

    expect(host.querySelector('h3 s')?.textContent).toBe('NeatSelect');
    expect(host.querySelector('app-api-member .name s')?.textContent).toBe('size');
    expect(Array.from(host.querySelectorAll('neat-callout'), text)).toEqual([
      expect.stringContaining('Use NeatCombo.'),
      expect.stringContaining('Set the class instead.'),
    ]);
  });

  it('says where else a part is still exported from, and why', async () => {
    const { host } = await render({
      name: 'NeatSeriesSwatch',
      kind: 'component',
      selector: 'neat-series-swatch',
      doc: [],
      source: SOURCE,
      alsoExportedFrom: [
        { import: '@sima/neat-ui/charts', note: words('Apps imported it there.') },
      ],
    });

    expect(text(host.querySelector('p[neatNote]'))).toBe('Also exported from @sima/neat-ui/charts');
    expect(text(host.querySelector('p[neatNote] + app-doc-text'))).toBe('Apps imported it there.');
  });

  // Every generated API module: `tools/docs-emit.test.mjs` fails when one on disk is missing here.
  const ENTRIES: DocsEntry[] = [
    CALLOUT,
    CHARTS,
    COLLAPSIBLE,
    CONFIRM,
    DETAILS,
    DIAGRAM,
    DIALOG,
    DROP_ZONE,
    FIELD,
    FILE_BROWSER,
    INPUT,
    LEVEL_METER,
    LINE_LIST,
    NUMBER_FIELD,
    POPOVER,
    PRIMARY,
    PROGRESS,
    SEGMENTED,
    SELECT_LIST,
    SELECT,
    SLIDER,
    STATUS_CHIP,
    SWITCH,
    TABLE,
    TABS,
    TOAST,
    VIDEO,
  ];
  const PARTS = ENTRIES.flatMap((entry) =>
    entry.parts.flatMap((part) => (part.kind === 'reexport' ? [] : [part])),
  );

  it.each(PARTS.map((part) => [part.name, part] as const))(
    'renders the kit part %s',
    async (name, part) => {
      const { host } = await render(part);

      expect(host.querySelector('h3')?.textContent?.trim()).toBe(name + typeParameters(part));
    },
  );
});
