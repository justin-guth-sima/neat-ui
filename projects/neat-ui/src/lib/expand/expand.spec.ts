import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import expandStyles from './expand.css' with { loader: 'text' };
import { NeatExpand } from './expand';

@Component({
  imports: [NeatExpand],
  template: `
    <button id="outside" type="button" (click)="expand.open()">Expand from outside</button>
    <section neatExpand #expand="neatExpand" [(expanded)]="expanded">
      <button id="first" type="button" (click)="expand.toggle()">
        {{ expand.expanded() ? 'Close' : 'Expand' }}
      </button>
      <button id="last" type="button">Last</button>
    </section>
    <div id="focusable" neatExpand tabindex="0"></div>
  `,
})
class ExpandHost {
  readonly expanded = signal(false);
}

/**
 * jsdom has no Popover API: these stand in for it on every element, and record which elements
 * are in the top layer. jsdom's stylesheet hides a popover it does not know to be open, which
 * would make everything in it unfocusable, so the stand-in shows it with an inline display.
 */
function fakePopoverApi(): Set<HTMLElement> {
  const open = new Set<HTMLElement>();
  HTMLElement.prototype.showPopover = function (this: HTMLElement) {
    open.add(this);
    this.style.display = 'block';
  };
  HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    open.delete(this);
    this.style.removeProperty('display');
  };
  return open;
}

function removePopoverApi(): void {
  const prototype = HTMLElement.prototype as Partial<HTMLElement>;
  delete prototype.showPopover;
  delete prototype.hidePopover;
}

