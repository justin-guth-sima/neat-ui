import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatColumn } from '@sima/neat-ui/select-list';
import { NeatFileBrowser } from '@sima/neat-ui/file-browser';
import { DEMO_TREE, demoSize } from './demo-tree';

/**
 * A browser in `manage` mode on a card, with a Type and a Size column after the name; the
 * folders' counts say "videos" and follow their names. A double click or the chevron opens a
 * folder. Check files in several folders and filter: the checked ones stay checked, and the line
 * under the browser counts them.
 *
 * @gallery
 */
@Component({
  selector: 'app-managing',
  imports: [NeatColumn, NeatFileBrowser],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box card">
      <neat-file-browser
        rootLabel="Media Root"
        mode="manage"
        filterPlaceholder="Filter files…"
        [root]="tree"
        [countLabel]="videoCount"
        [(folder)]="folder"
        [(selected)]="selected"
        [(checked)]="checked"
        [(filter)]="filter"
      >
        <ng-template neatColumn="type" header="Type" width="4rem" let-file>{{
          typeOf(file.name)
        }}</ng-template>
        <ng-template neatColumn="size" header="Size" width="5.5rem" let-file>{{
          sizeOf(file.path)
        }}</ng-template>
      </neat-file-browser>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">
      Selected {{ selected() ?? 'none' }}, {{ checked().length }} checked, filter
      {{ filter() ? '“' + filter() + '”' : 'empty' }}
    </p>
  `,
  styleUrls: ['./browser-box.css', './managing.example.css', './stack.css'],
})
export class Managing {
  protected readonly tree = DEMO_TREE;
  protected readonly folder = signal('clips');
  protected readonly selected = signal<string | null>(null);
  protected readonly checked = signal<readonly string[]>([]);
  protected readonly filter = signal('');
  protected readonly videoCount = (_folder: string, count: number) =>
    `${count} ${count === 1 ? 'video' : 'videos'}`;
  protected readonly typeOf = (name: string) => name.split('.').pop()!.toUpperCase();
  protected readonly sizeOf = demoSize;
}
