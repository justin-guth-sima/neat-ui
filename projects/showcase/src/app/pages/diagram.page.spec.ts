import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NeatDiagramMessages, NeatDiagramView } from '@sima/neat-ui/diagram';
import { App } from '../app';
import { appConfig } from '../app.config';

/** jsdom has no ResizeObserver; these specs check what the page draws and opens, not sizes. */
class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('the diagram page', () => {
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
    await TestBed.inject(Router).navigateByUrl('/legacy/diagram');
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('draws the reference sheet’s three examples, each with its legend', () => {
    const examples = ['A messaging pipeline', 'A compile flow', 'A detector’s model graph'];
    for (const label of examples) {
      const diagram = figure(label);
      expect(diagram, label).not.toBeNull();
      expect(
        diagram.closest('section')?.querySelector('neat-diagram-legend'),
        label,
      ).not.toBeNull();
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

  it('gives the pipeline’s Decode a body from the app’s neatDiagramBlock template', () => {
    const pipeline = figure('A messaging pipeline');
    expect(pipeline.querySelector('[data-node="decode"] .body')?.textContent?.trim()).toBe(
      '30.0 fps · 1080p',
    );
    // A block the template renders nothing for keeps its card as it is.
    expect(pipeline.querySelector('[data-node="camera"] .body')?.textContent?.trim()).toBe('');
  });

  it('moves the pipeline’s messages, its note reading an edge’s rate', () => {
    const pipeline = figure('A messaging pipeline');
    expect(pipeline.querySelector('neat-diagram-messages canvas')).not.toBeNull();
    for (const [note, label] of [
      ['tracker-rate', 'Tracker → Gateway'],
      ['camera-rate', 'Camera → Decode'],
    ]) {
      const card = pipeline.querySelector(`[data-note="${note}"] neat-diagram-rate-card`);
      expect(card?.querySelector('.label')?.textContent, note).toBe(label);
      expect(card?.querySelector('.numbers')?.textContent, note).toMatch(
        /\d+ msg\/s\s*[\d.]+ MB\/s/,
      );
      expect(card?.querySelector('neat-sparkline'), note).not.toBeNull();
    }
  });

  it('tunes the pipeline’s dots from the toolbar’s Animation panel', async () => {
    const trigger = root().querySelector<HTMLButtonElement>(
      'header button[aria-label="Animation"]',
    );
    expect(trigger).not.toBeNull();
    trigger!.click();
    await fixture.whenStable();
    expect(document.querySelector('[role="dialog"][aria-label="Animation"]')).not.toBeNull();
  });

  it('pushes ten thousand messages in one tick from the toolbar’s Burst', () => {
    const push = vi.spyOn(NeatDiagramMessages.prototype, 'push');
    const button = Array.from(root().querySelectorAll<HTMLButtonElement>('header button')).find(
      (b) => b.textContent?.trim() === 'Burst',
    ) as HTMLButtonElement;
    expect(button).toBeDefined();
    push.mockClear();
    button.click();
    expect(push.mock.calls.length).toBeGreaterThanOrEqual(10_000);
  });

  it('shows a ghost and a muted block and a note in the compile flow', () => {
    const flow = figure('A compile flow');
    expect(flow.querySelector('[data-node="accuracy"]')?.getAttribute('data-look')).toBe('ghost');
    expect(flow.querySelector('[data-node="calibration"]')?.getAttribute('data-look')).toBe(
      'muted',
    );
    expect(flow.querySelector('[data-note="compile-result"]')?.textContent).toContain('41 MB');
  });

  it('opens Stages, then Dark5 inside it, with the path as breadcrumbs', async () => {
    const graph = figure('A detector’s model graph');
    await press(graph, 'Open Stages');
    expect(blocks(graph)).toEqual(expect.arrayContaining(['dark2', 'dark3', 'dark4', 'dark5']));
    expect(crumbs(graph)).toEqual(['Stages']);

    await press(graph, 'Open Dark5');
    expect(blocks(graph)).toEqual(expect.arrayContaining(['dark5-conv', 'dark5-spp', 'dark5-csp']));
    expect(crumbs(graph)).toEqual(['Stages', 'Dark5']);
    expect(graph.querySelector('button[aria-label="Back to Stages"]')).not.toBeNull();
  });

  it('opens the Detector on a level placed by neatDrillDownLevel', async () => {
    const pipeline = figure('A messaging pipeline');
    await press(pipeline, 'Open Detector');
    // Its steps inside, what feeds it on the left, what it feeds on the right.
    expect(blocks(pipeline).sort()).toEqual(['decode', 'nms', 'resize', 'tracker', 'yolox']);
    expect(pipeline.querySelector('.frame[data-node="detector"]')).not.toBeNull();
    expect(crumbs(pipeline)).toEqual(['Detector']);
  });

  it('shows a step’s rate card with its stage time in the Detector’s level', async () => {
    const pipeline = figure('A messaging pipeline');
    await press(pipeline, 'Open Detector');
    // The feed's first batch (99 ms after the page rendered) sets the stage time shown.
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(pipeline.querySelector('[data-note="yolox-rate"] .stage')).not.toBeNull();
    });
    const card = pipeline.querySelector('[data-note="yolox-rate"] neat-diagram-rate-card');
    expect(card?.querySelector('.label')?.textContent).toBe('YOLOX → NMS');
    expect(card?.querySelector('.stage')?.textContent).toMatch(/Stage\s+1[4-6]\.\d\s+ms/);
    expect(card?.querySelector('.numbers')?.textContent).toMatch(/\d+ msg\/s/);
    expect(card?.querySelector('neat-sparkline')).toBeNull();
  });

  it('fits every example again from the toolbar’s Fit', () => {
    const fit = vi.spyOn(NeatDiagramView.prototype, 'fit');
    const button = Array.from(root().querySelectorAll<HTMLButtonElement>('header button')).find(
      (b) => b.textContent?.trim() === 'Fit',
    ) as HTMLButtonElement;
    button.click();
    expect(fit).toHaveBeenCalledTimes(3);
  });
});
