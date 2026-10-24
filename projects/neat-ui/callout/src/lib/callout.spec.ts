import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { contrastRatio, NeatIcon, type NeatColorScheme, type NeatTone } from '@sima/neat-ui';
import { MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatCallout } from './callout';

const TONES: NeatTone[] = ['neutral', 'success', 'warning', 'danger', 'info', 'highlight'];

@Component({
  imports: [NeatCallout],
  template: `
    <neat-callout
      [tone]="tone()"
      [heading]="heading()"
      [headingLevel]="level()"
      [region]="region()"
      [announce]="announce()"
    >
      The board at 192.168.1.20 replaced the previous one.
      @if (withAction()) {
        <button type="button" neatCalloutActions>Refresh</button>
      }
    </neat-callout>
  `,
})
class CalloutHost {
  readonly tone = signal<NeatTone>('warning');
  readonly heading = signal('Board changed');
  readonly announce = signal<'status' | 'alert' | null>(null);
  readonly region = signal(false);
  readonly level = signal<2 | 3 | 4 | 5 | 6>(3);
  readonly withAction = signal(true);
}

/** A heading and an action, no body: the Viewer's late notice has a body, a banner may not. */
@Component({
  imports: [NeatCallout],
  template: `
    <neat-callout heading="Scan failed">
      <button type="button" neatCalloutActions>Open board settings</button>
    </neat-callout>
  `,
})
class NoBodyHost {}

