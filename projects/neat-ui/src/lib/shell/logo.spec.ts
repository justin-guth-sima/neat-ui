import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeService } from '../theme/theme.service';
import { NeatLogo } from './logo';

describe('NeatLogo', () => {
  let fixture: ComponentFixture<NeatLogo>;

  const svg = (): SVGSVGElement => fixture.nativeElement.querySelector('svg');
  const fills = (): Set<string | null> =>
    new Set(Array.from(svg().querySelectorAll('[fill]'), (shape) => shape.getAttribute('fill')));

  beforeEach(async () => {
    localStorage.clear();
    fixture = TestBed.createComponent(NeatLogo);
    await fixture.whenStable();
  });

  afterEach(() => document.documentElement.classList.remove('neat-dark'));

  it('renders the full-color mark in the light scheme', () => {
    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toBe('SiMa.ai');
    expect(fills()).toContain('#d26728');
    expect(fills()).toContain('#010f0e');
  });

  it('renders the same full-color mark in the dark scheme, under the same name', async () => {
    const light = fills();
    TestBed.inject(ThemeService).setScheme('dark');
    await fixture.whenStable();

    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toBe('SiMa.ai');
    expect(fills()).toEqual(light);
    for (const fill of ['#a4cc2d', '#2a9c4f', '#d26728', '#5998dd'])
      expect(fills()).toContain(fill);
    expect(fills()).not.toContain('#fff');
  });
});
