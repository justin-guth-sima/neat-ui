import { TestBed } from '@angular/core/testing';
import { CoreLoad } from './1-core-load.example';

describe('the heatmap examples', () => {
  it('draw a row per core, the saturated core’s figure in the danger colour', async () => {
    const fixture = TestBed.createComponent(CoreLoad);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const names = Array.from(host.querySelectorAll('.name'), (name) => name.textContent?.trim());
    const ends = Array.from(host.querySelectorAll<HTMLElement>('.end'));
    const tone = (index: number) => ends[index].style.getPropertyValue('--tone');

    expect(names).toEqual(Array.from({ length: 16 }, (_, index) => `Core ${index}`));
    expect(tone(15)).toContain('danger');
    expect(tone(0)).not.toContain('danger');
    expect(tone(0)).not.toContain('warning');
  });
});
