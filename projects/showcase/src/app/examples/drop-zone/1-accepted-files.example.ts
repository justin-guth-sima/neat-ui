import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatDropZone } from '@sima/neat-ui/drop-zone';

/**
 * Three zones: the first takes one video, so drop a text file on it and the log says it was not
 * accepted; the second takes any files; the third is disabled. The log is newest first.
 *
 * @gallery
 */
@Component({
  selector: 'app-accepted-files',
  imports: [NeatDropZone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="zones">
      <neat-drop-zone
        label="Drop one video here, or click to choose"
        accept="video/*,.mkv"
        (rejected)="log('Not accepted', $event)"
        (files)="log('Received', $event)"
      />
      <neat-drop-zone
        label="Drop any files here, or click to choose"
        multiple
        (files)="log('Received', $event)"
      />
      <neat-drop-zone label="Uploads are paused" disabled />
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">
      @for (line of lines(); track $index) {
        {{ line }}<br />
      } @empty {
        Nothing dropped yet
      }
    </p>
  `,
  styleUrl: './accepted-files.example.css',
})
export class AcceptedFiles {
  protected readonly lines = signal<readonly string[]>([]);

  protected log(what: 'Received' | 'Not accepted', files: File[]): void {
    const names = files.map((file) => file.name).join(', ');
    this.lines.update((lines) => [`${what}: ${names}`, ...lines].slice(0, 4));
  }
}
