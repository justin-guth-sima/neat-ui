import { Directive } from '@angular/core';
import { classes } from '../../../utils/src';

@Directive({
  selector: '[hlmEmptyHeader],hlm-empty-header',
  exportAs: 'hlmEmptyHeader',
  host: { 'data-slot': 'empty-header' },
})
export class HlmEmptyHeader {
  constructor() {
    classes(() => 'gap-2 flex max-w-sm flex-col items-center');
  }
}
