<!-- Written by `npm run docs:pages` from the kit and its examples. Do not edit. -->

# Tabs

_Components › Forms_ · [All topics](../README.md)

Tabs with one open panel: `<neat-tabs label="Channel settings" [(value)]="tab">` around `neat-tab` children; the open tab is underlined. The tab list is named by `label`. Arrow keys move to the next or previous tab and open it, skipping disabled tabs and wrapping; Home and End jump to the ends; the open tab is the only tab stop. Every tab has a panel element, so each tab's `aria-controls` names one that exists, but only the open tab's holds its content: the others are empty and `hidden`. When `value` names no tab (or is unset), the first enabled tab is open, so the list stays reachable.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/tabs/channel-settings.dark.webp">
<img src="../images/tabs/channel-settings.light.webp" alt="Tabs: Channel settings" width="344">
</picture>

```ts
import { NeatTabs, NeatTab } from '@sima/neat-ui/tabs';
```

## Examples

### Channel settings

Three tabs, the third disabled: the arrow keys wrap between the first two and skip it.

<picture>
<source media="(prefers-color-scheme: dark)" srcset="../images/tabs/channel-settings.dark.webp">
<img src="../images/tabs/channel-settings.light.webp" alt="Tabs: Channel settings" width="344">
</picture>

<details>
<summary>Code</summary>

`1-channel-settings.example.ts`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatTab, NeatTabs } from '@sima/neat-ui/tabs';

@Component({
  selector: 'app-channel-settings',
  imports: [NeatTab, NeatTabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-tabs label="Channel settings" [(value)]="tab">
      <neat-tab label="Metadata" value="metadata">
        <ng-template>
          <p class="showcase-muted">Overlay types, confidence thresholds and tracking.</p>
        </ng-template>
      </neat-tab>
      <neat-tab label="General" value="general">
        <ng-template>
          <p class="showcase-muted">Video sync buffer, metadata retention and line width.</p>
        </ng-template>
      </neat-tab>
      <neat-tab label="ROI" value="roi" disabled>
        <ng-template><p class="showcase-muted">Regions of interest.</p></ng-template>
      </neat-tab>
    </neat-tabs>
  `,
})
export class ChannelSettings {
  protected readonly tab = signal('metadata');
}
```

</details>

## API

### `NeatTabs`

Component from `@sima/neat-ui/tabs`, selector `neat-tabs`.

A panel taller than the space it has is for the surrounding page or pane to scroll, which keeps one scroll context. The tab list is the one part that scrolls itself: tabs that do not fit their container's width (an aside's) scroll sideways, never wrap, and the open tab is brought into view when it changes.

Brain's tabs are the host directive; its list, trigger and content directives give the tab roles, the keyboard handling and the panel's labeling. Brain derives element ids from the tab keys alone (`brn-tabs-label-<key>`) and puts them in ids and `aria-controls` as they are. The kit's keys are the instance's prefix and the tab's place in the list, so two tab sets with the same values do not share ids and a value with spaces ("Board 1") is still a valid id; `value` stays in the app's terms. The tab list is built anew when the set of tabs changes, so the keys follow tabs added or removed while mounted. Brain's lazy content keeps a visited panel alive, so the kit puts the open tab's template in its panel itself.

**Inputs**

- **`label`** `string`, required

  The tab list's accessible name.

**Models (two-way)**

- **`value`** `string`

  The open tab's `value`.

### `NeatTab`

Component from `@sima/neat-ui/tabs`, selector `neat-tab`.

One tab of a `neat-tabs`. Its panel goes in an `<ng-template>`, so its content is created only while the tab is open and destroyed when another one opens: `<neat-tab label="General" value="general"><ng-template>…</ng-template></neat-tab>`.

**Inputs**

- **`label`** `string`, required

  The text on the tab's trigger, which names the tab.

- **`value`** `string`, required

  Identifies the tab in `neat-tabs`' `value`; unique within one `neat-tabs`.

- **`disabled`** `boolean`, default `false`, transform `booleanAttribute`

  Turns the tab off: it is shown dimmed and cannot be opened, and the arrow keys skip it.
