import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NeatTileAspect } from './pack';
import { NeatTileGrid, NeatTileLayout } from './tile-grid';

/** A ResizeObserver that reports only when a test says so, with the box that test chooses. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];

  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  resize(width: number, height: number): void {
    const entry = { target: this.observed[0], contentRect: { width, height } };
    this.callback([entry as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

@Component({
  imports: [NeatTileGrid],
  template: `
    <neat-tile-grid
      [tileWidth]="tileWidth()"
      [aspect]="aspect()"
      [gap]="gap()"
      [count]="count()"
      (layout)="layouts.push($event)"
    >
      <div class="item">A</div>
      <div class="item">B</div>
    </neat-tile-grid>
  `,
})
class Host {
  readonly tileWidth = signal(300);
  readonly aspect = signal<NeatTileAspect>('16:9');
  readonly gap = signal<number | undefined>(undefined);
  readonly count = signal(30);
  readonly layouts: NeatTileLayout[] = [];
}

describe('NeatTileGrid', () => {
  let fixture: ComponentFixture<Host>;

  const host = () => fixture.componentInstance;
  const grid = (): HTMLElement => fixture.nativeElement.querySelector('.grid');
  const observer = (): FakeResizeObserver => FakeResizeObserver.instances[0];
  const variable = (name: string): string => grid().style.getPropertyValue(name);

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  }

  async function resize(width: number, height: number): Promise<void> {
    observer().resize(width, height);
    await fixture.whenStable();
  }

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('observes its own box, not its parent or the shell', async () => {
    await create();

    expect(observer().observed).toEqual([fixture.nativeElement.querySelector('neat-tile-grid')]);
  });

  it('projects its items into the grid', async () => {
    await create();

    expect(Array.from(grid().children).map((item) => item.textContent)).toEqual(['A', 'B']);
  });

  it('emits nothing before its box has been measured', async () => {
    await create();

    expect(host().layouts).toEqual([]);
  });

  it('emits a new layout when its box resizes', async () => {
    await create();

    await resize(1920, 1000);
    await resize(1280, 720);

    expect(host().layouts).toEqual([
      {
        columns: 6,
        rows: 5,
        perPage: 30,
        tileWidth: 300,
        tileHeight: 168.75,
        gap: 8,
        areaWidth: 1920,
        areaHeight: 1000,
      },
      {
        columns: 4,
        rows: 4,
        perPage: 16,
        tileWidth: 300,
        tileHeight: 168.75,
        gap: 8,
        areaWidth: 1280,
        areaHeight: 720,
      },
    ]);
  });

  it('emits a new layout when tileWidth changes', async () => {
    await create();
    await resize(1920, 1000);

    host().tileWidth.set(600);
    await fixture.whenStable();

    expect(host().layouts.map((layout) => [layout.tileWidth, layout.columns, layout.rows])).toEqual(
      [
        [300, 6, 5],
        [600, 3, 2],
      ],
    );
  });

  it('emits a new layout when the aspect changes', async () => {
    await create();
    await resize(1920, 1000);

    host().aspect.set('1:1');
    await fixture.whenStable();

    expect(host().layouts.at(-1)).toMatchObject({ tileHeight: 300, rows: 3 });
  });

  it('emits again only when a value changed, not for an identical resize', async () => {
    await create();

    await resize(1920, 1000);
    await resize(1920, 1000);
    await resize(1920, 1000);
    expect(host().layouts).toHaveLength(1);

    await resize(1920, 1001);
    expect(host().layouts).toHaveLength(2);
  });

  it('does not emit when the count changes, since the layout does not depend on it', async () => {
    await create();
    await resize(1920, 1000);

    host().count.set(7);
    await fixture.whenStable();

    expect(host().layouts).toHaveLength(1);
  });

  it('lays tiles out at the packed size with fixed tracks, centred', async () => {
    await create();
    await resize(1920, 1000);

    expect(variable('--grid-columns')).toBe('6');
    expect(variable('--grid-tile-width')).toBe('300px');
    expect(variable('--grid-tile-height')).toBe('168.75px');
    expect(grid().dataset['ready']).toBe('true');
  });

  it('centres fewer items than fit as a block of their own columns', async () => {
    await create();
    host().count.set(2);
    await resize(1920, 1000);

    expect(variable('--grid-columns')).toBe('2');
  });

  it('keeps one column when there are no items', async () => {
    await create();
    host().count.set(0);
    await resize(1920, 1000);

    expect(variable('--grid-columns')).toBe('1');
  });

  it('is not shown until its box has been measured', async () => {
    await create();
    expect(grid().dataset['ready']).toBe('false');

    await resize(1920, 1000);
    expect(grid().dataset['ready']).toBe('true');
  });

  it('treats a box with no area as not measured: no emit, nothing shown', async () => {
    await create();

    await resize(0, 0);
    await resize(1920, 0);
    await resize(0, 1000);

    expect(host().layouts).toEqual([]);
    expect(grid().dataset['ready']).toBe('false');
  });

  it('keeps the last layout when its box collapses, instead of reporting an empty one', async () => {
    await create();
    await resize(1920, 1000);

    await resize(0, 0);

    expect(host().layouts).toHaveLength(1);
    expect(host().layouts[0]).toMatchObject({ areaWidth: 1920, areaHeight: 1000 });
  });

  describe('gap', () => {
    it('falls back to 8 px when the spacing token cannot be resolved (jsdom, no kit stylesheet)', async () => {
      await create();
      await resize(1920, 1000);

      expect(variable('--grid-gap')).toBe('8px');
    });

    it('takes the resolved --neat-space-2 token when the stylesheet defines it', async () => {
      // The grid's stylesheet sets `gap: var(--neat-space-2)`, so the computed column gap is the
      // token in pixels.
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        columnGap: '12px',
      } as CSSStyleDeclaration);
      await create();
      await resize(1920, 1000);

      expect(variable('--grid-gap')).toBe('12px');
      // 1920 + 12 over 312 is 6.1 columns; 1000 + 12 over 180.75 is 5.6 rows.
      expect(host().layouts[0]).toMatchObject({ columns: 6, rows: 5 });
    });

    it('reports the gap it used: the fallback, the resolved token or the explicit input', async () => {
      await create();
      await resize(1920, 1000);
      expect(host().layouts.at(-1)?.gap).toBe(8);

      host().gap.set(0);
      await fixture.whenStable();
      expect(host().layouts.at(-1)?.gap).toBe(0);
    });

    it('reports the resolved --neat-space-2 token as the gap', async () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        columnGap: '12px',
      } as CSSStyleDeclaration);
      await create();
      await resize(1920, 1000);

      expect(host().layouts[0].gap).toBe(12);
    });

    it('emits a new layout when only the gap changes, even if the packing does not', async () => {
      await create();
      await resize(1920, 1000);

      host().gap.set(10);
      await fixture.whenStable();

      expect(host().layouts.map((layout) => [layout.columns, layout.rows, layout.gap])).toEqual([
        [6, 5, 8],
        [6, 5, 10],
      ]);
    });

    it('is resolved once, when the grid initialises', async () => {
      const computed = vi
        .spyOn(window, 'getComputedStyle')
        .mockReturnValue({ columnGap: '12px' } as CSSStyleDeclaration);
      await create();
      await resize(1920, 1000);
      const reads = computed.mock.calls.length;

      computed.mockReturnValue({ columnGap: '40px' } as CSSStyleDeclaration);
      await resize(1280, 720);

      expect(computed.mock.calls.length).toBe(reads);
      expect(variable('--grid-gap')).toBe('12px');
    });

    it('is read before the grid applies a gap of its own, even with an explicit gap input', async () => {
      // A gap bound first would be read back as "the token" and outlive the input.
      let inlineGapAtRead: string | undefined;
      vi.spyOn(window, 'getComputedStyle').mockImplementation(() => {
        inlineGapAtRead = grid().style.getPropertyValue('--grid-gap');
        return { columnGap: '12px' } as CSSStyleDeclaration;
      });
      fixture = TestBed.createComponent(Host);
      fixture.componentInstance.gap.set(0);
      await fixture.whenStable();

      expect(inlineGapAtRead).toBe('');
    });

    it('is overridden by an explicit gap input', async () => {
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        columnGap: '12px',
      } as CSSStyleDeclaration);
      fixture = TestBed.createComponent(Host);
      fixture.componentInstance.gap.set(0);
      await fixture.whenStable();
      await resize(1800, 1000);

      expect(variable('--grid-gap')).toBe('0px');
      // Six tiles of 300 px fill 1800 px only without a gap; with the token's 12 px it would be 5.
      expect(host().layouts[0]).toMatchObject({ columns: 6, rows: 5 });
    });

    it('repacks when the gap input changes', async () => {
      await create();
      host().gap.set(0);
      await resize(1900, 1000);
      expect(host().layouts.at(-1)).toMatchObject({ columns: 6, rows: 5 });

      host().gap.set(100);
      await fixture.whenStable();
      expect(host().layouts.at(-1)).toMatchObject({ columns: 5, rows: 4 });
    });
  });

  it('stops observing when destroyed', async () => {
    await create();

    fixture.destroy();

    expect(observer().disconnected).toBe(true);
  });

  it('centres the block of tiles in both directions', async () => {
    await create();
    const style = getComputedStyle(grid());

    expect(style.display).toBe('grid');
    expect(style.justifyContent).toBe('center');
    expect(style.alignContent).toBe('center');
  });

  describe('host', () => {
    it('fills its parent without scrolling and may shrink below its content', async () => {
      await create();
      const style = getComputedStyle(fixture.nativeElement.querySelector('neat-tile-grid'));

      expect(style.display).toBe('block');
      expect(style.height).toBe('100%');
      expect(style.width).toBe('100%');
      expect(style.minHeight).toBe('0px');
      expect(style.overflow).toBe('hidden');
    });
  });
});
