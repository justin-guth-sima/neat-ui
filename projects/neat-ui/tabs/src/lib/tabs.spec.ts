import { Component, inject, Injectable, input, OnDestroy, OnInit, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import helmTabs from '../../../src/lib/ui/tabs/src/lib/hlm-tabs.ts?source' with { loader: 'text' };
import helmContent from '../../../src/lib/ui/tabs/src/lib/hlm-tabs-content.ts?source' with {
  loader: 'text',
};
import helmTrigger from '../../../src/lib/ui/tabs/src/lib/hlm-tabs-trigger.ts?source' with {
  loader: 'text',
};
import { contrastRatio } from '../../../src/lib/theme/color';
import { MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import type { NeatColorScheme } from '../../../src/lib/theme/theme.service';
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

async function render(setup: (host: TabsHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(TabsHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const tabs = () => Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = () => Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
  const list = root.querySelector<HTMLElement>('[role="tablist"]')!;
  return { fixture, host: fixture.componentInstance, root, list, tabs, panels };
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
    const { list, tabs, panels } = await render();

    expect(list.getAttribute('aria-label')).toBe('Channel settings');
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual([
      'Metadata',
      'General',
      'ROI',
      'Aux',
    ]);
    expect(selected(tabs())).toEqual(['true', 'false', 'false', 'false']);
    expect(panels()).toHaveLength(1);
    expect(panels()[0].getAttribute('aria-labelledby')).toBe(tabs()[0].id);
    expect(tabs()[0].getAttribute('aria-controls')).toBe(panels()[0].id);
    expect(panels()[0].textContent?.trim()).toBe('metadata panel');
  });

  it('creates only the active panel and destroys it when another tab opens', async () => {
    const { fixture, host, panels } = await render();
    expect([...host.log.alive]).toEqual(['metadata']);

    host.tab.set('general');
    await fixture.whenStable();

    expect([...host.log.alive]).toEqual(['general']);
    expect(panels()).toHaveLength(1);
    expect(panels()[0].textContent?.trim()).toBe('general panel');
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
      const panel = set.querySelector<HTMLElement>('[role="tabpanel"]')!;
      const open = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')!;
      expect(open.getAttribute('aria-controls')).toBe(panel.id);
      expect(panel.getAttribute('aria-labelledby')).toBe(open.id);
    }
    expect(sets.map((set) => set.querySelector('[role="tabpanel"]')?.textContent?.trim())).toEqual([
      'first metadata',
      'second general',
    ]);

    sets[0].querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open).toEqual({ first: 'general', second: 'general' });
    expect(sets.map((set) => set.querySelector('[role="tabpanel"]')?.textContent?.trim())).toEqual([
      'first general',
      'second general',
    ]);
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
      expect(root.querySelector('[role="tabpanel"]')?.textContent?.trim()).toBe('metadata');
    },
  );

  it('draws the tabs with helm’s line variant classes', async () => {
    const { root, list, tabs, panels } = await render();

    expect(root.querySelector('neat-tabs')?.classList).toContain('group/tabs');
    expect(list.dataset['variant']).toBe('line');
    expect([...list.classList]).toEqual(
      expect.arrayContaining(['group/tabs-list', 'bg-transparent']),
    );
    expect([...tabs()[0].classList]).toEqual(
      expect.arrayContaining(TABS_HELM_CLASSES.triggerIndicator.split(' ')),
    );
    expect(panels()[0].classList).toContain('outline-none');
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
