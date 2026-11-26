import { DecryptEngine } from './decrypt';
import { motionHost, pieceElement } from './motion.testing';

/** Characters per line, and where the tail starts on its first line, in the stubbed layout. */
const LINE = 40;
const TAIL_COLUMN = 10;
const LINE_HEIGHT = 20;

const rangeRect = Range.prototype.getBoundingClientRect;

/** A reply's last paragraph with its pieces and the tail after them, laid out by text length. */
function decryptHost() {
  const host = document.createElement('div');
  host.style.lineHeight = `${LINE_HEIGHT}px`;
  const paragraph = document.createElement('p');
  const tail = document.createElement('span');
  tail.className = 'tail';
  tail.setAttribute('aria-hidden', 'true');
  tail.getClientRects = () => {
    const length = tail.textContent!.length;
    const first = LINE - TAIL_COLUMN;
    const lines = length <= first ? 1 : 1 + Math.ceil((length - first) / LINE);
    return Array.from(
      { length: lines },
      (_, i) => ({ top: i * LINE_HEIGHT, bottom: (i + 1) * LINE_HEIGHT }) as DOMRect,
    ) as unknown as DOMRectList;
  };
  // A letter of the tail, as a range over its text reads it: on the line its offset puts it on.
  Range.prototype.getBoundingClientRect = function (this: Range) {
    const first = LINE - TAIL_COLUMN;
    const offset = this.startOffset;
    const line = offset < first ? 0 : 1 + Math.floor((offset - first) / LINE);
    return { top: line * LINE_HEIGHT, bottom: (line + 1) * LINE_HEIGHT } as DOMRect;
  };
  let writes = 0;
  const content = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!;
  Object.defineProperty(tail, 'textContent', {
    configurable: true,
    get: () => content.get!.call(tail),
    set: (value: string) => {
      writes++;
      content.set!.call(tail, value);
    },
  });
  paragraph.append(tail);
  host.append(paragraph);
  document.body.append(host);
  const parts = motionHost(host);
  const engine = new DecryptEngine(parts.deps);
  return {
    ...parts,
    host,
    tail,
    engine,
    /** How often the tail's text was written. */
    writes: () => writes,
    /** Adds a piece before the tail, as a write renders it. */
    add(index: number, from: number, text: string) {
      paragraph.insertBefore(pieceElement(document, { index, from, text, decrypt: true }), tail);
    },
    piece: (index: number) => host.querySelector<HTMLElement>(`[data-token="${index}"]`)!,
    noise: (index: number) =>
      host.querySelector<HTMLElement>(`[data-token="${index}"] .noise`)!.textContent!,
  };
}

