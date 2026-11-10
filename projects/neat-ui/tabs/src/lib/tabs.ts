import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  ElementRef,
  inject,
  input,
  model,
  TemplateRef,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BrnTabs, BrnTabsContent, BrnTabsList, BrnTabsTrigger } from '@spartan-ng/brain/tabs';
import { ɵhlm as hlm, ɵlistVariants as listVariants } from '@sima/neat-ui';

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
 * Helm's line variant: the active tab is marked by an underline in the text color, which reaches
 * 3:1 on every surface. Helm's default variant marks it with a white fill on `--muted`, 1.10:1 on
 * white, too faint to show which tab is open.
 */
const LIST_CLASSES = listVariants({ variant: 'line' });

/**
 * The strip the tab list sits in: it scrolls sideways when the tabs do not fit, so the page never
 * does. The bottom padding holds the open tab's underline, which helm draws a pixel below the
 * list and a scroll container would otherwise cut off.
 */
const STRIP_CLASSES = 'overflow-x-auto pb-1';

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
 * One tab of a `neat-tabs`. Its panel goes in an `<ng-template>`, so its content is created only
 * while the tab is open and destroyed when another one opens:
 * `<neat-tab label="General" value="general"><ng-template>…</ng-template></neat-tab>`.
 */
@Component({
  selector: 'neat-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class NeatTab {
  /** The text on the tab's trigger, which names the tab. */
  readonly label = input.required<string>();
  /** Identifies the tab in `neat-tabs`' `value`; unique within one `neat-tabs`. */
  readonly value = input.required<string>();
  /** Turns the tab off: it is shown dimmed and cannot be opened, and the arrow keys skip it. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /**
   * @internal The panel template, which `neat-tabs` renders while this tab is open; apps never
   * read it.
   */
  readonly content = contentChild.required(TemplateRef);
}

/**
 * Scrolls `strip` sideways just far enough to show `trigger` in full. Only the strip moves:
 * `scrollIntoView` would also scroll the page or pane to reach a tab below the fold, which a tab
 * set that is merely opening must not do.
 */
function reveal(trigger: HTMLElement, strip: HTMLElement): void {
  const tab = trigger.getBoundingClientRect();
  const view = strip.getBoundingClientRect();
  if (tab.left < view.left) {
    strip.scrollLeft -= view.left - tab.left;
  } else if (tab.right > view.right) {
    strip.scrollLeft += tab.right - view.right;
  }
}

/** Numbers each `neat-tabs`, so brain's ids (derived from the tab keys) are unique on a page. */
let nextTabsId = 0;

/**
 * Tabs with one open panel: `<neat-tabs label="Channel settings" [(value)]="tab">` around
 * `neat-tab` children; the open tab is underlined. The tab list is named by `label`. Arrow keys
 * move to the next or previous tab and open it, skipping disabled tabs and wrapping; Home and End
 * jump to the ends; the open tab is the only tab stop. Every tab has a panel element, so each tab's
 * `aria-controls` names one that exists, but only the open tab's holds its content: the others are
 * empty and `hidden`. When `value` names no tab (or is unset), the first enabled tab is open, so
 * the list stays reachable.
 *
 * A panel taller than the space it has is for the surrounding page or pane to scroll, which keeps
 * one scroll context. The tab list is the one part that scrolls itself: tabs that do not fit their
 * container's width (a side panel's) scroll sideways, never wrap, and the open tab is brought into
 * view when it changes.
 *
 * Brain's tabs are the host directive; its list, trigger and content directives give the tab
 * roles, the keyboard handling and the panel's labeling. Brain derives element ids from the tab
 * keys alone (`brn-tabs-label-<key>`) and puts them in ids and `aria-controls` as they are. The
 * kit's keys are the instance's prefix and the tab's place in the list, so two tab sets with the
 * same values do not share ids and a value with spaces ("Board 1") is still a valid id; `value`
 * stays in the app's terms. The tab list is built anew when the set of tabs changes, so the keys
 * follow tabs added or removed while mounted. Brain's lazy content keeps a visited panel alive, so the kit puts the
 * open tab's template in its panel itself.
 */
@Component({
  selector: 'neat-tabs',
  imports: [BrnTabsList, BrnTabsTrigger, BrnTabsContent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [BrnTabs],
  host: { '[class]': 'rootClasses' },
  template: `
    @for (set of [tabSet()]; track set) {
      <div #strip [class]="stripClasses">
        <div brnTabsList data-variant="line" [attr.aria-label]="label()" [class]="listClasses">
          @for (tab of tabs(); track tab.value(); let index = $index) {
            <button
              #trigger
              [brnTabsTrigger]="key(index)"
              [disabled]="tab.disabled()"
              [class]="triggerClasses"
            >
              {{ tab.label() }}
            </button>
          }
        </div>
      </div>
    }
    @for (tab of tabs(); track tab.value(); let index = $index) {
      <div [brnTabsContent]="key(index)" [class]="contentClasses">
        @if (index === openIndex()) {
          <ng-container [ngTemplateOutlet]="tab.content()" />
        }
      </div>
    }
  `,
})
export class NeatTabs {
  /** The open tab's `value`. */
  readonly value = model<string>();
  /** The tab list's accessible name. */
  readonly label = input.required<string>();

  protected readonly tabs = contentChildren(NeatTab);
  /**
   * The tabs' values in order, as one string. The tab list is drawn once per distinct value of it
   * (a one-item `@for` tracked by it): brain's list builds its key manager from the triggers it
   * has when it starts and never sees tabs added or removed later, so the arrow keys would walk
   * the old set. A new list is a new key manager. A label or `disabled` change keeps the list.
   */
  protected readonly tabSet = computed(() => JSON.stringify(this.tabs().map((tab) => tab.value())));
  /** The place of the tab shown open: the one `value` names, else the first enabled one; -1 for none. */
  protected readonly openIndex = computed(() => {
    const tabs = this.tabs();
    const named = tabs.findIndex((tab) => tab.value() === this.value());
    return named >= 0 ? named : tabs.findIndex((tab) => !tab.disabled());
  });
  /** The strip is drawn once per tab set, like the list in it. */
  private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');
  private readonly triggers = viewChildren<ElementRef<HTMLElement>>('trigger');
  protected readonly rootClasses: string = TABS_HELM_CLASSES.root;
  protected readonly stripClasses: string = STRIP_CLASSES;
  protected readonly listClasses: string = LIST_CLASSES;
  protected readonly triggerClasses: string = TRIGGER_CLASSES;
  protected readonly contentClasses: string = TABS_HELM_CLASSES.content;

  private readonly prefix = `neat-tabs-${++nextTabsId}-`;

  constructor() {
    const tabs = inject(BrnTabs);
    // After render, not in a plain effect: tabs a template creates (`@for` over `neat-tab` with
    // bound inputs) have no `value` until the template's first update, and a plain effect runs before.
    afterRenderEffect(() => {
      const open = this.openIndex();
      tabs.activeTab.set(open < 0 ? undefined : this.key(open));
      const trigger = this.triggers()[open]?.nativeElement;
      const strip = this.strip()?.nativeElement;
      if (trigger && strip) {
        reveal(trigger, strip);
      }
    });
    // Brain's output lives on this same host, so the subscription ends with it.
    tabs.tabActivated.subscribe((key) => {
      const tab = this.tabs()[Number(key.slice(this.prefix.length))];
      if (tab) {
        this.value.set(tab.value());
      }
    });
  }

  /** The key brain knows a tab by: its place in the list, prefixed per instance. */
  protected key(index: number): string {
    return this.prefix + index;
  }
}
