import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { NeatRoiPolygon } from '../overlays/overlay-settings';
import { OVERLAY_ROI_COLORS } from '../theme/overlay-palette';
import { NeatRoiSwatch } from './roi-swatch';

@Component({
  imports: [NeatRoiSwatch],
  template: `<neat-roi-swatch [type]="type()" />`,
})
class Host {
  readonly type = signal<NeatRoiPolygon['type']>('inclusion');
}

describe('NeatRoiSwatch', () => {
  it("neat-roi-swatch draws the type's stroke colour and is hidden from assistive technology", async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const swatch: HTMLElement = fixture.nativeElement.querySelector('neat-roi-swatch');

    expect(swatch.style.backgroundColor).toBe(OVERLAY_ROI_COLORS.inclusion.stroke);
    expect(swatch.getAttribute('aria-hidden')).toBe('true');
    expect(swatch.textContent).toBe('');

    fixture.componentInstance.type.set('exclusion');
    await fixture.whenStable();

    expect(swatch.style.backgroundColor).toBe(OVERLAY_ROI_COLORS.exclusion.stroke);
  });

  it('is a round dot that keeps its size in a flex row', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const style = getComputedStyle(fixture.nativeElement.querySelector('neat-roi-swatch'));

    expect(style.display).toBe('inline-block');
    expect(style.borderRadius).toBe('50%');
    expect(style.flexShrink).toBe('0');
    expect(style.width).toBe(style.height);
  });
});
