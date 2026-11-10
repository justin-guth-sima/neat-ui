import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  DEFAULTS,
  budgetWarnings,
  fileFor,
  parseArgs,
  pictureFrame,
  picturePath,
  serve,
  stalePictures,
  topicsToCapture,
} from './docs-capture.mjs';

describe('parseArgs', () => {
  it('takes the defaults without arguments', () => {
    const options = parseArgs([]);
    assert.equal(options.out, DEFAULTS.out);
    assert.equal(options.topics, null);
    assert.equal(options.help, false);
  });

  it('reads the topics, the folders, the channel and the settle time', () => {
    const options = parseArgs([
      '--topic',
      'button,bev',
      '--out',
      'x',
      '--dist',
      'y',
      '--channel',
      'chromium',
      '--settle',
      '0',
    ]);
    assert.deepEqual(options.topics, ['button', 'bev']);
    assert.equal(options.out, 'x');
    assert.equal(options.dist, 'y');
    assert.equal(options.channel, 'chromium');
    assert.equal(options.settleMs, 0);
  });

  it('refuses an unknown option, a missing value and a settle time that is no number', () => {
    assert.throws(() => parseArgs(['--nope']), /unknown option --nope/);
    assert.throws(() => parseArgs(['--out']), /--out needs a value/);
    assert.throws(() => parseArgs(['--out', '--topic', 'a']), /--out needs a value/);
    assert.throws(() => parseArgs(['--settle', 'soon']), /--settle takes a number/);
  });
});

describe('topicsToCapture', () => {
  const load = async () => ({ entries: [], examples: [] });
  const groups = [
    {
      id: 'theme',
      topics: [
        { id: 'tokens', page: class {} },
        { id: 'icons', load },
      ],
    },
    { id: 'components', categories: [{ id: 'actions', topics: [{ id: 'button', load }] }] },
  ];
  // As the showcase places them: a group's own topics, or its categories' topics.
  const placed = (group) =>
    group.topics
      ? group.topics.map((topic) => ({ topic, path: `/${group.id}/${topic.id}` }))
      : group.categories.flatMap((category) =>
          category.topics.map((topic) => ({
            topic,
            path: `/${group.id}/${category.id}/${topic.id}`,
          })),
        );

  it('lists every topic with examples at its address, leaving hand-made pages out', () => {
    assert.deepEqual(topicsToCapture(groups, placed), [
      { id: 'icons', path: '/theme/icons' },
      { id: 'button', path: '/components/actions/button' },
    ]);
  });

  it('keeps only the topics asked for, and refuses one that has no examples', () => {
    assert.deepEqual(topicsToCapture(groups, placed, ['button']), [
      { id: 'button', path: '/components/actions/button' },
    ]);
    assert.throws(() => topicsToCapture(groups, placed, ['tokens', 'nope']), /tokens, nope/);
  });

  it('reads the showcase’s own topics and routes', async () => {
    const [{ GROUPS }, { placedTopics }] = await Promise.all([
      import('../projects/showcase/src/app/docs/topics.ts'),
      import('../projects/showcase/src/app/docs/docs-routes.ts'),
    ]);
    const topics = topicsToCapture(GROUPS, placedTopics);
    assert.ok(topics.some(({ path }) => path === '/components/actions/button'));
    assert.ok(!topics.some(({ id }) => id === 'tokens'), 'the tokens page has no examples');
  });
});

describe('budgetWarnings', () => {
  const budget = { pictureBytes: 100, totalBytes: 250 };

  it('says nothing within the budget', () => {
    assert.deepEqual(budgetWarnings([{ path: 'a', bytes: 100 }], budget), []);
  });

  it('names each picture over it, biggest first, then the total', () => {
    const warnings = budgetWarnings(
      [
        { path: 'a', bytes: 2048 },
        { path: 'b', bytes: 50 },
        { path: 'c', bytes: 4096 },
      ],
      budget,
    );
    assert.equal(warnings.length, 3);
    assert.match(warnings[0], /^c is 4 kB/);
    assert.match(warnings[1], /^a is 2 kB/);
    assert.match(warnings[2], /6 kB in all/);
  });
});

