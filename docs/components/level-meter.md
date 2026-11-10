<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Level meter

_Components › Status_ · [All topics](../README.md)

A live audio level as a bar of 28 segments, from -50 dBFS (dark) to full scale (all lit), green to 70 % of the bar, amber to 90 %, red above; the segments not lit are in the border color:

```html
<neat-level-meter [sample]="micTest.level" />
```

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/level-meter/sine-wave.dark.webp">
<img src="../images/level-meter/sine-wave.light.webp" alt="Level meter: Sine wave" width="480">
</picture>

```ts
import { NeatLevelMeter } from '@sima/neat-ui/level-meter';
```

## Examples

### Sine wave

A meter fed a sine wave, as a microphone test is fed a level. Stop passes `null` and the meter goes dark.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/level-meter/sine-wave.dark.webp">
<img src="../images/level-meter/sine-wave.light.webp" alt="Level meter: Sine wave" width="480">
</picture>

<details>
<summary>Code</summary>

`1-sine-wave.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatLevelMeter } from '@sima/neat-ui/level-meter';

@Component({
  selector: 'app-sine-wave',
  imports: [NeatButton, NeatLevelMeter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-level-meter [sample]="running() ? sineLevel : null" />
    <button neatButton type="button" size="small" (click)="running.update((on) => !on)">
      {{ running() ? 'Stop' : 'Start' }}
    </button>
  `,
  styleUrl: './sine-wave.example.css',
})
export class SineWave {
  protected readonly running = signal(true);
  /** Swings from -50 to 0 dBFS and back about every four seconds. */
  protected readonly sineLevel = () => -25 + 25 * Math.sin(performance.now() / 600);
}
```

`sine-wave.example.css`

```css
/* The meter takes the row's width beside its button, as in a microphone test. */
:host {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--neat-space-3);
  max-width: 28rem;
}
```

</details>

## API

### `NeatLevelMeter`

Component from `@sima/neat-ui/level-meter`, selector `neat-level-meter`.

`sample` reads the current level in dBFS, or null for none (the meter is dark). While it is set and the meter is rendered, the meter calls it once per animation frame, so one input serves a value the app polls and keeps in a field as well as a Web Audio analyzer read on demand. Pass null to stop. The meter calls the function on its own, never as a method of the app's object: give it an arrow function (`readonly level = () => this.lastLevel`), not a method. Return null when the source is gone (an audio context closed) rather than throw: the loop outlives a throw, so a sample that keeps throwing reports an error every frame.

A meter that is rendered samples even where it cannot be seen (under a `display: none` ancestor, in a closed collapsible), so render it only while there is a level to show (`@if (recording || playing)`) instead of hiding it.

Each frame writes the segments straight to the DOM, outside change detection: sixty change detections a second for a bar of color would cost more than everything else on the page.

The meter is `aria-hidden`: a level read out every frame would be noise. Say what is happening (recording, playing, silence) in text beside it.

**Inputs**

- **`sample`** `(() => number | null) | null`, default `null`

  Reads the level in dBFS, once per frame; null leaves the meter dark.
