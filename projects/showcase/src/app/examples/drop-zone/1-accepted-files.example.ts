import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatDropZone } from '@sima/neat-ui/drop-zone';

/**
 * Three zones: the first takes one video, the second takes any files, and the third is disabled.
 * The log is newest first.
 *
 * Try dropping a text file on the first: the log says it was not accepted.
 *
 * @gallery
 */
@Component({
  selector: 'app-accepted-files',
  imports: [NeatDropZone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-accepted-files.example.html',
  styleUrl: './accepted-files.example.css',
})
export class AcceptedFiles {
  protected readonly lines = signal<readonly string[]>([]);

  protected log(what: 'Received' | 'Not accepted', files: File[]): void {
    const names = files.map((file) => file.name).join(', ');
    this.lines.update((lines) => [`${what}: ${names}`, ...lines].slice(0, 4));
  }
}