describe('DecryptEngine', () => {
  afterEach(() => {
    document.body.replaceChildren();
    Range.prototype.getBoundingClientRect = rangeRect;
  });

  it('resolves the frontier by an eighth of what is left each frame', () => {
    const reply = decryptHost();
    reply.add(0, 0, 'Three jars of pasta');
    reply.engine.rendered(true);
    reply.clock.frame();
    // 19 left: ceil(19 / 8) = 3 resolved.
    expect(reply.noise(0).slice(0, 3)).toBe('Thr');
    expect(reply.noise(0)).toHaveLength(19);
    reply.clock.frame();
    // 16 left: 2 more.
    expect(reply.noise(0).slice(0, 5)).toBe('Three');
    expect(reply.noise(0).slice(5)).not.toBe(' jars of pasta');
  });

  it('pending pieces show glyphs and hide their text, resolved ones their text', () => {
    const reply = decryptHost();
    reply.add(0, 0, 'Three');
    reply.engine.rendered(true);
    expect(reply.piece(0).hasAttribute('data-pending')).toBe(true);
    expect(reply.noise(0)).toMatch(/^[^\s]{5}$/);
    for (let i = 0; i < 10; i++) reply.clock.frame();
    expect(reply.piece(0).hasAttribute('data-pending')).toBe(false);
    expect(reply.noise(0)).toBe('');
    reply.add(1, 5, ' jars');
    reply.engine.rendered(true);
    expect(reply.piece(1).hasAttribute('data-pending')).toBe(true);
    // Its space is kept.
    expect(reply.noise(1)[0]).toBe(' ');
  });

  it('renews the noise every 60 ms, not every frame', () => {
    const reply = decryptHost();
    reply.add(0, 0, 'x'.repeat(200));
    reply.engine.rendered(true);
    reply.clock.frame(70);
    const glyphs = reply.noise(0).slice(-20);
    const tail = reply.tail.textContent;
    reply.clock.frame(16);
    expect(reply.noise(0).slice(-20)).toBe(glyphs);
    expect(reply.tail.textContent).toBe(tail);
    reply.clock.frame(50);
    expect(reply.noise(0).slice(-20)).not.toBe(glyphs);
    expect(reply.tail.textContent).not.toBe(tail);
  });

  it('fits the tail to the rest of the line and one more line on every frame', () => {
    const reply = decryptHost();
    reply.add(0, 0, 'Three');
    reply.engine.rendered(true);
    reply.clock.frame();
    // The rest of the first line (30) and a whole line (40), never a third line.
    expect(reply.tail.textContent).toHaveLength(LINE - TAIL_COLUMN + LINE);
    reply.clock.frame();
    expect(reply.tail.textContent).toHaveLength(LINE - TAIL_COLUMN + LINE);
  });

  it('fits the tail with two writes a frame: the whole noise, then its fitted start', () => {
    const reply = decryptHost();
    reply.add(0, 0, 'Three');
    reply.engine.rendered(true);
    const before = reply.writes();
    reply.clock.frame();
    expect(reply.writes() - before).toBeLessThanOrEqual(2);
    expect(reply.tail.textContent).toHaveLength(LINE - TAIL_COLUMN + LINE);
  });

  it('empties the tail when streaming ends and stops once resolved', () => {
    const reply = decryptHost();
    reply.add(0, 0, 'Three jars of pasta');
    reply.engine.rendered(true);
    reply.clock.frame();
    reply.engine.rendered(false);
    expect(reply.tail.textContent).toBe('');
    for (let i = 0; i < 20; i++) reply.clock.frame();
    expect(reply.piece(0).hasAttribute('data-pending')).toBe(false);
    expect(reply.clock.pending()).toBe(false);
  });

  it('a text replaced mid-stream leaves no noise and no tail', () => {
    const reply = decryptHost();
    reply.add(0, 0, 'Three jars of pasta');
    reply.engine.rendered(true);
    reply.clock.frame();
    // The new text shows whole: its prose is plain text, with no piece.
    reply.piece(0).replaceWith(document.createTextNode('Something else'));
    reply.engine.rendered(true);
    expect(reply.tail.textContent).toBe('');
    expect(reply.host.querySelector('[data-pending]')).toBeNull();
    reply.clock.frame();
    expect(reply.clock.pending()).toBe(false);
    // What comes after it decrypts from where it arrives.
    reply.add(0, 14, ' more');
    reply.engine.rendered(true);
    expect(reply.piece(0).hasAttribute('data-pending')).toBe(true);
  });

  it('runs no frames while the page is hidden', () => {
    const reply = decryptHost();
    reply.document.setHidden(true);
    reply.add(0, 0, 'Three');
    reply.engine.rendered(true);
    expect(reply.clock.requested).toBe(0);
    reply.document.setHidden(false);
    expect(reply.clock.requested).toBe(1);
  });

  it('stops its frames and listeners when destroyed', () => {
    const reply = decryptHost();
    reply.add(0, 0, 'Three');
    reply.engine.rendered(true);
    reply.engine.destroy();
    expect(reply.clock.pending()).toBe(false);
    expect(reply.document.listeners.size).toBe(0);
  });
});
