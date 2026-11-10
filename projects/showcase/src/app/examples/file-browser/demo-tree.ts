import type { NeatFileNode } from '@sima/neat-ui/file-browser';

const file = (path: string, extra: Partial<NeatFileNode> = {}): NeatFileNode => ({
  name: path.split('/').pop()!,
  path,
  type: 'file',
  ...extra,
});
const folder = (path: string, children: NeatFileNode[]): NeatFileNode => ({
  name: path.split('/').pop()!,
  path,
  type: 'folder',
  children,
});
const unsupported = { unavailable: true, tag: 'NOT SUPPORTED' };

/** A folder with a thousand files, to see the list scroll and stay quick. */
const ARCHIVE_SIZE = 1000;
const archive = Array.from({ length: ARCHIVE_SIZE }, (_, index) =>
  file(`clips/archive/take-${String(index + 1).padStart(4, '0')}.mp4`),
);

/** A made-up media tree: nested folders, a thousand files in one, and files the app cannot use. */
export const DEMO_TREE: readonly NeatFileNode[] = [
  folder('clips', [
    folder('clips/indoor', [
      folder('clips/indoor/lobby', [file('clips/indoor/lobby/entrance.mp4')]),
      file('clips/indoor/warehouse.mp4'),
      file('clips/indoor/notes.txt', unsupported),
    ]),
    folder('clips/outdoor', [file('clips/outdoor/highway.mp4'), file('clips/outdoor/Harbor.mkv')]),
    folder('clips/archive', archive),
    folder('clips/empty', []),
    file('clips/overview.mp4'),
  ]),
  folder('Reference', [file('Reference/checkerboard.png'), file('Reference/calibration.avi')]),
  file('readme.md', unsupported),
  file('demo.mp4'),
];

/** A stable made-up size for the demo's size column. */
export function demoSize(path: string): string {
  let hash = 0;
  for (const char of path) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return `${(hash / 100 + 1).toFixed(1)} MB`;
}
