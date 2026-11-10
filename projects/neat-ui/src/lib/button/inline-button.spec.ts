import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatInlineButton } from './inline-button';

@Component({
  imports: [NeatInlineButton],
  template: `
    <p>
      Channel 3
      <button
        neatInlineButton
        type="button"
        class="host-class"
        [class.bound-class]="bound()"
        [disabled]="disabled()"
        (click)="clicks = clicks + 1"
      >
        Use global
      </button>
    </p>
    <a neatInlineButton href="#settings">Settings</a>
  `,
})
class InlineHost {
  readonly bound = signal(true);
  readonly disabled = signal(false);
  clicks = 0;
}

async function render() {
  const fixture = TestBed.createComponent(InlineHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  return {
    fixture,
    host: fixture.componentInstance,
    button: root.querySelector('button') as HTMLButtonElement,
    anchor: root.querySelector('a') as HTMLAnchorElement,
  };
}

describe('NeatInlineButton', () => {
  it('is helm’s link variant: medium weight, underlined on hover', async () => {
    const { button } = await render();

    expect([...button.classList]).toEqual(
      expect.arrayContaining(['font-medium', 'underline-offset-4', 'hover:underline']),
    );
  });

  it('has no box: no fixed height, padding or border', async () => {
    const { button } = await render();

    expect([...button.classList]).toEqual(expect.arrayContaining(['h-auto', 'p-0', 'border-0']));
    for (const boxed of [
      'h-9',
      'px-2.5',
      'border',
      'has-data-[icon=inline-end]:pr-2',
      'has-data-[icon=inline-start]:pl-2',
    ]) {
      expect(button.classList, boxed).not.toContain(boxed);
    }
  });

  it('takes the font size and color of its line instead of helm’s', async () => {
    const { button } = await render();

    expect([...button.classList]).toEqual(
      expect.arrayContaining(['text-[length:inherit]', 'text-inherit']),
    );
    expect(button.classList).not.toContain('text-sm');
    expect(button.classList).not.toContain('text-primary');
  });

  it('draws the kit’s full-strength focus ring, not helm’s half-strength one', async () => {
    const { button } = await render();

    expect([...button.classList]).toEqual(
      expect.arrayContaining(['focus-visible:ring-3', 'focus-visible:ring-ring']),
    );
    expect(button.classList).not.toContain('focus-visible:ring-ring/50');
  });

  it('keeps classes the host sets via class="…" and [class.x] alongside its own', async () => {
    const { fixture, host, button } = await render();
    expect([...button.classList]).toEqual(
      expect.arrayContaining(['host-class', 'bound-class', 'hover:underline']),
    );

    host.bound.set(false);
    await fixture.whenStable();
    expect(button.classList).not.toContain('bound-class');
    expect([...button.classList]).toEqual(
      expect.arrayContaining(['host-class', 'hover:underline']),
    );
  });

  it('styles an anchor the same way', async () => {
    const { button, anchor } = await render();

    const own = (element: HTMLElement) =>
      [...element.classList].filter((name) => !name.endsWith('-class'));
    expect(own(anchor)).toEqual(own(button));
  });

  it('disabled reaches the native button and blocks clicks', async () => {
    const { fixture, host, button } = await render();
    host.disabled.set(true);
    await fixture.whenStable();

    expect(button.disabled).toBe(true);
    expect(button.hasAttribute('data-disabled')).toBe(true);
    button.click();
    expect(host.clicks).toBe(0);

    host.disabled.set(false);
    await fixture.whenStable();
    button.click();
    expect(host.clicks).toBe(1);
  });
});
