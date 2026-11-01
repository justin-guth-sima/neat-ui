import {
  contextLabel,
  implicitName,
  introCut,
  isTypeKind,
  memberLabel,
  memberValue,
  moreLabel,
  selectorText,
  shownName,
  transformNote,
  typeParameters,
  usageLine,
} from './display';
import type { DocBlock, DocsClass, DocsMember } from './model';

const member = (fields: Partial<DocsMember> = {}): DocsMember => ({
  name: 'level',
  type: 'string[]',
  doc: [],
  ...fields,
});

const part = (fields: Partial<DocsClass>): DocsClass => ({
  name: 'NeatX',
  kind: 'component',
  doc: [],
  source: 'projects/neat-ui/src/lib/x.ts',
  ...fields,
});

const paragraph: DocBlock = { kind: 'paragraph', spans: [{ kind: 'text', text: 'Words.' }] };
const fence: DocBlock = { kind: 'code', language: 'html', code: '<neat-x />' };

describe('docs display rules', () => {
  it('writes an element selector as a tag and any other as written', () => {
    expect(selectorText('neat-diagram')).toBe('<neat-diagram>');
    expect(selectorText('button[neatButton], a[neatButton]')).toBe(
      'button[neatButton], a[neatButton]',
    );
    expect(selectorText('[neatTooltip]')).toBe('[neatTooltip]');
  });

  it('says how each kind of class is used', () => {
    expect(usageLine(part({ selector: 'neat-diagram' }))).toBe('<neat-diagram>');
    expect(
      usageLine(
        part({
          kind: 'template',
          selector: 'ng-template[neatDiagramBlock]',
          context: [member({ name: '$implicit', type: 'NeatDiagramNode' })],
        }),
      ),
    ).toBe('<ng-template neatDiagramBlock let-node>');
    expect(usageLine(part({ kind: 'structural', selector: '[neatPageToolbar]' }))).toBe(
      '*neatPageToolbar',
    );
    expect(usageLine(part({ kind: 'service', name: 'NeatToasts' }))).toBe('inject(NeatToasts)');
    expect(usageLine(part({ kind: 'class' }))).toBeNull();
  });

  it('names the implicit variable after the last word of its type', () => {
    expect(implicitName('NeatDiagramNode')).toBe('node');
    expect(implicitName('NeatDiagramEdge')).toBe('edge');
    expect(implicitName('T')).toBe('value');
    expect(implicitName('readonly NeatSeries[]')).toBe('value');
    expect(contextLabel(member({ name: 'index', type: 'number' }))).toBe('let-index="index"');
  });

  it('writes members as they are bound', () => {
    expect(memberLabel('inputs', member({ name: 'label' }))).toBe('label');
    expect(memberLabel('models', member())).toBe('[(level)]');
    expect(memberLabel('outputs', member({ name: 'activate' }))).toBe('(activate)');
    expect(memberLabel('members', member({ name: 'levels', optional: true }))).toBe('levels?');
    expect(memberLabel('context', member({ name: '$implicit', type: 'NeatDiagramNote' }))).toBe(
      'let-note',
    );
  });

  it('says whether an input is required, has a default or starts unset', () => {
    expect(memberValue('inputs', member({ required: true }))).toEqual({ kind: 'required' });
    expect(memberValue('models', member({ default: '[]' }))).toEqual({
      kind: 'default',
      value: '[]',
    });
    expect(memberValue('inputs', member())).toEqual({ kind: 'unset' });
    expect(memberValue('context', member({ name: '$implicit' }))).toEqual({ kind: 'implicit' });
    expect(memberValue('outputs', member())).toBeNull();
    expect(memberValue('members', member({ default: '1' }))).toBeNull();
  });

  it('words the attribute transforms and leaves the others to what they accept', () => {
    expect(transformNote(member({ transform: 'booleanAttribute' }))).toBe('attribute');
    expect(transformNote(member({ transform: 'numberAttribute' }))).toBe('number attribute');
    expect(transformNote(member({ transform: 'toSeconds', accepts: 'string' }))).toBeNull();
    expect(transformNote(member())).toBeNull();
  });

  it('cuts a description after its second paragraph, with what lies between', () => {
    expect(introCut([paragraph, fence, paragraph, paragraph])).toBe(3);
    expect(introCut([paragraph, paragraph])).toBe(2);
    expect(introCut([paragraph, fence])).toBe(2);
    expect(introCut([])).toBe(0);
  });

  it('writes type parameters and tells the kinds that need no example', () => {
    expect(typeParameters(part({ typeParameters: ['T', 'K = unknown'] }))).toBe('<T, K = unknown>');
    expect(typeParameters(part({}))).toBe('');
    expect(isTypeKind({ ...part({}), kind: 'component' })).toBe(false);
    expect(
      isTypeKind({ name: 'NeatTone', kind: 'type', definition: "'info'", doc: [], source: 'x' }),
    ).toBe(true);
  });

  it('counts the paragraphs the cut leaves for later', () => {
    expect(moreLabel([paragraph, fence, paragraph, paragraph, fence, paragraph])).toBe(
      'Show 2 more paragraphs',
    );
    expect(moreLabel([paragraph, paragraph, paragraph])).toBe('Show 1 more paragraph');
    expect(moreLabel([paragraph, paragraph, fence])).toBe('Show the rest');
  });

  it("cuts an example's shows entry to the part's name", () => {
    expect(shownName('@sima/neat-ui/status-chip#NeatStatusChip')).toBe('NeatStatusChip');
  });
});
