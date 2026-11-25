<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Markdown

_Components › Chat_ · [All topics](../README.md)

Markdown, as a model writes its replies, drawn in the kit's prose: headings, paragraphs, lists (task items with ☐ and ☑), quotes, rules, tables in the kit's table look and fenced code as the kit's code block, colored by its language.

```html
<neat-markdown [text]="reply.text" [streaming]="reply.state === 'streaming'" />
```

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/markdown/reply.dark.webp">
<img src="../images/markdown/reply.light.webp" alt="Markdown: Reply" width="900">
</picture>

```ts
import { NeatMarkdown, NEAT_TEXT_MOTIONS } from '@sima/neat-ui/markdown';
```

## Examples

### Reply

A model's reply in Markdown: a heading, a list, a table and code, drawn in the kit's prose, its table look and its code block.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/markdown/reply.dark.webp">
<img src="../images/markdown/reply.light.webp" alt="Markdown: Reply" width="900">
</picture>

<details>
<summary>Code</summary>

`1-reply.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatMarkdown } from '@sima/neat-ui/markdown';

@Component({
  selector: 'app-reply',
  imports: [NeatMarkdown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-reply.example.html',
})
export class Reply {
  protected readonly reply = `## Pasta al pomodoro

What the shelf holds makes most of it:

- **dried pasta**, the long kind
- olive oil and a braid of *garlic*
- canned tomatoes

| Step | Minutes |
| --- | --: |
| Sauté the garlic | 2 |
| Simmer the tomatoes | 15 |
| Boil the pasta | 10 |

\`\`\`python
servings = 4
pasta_g = 100 * servings
\`\`\``;
}
```

`1-reply.example.html`

```html
<neat-markdown [text]="reply" />
```

</details>

### Streaming

A reply streaming in at 25 pieces a second, as a model writes it: half-written marks show as they will end, so `**dried` is bold at once and the code block grows, and a caret ends the text until the reply is done. It starts again after a pause.

<picture>
<source media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)" srcset="../images/markdown/streaming.dark.webp">
<source media="(prefers-reduced-motion: reduce)" srcset="../images/markdown/streaming.light.webp">
<source media="(prefers-color-scheme: dark)" srcset="../images/markdown/streaming.dark.animated.webp">
<img src="../images/markdown/streaming.light.animated.webp" alt="Markdown: Streaming" width="621">
</picture>

<details>
<summary>Code</summary>

`2-streaming.example.ts`

```ts
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NeatMarkdown } from '@sima/neat-ui/markdown';

/** The reply this example streams, a piece at a time. */
const REPLY = `Three jars of **dried pasta**, a bottle of olive oil and canned tomatoes. Together that is
most of a *pasta al pomodoro*:

1. Sauté the garlic in the oil.
2. Add the tomatoes and let them simmer.

\`\`\`python
minutes = 15
\`\`\``;

/** The reply's pieces: each word and each run of spaces, as a model's tokens arrive. */
const PIECES = REPLY.match(/\s+|\S+/g) ?? [];

@Component({
  selector: 'app-streaming',
  imports: [NeatMarkdown],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-streaming.example.html',
  styleUrl: './streaming.example.css',
})
export class Streaming {
  protected readonly text = signal('');
  protected readonly streaming = signal(true);

  constructor() {
    let shown = 0;
    let pause = 0;
    const timer = setInterval(() => {
      if (shown < PIECES.length) {
        this.text.update((text) => text + PIECES[shown++]);
        if (shown === PIECES.length) this.streaming.set(false);
      } else if (++pause > 50) {
        shown = 0;
        pause = 0;
        this.text.set('');
        this.streaming.set(true);
      }
    }, 40);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
```

`2-streaming.example.html`

```html
<neat-markdown [text]="text()" [streaming]="streaming()" />
```

`streaming.example.css`

```css
/* The reply's full height from the start, so the page does not grow as it streams. */
:host {
  display: block;
  min-height: 15rem;
}
```

</details>

## API

### `NeatMarkdown`

Component from `@sima/neat-ui/markdown`, selector `neat-markdown`.

It draws the Markdown with its own templates, never as HTML: raw HTML in the text shows as text, an image as its alt text in brackets, and a link is a link only to an `http:` or `https:` address (opened in a new tab), else its text. So text from a model can be shown as it comes.

**While ****`streaming`****,** the text may grow with every update. Finished blocks keep their elements, and only the last two blocks are read again, so the cost of an update grows with them, not with the text. Marks the model has opened but not yet closed are closed ahead: `**bold` is bold at once and an open code fence is already a code block, so nothing reflows when the closing mark arrives. Some Markdown only resolves later (a table's header row before its separator line): it shows as what it is so far, a paragraph, and changes once.

While streaming, a caret (a bar in `--primary`, blinking unless reduced motion is on) ends the last paragraph, heading or list item; a code block or a table that is still growing shows that it grows by itself.

**Its ****`motion`** is how the newest text appears while it streams ([`NeatTextMotion`](../components/markdown.md#neattextmotion)): `plain` by default, or one of the kit's text motions. Each write's new characters in the prose are a piece that moves for a moment and then settles into plain text; code blocks, tables and inline code grow plainly. A text that is no continuation of the one before shows whole and plain at once, and a motion changed while the text streams moves only what comes after the change. Under reduced motion every motion shows plain.

The host is prose ([`NeatProse`](../layout/prose.md#neatprose)) and a block; the app sets its width.

**Inputs**

- **`text`** `string`, required

  The Markdown to show.

- **`streaming`** `boolean`, default `false`, transform `booleanAttribute`

  True while the text still grows: unclosed marks are closed ahead (see the class).

- **`headingOffset`** `number`, default `2`

  How many levels a heading moves down: with 2, the default, `#` is an `h3`, since a page's own title and sections take `h1` and `h2`. Headings stop at `h6`.

- **`motion`** `NeatTextMotion`, default `'plain'`

  How the newest text appears while it streams: `plain`, the default, or one of the kit's text motions ([`NEAT_TEXT_MOTIONS`](../components/markdown.md#neat_text_motions)). Under reduced motion every motion shows plain.

- **`cloudWords`** `number`, default `12`, transform `cloudWordCount`

  How many words float in the word cloud (the `word-cloud` motion): a whole number from 1 to 40, 12 by default.

### `NeatTextMotion`

Type from `@sima/neat-ui/markdown`.

How a streaming reply's newest text appears in `neat-markdown` (its `motion`), in prose only: code blocks, tables and inline code grow plainly.

- `plain`: the text as it comes, with a thin caret at its end.
- `focus`: each piece comes into focus from a blur in the primary color.
- `heat-trail`: each piece arrives white-hot and cools, behind a glowing caret.
- `decrypt`: pieces show as glyph noise and resolve from the start, with a tail of noise to the end of the next line.
- `reverse-explosion`: particles condense from around each piece into its place.
- `token-flash`: each piece flashes on a chip in one of four hues, then fades.
- `drop-in`: the letters of each word drop in one after another.
- `word-cloud`: words float under the reply's end; one flies into place with each piece.

Under reduced motion every motion shows as `plain`.

```ts
type NeatTextMotion = | 'plain'
  | 'focus'
  | 'heat-trail'
  | 'decrypt'
  | 'reverse-explosion'
  | 'token-flash'
  | 'drop-in'
  | 'word-cloud'
```

### `NEAT_TEXT_MOTIONS`

Constant from `@sima/neat-ui/markdown`.

Every [`NeatTextMotion`](../components/markdown.md#neattextmotion), in the order a picker lists them.

```ts
const NEAT_TEXT_MOTIONS: readonly NeatTextMotion[]
```
