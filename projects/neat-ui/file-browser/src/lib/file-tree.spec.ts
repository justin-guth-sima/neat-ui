import {
  allFilePaths,
  breadcrumbs,
  childrenAt,
  childTowards,
  availableFilePaths,
  listFolder,
  nearestExistingFolder,
  type NeatFileNode,
  parentPath,
  playableCount,
  searchFolder,
} from './file-tree';

// These are the tree tests of the media browser the kit's was extracted from, with the kit's tree:
// a file the app cannot use is `unavailable` where the original said it was not `streamable`, a
// folder's count is computed here rather than sent by the server, and folder names carry no leading
// slash. The expectations are the original's. Its `streamableOnly` and `hidden` (which hid those
// files and counted them) live on as the listing's `unavailable` flags: the kit never hides, so an
// app that must not offer a file leaves it out of the tree and counts what it left out itself
// (the tests below read the flags the way that app would).
const file = (path: string, enabled = true): NeatFileNode => ({
  name: path.split('/').pop()!,
  path,
  type: 'file',
  ...(enabled ? {} : { unavailable: true }),
});
const folder = (path: string, children: NeatFileNode[]): NeatFileNode => ({
  name: path.split('/').pop()!,
  path,
  type: 'folder',
  children,
});

const tree: NeatFileNode[] = [
  folder('120FPS-720p-h264', [file('120FPS-720p-h264/drone.mp4')]),
  folder('30FPS', [
    folder('30FPS/indoor', [
      folder('30FPS/indoor/cam-a', [file('30FPS/indoor/cam-a/deep.mp4')]),
      file('30FPS/indoor/lobby.mp4'),
      file('30FPS/indoor/notes.txt', false),
    ]),
    file('30FPS/highway.mp4'),
  ]),
  folder('empty', []),
  file('readme.md', false),
  file('video.mp4'),
];

describe('childrenAt', () => {
  it('walks nested folders and reports a missing folder as null', () => {
    expect(childrenAt(tree, '')).toHaveLength(5);
    expect(childrenAt(tree, '30FPS/indoor/cam-a')).toHaveLength(1);
    expect(childrenAt(tree, '30FPS/missing')).toBeNull();
    expect(childrenAt(undefined, '')).toHaveLength(0);
  });

  it('does not take a file for a folder', () => {
    expect(childrenAt(tree, 'video.mp4')).toBeNull();
  });
});

describe('listFolder', () => {
  it('lists folders with counts, then every file, and keeps the files that cannot be used', () => {
    const root = listFolder(tree, '');
    expect(root.folders.map((f) => [f.name, f.count])).toEqual([
      ['120FPS-720p-h264', 1],
      ['30FPS', 3],
      ['empty', 0],
    ]);
    expect(root.files.map((f) => [f.name, f.path, f.unavailable ?? false])).toEqual([
      ['readme.md', 'readme.md', true],
      ['video.mp4', 'video.mp4', false],
    ]);
    const indoor = listFolder(tree, '30FPS/indoor');
    expect(indoor.folders.map((f) => f.path)).toEqual(['30FPS/indoor/cam-a']);
    expect(indoor.files.map((f) => [f.name, f.path, f.unavailable ?? false])).toEqual([
      ['lobby.mp4', '30FPS/indoor/lobby.mp4', false],
      ['notes.txt', '30FPS/indoor/notes.txt', true],
    ]);
    expect(listFolder(tree, 'nope')).toEqual({ folders: [], files: [] });
  });

  it('flags the files that cannot be used, so an app can offer only the others and count the rest', () => {
    const enabled = (files: readonly NeatFileNode[]) => files.filter((f) => !f.unavailable);
    const hidden = (files: readonly NeatFileNode[]) => files.length - enabled(files).length;

    const root = listFolder(tree, '');
    expect(enabled(root.files).map((f) => f.path)).toEqual(['video.mp4']);
    expect(hidden(root.files)).toBe(1);

    const indoor = listFolder(tree, '30FPS/indoor');
    expect(enabled(indoor.files).map((f) => f.name)).toEqual(['lobby.mp4']);
    expect(hidden(indoor.files)).toBe(1);

    expect(enabled([])).toEqual([]);
    expect(hidden(listFolder(tree, 'nope').files)).toBe(0);
  });

  it('sorts folders and files by name, ignoring case, whatever order the tree has', () => {
    const shuffled = [
      file('b.mp4'),
      folder('Zeta', []),
      file('B2.mp4'),
      folder('alpha', []),
      file('A.mp4'),
      folder('Beta', []),
    ];
    const listing = listFolder(shuffled, '');
    expect(listing.folders.map((f) => f.name)).toEqual(['alpha', 'Beta', 'Zeta']);
    expect(listing.files.map((f) => f.name)).toEqual(['A.mp4', 'b.mp4', 'B2.mp4']);
  });
});

