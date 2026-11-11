import { TestBed } from '@angular/core/testing';
import { colorProbe, neatResolveColor, neatThemeColors } from './theme-colors';
import { ThemeService } from './theme.service';

type Pixel = [red: number, green: number, blue: number];

/**
 * A 2D context that parses what it is told to (any `#rrggbb`, and the notations in `known`) and
 * keeps its last fill otherwise, as a browser's does; jsdom has no canvas.
 */
class FakeContext {
  readonly assigned: string[] = [];
  private style = '#000000';
  private pixel: Pixel = [0, 0, 0];

  constructor(private readonly known: Record<string, Pixel> = {}) {}

  get fillStyle(): string {
    return this.style;
  }

  set fillStyle(css: string) {
    this.assigned.push(css);
    if (this.parse(css)) this.style = css;
  }

  clearRect(): void {
    this.pixel = [0, 0, 0];
  }

  fillRect(): void {
    this.pixel = this.parse(this.style) ?? this.pixel;
  }

  getImageData(): { data: Uint8ClampedArray } {
    return { data: new Uint8ClampedArray([...this.pixel, 255]) };
  }

  private parse(css: string): Pixel | undefined {
    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(css);
    if (hex) return [1, 2, 3].map((i) => parseInt(hex[i], 16)) as Pixel;
    return this.known[css];
  }
}

function useProbe(context: FakeContext | null): void {
  colorProbe.context = context as unknown as CanvasRenderingContext2D | null;
}

describe('neatResolveColor', () => {
  afterEach(() => (colorProbe.context = undefined));

  it('answers a color as sRGB channels from 0 to 1, from the pixel the probe draws', () => {
    useProbe(new FakeContext({ 'rgb(51, 102, 153)': [51, 102, 153] }));

    expect(neatResolveColor('rgb(51, 102, 153)')).toEqual([0.2, 0.4, 0.6]);
    expect(neatResolveColor('#ff0000')).toEqual([1, 0, 0]);
  });

  it('leaves the notation to the browser: an oklch color goes to the probe as written', () => {
    const context = new FakeContext({ 'oklch(0.6 0.15 250)': [0, 102, 204] });
    useProbe(context);

    expect(neatResolveColor('oklch(0.6 0.15 250)')).toEqual([0, 0.4, 0.8]);
    expect(context.assigned).toContain('oklch(0.6 0.15 250)');
  });

  it('answers null for a color the browser does not parse', () => {
    useProbe(new FakeContext());

    expect(neatResolveColor('not-a-color')).toBeNull();
    expect(neatResolveColor('')).toBeNull();
  });

  it('answers a color even when it is the one the probe starts from', () => {
    useProbe(new FakeContext());

    expect(neatResolveColor('#000000')).toEqual([0, 0, 0]);
    expect(neatResolveColor('#ffffff')).toEqual([1, 1, 1]);
  });

  it('answers null where there is no canvas', () => {
    useProbe(null);

    expect(neatResolveColor('#ff0000')).toBeNull();
  });

  it('asks for a canvas again after there was none, and keeps the one it gets', () => {
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValueOnce(null)
      .mockReturnValue(new FakeContext() as unknown as CanvasRenderingContext2D);

    expect(neatResolveColor('#ff0000')).toBeNull();
    expect(neatResolveColor('#ff0000')).toEqual([1, 0, 0]);
    expect(neatResolveColor('#00ff00')).toEqual([0, 1, 0]);
    expect(getContext).toHaveBeenCalledTimes(2);
    getContext.mockRestore();
  });
});

describe('neatThemeColors', () => {
  let sheet: HTMLStyleElement;

  beforeEach(() => {
    localStorage.clear();
    useProbe(new FakeContext());
    sheet = document.createElement('style');
    sheet.textContent = `
      :root { --spec-line: #336699; --spec-fill: #000000; }
      :root.neat-dark { --spec-line: #99ccff; }
    `;
    document.head.append(sheet);
  });

  afterEach(() => {
    sheet.remove();
    colorProbe.context = undefined;
    TestBed.inject(ThemeService).setScheme('light', { persist: false });
  });

  it('reads each token from the document element, resolved', () => {
    const colors = TestBed.runInInjectionContext(() =>
      neatThemeColors({ line: '--spec-line', fill: '--spec-fill', missing: '--spec-missing' }),
    );

    expect(colors()).toEqual({ line: [0.2, 0.4, 0.6], fill: [0, 0, 0], missing: null });
  });

  it('reads them again as soon as the scheme changes', () => {
    const theme = TestBed.inject(ThemeService);
    const colors = TestBed.runInInjectionContext(() => neatThemeColors({ line: '--spec-line' }));
    expect(colors().line).toEqual([0.2, 0.4, 0.6]);

    theme.setScheme('dark', { persist: false });

    expect(colors().line).toEqual([0.6, 0.8, 1]);
  });

  it('reads them from the element it is given', () => {
    const element = document.createElement('div');
    element.style.setProperty('--spec-line', '#ff0000');
    document.body.append(element);

    const colors = TestBed.runInInjectionContext(() =>
      neatThemeColors({ line: '--spec-line' }, () => element),
    );

    expect(colors().line).toEqual([1, 0, 0]);
    element.remove();
  });
});
