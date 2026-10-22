import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NeatIcon } from './icon';
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

  it('is exposed as a labelled image with a label', async () => {
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

  it('rejects names outside the registry at compile time', () => {
    // @ts-expect-error 'no-such-icon' is not a NeatIconName
    const unknown: NeatIconName = 'no-such-icon';
    expect(unknown).toBeDefined();
  });
});
