import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type NeatDiagramEdgeRate, NeatDiagramRateCard } from '@sima/neat-ui/diagram';

/**
 * The box a note takes in every host, in diagram units: the rate card's 11.5 rem by this
 * component's 4.25 rem, plus the kit note's padding (`--neat-space-2`) and 1 px border on each
 * side, at the 16 px root size the bench runs at. The kit measures its notes, the other hosts
 * place theirs at this size; a note of another size would put the two pictures out of step, which
 * the fairness check (design 3.2) compares.
 */
export const NOTE_BOX = { w: 202, h: 86 } as const;

/**
 * A note's content in every host: the kit's rate card for the note's edge, fed by the dot layer's
 * `rate`, so each note redraws at the layer's 12 Hz as an app's would (ladder C's load). Its
 * height is fixed so a note's box does not change with its numbers (`NOTE_BOX`).
 */
@Component({
  selector: 'bench-note',
  imports: [NeatDiagramRateCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<neat-diagram-rate-card [label]="edge()" [rate]="rate()" />',
  styleUrl: './bench-note.css',
})
export class BenchNote {
  /** The edge the note is about, which names it. */
  readonly edge = input.required<string>();
  readonly rate = input.required<NeatDiagramEdgeRate>();
}