async function render(setup: (host: CalloutHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(CalloutHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const element: HTMLElement = fixture.nativeElement;
  const callout = element.querySelector<HTMLElement>('neat-callout')!;
  const slot = (name: string) =>
    callout.querySelector<HTMLElement>(`[data-slot="callout-${name}"]`);
  const icon = () => fixture.debugElement.query(By.directive(NeatIcon));
  return { fixture, host: fixture.componentInstance, callout, slot, icon };
}

describe('NeatCallout', () => {
  it('neat-callout shows its heading, body and actions on its tone tint, with the tone icon', async () => {
    const { callout, slot, icon } = await render();

    expect(slot('heading')!.textContent!.trim()).toBe('Board changed');
    expect(slot('body')!.textContent!.trim()).toBe(
      'The board at 192.168.1.20 replaced the previous one.',
    );
    const actions = slot('actions')!;
    expect(actions.querySelector('button')!.textContent).toBe('Refresh');
    expect(slot('body')!.querySelector('button')).toBeNull();
    expect([...callout.classList]).toEqual(
      expect.arrayContaining(['bg-neat-tint-warning', 'border-s-4', 'border-warning']),
    );
    expect(icon().componentInstance.name()).toBe('warning');
  });

  it('picks the icon by tone: error for danger, warning, check for success, info otherwise', async () => {
    const { fixture, host, icon } = await render();
    const expected: Record<NeatTone, string> = {
      neutral: 'info',
      success: 'check',
      warning: 'warning',
      danger: 'error',
      info: 'info',
      highlight: 'info',
    };
    for (const tone of TONES) {
      host.tone.set(tone);
      await fixture.whenStable();
      expect(icon().componentInstance.name(), tone).toBe(expected[tone]);
    }
  });

  it('fills neutral with --muted and gives every other tone its tint and solid start border', async () => {
    const { fixture, host, callout } = await render();
    const fills: Record<NeatTone, [string, string]> = {
      neutral: ['bg-muted', 'border-muted-foreground'],
      success: ['bg-neat-tint-success', 'border-success'],
      warning: ['bg-neat-tint-warning', 'border-warning'],
      danger: ['bg-neat-tint-danger', 'border-destructive'],
      info: ['bg-neat-tint-info', 'border-info'],
      highlight: ['bg-neat-tint-highlight', 'border-highlight'],
    };
    for (const tone of TONES) {
      host.tone.set(tone);
      await fixture.whenStable();
      expect([...callout.classList], tone).toEqual(expect.arrayContaining(fills[tone]));
    }
  });

  it('has no heading without one, and its empty actions row takes no room', async () => {
    const { slot } = await render((host) => {
      host.heading.set('');
      host.withAction.set(false);
    });

    expect(slot('heading')).toBeNull();
    // A flex row with nothing in it would still add the column's gap.
    expect(slot('actions')!.children).toHaveLength(0);
    expect(slot('actions')!.classList).toContain('empty:hidden');
  });

  it('makes its heading a real heading, at level 3 unless the app picks another', async () => {
    const { fixture, host, slot } = await render();

    // The title of a banner or a notice is found by heading navigation, as an h3 would be.
    expect(slot('heading')!.getAttribute('role')).toBe('heading');
    expect(slot('heading')!.getAttribute('aria-level')).toBe('3');

    host.level.set(4);
    await fixture.whenStable();
    expect(slot('heading')!.getAttribute('aria-level')).toBe('4');
  });

  it('as a region, is a landmark named by its heading, as the Viewer’s late notice is', async () => {
    const { callout, slot } = await render((host) => host.region.set(true));

    expect(callout.getAttribute('role')).toBe('region');
    const heading = slot('heading')!;
    expect(heading.id).not.toBe('');
    expect(callout.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('is no region without a heading: an unnamed region is no landmark, so it takes no role', async () => {
    const { fixture, host, callout } = await render((host) => host.region.set(true));
    expect(callout.getAttribute('role')).toBe('region');

    host.heading.set('');
    await fixture.whenStable();
    expect(callout.hasAttribute('role')).toBe(false);
    expect(callout.hasAttribute('aria-labelledby')).toBe(false);

    host.heading.set('Board changed');
    await fixture.whenStable();
    expect(callout.getAttribute('role')).toBe('region');
  });

  it('labels a live callout by its heading too, and leaves a callout with no role unlabelled', async () => {
    const { fixture, host, callout, slot } = await render();
    expect(callout.hasAttribute('aria-labelledby')).toBe(false);

    host.announce.set('alert');
    await fixture.whenStable();
    expect(callout.getAttribute('aria-labelledby')).toBe(slot('heading')!.id);

    // A live role wins over region: one host has one role.
    host.region.set(true);
    await fixture.whenStable();
    expect(callout.getAttribute('role')).toBe('alert');

    host.heading.set('');
    await fixture.whenStable();
    expect(callout.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('gives each callout’s heading an id of its own', async () => {
    const first = await render();
    const second = await render();

    expect(first.slot('heading')!.id).not.toBe(second.slot('heading')!.id);
  });

  it('takes no room for a body it does not have', async () => {
    const fixture = TestBed.createComponent(NoBodyHost);
    await fixture.whenStable();
    const body = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-slot="callout-body"]',
    )!;

    // An empty block in the column would still add its gap between the heading and the actions.
    expect(body.children).toHaveLength(0);
    expect(body.textContent!.trim()).toBe('');
    expect(body.classList).toContain('empty:hidden');
  });

  it('keeps the warning icon in the text colour in both schemes, the border carrying the tone', async () => {
    const { icon } = await render();

    // One statement, no dark variant: warning's solid colour fails 3:1 on its light tint (F30).
    expect([...icon().nativeElement.classList]).toContain('text-foreground');
    expect([...icon().nativeElement.classList].filter((name) => name.includes('warning'))).toEqual(
      [],
    );
  });

  it('neat-callout takes the role it announces with, and none by default', async () => {
    const { fixture, host, callout } = await render();
    expect(callout.hasAttribute('role')).toBe(false);

    host.announce.set('status');
    await fixture.whenStable();
    expect(callout.getAttribute('role')).toBe('status');

    host.announce.set('alert');
    await fixture.whenStable();
    expect(callout.getAttribute('role')).toBe('alert');
  });

  describe('contrast, from the emitted theme tokens', () => {
    const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const q = { tokens, vocabulary: {}, on: [] };

      it(`${scheme}: callout heading and body text hold 4.5:1 on every tone tint`, async () => {
        const { fixture, host, callout, slot } = await render();
        for (const tone of TONES) {
          host.tone.set(tone);
          await fixture.whenStable();
          const fill = stateColor([...callout.classList], 'bg', q, tokens['background']);
          expect(fill, `${tone} is filled`).not.toBe(tokens['background']);
          const inherited = stateColor(
            [...callout.classList],
            'text',
            q,
            fill,
            tokens['foreground'],
          );
          for (const part of [slot('heading')!, slot('body')!]) {
            const text = stateColor([...part.classList], 'text', q, fill, inherited);
            expect(contrastRatio(text, fill), `${tone}: ${text} on ${fill}`).toBeGreaterThanOrEqual(
              4.5,
            );
          }
        }
      });

      it(`${scheme}: the tone icon holds ${MIN_NON_TEXT_CONTRAST}:1 on its tint`, async () => {
        const { fixture, host, callout, icon } = await render();
        for (const tone of TONES) {
          host.tone.set(tone);
          await fixture.whenStable();
          const fill = stateColor([...callout.classList], 'bg', q, tokens['background']);
          const inherited = stateColor(
            [...callout.classList],
            'text',
            q,
            fill,
            tokens['foreground'],
          );
          const color = stateColor([...icon().nativeElement.classList], 'text', q, fill, inherited);
          expect(contrastRatio(color, fill), `${tone}: ${color} on ${fill}`).toBeGreaterThanOrEqual(
            MIN_NON_TEXT_CONTRAST,
          );
        }
      });
    }
  });
});
