// Specs are not packaged, but the rest of the direction rule holds for them (AGENTS.md). This one
// reaches across by relative path because it compares the primary with every entry. The list of
// entries is written out: a spec is bundled statically, so it cannot import by a name found on disk
// (`check-dist.test.mjs` compares the entry folders with its own table).
import * as callout from '../callout/src/public-api';
import * as charts from '../charts/src/public-api';
import * as collapsible from '../collapsible/src/public-api';
import * as confirm from '../confirm/src/public-api';
import * as details from '../details/src/public-api';
import * as diagram from '../diagram/src/public-api';
import * as dialog from '../dialog/src/public-api';
import * as dropZone from '../drop-zone/src/public-api';
import * as field from '../field/src/public-api';
import * as fileBrowser from '../file-browser/src/public-api';
import * as input from '../input/src/public-api';
import * as levelMeter from '../level-meter/src/public-api';
import * as lineList from '../line-list/src/public-api';
import * as lucide from '../lucide/src/public-api';
import * as numberField from '../number-field/src/public-api';
import * as popover from '../popover/src/public-api';
import * as progress from '../progress/src/public-api';
import * as segmented from '../segmented/src/public-api';
import * as select from '../select/src/public-api';
import * as selectList from '../select-list/src/public-api';
import * as slider from '../slider/src/public-api';
import * as statusChip from '../status-chip/src/public-api';
import * as switchEntry from '../switch/src/public-api';
import * as table from '../table/src/public-api';
import * as tabs from '../tabs/src/public-api';
import * as toast from '../toast/src/public-api';
import * as video from '../video/src/public-api';
import * as primary from './public-api';

const ENTRIES = {
  callout,
  charts,
  collapsible,
  confirm,
  details,
  diagram,
  dialog,
  dropZone,
  field,
  fileBrowser,
  input,
  levelMeter,
  lineList,
  lucide,
  numberField,
  popover,
  progress,
  segmented,
  select,
  selectList,
  slider,
  statusChip,
  switchEntry,
  table,
  tabs,
  toast,
  video,
};

describe('the public API', () => {
  it('the primary entry exports no component that has its own entry', () => {
    // What moved into the primary and is still re-exported where apps imported it from before.
    const REEXPORTED: Partial<Record<keyof typeof ENTRIES, string[]>> = {
      charts: ['NeatSeriesSwatch'],
    };
    for (const [name, entry] of Object.entries(ENTRIES)) {
      const exported = Object.keys(entry);
      const moved = REEXPORTED[name as keyof typeof ENTRIES] ?? [];
      expect(exported.length, `${name} exports something`).toBeGreaterThan(0);
      expect(
        exported.filter((symbol) => symbol in primary && !moved.includes(symbol)),
        `${name} symbols also exported by the primary`,
      ).toEqual([]);
      for (const symbol of moved)
        expect(entry[symbol as keyof typeof entry], symbol).toBe(
          primary[symbol as keyof typeof primary],
        );
    }
  });

  it('exports the series swatch, which the charts and the diagram’s legend both show', () => {
    expect(Object.keys(primary)).toEqual(expect.arrayContaining(['NeatSeriesSwatch']));
  });

  it('exports the series teal beside the other palette bases', () => {
    expect(Object.keys(primary)).toEqual(
      expect.arrayContaining(['NEAT_PRIMARY_BASE', 'NEAT_HIGHLIGHT_BASE', 'NEAT_SERIES_TEAL_BASE']),
    );
  });

  it('exports the viewport and the side panel state beside the page', () => {
    expect(Object.keys(primary)).toEqual(
      expect.arrayContaining(['NeatPage', 'NeatViewport', 'neatAsideOpen']),
    );
  });

  it("exports the page's side list, the primary entry's page navigation, and no page tabs", () => {
    expect(Object.keys(primary)).toContain('NeatPageNav');
    // Removed in 0.26.0: tabs are not navigation, so a page's sub-pages are its rail item's
    // `children` and more links than that its side list.
    expect(Object.keys(primary)).not.toContain('NeatPageTabs');
    expect(Object.keys(primary)).not.toContain('NeatPageTab');
  });

  it('exports the rail item beside the shell, for the app’s items at the bottom of the rail', () => {
    expect(Object.keys(primary)).toEqual(
      expect.arrayContaining(['NeatShell', 'NeatRailItem', 'NeatRailDivider']),
    );
  });

  it('exports the document titles and the stale look, which every app’s shell and pages need', () => {
    expect(Object.keys(primary)).toEqual(
      expect.arrayContaining(['provideNeatTitles', 'NeatStale']),
    );
  });

  it('exports the eased number, the theme’s colours as numbers and the stored signal', () => {
    expect(Object.keys(primary)).toEqual(
      expect.arrayContaining([
        'neatEased',
        'NeatEasedNumber',
        'neatResolveColor',
        'neatThemeColors',
        'neatStoredSignal',
      ]),
    );
  });

  it('keeps the colour probe, the eased clock and the storage behind them internal', () => {
    for (const name of ['colorProbe', 'easedBy', 'safeStorage']) {
      expect(name in primary, name).toBe(false);
    }
  });

  it('keeps the rail’s state and the shell’s slots internal', () => {
    for (const name of ['RailState', 'AsideToggleSlot', 'PageToolbarSlot']) {
      expect(name in primary, name).toBe(false);
    }
  });

  it('exports the breadcrumbs, which the file browser and the diagram share', () => {
    expect(Object.keys(primary)).toEqual(expect.arrayContaining(['NeatBreadcrumbs']));
  });

  it('exports the live dot, which every page that shows a running state needs', () => {
    expect(Object.keys(primary)).toEqual(expect.arrayContaining(['NeatLiveDot']));
  });

  it('shares its internals with the entries only under a ɵ prefix', () => {
    const shared = Object.keys(primary).filter((symbol) => symbol.startsWith('ɵ'));
    expect(shared.sort()).toEqual([
      'ɵCOLLAPSIBLE_CLASSES',
      'ɵFIELD_LABEL_CLASSES',
      'ɵINPUT_CLASSES',
      'ɵINPUT_HELM_CLASSES',
      'ɵIN_PAGE_TOOLBAR',
      'ɵOverlayFocus',
      'ɵPANEL_SURFACE_CLASSES',
      'ɵPOPOVER_HELM_CLASSES',
      'ɵSTALE_CLASSES',
      'ɵhlm',
      'ɵlistVariants',
      'ɵseriesToken',
      'ɵseriesTokenName',
    ]);
  });
});
