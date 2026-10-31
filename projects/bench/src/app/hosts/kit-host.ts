import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import {
  NeatDiagramMessages,
  NeatDiagramNoteTemplate,
  NeatDiagramView,
} from '@sima/neat-ui/diagram';
import { BenchLoad, feedMessages } from './bench-load';
import { BenchNote } from './bench-note';

/**
 * The kit's renderer as an app uses it (design 3.1, `kit`): `neat-diagram` with its dot layer
 * projected into it, drawing the step's diagram, each note the rate card of its edge, the layer
 * fed by the step's messages. It fits itself; the root's `DOT_FRAME_PROBE` times its layer.
 */
@Component({
  selector: 'bench-kit-host',
  imports: [BenchNote, NeatDiagramMessages, NeatDiagramNoteTemplate, NeatDiagramView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './host.css',
  template: `
    <neat-diagram [diagram]="load.synth().diagram" label="Synthetic diagram">
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

  constructor() {
    feedMessages(this.messages);
  }
}
