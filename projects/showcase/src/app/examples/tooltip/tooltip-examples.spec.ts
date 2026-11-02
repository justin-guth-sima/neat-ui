import { TestBed } from '@angular/core/testing';
import { Positions } from './1-positions.example';

describe('the tooltip examples', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('give a button to each side, named for it, and show its tooltip on hover', async () => {
    const fixture = TestBed.createComponent(Positions);
    await fixture.whenStable();
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'left',
      'bottom',
      'top',
      'right',
    ]);

    buttons[3].dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(document.querySelector('[role="tooltip"]')?.textContent?.trim()).toBe(
      'Tooltip on the right',
    );
  });
});
