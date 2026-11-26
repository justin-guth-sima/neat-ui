import type { Token, Tokens } from 'marked';
import type { MarkdownBlock } from '../blocks';

/*
 * The readable text of a reply: what read aloud speaks and what the speaking motions light, as one
 * walk both share. It is the shown prose (the text motions' leaves) and inline code's text, in the
 * order the template prints them; code blocks, tables, images, checkboxes and raw HTML are not
 * read. Every readable character knows its offset in the Markdown source, so a range of the source
 * (a sentence, as `neatSpeakable` gives it) finds the same characters however the text is shown.
 * Why a walk of its own: inline code is part of a spoken sentence but not of the motions' pieces.
 * Internal.
 */

/** A readable run: its text, where it sits in the readable text, and each character's source offset. */
export interface ReadableLeaf {
  readonly token: Token;
  readonly from: number;
  readonly text: string;
  /** The source offset of each character of `text`, or -1 where none was found. */
  readonly sources: Int32Array;
}

/** A paragraph, a heading, or a list item's or a quote's text: sentences never cross it. */
export interface ReadableBlock {
  readonly leaves: readonly ReadableLeaf[];
  /** Its range in the readable text. */
  readonly from: number;
  readonly to: number;
  /** Nothing follows it in the text yet: no other readable block, and no other Markdown block. */
  readonly last: boolean;
}

/**
 * What a finished Markdown block reads as, kept across renders: a finished block is the same
 * object while the text grows, and so are its readable blocks, from the same readable offset.
 */
export type ReadableCache = WeakMap<
  MarkdownBlock,
  { readonly from: number; readonly blocks: readonly ReadableBlock[] }
>;

/**
 * The readable blocks of the Markdown blocks of `source`, in order. With a `cache`, a finished
 * block read before at the same readable offset is not read again.
 */
export function readableBlocks(
  blocks: readonly MarkdownBlock[],
  source: string,
  cache?: ReadableCache,
): readonly ReadableBlock[] {
  const text = source.replace(/\r\n?/g, '\n');
  const out: ReadableBlock[] = [];
  let lastMarkdown = -1;
  let offset = 0;
  blocks.forEach((block, index) => {
    const cached = block.final ? cache?.get(block) : undefined;
    let read: readonly ReadableBlock[];
    if (cached && cached.from === offset) {
      read = cached.blocks;
    } else {
      read = readBlock(block, text, offset);
      if (block.final) cache?.set(block, { from: offset, blocks: read });
    }
    if (read.length > 0) {
      out.push(...read);
      offset = read[read.length - 1].to;
      lastMarkdown = index;
    }
  });
  // The last readable block is last only if no other Markdown block (a code block, say) follows.
  const last = out.at(-1);
  if (last && lastMarkdown === blocks.length - 1) out[out.length - 1] = { ...last, last: true };
  return out;
}

/** One Markdown block's readable blocks, from readable offset `offset`. */
function readBlock(block: MarkdownBlock, text: string, offset: number): ReadableBlock[] {
  const groups: { readonly leaves: Token[]; readonly markdown: number }[] = [];
  walkBlocks([block.token], 0, groups);
  const out: ReadableBlock[] = [];
  // One cursor per Markdown block: its leaves are found in its source, in order.
  const cursor = { at: block.from };
  for (const group of groups) {
    const leaves: ReadableLeaf[] = [];
    const from = offset;
    for (const token of group.leaves) {
      if (!READ.has(token.type)) {
        skip(token, text, cursor);
        continue;
      }
      const leafText = textOf(token);
      leaves.push({
        token,
        from: offset,
        text: leafText,
        sources: locate(token, leafText, text, cursor),
      });
      offset += leafText.length;
    }
    if (offset > from) out.push({ leaves, from, to: offset, last: false });
  }
  return out;
}

