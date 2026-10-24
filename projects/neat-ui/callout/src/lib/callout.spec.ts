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
    <neat-callout [tone]="tone()" [heading]="heading()" [announce]="announce()">
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
  readonly withAction = signal(true);
}

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

      it(`${scheme}: callout heading and body text hold 4.5:1 on every tone tint in both schemes`, async () => {
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
