import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';
import { type AssetType, ASSET_TYPES, hasFiles, typeId } from './asset-types';

/** How many types the list compares at most. */
const CAP = 2;
const CAP_NOTE = `At most ${CAP} types can be compared.`;

/**
 * A cap of two checked types: with two checked, the other boxes are drawn disabled; hover one for
 * the reason. The note under the list says the cap in words, for touch, which has no tooltip.
 */
@Component({
  selector: 'app-capped',
  imports: [NeatColumn, NeatSelectList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box">
      <neat-select-list
        label="Types to compare"
        checkable
        [items]="types"
        [trackBy]="typeId"
        [canCheck]="hasFiles"
        [checkBlocked]="atCap"
        [(checked)]="compared"
      >
        <ng-template neatColumn="name" header="Type" let-type>{{ type.name }}</ng-template>
      </neat-select-list>
    </div>
    <p class="showcase-muted">{{ note }}</p>
    <p class="showcase-code showcase-muted" aria-live="polite">
      Compared: {{ compared().length ? compared().join(', ') : 'none' }}
    </p>
  `,
  styleUrls: ['./asset-types-box.css', './stack.css'],
})
export class Capped {
  protected readonly types = ASSET_TYPES;
  protected readonly typeId = typeId;
  protected readonly hasFiles = hasFiles;
  protected readonly note = CAP_NOTE;
  protected readonly compared = signal<readonly string[]>(['cars', 'people']);

  /** The reason a row cannot be checked now: the cap is reached and the row is not checked. */
  protected readonly atCap = (type: AssetType): string | null =>
    this.compared().length >= CAP && !this.compared().includes(type.id) ? CAP_NOTE : null;
}