/** A source range as readable offsets: from its first readable character to after its last; null if it holds none. */
export function readableRange(
  readable: readonly ReadableBlock[],
  from: number,
  to: number,
): { from: number; to: number } | null {
  let first = -1;
  let last = -1;
  for (const block of readable) {
    for (const leaf of block.leaves) {
      for (let i = 0; i < leaf.sources.length; i++) {
        const source = leaf.sources[i];
        if (source < from || source >= to) continue;
        if (first < 0) first = leaf.from + i;
        last = leaf.from + i;
      }
    }
  }
  return first < 0 ? null : { from: first, to: last + 1 };
}

/** The leaf tokens read: prose text, an escaped character, inline code. */
const READ = new Set(['text', 'escape', 'codespan']);

function textOf(token: Token): string {
  return 'text' in token ? (token.text as string) : '';
}

/**
 * The block tokens' readable groups, as the template's block template prints them: each
 * paragraph, heading, and a list item's or a quote's text its own group of leaf tokens (and of
 * the inline tokens between them that are not read, so the cursor passes them).
 */
function walkBlocks(
  tokens: readonly Token[],
  markdown: number,
  groups: { readonly leaves: Token[]; readonly markdown: number }[],
): void {
  for (const token of tokens) {
    switch (token.type) {
      case 'paragraph':
      case 'heading':
        groups.push({ leaves: inlineLeaves(token.tokens ?? []), markdown });
        break;
      case 'text':
        groups.push({
          leaves: (token as Tokens.Text).tokens
            ? inlineLeaves((token as Tokens.Text).tokens!)
            : [token],
          markdown,
        });
        break;
      case 'list':
        for (const item of (token as Tokens.List).items) walkBlocks(item.tokens, markdown, groups);
        break;
      case 'blockquote':
        walkBlocks(token.tokens ?? [], markdown, groups);
        break;
      default:
        // A code block, a table, a rule, a checkbox, raw HTML: not read.
        break;
    }
  }
}

/** Inline tokens in template order: the leaves read, and those not read where they stand. */
function inlineLeaves(tokens: readonly Token[], out: Token[] = []): Token[] {
  for (const token of tokens) {
    switch (token.type) {
      case 'strong':
      case 'em':
      case 'del':
      case 'link':
        inlineLeaves(token.tokens ?? [], out);
        break;
      case 'text':
        if ((token as Tokens.Text).tokens) inlineLeaves((token as Tokens.Text).tokens!, out);
        else if (textOf(token)) out.push(token);
        break;
      case 'escape':
      case 'codespan':
        out.push(token);
        break;
      default:
        // A line break, an image, raw HTML: not read, but passed.
        out.push(token);
        break;
    }
  }
  return out;
}

/** Moves the cursor past a token that is not read, where its raw is found. */
function skip(token: Token, source: string, cursor: { at: number }): void {
  if (!token.raw) return;
  const at = source.indexOf(token.raw, cursor.at);
  if (at >= 0) cursor.at = at + token.raw.length;
}

/**
 * Each character's source offset, scanning from the cursor: a leaf whose raw is its text maps one
 * to one where it is found, an escape to the character after its backslash, and anything else
 * (inline code, a list item's text with its indentation gone) as a subsequence of the source.
 */
function locate(token: Token, text: string, source: string, cursor: { at: number }): Int32Array {
  const sources = new Int32Array(text.length).fill(-1);
  const raw = token.raw ?? '';
  if (token.type === 'escape' || raw === text) {
    const at = raw ? source.indexOf(raw, cursor.at) : -1;
    if (at >= 0) {
      const shift = token.type === 'escape' ? raw.length - text.length : 0;
      for (let i = 0; i < text.length; i++) sources[i] = at + shift + i;
      cursor.at = at + raw.length;
      return sources;
    }
  }
  let at = cursor.at;
  for (let i = 0; i < text.length; i++) {
    const found = source.indexOf(text[i], at);
    if (found < 0) continue;
    sources[i] = found;
    at = found + 1;
  }
  cursor.at = at;
  return sources;
}
