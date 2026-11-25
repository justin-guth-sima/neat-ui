import type { EnvironmentProviders, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DocsContext, type DocsTarget } from './docs-context';
import { API as BEV } from './generated/api/bev';
import { API as BUBBLE } from './generated/api/bubble';
import { API as CALLOUT } from './generated/api/callout';
import { API as CARD } from './generated/api/card';
import { API as CHARTS } from './generated/api/charts';
import { API as CHAT } from './generated/api/chat';
import { API as CODE_BLOCK } from './generated/api/code-block';
import { API as COLLAPSIBLE } from './generated/api/collapsible';
import { API as CONFIRM } from './generated/api/confirm';
import { API as DETAILS } from './generated/api/details';
import { API as DIAGRAM } from './generated/api/diagram';
import { API as DIALOG } from './generated/api/dialog';
import { API as DROP_ZONE } from './generated/api/drop-zone';
import { API as FIELD } from './generated/api/field';
import { API as FILE_BROWSER } from './generated/api/file-browser';
import { API as INPUT } from './generated/api/input';
import { API as INSIGHT } from './generated/api/insight';
import { API as LEVEL_METER } from './generated/api/level-meter';
import { API as LINE_LIST } from './generated/api/line-list';
import { API as LUCIDE } from './generated/api/lucide';
import { API as MARKDOWN } from './generated/api/markdown';
import { API as NUMBER_FIELD } from './generated/api/number-field';
import { API as POPOVER } from './generated/api/popover';
import { API as PRIMARY } from './generated/api/primary';
import { API as PROGRESS } from './generated/api/progress';
import { API as SEARCH_PALETTE } from './generated/api/search-palette';
import { API as SEGMENTED } from './generated/api/segmented';
import { API as SELECT_LIST } from './generated/api/select-list';
import { API as SELECT } from './generated/api/select';
import { API as SLIDER } from './generated/api/slider';
import { API as STATUS_CHIP } from './generated/api/status-chip';
import { API as STREAM } from './generated/api/stream';
import { API as SWITCH } from './generated/api/switch';
import { API as TABLE } from './generated/api/table';
import { API as TABS } from './generated/api/tabs';
import { API as TOAST } from './generated/api/toast';
import { API as VIDEO } from './generated/api/video';
import type { DocsEntry } from './model';

/**
 * A docs page for the views' specs: `here` names the parts on the page, `elsewhere` the topic path
 * of parts on other pages, and `revealed` records what the views asked the panel to show.
 */
export class FakeDocs extends DocsContext {
  readonly revealed: string[] = [];

  constructor(
    private readonly here: readonly string[] = [],
    private readonly elsewhere: Readonly<Record<string, string>> = {},
  ) {
    super();
  }

  target(name: string): DocsTarget | null {
    const fragment = `api-${name}`;
    if (this.here.includes(name)) return { commands: [], fragment, here: true };
    const path = this.elsewhere[name];
    return path ? { commands: path, fragment, here: false } : null;
  }

  reveal(name: string): void {
    this.revealed.push(name);
  }
}

/**
 * A router whose every path matches, so a followed link navigates instead of failing after the
 * spec, and `docs` as the page's context.
 */
export function provideFakeDocs(docs: FakeDocs): (Provider | EnvironmentProviders)[] {
  return [provideRouter([{ path: '**', children: [] }]), { provide: DocsContext, useValue: docs }];
}

/**
 * Every generated API module, the kit's whole public API as documented. A spec cannot read the
 * disk, so the list is written out; `tools/docs-emit.test.mjs` fails when a module on disk is
 * missing from it.
 */
export const KIT_ENTRIES: readonly DocsEntry[] = [
  BEV,
  BUBBLE,
  CALLOUT,
  CARD,
  CHARTS,
  CHAT,
  CODE_BLOCK,
  COLLAPSIBLE,
  CONFIRM,
  DETAILS,
  DIAGRAM,
  DIALOG,
  DROP_ZONE,
  FIELD,
  FILE_BROWSER,
  INPUT,
  INSIGHT,
  LEVEL_METER,
  LINE_LIST,
  LUCIDE,
  MARKDOWN,
  NUMBER_FIELD,
  POPOVER,
  PRIMARY,
  PROGRESS,
  SEARCH_PALETTE,
  SEGMENTED,
  SELECT_LIST,
  SELECT,
  SLIDER,
  STATUS_CHIP,
  STREAM,
  SWITCH,
  TABLE,
  TABS,
  TOAST,
  VIDEO,
];
