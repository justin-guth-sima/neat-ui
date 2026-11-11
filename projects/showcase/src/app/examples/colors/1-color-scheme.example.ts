import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NeatButton, type NeatColorScheme, ThemeService } from '@sima/neat-ui';

/**
 * The scheme the page is in (`scheme`), and two ways to change it. Light is the default, whatever
 * the operating system prefers.
 *
 * `toggle()` is what the shell's theme item does, and it stores the choice for the next page load.
 * `setScheme` with `persist: false` holds for this page load only, as a link that themes itself
 * needs. It leaves the stored choice as it was.
 *
 * @unpictured
 */
@Component({
  selector: 'app-color-scheme',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>
      The scheme is <strong>{{ theme.scheme() }}</strong
      >.
    </p>
    <div class="showcase-row">
      <button neatButton type="button" variant="outlined" size="small" (click)="theme.toggle()">
        Switch to {{ other() }}
      </button>
      <button neatButton type="button" variant="text" size="small" (click)="tryOther()">
        Show {{ other() }} without saving
      </button>
    </div>
  `,
})
export class ColorScheme {
  protected readonly theme = inject(ThemeService);
  protected readonly other = computed<NeatColorScheme>(() =>
    this.theme.scheme() === 'dark' ? 'light' : 'dark',
  );

  protected tryOther(): void {
    this.theme.setScheme(this.other(), { persist: false });
  }
}
