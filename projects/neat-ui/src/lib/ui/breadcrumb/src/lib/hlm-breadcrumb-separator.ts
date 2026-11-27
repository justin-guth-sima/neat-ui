import { NeatIcon } from '../../../../icon/icon';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { classes } from '../../../utils/src';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[hlmBreadcrumbSeparator]',
  exportAs: 'hlmBreadcrumbSeparator',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'breadcrumb-separator',
    role: 'presentation',
    'aria-hidden': 'true',
  },
  template: `
    <ng-content>
      <neat-icon name="next" [size]="16" />
    </ng-content>
  `,
})
export class HlmBreadcrumbSeparator {
  constructor() {
    classes(() => '[&>neat-icon]:text-[length:--spacing(3.5)] [&>neat-icon]:flex');
  }
}
