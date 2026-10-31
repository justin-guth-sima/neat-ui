import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild } from '@angular/core';
import {
  NeatDiagramMessages,
  NeatDiagramNoteTemplate,
  NeatDiagramView,
} from '@sima/neat-ui/diagram';
import { domGestures } from '../run/gesture-player';
import { readTransform, registerBenchHost } from './bench-host';
import { BenchLoad, feedMessages } from './bench-load';
import { BenchNote } from './bench-note';
import { startTransform } from './scene';

/**
 * The kit's renderer as an app uses it (design 3.1, `kit`): `neat-diagram` with its dot layer
 * projected into it, drawing the step's diagram, each note the rate card of its edge, the layer
 * fed by the step's messages. It fits itself; the root's `DOT_FRAME_PROBE` times its layer. The run
 * reaches it through `registerBenchHost`: gestures go to the diagram's element, a fit is its key.
 */
@Component({
  selector: 'bench-kit-host',
  imports: [BenchNote, NeatDiagramMessages, NeatDiagramNoteTemplate, NeatDiagramView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './host.css',
  template: `
    <neat-diagram #diagram [diagram]="load.synth().diagram" label="Synthetic diagram">
      <neat-diagram-messages #messages />
      <ng-template neatDiagramNote let-note>
        @let edge = note.edges?.[0] ?? '';
        <bench-note [edge]="edge" [rate]="messages.rate(edge)()" />
      </ng-template>
    </neat-diagram>
  `,
})
export class KitHost {
  protected readonly load = inject(BenchLoad);
  private readonly messages = viewChild(NeatDiagramMessages);
  private readonly diagram = viewChild.required<unknown, ElementRef<HTMLElement>>('diagram', {
    read: ElementRef,
  });

  constructor() {
    feedMessages(this.messages);
    registerBenchHost(() => {
      // d3-zoom is on the diagram's own element, which is also where its keys are heard.
      const box = this.diagram().nativeElement;
      return {
        id: 'kit',
        // The kit writes its transform to its content's style, outside change detection.
        gestures: domGestures(box, () =>
          readTransform(box.querySelector<HTMLElement>('.content')?.style.transform),
        ),
        startTransform: () =>
          startTransform(this.load.scene(), { w: box.clientWidth, h: box.clientHeight }),
        // The kit's own fit is its `0` key while its box has focus: the same code a user reaches,
        // and it hands the view back to fitting by itself, so the next diagram is fitted too.
        fit: () =>
          box.dispatchEvent(
            new KeyboardEvent('keydown', { key: '0', bubbles: true, cancelable: true }),
          ),
      };
    });
  }
}
