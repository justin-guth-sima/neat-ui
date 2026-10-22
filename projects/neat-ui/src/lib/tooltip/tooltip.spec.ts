import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatTooltip, type NeatTooltipPosition } from './tooltip';

@Component({
  imports: [NeatTooltip],
  template: `
    <button
      type="button"
      neatTooltip="Save the layout"
      [neatTooltipPosition]="position()"
      [neatTooltipDisabled]="disabled()"
    >
      Save
    </button>
  `,
})
class TooltipHost {
  readonly position = signal<NeatTooltipPosition>('top');
  readonly disabled = signal(false);
}

@Component({
  imports: [NeatTooltip],
  template: `<button type="button" neatTooltip="Hint">Go</button>`,
})
class DefaultTooltipHost {}

const POSITIONS: NeatTooltipPosition[] = ['top', 'right', 'bottom', 'left'];

describe('NeatTooltip', () => {
  const tooltip = (): HTMLElement | null => document.querySelector('[role="tooltip"]');

  async function render<T>(component: new () => T, setup: (host: T) => void = () => undefined) {
    const fixture = TestBed.createComponent(component);
    setup(fixture.componentInstance);
    await fixture.whenStable();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    // jsdom lays nothing out: give the viewport a size and put the trigger in its middle, so every
    // position fits and the overlay does not flip to another side.
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    trigger.getBoundingClientRect = () => new DOMRect(472, 368, 80, 32);
    /** Runs the tooltip's timers (show and hide use a zero delay) and change detection. */
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    return { fixture, trigger, settle };
  }

  const hover = (element: HTMLElement, type: 'pointerenter' | 'pointerleave') =>
    element.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse' }));

  /** Shown means attached and open; on hide the content plays its exit animation, then detaches. */
  const shown = () => {
    const element = tooltip();
    return element !== null && element.getAttribute('data-state') !== 'closed';
  };

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('shows the text in [role=tooltip] on mouse pointerenter and on focus; hides on leave, blur and Escape', async () => {
    const { trigger, settle } = await render(TooltipHost);
    expect(tooltip()).toBeNull();

    hover(trigger, 'pointerenter');
    await settle();
    expect(shown()).toBe(true);
    expect(tooltip()?.textContent?.trim()).toBe('Save the layout');

    hover(trigger, 'pointerleave');
    await settle();
    expect(shown()).toBe(false);

    trigger.dispatchEvent(new FocusEvent('focus'));
    await settle();
    expect(shown()).toBe(true);

    trigger.dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect(shown()).toBe(false);

    hover(trigger, 'pointerenter');
    await settle();
    expect(shown()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    expect(shown()).toBe(false);
  });

  it('never opens for a touch pointer', async () => {
    const { trigger, settle } = await render(TooltipHost);

    trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    await settle();

    expect(tooltip()).toBeNull();
  });

  it('sets aria-describedby on the host while shown', async () => {
    const { trigger, settle } = await render(TooltipHost);
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);

    hover(trigger, 'pointerenter');
    await settle();
    const id = trigger.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(tooltip()?.id).toBe(id);

    hover(trigger, 'pointerleave');
    await settle();
    await settle();
    expect(trigger.hasAttribute('aria-describedby')).toBe(false);
  });

  it('neatTooltipDisabled suppresses it', async () => {
    const { fixture, trigger, settle } = await render(TooltipHost, (host) =>
      host.disabled.set(true),
    );

    hover(trigger, 'pointerenter');
    await settle();
    expect(tooltip()).toBeNull();

    hover(trigger, 'pointerleave');
    fixture.componentInstance.disabled.set(false);
    await settle();
    hover(trigger, 'pointerenter');
    await settle();
    expect(shown()).toBe(true);
  });

  it.each(POSITIONS)('positions per neatTooltipPosition: %s', async (position) => {
    const { trigger, settle } = await render(TooltipHost, (host) => host.position.set(position));

    hover(trigger, 'pointerenter');
    await settle();

    expect(tooltip()?.getAttribute('data-side')).toBe(position);
  });

  it('defaults to the top position and takes the kit tooltip styles', async () => {
    const { trigger, settle } = await render(DefaultTooltipHost);

    hover(trigger, 'pointerenter');
    await settle();

    expect(tooltip()?.getAttribute('data-side')).toBe('top');
    // Inverted colours: the theme's text colour as the fill, its background as the text.
    expect(tooltip()?.classList).toContain('bg-foreground');
    expect(tooltip()?.classList).toContain('text-background');
  });
});
