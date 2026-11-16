import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NeatIcon, NeatPage, NeatSearch } from '@sima/neat-ui';
import { map } from 'rxjs';
import { type DocsHit, DocsSearch } from '../search/docs-search';

/**
 * Every result of the docs' search, in groups, each a link to its place in the docs. The search is
 * the address's `q`, so the palette's "See all results" and a shared link open it.
 */
@Component({
  selector: 'app-search-page',
  imports: [NeatIcon, NeatPage, NeatSearch, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page results">
        <neat-search
          variant="raised"
          size="large"
          label="Search the docs"
          placeholder="Search topics, the API and examples"
          [status]="status()"
          [value]="query()"
          (valueChange)="search($event)"
        />
        @for (group of groups(); track group.label; let i = $index) {
          <section [attr.aria-labelledby]="'results-' + i">
            <h2 [id]="'results-' + i">
              {{ group.label }} <span class="count">{{ group.hits.length }}</span>
            </h2>
            <ul>
              @for (hit of group.hits; track hit.item.id) {
                <li>
                  <a [routerLink]="pathOf(hit)" [fragment]="fragmentOf(hit)">
                    @if (hit.item.icon; as icon) {
                      <neat-icon [name]="icon" [size]="16" />
                    }
                    <span class="label">{{ hit.item.label }}</span>
                    <span class="detail">{{ hit.item.detail }}</span>
                  </a>
                  @if (hit.text) {
                    <p>{{ hit.text }}</p>
                  }
                </li>
              }
            </ul>
          </section>
        }
      </div>
    </neat-page>
  `,
  styleUrl: './search.page.css',
})
export class SearchPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly docs = inject(DocsSearch);

  /** The search, as the address has it. */
  protected readonly query = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );
  protected readonly groups = computed(() => this.docs.hits(this.query()));
  protected readonly status = computed(() => {
    if (!this.query().trim()) return '';
    const count = this.groups().reduce((sum, group) => sum + group.hits.length, 0);
    if (!count) return 'Nothing matches';
    return count === 1 ? '1 result' : `${count.toLocaleString('en-US')} results`;
  });

  constructor() {
    void this.docs.load();
  }

  /** Puts the search in the address, in place of the one before, so Back leaves the page. */
  protected search(query: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: query || null },
      replaceUrl: true,
    });
  }

  protected pathOf(hit: DocsHit): string {
    return hit.item.path.split('#')[0];
  }

  protected fragmentOf(hit: DocsHit): string | undefined {
    return hit.item.path.split('#')[1];
  }
}
