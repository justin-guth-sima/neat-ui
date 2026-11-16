import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  NeatSearchPalette,
  type NeatSearchGroup,
  type NeatSearchItem,
} from '@sima/neat-ui/search-palette';

/** A few pages of these docs, as an app would list its own. */
const PAGES: readonly NeatSearchItem[] = [
  {
    id: 'search',
    label: 'Search',
    detail: 'Components › Forms',
    icon: 'document',
    path: '/components/forms/search',
  },
  {
    id: 'select',
    label: 'Select',
    detail: 'Components › Forms',
    icon: 'document',
    path: '/components/forms/select',
  },
  {
    id: 'slider',
    label: 'Slider',
    detail: 'Components › Forms',
    icon: 'document',
    path: '/components/forms/slider',
  },
  { id: 'icons', label: 'Icons', detail: 'Theme', icon: 'palette', path: '/theme/icons' },
  {
    id: 'icon-finder',
    label: 'Icon finder',
    detail: 'Theme',
    icon: 'search',
    path: '/theme/icon-finder',
  },
];

/**
 * The trigger, and the palette it opens: type "s" to see the matches, move with the arrow keys and
 * open one with Enter. The app's `search` returns the results in groups; here, a few pages of these
 * docs whose name holds what was typed. `picked` tells the app what was opened.
 *
 * Its Ctrl K is off here: the docs' own search in the top bar has it.
 *
 * @capture click neat-search-palette .trigger
 */
@Component({
  selector: 'app-searching-an-app',
  imports: [NeatSearchPalette],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-search-palette
      label="Search pages"
      shortcut="false"
      [search]="search"
      (picked)="last.set($event.label)"
    />
    <p class="showcase-muted">Last opened: {{ last() ?? 'none yet' }}</p>
  `,
  styleUrl: './searching-an-app.example.css',
})
export class SearchingAnApp {
  protected readonly last = signal<string | null>(null);

  protected readonly search = (query: string): readonly NeatSearchGroup[] => [
    {
      label: 'Pages',
      items: PAGES.filter((page) => page.label.toLowerCase().includes(query.toLowerCase())),
    },
  ];
}