async function render() {
  const fixture = TestBed.createComponent(ExpandHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const element = (selector: string) => root.querySelector<HTMLElement>(selector)!;
  const press = (target: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };
  return { fixture, host: fixture.componentInstance, section: element('section'), element, press };
}

describe('NeatExpand', () => {
  let topLayer: Set<HTMLElement>;

  beforeEach(() => {
    topLayer = fakePopoverApi();
    // jsdom lays nothing out, and CDK counts an element without a box as hidden, so not tabbable.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1);
  });

  afterEach(() => removePopoverApi());

  it('lifts its host into the top layer as a manual popover, in its expanded look', async () => {
    const { fixture, section, element } = await render();

    element('#first').click();
    await fixture.whenStable();

    expect(topLayer.has(section)).toBe(true);
    expect(section.getAttribute('popover')).toBe('manual');
    expect(section.hasAttribute('data-neat-expanded')).toBe(true);
    expect(element('#first').textContent?.trim()).toBe('Close');
  });

  it('puts its host back in its place on the page when it closes', async () => {
    const { fixture, section, element } = await render();

    element('#first').click();
    await fixture.whenStable();
    element('#first').click();
    await fixture.whenStable();

    expect(topLayer.has(section)).toBe(false);
    expect(section.hasAttribute('popover')).toBe(false);
    expect(section.hasAttribute('data-neat-expanded')).toBe(false);
  });

  it('follows the app’s state both ways', async () => {
    const { fixture, host, section, element } = await render();

    host.expanded.set(true);
    await fixture.whenStable();
    expect(topLayer.has(section)).toBe(true);

    element('#first').click();
    await fixture.whenStable();
    expect(host.expanded()).toBe(false);
    expect(topLayer.has(section)).toBe(false);
  });

  it('moves the focus into the host when it opens from outside, and back when it closes', async () => {
    const { fixture, section, element, press } = await render();
    const outside = element('#outside');

    outside.focus();
    outside.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(section);
    expect(section.getAttribute('tabindex')).toBe('-1');

    press(section, 'Escape');
    await fixture.whenStable();
    expect(document.activeElement).toBe(outside);
    expect(section.hasAttribute('tabindex')).toBe(false);
  });

  it('leaves the focus on a control inside the host that opened it', async () => {
    const { fixture, element } = await render();
    const button = element('#first');

    button.focus();
    button.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(button);

    button.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(button);
  });

  it('leaves the focus where it is on closing when it went outside the host', async () => {
    const { fixture, host, element } = await render();
    const outside = element('#outside');

    element('#first').focus();
    host.expanded.set(true);
    await fixture.whenStable();
    outside.focus();
    host.expanded.set(false);
    await fixture.whenStable();

    expect(document.activeElement).toBe(outside);
  });

  it('keeps a tabindex its host has of its own', async () => {
    const { fixture, element } = await render();
    const focusable = element('#focusable');
    const expand = fixture.debugElement
      .queryAll((node) => node.nativeElement === focusable)[0]
      .injector.get(NeatExpand);

    expand.open();
    await fixture.whenStable();
    expect(focusable.getAttribute('tabindex')).toBe('0');
    expand.close();
    await fixture.whenStable();
    expect(focusable.getAttribute('tabindex')).toBe('0');
  });

  it('closes on Escape and stops the key there, but only while open', async () => {
    const { fixture, host, element, press } = await render();
    const page = vi.fn();
    document.addEventListener('keydown', page);

    expect(press(element('#first'), 'Escape').defaultPrevented).toBe(false);
    expect(page).toHaveBeenCalledTimes(1);

    host.expanded.set(true);
    await fixture.whenStable();
    expect(press(element('#first'), 'Escape').defaultPrevented).toBe(true);
    await fixture.whenStable();

    expect(host.expanded()).toBe(false);
    expect(page).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', page);
  });

  it('leaves an Escape that a control inside already handled', async () => {
    const { fixture, host, element } = await render();
    host.expanded.set(true);
    await fixture.whenStable();
    const handled = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();

    element('#first').dispatchEvent(handled);
    await fixture.whenStable();

    expect(host.expanded()).toBe(true);
  });

  it('keeps Tab and Shift+Tab inside the host while it is open', async () => {
    const { fixture, host, element, press } = await render();
    const first = element('#first');
    const last = element('#last');

    expect(press(last, 'Tab').defaultPrevented).toBe(false);

    host.expanded.set(true);
    await fixture.whenStable();
    last.focus();
    expect(press(last, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(press(first, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    // Between the two, the browser's own Tab moves on.
    expect(press(first, 'Tab').defaultPrevented).toBe(false);
  });

  it('follows the browser when it takes the host out of the top layer', async () => {
    const { fixture, host, section } = await render();
    host.expanded.set(true);
    await fixture.whenStable();

    section.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }));
    await fixture.whenStable();

    expect(host.expanded()).toBe(false);
    expect(section.hasAttribute('popover')).toBe(false);
  });

  it('changes its state without the Popover API, leaving the host in its place', async () => {
    removePopoverApi();
    const { fixture, host, section, element } = await render();

    element('#first').click();
    await fixture.whenStable();

    expect(host.expanded()).toBe(true);
    expect(section.hasAttribute('data-neat-expanded')).toBe(true);
    expect(section.hasAttribute('popover')).toBe(false);
  });
});

describe('the expanded look', () => {
  const css = expandStyles.replace(/\/\*[\s\S]*?\*\//g, '');
  const layered = css.slice(css.indexOf('@layer base'));
  const unlayered = css.slice(0, css.indexOf('@layer base'));

  it('covers the window from outside any layer, so the host’s own sizing gives way', () => {
    expect(unlayered).toContain('[data-neat-expanded]:popover-open');
    for (const declaration of ['position: fixed', 'inset: 0', 'width: auto', 'height: auto']) {
      expect(unlayered).toContain(declaration);
    }
  });

  it('gives its fill and colors in the base layer, so the host’s own win', () => {
    for (const declaration of ['background-color: var(--background)', 'color: var(--foreground)']) {
      expect(layered).toContain(declaration);
      expect(unlayered).not.toContain(declaration);
    }
  });

  it('adds no padding, which would shrink a component’s content box under its parts', () => {
    expect(css).not.toContain('padding');
  });
});
