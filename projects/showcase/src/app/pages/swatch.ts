import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A color chip with its name and hex value underneath, so labels never depend on the color. */
@Component({
  selector: 'app-swatch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chip" [style.background]="hex()"></div>
    <div class="name">{{ name() }}</div>
    <div class="hex showcase-code showcase-muted">{{ hex() }}</div>
  `,
  styleUrl: './swatch.css',
})
export class Swatch {
  readonly name = input.required<string>();
  readonly hex = input.required<string>();
}
