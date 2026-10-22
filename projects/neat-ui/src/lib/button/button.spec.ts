import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { composite, contrastRatio, hexToOklch, oklchToHex } from '../theme/color';
import { MIN_FILL_CONTRAST } from '../theme/contrast-rules';
import { spartanThemeTokens } from '../theme/spartan-theme';
import type { NeatColorScheme } from '../theme/theme.service';
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
  readonly bound = signal(true);
  clicks = 0;
}

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

async function classesOf(variant: NeatButtonVariant): Promise<string[]> {
  const { button } = await renderButton((host) => host.variant.set(variant));
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
/** Variants for states the contrast test does not cover (open menus, focus, pressing, data states). */
const UNMODELLED_VARIANT = /^(aria-|focus-visible$|active$|data-|in-data-|has-|not-|\[)/;

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
 * `hover:dark:` or `group-hover:`, so a helm update cannot slip a colour past the contrast test.
 */
function assertModelledVariants(classes: string[]): void {
  for (const name of classes) {
    const { variants, utility } = variantsOf(name);
    if (!/^(bg|text)-/.test(utility)) continue;
    const states = variants.filter((variant) => !UNMODELLED_VARIANT.test(variant));
    const unmodelled = states.length < variants.length;
    const stateChain = states.join(':');
    const known = states.every((variant) => variant === 'dark' || variant === 'hover');
    if (!known || (!unmodelled && !MODELLED_VARIANTS.includes(stateChain))) {
      throw new Error(`Unknown variants on "${name}": teach the contrast test about them`);
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

describe('the contrast test itself', () => {
  it.each(['hover:dark:bg-accent', 'group-hover:bg-accent', 'dark:dark:text-foreground'])(
    'refuses a colour class with variants it does not model: %s',
    (name) => {
      expect(() => winningValue([name], 'bg', { scheme: 'dark', hover: true })).toThrow(
        /Unknown variants/,
      );
    },
  );

  it('ignores colour classes for states it does not cover', () => {
    const classes = ['bg-primary', 'aria-expanded:bg-muted', 'dark:focus-visible:bg-ring'];
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
