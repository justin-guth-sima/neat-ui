import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatMessageBox, pictureFromFile, type NeatChatPicture } from '@sima/neat-ui/chat';

/**
 * A draft the app hands the box: its text and a picture made with `pictureFromFile` from an image
 * file (here one fetched from the page's own files), at most two pictures. Remove the picture
 * with its button, or add another by choosing or dropping one.
 */
@Component({
  selector: 'app-restoring-a-draft',
  imports: [NeatMessageBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-restoring-a-draft.example.html',
  styleUrl: './restoring-a-draft.example.css',
})
export class RestoringADraft {
  protected readonly text = signal('What could I cook with this?');
  protected readonly pictures = signal<readonly NeatChatPicture[]>([]);

  constructor() {
    void this.restore();
  }

  private async restore(): Promise<void> {
    try {
      const answer = await fetch('examples/shelf.webp');
      const file = new File([await answer.blob()], 'shelf.webp', { type: 'image/webp' });
      this.pictures.set([pictureFromFile(file)]);
    } catch {
      // Without the picture the draft is its text alone.
    }
  }
}
