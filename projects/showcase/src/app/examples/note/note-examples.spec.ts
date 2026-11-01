import { TestBed } from '@angular/core/testing';
import { UnderAControl } from './1-under-a-control.example';

describe('the note example', () => {
  it('describe the input by the note, which holds the inline button', async () => {
    const fixture = TestBed.createComponent(UnderAControl);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector('input')!;
    const note = document.getElementById(input.getAttribute('aria-describedby') ?? '')!;

    expect(note.textContent).toContain('Applies to every channel that has no value of its own.');
    expect(note.querySelector('button')?.textContent?.trim()).toBe('Show channels');
  });
});
