<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Time

_Components › Status_ · [All topics](../README.md)

How long ago something was, in the kit's one relative-time style: "just now", "12 s ago".

```ts
neatSecondsAgo((Date.now() - lastSeen) / 1000); // "3 min ago"
```

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/time/ages.dark.webp">
<img src="../images/time/ages.light.webp" alt="Time: Ages" width="172">
</picture>

```ts
import { neatSecondsAgo } from '@sima/neat-ui';
```

## Examples

### Ages

The words [`neatSecondsAgo`](../components/time.md#neatsecondsago) says for the ages beside them.

-5 s is a time ahead of now, as a clock that stepped back gives. The rest lie on both sides of each switch of unit.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/time/ages.dark.webp">
<img src="../images/time/ages.light.webp" alt="Time: Ages" width="172">
</picture>

<details>
<summary>Code</summary>

`1-ages.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { neatSecondsAgo } from '@sima/neat-ui';
import { NeatDetails } from '@sima/neat-ui/details';

/** Ages in seconds: one ahead of now, then both sides of each switch of unit. */
const AGES = [-5, 0, 9, 10, 59, 60, 3599, 3600, 86_399, 86_400, 259_200];

@Component({
  selector: 'app-ages',
  imports: [NeatDetails],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl neatDetails class="ages">
      @for (age of ages; track age) {
        <dt>{{ age }} s</dt>
        <dd>{{ ago(age) }}</dd>
      }
    </dl>
  `,
  styleUrl: './ages.example.css',
})
export class Ages {
  protected readonly ages = AGES;
  protected readonly ago = neatSecondsAgo;
}
```

`ages.example.css`

```css
/* Both columns are short, so the list takes a narrow column rather than the whole card. */
.ages {
  max-width: 14rem;
}
```

</details>

## API

### `neatSecondsAgo`

Function from `@sima/neat-ui`.

It says "just now" under 10 s, then "12 s ago", "3 min ago", "2 h ago" and "4 d ago". Each is cut to whole units: a minute is 60 whole seconds, an hour 60 minutes.

`seconds` is first rounded to a whole second. A time ahead of now, from a clock that stepped back, reads as "just now".

This is the one place the words and thresholds live. So a page that parses a timestamp, and the charts' readout, cannot say the same age two ways.

```ts
neatSecondsAgo(seconds: number): string
```
