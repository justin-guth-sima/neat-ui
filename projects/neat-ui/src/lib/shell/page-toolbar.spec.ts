import { CdkPortalOutlet } from '@angular/cdk/portal';
import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatPageToolbar, PageToolbarSlot } from './page-toolbar';

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

    fixture.componentInstance.second.set(true);

    // Two pages cannot share the top bar; a second toolbar is a mistake in the app.
    await expect(fixture.whenStable()).rejects.toThrow(/one page toolbar at a time/);
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
