/*
 * How the docs views word the generated data: the plain rules behind the panel's lines (usage,
 * member names, defaults) and the body's cut, kept out of the templates so each is stated once
 * and tested without a DOM.
 */
import type { DocBlock, DocsDeclaredPart, DocsMember } from './model';

export const KIND_LABEL: Record<DocsDeclaredPart['kind'], string> = {
  component: 'component',
  directive: 'directive',
  structural: 'structural directive',
  template: 'template',
  service: 'service',
  class: 'class',
  function: 'function',
  const: 'const',
  interface: 'interface',
  type: 'type',
};

/**
 * Kinds an app reads rather than renders: they need no example, so the page introduces none in
 * its body and the panel alone documents them.
 */
const TYPE_KINDS: ReadonlySet<DocsDeclaredPart['kind']> = new Set(['interface', 'type', 'const']);

export function isTypeKind(part: DocsDeclaredPart): boolean {
  return TYPE_KINDS.has(part.kind);
}

/** `<neat-diagram>` for an element selector; any other selector as written. */
export function selectorText(selector: string): string {
  return /^[a-z][\w-]*$/.test(selector) ? `<${selector}>` : selector;
}

/**
 * The line that says how a class is used: its selector, a template directive's `ng-template`
 * with its `let-` variables, a structural directive with its `*`, a service's `inject`. Null for
 * the other kinds, which the panel shows by signature or definition.
 */
export function usageLine(part: DocsDeclaredPart): string | null {
  switch (part.kind) {
    case 'template': {
      const attribute = /^ng-template\[(.+)\]$/.exec(part.selector ?? '')?.[1] ?? part.selector;
      const lets = (part.context ?? []).map((variable) => ` ${contextLabel(variable)}`).join('');
      return `<ng-template ${attribute}${lets}>`;
    }
    case 'structural': {
      const attribute = /^\[(.+)\]$/.exec(part.selector ?? '')?.[1];
      return attribute ? `*${attribute}` : (part.selector ?? null);
    }
    case 'service':
      return `inject(${part.name})`;
    case 'component':
    case 'directive':
    case 'class':
      return part.selector ? selectorText(part.selector) : null;
    default:
      return null;
  }
}

/** `<T, K = unknown>` for a generic part, else empty. */
export function typeParameters(part: DocsDeclaredPart): string {
  const parameters = 'typeParameters' in part ? part.typeParameters : undefined;
  return parameters?.length ? `<${parameters.join(', ')}>` : '';
}

/**
 * The name a template gives the implicit variable, after the last word of its type, as the kit's
 * own examples write it (`NeatDiagramNode` is `let-node`); `value` for a type that is no name.
 */
export function implicitName(type: string): string {
  return /(?:^|[a-z0-9])([A-Z][a-z0-9]+)$/.exec(type)?.[1]?.toLowerCase() ?? 'value';
}

/** A template variable as a template binds it: `let-node`, or `let-index="index"`. */
export function contextLabel(variable: DocsMember): string {
  return variable.name === '$implicit'
    ? `let-${implicitName(variable.type)}`
    : `let-${variable.name}="${variable.name}"`;
}

/** The member groups of the panel, each with the way its members are written. */
export type MemberGroup = 'inputs' | 'models' | 'outputs' | 'context' | 'properties' | 'members';

/** A member's name as it is written where it is used: `[(level)]`, `(activate)`, `levels?`. */
export function memberLabel(group: MemberGroup, member: DocsMember): string {
  switch (group) {
    case 'models':
      return `[(${member.name})]`;
    case 'outputs':
      return `(${member.name})`;
    case 'context':
      return contextLabel(member);
    default:
      return member.optional ? `${member.name}?` : member.name;
  }
}

/** What the end of a member's line says about its value. */
export type MemberValue =
  | { readonly kind: 'required' }
  | { readonly kind: 'default'; readonly value: string }
  | { readonly kind: 'unset' }
  | { readonly kind: 'implicit' };

/**
 * Inputs and models are required, start at a default, or start unset; the implicit template
 * variable says so. Outputs, properties and interface members have no starting value to show.
 */
export function memberValue(group: MemberGroup, member: DocsMember): MemberValue | null {
  if (group === 'context') return member.name === '$implicit' ? { kind: 'implicit' } : null;
  if (group !== 'inputs' && group !== 'models') return null;
  if (member.required) return { kind: 'required' };
  return member.default === undefined
    ? { kind: 'unset' }
    : { kind: 'default', value: member.default };
}

/**
 * How an input's transform changes what a template binds: the attribute alone is true, or a
 * number attribute; any other transform is said by what it `accepts`.
 */
export function transformNote(member: DocsMember): string | null {
  if (member.transform === 'booleanAttribute') return 'attribute';
  if (member.transform === 'numberAttribute') return 'number attribute';
  return null;
}

/**
 * Where the body's description of a part is cut: after its second paragraph, so the blocks
 * between (a usage fence) come with it. The length when nothing is left to show.
 */
export function introCut(blocks: readonly DocBlock[]): number {
  let paragraphs = 0;
  for (let index = 0; index < blocks.length; index++) {
    if (blocks[index].kind === 'paragraph' && ++paragraphs === 2) return index + 1;
  }
  return blocks.length;
}

/**
 * What the body's "more" offers: the paragraphs the cut leaves for later, counted. A few words, as
 * an inline button keeps its label on one line (it fits a phone).
 */
export function moreLabel(blocks: readonly DocBlock[]): string {
  const count = blocks.slice(introCut(blocks)).filter((block) => block.kind === 'paragraph').length;
  return count ? `Show ${count} more ${count === 1 ? 'paragraph' : 'paragraphs'}` : 'Show the rest';
}

/** The part an example's `shows` entry names: `@sima/neat-ui/status-chip#NeatStatusChip`. */
export function shownName(shown: string): string {
  return shown.slice(shown.indexOf('#') + 1);
}
