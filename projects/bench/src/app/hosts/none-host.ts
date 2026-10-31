import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import type { DiagramTransform } from '@bench/diagram-seam';
import { NeatDiagramMessages } from '@sima/neat-ui/diagram';
import { reducerGestures } from '../run/gesture-player';
import { BenchDiagramContext } from './bench-diagram-context';
import { registerBenchHost } from './bench-host';
import { BenchLoad, feedMessages } from './bench-load';
import { startTransform } from './scene';

/** What the context is bound to: the transform moves through `setTransform` instead. */
const IDENTITY: DiagramTransform = { k: 1, x: 0, y: 0 };

/**
 * The floor (design 3.1, `none`): the kit's dot layer alone over an empty box, with the context
 * the vflow host gives it (the kit's routes, the cards as covers, every edge id) and the step's
 * messages, so a frame here is what the dots cost by themselves. The box draws nothing and does
 * not pan or zoom; the layer shows the scene at the kit's fit for the box, where the other hosts
 * start.
 */
@Component({
  selector: 'bench-none-host',
  imports: [BenchDiagramContext, NeatDiagramMessages],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './host.css',
  template: `
    @let scene = load.scene();
    <div
      #box
      class="box"
      benchDiagramContext
      [level]="scene.level"
      [covers]="scene.covers"
      [edgeIds]="scene.edgeIds"
      [viewTransform]="IDENTITY"
    >
      <neat-diagram-messages />
    </div>
  `,
})
export class NoneHost {
  protected readonly load = inject(BenchLoad);
  protected readonly IDENTITY = IDENTITY;
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  private readonly context = viewChild.required(BenchDiagramContext);
  private readonly messages = viewChild(NeatDiagramMessages);

  constructor() {
    feedMessages(this.messages);
    // The kit's fit, once laid out and for each new scene; a measured run's window keeps its size.
    // Every move of the transform, this one and the gestures', goes through `setTransform`: the
    // floor has no change detection of its own to add to a frame.
    afterRenderEffect(() => {
      const scene = this.load.scene();
      untracked(() => this.fit(scene));
    });
    registerBenchHost(() => ({
      id: 'none',
      // No zoom box takes events here: the gestures are the reducers, d3-zoom's own rule.
      gestures: reducerGestures(
        () => this.box().nativeElement.getBoundingClientRect(),
        () => this.context().transform(),
        (t) => this.context().setTransform(t),
      ),
      startTransform: () => this.start(this.load.scene()),
      fit: () => this.fit(this.load.scene()),
    }));
  }

  private start(scene: ReturnType<BenchLoad['scene']>): DiagramTransform | null {
    const { clientWidth: w, clientHeight: h } = this.box().nativeElement;
    return startTransform(scene, { w, h });
  }

  private fit(scene: ReturnType<BenchLoad['scene']>): void {
    this.context().setTransform(this.start(scene) ?? IDENTITY);
  }
}
