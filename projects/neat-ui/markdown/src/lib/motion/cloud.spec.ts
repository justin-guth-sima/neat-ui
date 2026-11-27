import { CloudEngine } from './cloud';
import { NEAT_CLOUD_BOX, sanitizedCloudBox, type NeatCloudBox } from './cloud-box';
import { CLOUD_WORDS } from './common-words';
import { motionHost, pieceElement } from './motion.testing';

const WIDTH = 600;
const LINE_HEIGHT = 24;
const HEIGHT = 400;
/** Every random a half: a word's share of the box's half sizes, (26 + 22) / 70. */
const SHARE = 48 / 70;

/** A reply with its cloud as the template renders it, its layout stubbed. */
function cloudHost(
  options: { words?: number; random?: () => number; box?: NeatCloudBox; width?: number } = {},
) {
  const host = document.createElement('div');
  host.style.lineHeight = `${LINE_HEIGHT}px`;
  const width = options.width ?? WIDTH;
  host.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height: HEIGHT, right: width, bottom: HEIGHT }) as DOMRect;
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
  const engine = new CloudEngine(deps, count, options.box ?? NEAT_CLOUD_BOX);
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

  it('places cloudWords words around the eased anchor, in the default box', () => {
    // Every random a half: each word at angle π, a share of 48/70 of the box's half sizes, turning
    // +0.5, its wobble at phase π.
    const reply = cloudHost({ words: 5, random: () => 0.5 });
    expect(reply.words().every((word) => CLOUD_WORDS.includes(word.textContent!))).toBe(true);
    expect(reply.words()[0].style.fontSize).toMatch(/em$/);
    reply.add('Three', { left: 270, right: 300, bottom: 40 });
    reply.clock.frame();
    // The first anchor is where it aims: 30 px after the line's start, 26 px below it.
    const angle = Math.PI + 0.5 * 0.016;
    const wobble = (now: number) => Math.sin(now / 600 + Math.PI) * 4;
    let [x, y] = placed(reply.words()[0]);
    expect(x).toBeCloseTo(300 + Math.cos(angle) * SHARE * 120);
    expect(y).toBeCloseTo(66 + Math.sin(angle) * SHARE * (32 - 4) + wobble(16));
    // A piece further right: the anchor eases 0.12 of the way each frame, to where the box (240
    // wide) still lies 30 px inside the side.
    reply.add(' jars', { left: 540, right: 580, bottom: 40 });
    reply.clock.frame();
    [x, y] = placed(reply.words()[0]);
    const anchor = 300 + (WIDTH - 30 - 120 - 300) * 0.12;
    expect(x).toBeCloseTo(anchor + Math.cos(angle + 0.008) * SHARE * 120);
    // The line did not move down: the anchor's y stays.
    expect(y).toBeCloseTo(66 + Math.sin(angle + 0.008) * SHARE * 28 + wobble(32));
  });

  it('the default box gives the orbits of 26 to 70 px before the squash', () => {
    for (const [random, radius] of [
      [0, 26],
      [0.999999, 70],
    ] as const) {
      const reply = cloudHost({ words: 1, random: () => random });
      reply.add('Three', { left: 270, right: 300, bottom: 40 });
      reply.clock.frame();
      const [x] = placed(reply.words()[0]);
      // The word's angle turns by its step; its x extent from the anchor is radius * 1.7 at most.
      expect(Math.abs(x - 300)).toBeLessThanOrEqual(radius * 1.7 + 1.5);
      expect(Math.abs(x - 300)).toBeGreaterThan(radius * 1.7 - 1.5);
    }
  });

  it('keeps every word inside the box, wobble and all', () => {
    const box = { width: 200, height: 40, x: 0, y: 50 };
    const reply = cloudHost({ words: 40, box, random: Math.random });
    reply.add('Three', { left: 200, right: 230, bottom: 100 });
    for (let frame = 0; frame < 300; frame++) {
      reply.clock.frame();
      for (const word of reply.words()) {
        const [x, y] = placed(word);
        // The anchor has eased to its aim: 200 + 0, 100 + 50.
        expect(Math.abs(x - 200)).toBeLessThanOrEqual(100 + 1e-3);
        expect(Math.abs(y - 150)).toBeLessThanOrEqual(20 + 1e-3);
      }
    }
  });

  it('a box wider than the host takes the host less 30 px at each side', () => {
    const reply = cloudHost({ box: { width: 2000, height: 40, x: 0, y: 30 }, random: Math.random });
    reply.add('Three', { left: 100, right: 130, bottom: 40 });
    for (let frame = 0; frame < 300; frame++) {
      reply.clock.frame();
      for (const word of reply.words()) {
        const [x] = placed(word);
        expect(x).toBeGreaterThanOrEqual(30 - 1e-3);
        expect(x).toBeLessThanOrEqual(WIDTH - 30 + 1e-3);
      }
    }
  });

  it('aims 26 px below the line however short the host still is', () => {
    const reply = cloudHost({ words: 1, random: () => 0 });
    reply.host.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: WIDTH, height: 24, right: WIDTH, bottom: 24 }) as DOMRect;
    reply.add('Three', { left: 270, right: 300, bottom: 24 });
    reply.clock.frame();
    // Anchor y 50; the word, at angle 0, differs only by its wobble of 4 px at most.
    expect(Math.abs(placed(reply.words()[0])[1] - 50)).toBeLessThanOrEqual(4);
  });

  it('takes a negative size as 0 and a non-finite one as the default, never NaN', () => {
    const bad = { width: Number.NaN, height: -5, x: Number.POSITIVE_INFINITY, y: Number.NaN };
    const reply = cloudHost({ words: 3, box: bad, random: Math.random });
    reply.add('Three', { left: 270, right: 300, bottom: 40 });
    reply.clock.frame();
    for (const word of reply.words()) {
      const [x, y] = placed(word);
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    }
    expect(sanitizedCloudBox(bad)).toEqual({ width: 240, height: 0, x: 30, y: 26 });
    expect(sanitizedCloudBox({ width: -3, height: 10, x: 1, y: 2 }).width).toBe(0);
  });

  it("with width 'full' the box spans the host and does not move sideways", () => {
    const box: NeatCloudBox = { width: 'full', height: 48, x: 200, y: 40 };
    const reply = cloudHost({ words: 1, box, random: () => 0.5 });
    for (const left of [10, 300, 560]) {
      reply.add(' w', { left, right: left + 20, bottom: 40 });
      for (let frame = 0; frame < 50; frame++) reply.clock.frame();
    }
    // Turning angle is the only thing that moves a word: its center is the host's.
    const [x] = placed(reply.words()[0]);
    const angle = Math.PI + 0.5 * 0.016 * 150;
    expect(x).toBeCloseTo(WIDTH / 2 + Math.cos(angle) * SHARE * ((WIDTH - 60) / 2));
  });

  it("a 'full' box stays inside a narrow host", () => {
    const reply = cloudHost({
      width: 100,
      box: { width: 'full', height: 40, x: 0, y: 30 },
      random: Math.random,
    });
    reply.add('Three', { left: 40, right: 70, bottom: 40 });
    for (let frame = 0; frame < 200; frame++) {
      reply.clock.frame();
      for (const word of reply.words()) {
        const [x] = placed(word);
        expect(x).toBeGreaterThanOrEqual(30 - 1e-3);
        expect(x).toBeLessThanOrEqual(70 + 1e-3);
      }
    }
  });

  it('the box offsets are from the newest piece and step down with its line', () => {
    const reply = cloudHost({
      words: 1,
      box: { width: 100, height: 20, x: -50, y: 100 },
      random: () => 0.5,
    });
    reply.add('a', { left: 300, right: 320, bottom: 40 });
    reply.clock.frame();
    // Aim (250, 140) from the first piece; angle π gives x - SHARE * 50.
    expect(placed(reply.words()[0])[0]).toBeCloseTo(250 + Math.cos(Math.PI + 0.008) * 50 * SHARE);
    reply.add(' b', { left: 20, right: 40, bottom: 64 });
    for (let frame = 0; frame < 200; frame++) reply.clock.frame();
    // A line lower: the box follows it down, 100 px below its bottom.
    const [, y] = placed(reply.words()[0]);
    expect(Math.abs(y - 164)).toBeLessThanOrEqual(10 + 1e-3);
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
    expect(CLOUD_WORDS).toContain(word.textContent);
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
