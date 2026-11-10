import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatSwatch } from './swatch';
import swatchStyles from './swatch.css' with { loader: 'text' };

@Component({
  imports: [NeatSwatch],
  template: `<neat-swatch [color]="color()" />`,
})
class SwatchHost {
  readonly color = signal('rgb(10 20 30)');
}

/** The declarations of the sheet's `:host` rule. */
const hostRule = /(?:^|\n):host\s*\{([^}]*)\}/.exec(swatchStyles)?.[1] ?? '';

describe('NeatSwatch', () => {
  it('shows the colour it is given, and follows it', async () => {
    const fixture = TestBed.createComponent(SwatchHost);
    await fixture.whenStable();
    const swatch = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'neat-swatch',
    )!;
    expect(swatch.style.getPropertyValue('--swatch')).toBe('rgb(10 20 30)');
    fixture.componentInstance.color.set('var(--primary)');
    await fixture.whenStable();
    expect(swatch.style.getPropertyValue('--swatch')).toBe('var(--primary)');
  });

  it('is hidden from assistive technology: the label beside it names the thing', async () => {
    const fixture = TestBed.createComponent(SwatchHost);
    await fixture.whenStable();
    const swatch = (fixture.nativeElement as HTMLElement).querySelector('neat-swatch')!;
    expect(swatch.getAttribute('aria-hidden')).toBe('true');
  });

  it('states its look once: a 0.625rem square with 2px corners in its colour at full strength', () => {
    expect(hostRule).toMatch(/(?:^|[;\s])width:\s*0\.625rem;/);
    expect(hostRule).toMatch(/(?:^|[;\s])height:\s*0\.625rem;/);
    expect(hostRule).toMatch(/(?:^|[;\s])border-radius:\s*2px;/);
    expect(hostRule).toMatch(/(?:^|[;\s])flex:\s*none;/);
    expect(hostRule).toMatch(/(?:^|[;\s])background:\s*var\(--swatch\);/);
  });
});
