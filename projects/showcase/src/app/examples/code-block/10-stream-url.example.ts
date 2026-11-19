import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCode } from '@sima/neat-ui';
import { NeatCopyButton } from '@sima/neat-ui/code-block';

/**
 * The Copy button on its own, beside a URL in running text. Its name is "Copy stream URL".
 *
 * Press Copy, then paste the URL into a player.
 */
@Component({
  selector: 'app-stream-url',
  imports: [NeatCode, NeatCopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './10-stream-url.example.html',
  styleUrl: './stream-url.example.css',
})
export class StreamURL {
  protected readonly url = 'rtsp://neat.local:8554/src3';
}
