import { NOTE_BOX } from './bench-note';
import { compareFingerprints, fingerprintOf, type HostFingerprint } from './fairness';

const BOX = { left: 0, top: 0, width: 1920, height: 1080 };
const T = { k: 0.5, x: 100, y: 50 };

/** An element whose box is `x, y, w, h` in diagram units, as drawn at the transform `T`. */
function drawn(
  tag: string,
  attrs: Record<string, string>,
  unit: [number, number, number, number],
  origin = { left: 0, top: 0 },
) {
  const element = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
  const [x, y, w, h] = unit;
  const left = origin.left + T.x + x * T.k;
  const top = origin.top + T.y + y * T.k;
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(left, top, w * T.k, h * T.k),
  );
  return element;
}

function page(origin = { left: 0, top: 0 }): HTMLElement {
  const root = document.createElement('div');
  root.append(
    drawn('div', { class: 'frame', 'data-node': 'f0' }, [0, 0, 600, 400], origin),
    drawn('div', { class: 'block', 'data-node': 'b0' }, [20, 40, 230, 46], origin),
    drawn('div', { class: 'block', 'data-node': 'b1' }, [300, 40, 230, 58], origin),
    drawn('div', { class: 'note', 'data-note': 'n0' }, [100, 200, NOTE_BOX.w, NOTE_BOX.h], origin),
    // The kit repeats a note's id on its leader and an edge's on its label: neither is a box.
    drawn('g', { class: 'leader', 'data-note': 'n0' }, [0, 0, 1, 1], origin),
    drawn('code', { class: 'edge-label', 'data-edge': 'e0' }, [0, 0, 1, 1], origin),
  );
  const edge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  edge.setAttribute('class', 'edge');
  edge.setAttribute('data-edge', 'e0');
  const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  hit.setAttribute('class', 'hit');
  hit.setAttribute('d', 'M 0 0 L 99 99');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('class', 'line');
  line.setAttribute('d', 'M 1 2 L 3 4');
  edge.append(hit, line);
  root.append(edge);
  return root;
}

const fingerprint = (over: Partial<HostFingerprint> = {}): HostFingerprint => ({
  host: 'kit',
  transform: T,
  boxes: {
    'node:f0': { x: 0, y: 0, w: 600, h: 400 },
    'node:b0': { x: 20, y: 40, w: 230, h: 46 },
    'note:n0': { x: 100, y: 200, w: NOTE_BOX.w, h: NOTE_BOX.h },
  },
  edges: { e0: 'M 1 2 L 3 4' },
  dom: 500,
  ...over,
});

describe('fingerprintOf', () => {
  it('reads every frame, block and note box in diagram units, and each edge’s line path', () => {
    const result = fingerprintOf(page(), 'kit', BOX, T);

    expect(result.host).toBe('kit');
    expect(result.transform).toEqual(T);
    expect(result.boxes).toEqual({
      'node:f0': { x: 0, y: 0, w: 600, h: 400 },
      'node:b0': { x: 20, y: 40, w: 230, h: 46 },
      'node:b1': { x: 300, y: 40, w: 230, h: 58 },
      'note:n0': { x: 100, y: 200, w: NOTE_BOX.w, h: NOTE_BOX.h },
    });
    // The line, not the hit path, and one entry per edge group.
    expect(result.edges).toEqual({ e0: 'M 1 2 L 3 4' });
  });

  it('is relative to the zoom box, wherever the box is on the page', () => {
    const origin = { left: 300, top: 120 };
    const result = fingerprintOf(page(origin), 'kit', { ...BOX, ...origin }, T);
    expect(result.boxes['node:b0']).toEqual({ x: 20, y: 40, w: 230, h: 46 });
  });

  it('counts the page’s elements', () => {
    expect(fingerprintOf(page(), 'kit', BOX, T).dom).toBeGreaterThan(5);
  });
});

