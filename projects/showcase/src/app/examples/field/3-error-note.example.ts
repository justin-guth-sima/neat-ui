import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatErrorNote } from '@sima/neat-ui/field';

/** A failure from a server, said in place on two lines. */
@Component({
  selector: 'app-error-note',
  imports: [NeatErrorNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-error-note.example.html',
})
export class ErrorNote {
  protected readonly message =
    'Could not validate the URL.\nyt-dlp: ERROR: [youtube] abc123: Video unavailable';
}
