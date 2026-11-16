import { NEAT_ICON_NAMES, type NeatIconGlyph, type NeatIconName } from '@sima/neat-ui';
import {
  buildIconIndex,
  ICON_INDEX,
  type KitIcon,
  type LucideGlyph,
  iconScore,
  pascalName,
  search,
  usageOf,
} from './icon-index';

/** A drawing of its own, so identity tells glyphs apart as Lucide's exports do. */
const drawing = (): NeatIconGlyph => [['path', { d: 'M0 0' }]];
const X = drawing();
const TRASH = drawing();
const FOLDER_OPEN = drawing();

const FIXTURE = buildIconIndex({
  drawings: { x: X, trash: TRASH, 'folder-open': FOLDER_OPEN },
  tags: {
    x: ['cancel', 'close', 'delete'],
    trash: ['delete', 'bin'],
    'folder-open': ['directory'],
  },
  aliases: { trash: ['Trash2'] },
  kitNames: ['close', 'media'] as NeatIconName[],
  glyphs: { close: 'x', media: 'folder-open' } as Record<NeatIconName, string>,
});
const glyph = (name: string) => FIXTURE.byId.get(`lucide:${name}`) as LucideGlyph;
const kit = (name: string) => FIXTURE.byId.get(`kit:${name}`) as KitIcon;
const names = (icons: readonly { name: string }[]) => icons.map((icon) => icon.name);

describe('the icon finder index', () => {
  it('names a glyph as its packages export it', () => {
    expect(pascalName('trash')).toBe('Trash');
    expect(pascalName('trash-2')).toBe('Trash2');
    expect(pascalName('folder-open')).toBe('FolderOpen');
  });

  it('lists each glyph once by the name it is exported by, with its aliases and tags', () => {
    expect(names(FIXTURE.lucide)).toEqual(['FolderOpen', 'Trash', 'X']);
    expect(glyph('Trash').aliases).toEqual(['Trash2']);
    expect(glyph('Trash').tags).toEqual(['delete', 'bin']);
    expect(FIXTURE.byId.has('lucide:Trash2')).toBe(false);
  });

  it('gives each kit name its glyph, and each glyph the kit names that draw it', () => {
    expect(names(FIXTURE.kit)).toEqual(['close', 'media']);
    expect(kit('close').glyph).toBe(glyph('X'));
    expect(glyph('X').kitNames).toEqual(['close']);
    expect(glyph('Trash').kitNames).toEqual([]);
  });

  it('matches a name before an alias or a tag, and every word of the query', () => {
    expect(iconScore(glyph('X'), 'x')).toBe(0);
    expect(iconScore(glyph('FolderOpen'), 'fold')).toBe(1);
    expect(iconScore(glyph('FolderOpen'), 'open')).toBe(2);
    expect(iconScore(glyph('FolderOpen'), 'folder open')).toBe(0);
    expect(iconScore(glyph('Trash'), 'trash2')).toBe(3);
    expect(iconScore(glyph('Trash'), 'bin')).toBe(3);
    expect(iconScore(glyph('Trash'), 'delete bin')).toBe(3);
    expect(iconScore(glyph('Trash'), 'delete folder')).toBeNull();
    expect(iconScore(glyph('Trash'), 'in')).toBeNull();
  });

  it('matches a kit name by its own words and by its glyph', () => {
    expect(iconScore(kit('close'), 'close')).toBe(0);
    expect(iconScore(kit('close'), 'x')).toBe(2);
    expect(iconScore(kit('close'), 'delete')).toBe(3);
    expect(iconScore(kit('media'), 'directory')).toBe(3);
  });

  it('keeps the matches best first and otherwise in order, and all for an empty query', () => {
    expect(names(search(FIXTURE.lucide, 'delete'))).toEqual(['Trash', 'X']);
    expect(names(search(FIXTURE.lucide, 'x'))).toEqual(['X']);
    expect(search(FIXTURE.lucide, '  ')).toBe(FIXTURE.lucide);
  });

  it('shows a kit name in a template, and a glyph imported from the lucide entry', () => {
    expect(usageOf(kit('close'))).toBe('<neat-icon name="close" />');
    const usage = usageOf(glyph('Trash'));
    expect(usage).toContain("import { Trash } from '@sima/neat-ui/lucide';");
    expect(usage).toContain('protected readonly Trash = Trash;');
    expect(usage).toContain('<neat-icon [name]="Trash" />');
  });

  describe('built from the kit and Lucide', () => {
    it('has every kit name, and every glyph Lucide tags once', () => {
      expect(names(ICON_INDEX.kit)).toEqual([...NEAT_ICON_NAMES]);
      expect(ICON_INDEX.lucide.length).toBeGreaterThan(1800);
      const ids = new Set(ICON_INDEX.lucide.map((icon) => icon.id));
      expect(ids.size).toBe(ICON_INDEX.lucide.length);
    });

    it('finds the kit name for a meaning first', () => {
      expect(names(search(ICON_INDEX.kit, 'delete'))).toEqual(['close']);
      expect(names(search(ICON_INDEX.lucide, 'trash')).slice(0, 2)).toEqual(['Trash', 'TrashOff']);
      const square = ICON_INDEX.byId.get('lucide:Square') as LucideGlyph;
      expect(square.kitNames).toEqual(['aspect-square', 'stop']);
    });
  });
});
