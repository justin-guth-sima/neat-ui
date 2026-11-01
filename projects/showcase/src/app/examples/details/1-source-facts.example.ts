import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatInlineButton } from '@sima/neat-ui';
import { NeatDetails } from '@sima/neat-ui/details';

/**
 * The facts of a source in a panel's width. The URL's value holds a code span and an inline
 * button.
 */
@Component({
  selector: 'app-source-facts',
  imports: [NeatDetails, NeatInlineButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl neatDetails class="panel">
      <dt>Source</dt>
      <dd><code>rtsp://192.168.1.10:554/stream1</code></dd>
      <dt>Status</dt>
      <dd>Pulling</dd>
      <dt>URL</dt>
      <dd class="url">
        <code>rtsp://neat.local:8554/src3</code>
        <button neatInlineButton type="button">Copy</button>
      </dd>
      <dt>Live for</dt>
      <dd>1:02:41</dd>
      <dt>Bitrate</dt>
      <dd>4.2 Mbit/s</dd>
    </dl>
  `,
  styleUrls: ['./panel.css', './source-facts.example.css'],
})
export class SourceFacts {}
