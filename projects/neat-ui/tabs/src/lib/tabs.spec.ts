import { Component, inject, Injectable, input, OnDestroy, OnInit, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import helmTabs from '../../../src/lib/ui/tabs/src/lib/hlm-tabs.ts?source' with { loader: 'text' };
import helmContent from '../../../src/lib/ui/tabs/src/lib/hlm-tabs-content.ts?source' with {
  loader: 'text',
};
import helmTrigger from '../../../src/lib/ui/tabs/src/lib/hlm-tabs-trigger.ts?source' with {
  loader: 'text',
};
import { MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatTab, NeatTabs, TABS_HELM_CLASSES } from './tabs';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const SURFACES = ['background', 'card'] as const;

/**
 * The variants on a tab's colour classes. The kit's tab list is helm's line variant, horizontal;
 * the active tab's underline is its `after:` pseudo-element.
 */
const VOCABULARY = {
  dark: 'dark',
  hover: 'hover',
  'focus-visible': 'focus',
  'data-active': 'active',
  'group-data-[variant=line]/tabs-list': true,
  'group-data-[variant=default]/tabs-list': false,
};

/** Counts the panel components alive, to show that inactive panels are never created. */
@Injectable()
class PanelLog {
  readonly alive = new Set<string>();
}

@Component({
  selector: 'neat-test-panel',
  template: `{{ name() }} panel`,
})
class TestPanel implements OnInit, OnDestroy {
  readonly name = input.required<string>();
  private readonly log = inject(PanelLog);
  ngOnInit(): void {
    this.log.alive.add(this.name());
  }
  ngOnDestroy(): void {
    this.log.alive.delete(this.name());
  }
}

@Component({
  imports: [NeatTabs, NeatTab, TestPanel],
  providers: [PanelLog],
  template: `
    <neat-tabs label="Channel settings" [(value)]="tab" (valueChange)="changes.push($event)">
      <neat-tab label="Metadata" value="metadata">
        <ng-template><neat-test-panel name="metadata" /></ng-template>
      </neat-tab>
      <neat-tab label="General" value="general">
        <ng-template><neat-test-panel name="general" /></ng-template>
      </neat-tab>
      <neat-tab label="ROI" value="roi" disabled>
        <ng-template><neat-test-panel name="roi" /></ng-template>
      </neat-tab>
      <neat-tab label="Aux" value="aux">
        <ng-template><neat-test-panel name="aux" /></ng-template>
      </neat-tab>
    </neat-tabs>
  `,
})
class TabsHost {
  readonly tab = signal('metadata');
  readonly changes: (string | undefined)[] = [];
  readonly log = inject(PanelLog);
}

/** Two tab sets with the same tab values on one page, as the showcase and an app can have. */
@Component({
  imports: [NeatTabs, NeatTab],
  template: `
    @for (set of sets; track set) {
      <neat-tabs [label]="set" [(value)]="open[set]">
        <neat-tab label="Metadata" value="metadata"
          ><ng-template>{{ set }} metadata</ng-template></neat-tab
        >
        <neat-tab label="General" value="general"
          ><ng-template>{{ set }} general</ng-template></neat-tab
        >
      </neat-tabs>
    }
  `,
})
class TwoTabsHost {
  readonly sets = ['first', 'second'];
  readonly open: Record<string, string> = { first: 'metadata', second: 'general' };
}

@Component({
  imports: [NeatTabs, NeatTab],
  template: `
    <neat-tabs label="Settings" [value]="value">
      <neat-tab label="ROI" value="roi" disabled><ng-template>roi</ng-template></neat-tab>
      <neat-tab label="Metadata" value="metadata"><ng-template>metadata</ng-template></neat-tab>
      <neat-tab label="General" value="general"><ng-template>general</ng-template></neat-tab>
    </neat-tabs>
  `,
})
class FallbackTabsHost {
  value: string | undefined = 'unknown';
}

/** The panel under `scope` that is not `hidden`. */
const openPanel = (scope: ParentNode) =>
  scope.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])');

