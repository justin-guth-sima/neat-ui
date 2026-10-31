import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type { DiagramTransform } from '@bench/diagram-seam';
import { NeatDiagramMessages } from '@sima/neat-ui/diagram';
import { BenchDiagramContext } from './bench-diagram-context';
import { BenchLoad, feedMessages } from './bench-load';
import { startTransform } from './scene';

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
      [viewTransform]="view()"
    >
      <neat-diagram-messages />
    </div>
  `,
})
export class NoneHost {
  protected readonly load = inject(BenchLoad);
  protected readonly view = signal(IDENTITY);
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  private readonly messages = viewChild(NeatDiagramMessages);

  constructor() {
    feedMessages(this.messages);
    // Fitted once laid out; a measured run's window keeps its size.
    afterNextRender(() => {
      const { clientWidth: w, clientHeight: h } = this.box().nativeElement;
      this.view.set(startTransform(this.load.scene(), { w, h }) ?? IDENTITY);
    });
  }
}
