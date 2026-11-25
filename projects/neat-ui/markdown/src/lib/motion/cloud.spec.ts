import { CloudEngine } from './cloud';
import { COMMON_WORDS } from './common-words';
import { motionHost, pieceElement } from './motion.testing';

const WIDTH = 600;
const LINE_HEIGHT = 24;

/** A reply with its cloud as the template renders it, its layout stubbed. */
function cloudHost(options: { words?: number; random?: () => number } = {}) {
  const host = document.createElement('div');
  host.style.lineHeight = `${LINE_HEIGHT}px`;
  host.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: WIDTH, height: 400, right: WIDTH, bottom: 400 }) as DOMRect;
  const paragraph = document.createElement('p');
  const cloud = document.createElement('div');
  cloud.className = 'cloud';
  const count = options.words ?? 12;
  for (let i = 0; i < count; i++) {
    const word = document.createElement('span');
    word.className = 'cloud-word';
    cloud.append(word);
  }
  for (let i = 0; i < 24; i++) {
    const flight = document.createElement('span');
    flight.className = 'cloud-flight';
    cloud.append(flight);
  }
  host.append(paragraph, cloud);
  document.body.append(host);
  const parts = motionHost(host);
  const deps = options.random ? { ...parts.deps, random: options.random } : parts.deps;
  const engine = new CloudEngine(deps, count);
  let index = 0;
  let epoch = 0;
  return {
    ...parts,
    host,
    cloud,
    engine,
    words: () => [...cloud.querySelectorAll<HTMLElement>('.cloud-word')],
    flights: () => [...cloud.querySelectorAll<HTMLElement>('.cloud-flight')],
    busy: () => [...cloud.querySelectorAll<HTMLElement>('.cloud-flight[data-busy]')],
    /** Renders a new piece whose last line ends at `right`, `bottom`. */
    add(text: string, box: { left: number; right: number; bottom: number }, streaming = true) {
      const piece = pieceElement(document, { index, from: index * 5, text });
      index++;
      const rect = { ...box, top: box.bottom - 20, height: 20, width: box.right - box.left };
      piece.getClientRects = () => [rect] as unknown as DOMRectList;
      paragraph.append(piece);
      engine.rendered(streaming, epoch);
      return piece;
    },
    /** Renders the text written anew: no pieces, their count starting again. */
    rewrite() {
      paragraph.replaceChildren();
      index = 0;
      engine.rendered(true, ++epoch);
    },
  };
}

/** The x and y of a `translate(x, y) translate(-50%, -50%)`. */
function placed(element: HTMLElement): [number, number] {
  const [, x, y] = element.style.transform.match(/translate\(([-\d.e]+)px, ([-\d.e]+)px\)/)!;
  return [Number(x), Number(y)];
}

