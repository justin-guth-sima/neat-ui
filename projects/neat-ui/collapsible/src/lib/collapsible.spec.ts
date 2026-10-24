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
    <neat-collapsible label="Details" [summary]="summary()" [(open)]="open">
      <button type="button" class="inside">Save</button>
    </neat-collapsible>
  `,
})
class CollapsibleHost {
  readonly open = signal(false);
  readonly summary = signal('IMX219 · NV12 1920×1080');
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

  it('turns its chevron a quarter while open', async () => {
    const { fixture, host } = await render();
    const icon = () => fixture.debugElement.query(By.directive(NeatIcon));

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
    const { fixture, host, element, trigger } = await render((host) => host.open.set(true));
    document.body.append(element);
    element.querySelector<HTMLElement>('.inside')!.focus();

    host.open.set(false);
    await fixture.whenStable();

    expect(document.activeElement).toBe(trigger);
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