describe('compareFingerprints', () => {
  it('has nothing to say about two hosts that draw the same', () => {
    const report = compareFingerprints(fingerprint(), fingerprint({ host: 'vflow' }));
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('accepts a box within a unit (a border drawn inside, a rounded layout)', () => {
    const vflow = fingerprint({
      host: 'vflow',
      boxes: {
        'node:f0': { x: 0.5, y: 0.5, w: 599, h: 399 },
        'node:b0': { x: 20, y: 40, w: 230, h: 46 },
        'note:n0': { x: 100, y: 200, w: NOTE_BOX.w, h: NOTE_BOX.h },
      },
    });
    expect(compareFingerprints(fingerprint(), vflow).ok).toBe(true);
  });

  it('names a box that is off by more, and one that is missing on either side', () => {
    const vflow = fingerprint({
      host: 'vflow',
      boxes: {
        'node:f0': { x: 0, y: 0, w: 600, h: 400 },
        'node:b0': { x: 20, y: 43, w: 230, h: 46 },
        'node:extra': { x: 0, y: 0, w: 1, h: 1 },
      },
    });
    const { problems } = compareFingerprints(fingerprint(), vflow);
    expect(problems.join('\n')).toMatch(/node:b0.*differs/);
    expect(problems.join('\n')).toMatch(/note:n0.*missing from vflow/);
    expect(problems.join('\n')).toMatch(/node:extra.*missing from kit/);
  });

  it('compares at the same transform, whichever each host stands at', () => {
    // The same diagram a few px apart on screen is still the same picture: units are compared.
    const vflow = fingerprint({ host: 'vflow', transform: { k: 0.502, x: 101, y: 50 } });
    expect(compareFingerprints(fingerprint(), vflow).ok).toBe(true);
  });

  it('flags two transforms that differ by more than 1 % in scale or 2 px', () => {
    const scale = fingerprint({ host: 'vflow', transform: { k: 0.52, x: 100, y: 50 } });
    expect(compareFingerprints(fingerprint(), scale).problems.join('\n')).toMatch(/transform/);
    const shift = fingerprint({ host: 'vflow', transform: { k: 0.5, x: 104, y: 50 } });
    expect(compareFingerprints(fingerprint(), shift).problems.join('\n')).toMatch(/transform/);
  });

  it('names an edge whose path differs, to the character', () => {
    const vflow = fingerprint({ host: 'vflow', edges: { e0: 'M 1 2 L 3 4.0' } });
    expect(compareFingerprints(fingerprint(), vflow).problems.join('\n')).toMatch(/edge e0/);
  });

  it('checks each host’s notes against the note box the others are placed at', () => {
    const wide = fingerprint({
      boxes: {
        'node:f0': { x: 0, y: 0, w: 600, h: 400 },
        'node:b0': { x: 20, y: 40, w: 230, h: 46 },
        'note:n0': { x: 100, y: 200, w: NOTE_BOX.w + 8, h: NOTE_BOX.h },
      },
    });
    const { problems } = compareFingerprints(wide, fingerprint({ host: 'vflow' }));
    expect(problems.join('\n')).toMatch(/note n0 measures 210 × 86 in kit.*202/);
  });

  it('records the element counts of both and flags a different number of drawn parts', () => {
    const report = compareFingerprints(
      fingerprint({ dom: 900 }),
      fingerprint({ host: 'vflow', dom: 700 }),
    );
    expect(report.dom).toEqual({ kit: 900, vflow: 700 });
    // More DOM on one side is a result, not a problem: only the drawn parts must match.
    expect(report.ok).toBe(true);
  });

  it('refuses two fingerprints of the same host, or of the none host', () => {
    expect(() => compareFingerprints(fingerprint(), fingerprint())).toThrow(/kit.*vflow/);
    expect(() => compareFingerprints(fingerprint({ host: 'none' }), fingerprint())).toThrow();
  });
});
