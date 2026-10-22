import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adoptSource, glyphsFromRegistry } from './adopt-helm.mjs';

const REGISTRY = `
export const NEAT_ICONS = {
  info: LucideInfo,
  'kiosk-exit': LucideMinimize,
} satisfies Record<string, LucideIcon>;
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

test('fails on an ng-icon glyph with no neat-icon mapping', () => {
  const source = ICON_COMPONENT.replaceAll('lucideMinimize', 'lucideCheck');
  assert.throws(
    () => adoptSource(THING_FILE, source, glyphs),
    /hlm-thing\.ts.*lucideCheck.*NEAT_ICONS/,
  );
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
