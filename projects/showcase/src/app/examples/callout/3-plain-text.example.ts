import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCallout } from '@sima/neat-ui/callout';

/**
 * A longer note with `plainText`: the icon and the heading keep the tone's color and the text is
 * in the normal text color. A short notice reads well in the tone's color; a paragraph is easier
 * to read in the text color.
 */
@Component({
  selector: 'app-plain-text',
  imports: [NeatCallout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-plain-text.example.html',
})
export class PlainText {}
