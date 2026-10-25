import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { adoptSource, glyphsFromRegistry, importedPackages } from './adopt-helm.mjs';

const REGISTRY = `
export const NEAT_ICONS = {
  info: drawing('info', Info),
  'kiosk-exit': drawing('kiosk-exit', Minimize),
} satisfies Record<string, LucideIconData>;
`;
const glyphs = glyphsFromRegistry(REGISTRY);

const TOOLTIP_FILE = 'projects/neat-ui/src/lib/ui/tooltip/src/lib/hlm-tooltip.ts';
const THING_FILE = 'projects/neat-ui/src/lib/ui/thing/src/lib/hlm-thing.ts';

/** A generated component that draws a Lucide glyph through ng-icons, as most helm composites do. */
const ICON_COMPONENT = `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo, lucideMinimize } from '@ng-icons/lucide';
import { provideBrnButtonConfig } from '@neat-ui/helm/button';
import { hlm } from '@neat-ui/helm/utils';

@Component({
	selector: 'hlm-thing',
	imports: [NgIcon],
	providers: [provideIcons({ lucideInfo, lucideMinimize }), provideBrnButtonConfig({ variant: 'ghost' })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: \`
		<ng-icon name="lucideInfo" class="size-4" />
		<ng-icon name="lucideMinimize"></ng-icon>
	\`,
	host: { class: '[&_ng-icon]:shrink-0' },
})
export class HlmThing {}
`;

test('rewrites @neat-ui/helm/<name> imports to relative paths', () => {
  const source = `import { hlm } from '@neat-ui/helm/utils';
import type { ButtonVariants } from '@neat-ui/helm/button';
export * from "@neat-ui/helm/button";
`;
  assert.equal(
    adoptSource(TOOLTIP_FILE, source, glyphs),
    `import { hlm } from '../../../utils/src';
import type { ButtonVariants } from '../../../button/src';
export * from '../../../button/src';
`,
  );
});

test('swaps an ng-icon glyph for <neat-icon name="…" [size]="16"> and imports NeatIcon relatively', () => {
  const adopted = adoptSource(THING_FILE, ICON_COMPONENT, glyphs);

  assert.match(adopted, /^import \{ NeatIcon \} from '\.\.\/\.\.\/\.\.\/\.\.\/icon\/icon';\n/);
  assert.match(adopted, /imports: \[NeatIcon\],/);
  assert.match(adopted, /<neat-icon name="info" \[size\]="16" class="size-4" \/>/);
  assert.match(adopted, /<neat-icon name="kiosk-exit" \[size\]="16"><\/neat-icon>/);
  // Only the icon registration goes; the other provider stays.
  assert.match(adopted, /providers: \[provideBrnButtonConfig\(\{ variant: 'ghost' \}\)\],/);
  assert.doesNotMatch(adopted, /ng-icons|NgIcon|provideIcons|<\/?ng-icon/);
});

test('swaps an icon registered through viewProviders, dropping the emptied property', () => {
  const source = `import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';

@Component({
	selector: 'hlm-thing',
	imports: [NgIcon],
	viewProviders: [provideIcons({ lucideInfo })],
	template: \`<ng-icon name="lucideInfo" />\`,
})
export class HlmThing {}
`;
  const adopted = adoptSource(THING_FILE, source, glyphs);

  assert.doesNotMatch(adopted, /viewProviders/);
  assert.match(adopted, /<neat-icon name="info" \[size\]="16" \/>/);
});

test('reads every glyph of the real icon registry', () => {
  const registry = readFileSync(
    new URL('../projects/neat-ui/src/lib/icon/icon-registry.ts', import.meta.url),
    'utf8',
  );
  const real = glyphsFromRegistry(registry);
  // Every Lucide glyph the registry imports is drawn by exactly one name.
  const [, imported] = /import \{([^}]*)\} from 'lucide'/.exec(registry);
  const expected = imported
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name)
    .map((name) => `lucide${name}`);
  assert.deepEqual([...real.keys()].sort(), expected.sort());
  assert.ok([...real.values()].every((name) => typeof name === 'string'));
  assert.equal(real.get('lucideInfo'), 'info');
  assert.equal(real.get('lucideMinimize'), 'kiosk-exit');
});

test('fails on an ng-icon glyph several neat-icon names draw', () => {
  const ambiguous = glyphsFromRegistry(`${REGISTRY}\n  help: drawing('help', Info),\n`);
  assert.equal(ambiguous.get('lucideInfo'), null);
  assert.throws(
    () => adoptSource(THING_FILE, ICON_COMPONENT, ambiguous),
    /lucideInfo is ambiguous/,
  );
});

test('fails on an ng-icon glyph with no neat-icon mapping', () => {
  const source = ICON_COMPONENT.replaceAll('lucideMinimize', 'lucideCheck');
  assert.throws(
    () => adoptSource(THING_FILE, source, glyphs),
    /hlm-thing\.ts.*lucideCheck.*NEAT_ICONS/,
  );
});

test('leaves providers arrays without provideIcons as they are', () => {
  const source = `import { Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideInfo } from '@ng-icons/lucide';

@Component({
	selector: 'hlm-thing',
	imports: [NgIcon],
	providers: [],
	viewProviders: [provideIcons({ lucideInfo })],
	template: \`<ng-icon name="lucideInfo" />\`,
})
export class HlmThing {}
`;
  const adopted = adoptSource(THING_FILE, source, glyphs);

  assert.match(adopted, /\tproviders: \[\],\n/);
  assert.doesNotMatch(adopted, /viewProviders/);
});

test('fails on ng-icon usage it cannot rewrite', () => {
  const source = ICON_COMPONENT.replace('name="lucideInfo"', '[name]="icon()"');
  assert.throws(() => adoptSource(THING_FILE, source, glyphs), /hlm-thing\.ts.*ng-icon/);
});

test('retargets [&_ng-icon and *:[ng-icon selectors to neat-icon', () => {
  const source = `export const buttonVariants = cva(
	"[&_ng-icon]:pointer-events-none [&_ng-icon:not([class*='text-'])]:text-[length:--spacing(4)] *:[ng-icon]:size-4",
);
`;
  assert.equal(
    adoptSource(TOOLTIP_FILE, source, glyphs),
    `export const buttonVariants = cva(
	"[&_neat-icon]:pointer-events-none [&_neat-icon:not([class*='text-'])]:text-[length:--spacing(4)] *:[neat-icon]:size-4",
);
`,
  );
});

test('is idempotent: adopting adopted source changes nothing', () => {
  const once = adoptSource(THING_FILE, ICON_COMPONENT, glyphs);
  assert.equal(adoptSource(THING_FILE, once, glyphs), once);
});

test('lists the packages a helm file imports, not its relative imports', () => {
  const source = `import type { BooleanInput } from '@angular/cdk/coercion';
import {
	Directive,
	input,
} from '@angular/core';
import { BrnButton } from '@spartan-ng/brain/button';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ClassValue } from 'clsx';
import { classes } from '../../../utils/src';
export * from './lib/hlm-button';
/**
 * @example
 * import { provideSpartanHlm } from '@spartan-ng/helm/utils';
 */
`;
  assert.deepEqual(importedPackages(source), [
    '@angular/cdk',
    '@angular/core',
    '@spartan-ng/brain',
    'class-variance-authority',
    'clsx',
  ]);
});
