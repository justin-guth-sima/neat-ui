import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { WalkingAPath } from './1-walking-a-path.example';

describe('the breadcrumbs examples', () => {
  let fixture: ComponentFixture<WalkingAPath>;
  let host: HTMLElement;

  const crumbs = () =>
    Array.from(host.querySelectorAll('nav li'), (item) =>
      item.textContent?.replace(/[›\s]+/g, ' ').trim(),
    );
  const deeper = () => host.querySelector<HTMLButtonElement>('p button')!;

  beforeEach(async () => {
    fixture = TestBed.createComponent(WalkingAPath);
    await fixture.whenStable();
    host = fixture.nativeElement;
  });

  it('start three levels deep, the last crumb the location with its detail', () => {
    expect(host.querySelector('nav')?.getAttribute('aria-label')).toBe('Example path');
    expect(crumbs()).toEqual(['Overview', 'Detector', 'Backbone CSPDarknet']);
    expect(host.querySelector('[aria-current="location"]')?.textContent?.trim()).toBe(
      'Backbone CSPDarknet',
    );
  });

  it('cut the path at a crumb that is pressed, and walk it forward with Deeper', async () => {
    host.querySelector<HTMLButtonElement>('nav button')!.click();
    await fixture.whenStable();

    expect(crumbs()).toEqual(['Overview']);

    deeper().click();
    await fixture.whenStable();

    expect(crumbs()).toEqual(['Overview', 'Detector YOLOX']);
  });

  it('turn Deeper off at the last level', async () => {
    expect(deeper().disabled).toBe(false);

    deeper().click();
    await fixture.whenStable();

    expect(crumbs().at(-1)).toBe('Stages four stages');
    expect(deeper().disabled).toBe(true);
  });
});