describe('playableCount', () => {
  it('counts the usable files in a folder and all its subfolders, like a folder badge', () => {
    // The line under the breadcrumb and the folder badges count the same thing.
    expect(playableCount(tree, '')).toBe(5);
    expect(playableCount(tree, '30FPS')).toBe(3);
    expect(playableCount(tree, '30FPS/indoor')).toBe(2);
    expect(playableCount(tree, 'empty')).toBe(0);
    expect(playableCount(tree, 'nope')).toBe(0);
    const badges = Object.fromEntries(listFolder(tree, '').folders.map((f) => [f.path, f.count]));
    expect(badges['30FPS']).toBe(playableCount(tree, '30FPS'));
  });
});

describe('breadcrumbs', () => {
  it('start at the root and accumulate one segment per level', () => {
    expect(breadcrumbs('', 'Library')).toEqual([{ name: 'Library', path: '' }]);
    expect(breadcrumbs('30FPS/indoor/cam-a', 'Library').map((c) => c.path)).toEqual([
      '',
      '30FPS',
      '30FPS/indoor',
      '30FPS/indoor/cam-a',
    ]);
    expect(breadcrumbs('30FPS/indoor', 'Library').at(-1)!.name).toBe('indoor');
    expect(breadcrumbs('30FPS', 'Library')[0].name).toBe('Library');
  });
});

describe('childTowards', () => {
  it('names the folder just below an ancestor on the way to a descendant', () => {
    expect(childTowards('30FPS/indoor/cam-a', '')).toBe('30FPS');
    expect(childTowards('30FPS/indoor/cam-a', '30FPS')).toBe('30FPS/indoor');
    expect(childTowards('30FPS/indoor/cam-a', '30FPS/indoor')).toBe('30FPS/indoor/cam-a');
  });

  it('is null for the same folder, a folder that is not below, and a name that merely starts alike', () => {
    expect(childTowards('30FPS', '30FPS')).toBeNull();
    expect(childTowards('30FPS', '30FPS/indoor')).toBeNull();
    expect(childTowards('120FPS', '30FPS')).toBeNull();
    expect(childTowards('30FPS-old/x', '30FPS')).toBeNull();
    expect(childTowards('', '')).toBeNull();
  });
});

describe('parentPath', () => {
  it('goes up one level and stops at the root', () => {
    expect(parentPath('30FPS/indoor/cam-a')).toBe('30FPS/indoor');
    expect(parentPath('30FPS')).toBe('');
    expect(parentPath('')).toBe('');
  });
});

describe('searchFolder', () => {
  it('matches every file below the folder by their relative path', () => {
    expect(searchFolder(tree, '30FPS', 'deep').map((m) => [m.node.path, m.relative])).toEqual([
      ['30FPS/indoor/cam-a/deep.mp4', 'indoor/cam-a/deep.mp4'],
    ]);
    expect(searchFolder(tree, '30FPS', 'drone')).toEqual([]);
    expect(searchFolder(tree, '30FPS', 'CAM-A')).toHaveLength(1);
    expect(searchFolder(tree, '30FPS', 'notes').map((m) => [m.node.path, m.relative])).toEqual([
      ['30FPS/indoor/notes.txt', 'indoor/notes.txt'],
    ]);
    expect(searchFolder(tree, '30FPS', 'notes')[0].node.unavailable).toBe(true);
    expect(searchFolder(tree, '30FPS', '  ')).toEqual([]);
    expect(searchFolder(tree, '', 'mp4')).toHaveLength(5);
  });

  it('lists the matches by relative path, ignoring case', () => {
    expect(searchFolder(tree, '30FPS', 'mp4').map((m) => m.relative)).toEqual([
      'highway.mp4',
      'indoor/cam-a/deep.mp4',
      'indoor/lobby.mp4',
    ]);
  });
});

describe('allFilePaths', () => {
  it('flattens every file, usable or not, in tree order', () => {
    expect(allFilePaths(tree)).toEqual([
      '120FPS-720p-h264/drone.mp4',
      '30FPS/indoor/cam-a/deep.mp4',
      '30FPS/indoor/lobby.mp4',
      '30FPS/indoor/notes.txt',
      '30FPS/highway.mp4',
      'readme.md',
      'video.mp4',
    ]);
  });
});

describe('nearestExistingFolder', () => {
  it('falls back to the closest ancestor that still exists', () => {
    expect(nearestExistingFolder(tree, '30FPS/indoor/cam-a')).toBe('30FPS/indoor/cam-a');
    expect(nearestExistingFolder(tree, '30FPS/indoor/gone/deeper')).toBe('30FPS/indoor');
    expect(nearestExistingFolder(tree, 'vanished/x')).toBe('');
    expect(nearestExistingFolder(tree, '')).toBe('');
  });
});

describe('availableFilePaths', () => {
  it('flattens only the usable files in tree order', () => {
    expect(availableFilePaths(tree)).toEqual([
      '120FPS-720p-h264/drone.mp4',
      '30FPS/indoor/cam-a/deep.mp4',
      '30FPS/indoor/lobby.mp4',
      '30FPS/highway.mp4',
      'video.mp4',
    ]);
  });
});
