import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { contrastRatio, NeatButton, type NeatColorScheme } from '@sima/neat-ui';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatNumberField } from '@sima/neat-ui/number-field';
import { NeatSelect } from '@sima/neat-ui/select';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { splitVariants, stateColor } from '../../../src/lib/theme/state-colors';
import { NeatErrorNote } from './error-note';
import { NeatField } from './field';

@Component({
  imports: [NeatField, NeatInput],
  template: `
    <neat-field class="host-class" label="Stream URL" [hint]="hint()" [error]="error()">
      <input neatInput size="small" type="url" />
    </neat-field>
  `,
})
class FieldHost {
  readonly hint = signal('');
  readonly error = signal('');
}

/** A field whose control the app swaps, as an `@if` in its content does. */
@Component({
  imports: [NeatField, NeatInput],
  template: `
    <neat-field label="Address" hint="Host and port." [error]="error()">
      @if (url()) {
        <input neatInput class="url" type="url" />
      } @else {
        <input neatInput class="host" type="text" />
      }
    </neat-field>
  `,
})
class SwappingHost {
  readonly url = signal(false);
  readonly error = signal('Not reachable.');
}

@Component({
  imports: [NeatErrorNote],
  template: `<neat-error-note>{{ message }}</neat-error-note>`,
})
class ErrorNoteHost {
  readonly message = 'Could not validate the URL.\nyt-dlp: HTTP Error 403';
}

/** A row of fields as the import dialog's YouTube row has it, in one size. */
@Component({
  imports: [NeatButton, NeatField, NeatInput, NeatNumberField, NeatSelect],
  template: `
    <neat-field label="Start Time"><input neatInput [size]="size()" /></neat-field>
    <neat-select label="Clip Length" showLabel [size]="size()" [options]="[]" />
    <neat-number-field label="Page" [value]="1" />
    <button neatButton type="button" variant="outlined" [size]="size()">Validate</button>
  `,
})
class RowHost {
  readonly size = signal<'small' | 'medium'>('small');
}

/** jsdom has no ResizeObserver, which brain's select sizes its list with. */
class NoopResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => vi.stubGlobal('ResizeObserver', NoopResizeObserver));
afterEach(() => vi.unstubAllGlobals());

