import type { ThemeRegistration } from '@shikijs/primitive';
import type { CodeKind } from './lines';

/** What the theme gives text it does not color: the block's own text color. */
const PLAIN = 'plain';

/**
 * The TextMate scopes of each kind of code text. A grammar names its tokens by scopes such as
 * `keyword.control.flow.python`, and the most specific selector that matches a token wins, so
 * `entity.name.tag.yaml` (a YAML key) is a property though `entity.name.tag` is a tag. `plain`
 * keeps text the broader selectors would color (operators, a variable's parameter) in the text
 * color, and so does code embedded in other code (a template literal's `${…}`, a script in HTML),
 * whose own tokens are colored as they would be outside. A diff's inserted lines take the string's
 * green and its deleted lines the tag's red.
 */
const SCOPES: Readonly<Record<CodeKind | typeof PLAIN, readonly string[]>> = {
  keyword: [
    'keyword',
    'storage',
    'variable.language',
    'keyword.operator.new',
    'keyword.operator.expression',
    'keyword.operator.logical.python',
    'keyword.operator.sizeof',
    'keyword.operator.alignof',
    'keyword.operator.typeid',
    'keyword.operator.delete',
    'keyword.operator.cast',
    'punctuation.definition.template-expression',
    'punctuation.section.embedded',
    'markup.heading',
    'meta.diff.header',
    'entity.name.section',
    'punctuation.definition.list.begin.markdown',
  ],
  string: [
    'string',
    'punctuation.definition.string',
    'storage.type.string',
    'markup.inline.raw',
    'markup.inserted',
  ],
  comment: ['comment', 'punctuation.definition.comment', 'markup.quote'],
  constant: [
    'constant',
    'support.constant',
    'variable.other.constant',
    'variable.other.enummember',
    'entity.name.constant',
    'keyword.other.unit',
    'storage.type.number',
    'markup.changed',
  ],
  type: [
    'entity.name.type',
    'entity.name.class',
    'entity.name.namespace',
    'entity.name.scope-resolution',
    'entity.other.inherited-class',
    'support.type',
    'support.class',
    'storage.type.built-in',
    'storage.type.primitive',
  ],
  function: [
    'entity.name.function',
    'support.function',
    'variable.function',
    'meta.function-call.generic',
    'markup.underline.link',
    'string.other.link',
    'meta.diff.range',
  ],
  property: [
    'variable.other.property',
    'variable.other.object.property',
    'variable.other.member',
    'support.variable.property',
    'support.type.property-name',
    'meta.object-literal.key',
    'entity.other.attribute-name',
    'entity.name.tag.yaml',
    'variable.other.env',
  ],
  tag: ['entity.name.tag', 'support.class.component', 'markup.deleted'],
  [PLAIN]: [
    'keyword.operator',
    'variable.parameter',
    'punctuation.definition.tag',
    'markup.bold',
    'markup.italic',
    'meta.template.expression',
    'meta.embedded',
  ],
};

/**
 * The highlighter's theme: each kind's scopes take the kind's name as their color, so a token's
 * color says its kind (Shiki hands a color that is not a hex value back as written). No color of a
 * Shiki theme reaches the page; the block's stylesheet turns each kind into its theme token.
 */
export const CODE_THEME: ThemeRegistration = {
  name: 'neat-code',
  type: 'light',
  fg: PLAIN,
  bg: PLAIN,
  settings: Object.entries(SCOPES).map(([kind, scope]) => ({
    scope: [...scope],
    settings: { foreground: kind },
  })),
};

const KINDS = new Set<string>(Object.keys(SCOPES).filter((kind) => kind !== PLAIN));

/** The kind a token's color from `CODE_THEME` names, `null` for text in the block's own color. */
export function kindOf(color: string | undefined): CodeKind | null {
  return color !== undefined && KINDS.has(color) ? (color as CodeKind) : null;
}
