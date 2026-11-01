import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';
import { ASSET_TYPES, hasFiles, typeId } from './asset-types';

/**
 * Asset types with a box each, Drones having none since it has no files. The Files column fits its
 * content and ends its figures at the column's end. Try Space on a row, Ctrl-click, Shift-click
 * and Ctrl+A.
 */
@Component({
  selector: 'app-checked',
  imports: [NeatColumn, NeatSelectList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box">
      <neat-select-list
        label="Asset types"
        checkable
        [items]="types"
        [trackBy]="typeId"
        [canCheck]="hasFiles"
        [(checked)]="checked"
      >
        <ng-template neatColumn="name" header="Type" let-type>{{ type.name }}</ng-template>
        <ng-template neatColumn="files" header="Files" width="max-content" align="end" let-type>{{
          type.files
        }}</ng-template>
      </neat-select-list>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">
      Checked: {{ checked().length ? checked().join(', ') : 'none' }}
    </p>
  `,
  styleUrls: ['./asset-types-box.css', './stack.css'],
})
export class Checked {
  protected readonly types = ASSET_TYPES;
  protected readonly typeId = typeId;
  protected readonly hasFiles = hasFiles;
  protected readonly checked = signal<readonly string[]>(['cars']);
}
