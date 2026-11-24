<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Number field

_Components › Forms_ · [All topics](../README.md)

A small field for one whole number, for jumping to a number such as a page or a channel, or for a setting stepped up and down such as a frame rate.

```html
<neat-number-field label="Page" [value]="page" [accept]="inRange" (commit)="goTo($event)">
  <span neatNumberFieldSuffix>of 9</span>
</neat-number-field>
```

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/number-field/page-with-a-limit.dark.webp">
<img src="../images/number-field/page-with-a-limit.light.webp" alt="Number field: Page with a limit" width="312">
</picture>

```ts
import { NeatNumberField } from '@sima/neat-ui/number-field';
```

## Examples

### Page with a limit

A page field that accepts 1 to 9, with "of 9" after the input. Type 12 or a word and press Enter: the shown number comes back and the count stays. Commit 5, or the shown number again, and the count goes up. The button calls `focus()`.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/number-field/page-with-a-limit.dark.webp">
<img src="../images/number-field/page-with-a-limit.light.webp" alt="Number field: Page with a limit" width="312">
</picture>

<details>
<summary>Code</summary>

`1-page-with-a-limit.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatNumberField } from '@sima/neat-ui/number-field';

const PAGE_COUNT = 9;

@Component({
  selector: 'app-page-with-a-limit',
  imports: [NeatButton, NeatNumberField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-page-with-a-limit.example.html',
  styleUrl: './stack.css',
})
export class PageWithALimit {
  protected readonly pageCount = PAGE_COUNT;
  protected readonly page = signal(3);
  protected readonly commits = signal(0);
  protected readonly acceptPage = (n: number) => n >= 1 && n <= PAGE_COUNT;

  protected commit(page: number): void {
    this.page.set(page);
    this.commits.update((count) => count + 1);
  }
}
```

`1-page-with-a-limit.example.html`

```html
<div class="showcase-row">
  <neat-number-field
    #pageField
    label="Page"
    [value]="page()"
    [accept]="acceptPage"
    (commit)="commit($event)"
  >
    <span neatNumberFieldSuffix>of {{ pageCount }}</span>
  </neat-number-field>
  <button neatButton type="button" variant="outlined" (click)="pageField.focus()">
    Focus the page field
  </button>
</div>
<p class="showcase-code showcase-muted">Page {{ page() }}, commits so far {{ commits() }}</p>
```

`stack.css`

```css
/* The example's rows one gap apart. */
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
}
```

</details>

### Any whole number

A field without `accept`: type 0 or 4096 and it commits, as any whole number does.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/number-field/any-whole-number.dark.webp">
<img src="../images/number-field/any-whole-number.light.webp" alt="Number field: Any whole number" width="192">
</picture>

<details>
<summary>Code</summary>

`2-any-whole-number.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatNumberField } from '@sima/neat-ui/number-field';

@Component({
  selector: 'app-any-whole-number',
  imports: [NeatNumberField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-any-whole-number.example.html',
  styleUrl: './stack.css',
})
export class AnyWholeNumber {
  protected readonly channel = signal(2);
}
```

`2-any-whole-number.example.html`

```html
<neat-number-field label="Draw on channel" [value]="channel()" (commit)="channel.set($event)" />
<p class="showcase-code showcase-muted">Channel {{ channel() }}</p>
```

`stack.css`

```css
/* The example's rows one gap apart. */
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
}
```

</details>

### Steps and a unit

A frame rate stepped by 5 down to 1, with its unit inside the field and its heading as its only visible name. Press + or −, or ArrowUp and ArrowDown in the field, and the rate commits at once. At 1, − is off. Type 0 and the field is marked invalid until Enter puts the rate back.

<details>
<summary>Code</summary>

`3-steps-and-a-unit.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatNumberField } from '@sima/neat-ui/number-field';

@Component({
  selector: 'app-steps-and-a-unit',
  imports: [NeatNumberField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-steps-and-a-unit.example.html',
  styleUrls: ['./stack.css', './heading.css'],
})
export class StepsAndAUnit {
  protected readonly rate = signal(16);
}
```

