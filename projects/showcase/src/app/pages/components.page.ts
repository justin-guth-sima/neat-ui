import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Button, NeatIcon, NeatPage, Tooltip } from '@sima/neat-ui';

const SEVERITIES = [
  'primary',
  'secondary',
  'success',
  'info',
  'warn',
  'danger',
  'contrast',
] as const;
const VARIANTS = [
  { label: 'Filled', value: undefined },
  { label: 'Outlined', value: 'outlined' },
  { label: 'Text', value: 'text' },
] as const;
const ICON_SIZES = [16, 20, 24] as const;
const TOOLTIP_POSITIONS = ['top', 'right', 'bottom', 'left'] as const;

@Component({
  selector: 'app-components-page',
  imports: [Button, NeatIcon, NeatPage, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Button</h2>
          <p class="showcase-muted">
            Seven severities in three variants. Primary is the app's accent; secondary is the
            neutral choice.
          </p>
          @for (variant of variants; track variant.label) {
            <h3>{{ variant.label }}</h3>
            <div class="showcase-row">
              @for (severity of severities; track severity) {
                <p-button [label]="severity" [severity]="severity" [variant]="variant.value" />
              }
            </div>
          }
        </section>

        <section class="showcase-section">
          <h2>Button states</h2>
          <p class="showcase-muted">
            With a <code>neat-icon</code>, disabled and loading, per variant.
          </p>
          @for (variant of variants; track variant.label) {
            <h3>{{ variant.label }}</h3>
            <div class="showcase-row">
              <p-button label="With icon" [variant]="variant.value">
                <neat-icon name="streaming" />
              </p-button>
              <p-button label="Disabled" [variant]="variant.value" [disabled]="true" />
              <p-button label="Loading" [variant]="variant.value" [loading]="true" />
            </div>
          }
        </section>

        <section class="showcase-section">
          <h2>Tooltip</h2>
          <p class="showcase-muted">
            On hover and on keyboard focus. The tooltip sits on a button, in all four positions.
          </p>
          <div class="showcase-row">
            @for (position of tooltipPositions; track position) {
              <p-button
                [label]="position"
                severity="secondary"
                [pTooltip]="'Tooltip on the ' + position"
                [tooltipPosition]="position"
                tooltipEvent="both"
              />
            }
          </div>
        </section>

        <section class="showcase-section">
          <h2>Icon</h2>
          <p class="showcase-muted">
            At 16, 20 and 24 px. Without a label an icon is decorative and hidden from assistive
            technology; with one it is exposed as an image with that name.
          </p>
          <div class="showcase-row">
            @for (size of iconSizes; track size) {
              <div class="icon-sample">
                <neat-icon name="board" [size]="size" />
                <span class="showcase-code showcase-muted">{{ size }} px</span>
              </div>
            }
          </div>
          <div class="showcase-row">
            @for (size of iconSizes; track size) {
              <div class="icon-sample">
                <neat-icon name="board" [size]="size" label="Board" />
                <span class="showcase-code showcase-muted">{{ size }} px, label</span>
              </div>
            }
          </div>
        </section>
      </div>
    </neat-page>
  `,
  styles: `
    .icon-sample {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 9rem;
    }
  `,
})
export class ComponentsPage {
  protected readonly severities = SEVERITIES;
  protected readonly variants = VARIANTS;
  protected readonly iconSizes = ICON_SIZES;
  protected readonly tooltipPositions = TOOLTIP_POSITIONS;
}
