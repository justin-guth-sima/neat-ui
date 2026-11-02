import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatFileBrowser } from '@sima/neat-ui/file-browser';
import { DEMO_TREE } from './demo-tree';

/**
 * Picking one file from a media tree. The `archive` folder has a thousand files, and `readme.md`
 * is tagged and greyed but can still be selected. A click on a folder only highlights it: open it
 * with a double click, its chevron or Enter. Move over a folder with the arrow keys or a click and
 * the selection stays on the file it was on.
 */
@Component({
  selector: 'app-picking',
  imports: [NeatFileBrowser],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box">
      <neat-file-browser
        rootLabel="Media Root"
        filterPlaceholder="Filter files…"
        [root]="tree"
        [(folder)]="folder"
        [(selected)]="selected"
      />
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">
      Picked: {{ selected() ?? 'none' }} (in /{{ folder() }})
    </p>
  `,
  styleUrls: ['./browser-box.css', './stack.css'],
})
export class Picking {
  protected readonly tree = DEMO_TREE;
  protected readonly folder = signal('');
  protected readonly selected = signal<string | null>(null);
}