`3-steps-and-a-unit.example.html`

```html
<h4>Frame rate</h4>
<div class="showcase-row">
  <neat-number-field
    label="Frame rate"
    [showLabel]="false"
    [value]="rate()"
    [step]="5"
    [min]="1"
    unit="fps"
    (commit)="rate.set($event)"
  />
  <p class="showcase-code showcase-muted">Committed {{ rate() }} fps</p>
</div>
```

`stack.css`

```css
/* The example's rows one gap apart. */
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
}
```

`heading.css`

```css
/* The heading that names the field, whose own label is hidden. */
h4 {
  margin: 0;
  font-weight: 500;
}
```

</details>

## API

### `NeatNumberField`

Component from `@sima/neat-ui/number-field`, selector `neat-number-field`.

Its label sits before it; `showLabel` false hides it where a heading already names the field, and it stays the input's accessible name. Content marked `neatNumberFieldSuffix` follows the field, such as "of 9". A `unit` ("fps") sits inside the field's box, after the number.

The field shows `value`, or an empty field with "–" while `value` is null. Typing changes nothing outside until the user commits, with Enter or by leaving the field. `commit` then carries the number if it is whole digits within `min` and `max` that `accept` takes. It does so even when the number equals `value`, so an owner can treat a number the user typed as a choice. Anything else puts `value` back in the field and emits nothing; while it is typed, the input is `aria-invalid`.

Leaving a field that was not typed in emits nothing, so tabbing past it chooses nothing. Enter always commits what is shown.

With `step`, a − button at the box's start and a + button at its end commit the number one step down or up at once, held to `min` and `max` (3 less a step of 5 is 1 with `min` 1). They step from what was typed when it is whole digits, else from `value`. A button that cannot step (at a bound, or with no number shown) is `aria-disabled` and does nothing. Holding a button steps once. The input is then a spinbutton (WAI-ARIA): ArrowUp and ArrowDown step as the buttons do, and the buttons are for the pointer only (no tab stops), so the field stays one tab stop.

```html
<neat-number-field label="Frames per second" [showLabel]="false" [value]="rate" [step]="5"
  [min]="1" unit="fps" (commit)="setRate($event)" />
```

The owner is expected to take what it accepted: after a commit, the field shows that number until `value` changes. An owner that refuses a committed number, and so keeps `value` as it was, calls `reset()` to show `value` again.

**Inputs**

- **`label`** `string`, required

  Shown before the input unless `showLabel` is false, and its accessible name either way.

- **`value`** `number | null`, required

  The number the field shows; null while there is none, shown as an empty field with "–".

- **`accept`** `(n: number) => boolean`, default `() => true`

  Whether the owner takes a whole number within `min` and `max`; the default takes any.

- **`step`** `number | null`, default `null`

  How far the − and + buttons and the arrow keys move the number, a positive whole number; null (the default) for a field without steps.

- **`min`** `number | null`, default `null`

  The least number the field takes, typed or stepped; null (the default) for 0, the least whole number.

- **`max`** `number | null`, default `null`

  The greatest number the field takes, typed or stepped; null (the default) for no limit.

- **`unit`** `string`, default `''`

  What the number counts ("fps"), shown inside the box after it; none by default.

- **`showLabel`** `boolean`, default `true`, transform `booleanAttribute`

  Whether the label is shown before the field; false where a heading names it already.

- **`disabled`** `boolean`, default `false`, transform `booleanAttribute`

  Turns the field off: the input and both buttons are disabled and nothing commits.

**Outputs**

- **`commit`** `number`

  A whole number the user committed, by typing or by a step, that the field and `accept` took.

**Methods**

- **`focus`**

  ```ts
  focus(): void
  ```

  Focuses the input with its number selected, so what the user types replaces it.

  Call it from a shortcut that jumps to the field, such as "g" for the page.

- **`reset`**

  ```ts
  reset(): void
  ```

  Shows `value` again and drops what was typed, with its invalid mark.

  For an owner that refused a number the field committed (a server that will not take 500 fps): its `value` stays as it was, so the field would keep showing the refused number until `value` changes.
