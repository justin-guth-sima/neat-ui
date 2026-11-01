import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatField } from '@sima/neat-ui/field';
import { NeatInput } from '@sima/neat-ui/input';

/**
 * A hint under the first field and an error under the second, whose control is drawn invalid. Each
 * control is named by its field's label, and described by the note under it.
 */
@Component({
  selector: 'app-hint-and-error',
  imports: [NeatField, NeatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-field label="Stream URL" hint="RTSP and RTSPS only.">
      <input neatInput size="small" type="url" placeholder="rtsp://192.168.1.10:554/stream1" />
    </neat-field>
    <neat-field label="Start Time" error="Use minutes and seconds, as 1:30.">
      <input neatInput size="small" value="90s" />
    </neat-field>
  `,
  styleUrl: './hint-and-error.example.css',
})
export class HintAndError {}
