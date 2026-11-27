<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Gauge

_Components › Charts_ · [All topics](../README.md)

A live value within a range, drawn as a ¾ arc: tokens per second, a frame rate, a power draw or a temperature.

```html
<neat-gauge label="Reply speed" [value]="tokensPerSecond()" [max]="60" unit="tokens/s" />
```

```ts
import { NeatGauge } from '@sima/neat-ui/gauge';
```

## Examples

### Reply speed

A reply's speed in tokens per second, a new reading each second, in a chart card. The card's heading says what it is, so the gauge shows no title of its own; the arc and the figure ease to each reading.

<details>
<summary>Code</summary>

`1-reply-speed.example.ts`

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NeatChartCard } from '@sima/neat-ui/charts';
import { NeatGauge } from '@sima/neat-ui/gauge';
import { REPLY_SPEEDS } from './data';

@Component({
  selector: 'app-reply-speed',
  imports: [NeatChartCard, NeatGauge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-reply-speed.example.html',
  styleUrl: './reply-speed.example.css',
})
export class ReplySpeed {
  protected readonly speed = signal<number>(REPLY_SPEEDS[0]);

  constructor() {
    let step = 0;
    const timer = setInterval(
      () => this.speed.set(REPLY_SPEEDS[++step % REPLY_SPEEDS.length]),
      1000,
    );
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
```

`1-reply-speed.example.html`

```html
<neat-chart-card heading="Reply speed" caption="While the model writes">
  <neat-gauge label="Reply speed" [value]="speed()" [max]="60" unit="tokens/s" />
</neat-chart-card>
```

`data.ts`

```ts
/**
 * A reply's speed as a model streams it, in tokens per second, one reading a second: it starts
 * from nothing, climbs as the reply gets going and wavers around 40.
 */
export const REPLY_SPEEDS: readonly number[] = [
  0, 18, 34, 41, 44, 39, 46, 42, 37, 43, 48, 41, 35, 40, 45, 38,
];

/** Three sensors' temperatures in °C: one below the zones, one in warning, one in danger. */
export const SENSORS = [
  { name: 'A65', celsius: 62 },
  { name: 'EV74', celsius: 91 },
  { name: 'MLA', celsius: 104 },
] as const;

/** Where a board's temperature turns from fine to warning, and from warning to danger. */
export const TEMPERATURE_ZONES = { warning: 85, danger: 100 } as const;
```

`reply-speed.example.css`

```css
/* A card as wide as a column of a dashboard's grid. */
:host {
  display: block;
  max-width: 16rem;
}
```

</details>

### With zones

Three temperatures from 0 to 110 °C, with a warning zone from 85 °C and a danger zone from 100 °C just outside the arc. The first is below both, the second in warning and the third in danger, which each gauge also says in words. On their own, they show their label as a title.

<details>
<summary>Code</summary>

`2-with-zones.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatGauge } from '@sima/neat-ui/gauge';
import { SENSORS, TEMPERATURE_ZONES } from './data';

@Component({
  selector: 'app-with-zones',
  imports: [NeatGauge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-with-zones.example.html',
  styleUrl: './with-zones.example.css',
})
export class WithZones {
  protected readonly sensors = SENSORS;
  protected readonly zones = TEMPERATURE_ZONES;
}
```

`2-with-zones.example.html`

```html
<div class="row">
  @for (sensor of sensors; track sensor.name) {
    <neat-gauge
      [label]="sensor.name + ' temperature'"
      showLabel
      [value]="sensor.celsius"
      [max]="110"
      unit="°C"
      [zones]="zones"
    />
  }
</div>
```

`data.ts`

```ts
/**
 * A reply's speed as a model streams it, in tokens per second, one reading a second: it starts
 * from nothing, climbs as the reply gets going and wavers around 40.
 */
export const REPLY_SPEEDS: readonly number[] = [
  0, 18, 34, 41, 44, 39, 46, 42, 37, 43, 48, 41, 35, 40, 45, 38,
];

/** Three sensors' temperatures in °C: one below the zones, one in warning, one in danger. */
export const SENSORS = [
  { name: 'A65', celsius: 62 },
  { name: 'EV74', celsius: 91 },
  { name: 'MLA', celsius: 104 },
] as const;

/** Where a board's temperature turns from fine to warning, and from warning to danger. */
export const TEMPERATURE_ZONES = { warning: 85, danger: 100 } as const;
```

`with-zones.example.css`

```css
/* Gauges side by side, each given its width by the grid. */
.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: var(--neat-space-6);
  max-width: 36rem;
}
```

</details>

## API

### `NeatGauge`

Component from `@sima/neat-ui/gauge`, selector `neat-gauge`.

The gauge track, thick and round-capped, turns from the bottom left clockwise to the bottom right, and the value arc covers it from the start to the value. The figure and its unit stand inside, and `min` and `max` below the track's ends. `zones` adds thin arcs just outside the track, warning and danger, in the threshold lines' colors (`--neat-line-warning`, `--neat-line-danger`).

The value arc and the figure move to a new value with [`neatEased`](../components/motion.md#neateased), by `easing`, and follow at once under reduced motion. The value arc holds a value outside the range to it; the figure and the words say the value itself. With no value, or one that is no finite number, there is no value arc and the figure says "–". A range with `min` not below `max` draws no value arc and no zones, and says so once in dev mode.

The host is a `meter` named by `label`, with the range, the value held to it, and the value in words: "42 tokens/s of 60", with ", warning" or ", danger" while the value is in a zone. The range's ends, there and below the track, take the figure's `digits`. A meter must have a value (ARIA 1.2 requires `aria-valuenow`), so while there is no value to show (none, one that is no finite number, or a range that is none) the host is a `group` named by `label` instead, with no `aria-value*`. Its figure and unit are read as they show, and the range as the meter's words end, "– tokens/s of 60", while it has one. An end that is no finite number shows "–". `showLabel` also shows the label as a title above the gauge, for a gauge on its own. In a [`NeatChartCard`](../components/chart-card.md#neatchartcard) the card's heading says it, so the gauge takes the chart's place.

It fills the width it is given and keeps its proportions, the text growing with it (the unit and the range no smaller than `--neat-text-xs`). A row or a centered column gives it no width of its own, so give it one there.

A part of the kit's own: Spartan 1.8 has no gauge (brain's progress is a bar), and an arc needs none of the charts' d3, so an app that shows only gauges carries none.

**Inputs**

- **`value`** `number | null`, required

  The value to show; null while there is none.

- **`min`** `number`, default `0`

  The low end of the range, where the arc starts.

- **`max`** `number`, required

  The high end of the range, where the arc ends.

- **`unit`** `string`, default `''`

  The value's unit, small beside the figure and in the words: "tokens/s".

- **`label`** `string`, required

  What the value is: the meter's accessible name, and its title with `showLabel`.

- **`showLabel`** `boolean`, default `false`, transform `booleanAttribute`

  Shows the label as a title above the gauge, for a gauge on its own.

- **`digits`** `number`, default `0`

  Digits after the decimal point, in the figure and the words.

- **`zones`** `NeatGaugeZones | null`, default `null`

  Where the warning and the danger zones start; none by default.

- **`easing`** `NeatEasing`, default `'ease-in-out'`

  The curve the value arc and the figure move by: a [`NEAT_EASINGS`](../components/motion.md#neat_easings) name, or a function where none fits.

### `NeatGaugeZones`

Interface from `@sima/neat-ui/gauge`.

Where a gauge's zones start, each a value from which its zone runs up to `max`: warning to the danger start (or to `max` without one), danger to `max`.

**Members**

- **`warning`** `number`, optional

  The value from which the warning zone starts.

- **`danger`** `number`, optional

  The value from which the danger zone starts.
