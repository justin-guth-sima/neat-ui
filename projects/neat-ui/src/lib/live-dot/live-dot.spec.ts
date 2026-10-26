import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import liveDotStyles from './live-dot.css' with { loader: 'text' };
import { NeatLiveDot } from './live-dot';

@Component({
  imports: [NeatLiveDot],
  template: `
    <neat-live-dot id="still" />
    <neat-live-dot id="beating" pulse />
  `,
})
class DotHost {}

async function render() {
  const fixture = TestBed.createComponent(DotHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  return {
    still: root.querySelector('#still') as HTMLElement,
    beating: root.querySelector('#beating') as HTMLElement,
  };
}

/** The stylesheet inside its `no-preference` media block, and the rest outside it. */
function splitMotion(css: string): { inside: string; outside: string } {
  const start = css.indexOf('@media (prefers-reduced-motion: no-preference)');
  if (start < 0) return { inside: '', outside: css };
  // The block ends at the first line that starts with a closing brace.
  const end = css.indexOf('\n}', start) + 2;
  return { inside: css.slice(start, end), outside: css.slice(0, start) + css.slice(end) };
}

describe('NeatLiveDot', () => {
  it('is hidden from assistive technology: the text beside it carries the meaning', async () => {
    const { still, beating } = await render();

    expect(still.getAttribute('aria-hidden')).toBe('true');
    expect(beating.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws a dot and no ring without pulse', async () => {
    const { still } = await render();

    expect(still.querySelector('.dot')).not.toBeNull();
    expect(still.querySelector('.ring')).toBeNull();
    expect(still.querySelector('.dot')?.classList).not.toContain('beat');
  });

  it('draws the ring, and beats the dot, with the boolean attribute pulse', async () => {
    const { beating } = await render();

    expect(beating.querySelector('.ring')).not.toBeNull();
    expect(beating.querySelector('.dot')?.classList).toContain('beat');
  });

  it('is 0.625rem across, in its own live token for the dot and the ring alike', () => {
    expect(liveDotStyles).toMatch(/:host\s*\{[^}]*width:\s*0\.625rem/);
    expect(liveDotStyles).toMatch(/:host\s*\{[^}]*height:\s*0\.625rem/);
    // Not --destructive, which is too dark on the video scrim the dot also sits on.
    expect(liveDotStyles).toMatch(/\.dot,\s*\.ring\s*\{[^}]*background:\s*var\(--neat-live\)/);
    expect(liveDotStyles).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(/i);
  });

  it('lets the ring overflow the dot without taking part in the layout', () => {
    expect(liveDotStyles).toMatch(/\.dot,\s*\.ring\s*\{[^}]*position:\s*absolute/);
    expect(liveDotStyles).toMatch(/\.dot,\s*\.ring\s*\{[^}]*inset:\s*0/);
    expect(liveDotStyles).not.toMatch(/overflow:\s*hidden/);
  });

  it('beats once in 1.6 s: the dot from 1 to 0.7 to 1, the ring from scale 1 to 2.6 as it fades', () => {
    expect(liveDotStyles).toMatch(
      /@keyframes\s+live-dot-beat\s*\{\s*0%,\s*100%\s*\{\s*opacity:\s*1;?\s*\}\s*50%\s*\{\s*opacity:\s*0\.7;?\s*\}\s*\}/,
    );
    expect(liveDotStyles).toMatch(
      /@keyframes\s+live-dot-ring\s*\{\s*0%\s*\{\s*transform:\s*scale\(1\);\s*opacity:\s*0\.45;?\s*\}\s*100%\s*\{\s*transform:\s*scale\(2\.6\);\s*opacity:\s*0;?\s*\}\s*\}/,
    );
    expect(liveDotStyles).toMatch(
      /animation:\s*live-dot-ring\s+1\.6s\s+cubic-bezier\(0?\.2,\s*0?\.6,\s*0?\.3,\s*1\)\s+infinite/,
    );
    expect(liveDotStyles).toMatch(/animation:\s*live-dot-beat\s+1\.6s\s+ease-in-out\s+infinite/);
  });

  it('animates only when the user has not asked for reduced motion, and then shows no ring', () => {
    const { inside, outside } = splitMotion(liveDotStyles);

    expect(inside).toContain('animation:');
    expect(inside).toContain('.ring');
    // Outside the media block there is no animation, and the ring is not shown.
    expect(outside).not.toMatch(/animation\s*:/);
    expect(outside).toMatch(/\.ring\s*\{[^}]*display:\s*none/);
    expect(inside).toMatch(/\.ring\s*\{[^}]*display:\s*block/);
  });
});
