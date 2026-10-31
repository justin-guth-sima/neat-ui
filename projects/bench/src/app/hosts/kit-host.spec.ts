import { TestBed } from '@angular/core/testing';
import { NeatDiagramMessages } from '@sima/neat-ui/diagram';
import { D1 } from '../synth/synth-diagram';
import { BenchLoad } from './bench-load';
import { stubLayout } from './browser.testing';
import { KitHost } from './kit-host';

describe('KitHost', () => {
  beforeEach(() => {
    stubLayout();
    // Only the feed's interval is faked: change detection's own timers stay real.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    // The host goes first, so nothing it scheduled outlives the stand-ins.
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(KitHost);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws the step’s diagram with neat-diagram, every note a rate card on its edge', async () => {
    const element = await render();
    const diagram = element.querySelector('neat-diagram')!;

    expect(diagram.querySelectorAll('.block')).toHaveLength(D1.blocks);
    expect(diagram.querySelectorAll('.edges .edge')).toHaveLength(D1.edges);
    const notes = Array.from(diagram.querySelectorAll('.note neat-diagram-rate-card'));
    expect(notes).toHaveLength(D1.notes);
    const synth = TestBed.inject(BenchLoad).synth();
    expect(notes.map((card) => card.querySelector('.label')?.textContent)).toEqual(
      (synth.diagram.overview.notes ?? []).map((note) => note.edges?.[0]),
    );
  });

  it('puts the kit’s dot layer in the diagram and feeds it the step’s messages', async () => {
    const push = vi.spyOn(NeatDiagramMessages.prototype, 'push');
    const element = await render();

    expect(element.querySelector('neat-diagram > neat-diagram-messages')).not.toBeNull();
    const { messageEdges } = TestBed.inject(BenchLoad).synth();
    expect(push).toHaveBeenCalled();
    for (const [edge] of push.mock.calls) expect(messageEdges).toContain(edge);
  });
});
