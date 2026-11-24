<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Collapsible

_Components › Data_ · [All topics](../README.md)

A section that a full-width button opens and closes, such as a panel's "Details":

```html
<neat-collapsible label="Details" [summary]="mode()" [(open)]="detailsOpen">…</neat-collapsible>
```

<picture>
<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="../images/collapsible/summary-and-save.dark.webp">
<source media="(prefers-reduced-motion: reduce)" srcset="../images/collapsible/summary-and-save.light.webp">
<source media="(prefers-color-scheme: dark)" srcset="../images/collapsible/summary-and-save.dark.animated.webp">
<img src="../images/collapsible/summary-and-save.light.animated.webp" alt="Collapsible: Summary and save" width="384">
</picture>

```ts
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
```

## Examples

### Summary and save

Two sections. Details says what it holds while it is closed. Open Change board and press Save: the section closes and the focus is on its button, not lost to the page.

<picture>
<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="../images/collapsible/summary-and-save.dark.webp">
<source media="(prefers-reduced-motion: reduce)" srcset="../images/collapsible/summary-and-save.light.webp">
<source media="(prefers-color-scheme: dark)" srcset="../images/collapsible/summary-and-save.dark.animated.webp">
<img src="../images/collapsible/summary-and-save.light.animated.webp" alt="Collapsible: Summary and save" width="384">
</picture>

<details>
<summary>Code</summary>

`1-summary-and-save.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatDetails } from '@sima/neat-ui/details';
import { NeatInput } from '@sima/neat-ui/input';

@Component({
  selector: 'app-summary-and-save',
  imports: [NeatButton, NeatCollapsible, NeatDetails, NeatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-summary-and-save.example.html',
  styleUrl: './panel.css',
})
export class SummaryAndSave {
  protected readonly boardOpen = signal(false);
}
```

`1-summary-and-save.example.html`

```html
<div class="panel">
  <neat-collapsible label="Details" summary="IMX219 · MIPI CSI · NV12">
    <dl neatDetails>
      <dt>Model</dt>
      <dd>IMX219</dd>
      <dt>Receiver</dt>
      <dd><code>imx219 1-0010</code></dd>
    </dl>
  </neat-collapsible>
  <neat-collapsible label="Change board" [(open)]="boardOpen">
    <div class="showcase-row">
      <input neatInput type="text" value="192.168.1.20" aria-label="Board address" />
      <button neatButton type="button" (click)="boardOpen.set(false)">Save</button>
    </div>
  </neat-collapsible>
</div>
```

`panel.css`

```css
/* A collapsible's habitat is an aside, so the examples give it a panel's width. */
.panel {
  max-width: 22rem;
}
```

</details>

### End controls

A log with two controls at the end of its row, outside its button. The summary counts the lines.

Try Add line, which works open or closed. Clear is there only while the log is open.

<picture>
<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="../images/collapsible/end-controls.dark.webp">
<source media="(prefers-reduced-motion: reduce)" srcset="../images/collapsible/end-controls.light.webp">
<source media="(prefers-color-scheme: dark)" srcset="../images/collapsible/end-controls.dark.animated.webp">
<img src="../images/collapsible/end-controls.light.animated.webp" alt="Collapsible: End controls" width="384">
</picture>

<details>
<summary>Code</summary>

`2-end-controls.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatNote } from '@sima/neat-ui';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';

@Component({
  selector: 'app-end-controls',
  imports: [NeatButton, NeatCollapsible, NeatNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-end-controls.example.html',
  styleUrl: './panel.css',
})
export class EndControls {
  protected readonly open = signal(false);
  protected readonly lines = signal(['Pipeline started', 'Frame 1 decoded', 'Frame 2 decoded']);

  protected add(): void {
    this.lines.update((lines) => [...lines, `Frame ${lines.length} decoded`]);
  }
}
```

`2-end-controls.example.html`

```html
<div class="panel">
  <neat-collapsible label="Log" [summary]="lines().length + ' lines'" [(open)]="open">
    <button neatCollapsibleEnd neatButton type="button" variant="text" size="small" (click)="add()">
      Add line
    </button>
    @if (open()) {
      <button
        neatCollapsibleEnd
        neatButton
        type="button"
        variant="text"
        size="small"
        (click)="lines.set([])"
      >
        Clear
      </button>
    }
    @for (line of lines(); track $index) {
      <p neatNote>{{ line }}</p>
    } @empty {
      <p neatNote>No lines.</p>
    }
  </neat-collapsible>
</div>
```

`panel.css`

```css
/* A collapsible's habitat is an aside, so the examples give it a panel's width. */
.panel {
  max-width: 22rem;
}
```

</details>

### Under a field

A note under a field that opens into what it says: the note variant, with a warning dot. The field's `aria-describedby` names the note's trigger, so a screen reader reads "Overridden on 2 channels" when the field gets the focus.

Open it and choose Use global on a channel. The last one takes the note away, so the focus moves to the field first: a note removed while its button has the focus would drop the focus to the page.

<details>
<summary>Code</summary>

`3-under-a-field.example.ts`

