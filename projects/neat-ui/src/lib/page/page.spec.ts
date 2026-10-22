import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NeatPage } from './page';
import pageStyles from './page.css' with { loader: 'text' };

@Component({
  imports: [NeatPage],
  template: `
    <neat-page [scroll]="scroll()" [padding]="padding()" [aside]="aside()">
      <p>Long content</p>
      <section neatPageAside class="inspector">Inspector</section>
    </neat-page>
  `,
})
class Host {
  readonly scroll = signal<'body' | 'none'>('body');
  readonly padding = signal<'page' | 'none'>('page');
  readonly aside = signal<'open' | 'closed'>('closed');
}

describe('NeatPage', () => {
  let fixture: ComponentFixture<Host>;

  const page = (): HTMLElement => fixture.nativeElement.querySelector('neat-page');
  const body = (): HTMLElement => page().querySelector('.body') as HTMLElement;
  const aside = (): HTMLElement | null => page().querySelector('aside');
  // jsdom computes the stylesheet's `overflow` shorthand but does not expand it into
  // `overflow-x`/`overflow-y`, so the shorthand is what can be asserted.
  const overflow = (element: Element): string => getComputedStyle(element).overflow;

  // jsdom resolves no var() in `padding` (it computes 0), so the inset of a padded page is asserted
  // as the stylesheet's rule for the state its body is in; the app's e2e suite measures it.
  const paddingRule = (state: string): string | undefined =>
    new RegExp(`\\.body\\[data-padding='${state}'\\]\\s*\\{([^}]*)\\}`)
      .exec(pageStyles)?.[1]
      .match(/padding:\s*([^;]+);/)?.[1];

  /** The declarations of the stylesheet's `aside` rule. */
  const asideRule = (): string | undefined => /(?:^|\n)aside\s*\{([^}]*)\}/.exec(pageStyles)?.[1];

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

  it('an open aside narrows the body; the body and the aside scroll independently; closed renders nothing', async () => {
    // Closed: no aside element, and the projected aside content is not in the page.
    expect(aside()).toBeNull();
    expect(page().querySelector('.inspector')).toBeNull();

    fixture.componentInstance.aside.set('open');
    await fixture.whenStable();

    const panel = aside() as HTMLElement;
    expect(panel.querySelector('.inspector')?.textContent).toBe('Inspector');
    expect(body().contains(panel)).toBe(false);
    // Beside the body, not over it: the page lays the two out in a row, the body takes what the
    // aside leaves and may shrink below its content's width, and the aside keeps its width.
    expect(getComputedStyle(page()).display).toBe('flex');
    expect(getComputedStyle(body()).flexGrow).toBe('1');
    expect(getComputedStyle(body()).minWidth).toBe('0px');
    expect(getComputedStyle(panel).flexShrink).toBe('0');
    expect(getComputedStyle(panel).position).not.toMatch(/absolute|fixed/);
    // jsdom resolves no var(), so the width is asserted as the stylesheet's rule.
    expect(asideRule()).toMatch(/width:\s*var\(--neat-aside-width\);/);
    expect(asideRule()).toMatch(/border-inline-start:\s*1px solid var\(--border\);/);
    // Two scroll containers side by side; the page itself still never scrolls.
    expect(overflow(body())).toBe('auto');
    expect(overflow(panel)).toBe('auto');
    expect(overflow(page())).toBe('hidden');

    // With a body that does not scroll, the aside is the page's only scroll context.
    fixture.componentInstance.scroll.set('none');
    await fixture.whenStable();
    expect(overflow(body())).toBe('hidden');
    expect(overflow(panel)).toBe('auto');

    fixture.componentInstance.aside.set('closed');
    await fixture.whenStable();
    expect(aside()).toBeNull();
    expect(page().querySelector('.inspector')).toBeNull();
  });

  it('keeps the aside closed by default', async () => {
    const plain = TestBed.createComponent(NeatPage);
    await plain.whenStable();

    expect(plain.nativeElement.querySelector('aside')).toBeNull();
  });
});
