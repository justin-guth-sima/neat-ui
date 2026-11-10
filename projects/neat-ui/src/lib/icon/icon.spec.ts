import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Rocket } from 'lucide';
import { NeatIcon } from './icon';
import iconStyles from './icon.css' with { loader: 'text' };
import { NEAT_ICON_NAMES, NeatIconName } from './icon-registry';

describe('NeatIcon', () => {
  let fixture: ComponentFixture<NeatIcon>;

  const svg = (): SVGSVGElement => fixture.nativeElement.querySelector('svg');

  beforeEach(async () => {
    fixture = TestBed.createComponent(NeatIcon);
    fixture.componentRef.setInput('name', 'viewer');
    await fixture.whenStable();
  });

  it('renders an svg for a registered name', () => {
    expect(svg()).not.toBeNull();
    expect(svg().querySelectorAll('rect, path, circle, line').length).toBeGreaterThan(0);
  });

  it('sizes the svg in both dimensions, 20 by default', async () => {
    expect(svg().getAttribute('width')).toBe('20');
    expect(svg().getAttribute('height')).toBe('20');

    fixture.componentRef.setInput('size', 32);
    await fixture.whenStable();

    expect(svg().getAttribute('width')).toBe('32');
    expect(svg().getAttribute('height')).toBe('32');
  });

  it('is hidden from assistive technology without a label', () => {
    expect(svg().getAttribute('aria-hidden')).toBe('true');
    expect(svg().hasAttribute('role')).toBe(false);
    expect(svg().hasAttribute('aria-label')).toBe(false);
  });

  it('is exposed as a labeled image with a label', async () => {
    fixture.componentRef.setInput('label', 'Viewer');
    await fixture.whenStable();

    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toBe('Viewer');
    expect(svg().getAttribute('aria-hidden')).not.toBe('true');
  });

  it('draws a different glyph for each name', async () => {
    const drawing = async (name: NeatIconName): Promise<string> => {
      fixture.componentRef.setInput('name', name);
      await fixture.whenStable();
      return svg().innerHTML;
    };

    expect(await drawing('sun')).not.toBe(await drawing('moon'));
  });

  it('draws the close icon as a cross, not as another registered glyph', async () => {
    const cross = await (async () => {
      fixture.componentRef.setInput('name', 'close');
      await fixture.whenStable();
      return svg().innerHTML;
    })();

    expect(cross).not.toBe('');
    // Lucide's X is two crossing strokes.
    expect(svg().querySelectorAll('path, line')).toHaveLength(2);
    for (const other of NEAT_ICON_NAMES.filter((name) => name !== 'close')) {
      fixture.componentRef.setInput('name', other);
      await fixture.whenStable();
      expect(svg().innerHTML, other).not.toBe(cross);
    }
  });

  it('draws every registered icon', async () => {
    for (const name of NEAT_ICON_NAMES) {
      fixture.componentRef.setInput('name', name);
      await fixture.whenStable();
      expect(svg().children.length, name).toBeGreaterThan(0);
    }
  });

  it.each(['play', 'pause', 'stop'] as const)(
    'draws %s filled with the text color, where the other glyphs are outlines',
    async (name) => {
      fixture.componentRef.setInput('name', name);
      await fixture.whenStable();
      const shapes = [...svg().querySelectorAll('path, rect')];

      expect(shapes.length).toBeGreaterThan(0);
      for (const shape of shapes) expect(shape.getAttribute('fill')).toBe('currentColor');
    },
  );

  it('leaves an outline glyph unfilled', async () => {
    expect(svg().querySelector('[fill]')).toBeNull();
  });

  describe('a Lucide glyph given as the name', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('name', Rocket);
      await fixture.whenStable();
    });

    it('draws the glyph at the given size', async () => {
      fixture.componentRef.setInput('size', 32);
      await fixture.whenStable();

      const shapes = Array.from(svg().children, (child) => child.tagName.toLowerCase());
      expect(shapes).toEqual(Rocket.map(([tag]) => tag));
      expect(svg().getAttribute('width')).toBe('32');
      expect(svg().getAttribute('height')).toBe('32');
    });

    it('is an image with the label when one is set, and hidden without', async () => {
      expect(svg().getAttribute('aria-hidden')).toBe('true');

      fixture.componentRef.setInput('label', 'Launch');
      await fixture.whenStable();

      expect(svg().getAttribute('role')).toBe('img');
      expect(svg().getAttribute('aria-label')).toBe('Launch');
    });

    it('names no kit icon on the host, which only the kit’s names do', async () => {
      expect(fixture.nativeElement.hasAttribute('data-icon')).toBe(false);

      fixture.componentRef.setInput('name', 'spinner');
      await fixture.whenStable();

      expect(fixture.nativeElement.getAttribute('data-icon')).toBe('spinner');
    });
  });

  describe('the spinner', () => {
    /** The stylesheet inside its `no-preference` media block, and the rest outside it. */
    function split(css: string): { inside: string; outside: string } {
      const start = css.indexOf('@media (prefers-reduced-motion: no-preference)');
      if (start < 0) return { inside: '', outside: css };
      const open = css.indexOf('{', start);
      let depth = 0;
      let end = open;
      for (; end < css.length; end++) {
        if (css[end] === '{') depth++;
        if (css[end] === '}' && --depth === 0) break;
      }
      return { inside: css.slice(open, end), outside: css.slice(0, start) + css.slice(end + 1) };
    }

    it('names its glyph on the host, which is what the stylesheet turns', async () => {
      fixture.componentRef.setInput('name', 'spinner');
      await fixture.whenStable();

      expect(fixture.nativeElement.getAttribute('data-icon')).toBe('spinner');
      expect(svg().children.length).toBeGreaterThan(0);
    });

    it('turns once a second, in one rule of the kit', () => {
      const { inside } = split(iconStyles);

      expect(inside).toMatch(
        /:host\(\[data-icon='spinner'\]\)\s+svg\s*\{[^}]*animation:\s*neat-icon-spin\s+1s\s+linear\s+infinite/,
      );
      expect(iconStyles).toMatch(/@keyframes neat-icon-spin\s*\{[^}]*rotate\(360deg\)/);
      expect(iconStyles.match(/animation\s*:/g)).toHaveLength(1);
    });

    it('does not turn at all for a user who asked for reduced motion', () => {
      const { outside } = split(iconStyles);

      expect(outside).not.toMatch(/animation\s*:/);
    });
  });

  it('rejects names outside the registry at compile time', () => {
    // @ts-expect-error 'no-such-icon' is not a NeatIconName
    const unknown: NeatIconName = 'no-such-icon';
    expect(unknown).toBeDefined();
  });
});