```ts
import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';
import { NeatInlineButton } from '@sima/neat-ui';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatLine, NeatLineEnd, NeatLineList } from '@sima/neat-ui/line-list';

@Component({
  selector: 'app-under-a-field',
  imports: [NeatCollapsible, NeatInlineButton, NeatInput, NeatLine, NeatLineEnd, NeatLineList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-under-a-field.example.html',
  styleUrls: ['./panel.css', './under-a-field.example.css'],
})
export class UnderAField {
  protected readonly open = signal(false);
  protected readonly channels = signal([
    { name: 'Channel 3', value: '900 ms' },
    { name: 'Channel 7', value: '600 ms' },
  ]);

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected useGlobal(name: string): void {
    if (this.channels().length === 1) this.field().nativeElement.focus();
    this.channels.update((channels) => channels.filter((channel) => channel.name !== name));
  }
}
```

`3-under-a-field.example.html`

```html
<div class="panel">
  <label class="field">
    Frame buffer (ms)
    <input
      #field
      neatInput
      size="small"
      type="number"
      value="500"
      [attr.aria-describedby]="channels().length ? 'overrides-note' : null"
    />
  </label>
  @if (channels().length) {
    <neat-collapsible
      variant="note"
      tone="warning"
      triggerId="overrides-note"
      [label]="
        'Overridden on ' + channels().length + (channels().length === 1 ? ' channel' : ' channels')
      "
      [(open)]="open"
    >
      <ul neatLineList>
        @for (channel of channels(); track channel.name) {
          <li neatLine>
            {{ channel.name }} <span class="showcase-muted">{{ channel.value }}</span>
            <button
              neatInlineButton
              neatLineEnd
              type="button"
              [attr.aria-label]="'Use global on ' + channel.name"
              (click)="useGlobal(channel.name)"
            >
              Use global
            </button>
          </li>
        }
      </ul>
    </neat-collapsible>
  }
</div>
```

`panel.css`

```css
/* A collapsible's habitat is an aside, so the examples give it a panel's width. */
.panel {
  max-width: 22rem;
}
```

`under-a-field.example.css`

```css
/* A field's name over its control, with the note under them. */
.field {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-2);
  margin-bottom: var(--neat-space-2);
  font-size: var(--neat-text-sm);
}
```

</details>

## API

### `NeatCollapsible`

Component from `@sima/neat-ui/collapsible`, selector `neat-collapsible`.

The trigger shows the `next` chevron, turned a quarter while open, and `label`. Only while closed, it also shows `summary` in muted text that truncates, for what the section holds at a glance.

The trigger is a native button. It names the content in `aria-controls`, and says whether it is open in `aria-expanded`. Enter and Space work as on any button. `open` is two-way bound.

With `headingLevel`, the button sits in a heading of that level, as in the WAI-ARIA disclosure and accordion patterns. So the section's title is in the page's outline.

The content stays instantiated while closed, hidden and `inert`, so its state survives a close. Gate expensive content, such as a live preview, on `open` with an `@if` of your own.

When the section closes with the focus inside it, the focus moves to the trigger. Inert content would otherwise drop it to the page. That happens on a Save that closes the section, say, or when the app sets `open` to false. It happens too when the focus was on an end control that the close removed, one shown only while open. An end control that stays keeps the focus.

Elements marked `neatCollapsibleEnd` sit at the end of the trigger's row, outside the trigger and its heading. They are the section's own controls, which act without opening or closing it: a copy button over a code sample, a file choice.

The trigger takes the rest of the row. The controls drop to a second line where they would leave the label and summary no room. The trigger's width is both in full, so a long summary wraps the controls before it truncates.

The end controls show whether the section is open or closed. An app shows them only while open with an `@if`.

As a note under a field: `variant="note"` draws the same disclosure in the small muted text of a note (`neatNote`), the trigger only as wide as its words, and `tone` puts a status dot before the label. `triggerId` is the trigger's id, for the field's `aria-describedby`, so a screen reader says the note's label when the field gets the focus.

```html
<input neatInput type="number" [attr.aria-describedby]="noteId" />
<neat-collapsible
  variant="note"
  tone="warning"
  [triggerId]="noteId"
  label="Overridden on 2 channels"
  [(open)]="open"
>
  <ul neatLineList>…</ul>
</neat-collapsible>
```

**Inputs**

- **`label`** `string`, required

  The trigger's text, which names the section.

- **`summary`** `string`, default `''`

  What the section holds, shown beside the label while it is closed; none if empty.

- **`headingLevel`** `2 | 3 | 4 | 5 | 6 | null`, default `null`

  The level of the heading the trigger sits in, for a section that is part of an outline.

  System Info's sections have one. Leave it unset, the default, for a disclosure such as a panel's "Details".

- **`variant`** `NeatCollapsibleVariant`, default `'section'`

  Which look it has: the section's, or a note's under a field.

- **`tone`** `NeatTone | null`, default `null`

  The status dot before the label, in that tone's color; none while null. The label carries the meaning, so the dot is hidden from assistive technology.

- **`triggerId`** `string | null`, default `null`

  The trigger's `id`, for a control's `aria-describedby` to name; the trigger has none while null.

**Models (two-way)**

- **`open`** `boolean`

  Whether the section is open; closed by default. Bind it two-way, `[(open)]`, to keep the state in the page or to open or close the section from code.

### `NeatCollapsibleVariant`

Type from `@sima/neat-ui/collapsible`.

How a collapsible looks: `section`, a full-width button in the text size of the page, or `note`, the small muted text of a note, as wide as its words.

```ts
type NeatCollapsibleVariant = 'section' | 'note'
```
