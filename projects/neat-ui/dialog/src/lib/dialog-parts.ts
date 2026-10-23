import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DIALOG_HELM_CLASSES } from './dialog-panel';

/*
 * The dialog's two building blocks. Class strings stay literals: Tailwind finds the classes the
 * kit stylesheet needs by reading them.
 */

/**
 * The dialog's content between the title and the actions: `<neat-dialog-body>`. It is the part
 * that scrolls when the content is taller than the screen allows, so the title and the actions
 * stay in view. The negative margin and equal padding keep the focus ring of a control at its edge
 * from being clipped by that scrolling.
 */
@Component({
  selector: 'neat-dialog-body',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />',
  host: { class: 'block min-h-0 overflow-y-auto -m-1 p-1' },
})
export class NeatDialogBody {}

/**
 * The dialog's buttons: `<neat-dialog-actions>` under the body, the cancelling button first and the
 * confirming one last. Helm's footer: a row at the end on wide screens; stacked on narrow ones,
 * with the confirming button on top.
 */
@Component({
  selector: 'neat-dialog-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />',
  host: { class: DIALOG_HELM_CLASSES.footer },
})
export class NeatDialogActions {}
