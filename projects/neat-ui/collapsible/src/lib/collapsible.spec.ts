import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { contrastRatio, NeatIcon, type NeatColorScheme } from '@sima/neat-ui';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatCollapsible } from './collapsible';

@Component({
  imports: [NeatCollapsible],
  template: `
    <button type="button" class="elsewhere">Elsewhere</button>
    <neat-collapsible
      label="Details"
      [summary]="summary()"
      [headingLevel]="level()"
      [(open)]="open"
    >
      <button type="button" class="end" neatCollapsibleEnd>Copy</button>
      @if (open()) {
        <button type="button" class="end-open" neatCollapsibleEnd>Clear</button>
      }
      <button type="button" class="inside">Save</button>
    </neat-collapsible>
  `,
})
class CollapsibleHost {
  readonly open = signal(false);
  readonly summary = signal('IMX219 · NV12 1920×1080');
  readonly level = signal<2 | 3 | 4 | 5 | 6 | null>(null);
}

async function render(setup: (host: CollapsibleHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(CollapsibleHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const element: HTMLElement = fixture.nativeElement;
  const trigger = element.querySelector<HTMLButtonElement>('[data-slot="collapsible-trigger"]')!;
  const content = element.querySelector<HTMLElement>('[data-slot="collapsible-content"]')!;
  const summary = () => element.querySelector<HTMLElement>('[data-slot="collapsible-summary"]');
  return { fixture, host: fixture.componentInstance, element, trigger, content, summary };
}

describe('NeatCollapsible', () => {
  afterEach(() => document.body.replaceChildren());

  it('neat-collapsible is closed by default: aria-expanded=false, and the trigger controls the hidden content', async () => {
    const { trigger, content } = await render();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
    expect(content.id).not.toBe('');
    // Brain only makes closed content inert; the kit hides it.
    expect(content.hasAttribute('inert')).toBe(true);
    expect(content.getAttribute('data-state')).toBe('closed');
    expect(content.classList).toContain('data-closed:hidden');
    // The variant is the content's only display statement, so no other class has to lose to it.
    expect([...content.classList].filter((name) => /^(block|flex|grid|inline)/.test(name))).toEqual(
      [],
    );
    expect(trigger.textContent).toContain('Details');
  });

  it('keeps its content instantiated while closed, so an app gates expensive content on open', async () => {
    const { content } = await render();

    expect(content.querySelector('.inside')).not.toBeNull();
  });

  it('a click, Enter or Space toggles it; open is two-way bound', async () => {
    const { fixture, host, trigger, content } = await render();

    // A native button of type button: Enter and Space activate it as a click, by the browser.
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.type).toBe('button');

    trigger.click();
    await fixture.whenStable();
    expect(host.open()).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(content.hasAttribute('inert')).toBe(false);
    expect(content.getAttribute('data-state')).toBe('open');

    host.open.set(false);
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('turns its chevron a quarter while open, without the motion when reduced motion is asked', async () => {
    const { fixture, host } = await render();
    const icon = () => fixture.debugElement.query(By.directive(NeatIcon));
    expect([...icon().nativeElement.classList]).toEqual(
      expect.arrayContaining(['transition-transform', 'motion-reduce:transition-none']),
    );

    expect(icon().componentInstance.name()).toBe('next');
    expect(icon().nativeElement.classList).not.toContain('rotate-90');

    host.open.set(true);
    await fixture.whenStable();
    expect(icon().nativeElement.classList).toContain('rotate-90');
  });

  it('shows the summary beside the label only while closed', async () => {
    const { fixture, host, summary } = await render();

    expect(summary()!.textContent!.trim()).toBe('IMX219 · NV12 1920×1080');
    expect([...summary()!.classList]).toEqual(
      expect.arrayContaining(['truncate', 'text-muted-foreground']),
    );

    host.open.set(true);
    await fixture.whenStable();
    expect(summary()).toBeNull();

    host.open.set(false);
    host.summary.set('');
    await fixture.whenStable();
    expect(summary()).toBeNull();
  });

  it('moves the focus to the trigger when it closes with the focus inside, as the content goes inert', async () => {
    const { fixture, host, element, trigger, content } = await render((host) =>
      host.open.set(true),
    );
    document.body.append(element);
    element.querySelector<HTMLElement>('.inside')!.focus();

    host.open.set(false);
    await fixture.whenStable();

    // jsdom does not drop the focus from inert content as a browser does; the state is pinned
    // here, and the order (focus moved before inert applies) is the effect's, checked in Chromium.
    expect(content.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('puts its trigger in a heading at the level asked, and in none by default', async () => {
    const { fixture, host, trigger } = await render();
    expect(trigger.closest('[role="heading"]')).toBeNull();

    // As a section's title in an outline (System Info's sections): the button inside a heading,
    // as the WAI-ARIA disclosure and accordion patterns have it.
    host.level.set(4);
    await fixture.whenStable();
    const heading = fixture.nativeElement.querySelector('[data-slot="collapsible-trigger"]')!
      .parentElement as HTMLElement;
    expect(heading.getAttribute('role')).toBe('heading');
    expect(heading.getAttribute('aria-level')).toBe('4');
    expect(heading.textContent).toContain('Details');
  });

  it("puts the app's end controls in the trigger's row, outside the trigger and its heading", async () => {
    const { fixture, host, element, trigger, content } = await render((host) => host.level.set(3));
    const end = element.querySelector<HTMLButtonElement>('.end')!;
    const row = element.querySelector('[data-slot="collapsible-row"]')!;

    expect(end.parentElement).toBe(row);
    expect(row.contains(trigger)).toBe(true);
    expect(end.closest('[role="heading"]')).toBeNull();
    expect(content.contains(end)).toBe(false);
    expect(trigger.textContent).not.toContain('Copy');

    // Shown while closed, and a press acts on its own without opening the section.
    end.click();
    await fixture.whenStable();
    expect(host.open()).toBe(false);
  });

  // jsdom lays nothing out, so the row's flex rules stand in for a narrow container: a heading
  // with a basis of 0 (`flex-1`) is what wide end controls shrank to nothing beside them.
  it("wraps the end controls onto a line of their own before they take the label's room", async () => {
    const { element } = await render();
    const row = element.querySelector<HTMLElement>('[data-slot="collapsible-row"]')!;
    const heading = element.querySelector<HTMLElement>('[data-slot="collapsible-heading"]')!;

    expect(row.classList).toContain('flex-wrap');
    expect(heading.classList).toContain('grow');
    expect([...heading.classList].filter((name) => /^(flex-1|basis-|shrink-)/.test(name))).toEqual(
      [],
    );
  });

  it('moves the focus to the trigger when a close from code removes the end control it was on', async () => {
    const { fixture, host, element, trigger } = await render((host) => host.open.set(true));
    document.body.append(element);
    element.querySelector<HTMLElement>('.end-open')!.focus();

    host.open.set(false);
    await fixture.whenStable();

    expect(element.querySelector('.end-open')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    element.remove();
  });

  it('leaves the focus on an end control that stays when the section closes', async () => {
    const { fixture, host, element } = await render((host) => host.open.set(true));
    document.body.append(element);
    const end = element.querySelector<HTMLElement>('.end')!;
    end.focus();

    host.open.set(false);
    await fixture.whenStable();

    expect(document.activeElement).toBe(end);
    element.remove();
  });

  it('leaves the focus where it is when it closes with the focus elsewhere', async () => {
    const { fixture, host, element } = await render((host) => host.open.set(true));
    document.body.append(element);
    const elsewhere = element.querySelector<HTMLElement>('.elsewhere')!;
    elsewhere.focus();

    host.open.set(false);
    await fixture.whenStable();

    expect(document.activeElement).toBe(elsewhere);
  });

  describe('contrast, from the emitted theme tokens', () => {
    const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const q = { tokens, vocabulary: { hover: 'hover', 'group-hover': 'hover' }, on: [] };

      it(`${scheme}: the label and the summary reach 4.5:1 on the surfaces it sits on`, async () => {
        const { trigger, summary } = await render();
        for (const surface of ['background', 'card', 'popover']) {
          const under = tokens[surface];
          for (const element of [trigger, summary()!]) {
            const text = stateColor([...element.classList], 'text', q, under, tokens['foreground']);
            expect(contrastRatio(text, under), `${text} on --${surface}`).toBeGreaterThanOrEqual(
              4.5,
            );
          }
        }
      });
    }
  });
});
