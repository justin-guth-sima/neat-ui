import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  buildColorScale,
  NEAT_DANGER_BASE,
  NEAT_PRIMARY_BASE,
  SIMA_PALETTE,
  ThemeService,
} from '@sima/neat-ui';
import { ColorScheme } from './1-color-scheme.example';
import { Palette } from './2-palette.example';
import { ColorScales } from './3-color-scales.example';
import { SurfaceScales } from './4-surface-scales.example';
import { ThemeColorsAsNumbers } from './5-theme-colors-as-numbers.example';
import { ResolveAColor } from './6-resolve-a-color.example';
import { Contrast } from './7-contrast.example';

/**
 * A canvas context that parses `#rrggbb` only and keeps the last color it was given when it is
 * given another, as a real one does, which is all `neatResolveColor` needs of it: jsdom has none.
 */
function fakeContext(): CanvasRenderingContext2D {
  let fill = '#000000';
  let painted = fill;
  return {
    get fillStyle() {
      return fill;
    },
    set fillStyle(value: string) {
      if (/^#[0-9a-f]{6}$/i.test(value)) fill = value.toLowerCase();
    },
    clearRect: () => undefined,
    fillRect: () => {
      painted = fill;
    },
    getImageData: () => ({
      data: [1, 3, 5].map((at) => parseInt(painted.slice(at, at + 2), 16)),
    }),
  } as unknown as CanvasRenderingContext2D;
}

const texts = (host: HTMLElement, selector: string): string[] =>
  Array.from(host.querySelectorAll(selector), (element) => element.textContent?.trim() ?? '');

async function render<T>(component: new () => T): Promise<ComponentFixture<T>> {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture;
}

describe('the color examples', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.inject(ThemeService).setScheme('light', { persist: false });
    document.documentElement.removeAttribute('style');
  });

  it('switch the scheme and store the choice, or show the other for this visit only', async () => {
    const theme = TestBed.inject(ThemeService);
    const fixture = await render(ColorScheme);
    const host = fixture.nativeElement as HTMLElement;
    const [switchTo, tryOther] = Array.from(host.querySelectorAll('button'));
    expect(host.querySelector('strong')?.textContent).toBe('light');

    tryOther.click();
    await fixture.whenStable();

    expect(theme.scheme()).toBe('dark');
    expect(host.querySelector('strong')?.textContent).toBe('dark');
    expect(localStorage.getItem('neat-ui:color-scheme')).toBeNull();
    expect(switchTo.textContent?.trim()).toBe('Switch to light');

    switchTo.click();
    await fixture.whenStable();

    expect(theme.scheme()).toBe('light');
    expect(localStorage.getItem('neat-ui:color-scheme')).toBe('light');
  });

  it('draw the palette, one chip per color with its value', async () => {
    const host = (await render(Palette)).nativeElement as HTMLElement;

    expect(texts(host, '.name')).toEqual(Object.keys(SIMA_PALETTE));
    expect(texts(host, '.showcase-code')).toEqual(Object.values(SIMA_PALETTE));
  });

  it('draw a ramp for each base color, the base as its step 500', async () => {
    const host = (await render(ColorScales)).nativeElement as HTMLElement;
    const ramps = Array.from(host.querySelectorAll('section'));

    expect(ramps.map((ramp) => ramp.querySelector('h4 .showcase-code')?.textContent)).toEqual([
      'NEAT_PRIMARY_BASE',
      'NEAT_DANGER_BASE',
      'NEAT_WARN_BASE',
      'NEAT_HIGHLIGHT_BASE',
      'NEAT_SERIES_TEAL_BASE',
    ]);
    expect(texts(ramps[0], '.name')).toEqual([
      '50',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      '700',
      '800',
      '900',
      '950',
    ]);
    expect(texts(ramps[0], '.ramp .showcase-code')).toEqual(
      Object.values(buildColorScale(NEAT_PRIMARY_BASE)),
    );
    expect(texts(ramps[1], '.ramp > div:nth-child(6) .showcase-code')).toEqual([NEAT_DANGER_BASE]);
  });

  it('draw the light and the dark surface ramps from white to their darkest', async () => {
    const host = (await render(SurfaceScales)).nativeElement as HTMLElement;
    const ramps = Array.from(host.querySelectorAll('section'));

    expect(texts(ramps[0], '.name')[0]).toBe('0');
    expect(texts(ramps[0], '.ramp .showcase-code')[0]).toBe(SIMA_PALETTE.white.toUpperCase());
    expect(texts(ramps[0], '.ramp .showcase-code').at(-1)).toBe(SIMA_PALETTE.text);
    expect(texts(ramps[1], '.ramp .showcase-code').at(-1)).toBe('#101010');
    expect(ramps.map((ramp) => ramp.querySelectorAll('.chip').length)).toEqual([12, 12]);
  });

  describe('with a canvas to resolve colors on', () => {
    beforeEach(() => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext());
    });

    it('give the theme’s tokens as numbers, and say so for one that is no color', async () => {
      document.documentElement.style.setProperty('--primary', '#336699');
      const host = (await render(ThemeColorsAsNumbers)).nativeElement as HTMLElement;
      const rows = Array.from(host.querySelectorAll('tbody tr'), (row) =>
        Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent?.trim()),
      );

      expect(rows).toContainEqual(['--primary', '', '0.200, 0.400, 0.600']);
      // The test's page has no kit stylesheet, so a token it does not set is no color.
      expect(rows).toContainEqual(['--success', '', 'not a color']);
      expect(rows).toHaveLength(6);
    });

    it('resolve what is typed, as numbers, and answer for text that is no color', async () => {
      const fixture = await render(ResolveAColor);
      const host = fixture.nativeElement as HTMLElement;
      const input = host.querySelector('input') as HTMLInputElement;
      const result = (): string | undefined => host.querySelector('.showcase-code')?.textContent;
      const type = async (text: string): Promise<void> => {
        input.value = text;
        input.dispatchEvent(new Event('input'));
        await fixture.whenStable();
      };

      await type('#336699');
      expect(result()?.trim()).toBe('0.200, 0.400, 0.600');

      await type('not a color at all');
      expect(result()?.trim()).toBe('not a color');
    });
  });

  it('measure the contrast of two colors and ask for #RRGGBB otherwise', async () => {
    const fixture = await render(Contrast);
    const host = fixture.nativeElement as HTMLElement;
    const [text, fill] = Array.from(host.querySelectorAll('input'));
    const result = (): string => host.querySelector('.showcase-code')?.textContent?.trim() ?? '';
    const type = async (input: HTMLInputElement, value: string): Promise<void> => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };

    expect(result()).toMatch(/^\d+\.\d\d:1 AA$/);

    await type(text, '#ffffff');
    await type(fill, '#B3541B');
    expect(result()).toBe('5.00:1 AA');

    await type(fill, '#d26728');
    expect(result()).toMatch(/below AA$/);

    await type(fill, 'orange');
    expect(result()).toBe('Both colors as #RRGGBB.');
  });
});
