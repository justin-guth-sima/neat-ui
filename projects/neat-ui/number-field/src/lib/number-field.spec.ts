import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ɵINPUT_CLASSES as INPUT_CLASSES } from '@sima/neat-ui';
import { NeatNumberField } from './number-field';

@Component({
  imports: [NeatNumberField],
  template: `
    <neat-number-field
      label="Page"
      [value]="value()"
      [accept]="accept()"
      (commit)="commits.push($event)"
    >
      <span neatNumberFieldSuffix>of 9</span>
    </neat-number-field>
  `,
})
class FieldHost {
  readonly value = signal(3);
  readonly accept = signal<(n: number) => boolean>(() => true);
  readonly commits: number[] = [];
}

@Component({
  imports: [NeatNumberField],
  template: `<neat-number-field label="Draw on channel" [value]="2" />`,
})
class PlainHost {}

@Component({
  imports: [NeatNumberField],
  template: `
    <neat-number-field
      label="Frames per second"
      [value]="value()"
      [step]="step()"
      [min]="min()"
      [max]="max()"
      [unit]="unit()"
      [showLabel]="showLabel()"
      [disabled]="disabled()"
      [accept]="accept()"
      (commit)="commits.push($event)"
    />
  `,
})
class StepsHost {
  readonly value = signal<number | null>(16);
  readonly step = signal<number | null>(5);
  readonly min = signal<number | null>(1);
  readonly max = signal<number | null>(null);
  readonly unit = signal('');
  readonly showLabel = signal(true);
  readonly disabled = signal(false);
  readonly accept = signal<(n: number) => boolean>(() => true);
  readonly commits: number[] = [];
}

