import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NeatPage } from './page';

@Component({
  imports: [NeatPage],
  template: `
    <neat-page [scroll]="scroll()">
      <p>Long content</p>
    </neat-page>
  `,
})
class Host {
  readonly scroll = signal<'body' | 'none'>('body');
}

describe('NeatPage', () => {
  let fixture: ComponentFixture<Host>;

  const page = (): HTMLElement => fixture.nativeElement.querySelector('neat-page');
  const body = (): HTMLElement => page().querySelector('.body') as HTMLElement;
  // jsdom computes the stylesheet's `overflow` shorthand but does not expand it into
  // `overflow-x`/`overflow-y`, so the shorthand is what can be asserted.
  const overflow = (element: Element): string => getComputedStyle(element).overflow;

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
  });

  it('projects its content into the page body', () => {
    expect(body().querySelector('p')?.textContent).toBe('Long content');
  });

  it('fills its parent', () => {
    expect(getComputedStyle(page()).height).toBe('100%');
  });

  it('with scroll="body" makes only the page body scrollable', () => {
    expect(overflow(body())).toBe('auto');
    expect(overflow(page())).toBe('hidden');
  });

  it('with scroll="none" makes nothing scrollable', async () => {
    fixture.componentInstance.scroll.set('none');
    await fixture.whenStable();

    expect(overflow(body())).toBe('hidden');
    expect(overflow(page())).toBe('hidden');
  });

  it('scrolls the body by default', async () => {
    const plain = TestBed.createComponent(NeatPage);
    await plain.whenStable();

    const plainBody = plain.nativeElement.querySelector('.body') as HTMLElement;
    expect(overflow(plainBody)).toBe('auto');
  });
});
