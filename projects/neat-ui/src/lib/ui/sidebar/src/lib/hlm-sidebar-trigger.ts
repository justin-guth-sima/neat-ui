import { NeatIcon } from '../../../../icon/icon';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { HlmButton, provideBrnButtonConfig } from '../../../button/src';
import { HlmSidebarService } from './hlm-sidebar.service';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[hlmSidebarTrigger]',
  exportAs: 'hlmSidebarTrigger',
  imports: [NeatIcon],
  providers: [provideBrnButtonConfig({ variant: 'ghost', size: 'icon-sm' })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [{ directive: HlmButton, inputs: ['variant', 'size'] }],
  host: {
    'data-slot': 'sidebar-trigger',
    'data-sidebar': 'trigger',
    '(click)': '_onClick()',
  },
  template: `
    <neat-icon name="rail-toggle" [size]="16" />
    <span class="sr-only">{{ srOnlyText() }}</span>
  `,
})
export class HlmSidebarTrigger {
  private readonly _sidebarService = inject(HlmSidebarService);

  public readonly srOnlyText = input<string>('Toggle Sidebar');

  protected _onClick(): void {
    this._sidebarService.toggleSidebar();
  }
}
