import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NeatPage } from './page';
import pageStyles from './page.css' with { loader: 'text' };

@Component({
  imports: [NeatPage],
  template: `
    <neat-page [scroll]="scroll()" [padding]="padding()">
      <p>Long content</p>
    </neat-page>
  `,
})
class Host {
  readonly scroll = signal<'body' | 'none'>('body');
  readonly padding = signal<'page' | 'none'>('page');
}

describe('NeatPage', () => {
  let fixture: ComponentFixture<Host>;

  const page = (): HTMLElement => fixture.nativeElement.querySelector('neat-page');
  const body = (): HTMLElement => page().querySelector('.body') as HTMLElement;
  // jsdom computes the stylesheet's `overflow` shorthand but does not expand it into
  // `overflow-x`/`overflow-y`, so the shorthand is what can be asserted.
  const overflow = (element: Element): string => getComputedStyle(element).overflow;

  // jsdom resolves no var() in `padding` (it computes 0), so the inset of a padded page is asserted
  // as the stylesheet's rule for the state its body is in; the app's e2e suite measures it.
  const paddingRule = (state: string): string | undefined =>
    new RegExp(`\\.body\\[data-padding='${state}'\\]\\s*\\{([^}]*)\\}`)
      .exec(pageStyles)?.[1]
      .match(/padding:\s*([^;]+);/)?.[1];

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

  it('with padding="page" insets the content by the page spacing token', () => {
    expect(body().dataset['padding']).toBe('page');
    expect(paddingRule('page')).toBe('var(--neat-space-6)');
  });

  it('with padding="none" lets the content reach the edges', async () => {
    fixture.componentInstance.padding.set('none');
    await fixture.whenStable();

    expect(body().dataset['padding']).toBe('none');
    expect(getComputedStyle(body()).padding).toBe('0px');
  });

  it('pads the body inside its scroll container, which keeps its size', () => {
    // On the scrolling element, the padding scrolls with the content instead of framing it, and
    // border-box keeps the padded body at the page's height.
    expect(getComputedStyle(body()).boxSizing).toBe('border-box');
    expect(getComputedStyle(body()).height).toBe('100%');
  });

  it('pads the page and scrolls the body by default', async () => {
    const plain = TestBed.createComponent(NeatPage);
    await plain.whenStable();

    const plainBody = plain.nativeElement.querySelector('.body') as HTMLElement;
    expect(plainBody.dataset['padding']).toBe('page');
    expect(overflow(plainBody)).toBe('auto');
  });
});
