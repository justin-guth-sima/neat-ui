import { Directive } from '@angular/core';
import { classes } from '../../../utils/src';

@Directive({
  selector: 'div[hlmSidebarGroupLabel], button[hlmSidebarGroupLabel]',
  exportAs: 'hlmSidebarGroupLabel',
  host: {
    'data-slot': 'sidebar-group-label',
    'data-sidebar': 'group-label',
  },
})
export class HlmSidebarGroupLabel {
  constructor() {
    classes(
      () =>
        'text-sidebar-foreground/70 ring-sidebar-ring h-8 rounded-md px-2 text-xs font-medium transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 focus-visible:ring-2 [&>neat-icon]:text-[length:--spacing(4)] flex shrink-0 items-center outline-hidden [&>neat-icon]:shrink-0',
    );
  }
}
