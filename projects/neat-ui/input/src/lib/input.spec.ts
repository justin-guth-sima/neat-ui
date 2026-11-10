import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, type NeatColorScheme } from '@sima/neat-ui';
import helmInput from '../../../src/lib/ui/input/src/lib/hlm-input.ts?source' with {
  loader: 'text',
};
import { MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor } from '../../../src/lib/theme/state-colors';
import { INPUT_HELM_CLASSES, NeatInput, type NeatInputSize } from './input';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
const SURFACES = ['background', 'card'] as const;

/** The variants on the input's color classes; validation and file-button styles never apply. */
const VOCABULARY = {
  dark: 'dark',
  'focus-visible': 'focus',
  'data-[matches-spartan-invalid=true]': false,
};

@Component({
  imports: [NeatInput],
  template: `
    <label for="page-input">Page</label>
    <input
      neatInput
      id="page-input"
      class="host-class"
      type="number"
      inputmode="numeric"
      min="1"
      placeholder="1"
      [size]="size()"
      [disabled]="disabled()"
      (keydown.enter)="submitted.push(input.value)"
      #input
    />
    <input neatInput aria-label="Jump to channel" />
  `,
})
class InputHost {
  readonly size = signal<NeatInputSize>('medium');
  readonly disabled = signal(false);
  readonly submitted: string[] = [];
}

async function render(setup: (host: InputHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(InputHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const [input, unlabeled] = Array.from(root.querySelectorAll('input'));
  const label = root.querySelector('label')!;
  return { fixture, host: fixture.componentInstance, input, unlabeled, label };
}

describe('NeatInput', () => {
  it('keeps the native attributes: type, inputmode, min, placeholder and the id a label points at', async () => {
    const { input, label } = await render();

    expect(input.type).toBe('number');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.min).toBe('1');
    expect(input.placeholder).toBe('1');
    expect(input.id).toBe('page-input');
    expect(label.control).toBe(input);
  });

  it('takes its accessible name from its label or aria-label', async () => {
    const { input, unlabeled } = await render();

    expect(input.labels?.[0]?.textContent).toBe('Page');
    expect(unlabeled.getAttribute('aria-label')).toBe('Jump to channel');
    expect(unlabeled.type).toBe('text');
  });

  it('keyboard: takes focus and leaves keys to the page, so Enter reaches the app', async () => {
    const { input, host } = await render();

    input.focus();
    expect(document.activeElement).toBe(input);
    input.value = '7';
    input.dispatchEvent(new Event('input'));
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);

    expect(host.submitted).toEqual(['7']);
    expect(enter.defaultPrevented).toBe(false);
  });

  it.each<[NeatInputSize, string, string]>([
    ['medium', 'h-9', 'h-8'],
    ['small', 'h-8', 'h-9'],
  ])('size %s gives %s', async (size, height, other) => {
    const { input } = await render((host) => host.size.set(size));

    expect(input.classList).toContain(height);
    expect(input.classList).not.toContain(other);
  });

  it('draws the input with helm’s classes and keeps the host’s own', async () => {
    const { input } = await render();

    expect([...input.classList]).toEqual(
      expect.arrayContaining(['host-class', 'border-input', 'rounded-md', 'w-full']),
    );
  });

  it('disabled reaches the native input', async () => {
    const { fixture, host, input } = await render((host) => host.disabled.set(true));

    expect(input.disabled).toBe(true);
    expect(input.classList).toContain('disabled:opacity-50');

    host.disabled.set(false);
    await fixture.whenStable();
    expect(input.disabled).toBe(false);
  });

  it('helm drift: the copied class string still appears in the vendored helm input', () => {
    expect(helmInput).toContain(INPUT_HELM_CLASSES);
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const on = (...states: string[]) => (scheme === 'dark' ? ['dark', ...states] : states);
      const q = (on: string[], box?: string) => ({ tokens, vocabulary: VOCABULARY, on, box });
      const text = (surface: (typeof SURFACES)[number]) =>
        tokens[surface === 'card' ? 'card-foreground' : 'foreground'];

      async function inputClasses(): Promise<string[]> {
        const { input } = await render();
        return [...input.classList];
      }

      it(`${scheme}: the border reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card, at rest and focused`, async () => {
        const classes = await inputClasses();
        for (const state of [on(), on('focus')]) {
          for (const surface of SURFACES) {
            const under = tokens[surface];
            const border = stateColor(classes, 'border', q(state), under);
            expect(
              contrastRatio(border, under),
              `${scheme}, [${state.join(', ')}] border on --${surface}: ${border}`,
            ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          }
        }
      });

      it(`${scheme}: typed text and the placeholder reach 4.5:1 on the field`, async () => {
        const classes = await inputClasses();
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const fill = stateColor(classes, 'bg', q(on()), under);
          const typed = stateColor(classes, 'text', q(on()), fill, text(surface));
          const placeholder = stateColor(classes, 'text', q(on(), 'placeholder'), fill);
          expect(
            contrastRatio(typed, fill),
            `${scheme}, text on --${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
          expect(
            contrastRatio(placeholder, fill),
            `${scheme}, placeholder on --${surface}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      });

      it(`${scheme}: the focus ring reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card`, async () => {
        const classes = await inputClasses();
        expect(classes).toContain('focus-visible:ring-3');
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const ring = stateColor(classes, 'ring', q(on('focus')), under);
          expect(
            contrastRatio(ring, under),
            `${scheme}, ring on --${surface}: ${ring}`,
          ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        }
      });
    }
  });
});
