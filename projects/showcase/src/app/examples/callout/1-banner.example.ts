import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';

/** A banner with a heading, a line of text and one action. */
@Component({
  selector: 'app-banner',
  imports: [NeatButton, NeatCallout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-banner.example.html',
})
export class Banner {}
