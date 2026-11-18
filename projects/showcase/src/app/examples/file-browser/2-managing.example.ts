import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatColumn } from '@sima/neat-ui/select-list';
import { NeatFileBrowser } from '@sima/neat-ui/file-browser';
import { DEMO_TREE, demoSize } from './demo-tree';

/**
 * A browser in `manage` mode on a card, with a Type and a Size column after the name. The folders'
 * counts say "videos", and follow their names.
 *
 * A double click or the chevron opens a folder. Try checking files in several folders, then
 * filtering: the checked ones stay checked, and the line under the browser counts them.
 *
 * @gallery
 */
@Component({
  selector: 'app-managing',
  imports: [NeatColumn, NeatFileBrowser],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-managing.example.html',
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
