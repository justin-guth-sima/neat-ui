/*
 * The readable text as the DOM shows it: the text nodes under a `neat-markdown` host in order,
 * leaving out code blocks, tables, everything hidden from assistive technology (the motions'
 * layers) and what the template marks `data-unread` (a picture's alternative text, the checkbox
 * glyphs, raw HTML). Its text is `readableBlocks`' text, so a readable offset is a place in it.
 * Internal.
 */

/** The readable text nodes under `host`, in order, with each one's readable start. */
export interface ReadableNodes {
  readonly nodes: readonly Text[];
  readonly starts: Int32Array;
  readonly length: number;
}

function skipped(element: Element): boolean {
  return (
    element.localName === 'neat-code-block' ||
    element.localName === 'table' ||
    element.getAttribute('aria-hidden') === 'true' ||
    element.hasAttribute('data-unread')
  );
}

/** The readable text nodes under host, in order, with each one's readable start. */
export function readableNodes(host: HTMLElement): ReadableNodes {
  const nodes: Text[] = [];
  const starts: number[] = [];
  let length = 0;
  // A walk by hand: a TreeWalker's filter would call back into script for every node.
  const visit = (parent: Node) => {
    for (let node = parent.firstChild; node; node = node.nextSibling) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node as Text;
        if (text.data.length === 0) continue;
        nodes.push(text);
        starts.push(length);
        length += text.data.length;
      } else if (node.nodeType === Node.ELEMENT_NODE && !skipped(node as Element)) {
        visit(node);
      }
    }
  };
  visit(host);
  return { nodes, starts: Int32Array.from(starts), length };
}

/** A DOM range over the readable characters `[from, to)`, or null when it holds none. */
export function readableDomRange(walk: ReadableNodes, from: number, to: number): Range | null {
  if (to <= from || from >= walk.length || walk.nodes.length === 0) return null;
  const start = place(walk, Math.max(0, from), false);
  const end = place(walk, Math.min(to, walk.length), true);
  const range = walk.nodes[0].ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

/** The node and offset of a readable offset; `end` takes the end of a node rather than the next's start. */
function place(walk: ReadableNodes, offset: number, end: boolean): { node: Text; offset: number } {
  let low = 0;
  let high = walk.nodes.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    const start = walk.starts[middle];
    if (start < offset || (!end && start === offset)) low = middle;
    else high = middle - 1;
  }
  return { node: walk.nodes[low], offset: offset - walk.starts[low] };
}
