import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  contentChildren,
  inject,
  input,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BrnTabs, BrnTabsContent, BrnTabsList, BrnTabsTrigger } from '@spartan-ng/brain/tabs';
import { listVariants } from '../ui/tabs/src';
import { hlm } from '../ui/utils/src';

/**
 * Helm's tabs classes (`lib/ui/tabs`), copied because helm keeps them inline; the list's classes
 * come from helm's exported `listVariants`. tabs.spec checks that each copied string still appears
 * in the vendored helm, so a helm update that changes one fails until this table is reviewed.
 */
export const TABS_HELM_CLASSES = {
  /** `hlm-tabs.ts` */
  root: 'group/tabs flex gap-2 data-[orientation=horizontal]:flex-col',
  /** `hlm-tabs-trigger.ts`, in its four parts: base, line variant, active, and the underline. */
  trigger:
    "gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_neat-icon:not([class*='text-'])]:text-[length:--spacing(4)] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_neat-icon]:pointer-events-none [&_neat-icon]:shrink-0",
  triggerLine:
    'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent',
  triggerActive:
    'data-active:bg-background dark:data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 data-active:text-foreground',
  triggerIndicator:
    'after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
  /** `hlm-tabs-content.ts` */
  content: 'flex-1 text-sm outline-none',
} as const;

/**
 * Helm's line variant: the active tab is marked by an underline in the text colour, which reaches
 * 3:1 on every surface. Helm's default variant marks it with a white fill on `--muted`, 1.10:1 on
 * white, too faint to show which tab is open.
 */
const LIST_CLASSES = listVariants({ variant: 'line' });

/**
 * A tab: helm's trigger with the kit's focus ring. Helm's `ring-ring/50` is about 1.85:1 on white,
 * where a focus indicator needs 3:1; the kit draws full `--ring`. tabs.spec failed without it.
 */
const TRIGGER_CLASSES = hlm(
  TABS_HELM_CLASSES.trigger,
  TABS_HELM_CLASSES.triggerLine,
  TABS_HELM_CLASSES.triggerActive,
  TABS_HELM_CLASSES.triggerIndicator,
  'focus-visible:ring-ring',
);

/**
 * One tab of a `neat-tabs`. Its panel goes in an `<ng-template>`, so it is created only while the
 * tab is open and destroyed when another one opens:
 * `<neat-tab label="General" value="general"><ng-template>…</ng-template></neat-tab>`.
 */
@Component({
  selector: 'neat-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class NeatTab {
  readonly label = input.required<string>();
  /** Identifies the tab in `neat-tabs`' `value`; unique within one `neat-tabs`. */
  readonly value = input.required<string>();
  readonly disabled = input(false, { transform: booleanAttribute });
  /** The panel template, which `neat-tabs` renders while this tab is open. */
  readonly content = contentChild.required(TemplateRef);
}

/**
 * Tabs with one open panel: `<neat-tabs label="Channel settings" [(value)]="tab">` around
 * `neat-tab` children. The tab list is named by `label`. Arrow keys move to the next or previous
 * tab and open it, skipping disabled tabs and wrapping; Home and End jump to the ends; the open tab
 * is the only tab stop. Only the open tab's panel exists: the others are not created at all.
 *
 * The tabs do not scroll: a panel taller than the space it has is for the surrounding page or pane
 * to scroll, which keeps one scroll context.
 *
 * Brain's tabs are the host directive (`value` is its active tab); its list, trigger and content
 * directives give the tab roles, the keyboard handling and the panel's labelling. Brain's lazy
 * content keeps a visited panel alive, so the kit renders the open panel itself.
 */
@Component({
  selector: 'neat-tabs',
  imports: [BrnTabsList, BrnTabsTrigger, BrnTabsContent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    { directive: BrnTabs, inputs: ['brnTabs: value'], outputs: ['brnTabsChange: valueChange'] },
  ],
  host: { '[class]': 'rootClasses' },
  template: `
    <div brnTabsList data-variant="line" [attr.aria-label]="label()" [class]="listClasses">
      @for (tab of tabs(); track tab.value()) {
        <button [brnTabsTrigger]="tab.value()" [disabled]="tab.disabled()" [class]="triggerClasses">
          {{ tab.label() }}
        </button>
      }
    </div>
    @for (tab of tabs(); track tab.value()) {
      @if (tab.value() === active()) {
        <div [brnTabsContent]="tab.value()" [class]="contentClasses">
          <ng-container [ngTemplateOutlet]="tab.content()" />
        </div>
      }
    }
  `,
})
export class NeatTabs {
  /** The tab list's accessible name. */
  readonly label = input.required<string>();

  protected readonly tabs = contentChildren(NeatTab);
  protected readonly active = inject(BrnTabs).activeTab;
  protected readonly rootClasses = TABS_HELM_CLASSES.root;
  protected readonly listClasses = LIST_CLASSES;
  protected readonly triggerClasses = TRIGGER_CLASSES;
  protected readonly contentClasses = TABS_HELM_CLASSES.content;
}