@Component({
  imports: [NeatTabs, NeatTab],
  template: `
    <neat-tabs label="Sensor groups" [(value)]="value">
      <neat-tab label="Board 1" value="Board 1"><ng-template>first</ng-template></neat-tab>
      <neat-tab label="Board 2" value="Board 2"><ng-template>second</ng-template></neat-tab>
    </neat-tabs>
  `,
})
class SpacedTabsHost {
  readonly value = signal('Board 1');
}

/** Tabs whose set changes while they are mounted, as a board switch changes a sensor-group list. */
@Component({
  imports: [NeatTabs, NeatTab],
  template: `
    <neat-tabs label="Sensor groups" [(value)]="value">
      @for (name of names(); track name) {
        <neat-tab [label]="name" [value]="name"
          ><ng-template>{{ name }} panel</ng-template></neat-tab
        >
      }
    </neat-tabs>
  `,
})
class ChangingTabsHost {
  readonly names = signal(['a', 'b', 'c']);
  readonly value = signal<string | undefined>('a');
}

async function render(setup: (host: TabsHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(TabsHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const tabs = () => Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = () => Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
  /** The panels that are not `hidden`: one, the open tab's. */
  const shown = () => panels().filter((panel) => !panel.hidden);
  const list = root.querySelector<HTMLElement>('[role="tablist"]')!;
  return { fixture, host: fixture.componentInstance, root, list, tabs, panels, shown };
}

/** Brain's tab list moves with CDK's key manager, which reads the legacy `keyCode` browsers set. */
const KEY_CODES: Record<string, number> = { ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35 };
const key = (element: HTMLElement, name: string) =>
  element.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, keyCode: KEY_CODES[name], bubbles: true }),
  );
const selected = (tabs: HTMLElement[]) => tabs.map((tab) => tab.getAttribute('aria-selected'));

