/** The last turn given out, which the next one waits for. */
let last: Promise<void> = Promise.resolve();

/**
 * A turn of the page's code blocks, which resolves in a task of its own once every turn asked for
 * before it has run: the caller's work right after it (a block tokenizing its code) then runs alone
 * in that task, and the browser can paint and take input between two blocks. Coloring every block
 * of a page in one task froze the page for the sum of them.
 */
export function nextTurn(): Promise<void> {
  last = last.then(() => new Promise<void>((resolve) => setTimeout(resolve)));
  return last;
}
