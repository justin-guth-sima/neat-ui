import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEAT_ICON_NAMES, NeatViewport } from '@sima/neat-ui';
import { IconFinderPage } from './icon-finder.page';
import { ICON_INDEX } from './icon-index';

class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

async function open(url = '/icon-finder') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'icon-finder', component: IconFinderPage }]),
      { provide: NeatViewport, useValue: { narrow: signal(false) } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, IconFinderPage);
  await harness.fixture.whenStable();
  const host = harness.routeNativeElement as HTMLElement;
  const settle = () => harness.fixture.whenStable();
  const section = (id: string) => host.querySelector(`section[aria-labelledby="${id}"]`);
  const tileNames = (id: string) =>
    Array.from(section(id)?.querySelectorAll('.tile .name') ?? [], (name) => name.textContent);
  const type = async (text: string) => {
    const field = host.querySelector('neat-search input') as HTMLInputElement;
    field.value = text;
    field.dispatchEvent(new Event('input'));
    await settle();
  };
  const panel = () => host.querySelector('[neatPageAside]') as HTMLElement;
  return { harness, host, settle, section, tileNames, type, panel };
}

// Every test renders the page's two thousand tiles, which jsdom builds slowly under a full run.
describe('IconFinderPage', { timeout: 20_000 }, () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows the kit names first, then every Lucide glyph, and says how many', async () => {
    const { host, tileNames } = await open();

    expect(tileNames('kit-names')).toEqual([...NEAT_ICON_NAMES]);
    expect(tileNames('lucide-glyphs')).toHaveLength(ICON_INDEX.lucide.length);
    expect(host.querySelector('neat-search .status')?.textContent?.trim()).toBe(
      `${NEAT_ICON_NAMES.length} kit names, ${ICON_INDEX.lucide.length.toLocaleString('en-US')} Lucide glyphs`,
    );
  });

  it('narrows both sections to what the search matches, and says when nothing does', async () => {
    const { host, section, tileNames, type } = await open();

    await type('delete');
    expect(tileNames('kit-names')).toEqual(['close']);
    expect(tileNames('lucide-glyphs')[0]).toBe('Delete');

    await type('zzzz');
    expect(section('kit-names')).toBeNull();
    expect(section('lucide-glyphs')).toBeNull();
    expect(host.querySelector('neat-search .status')?.textContent?.trim()).toBe('Nothing matches');
  });

  it('puts a picked icon in the address and shows it in the panel', async () => {
    const { host, settle, panel } = await open();
    expect(panel().textContent).toContain('Pick an icon');

    const play = Array.from(host.querySelectorAll<HTMLButtonElement>('.tile')).find(
      (tile) => tile.textContent?.trim() === 'play',
    )!;
    play.click();
    await settle();

    expect(TestBed.inject(Router).url).toBe('/icon-finder?icon=kit:play');
    expect(play.getAttribute('aria-pressed')).toBe('true');
    expect(panel().querySelector('[neatAsideTitle]')?.textContent?.trim()).toBe('play');
    expect(panel().querySelector('neat-code-block')?.textContent).toContain(
      '<neat-icon name="play" />',
    );
    expect(panel().textContent).toContain("Lucide's");
  });

  it('opens a linked glyph, says which kit name to take instead, and goes to it', async () => {
    const { settle, panel } = await open('/icon-finder?icon=lucide:X');

    expect(panel().querySelector('[neatAsideTitle]')?.textContent?.trim()).toBe('X');
    expect(panel().querySelector('neat-code-block')?.textContent).toContain(
      "import { X } from '@sima/neat-ui/lucide';",
    );
    const callout = panel().querySelector('neat-callout')!;
    expect(callout.textContent).toContain('The kit has a name for it');

    callout.querySelector<HTMLButtonElement>('button[neatInlineButton]')!.click();
    await settle();

    expect(TestBed.inject(Router).url).toBe('/icon-finder?icon=kit:close');
    expect(panel().querySelector('[neatAsideTitle]')?.textContent?.trim()).toBe('close');
  });

  it('searches for a tag the panel lists', async () => {
    const { host, settle, panel, tileNames } = await open('/icon-finder?icon=lucide:X');
    const tag = Array.from(panel().querySelectorAll<HTMLButtonElement>('.tags button')).find(
      (button) => button.textContent?.trim() === 'multiply',
    )!;

    tag.click();
    await settle();

    expect((host.querySelector('neat-search input') as HTMLInputElement).value).toBe('multiply');
    expect(tileNames('lucide-glyphs')).toContain('X');
  });

  it('ignores an icon the address names that does not exist', async () => {
    const { panel } = await open('/icon-finder?icon=lucide:NoSuchGlyph');

    expect(panel().textContent).toContain('Pick an icon');
  });
});