describe('pictureFrame', () => {
  const viewport = { width: 1000, height: 800 };
  const area = { x: 100, y: 200, width: 400, height: 100, radius: 8 };
  const frame = (surfaces, modal = false, at = area) =>
    pictureFrame({ area: at, surfaces, modal, viewport });

  it('takes the area alone when nothing opened', () => {
    assert.deepEqual(frame([]), {
      clip: { x: 100, y: 200, width: 400, height: 100 },
      shapes: [{ x: 0, y: 0, width: 400, height: 100, radius: 8 }],
    });
  });

  it('takes the area with a panel that opens beside it, drawing only the two', () => {
    const panel = { x: 40, y: 304, width: 200, height: 150, radius: 6 };
    assert.deepEqual(frame([panel]), {
      clip: { x: 40, y: 200, width: 460, height: 254 },
      shapes: [
        { x: 60, y: 0, width: 400, height: 100, radius: 8 },
        { x: 0, y: 104, width: 200, height: 150, radius: 6 },
      ],
    });
  });

  it('takes a modal, or what opened away from the area, alone', () => {
    const dialog = { x: 300, y: 250, width: 400, height: 300, radius: 12 };
    assert.deepEqual(frame([dialog], true), {
      clip: { x: 300, y: 250, width: 400, height: 300 },
      shapes: [{ x: 0, y: 0, width: 400, height: 300, radius: 12 }],
    });
    const toasts = [
      { x: 700, y: 600, width: 280, height: 60, radius: 6 },
      { x: 700, y: 670, width: 280, height: 110, radius: 6 },
    ];
    assert.deepEqual(frame(toasts), {
      clip: { x: 700, y: 600, width: 280, height: 180 },
      shapes: [
        { x: 0, y: 0, width: 280, height: 60, radius: 6 },
        { x: 0, y: 70, width: 280, height: 110, radius: 6 },
      ],
    });
  });

  it('keeps the clip inside the viewport, on whole pixels', () => {
    const tall = { x: -0.5, y: 700.4, width: 400.2, height: 300, radius: 0 };
    assert.deepEqual(frame([], false, tall).clip, { x: 0, y: 700, width: 400, height: 100 });
  });
});

describe('picturePath and stalePictures', () => {
  it('puts a picture under its topic, named by its example and scheme', () => {
    assert.equal(picturePath('bev', 'round', 'dark'), 'bev/round.dark.webp');
  });

  it('lists the pictures no example made, and nothing that is not a picture', () => {
    const existing = ['bev/round.dark.webp', 'bev/gone.light.webp', 'README.md', 'a/b.webp'];
    assert.deepEqual(stalePictures(existing, ['bev/round.dark.webp']), [
      'a/b.webp',
      'bev/gone.light.webp',
    ]);
  });
});

describe('fileFor', () => {
  const root = '/srv/app';

  it('serves a file by its path and an address without an extension as the app', () => {
    assert.equal(fileFor(root, '/main-ABC.js'), '/srv/app/main-ABC.js');
    assert.equal(fileFor(root, '/media/font.woff2?v=1'), '/srv/app/media/font.woff2');
    assert.equal(fileFor(root, '/components/actions/button'), '/srv/app/index.html');
    assert.equal(fileFor(root, '/'), '/srv/app/index.html');
  });

  it('refuses a path that leaves the folder, and one it cannot decode', () => {
    assert.equal(fileFor(root, '/../etc/passwd.txt'), null);
    assert.equal(fileFor(root, '/%2e%2e/secret.js'), null);
    assert.equal(fileFor(root, '/%E0%A4%A.js'), null);
  });
});

describe('serve', () => {
  it('serves the app’s files and its index for a route, and nothing else', async () => {
    const root = await mkdtemp(join(tmpdir(), 'docs-capture-'));
    try {
      await mkdir(join(root, 'media'));
      await writeFile(join(root, 'index.html'), '<app-root></app-root>');
      await writeFile(join(root, 'media', 'main.js'), 'run()');
      const server = await serve(root);
      try {
        const get = (path) => fetch(`${server.url}${path}`);
        const route = await get('/components/actions/button');
        assert.equal(route.status, 200);
        assert.equal(await route.text(), '<app-root></app-root>');
        const script = await get('/media/main.js');
        assert.equal(script.headers.get('content-type'), 'text/javascript; charset=utf-8');
        assert.equal(await script.text(), 'run()');
        assert.equal((await get('/missing.js')).status, 404);
        assert.equal((await get('/media')).status, 200, 'a folder name is a route');
      } finally {
        await server.close();
      }
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
