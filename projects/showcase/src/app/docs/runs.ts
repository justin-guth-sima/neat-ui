import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DocsToken } from './model';

/**
 * Source as the generator's runs, each colored by its kind; they spell the file again, so they
 * can sit in a pre. Every text is its own node, so the template adds no space between runs.
 */
@Component({
  selector: 'app-runs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (run of runs(); track $index) {
      @if (run[0] === 'text') {
        <ng-container>{{ run[1] }}</ng-container>
      } @else {
        <span [class]="run[0]">{{ run[1] }}</span>
      }
    }
  `,
  styleUrl: './runs.css',
})
export class Runs {
  readonly runs = input.required<readonly DocsToken[]>();
}
