<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Bubble

_Components › Actions_ · [All topics](../README.md)

A speech bubble that points at what it explains: the content inside the element, on the panel surface of a popover, with a tail toward its `anchor`.

```html
<button #help neatButton type="button" (click)="open.set(!open())">What is a pipeline?</button>
<neat-bubble [anchor]="open() ? help : null" side="right">
  A pipeline is the chain of nodes a frame runs through.
</neat-bubble>
```

```ts
import { NeatBubble } from '@sima/neat-ui/bubble';
```

## Examples

### Explaining a part

A bubble that explains the stage of a pipeline the reader picks: its `anchor` is the stage's button, so it moves from stage to stage, and null hides it. Each button points at the bubble with `aria-describedby` while the bubble explains it, so a screen reader reads the note with it.

Press a stage, and press it again to hide its note.

<details>
<summary>Code</summary>

`1-explaining-a-part.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatBubble } from '@sima/neat-ui/bubble';

/** A stage of the pipeline, with what its bubble says. */
interface Stage {
  readonly name: string;
  readonly note: string;
}

@Component({
  selector: 'app-explaining-a-part',
  imports: [NeatBubble, NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-explaining-a-part.example.html',
  styleUrl: './bubble.example.css',
})
export class ExplainingAPart {
  protected readonly stages: readonly Stage[] = [
    { name: 'Camera', note: 'Decodes the camera’s H.264 stream into frames.' },
    { name: 'Detector', note: 'Runs the model on the MLA and finds the objects in each frame.' },
    { name: 'Display', note: 'Draws the boxes over the frame and sends it to Insight.' },
  ];
  /** The stage explained and its button, which the bubble points at; null for none. */
  protected readonly explained = signal<{ stage: Stage; button: HTMLElement } | null>(null);

  protected toggle(stage: Stage, button: HTMLElement): void {
    this.explained.set(this.explained()?.stage === stage ? null : { stage, button });
  }
}
```

`1-explaining-a-part.example.html`

```html
<div class="stages">
  @for (stage of stages; track stage.name) {
    <button
      #button
      neatButton
      type="button"
      variant="outlined"
      [pressed]="explained()?.stage === stage"
      [attr.aria-describedby]="explained()?.stage === stage ? bubble.id : null"
      (click)="toggle(stage, button)"
    >
      {{ stage.name }}
    </button>
  }
</div>
<neat-bubble #bubble [anchor]="explained()?.button ?? null" side="bottom">
  {{ explained()?.stage?.note }}
</neat-bubble>
```

`bubble.example.css`

```css
/* The stages in a row, with room below for the bubble. */
.stages {
  display: flex;
  flex-wrap: wrap;
  gap: var(--neat-space-3);
  padding-bottom: 6rem;
}

/* The block in the middle, with room on every side for its bubbles. */
.around {
  display: grid;
  min-height: 16rem;
  place-items: center;
}

.target {
  padding: var(--neat-space-4) var(--neat-space-6);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}
```

</details>

### Sides

A bubble on each side of what it points at, by `side`. Where a side has no room, its bubble takes the side across, then another, and its tail keeps pointing at the anchor.

<details>
<summary>Code</summary>

`2-sides.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatStatusChip } from '@sima/neat-ui/status-chip';
import { NeatBubble, type NeatBubbleSide } from '@sima/neat-ui/bubble';

@Component({
  selector: 'app-sides',
  imports: [NeatBubble, NeatStatusChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-sides.example.html',
  styleUrl: './bubble.example.css',
})
export class Sides {
  protected readonly sides: readonly NeatBubbleSide[] = ['top', 'right', 'bottom', 'left'];
}
```

`2-sides.example.html`

```html
<div class="around">
  <div #anchor class="target"><neat-status-chip tone="info">Detector</neat-status-chip></div>
  @for (side of sides; track side) {
    <neat-bubble [anchor]="anchor" [side]="side">On the {{ side }}</neat-bubble>
  }
</div>
```

`bubble.example.css`

```css
/* The stages in a row, with room below for the bubble. */
.stages {
  display: flex;
  flex-wrap: wrap;
  gap: var(--neat-space-3);
  padding-bottom: 6rem;
}

/* The block in the middle, with room on every side for its bubbles. */
.around {
  display: grid;
  min-height: 16rem;
  place-items: center;
}

.target {
  padding: var(--neat-space-4) var(--neat-space-6);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}
```

</details>

## API

### `NeatBubble`

Component from `@sima/neat-ui/bubble`, selector `neat-bubble`.

For a note on a part of the page: a step of a walk through code, a remark on a figure, a pointer to a control. It shows while it has an anchor: null hides it, so the app decides when, and it may move to another anchor while it shows. It is not a tooltip, which repeats a control's name in the inverted look while the control is hovered or focused, nor a popover, which a trigger opens and which holds controls.

It sits beside its anchor, on the `side` it prefers (`top` by default), and takes the side across from it, then another, where that has no room. It stays in the window, and its tail moves along its edge to keep pointing at the anchor's middle. An anchor of several elements is the one box around them. It follows its anchor as the page scrolls or a box around the anchor does, and hides while the anchor is scrolled out of view.

It is drawn in the overlay above the page, not where the element stands, so a card or a scrolling box does not clip it. A screen reader meets it there, at the end of the page: point at it from what it explains with `aria-describedby` and its `id` where that takes the focus. `hover` says when a mouse or a pen comes onto it and leaves it, for a bubble shown on hover that should stay while the pointer moves onto it.

**Inputs**

- **`anchor`** `NeatBubbleAnchor | null`, default `null`

  What the bubble points at, a [`NeatBubbleAnchor`](../components/bubble.md#neatbubbleanchor): it shows while there is one.

- **`side`** `NeatBubbleSide`, default `'top'`

  The side of the anchor the bubble prefers, a [`NeatBubbleSide`](../components/bubble.md#neatbubbleside).

**Outputs**

- **`hover`** `boolean`

  Whether a mouse or a pen is over the bubble, each time that changes.

**Properties**

- **`id`** `string`

  The bubble's id, for an `aria-describedby` on what it explains.

### `NeatBubbleSide`

Type from `@sima/neat-ui/bubble`.

The side of its anchor a bubble prefers: it takes another where this one has no room.

```ts
type NeatBubbleSide = TailSide
```

### `NeatBubbleAnchor`

Type from `@sima/neat-ui/bubble`.

What a bubble points at: an element, an `ElementRef` (a template reference to a component), or several elements, which it treats as the one box around them all (the lines of a passage).

```ts
type NeatBubbleAnchor = Element | ElementRef<Element> | readonly Element[]
```
