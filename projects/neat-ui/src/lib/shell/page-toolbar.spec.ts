import { CdkPortalOutlet } from '@angular/cdk/portal';
import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatPageToolbar, NeatPageToolbarDivider, PageToolbarSlot } from './page-toolbar';

@Component({
  imports: [NeatPageToolbar],
  template: `
    <span *neatPageToolbar>First</span>
    @if (second()) {
      <span *neatPageToolbar>Second</span>
    }
  `,
})
class TwoToolbars {
  readonly second = signal(false);
}

@Component({
  imports: [NeatPageToolbar],
  template: `<span class="tool" *neatPageToolbar>Tool</span>`,
})
class ToolbarPage {}

/** Renders the registered toolbar, as the shell's top bar does. */
@Component({
  imports: [CdkPortalOutlet],
  template: `<ng-template [cdkPortalOutlet]="slot.portal()" />`,
})
class Outlet {
  protected readonly slot = inject(PageToolbarSlot);
}

describe('NeatPageToolbar', () => {
  it('a second page toolbar registration throws in dev mode', async () => {
    const fixture = TestBed.createComponent(TwoToolbars);
    await fixture.whenStable();

    // Angular's ErrorHandler logs the error as well as rejecting; the log is part of what an app
    // developer sees, so it is asserted here rather than left in the test output.
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fixture.componentInstance.second.set(true);

    try {
      // Two pages cannot share the top bar; a second toolbar is a mistake in the app.
      await expect(fixture.whenStable()).rejects.toThrow(/one page toolbar at a time/);
      expect(error).toHaveBeenCalledWith(
        'ERROR',
        expect.objectContaining({ message: expect.stringMatching(/one page toolbar at a time/) }),
      );
    } finally {
      error.mockRestore();
    }
  });

  it('takes its content out of the shell as soon as the page is destroyed', async () => {
    const page = TestBed.createComponent(ToolbarPage);
    const outlet = TestBed.createComponent(Outlet);
    await outlet.whenStable();
    expect(outlet.nativeElement.querySelector('.tool')?.textContent).toBe('Tool');

    page.destroy();

    // Before any change detection: the content's bindings never run against a destroyed page.
    expect(outlet.nativeElement.querySelector('.tool')).toBeNull();
    expect(TestBed.inject(PageToolbarSlot).portal()).toBeNull();
  });
});

describe('NeatPageToolbarDivider', () => {
  @Component({
    imports: [NeatPageToolbarDivider],
    template: `<hr neatPageToolbarDivider />`,
  })
  class Host {}

  it('is a decorative line of the border color, inset from the row at top and bottom', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const hr = fixture.nativeElement.querySelector('hr') as HTMLElement;

    expect(hr.getAttribute('aria-hidden')).toBe('true');
    // jsdom computes no Tailwind, so the look is checked as the classes that carry it.
    expect([...hr.classList].sort()).toEqual(
      'm-0 my-(--neat-space-3) h-auto w-px shrink-0 self-stretch border-0 bg-border'
        .split(' ')
        .sort(),
    );
  });
});
