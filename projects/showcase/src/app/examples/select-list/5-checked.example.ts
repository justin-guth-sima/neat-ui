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
  templateUrl: './5-checked.example.html',
  styleUrls: ['./asset-types-box.css', './stack.css'],
})
export class Checked {
  protected readonly types = ASSET_TYPES;
  protected readonly typeId = typeId;
  protected readonly hasFiles = hasFiles;
  protected readonly checked = signal<readonly string[]>(['cars']);
}
