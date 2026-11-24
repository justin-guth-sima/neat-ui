import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatLiveBadge } from './live-badge';

@Component({
  imports: [NeatLiveBadge],
  template: `
    <neat-live-badge [live]="live()" [onPicture]="onPicture()">{{ text() }}</neat-live-badge>
  `,
})
class Host {
  readonly live = signal(true);
  readonly onPicture = signal(true);
  readonly text = signal('Live');
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const badge = (fixture.nativeElement as HTMLElement).querySelector('neat-live-badge')!;
  return { fixture, badge };
}

describe('NeatLiveBadge', () => {
  it('leads a live picture’s text with the pulsing live dot, on the video scrim', async () => {
    const { badge } = await render();

    expect(badge.textContent?.trim()).toBe('Live');
    expect(badge.querySelector('neat-live-dot .ring')).not.toBeNull();
    expect(badge.querySelector('.idle')).toBeNull();
    expect(badge.hasAttribute('data-on-picture')).toBe(true);
  });

  it('shows a still gray dot for anything else, and the muted pill off a picture', async () => {
    const { fixture, badge } = await render();
    fixture.componentInstance.live.set(false);
    fixture.componentInstance.onPicture.set(false);
    fixture.componentInstance.text.set('Not live');
    await fixture.whenStable();

    expect(badge.textContent?.trim()).toBe('Not live');
    expect(badge.querySelector('neat-live-dot')).toBeNull();
    expect(badge.querySelector('.idle')?.getAttribute('aria-hidden')).toBe('true');
    expect(badge.hasAttribute('data-on-picture')).toBe(false);
  });

  it('takes the attributes alone, as the other boolean inputs do', async () => {
    @Component({
      imports: [NeatLiveBadge],
      template: `<neat-live-badge live onPicture>Live</neat-live-badge>`,
    })
    class Bare {}
    const fixture = TestBed.createComponent(Bare);
    await fixture.whenStable();
    const badge = (fixture.nativeElement as HTMLElement).querySelector('neat-live-badge')!;

    expect(badge.querySelector('neat-live-dot')).not.toBeNull();
    expect(badge.hasAttribute('data-on-picture')).toBe(true);
  });
});