describe('NeatTabs', () => {
  it('renders a tab list named by label, one tab per neat-tab, and the active tab’s panel', async () => {
    const { list, tabs, shown } = await render();

    expect(list.getAttribute('aria-label')).toBe('Channel settings');
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual([
      'Metadata',
      'General',
      'ROI',
      'Aux',
    ]);
    expect(selected(tabs())).toEqual(['true', 'false', 'false', 'false']);
    expect(shown()).toHaveLength(1);
    expect(shown()[0].getAttribute('aria-labelledby')).toBe(tabs()[0].id);
    expect(tabs()[0].getAttribute('aria-controls')).toBe(shown()[0].id);
    expect(shown()[0].textContent?.trim()).toBe('metadata panel');
  });

  it('every tab’s aria-controls names an element that exists, and only the open panel has content', async () => {
    const { fixture, host, root, tabs, panels, shown } = await render();
    const controlled = () =>
      tabs().map((tab) => root.querySelector(`[id="${tab.getAttribute('aria-controls')}"]`));

    // One panel per tab, so a trigger never points at nothing; the disabled tab's included.
    expect(controlled().every((panel) => panel?.getAttribute('role') === 'tabpanel')).toBe(true);
    expect(panels()).toHaveLength(4);
    expect(panels().map((panel) => panel.hidden)).toEqual([false, true, true, true]);
    expect(panels().map((panel) => panel.textContent?.trim())).toEqual([
      'metadata panel',
      '',
      '',
      '',
    ]);
    // A closed panel is labelled by its own tab, as the open one is.
    expect(panels().map((panel) => panel.getAttribute('aria-labelledby'))).toEqual(
      tabs().map((tab) => tab.id),
    );

    host.tab.set('aux');
    await fixture.whenStable();

    expect(controlled().every((panel) => panel !== null)).toBe(true);
    expect(panels().map((panel) => panel.hidden)).toEqual([true, true, true, false]);
    expect(panels().map((panel) => panel.textContent?.trim())).toEqual(['', '', '', 'aux panel']);
    expect(shown()[0]).toBe(controlled()[3]);
  });

  it('creates only the active panel and destroys it when another tab opens', async () => {
    const { fixture, host, shown } = await render();
    expect([...host.log.alive]).toEqual(['metadata']);

    host.tab.set('general');
    await fixture.whenStable();

    expect([...host.log.alive]).toEqual(['general']);
    expect(shown()).toHaveLength(1);
    expect(shown()[0].textContent?.trim()).toBe('general panel');
  });

  it('a click opens a tab and writes back through [(value)]', async () => {
    const { fixture, host, tabs } = await render();

    tabs()[1].click();
    await fixture.whenStable();

    expect(host.tab()).toBe('general');
    expect(selected(tabs())).toEqual(['false', 'true', 'false', 'false']);
    expect(host.changes).toEqual(['general']);
  });

  it('has one tab stop: the active tab', async () => {
    const { tabs } = await render();
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('keyboard: arrows move to and open the next tab, skipping disabled ones and wrapping', async () => {
    const { fixture, host, tabs } = await render();
    tabs()[0].focus();

    key(tabs()[0], 'ArrowRight');
    await fixture.whenStable();
    expect(host.tab()).toBe('general');
    expect(document.activeElement).toBe(tabs()[1]);

    key(tabs()[1], 'ArrowRight');
    await fixture.whenStable();
    expect(host.tab()).toBe('aux');

    key(tabs()[3], 'ArrowRight');
    await fixture.whenStable();
    expect(host.tab()).toBe('metadata');

    key(tabs()[0], 'End');
    await fixture.whenStable();
    expect(host.tab()).toBe('aux');
    expect([...host.log.alive]).toEqual(['aux']);
  });

  it('a disabled tab cannot be opened and is out of the tab order', async () => {
    const { fixture, host, tabs } = await render();
    const roi = tabs()[2];

    expect(roi.disabled).toBe(true);
    expect(roi.tabIndex).toBe(-1);
    roi.click();
    await fixture.whenStable();
    expect(host.tab()).toBe('metadata');
  });

  it('keeps ids unique across tab sets with the same values, each wired to its own panel', async () => {
    const fixture = TestBed.createComponent(TwoTabsHost);
    await fixture.whenStable();
    const sets: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('neat-tabs'));
    const ids = Array.from(
      fixture.nativeElement.querySelectorAll('[id]') as NodeListOf<HTMLElement>,
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);

    for (const set of sets) {
      const tabs = Array.from(set.querySelectorAll<HTMLElement>('[role="tab"]'));
      const panel = openPanel(set)!;
      const open = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')!;
      expect(open.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.getAttribute('aria-labelledby')).toBe(open.id);
    }
    expect(sets.map((set) => openPanel(set)?.textContent?.trim())).toEqual([
      'first metadata',
      'second general',
    ]);

    sets[0].querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open).toEqual({ first: 'general', second: 'general' });
    expect(sets.map((set) => openPanel(set)?.textContent?.trim())).toEqual([
      'first general',
      'second general',
    ]);
  });

  it('a tab value with spaces gives valid, unique ids and still opens its tab', async () => {
    const fixture = TestBed.createComponent(SpacedTabsHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const tabs = () => Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = () => Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
    const ids = () => [...tabs(), ...panels()].map((element) => element.id);

    // An id with whitespace is not a valid HTML id, and brain would have built one from the value.
    expect(ids().every((id) => id !== '' && !/\s/.test(id))).toBe(true);
    expect(new Set(ids()).size).toBe(ids().length);
    expect(tabs().map((tab) => tab.getAttribute('aria-controls'))).toEqual(
      panels().map((panel) => panel.id),
    );
    expect(selected(tabs())).toEqual(['true', 'false']);

    tabs()[1].click();
    await fixture.whenStable();

    // The key brain reports is the tab's place, which maps back to its value, not to the key.
    expect(fixture.componentInstance.value()).toBe('Board 2');
    expect(selected(tabs())).toEqual(['false', 'true']);
    expect(openPanel(root)?.textContent?.trim()).toBe('second');
  });

  describe('when its tabs change while mounted', () => {
    async function renderChanging(value: string) {
      const fixture = TestBed.createComponent(ChangingTabsHost);
      fixture.componentInstance.value.set(value);
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const tabs = () => Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      const change = async (names: string[]) => {
        fixture.componentInstance.names.set(names);
        await fixture.whenStable();
      };
      return { fixture, host: fixture.componentInstance, root, tabs, change };
    }

    it('the arrow keys walk the new set, from the first tab of it', async () => {
      const { fixture, host, root, tabs, change } = await renderChanging('a');
      // Use the old list's keys first, so a stale key manager would be the one built and in use.
      tabs()[0].focus();
      key(tabs()[0], 'ArrowRight');
      await fixture.whenStable();
      expect(host.value()).toBe('b');

      await change(['x', 'y']);
      // 'b' is gone, so the first tab of the new set opens.
      expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(['x', 'y']);
      expect(selected(tabs())).toEqual(['true', 'false']);

      tabs()[0].focus();
      key(tabs()[0], 'ArrowRight');
      await fixture.whenStable();

      expect(host.value()).toBe('y');
      expect(document.activeElement).toBe(tabs()[1]);
      expect(openPanel(root)?.textContent?.trim()).toBe('y panel');

      key(tabs()[1], 'ArrowRight');
      await fixture.whenStable();
      expect(host.value()).toBe('x');
      key(tabs()[0], 'End');
      await fixture.whenStable();
      expect(host.value()).toBe('y');
    });

    it('keeps the open tab when it is still there, and the keys move from it', async () => {
      const { fixture, host, tabs, change } = await renderChanging('b');

      await change(['b', 'c', 'd']);
      expect(selected(tabs())).toEqual(['true', 'false', 'false']);

      tabs()[0].focus();
      key(tabs()[0], 'ArrowRight');
      await fixture.whenStable();
      expect(host.value()).toBe('c');
      key(tabs()[1], 'ArrowRight');
      await fixture.whenStable();
      expect(host.value()).toBe('d');
    });

    it('keeps its list while the set of tabs is the same', async () => {
      const { fixture, root, tabs, change } = await renderChanging('a');
      const list = root.querySelector('[role="tablist"]');

      await change(['a', 'b', 'c']);
      await fixture.whenStable();

      expect(root.querySelector('[role="tablist"]')).toBe(list);
      expect(tabs()).toHaveLength(3);
    });
  });

  it.each([['unknown'], [undefined]])(
    'opens the first enabled tab when value is %s, keeping the list reachable',
    async (value) => {
      const fixture = TestBed.createComponent(FallbackTabsHost);
      fixture.componentInstance.value = value;
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));

      expect(selected(tabs)).toEqual(['false', 'true', 'false']);
      expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
      expect(openPanel(root)?.textContent?.trim()).toBe('metadata');
    },
  );

  describe('when the tabs are wider than their container', () => {
    /** The strip around the tab list, which is what scrolls. */
    const stripOf = (root: HTMLElement) =>
      root.querySelector<HTMLElement>('[role="tablist"]')!.parentElement!;

    /**
     * jsdom has no layout: the strip is 100 px wide at x = 0 and each tab 60 px wide, laid out in a
     * row that the strip's scroll offset shifts, so the spec can say where a tab lies.
     */
    function layOut(root: HTMLElement) {
      const strip = stripOf(root);
      let scrolled = 0;
      Object.defineProperty(strip, 'scrollLeft', {
        get: () => scrolled,
        set: (value: number) => (scrolled = value),
      });
      const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
      const rect = (left: number, width: number) =>
        ({ left, right: left + width, width }) as DOMRect;
      vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue(rect(0, 100));
      tabs.forEach((tab, index) =>
        vi
          .spyOn(tab, 'getBoundingClientRect')
          .mockImplementation(() => rect(index * 60 - scrolled, 60)),
      );
      return strip;
    }

    it('keeps the tab list in a strip that scrolls sideways, so the page does not', async () => {
      const fixture = TestBed.createComponent(TabsHost);
      await fixture.whenStable();
      const strip = stripOf(fixture.nativeElement);
      expect(strip.classList).toContain('overflow-x-auto');
      // The list itself keeps its role and name, and is the strip's only child.
      expect(strip.children).toHaveLength(1);
      expect(strip.firstElementChild?.getAttribute('aria-label')).toBe('Channel settings');
    });

    it('brings the open tab into view when it changes', async () => {
      const fixture = TestBed.createComponent(TabsHost);
      await fixture.whenStable();
      const strip = layOut(fixture.nativeElement);

      // The fourth tab lies at 180 to 240 in a strip 100 wide: its end is brought to the edge.
      fixture.componentInstance.tab.set('aux');
      await fixture.whenStable();
      expect(strip.scrollLeft).toBe(140);

      // The first tab is now at -140: its start is brought to the edge.
      fixture.componentInstance.tab.set('metadata');
      await fixture.whenStable();
      expect(strip.scrollLeft).toBe(0);

      // The second tab lies at 60 to 120: only the 20 px that were out of view are scrolled.
      fixture.componentInstance.tab.set('general');
      await fixture.whenStable();
      expect(strip.scrollLeft).toBe(20);

      // The first tab again, at -20 to 40.
      fixture.componentInstance.tab.set('metadata');
      await fixture.whenStable();
      expect(strip.scrollLeft).toBe(0);
    });
  });

  it('draws the tabs with helm’s line variant classes', async () => {
    const { root, list, tabs, shown } = await render();

    expect(root.querySelector('neat-tabs')?.classList).toContain('group/tabs');
    expect(list.dataset['variant']).toBe('line');
    expect([...list.classList]).toEqual(
      expect.arrayContaining(['group/tabs-list', 'bg-transparent']),
    );
    expect([...tabs()[0].classList]).toEqual(
      expect.arrayContaining(TABS_HELM_CLASSES.triggerIndicator.split(' ')),
    );
    expect(shown()[0].classList).toContain('outline-none');
  });

  it('helm drift: the copied class strings still appear in the vendored helm tabs', () => {
    expect(helmTabs).toContain(TABS_HELM_CLASSES.root);
    expect(helmContent).toContain(TABS_HELM_CLASSES.content);
    for (const part of ['trigger', 'triggerLine', 'triggerActive', 'triggerIndicator'] as const) {
      expect(helmTrigger, part).toContain(TABS_HELM_CLASSES[part]);
    }
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const q = (on: string[], box?: string) => ({ tokens, vocabulary: VOCABULARY, on, box });
      const on = (...states: string[]) => (scheme === 'dark' ? ['dark', ...states] : states);

      async function tabClasses(): Promise<string[]> {
        const { tabs } = await render();
        return [...tabs()[0].classList];
      }

      it(`${scheme}: labels reach 4.5:1 inactive and active, at rest and on hover`, async () => {
        const classes = await tabClasses();
        for (const state of [[], ['active']]) {
          for (const hover of [[], ['hover']]) {
            for (const surface of SURFACES) {
              const under = tokens[surface];
              const states = on(...state, ...hover);
              const fill = stateColor(classes, 'bg', q(states), under);
              const label = stateColor(classes, 'text', q(states), fill);
              expect(
                contrastRatio(label, fill),
                `${scheme}, [${states.join(', ')}] on --${surface}: ${label} on ${fill}`,
              ).toBeGreaterThanOrEqual(4.5);
            }
          }
        }
      });

      it(`${scheme}: the active tab's underline reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card`, async () => {
        const { list, tabs } = await render();
        const classes = [...tabs()[0].classList];
        // The underline shows on the open tab of a line-variant list only.
        expect(list.dataset['variant']).toBe('line');
        expect(classes).toContain(
          'group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
        );
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const line = stateColor(classes, 'bg', q(on('active'), 'after'), under);
          expect(
            contrastRatio(line, under),
            `${scheme}, underline on --${surface}: ${line}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });

      it(`${scheme}: the focus ring reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card`, async () => {
        const classes = await tabClasses();
        expect(classes).toContain('focus-visible:ring-[3px]');
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const ring = stateColor(classes, 'ring', q(on('focus')), under);
          expect(
            contrastRatio(ring, under),
            `${scheme}, ring on --${surface}: ${ring}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });
    }
  });
});
