import helmBlockquote from '../ui/typography/src/lib/hlm-blockquote.ts?source' with {
  loader: 'text',
};
import helmH1 from '../ui/typography/src/lib/hlm-h1.ts?source' with { loader: 'text' };
import helmH2 from '../ui/typography/src/lib/hlm-h2.ts?source' with { loader: 'text' };
import helmH3 from '../ui/typography/src/lib/hlm-h3.ts?source' with { loader: 'text' };
import helmH4 from '../ui/typography/src/lib/hlm-h4.ts?source' with { loader: 'text' };
import helmLarge from '../ui/typography/src/lib/hlm-large.ts?source' with { loader: 'text' };
import helmLead from '../ui/typography/src/lib/hlm-lead.ts?source' with { loader: 'text' };
import helmMuted from '../ui/typography/src/lib/hlm-muted.ts?source' with { loader: 'text' };
import helmP from '../ui/typography/src/lib/hlm-p.ts?source' with { loader: 'text' };
import helmSmall from '../ui/typography/src/lib/hlm-small.ts?source' with { loader: 'text' };
import helmUl from '../ui/typography/src/lib/hlm-ul.ts?source' with { loader: 'text' };
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  NEAT_TYPOGRAPHY,
  NeatBlockquote,
  NeatH1,
  NeatH2,
  NeatH3,
  NeatH4,
  NeatLarge,
  NeatLead,
  NeatMuted,
  NeatP,
  NeatSmall,
  NeatUl,
} from './typography';

/**
 * Helm's heading classes the kit leaves out: a scroll margin, since `neat-page` owns where a
 * fragment link stops.
 */
const DEPARTURES = ['scroll-m-20'];

/** The class string a vendored helm typography file states, read from its text. */
function helmClasses(source: string): string[] {
  const match = /export const hlm\w+\s*=\s*'([^']*)'/.exec(source);
  if (!match) throw new Error('no class constant in the helm file');
  return match[1].split(/\s+/);
}

@Component({
  imports: [NEAT_TYPOGRAPHY],
  template: `
    <h1 neatH1>Title</h1>
    <h2 neatH2>Section</h2>
    <h3 neatH3>Part</h3>
    <h4 neatH4>Step</h4>
    <p neatLead>What the page is for.</p>
    <p neatP>A paragraph.</p>
    <div neatLarge>Large</div>
    <small neatSmall>Small</small>
    <p neatMuted>A note.</p>
    <blockquote neatBlockquote>A quote.</blockquote>
    <ul neatUl class="app-class">
      <li>An item</li>
    </ul>
  `,
})
class TypographyHost {}

async function render() {
  const fixture = TestBed.createComponent(TypographyHost);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  return (selector: string) => [...root.querySelector(selector)!.classList];
}

describe('typography', () => {
  it('gives each element Spartan’s typography: the classes helm states for it', async () => {
    const classesOf = await render();
    const cases: [string, string][] = [
      ['h1', helmH1],
      ['h2', helmH2],
      ['h3', helmH3],
      ['h4', helmH4],
      ['[neatLead]', helmLead],
      ['[neatP]', helmP],
      ['[neatLarge]', helmLarge],
      ['small', helmSmall],
      ['[neatMuted]', helmMuted],
      ['blockquote', helmBlockquote],
      ['ul', helmUl],
    ];
    for (const [selector, helm] of cases) {
      // The order of a host's classes is Angular's; the set is what counts.
      expect(
        classesOf(selector)
          .filter((name) => name !== 'app-class')
          .sort(),
        selector,
      ).toEqual(
        helmClasses(helm)
          .filter((name) => !DEPARTURES.includes(name))
          .sort(),
      );
    }
  });

  it('gives no heading a scroll margin, so a link to it stops where the page puts every fragment', async () => {
    const classesOf = await render();
    // Helm's headings still have one; the kit departs from it.
    for (const helm of [helmH1, helmH2, helmH3, helmH4]) {
      expect(helmClasses(helm)).toContain('scroll-m-20');
    }
    for (const selector of ['h1', 'h2', 'h3', 'h4']) {
      expect(
        classesOf(selector).some((name) => name.startsWith('scroll-m')),
        selector,
      ).toBe(false);
    }
  });

  it('keeps a class the app puts on the element', async () => {
    const classesOf = await render();
    expect(classesOf('ul')).toContain('app-class');
  });

  it('collects every directive in NEAT_TYPOGRAPHY', () => {
    expect(NEAT_TYPOGRAPHY).toEqual([
      NeatH1,
      NeatH2,
      NeatH3,
      NeatH4,
      NeatP,
      NeatLead,
      NeatLarge,
      NeatSmall,
      NeatMuted,
      NeatBlockquote,
      NeatUl,
    ]);
  });
});
