import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatProse } from '@sima/neat-ui';

/** A README as a server might send it, converted from Markdown to HTML. */
const README = `
<h2>Stream monitor</h2>
<p>Shows each camera's stream with its detections. Start it with <code>npm start</code> and open
<a href="http://localhost:4200">localhost:4200</a>.</p>
<h3>Settings</h3>
<ul>
  <li><code>STREAMS</code>: the cameras' addresses, one per line.</li>
  <li><code>THRESHOLD</code>: the lowest score a detection needs to show.</li>
</ul>
<pre><code>STREAMS=rtsp://192.168.1.20/stream1
THRESHOLD=0.5</code></pre>
<p>Prose leaves the code in a <code>pre</code> as it is.</p>
`;

/**
 * Text from elsewhere, here a README converted from Markdown, set with `[innerHTML]`. Prose styles
 * its plain HTML, so the app adds nothing inside it.
 */
@Component({
  selector: 'app-converted-readme',
  imports: [NeatProse],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-converted-readme.example.html',
  styleUrl: './prose.example.css',
})
export class ConvertedREADME {
  protected readonly readme = README;
}
