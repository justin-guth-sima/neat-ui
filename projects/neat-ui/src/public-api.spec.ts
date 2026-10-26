// Specs are not packaged, but the rest of the direction rule holds for them (AGENTS.md). This one
// reaches across by relative path because it compares the primary with every entry. The list of
// entries is written out: a spec is bundled statically, so it cannot import by a name found on disk
// (`check-dist.test.mjs` compares the entry folders with its own table).
import * as callout from '../callout/src/public-api';
import * as charts from '../charts/src/public-api';
import * as collapsible from '../collapsible/src/public-api';
import * as confirm from '../confirm/src/public-api';
import * as details from '../details/src/public-api';
import * as dialog from '../dialog/src/public-api';
import * as dropZone from '../drop-zone/src/public-api';
import * as field from '../field/src/public-api';
import * as fileBrowser from '../file-browser/src/public-api';
import * as input from '../input/src/public-api';
import * as levelMeter from '../level-meter/src/public-api';
import * as lineList from '../line-list/src/public-api';
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
  dialog,
  dropZone,
  field,
  fileBrowser,
  input,
  levelMeter,
  lineList,
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
    for (const [name, entry] of Object.entries(ENTRIES)) {
      const exported = Object.keys(entry);
      expect(exported.length, `${name} exports something`).toBeGreaterThan(0);
      expect(
        exported.filter((symbol) => symbol in primary),
        `${name} symbols also exported by the primary`,
      ).toEqual([]);
    }
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

  it('exports the live dot, which every page that shows a running state needs', () => {
    expect(Object.keys(primary)).toEqual(expect.arrayContaining(['NeatLiveDot']));
  });

  it('shares its internals with the entries only under a ɵ prefix', () => {
    const shared = Object.keys(primary).filter((symbol) => symbol.startsWith('ɵ'));
    expect(shared.sort()).toEqual([
      'ɵFIELD_LABEL_CLASSES',
      'ɵIN_PAGE_TOOLBAR',
      'ɵhlm',
      'ɵlistVariants',
    ]);
  });
});
