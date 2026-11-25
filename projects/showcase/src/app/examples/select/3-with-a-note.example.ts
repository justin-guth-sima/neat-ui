import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatSelect } from '@sima/neat-ui/select';
import { SOURCES } from './sources';

/**
 * A select with a note under it, linked by `describedBy`. A screen reader reads the note after
 * the select's name and value.
 */
@Component({
  selector: 'app-with-a-note',
  imports: [NeatSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-with-a-note.example.html',
  styleUrl: './stack.css',
})
export class WithANote {
  protected readonly sources = SOURCES;
  protected readonly source = signal<string | null>('camera');
}
