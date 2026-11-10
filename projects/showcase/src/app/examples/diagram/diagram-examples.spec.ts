import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NeatDiagramView } from '@sima/neat-ui/diagram';
import { App } from '../../app';
import { appConfig } from '../../app.config';

/** jsdom has no ResizeObserver; these specs check what the examples draw and open, not sizes. */
class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('the diagram examples on the diagram topic', () => {
  let fixture: ComponentFixture<App>;

  const root = (): HTMLElement => fixture.nativeElement;
  const figure = (label: string): HTMLElement =>
    root().querySelector(`neat-diagram[aria-label="${label}"]`) as HTMLElement;
  const blocks = (diagram: HTMLElement): string[] =>
    Array.from(diagram.querySelectorAll<HTMLElement>('.block'), (b) => b.dataset['node'] ?? '');
  const press = async (diagram: HTMLElement, name: string): Promise<void> => {
    (diagram.querySelector(`button[aria-label="${name}"]`) as HTMLButtonElement).click();
    await fixture.whenStable();
  };
  const crumbs = (diagram: HTMLElement): string[] =>
    // Each crumb's words, without the decorative "›" before it.
    Array.from(diagram.querySelectorAll('neat-breadcrumbs li'), (li) =>
      (li.textContent ?? '').replace('›', '').trim(),
    );

  beforeEach(async () => {
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    TestBed.configureTestingModule({ providers: appConfig.providers });
    fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/components/diagram/diagram');
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('draws the reference sheet’s three examples, each with its legend', () => {
    const examples = ['A messaging pipeline', 'A compile flow', 'A detector’s model graph'];
    for (const label of examples) {
      const diagram = figure(label);
      expect(diagram, label).not.toBeNull();
      expect(diagram.parentElement?.querySelector('neat-diagram-legend'), label).not.toBeNull();
    }
    expect(blocks(figure('A messaging pipeline'))).toEqual(
      expect.arrayContaining(['camera', 'decode', 'detector', 'tracker', 'gateway', 'browser']),
    );
    expect(blocks(figure('A compile flow'))).toEqual(
      expect.arrayContaining(['onnx', 'surgery', 'calibration', 'quantize', 'accuracy', 'archive']),
    );
    expect(blocks(figure('A detector’s model graph'))).toEqual(
      expect.arrayContaining(['input', 'stem', 'stages', 'head', 'nms', 'boxes']),
    );
  });

  it('gives the pipeline’s Decode a body and its edges a note from the example’s templates', () => {
    const pipeline = figure('A messaging pipeline');
    expect(pipeline.querySelector('[data-node="decode"] .body')?.textContent?.trim()).toBe(
      '30.0 fps · 1080p',
    );
    // A block the template renders nothing for keeps its card as it is.
    expect(pipeline.querySelector('[data-node="camera"] .body')?.textContent?.trim()).toBe('');
    expect(pipeline.querySelector('[data-note="camera-rate"]')?.textContent).toContain(
      'Camera → Decode',
    );
    expect(pipeline.querySelector('[data-note="tracker-rate"]')?.textContent).toContain(
      '10 results/s',
    );
  });

  it('grays out the pipeline’s Browser card whole, and says why in its body', () => {
    const browser = figure('A messaging pipeline').querySelector('[data-node="browser"]');
    expect(browser?.classList).toContain('opacity-55');
    expect(browser?.querySelector('.body')?.textContent?.trim()).toBe('No data for 5 s');
    expect(
      figure('A messaging pipeline').querySelector('[data-node="camera"]')?.classList,
    ).not.toContain('opacity-55');
  });

  it('shows a figure after the model graph’s brace, from the block template', async () => {
    const graph = figure('A detector’s model graph');
    await press(graph, 'Open Stages');
    const brace = graph.querySelector('[data-node="outputs"]');
    expect(brace?.querySelector('.label')?.textContent).toBe('To the head');
    expect(brace?.querySelector('.bracket-text .bracket-figure')?.textContent).toBe('3 tensors');
  });

  it('shows a ghost and a muted block and a note in the compile flow', () => {
    const flow = figure('A compile flow');
    expect(flow.querySelector('[data-node="accuracy"]')?.getAttribute('data-look')).toBe('ghost');
    expect(flow.querySelector('[data-node="calibration"]')?.getAttribute('data-look')).toBe(
      'muted',
    );
    expect(flow.querySelector('[data-note="compile-result"]')?.textContent).toContain('41 MB');
  });

  it('opens Stages, then Dark5 inside it, with the path as breadcrumbs and as text', async () => {
    const graph = figure('A detector’s model graph');
    const path = (): string | undefined =>
      graph.parentElement?.querySelector('.showcase-muted')?.textContent?.trim();
    expect(path()).toBe('Open levels: []');

    await press(graph, 'Open Stages');
    expect(blocks(graph)).toEqual(expect.arrayContaining(['dark2', 'dark3', 'dark4', 'dark5']));
    expect(crumbs(graph)).toEqual(['Stages']);

    await press(graph, 'Open Dark5');
    expect(blocks(graph)).toEqual(expect.arrayContaining(['dark5-conv', 'dark5-spp', 'dark5-csp']));
    expect(crumbs(graph)).toEqual(['Stages', 'Dark5']);
    expect(graph.querySelector('button[aria-label="Back to Stages"]')).not.toBeNull();
    expect(path()).toBe('Open levels: ["stages","dark5"]');
  });

  it('opens the Detector on a level placed by neatDrillDownLevel', async () => {
    const pipeline = figure('A messaging pipeline');
    await press(pipeline, 'Open Detector');
    // Its steps inside, what feeds it on the left, what it feeds on the right.
    expect(blocks(pipeline).sort()).toEqual(['decode', 'nms', 'resize', 'tracker', 'yolox']);
    expect(pipeline.querySelector('.frame[data-node="detector"]')).not.toBeNull();
    expect(crumbs(pipeline)).toEqual(['Detector']);
    expect(pipeline.querySelector('[data-note="yolox-rate"]')?.textContent).toContain('14.8 ms');
  });

  it('leaves the edge sides example’s archive copy on its own fromSide, the other on the outSide', () => {
    const sides = figure('A source with a side chosen by an edge');
    const start = (id: string): string | undefined =>
      sides
        .querySelector(`[data-edge="${id}"] path.line`)
        ?.getAttribute('d')
        ?.split(' L ')[0]
        .split(' Q ')[0];

    // The Source is 150 × 46 at the origin: its right side's middle, and its bottom's.
    expect(start('source-display')).toBe('M 150 23');
    expect(start('source-archive')).toBe('M 75 46');
  });

  it('switches what the pointer dims from the highlight example’s segmented control', async () => {
    const flow = figure('A compile flow to hover');
    const dimmed = (): number => flow.querySelectorAll('.dim').length;
    const hover = async (target: Element): Promise<void> => {
      target.dispatchEvent(
        new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
      );
      await fixture.whenStable();
    };
    const choose = async (label: string): Promise<void> => {
      const option = Array.from(
        flow.parentElement!.querySelectorAll<HTMLElement>('neat-segmented [role="radio"]'),
      ).find((el) => el.textContent?.includes(label));
      option!.click();
      await fixture.whenStable();
    };
    const block = flow.querySelector('.block[data-node="onnx"]')!;
    const edge = flow.querySelector('g[data-edge] .hit')!;

    // Starts on edges: a block dims nothing, an edge dims the rest.
    await hover(block);
    expect(dimmed()).toBe(0);
    await hover(edge);
    expect(dimmed()).toBeGreaterThan(0);

    await choose('None');
    expect(dimmed()).toBe(0);
    await hover(edge);
    expect(dimmed()).toBe(0);

    await choose('All');
    await hover(block);
    expect(dimmed()).toBeGreaterThan(0);
  });

  it('fills its card with the pipeline, edge to edge, the legend over it', () => {
    const diagram = figure('A messaging pipeline, edge to edge');
    const live = diagram.closest('.live') as HTMLElement;

    expect(live.getAttribute('data-unpadded')).toBe('true');
    expect(blocks(diagram)).toEqual(expect.arrayContaining(['camera', 'decode', 'detector']));
    expect(diagram.parentElement?.querySelector('neat-diagram-legend.legend')).not.toBeNull();
    // The other examples keep the inset.
    expect(figure('A compile flow').closest('.live')?.getAttribute('data-unpadded')).toBe('false');
  });

  it('fits every example again from the top bar’s Fit', () => {
    const fit = vi.spyOn(NeatDiagramView.prototype, 'fit');
    const button = Array.from(root().querySelectorAll<HTMLButtonElement>('header button')).find(
      (b) => b.textContent?.trim() === 'Fit',
    ) as HTMLButtonElement;

    button.click();

    expect(fit).toHaveBeenCalledTimes(6);
  });
});