async function renderField(setup: (host: FieldHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(FieldHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  return {
    fixture,
    host: fixture.componentInstance,
    field: root.querySelector<HTMLElement>('neat-field')!,
    label: root.querySelector<HTMLLabelElement>('label')!,
    input: root.querySelector<HTMLInputElement>('input')!,
  };
}

const classesOf = (element: Element) => [...element.classList];

/**
 * The height utility in force on a control: a plain `h-*` or `size-*`, or a `data-[size=…]:h-*`
 * that matches the element's `data-size`. Two in force at once fail, as the cascade would decide.
 */
function controlHeight(element: Element): string {
  const size = element.getAttribute('data-size');
  const heights = classesOf(element).flatMap((name) => {
    const { variants, utility } = splitVariants(name);
    const height = /^(?:h|size)-(\d+)$/.exec(utility)?.[1];
    if (height === undefined) return [];
    const holds =
      variants.length === 0 || (variants.length === 1 && variants[0] === `data-[size=${size}]`);
    return holds ? [height] : [];
  });
  expect(heights, `${element.tagName}: [${classesOf(element).join(' ')}]`).toHaveLength(1);
  return heights[0];
}

describe('NeatField', () => {
  it('shows its name over the control, inside a label that names the control', async () => {
    const { label, input } = await renderField();

    expect(label.querySelector('span')?.textContent?.trim()).toBe('Stream URL');
    expect(label.contains(input)).toBe(true);
    expect(label.control).toBe(input);
  });

  it('shows no hint and no error until given one, and leaves the control undescribed', async () => {
    const { field, input } = await renderField();

    expect(field.querySelector('[neatNote]')).toBeNull();
    expect(field.querySelector('neat-error-note')).toBeNull();
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('shows a hint under the control as a note, outside the label, describing the control', async () => {
    const { field, label, input } = await renderField((host) =>
      host.hint.set('RTSP and RTSPS only.'),
    );

    const hint = field.querySelector<HTMLElement>('[neatNote]')!;
    expect(hint.textContent?.trim()).toBe('RTSP and RTSPS only.');
    expect(label.contains(hint)).toBe(false);
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('shows an error under the hint, marks the control invalid and describes it by both', async () => {
    const { fixture, host, field, input } = await renderField((host) => {
      host.hint.set('RTSP and RTSPS only.');
      host.error.set('Enter an rtsp:// or rtsps:// URL.');
    });

    const hint = field.querySelector<HTMLElement>('[neatNote]')!;
    const error = field.querySelector<HTMLElement>('neat-error-note')!;
    expect(error.textContent?.trim()).toBe('Enter an rtsp:// or rtsps:// URL.');
    expect(hint.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toBe(`${hint.id} ${error.id}`);
    expect(input.getAttribute('aria-invalid')).toBe('true');

    host.error.set('');
    await fixture.whenStable();
    expect(field.querySelector('neat-error-note')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('describes a control that replaces the one it had, and the new one only', async () => {
    const fixture = TestBed.createComponent(SwappingHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const described = (input: Element) => [
      input.getAttribute('aria-describedby')?.split(' ').length ?? 0,
      input.getAttribute('aria-invalid'),
    ];
    expect(described(root.querySelector('input.host')!)).toEqual([2, 'true']);

    fixture.componentInstance.url.set(true);
    await fixture.whenStable();

    const url = root.querySelector('input.url')!;
    expect(root.querySelector('label')!.control).toBe(url);
    expect(described(url)).toEqual([2, 'true']);
  });

  it('gives each field its own ids', async () => {
    const first = await renderField((host) => host.hint.set('One.'));
    const second = await renderField((host) => host.hint.set('Two.'));

    expect(first.input.getAttribute('aria-describedby')).not.toBe(
      second.input.getAttribute('aria-describedby'),
    );
  });

  it('keeps classes the app sets alongside its own', async () => {
    const { field } = await renderField();

    expect(classesOf(field)).toEqual(expect.arrayContaining(['host-class', 'flex']));
  });

  describe('in a row with a select, a number field and a button', () => {
    async function renderRow(size: 'small' | 'medium') {
      const fixture = TestBed.createComponent(RowHost);
      fixture.componentInstance.size.set(size);
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      return {
        fieldLabel: root.querySelector('neat-field label')!,
        selectHost: root.querySelector('neat-select')!,
        selectLabel: root.querySelector('neat-select label')!,
        controls: {
          input: root.querySelector('neat-field input')!,
          select: root.querySelector('neat-select [data-slot="select-trigger"]')!,
          numberField: root.querySelector('neat-number-field input')!,
          button: root.querySelector('button[neatButton]')!,
        },
      };
    }

    it('names its control as a shown select does: the same text and the same gap above it', async () => {
      const { fieldLabel, selectHost, selectLabel } = await renderRow('small');

      expect(classesOf(fieldLabel.querySelector('span')!)).toEqual(classesOf(selectLabel));
      const stack = (element: Element) =>
        classesOf(element).filter((name) => /^(flex|flex-col|gap-.*)$/.test(name));
      expect(stack(fieldLabel)).toEqual(stack(selectHost));
    });

    it('small: the input, the select, the number field and the button are one height', async () => {
      const { controls } = await renderRow('small');

      expect(Object.values(controls).map(controlHeight)).toEqual(['8', '8', '8', '8']);
    });

    it('medium: the input, the select and the button are one height', async () => {
      const { controls } = await renderRow('medium');

      expect([controls.input, controls.select, controls.button].map(controlHeight)).toEqual([
        '9',
        '9',
        '9',
      ]);
    });
  });
});

describe('NeatErrorNote', () => {
  async function renderNote() {
    const fixture = TestBed.createComponent(ErrorNoteHost);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('neat-error-note')!;
  }

  it('is an alert, so the failure is read out as it appears', async () => {
    const note = await renderNote();

    expect(note.getAttribute('role')).toBe('alert');
  });

  it('is a block of small danger text that keeps the message’s line breaks and wraps long words', async () => {
    const note = await renderNote();

    expect(note.textContent).toContain('URL.\nyt-dlp');
    expect(classesOf(note)).toEqual(
      expect.arrayContaining([
        'block',
        'text-destructive',
        'text-(length:--neat-text-sm)',
        'whitespace-pre-line',
        'wrap-anywhere',
      ]),
    );
  });

  describe('contrast, from the emitted theme tokens', () => {
    const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
    const SURFACES = ['background', 'card'] as const;

    for (const scheme of SCHEMES) {
      it(`${scheme}: the text reaches 4.5:1 on the surfaces`, async () => {
        const note = await renderNote();
        const tokens = spartanThemeTokens(scheme);
        const query = {
          tokens,
          vocabulary: { dark: 'dark' },
          on: scheme === 'dark' ? ['dark'] : [],
        };
        for (const surface of SURFACES) {
          const under = tokens[surface];
          const text = stateColor(classesOf(note), 'text', query, under, tokens['foreground']);
          expect(contrastRatio(text, under), `${text} on --${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  });
});