describe('CloudEngine', () => {
  afterEach(() => document.body.replaceChildren());

  it('places cloudWords words around the eased anchor', () => {
    // Every random a half: each word at angle π, radius 48, turning +0.5, its wobble at phase π.
    const reply = cloudHost({ words: 5, random: () => 0.5 });
    expect(reply.words().every((word) => COMMON_WORDS.includes(word.textContent!))).toBe(true);
    expect(reply.words()[0].style.fontSize).toMatch(/em$/);
    reply.add('Three', { left: 270, right: 300, bottom: 40 });
    reply.clock.frame();
    // The first anchor is where it aims: 30 px after the line's start, 26 px below it.
    const angle = Math.PI + 0.5 * 0.016;
    const wobble = (now: number) => Math.sin(now / 600 + Math.PI) * 4;
    let [x, y] = placed(reply.words()[0]);
    expect(x).toBeCloseTo(300 + Math.cos(angle) * 48 * 1.7);
    expect(y).toBeCloseTo(66 + Math.sin(angle) * 48 * 0.4 + wobble(16));
    // A piece further right: the anchor eases 0.12 of the way each frame, 90 px inside the side.
    reply.add(' jars', { left: 540, right: 580, bottom: 40 });
    reply.clock.frame();
    [x, y] = placed(reply.words()[0]);
    const anchor = 300 + (WIDTH - 90 - 300) * 0.12;
    expect(x).toBeCloseTo(anchor + Math.cos(angle + 0.008) * 48 * 1.7);
    // The line did not move down: the anchor's y stays.
    expect(y).toBeCloseTo(66 + Math.sin(angle + 0.008) * 48 * 0.4 + wobble(32));
    // Words stay 30 px inside the host's sides.
    for (const word of reply.words()) {
      const [left] = placed(word);
      expect(left).toBeGreaterThanOrEqual(30);
      expect(left).toBeLessThanOrEqual(WIDTH - 30);
    }
  });

  it('a new piece flies from a cloud word to its place and the word takes a new one', () => {
    const reply = cloudHost({ words: 1 });
    const word = reply.words()[0];
    reply.add('pasta', { left: 100, right: 150, bottom: 40 });
    reply.clock.frame();
    const piece = reply.add(' oil', { left: 150, right: 180, bottom: 40 });
    // The first piece's flight is still on its way; this one is the second.
    expect(reply.busy()).toHaveLength(2);
    const flight = reply.busy()[1];
    expect(flight.textContent).toBe(' oil');
    expect(flight.hasAttribute('data-start')).toBe(true);
    expect(word.style.opacity).toBe('0');
    expect(piece.hasAttribute('data-unflown')).toBe(false);
    reply.clock.frame();
    expect(flight.hasAttribute('data-start')).toBe(false);
    expect(flight.hasAttribute('data-land')).toBe(true);
    // To the piece's last line: its right end less the flight's width, centered on the line.
    expect(placed(flight)).toEqual([180, 20 - (LINE_HEIGHT - 20) / 2]);
    for (let elapsed = 16; elapsed < 440; elapsed += 16) reply.clock.frame();
    reply.clock.frame();
    expect(reply.busy()).toHaveLength(0);
    expect(flight.textContent).toBe('');
    expect(word.style.opacity).toBe('');
    expect(COMMON_WORDS).toContain(word.textContent);
  });

  it('with every flight busy, a piece shows without one', () => {
    const reply = cloudHost();
    const pieces = Array.from({ length: 25 }, (_, i) =>
      reply.add(` w${i}`, { left: 0, right: 10, bottom: 20 }),
    );
    expect(reply.busy()).toHaveLength(24);
    expect(pieces[24].hasAttribute('data-unflown')).toBe(true);
    expect(pieces[23].hasAttribute('data-unflown')).toBe(false);
  });

  it('fades the cloud and stops when streaming ends', () => {
    const reply = cloudHost();
    reply.add('Three', { left: 0, right: 50, bottom: 20 });
    expect(reply.cloud.hasAttribute('data-on')).toBe(true);
    reply.clock.frame();
    reply.engine.rendered(false, 0);
    expect(reply.cloud.hasAttribute('data-on')).toBe(false);
    let frames = 0;
    while (reply.clock.pending() && frames < 100) {
      reply.clock.frame();
      frames++;
    }
    expect(reply.clock.pending()).toBe(false);
    // The fade (0.4 s) and the last flight (0.44 s), then no more frames.
    expect(frames).toBeLessThan(40);
    expect(reply.engine.moving()).toBe(false);
    expect(reply.stops()).toBe(1);
  });

  it('a text written anew lands no flight: each is freed and its word given back', () => {
    const reply = cloudHost({ words: 1 });
    const word = reply.words()[0];
    reply.add('pasta', { left: 100, right: 150, bottom: 40 });
    reply.clock.frame();
    expect(reply.busy()).toHaveLength(1);
    reply.rewrite();
    expect(reply.busy()).toHaveLength(0);
    for (const flight of reply.flights()) {
      expect(flight.textContent).toBe('');
      expect(flight.hasAttribute('data-start') || flight.hasAttribute('data-land')).toBe(false);
    }
    expect(word.style.opacity).toBe('');
    // The anchor goes to the new text's line at once, not eased from the old one.
    reply.add(' oil', { left: 100, right: 130, bottom: 300 });
    reply.clock.frame();
    expect(placed(word)[1]).toBeGreaterThan(280);
  });

  it('runs no frames while hidden, and pieces that came meanwhile fly not', () => {
    const reply = cloudHost();
    reply.document.setHidden(true);
    const piece = reply.add('Three', { left: 0, right: 50, bottom: 20 });
    expect(reply.clock.requested).toBe(0);
    expect(reply.busy()).toHaveLength(0);
    expect(piece.hasAttribute('data-unflown')).toBe(true);
    reply.document.setHidden(false);
    const back = reply.add(' jars', { left: 50, right: 90, bottom: 20 });
    expect(back.hasAttribute('data-unflown')).toBe(true);
  });

  it('stops its frames and listeners when destroyed', () => {
    const reply = cloudHost();
    reply.add('Three', { left: 0, right: 50, bottom: 20 });
    reply.engine.destroy();
    expect(reply.clock.pending()).toBe(false);
    expect(reply.document.listeners.size).toBe(0);
  });
});
