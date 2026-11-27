import { NeatIcon } from '../../../../icon/icon';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { classes } from '../../../utils/src';

@Component({
  selector: 'hlm-breadcrumb-ellipsis',
  exportAs: 'hlmBreadcrumbEllipsis',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'breadcrumb-ellipsis',
    role: 'presentation',
  },
  template: `
    <neat-icon name="more" [size]="16" />
    <span class="sr-only">{{ srOnlyText() }}</span>
  `,
})
export class HlmBreadcrumbEllipsis {
  /** Screen reader only text for the ellipsis */
  public readonly srOnlyText = input<string>('More');

  constructor() {
    classes(
      () => 'size-5 [&>neat-icon]:text-[length:--spacing(4)] flex items-center justify-center',
    );
  }
}
