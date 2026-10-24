import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { NeatDetails } from './details';

@Component({
  imports: [NeatDetails],
  template: `
    <dl neatDetails class="host-class">
      <dt>Stream</dt>
      <dd>Playing</dd>
      @if (pulled()) {
        <dt>Source</dt>
        <dd><code>rtsp://camera.local:554/stream1</code></dd>
      }
      <dt>Sync buffer</dt>
      <dd>600 ms</dd>
    </dl>
  `,
})
class DetailsHost {
  readonly pulled = signal(true);
}

async function render() {
  const fixture = TestBed.createComponent(DetailsHost);
  await fixture.whenStable();
  const list = (fixture.nativeElement as HTMLElement).querySelector('dl')!;
  return { fixture, host: fixture.componentInstance, list };
}

const classesOf = (element: HTMLElement) => [...element.classList];

describe('NeatDetails', () => {
  it('lays the terms and their values out in two columns, the values taking the rest', async () => {
    const { list } = await render();

    expect(classesOf(list)).toEqual(
      expect.arrayContaining([
        'm-0',
        'grid',
        'grid-cols-[var(--neat-details-term-width,auto)_1fr]',
        'gap-x-(--neat-space-3)',
        'gap-y-(--neat-space-2)',
        'text-(length:--neat-text-sm)',
      ]),
    );
  });

  it('mutes the terms, and lets a long value wrap anywhere in its column with figures aligned', async () => {
    const { list } = await render();

    expect(classesOf(list)).toEqual(
      expect.arrayContaining([
        '[&>dt]:text-muted-foreground',
        '[&>dd]:m-0',
        '[&>dd]:min-w-0',
        '[&>dd]:wrap-anywhere',
        '[&>dd]:tabular-nums',
      ]),
    );
  });

  it('wraps a term too long for its track, rather than letting it run into the value column', async () => {
    const { list } = await render();

    // `break-word`, not `anywhere`: the auto track keeps sizing to the terms' real widths.
    expect(classesOf(list)).toEqual(expect.arrayContaining(['[&>dt]:wrap-break-word']));
    expect(classesOf(list)).not.toContain('[&>dt]:wrap-anywhere');
  });

  it('keeps the list a native description list whose pairs the app writes, conditionally too', async () => {
    const { fixture, host, list } = await render();

    expect([...list.children].map((child) => child.tagName)).toEqual([
      'DT',
      'DD',
      'DT',
      'DD',
      'DT',
      'DD',
    ]);
    host.pulled.set(false);
    await fixture.whenStable();
    expect([...list.querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
      'Stream',
      'Sync buffer',
    ]);
    expect(list.getAttribute('role')).toBeNull();
  });

  it('keeps classes the app sets alongside its own', async () => {
    const { list } = await render();

    expect(classesOf(list)).toEqual(expect.arrayContaining(['host-class', 'grid']));
  });

  describe('contrast, from the emitted theme tokens', () => {
    const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
    const SURFACES = ['background', 'card'] as const;
    // What a child variant means: the term's colour is measured on a dt, the value's on a dd.
    const VOCABULARY = { dark: 'dark', '[&>dt]': 'dt', '[&>dd]': 'dd' };

    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const on = (part: string) => (scheme === 'dark' ? ['dark', part] : [part]);

      it(`${scheme}: terms and values reach 4.5:1 on the surfaces`, async () => {
        const { list } = await render();
        for (const part of ['dt', 'dd']) {
          for (const surface of SURFACES) {
            const under = tokens[surface];
            const query = { tokens, vocabulary: VOCABULARY, on: on(part) };
            const text = stateColor(classesOf(list), 'text', query, under, tokens['foreground']);
            expect(
              contrastRatio(text, under),
              `${part}: ${text} on --${surface}`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      });
    }
  });
});
