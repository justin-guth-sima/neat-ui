// Specs are not packaged, so unlike the entries' own code they may reach across the boundary by a
// relative path: they need every entry's public API in one place.
import * as confirm from '../confirm/src/public-api';
import * as input from '../input/src/public-api';
import * as lineList from '../line-list/src/public-api';
import * as numberField from '../number-field/src/public-api';
import * as popover from '../popover/src/public-api';
import * as segmented from '../segmented/src/public-api';
import * as slider from '../slider/src/public-api';
import * as switchEntry from '../switch/src/public-api';
import * as tabs from '../tabs/src/public-api';
import * as video from '../video/src/public-api';
import * as primary from './public-api';

const ENTRIES = {
  confirm,
  input,
  lineList,
  numberField,
  popover,
  segmented,
  slider,
  switchEntry,
  tabs,
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

  it('shares its internals with the entries only under a ɵ prefix', () => {
    const shared = Object.keys(primary).filter((symbol) => symbol.startsWith('ɵ'));
    expect(shared.sort()).toEqual(['ɵIN_PAGE_TOOLBAR', 'ɵhlm', 'ɵlistVariants', 'ɵtoggleVariants']);
  });
});
