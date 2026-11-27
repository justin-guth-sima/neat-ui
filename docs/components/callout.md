<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Callout

_Components › Status_ · [All topics](../README.md)

A note set apart on a tint of its tone, with an optional heading and a row of actions:

```html
<neat-callout tone="warning" heading="Board changed" announce="status">
  The board at 192.168.1.20 replaced the previous one.
  <button neatButton neatCalloutActions type="button">Refresh</button>
</neat-callout>
```

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/callout/tones.dark.webp">
<img src="../images/callout/tones.light.webp" alt="Callout: Tones" width="900">
</picture>

```ts
import { NeatCallout } from '@sima/neat-ui/callout';
```

## Examples

### Banner

A banner with a heading, a line of text and one action.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/callout/banner.dark.webp">
<img src="../images/callout/banner.light.webp" alt="Callout: Banner" width="900">
</picture>

<details>
<summary>Code</summary>

`1-banner.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';

@Component({
  selector: 'app-banner',
  imports: [NeatButton, NeatCallout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-banner.example.html',
})
export class Banner {}
```

`1-banner.example.html`

```html
<neat-callout tone="warning" heading="Board changed" region>
  The board at 192.168.1.20 replaced the previous one. Devices are from the last scan.
  <button neatButton neatCalloutActions type="button" size="small">Refresh</button>
</neat-callout>
```

</details>

### Tones

One callout per tone, with no heading: the icon, the tint, the border and the text color change.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/callout/tones.dark.webp">
<img src="../images/callout/tones.light.webp" alt="Callout: Tones" width="900">
</picture>

<details>
<summary>Code</summary>

`2-tones.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCallout } from '@sima/neat-ui/callout';

@Component({
  selector: 'app-tones',
  imports: [NeatCallout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-tones.example.html',
  styleUrl: './tones.example.css',
})
export class Tones {
  protected readonly notes = [
    { tone: 'neutral', text: 'Idle' },
    { tone: 'success', text: 'Live' },
    { tone: 'warning', text: 'Unreachable' },
    { tone: 'danger', text: 'Auth failed' },
    { tone: 'info', text: 'Connecting' },
    { tone: 'highlight', text: 'External' },
  ] as const;
}
```

`2-tones.example.html`

```html
@for (note of notes; track note.tone) {
  <neat-callout [tone]="note.tone">{{ note.tone }}: {{ note.text }}</neat-callout>
}
```

`tones.example.css`

```css
/* The callouts one gap apart, as banners stack over a page. */
:host {
  display: flex;
  flex-direction: column;
  gap: var(--neat-space-3);
}
```

</details>

### Plain text

A longer note with `plainText`: the icon and the heading keep the tone's color and the text is in the normal text color. A short notice reads well in the tone's color; a paragraph is easier to read in the text color.

<details>
<summary>Code</summary>

`3-plain-text.example.ts`

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCallout } from '@sima/neat-ui/callout';

@Component({
  selector: 'app-plain-text',
  imports: [NeatCallout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-plain-text.example.html',
})
export class PlainText {}
```

`3-plain-text.example.html`

```html
<neat-callout tone="info" heading="Models compile on the host" plainText>
  A model is compiled on the host and runs on the board. The first compile of a model takes a few
  minutes; later ones reuse what has not changed. If the board has a different software version than
  the host, the compiled model may not load, and the board's version is shown beside its name in the
  rail.
</neat-callout>
```

</details>

## API

### `NeatCallout`

Component from `@sima/neat-ui/callout`, selector `neat-callout`.

For a banner over a page, a problem or a guide in a dialog, a note in a panel. `tone` (a [`NeatTone`](../theme/colors.md#neattone), `info` by default) picks the tint, the border and the color of the icon, heading and text, and the icon: `error` for danger, `warning`, `check` for success, `info` otherwise. It is Spartan's alert in the kit's tones: a bordered card with the icon in a column beside the heading and text. Neutral is Spartan's plain card. A short notice reads well in the tone's color; for a longer one, set `plainText` and only the heading and icon keep it. The content is the body; elements marked `neatCalloutActions` go to a row under it.

The heading is a real heading (`role="heading"`), at `headingLevel`, 3 by default. That puts it under a dialog's title (a level 2) or a page's section, where heading navigation finds it. Pick the level that fits where the callout stands.

The tint is the page's color mixed with the tone, so in a dialog it differs from the dialog's own surface.

`region` makes the callout a landmark, for a notice a user should be able to jump to, such as the Viewer's late notice. The heading names it. Without a heading the callout takes no role, since a region with no name is no landmark.

`announce` instead gives the host a live role, to say the note with when it appears. Use `status` for news that can wait, and `alert` for a failure that needs attention now. It wins over `region`, since a host has one role.

A callout with a role is labeled by its heading (`aria-labelledby`). One without a role is a plain note. A live region speaks what is added to it, so render the callout when its news happens (an `@if`), not hidden beforehand.

**Inputs**

- **`tone`** `NeatTone`, default `'info'`

  The kind of note: sets the tint, the border, the text color and the icon.

- **`heading`** `string`, default `''`

  A short heading over the body; none if empty.

- **`headingLevel`** `2 | 3 | 4 | 5 | 6`, default `3`

  The heading's level in the page's outline.

- **`region`** `boolean`, default `false`, transform `booleanAttribute`

  Whether the callout is a landmark, named by its heading (none without one); a live role wins over it.

- **`announce`** `'status' | 'alert' | null`, default `null`

  The live role the note is said with when it appears; none by default.

- **`plainText`** `boolean`, default `false`, transform `booleanAttribute`

  Sets the body in the normal text color, for a longer note: the heading and the icon keep the tone's color. A short notice reads well in the tone's color; a paragraph does not.
