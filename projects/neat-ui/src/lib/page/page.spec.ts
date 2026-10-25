import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NeatPage } from './page';
import { NeatViewport } from './viewport';
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
  // The viewport the page reads, as a stub a test can turn narrow.
  const narrow = signal(false);

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

  /** The declarations of the stylesheet's rule for the aside beside the body. */
  const asideRule = (): string | undefined =>
    /:host\(\[data-aside='beside'\]\) aside\s*\{([^}]*)\}/.exec(pageStyles)?.[1];
  /** The declarations every aside shares, beside the body or over it. */
  const sharedAsideRule = (): string | undefined =>
    /(?:^|\n)aside\s*\{([^}]*)\}/.exec(pageStyles)?.[1];

  /** The declarations of the rule that floats the aside over the body. */
  const overlayAsideRule = (): string | undefined =>
    /:host\(\[data-aside='overlay'\]\) aside\s*\{([^}]*)\}/.exec(pageStyles)?.[1];

  beforeEach(async () => {
    narrow.set(false);
    TestBed.configureTestingModule({
      providers: [{ provide: NeatViewport, useValue: { narrow } }],
    });
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
    expect(sharedAsideRule()).toMatch(/border-inline-start:\s*1px solid var\(--border\);/);
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

  it('beside the body on a wide screen: the host says so and nothing floats', async () => {
    fixture.componentInstance.aside.set('open');
    await fixture.whenStable();

    expect(page().dataset['aside']).toBe('beside');
    expect(getComputedStyle(page()).position).toBe('relative');
    expect(getComputedStyle(aside() as HTMLElement).position).toBe('static');
    expect(getComputedStyle(body()).flexGrow).toBe('1');
  });

  it('over the body on a narrow screen: the host says so, and the aside floats inside the page', async () => {
    narrow.set(true);
    fixture.componentInstance.aside.set('open');
    await fixture.whenStable();

    expect(page().dataset['aside']).toBe('overlay');
    // The page is the aside's containing block, so it floats over the page's own box and the body
    // keeps the page's whole width (it is the only item left in the row).
    expect(getComputedStyle(page()).position).toBe('relative');
    expect(getComputedStyle(aside() as HTMLElement).position).toBe('absolute');
    // jsdom resolves no var() or min(), so the rest is asserted as the stylesheet's rule.
    expect(overlayAsideRule()).toMatch(/inset-block:\s*0;/);
    expect(overlayAsideRule()).toMatch(/inset-inline-end:\s*0;/);
    expect(overlayAsideRule()).toMatch(/z-index:\s*1;/);
    expect(overlayAsideRule()).toMatch(/width:\s*min\(var\(--neat-aside-width\),\s*100%\);/);
    expect(overlayAsideRule()).toMatch(/background:\s*var\(--background\);/);
    // The kit's raised-surface shadow, as its utility (the popover and the toast take theirs the same way).
    expect((aside() as HTMLElement).className).toContain('shadow-md');
  });

  it('follows the viewport when it is resized across the breakpoint', async () => {
    fixture.componentInstance.aside.set('open');
    await fixture.whenStable();
    expect(page().dataset['aside']).toBe('beside');

    narrow.set(true);
    await fixture.whenStable();
    expect(page().dataset['aside']).toBe('overlay');

    narrow.set(false);
    await fixture.whenStable();
    expect(page().dataset['aside']).toBe('beside');
  });

  it('keeps the aside closed by default', async () => {
    const plain = TestBed.createComponent(NeatPage);
    await plain.whenStable();

    expect(plain.nativeElement.querySelector('aside')).toBeNull();
  });
});