async function render(setup: (host: FieldHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(FieldHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const input = root.querySelector('input') as HTMLInputElement;
  return { fixture, host: fixture.componentInstance, root, input };
}

async function renderSteps(setup: (host: StepsHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(StepsHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  const input = root.querySelector('input') as HTMLInputElement;
  const box = input.parentElement as HTMLElement;
  const [decrease, increase] = Array.from(root.querySelectorAll('button'));
  return { fixture, host: fixture.componentInstance, root, input, box, decrease, increase };
}

/** The user types `text` into the field. */
function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const enter = (input: HTMLInputElement) =>
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
const blur = (input: HTMLInputElement) => input.dispatchEvent(new FocusEvent('blur'));
/** Presses `key` in the input; returns the event, to read whether its default was prevented. */
function press(input: HTMLInputElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  input.dispatchEvent(event);
  return event;
}

describe('NeatNumberField', () => {
  it('names its input by its label and shows the value', async () => {
    const { input } = await render();

    expect(input.getAttribute('aria-label')).toBe('Page');
    // Its label points at it, so a click on the label text focuses the field.
    expect(input.labels?.length).toBe(1);
    expect(input.value).toBe('3');
  });

  it('shows the label before the input and projects the suffix after it', async () => {
    const { root } = await render();

    const label = root.querySelector('label') as HTMLElement;
    const input = root.querySelector('input') as HTMLElement;
    const suffix = root.querySelector('[neatNumberFieldSuffix]') as HTMLElement;
    expect(label.textContent?.trim()).toBe('Page');
    expect(suffix.textContent).toBe('of 9');
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(label, input)).toBe(true);
    expect(follows(input, suffix)).toBe(true);
  });

  it('has no suffix slot content to show when none is given', async () => {
    const fixture = TestBed.createComponent(PlainHost);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent.trim()).toBe('Draw on channel');
  });

  it('is a small numeric kit input', async () => {
    const { input } = await render();

    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.dataset['slot']).toBe('input');
    expect(input.classList).toContain('h-8');
    // The kit's small text field, class for class, as `neatInput` draws it.
    expect([...input.classList].sort()).toEqual(INPUT_CLASSES.small.split(' ').sort());
  });

  it('commits an accepted whole number on Enter', async () => {
    const { input, host } = await render();

    type(input, '7');
    enter(input);

    expect(host.commits).toEqual([7]);
  });

  it('commits an accepted whole number on blur', async () => {
    const { input, host } = await render();

    type(input, ' 5 ');
    blur(input);

    expect(host.commits).toEqual([5]);
  });

  it('commits a number equal to the current value, so the owner can pin a choice it already shows', async () => {
    const { input, host } = await render();

    type(input, '3');
    enter(input);

    expect(host.commits).toEqual([3]);
  });

  it('commits once for Enter followed by the blur that comes with leaving the field', async () => {
    const { input, host } = await render();

    type(input, '4');
    enter(input);
    blur(input);

    expect(host.commits).toEqual([4]);
  });

  it('shows the number as the owner will read it', async () => {
    const { input } = await render();

    type(input, '007');
    enter(input);

    expect(input.value).toBe('7');
  });

  it.each(['4x', '', '   ', '-1', '1.5', '1e3', '99999999999999999999'])(
    'puts the value back for %j and commits nothing',
    async (text) => {
      const { input, host } = await render();

      type(input, text);
      enter(input);
      expect(input.value).toBe('3');

      type(input, text);
      blur(input);
      expect(input.value).toBe('3');

      expect(host.commits).toEqual([]);
    },
  );

  it('puts the value back for a number accept() refuses, and passes accept the number', async () => {
    const asked: number[] = [];
    const { input, host } = await render((h) =>
      h.accept.set((n) => {
        asked.push(n);
        return n >= 1 && n <= 9;
      }),
    );

    type(input, '12');
    enter(input);
    expect(input.value).toBe('3');
    type(input, '0');
    blur(input);
    expect(input.value).toBe('3');
    type(input, '9');
    enter(input);

    // Asked while typed too, to mark a refused number invalid; only ever with the typed number.
    expect([...new Set(asked)]).toEqual([12, 0, 9]);
    expect(host.commits).toEqual([9]);
  });

  it('does not commit on blur when nothing was typed, so tabbing through pins nothing', async () => {
    const { input, host } = await render();

    blur(input);

    expect(host.commits).toEqual([]);
  });

  it('commits the shown value on Enter without typing', async () => {
    const { input, host } = await render();

    enter(input);

    expect(host.commits).toEqual([3]);
  });

  it('follows the value, dropping what was typed but not committed', async () => {
    const { fixture, host, input } = await render();

    type(input, '8');
    host.value.set(5);
    await fixture.whenStable();
    expect(input.value).toBe('5');
    blur(input);

    expect(host.commits).toEqual([]);
  });

  it('NeatNumberField.focus() focuses and selects the input', async () => {
    const { fixture, input } = await render();
    const field = fixture.debugElement.query(By.directive(NeatNumberField))
      .componentInstance as NeatNumberField;

    field.focus();

    expect(document.activeElement).toBe(input);
    // All of it, so the number the user types replaces the one shown.
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
  });

  it('without step has no buttons and no spinbutton role, the input drawing its own box', async () => {
    const { root, input } = await render();

    expect(root.querySelectorAll('button').length).toBe(0);
    expect(input.getAttribute('role')).toBeNull();
    expect(input.getAttribute('aria-valuenow')).toBeNull();
    expect(input.hasAttribute('placeholder')).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect((input.parentElement as HTMLElement).hasAttribute('data-framed')).toBe(false);
  });

  it('NeatNumberField.reset() shows value again after the owner refused a commit', async () => {
    const { fixture, input, host } = await renderSteps((h) => h.value.set(30));
    const field = fixture.debugElement.query(By.directive(NeatNumberField))
      .componentInstance as NeatNumberField;

    // The owner refuses 500 and keeps 30: value does not change, so the field shows 500.
    type(input, '500');
    enter(input);
    await fixture.whenStable();
    expect(host.commits).toEqual([500]);
    expect(input.value).toBe('500');

    field.reset();
    await fixture.whenStable();

    expect(input.value).toBe('30');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('NeatNumberField.reset() drops a draft and its aria-invalid', async () => {
    const { fixture, input, host } = await renderSteps((h) => h.value.set(30));
    const field = fixture.debugElement.query(By.directive(NeatNumberField))
      .componentInstance as NeatNumberField;

    type(input, '0');
    await fixture.whenStable();
    expect(input.getAttribute('aria-invalid')).toBe('true');

    field.reset();
    await fixture.whenStable();
    blur(input);

    expect(input.value).toBe('30');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    // Nothing typed any more, so leaving the field commits nothing.
    expect(host.commits).toEqual([]);
  });

  describe('with steps', () => {
    it('puts − first and + last in the box, pointer-only and named after the label', async () => {
      const { box, input, decrease, increase } = await renderSteps();

      expect(box.hasAttribute('data-framed')).toBe(true);
      expect(box.firstElementChild).toBe(decrease);
      expect(box.lastElementChild).toBe(increase);
      expect(
        decrease.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      for (const button of [decrease, increase]) {
        expect(button.type).toBe('button');
        expect(button.getAttribute('tabindex')).toBe('-1');
        expect(button.querySelector('neat-icon')).not.toBeNull();
      }
      expect(decrease.getAttribute('aria-label')).toBe('Decrease Frames per second');
      expect(increase.getAttribute('aria-label')).toBe('Increase Frames per second');
    });

    it('labels the input alone: the label holds its text, the box with the steps sits beside it', async () => {
      const { root, input, decrease } = await renderSteps();

      const label = root.querySelector('label') as HTMLLabelElement;
      expect(label.children.length).toBe(0);
      expect(label.textContent?.trim()).toBe('Frames per second');
      expect(label.control).toBe(input);
      expect(input.labels?.length).toBe(1);
      expect(decrease.labels?.length ?? 0).toBe(0);
    });

    it('draws the field’s look on the box, and none on the input inside it', async () => {
      const { box, input } = await renderSteps();

      for (const name of ['border', 'border-input', 'rounded-md', 'h-8', 'focus-within:ring-3'])
        expect(box.classList, name).toContain(name);
      for (const name of ['border', 'rounded-md', 'h-8', 'shadow-xs'])
        expect(input.classList, name).not.toContain(name);
      expect(box.classList).toContain('box');
    });

    it('makes the input a spinbutton with its value, bounds and value text', async () => {
      const { input } = await renderSteps((h) => h.unit.set('fps'));

      expect(input.getAttribute('role')).toBe('spinbutton');
      expect(input.getAttribute('aria-valuenow')).toBe('16');
      expect(input.getAttribute('aria-valuemin')).toBe('1');
      expect(input.hasAttribute('aria-valuemax')).toBe(false);
      expect(input.getAttribute('aria-valuetext')).toBe('16 fps');
    });

    it('names the value bound by max', async () => {
      const { input } = await renderSteps((h) => h.max.set(30));

      expect(input.getAttribute('aria-valuemax')).toBe('30');
    });

    it('+ commits the value plus the step, and the field shows it', async () => {
      const { input, increase, host } = await renderSteps();

      increase.click();

      expect(host.commits).toEqual([21]);
      expect(input.value).toBe('21');
    });

    it('− is held to min: on 3 it commits 1', async () => {
      const { decrease, host } = await renderSteps((h) => h.value.set(3));

      decrease.click();

      expect(host.commits).toEqual([1]);
    });

    it('− at min is aria-disabled, not disabled, and commits nothing', async () => {
      const { decrease, increase, host } = await renderSteps((h) => h.value.set(1));

      expect(decrease.getAttribute('aria-disabled')).toBe('true');
      expect(decrease.disabled).toBe(false);
      expect(increase.getAttribute('aria-disabled')).toBeNull();
      decrease.click();

      expect(host.commits).toEqual([]);
    });

    it('+ is held to max: on 28 it commits 30, and on 30 it is disabled', async () => {
      const { fixture, increase, host } = await renderSteps((h) => {
        h.max.set(30);
        h.value.set(28);
      });

      increase.click();
      expect(host.commits).toEqual([30]);

      host.value.set(30);
      await fixture.whenStable();
      expect(increase.getAttribute('aria-disabled')).toBe('true');
      increase.click();
      expect(host.commits).toEqual([30]);
    });

    it('steps from a typed number, whose bound it follows: value 1, min 1, "40" typed, − commits 35', async () => {
      const { fixture, input, decrease, host } = await renderSteps((h) => h.value.set(1));
      expect(decrease.getAttribute('aria-disabled')).toBe('true');

      type(input, '40');
      await fixture.whenStable();
      expect(decrease.getAttribute('aria-disabled')).toBeNull();
      decrease.click();

      expect(host.commits).toEqual([35]);
    });

    it('ArrowDown steps from a typed number though value is at min', async () => {
      const { input, host } = await renderSteps((h) => h.value.set(1));

      type(input, '40');
      press(input, 'ArrowDown');

      expect(host.commits).toEqual([35]);
    });

    it('+ is off once the typed number is at max, though value is below it', async () => {
      const { fixture, input, increase, host } = await renderSteps((h) => h.max.set(30));
      expect(increase.getAttribute('aria-disabled')).toBeNull();

      type(input, '30');
      await fixture.whenStable();
      expect(increase.getAttribute('aria-disabled')).toBe('true');
      increase.click();
      press(input, 'ArrowUp');

      expect(host.commits).toEqual([]);
    });

    it('takes no step accept() refuses', async () => {
      const { increase, host } = await renderSteps((h) => h.accept.set((n) => n % 2 === 0));

      increase.click();

      expect(host.commits).toEqual([]);
    });

    it('keeps the focus where it is on a press of a button', async () => {
      const { increase } = await renderSteps();
      const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

      increase.dispatchEvent(down);

      expect(down.defaultPrevented).toBe(true);
    });

    it('ArrowUp and ArrowDown step and commit as the buttons do, without moving the caret', async () => {
      const { fixture, input, host } = await renderSteps();

      const up = press(input, 'ArrowUp');
      expect(up.defaultPrevented).toBe(true);
      expect(host.commits).toEqual([21]);

      host.value.set(21);
      await fixture.whenStable();
      const down = press(input, 'ArrowDown');
      expect(down.defaultPrevented).toBe(true);
      expect(host.commits).toEqual([21, 16]);
    });

    it('the arrow keys step from what was typed when it is whole digits, else from the value', async () => {
      const { input, host } = await renderSteps();

      type(input, '40');
      press(input, 'ArrowUp');
      expect(host.commits).toEqual([45]);

      type(input, 'abc');
      press(input, 'ArrowDown');
      expect(host.commits).toEqual([45, 11]);
    });

    it('the arrow keys do nothing at the bounds, as the buttons', async () => {
      const { fixture, input, host } = await renderSteps((h) => h.value.set(1));

      press(input, 'ArrowDown');
      expect(host.commits).toEqual([]);

      host.max.set(30);
      host.value.set(30);
      await fixture.whenStable();
      press(input, 'ArrowUp');
      expect(host.commits).toEqual([]);
    });

    it.each([
      ['0', 'below min'],
      ['abc', 'not a number'],
      ['7', 'refused by accept'],
    ])(
      'marks %j (%s) aria-invalid while typed; Enter puts the value back and clears it',
      async (text) => {
        const { fixture, input, host } = await renderSteps((h) => h.accept.set((n) => n !== 7));

        type(input, text);
        await fixture.whenStable();
        expect(input.getAttribute('aria-invalid')).toBe('true');

        enter(input);
        await fixture.whenStable();
        expect(input.value).toBe('16');
        expect(input.getAttribute('aria-invalid')).toBeNull();
        expect(host.commits).toEqual([]);
      },
    );

    it('leaving a field typed invalid puts the value back and clears aria-invalid', async () => {
      const { fixture, input, host } = await renderSteps();

      type(input, '0');
      await fixture.whenStable();
      blur(input);
      await fixture.whenStable();

      expect(input.value).toBe('16');
      expect(input.getAttribute('aria-invalid')).toBeNull();
      expect(host.commits).toEqual([]);
    });

    it('does not mark a number it will take, nor an emptied field', async () => {
      const { fixture, input } = await renderSteps();

      type(input, '25');
      await fixture.whenStable();
      expect(input.getAttribute('aria-invalid')).toBeNull();

      type(input, '');
      await fixture.whenStable();
      expect(input.getAttribute('aria-invalid')).toBeNull();
    });

    it('puts back a typed number above max', async () => {
      const { input, host } = await renderSteps((h) => h.max.set(30));

      type(input, '31');
      enter(input);

      expect(input.value).toBe('16');
      expect(host.commits).toEqual([]);
    });

    describe('without a value', () => {
      it('shows the empty field with "–", no value now and both steps disabled', async () => {
        const { input, decrease, increase } = await renderSteps((h) => {
          h.value.set(null);
          h.unit.set('fps');
        });

        expect(input.value).toBe('');
        expect(input.placeholder).toBe('–');
        expect(input.hasAttribute('aria-valuenow')).toBe(false);
        expect(input.hasAttribute('aria-valuetext')).toBe(false);
        expect(decrease.getAttribute('aria-disabled')).toBe('true');
        expect(increase.getAttribute('aria-disabled')).toBe('true');
      });

      it('steps nothing by button or arrow key', async () => {
        const { input, decrease, increase, host } = await renderSteps((h) => h.value.set(null));

        decrease.click();
        increase.click();
        press(input, 'ArrowUp');
        press(input, 'ArrowDown');

        expect(host.commits).toEqual([]);
      });

      it('steps from a typed number', async () => {
        const { fixture, input, increase, host } = await renderSteps((h) => h.value.set(null));

        type(input, '12');
        await fixture.whenStable();
        increase.click();

        expect(host.commits).toEqual([17]);
      });

      it('still commits a typed number on Enter', async () => {
        const { input, host } = await renderSteps((h) => h.value.set(null));

        type(input, '12');
        enter(input);

        expect(host.commits).toEqual([12]);
      });

      it('puts the empty field back for what it will not take', async () => {
        const { input, host } = await renderSteps((h) => h.value.set(null));

        type(input, 'abc');
        enter(input);

        expect(input.value).toBe('');
        expect(host.commits).toEqual([]);
      });
    });

    it('disabled turns off the input and both buttons, and nothing commits', async () => {
      const { input, decrease, increase, host } = await renderSteps((h) => h.disabled.set(true));

      expect(input.disabled).toBe(true);
      expect(decrease.disabled).toBe(true);
      expect(increase.disabled).toBe(true);
      decrease.click();
      increase.click();

      expect(host.commits).toEqual([]);
    });

    it('a disabled field marks its buttons disabled only, so they are not dimmed twice', async () => {
      const { decrease, increase } = await renderSteps((h) => h.disabled.set(true));

      for (const button of [decrease, increase]) {
        expect(button.disabled).toBe(true);
        expect(button.hasAttribute('aria-disabled')).toBe(false);
      }
    });

    it('a number typed above max steps from value: + commits value plus a step, held to max', async () => {
      const { fixture, input, increase, decrease, host } = await renderSteps((h) => {
        h.max.set(30);
        h.value.set(16);
      });

      type(input, '500');
      await fixture.whenStable();
      increase.click();
      expect(host.commits).toEqual([21]);

      type(input, '500');
      await fixture.whenStable();
      decrease.click();
      expect(host.commits).toEqual([21, 11]);
    });

    it('a number typed below min steps from value: − commits value minus a step, held to min', async () => {
      const { fixture, input, decrease, host } = await renderSteps((h) => h.value.set(4));

      type(input, '0');
      await fixture.whenStable();
      decrease.click();

      expect(host.commits).toEqual([1]);
    });

    it('a press on the unit or the box focuses the input; a press on a step button does not', async () => {
      const { fixture, root, box, input, decrease } = await renderSteps((h) => h.unit.set('fps'));
      document.body.appendChild(root);
      const press = (target: Element) => {
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        target.dispatchEvent(event);
        return event;
      };

      const onUnit = press(root.querySelector('.unit') as Element);
      expect(onUnit.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(input);

      input.blur();
      press(box);
      expect(document.activeElement).toBe(input);

      input.blur();
      expect(press(decrease).defaultPrevented).toBe(true);
      expect(document.activeElement).not.toBe(input);

      expect(press(input).defaultPrevented).toBe(false);
      fixture.destroy();
      root.remove();
    });

    it('showLabel false hides the label text, which still names the input', async () => {
      const { root, input } = await renderSteps((h) => h.showLabel.set(false));

      expect(root.textContent?.trim()).toBe('');
      expect(root.querySelector('label')).toBeNull();
      expect(input.getAttribute('aria-label')).toBe('Frames per second');
    });

    it('puts the unit inside the box, after the input and before +', async () => {
      const { box, input, increase } = await renderSteps((h) => h.unit.set('fps'));

      const unit = box.querySelector('.unit') as HTMLElement;
      expect(unit.textContent?.trim()).toBe('fps');
      expect(input.nextElementSibling).toBe(unit);
      expect(unit.nextElementSibling).toBe(increase);
    });
  });

  it('without steps puts a unit inside the box after the input, and describes the input by it', async () => {
    const { root, input, box } = await renderSteps((h) => {
      h.step.set(null);
      h.unit.set('fps');
    });

    expect(root.querySelectorAll('button').length).toBe(0);
    expect(box.hasAttribute('data-framed')).toBe(true);
    const unit = box.querySelector('.unit') as HTMLElement;
    expect(input.nextElementSibling).toBe(unit);
    expect(box.lastElementChild).toBe(unit);
    expect(input.getAttribute('aria-describedby')).toBe(unit.id);
    expect(input.getAttribute('role')).toBeNull();
  });
});
