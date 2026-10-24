import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { composite, contrastRatio, hexToOklch, oklchToHex } from '../theme/color';
import { MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from '../theme/contrast-rules';
import { spartanThemeTokens } from '../theme/spartan-theme';
import type { NeatColorScheme } from '../theme/theme.service';
import { NeatTooltip } from '../tooltip/tooltip';
import { NeatButton, type NeatButtonSize, type NeatButtonVariant } from './button';

const VARIANTS: NeatButtonVariant[] = ['primary', 'secondary', 'outlined', 'text', 'danger'];
const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
/** The surfaces a button sits on: the page and a card. */
const SURFACES = ['background', 'card'] as const;
type Surface = (typeof SURFACES)[number];

/** Classes that tell helm's variants apart, so each kit variant is seen to use the right one. */
const HELM_VARIANT_MARKERS: Record<NeatButtonVariant, string[]> = {
  primary: ['bg-primary', 'text-primary-foreground'],
  secondary: ['bg-secondary', 'text-secondary-foreground'],
  // Helm's ghost is its outline without the border, fill and shadow.
  outlined: [
    'border-border',
    'bg-background',
    'dark:bg-input/30',
    'shadow-xs',
    'hover:text-foreground',
    'aria-expanded:bg-muted',
  ],
  text: ['hover:text-foreground', 'aria-expanded:bg-muted'],
  danger: ['bg-destructive/10', 'dark:bg-destructive/20', 'text-destructive'],
};

@Component({
  imports: [NeatButton],
  template: `
    <button
      neatButton
      type="button"
      class="host-class"
      [class.bound-class]="bound()"
      [variant]="variant()"
      [size]="size()"
      [iconOnly]="iconOnly()"
      [rounded]="rounded()"
      [disabled]="disabled()"
      [pressed]="pressed()"
      [attr.aria-disabled]="held() || null"
      (click)="clicks = clicks + 1"
    >
      Label
    </button>
  `,
})
class ButtonHost {
  readonly variant = signal<NeatButtonVariant>('primary');
  readonly size = signal<NeatButtonSize>('medium');
  readonly iconOnly = signal(false);
  readonly rounded = signal(false);
  readonly disabled = signal(false);
  readonly pressed = signal<boolean | undefined>(undefined);
  readonly held = signal(false);
  readonly bound = signal(true);
  clicks = 0;
}

/** A held main action with a tooltip, as Streaming's slot panel has it. */
@Component({
  imports: [NeatButton, NeatTooltip],
  template: `
    <button
      neatButton
      type="button"
      aria-disabled="true"
      neatTooltip="Waiting for the source change to finish"
    >
      Start
    </button>
  `,
})
class HeldTooltipHost {}

@Component({ template: '' })
class EmptyPage {}

@Component({
  imports: [NeatButton, RouterLink, RouterLinkActive],
  template: `<a neatButton variant="text" routerLink="/here" routerLinkActive="is-active">Here</a>`,
})
class LinkHost {}

/** Lets helm's class manager (a MutationObserver plus effects) catch up with a change. */
async function settle(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
}

async function renderButton(setup: (host: ButtonHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(ButtonHost);
  setup(fixture.componentInstance);
  await settle(fixture);
  const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
  return { fixture, host: fixture.componentInstance, button };
}

async function classesOf(variant: NeatButtonVariant, pressed?: boolean): Promise<string[]> {
  const { button } = await renderButton((host) => {
    host.variant.set(variant);
    host.pressed.set(pressed);
  });
  return [...button.classList];
}

// Contrast: the button's colour utilities resolved against the emitted theme tokens.

type Tokens = Readonly<Record<string, string>>;
interface ButtonState {
  scheme: NeatColorScheme;
  hover: boolean;
}

/** Non-colour utilities sharing the `bg-` and `text-` prefixes; anything else unknown fails. */
const NON_COLOR_VALUES = { bg: ['clip-padding'], text: ['xs', 'sm', 'balance'] };
const COLOR_MIX = /^\[color-mix\(in_oklch,var\(--([\w-]+)\),var\(--([\w-]+)\)_(\d+)%\)\]$/;
const TOKEN_COLOR = /^([a-z-]+?)(?:\/(\d+))?$/;
/** The variant chains the cascade below models. */
const MODELLED_VARIANTS = ['', 'dark', 'hover', 'dark:hover'];
/**
 * States the contrast test does not cover, each one helm's button uses today: an open menu
 * (`aria-expanded`), keyboard focus and pressing. A colour class carrying one is skipped.
 */
const UNCOVERED_STATES = ['aria-expanded', 'focus-visible', 'active'];
/**
 * Variants that only scope a class to a child or an attribute, such as helm's
 * `[&_neat-icon:not([class*='text-'])]:text-[length:…]`. Skipped too, unless they mention dark or
 * hover (`not-dark:`, `[.neat-dark_&]:`), which would change the cascade the test models.
 */
const SCOPING_VARIANT = /^(\[|not-|has-)/;

/** A class as its variants and utility, split at the colons outside brackets. */
function variantsOf(name: string): { variants: string[]; utility: string } {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < name.length; i++) {
    if (name[i] === '[') depth++;
    else if (name[i] === ']') depth--;
    else if (name[i] === ':' && depth === 0) {
      parts.push(name.slice(start, i));
      start = i + 1;
    }
  }
  return { variants: parts, utility: name.slice(start) };
}

/**
 * Fails on a `bg-` or `text-` class whose variants the cascade below does not know, such as
 * `hover:dark:`, `group-hover:` or `not-dark:`, so a helm update cannot slip a colour past the
 * contrast test.
 */
function assertModelledVariants(classes: string[]): void {
  for (const name of classes) {
    const { variants, utility } = variantsOf(name);
    if (!/^(bg|text)-/.test(utility)) continue;
    const fail = () => {
      throw new Error(`Unknown variants on "${name}": teach the contrast test about them`);
    };
    let uncovered = false;
    const chain: string[] = [];
    for (const variant of variants) {
      if (variant === 'dark' || variant === 'hover') {
        chain.push(variant);
      } else if (UNCOVERED_STATES.includes(variant)) {
        uncovered = true;
      } else if (SCOPING_VARIANT.test(variant) && !/dark|hover/.test(variant)) {
        uncovered = true;
      } else {
        fail();
      }
    }
    if (!uncovered && !MODELLED_VARIANTS.includes(chain.join(':'))) {
      fail();
    }
  }
}

/**
 * The value of the `bg-` or `text-` utility that wins in a state, by Tailwind's cascade for the
 * variants buttons use: `hover:` selectors outrank `dark:` (whose `:where(.neat-dark *)` adds no
 * specificity) and `dark:hover:` comes last. Undefined when no utility sets the property.
 */
function winningValue(
  classes: string[],
  property: 'bg' | 'text',
  { scheme, hover }: ButtonState,
): string | undefined {
  assertModelledVariants(classes);
  const dark = scheme === 'dark';
  const prefixes = [dark && hover && 'dark:hover:', hover && 'hover:', dark && 'dark:', ''].filter(
    (prefix): prefix is string => prefix !== false,
  );
  for (const prefix of prefixes) {
    const values = classes
      .filter((name) => name.startsWith(`${prefix}${property}-`))
      .map((name) => name.slice(prefix.length + property.length + 1))
      .filter((value) => !NON_COLOR_VALUES[property].includes(value));
    if (values.length) {
      return values[values.length - 1];
    }
  }
  return undefined;
}

/** CSS `color-mix(in oklch, a, b weight)` for opaque colours, interpolating hue the short way. */
function mixOklch(a: string, b: string, weightOfB: number): string {
  const [from, to] = [hexToOklch(a), hexToOklch(b)];
  // A hue is powerless on an achromatic colour (white, for example): the other colour's applies.
  const ACHROMATIC = 1e-4;
  const fromHue = from.c < ACHROMATIC ? to.h : from.h;
  const toHue = to.c < ACHROMATIC ? from.h : to.h;
  const hueStep = ((((toHue - fromHue) % 360) + 540) % 360) - 180;
  const mix = (x: number, y: number) => x + (y - x) * weightOfB;
  return oklchToHex({
    l: mix(from.l, to.l),
    c: mix(from.c, to.c),
    h: fromHue + hueStep * weightOfB,
  });
}

/** A utility value as an opaque colour over `under`. */
function resolveColor(value: string, tokens: Tokens, under: string): string {
  const mixed = COLOR_MIX.exec(value);
  if (mixed) {
    return mixOklch(token(tokens, mixed[1]), token(tokens, mixed[2]), Number(mixed[3]) / 100);
  }
  const [, name, alpha] = TOKEN_COLOR.exec(value) ?? [];
  if (!name || !(name in tokens)) {
    throw new Error(`Unknown colour utility value "${value}": teach the contrast test about it`);
  }
  return alpha ? composite(tokens[name], Number(alpha) / 100, under) : tokens[name];
}

function token(tokens: Tokens, name: string): string {
  if (!(name in tokens)) throw new Error(`No theme token --${name}`);
  return tokens[name];
}

/** The fill (composited over the surface) and text colour of a button with `classes`. */
function colorsOf(classes: string[], state: ButtonState, surface: Surface) {
  const tokens = spartanThemeTokens(state.scheme);
  const under = tokens[surface];
  const bg = winningValue(classes, 'bg', state);
  const text = winningValue(classes, 'text', state);
  return {
    fill: bg === undefined ? under : resolveColor(bg, tokens, under),
    // Without a text utility the button inherits the surface's text colour.
    text:
      text === undefined
        ? tokens[`${surface === 'card' ? 'card-' : ''}foreground`]
        : resolveColor(text, tokens, under),
  };
}

// Focus ring: helm draws it on keyboard focus as a box-shadow ring (`focus-visible:ring-3`) around
// the button's border, so the ring is the part of the indicator next to the surface.

/** The width utility that draws the ring; its colour comes from a `ring-<colour>` utility. */
const FOCUS_RING_WIDTH = 'focus-visible:ring-3';
/** The variant chains the focus-ring lookup models. */
const MODELLED_RING_VARIANTS = ['focus-visible', 'dark:focus-visible'];
/** Rings for a failed form validation, not for focus; skipped. */
const INVALID_STATE = 'data-[matches-spartan-invalid=true]';

/**
 * The `ring-` colour value a focused button shows, by the same cascade as `winningValue`:
 * `dark:focus-visible:` comes after `focus-visible:`. Fails on a `ring-` colour with variants it
 * does not model, so a helm update cannot slip a ring colour past the test.
 */
function focusRingValue(classes: string[], scheme: NeatColorScheme): string {
  for (const name of classes) {
    const { variants, utility } = variantsOf(name);
    const value = /^ring-(.+)$/.exec(utility)?.[1];
    if (value === undefined || /^\d+$/.test(value) || variants.includes(INVALID_STATE)) continue;
    if (!MODELLED_RING_VARIANTS.includes(variants.join(':'))) {
      throw new Error(`Unknown variants on "${name}": teach the focus-ring test about them`);
    }
  }
  const prefixes =
    scheme === 'dark' ? ['dark:focus-visible:', 'focus-visible:'] : ['focus-visible:'];
  for (const prefix of prefixes) {
    const values = classes
      .filter((name) => name.startsWith(`${prefix}ring-`))
      .map((name) => name.slice(prefix.length + 'ring-'.length))
      .filter((value) => !/^\d+$/.test(value));
    if (values.length) {
      return values[values.length - 1];
    }
  }
  throw new Error('No focus ring colour');
}

describe('the contrast test itself', () => {
  it.each([
    'hover:dark:bg-accent',
    'dark:dark:text-foreground',
    'group-hover:bg-accent',
    'not-dark:bg-accent',
    'has-[:hover]:bg-accent',
    '[.neat-dark_&]:bg-accent',
    '[&:hover]:text-foreground',
    'data-[state=open]:bg-accent',
  ])('refuses a colour class with variants it does not model: %s', (name) => {
    expect(() => winningValue([name], 'bg', { scheme: 'dark', hover: true })).toThrow(
      /Unknown variants/,
    );
  });

  it.each(['ring-ring', 'hover:ring-ring', 'focus:ring-ring', 'focus-visible:dark:ring-ring'])(
    'refuses a ring colour with variants it does not model: %s',
    (name) => {
      expect(() => focusRingValue([name, 'focus-visible:ring-ring'], 'dark')).toThrow(
        /Unknown variants/,
      );
    },
  );

  it('finds the focused ring colour, the dark one in dark, and skips widths and invalid rings', () => {
    const classes = [
      'focus-visible:ring-3',
      'focus-visible:ring-ring/50',
      'dark:focus-visible:ring-destructive',
      `${INVALID_STATE}:ring-destructive/20`,
    ];
    expect(focusRingValue(classes, 'light')).toBe('ring/50');
    expect(focusRingValue(classes, 'dark')).toBe('destructive');
  });

  it('ignores colour classes for states it does not cover', () => {
    const classes = [
      'bg-primary',
      'aria-expanded:bg-muted',
      'dark:focus-visible:bg-ring',
      "[&_neat-icon:not([class*='text-'])]:text-[length:--spacing(4)]",
    ];
    expect(winningValue(classes, 'bg', { scheme: 'dark', hover: true })).toBe('primary');
  });
});

describe('NeatButton', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: EmptyPage }])],
    });
  });

  it.each(VARIANTS)('maps variant %s onto its helm variant classes', async (variant) => {
    const classes = await classesOf(variant);

    expect(classes).toEqual(expect.arrayContaining(HELM_VARIANT_MARKERS[variant]));
    for (const other of VARIANTS.filter((name) => name !== variant)) {
      const foreign = HELM_VARIANT_MARKERS[other].filter(
        (marker) => !HELM_VARIANT_MARKERS[variant].includes(marker),
      );
      expect(
        classes.filter((name) => foreign.includes(name)),
        `${variant} vs ${other}`,
      ).toEqual([]);
    }
  });

  it.each<[NeatButtonSize, boolean, string[]]>([
    ['small', false, ['h-8']],
    ['medium', false, ['h-9']],
    ['large', false, ['h-10']],
    ['small', true, ['size-8']],
    ['medium', true, ['size-9']],
    ['large', true, ['size-10']],
  ])('maps size %s (iconOnly %s) onto helm sizes', async (size, iconOnly, expected) => {
    const { button } = await renderButton((host) => {
      host.size.set(size);
      host.iconOnly.set(iconOnly);
    });

    expect([...button.classList]).toEqual(expect.arrayContaining(expected));
  });

  it('touch size gives a 48 px square when iconOnly, 48 px min height otherwise (by class)', async () => {
    const { fixture, host, button } = await renderButton((host) => host.size.set('touch'));

    expect([...button.classList]).toEqual(
      expect.arrayContaining(['h-auto', 'min-h-12', 'min-w-12']),
    );
    expect(button.classList).not.toContain('h-10');

    host.iconOnly.set(true);
    await settle(fixture);

    expect(button.classList).toContain('size-12');
    expect(button.classList).not.toContain('size-10');
    expect(button.classList).not.toContain('min-h-12');
  });

  it('rounded makes the button a pill (a circle when iconOnly)', async () => {
    const { fixture, host, button } = await renderButton();
    expect(button.classList).not.toContain('rounded-full');

    host.rounded.set(true);
    await settle(fixture);

    expect(button.classList).toContain('rounded-full');
    expect(button.classList).not.toContain('rounded-md');
  });

  it('keeps classes the host sets via class="…" and [class.x] alongside its own', async () => {
    const { fixture, host, button } = await renderButton();
    expect([...button.classList]).toEqual(
      expect.arrayContaining(['host-class', 'bound-class', 'bg-primary']),
    );

    host.bound.set(false);
    await settle(fixture);
    expect(button.classList).not.toContain('bound-class');
    expect([...button.classList]).toEqual(expect.arrayContaining(['host-class', 'bg-primary']));

    host.variant.set('secondary');
    host.bound.set(true);
    await settle(fixture);
    expect([...button.classList]).toEqual(
      expect.arrayContaining(['host-class', 'bound-class', 'bg-secondary']),
    );
    expect(button.classList).not.toContain('bg-primary');
  });

  it('keeps routerLinkActive classes on an anchor[neatButton]', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(LinkHost);
    const anchor: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    await settle(fixture);
    expect(anchor.classList).not.toContain('is-active');

    await router.navigateByUrl('/here');
    await settle(fixture);
    expect(anchor.classList).toContain('is-active');
    expect(anchor.classList).toContain('hover:text-foreground');

    await router.navigateByUrl('/elsewhere');
    await settle(fixture);
    expect(anchor.classList).not.toContain('is-active');
    expect(anchor.classList).toContain('hover:text-foreground');
  });

  it('disabled reaches the native button and blocks clicks', async () => {
    const { fixture, host, button } = await renderButton((host) => host.disabled.set(true));

    expect(button.disabled).toBe(true);
    expect(button.hasAttribute('data-disabled')).toBe(true);
    button.click();
    expect(host.clicks).toBe(0);

    host.disabled.set(false);
    await settle(fixture);
    button.click();
    expect(host.clicks).toBe(1);
  });

  it.each(VARIANTS)(
    '%s: aria-disabled dims the button as disabled does and keeps the focus and the pointer',
    async (variant) => {
      const { fixture, host, button } = await renderButton((host) => host.variant.set(variant));
      const classes = [...button.classList];
      // The disabled dimming, with a not-allowed cursor in place of helm's pointer-events-none:
      // the pointer must still reach a held button, for its hover and its tooltip.
      expect(classes).toEqual(expect.arrayContaining(['data-disabled:opacity-50']));
      expect(classes).toEqual(
        expect.arrayContaining(['aria-disabled:opacity-50', 'aria-disabled:cursor-not-allowed']),
      );
      expect(classes.filter((name) => /^aria-disabled:pointer-events/.test(name))).toEqual([]);

      host.held.set(true);
      await settle(fixture);
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.disabled).toBe(false);
      expect(button.hasAttribute('data-disabled')).toBe(false);
      expect(button.hasAttribute('tabindex')).toBe(false);
      button.focus();
      expect(document.activeElement).toBe(button);
    },
  );

  it('leaves a held button’s presses to its handler, which ignores them while it waits', async () => {
    const { fixture, host, button } = await renderButton((host) => host.held.set(true));

    // The kit only styles aria-disabled: a pointer click reaches the handler, as Enter and Space
    // do, so the handler is the guard.
    button.click();
    await settle(fixture);
    expect(host.clicks).toBe(1);
  });

  it('opens a tooltip on a held button on hover, as on any button', async () => {
    const fixture = TestBed.createComponent(HeldTooltipHost);
    await settle(fixture);
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    button.getBoundingClientRect = () => new DOMRect(472, 368, 80, 32);

    button.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    // The tooltip opens after a zero delay, then renders its text.
    await settle(fixture);
    await fixture.whenStable();

    const tooltip = document.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent?.trim()).toBe('Waiting for the source change to finish');
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it.each(VARIANTS)(
    '%s: text reaches 4.5:1 on its background at rest and on hover, in both schemes, over background and card',
    async (variant) => {
      const classes = await classesOf(variant);

      for (const scheme of SCHEMES) {
        for (const hover of [false, true]) {
          for (const surface of SURFACES) {
            const { fill, text } = colorsOf(classes, { scheme, hover }, surface);
            const label = `${variant}, ${scheme}, ${hover ? 'hover' : 'rest'}, over ${surface}: ${text} on ${fill}`;
            expect(contrastRatio(text, fill), label).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    },
  );

  it.each(VARIANTS)(
    `%s: the focus ring reaches ${MIN_NON_TEXT_CONTRAST}:1 against background and card, in both schemes`,
    async (variant) => {
      const classes = await classesOf(variant);
      expect(classes).toContain(FOCUS_RING_WIDTH);

      for (const scheme of SCHEMES) {
        const tokens = spartanThemeTokens(scheme);
        const value = focusRingValue(classes, scheme);
        for (const surface of SURFACES) {
          const ring = resolveColor(value, tokens, tokens[surface]);
          const label = `${variant}, ${scheme}, ring-${value} on --${surface}: ${ring} vs ${tokens[surface]}`;
          expect(contrastRatio(ring, tokens[surface]), label).toBeGreaterThanOrEqual(
            MIN_NON_TEXT_CONTRAST,
          );
        }
      }
    },
  );

  it('pressed sets aria-pressed from the input and leaves the attribute off when undefined', async () => {
    const { fixture, host, button } = await renderButton();
    expect(button.hasAttribute('aria-pressed')).toBe(false);

    host.pressed.set(true);
    await settle(fixture);
    expect(button.getAttribute('aria-pressed')).toBe('true');

    host.pressed.set(false);
    await settle(fixture);
    expect(button.getAttribute('aria-pressed')).toBe('false');

    host.pressed.set(undefined);
    await settle(fixture);
    expect(button.hasAttribute('aria-pressed')).toBe(false);
  });

  it.each(VARIANTS)(
    '%s: a button that is not pressed looks the same as one without the input',
    async (variant) => {
      expect(await classesOf(variant, false)).toEqual(await classesOf(variant));
    },
  );

  /**
   * Primary is a solid fill already, so in dark no fill is 3:1 from it and from the surface at
   * once. Its fill (#E28250) has a relative luminance of 0.33; a fill 3:1 from it must be darker
   * than 0.076 (or lighter than 1.08, which does not exist), while one 3:1 from the dark
   * background (0.010) must be lighter than 0.13, and from the card (0.024) than 0.17. So dark
   * primary is exempt from the rule against the resting fill (the pressed fill reaches 2.78:1);
   * light primary keeps it (3.9:1). A toggle belongs on one of the other variants; primary still
   * shows the pressed look and is held to the surface and text rules below.
   */
  const SCHEMES_SEPARABLE_FROM_REST = (variant: NeatButtonVariant): NeatColorScheme[] =>
    variant === 'primary' ? ['light'] : SCHEMES;

  it.each(VARIANTS)(
    `%s: pressed text reaches 4.5:1 and the fill ${MIN_NON_TEXT_CONTRAST}:1 against the surface, at rest and on hover, in both schemes`,
    async (variant) => {
      const pressed = await classesOf(variant, true);

      for (const scheme of SCHEMES) {
        for (const surface of SURFACES) {
          const under = spartanThemeTokens(scheme)[surface];
          for (const hover of [false, true]) {
            const { fill, text } = colorsOf(pressed, { scheme, hover }, surface);
            const label = `${variant}, ${scheme}, pressed ${hover ? 'hover' : 'rest'}, over ${surface}`;
            expect(
              contrastRatio(text, fill),
              `${label}: text ${text} on ${fill}`,
            ).toBeGreaterThanOrEqual(4.5);
            expect(
              contrastRatio(fill, under),
              `${label}: fill ${fill} vs surface ${under}`,
            ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          }
        }
      }
    },
  );

  it.each(VARIANTS)(
    `%s: the pressed fill is ${MIN_NON_TEXT_CONTRAST}:1 from the resting fill, in both schemes (primary: light only), at rest and on hover`,
    async (variant) => {
      const rest = await classesOf(variant);
      const pressed = await classesOf(variant, true);

      for (const scheme of SCHEMES_SEPARABLE_FROM_REST(variant)) {
        for (const surface of SURFACES) {
          const resting = colorsOf(rest, { scheme, hover: false }, surface).fill;
          for (const hover of [false, true]) {
            const { fill } = colorsOf(pressed, { scheme, hover }, surface);
            expect(
              contrastRatio(fill, resting),
              `${variant}, ${scheme}, pressed ${hover ? 'hover' : 'rest'}, over ${surface}: ${fill} vs rest ${resting}`,
            ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
          }
        }
      }
    },
  );

  it.each<NeatButtonVariant>(['outlined', 'text'])(
    `%s: the hover fill differs from background and from card by a contrast ratio of at least ${MIN_FILL_CONTRAST}`,
    async (variant) => {
      const classes = await classesOf(variant);

      for (const scheme of SCHEMES) {
        const tokens = spartanThemeTokens(scheme);
        for (const surface of SURFACES) {
          const { fill } = colorsOf(classes, { scheme, hover: true }, surface);
          const label = `${variant}, ${scheme}, hover on --${surface}: ${fill} vs ${tokens[surface]}`;
          expect(contrastRatio(fill, tokens[surface]), label).toBeGreaterThanOrEqual(
            MIN_FILL_CONTRAST,
          );
        }
      }
    },
  );
});
