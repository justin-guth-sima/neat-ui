import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { contrastRatio, NeatColorScheme } from '@sima/neat-ui';
import { computedToHex, describeRatio } from './contrast';

interface Pair {
  label: string;
  foreground: string;
  background: string;
}

/** The second background text sits on besides the content background: the shell's in light, the raised surface in dark. */
const SECOND_BACKGROUND: Record<NeatColorScheme, { label: string; token: string }> = {
  light: { label: 'surface 50', token: '--p-surface-50' },
  dark: { label: 'surface 800', token: '--p-surface-800' },
};

/**
 * The contrast of the theme's key text pairs in one colour scheme. The panel forces its scheme, so
 * both are visible whichever one the app is in; the colours are read back from the rendered
 * theme variables and measured with the kit's `contrastRatio`.
 */
@Component({
  selector: 'app-contrast-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.color-scheme]': 'scheme()' },
  template: `
    <h3>{{ scheme() === 'light' ? 'Light' : 'Dark' }}</h3>
    <table>
      <thead>
        <tr>
          <th scope="col">Pair</th>
          <th scope="col">Sample</th>
          <th scope="col">Contrast</th>
        </tr>
      </thead>
      <tbody>
        @for (pair of pairs(); track pair.label) {
          <tr>
            <th scope="row">{{ pair.label }}</th>
            <td>
              <span
                class="sample"
                [style.color]="'var(' + pair.foreground + ')'"
                [style.background]="'var(' + pair.background + ')'"
                >Neat Insight</span
              >
            </td>
            <td class="showcase-code">{{ ratios()[$index] ?? '' }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
      padding: 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
      color: var(--p-text-color);
    }

    h3 {
      margin: 0 0 0.75rem;
      font-size: 1rem;
      font-weight: 500;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 0.375rem 0.5rem 0.375rem 0;
      text-align: left;
      font-weight: 400;
      font-size: 0.875rem;
    }

    thead th {
      color: var(--p-text-muted-color);
    }

    .sample {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: var(--p-content-border-radius);
    }
  `,
})
export class ContrastPanel {
  readonly scheme = input.required<NeatColorScheme>();

  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly pairs = computed<Pair[]>(() => {
    const second = SECOND_BACKGROUND[this.scheme()];
    return [
      {
        label: 'Text on content',
        foreground: '--p-text-color',
        background: '--p-content-background',
      },
      { label: `Text on ${second.label}`, foreground: '--p-text-color', background: second.token },
      {
        label: 'Muted text on content',
        foreground: '--p-text-muted-color',
        background: '--p-content-background',
      },
      {
        label: `Muted text on ${second.label}`,
        foreground: '--p-text-muted-color',
        background: second.token,
      },
      {
        label: 'Primary on content',
        foreground: '--p-primary-color',
        background: '--p-content-background',
      },
      {
        label: 'Primary contrast on primary',
        foreground: '--p-primary-contrast-color',
        background: '--p-primary-color',
      },
    ];
  });

  protected readonly ratios = signal<string[]>([]);

  constructor() {
    afterNextRender(() => {
      const samples = this.host.querySelectorAll<HTMLElement>('.sample');
      this.ratios.set(
        Array.from(samples, (sample) => {
          const style = getComputedStyle(sample);
          const foreground = computedToHex(style.color);
          const background = computedToHex(style.backgroundColor);
          return foreground && background
            ? describeRatio(contrastRatio(foreground, background))
            : '';
        }),
      );
    });
  }
}
