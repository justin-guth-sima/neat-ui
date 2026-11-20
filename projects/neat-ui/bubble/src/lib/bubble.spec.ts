import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatBubble, type NeatBubbleSide } from './bubble';

@Component({
  imports: [NeatBubble],
  template: `
    <button #target type="button">Pipeline</button>
    <neat-bubble [anchor]="shown() ? target : null" [side]="side()" (hover)="hovers.push($event)">
      The chain of nodes a frame runs through.
    </neat-bubble>
  `,
})
class BubbleHost {
  readonly shown = signal(true);
  readonly side = signal<NeatBubbleSide>('top');
  readonly hovers: boolean[] = [];
}

describe('NeatBubble', () => {
  const bubble = (): HTMLElement | null => document.querySelector('.cdk-overlay-container .bubble');

  async function render() {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    const fixture = TestBed.createComponent(BubbleHost);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.getBoundingClientRect = () => new DOMRect(472, 368, 80, 32);
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('shows its content in the overlay while it has an anchor, with an id to describe it by', async () => {
    const { fixture, host } = await render();
    const shown = bubble();
    expect(shown?.textContent?.trim()).toBe('The chain of nodes a frame runs through.');
    expect(shown?.id).toMatch(/^neat-bubble-\d+$/);
    expect(fixture.nativeElement.querySelector('neat-bubble').textContent.trim()).toBe('');

    host.shown.set(false);
    await fixture.whenStable();
    expect(bubble()).toBeNull();

    host.shown.set(true);
    await fixture.whenStable();
    expect(bubble()).not.toBeNull();
  });

  it('says the side it is on and where its tail points', async () => {
    const { fixture, host } = await render();
    expect(bubble()?.dataset['side']).toBe('top');
    expect(bubble()?.style.getPropertyValue('--tail-at')).toMatch(/px$/);

    host.side.set('right');
    await fixture.whenStable();
    expect(bubble()?.dataset['side']).toBe('right');
  });

  it('tells a mouse or a pen coming onto it and leaving, not a touch', async () => {
    const { host } = await render();
    const shown = bubble()!;
    shown.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    shown.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    shown.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    expect(host.hovers).toEqual([true, false]);
  });

  it('goes when its component does', async () => {
    const { fixture } = await render();
    fixture.destroy();
    expect(bubble()).toBeNull();
  });
});
