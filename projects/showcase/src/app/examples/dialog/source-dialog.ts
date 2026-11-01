import { ChangeDetectionStrategy, Component, inject, input, linkedSignal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatDialogActions, NeatDialogBody, NeatDialogRef } from '@sima/neat-ui/dialog';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';

/** Where a slot's video comes from, as the dialog offers it. */
export type SourceKind = 'file' | 'camera' | 'stream';

const KINDS: NeatSegmentedOption<SourceKind>[] = [
  { value: 'file', label: 'File' },
  { value: 'camera', label: 'Camera' },
  { value: 'stream', label: 'Stream' },
];

/**
 * The dialog-inputs demo: a component opened by `NeatDialog.open` with `inputs`. The slot it is
 * for and the kind it starts on come from the opener; the choice starts at that kind and is the
 * dialog's own from then on.
 */
@Component({
  selector: 'app-source-dialog',
  imports: [NeatButton, NeatDialogActions, NeatDialogBody, NeatSegmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-dialog-body>
      <neat-segmented [label]="'Source for src' + slot()" [options]="kinds" [(value)]="kind" />
    </neat-dialog-body>
    <neat-dialog-actions>
      <button neatButton type="button" variant="outlined" (click)="dialog.close()">Cancel</button>
      <button neatButton type="button" (click)="dialog.close(kind())">Use {{ kind() }}</button>
    </neat-dialog-actions>
  `,
})
export class SourceDialog {
  readonly slot = input.required<number>();
  readonly startOn = input<SourceKind>('file');

  protected readonly dialog = inject<NeatDialogRef<SourceKind>>(NeatDialogRef);
  protected readonly kinds = KINDS;
  /** Starts on the opener's kind; read through a linked signal, as inputs arrive after creation. */
  protected readonly kind = linkedSignal(() => this.startOn());
}
