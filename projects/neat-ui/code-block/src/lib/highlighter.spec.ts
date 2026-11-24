import { highlighterFor, resetWarned } from './highlighter';
import { DEFAULT_CODE_LANGUAGES, type NeatCodeLanguages } from './languages';
import { plainLines, type CodeKind, type CodeLine } from './lines';

/** The kind of each run of `code` in `language`, by its text (the first run of that text). */
async function kinds(language: string, code: string): Promise<Map<string, CodeKind | null>> {
  const highlighter = await highlighterFor(language, DEFAULT_CODE_LANGUAGES);
  if (!highlighter) throw new Error(`no highlighter for ${language}`);
  const runs = highlighter.lines(code).flatMap((line) => line.runs);
  const byText = new Map<string, CodeKind | null>();
  for (const run of runs) if (!byText.has(run.text.trim())) byText.set(run.text.trim(), run.kind);
  return byText;
}

const textOf = (lines: readonly CodeLine[]) =>
  lines.map((line) => line.runs.map((run) => run.text).join('') + line.end).join('');

/** A grammar module as `@shikijs/langs` gives one: the language's grammar last. */
const demoGrammar = (name: string) => ({
  default: [
    {
      name,
      scopeName: `source.${name}`,
      patterns: [{ match: '\\bstage\\b', name: `keyword.other.${name}` }],
    },
  ],
});

describe('the code block highlighter', () => {
  afterEach(() => {
    resetWarned();
    vi.restoreAllMocks();
  });

  it('colors Python in the kit’s kinds', async () => {
    const python = await kinds(
      'python',
      'import pyneat\n\ndef run(path: str, frames: int = 4) -> None:\n    print(f"{path}", 0x1F, True)  # go\n',
    );

    expect(python.get('import')).toBe('keyword');
    expect(python.get('def')).toBe('keyword');
    expect(python.get('run')).toBe('function');
    expect(python.get('str')).toBe('type');
    expect(python.get('4')).toBe('constant');
    expect(python.get('0x1F')).toBe('constant');
    expect(python.get('None')).toBe('constant');
    expect(python.get('print')).toBe('function');
    expect(python.get('f"')).toBe('string');
    expect(python.get('# go')).toBe('comment');
    expect(python.get('=')).toBeNull();
  });

  it('colors C++ in the kit’s kinds', async () => {
    const cpp = await kinds(
      'cpp',
      '#include <neat/model.h>\nnamespace simaai {\nstd::vector<int> run(const Model& model) {\n  return model.outputs(); // go\n}\n}\n',
    );

    expect(cpp.get('#include')).toBe('keyword');
    expect(cpp.get('<neat/model.h>')).toBe('string');
    expect(cpp.get('namespace')).toBe('keyword');
    expect(cpp.get('simaai')).toBe('type');
    expect(cpp.get('vector')).toBe('type');
    expect(cpp.get('const')).toBe('keyword');
    expect(cpp.get('run')).toBe('function');
    expect(cpp.get('outputs')).toBe('function');
    expect(cpp.get('// go')).toBe('comment');
  });

  it('colors keys, tags and attributes', async () => {
    const yaml = await kinds('yaml', 'model: yolo # c\nbatch: 4\n');
    const json = await kinds('json', '{ "model": "yolo", "batch": 4 }');
    const html = await kinds('html', '<video class="tile" src="a.mp4"></video>');

    expect(yaml.get('model')).toBe('property');
    expect(yaml.get('yolo')).toBe('string');
    expect(yaml.get('4')).toBe('constant');
    expect(json.get('"model"')).toBe('property');
    expect(json.get('"yolo"')).toBe('string');
    expect(html.get('video')).toBe('tag');
    expect(html.get('class')).toBe('property');
    expect(html.get('"tile"')).toBe('string');
  });

  it('colors code inside a template literal as it would be outside, not as the string', async () => {
    const ts = await kinds('ts', 'const label = `${tile.name()} live`;');

    expect(ts.get('`')).toBe('string');
    expect([...ts].find(([text]) => text.includes('tile'))?.[1]).toBeNull();
    expect(ts.get('name')).toBe('function');
  });

  it('spells the code as given, every line and indent kept', async () => {
    const code = 'for f in *.mp4; do\n  echo "$f"\ndone\n';
    const highlighter = await highlighterFor('bash', DEFAULT_CODE_LANGUAGES);

    expect(textOf(highlighter!.lines(code))).toBe(code);
  });

  it('names each default grammar by its Shiki name and every alias, and nothing else', async () => {
    const names = new Map<NeatCodeLanguages[string], Set<string>>();
    for (const [name, load] of Object.entries(DEFAULT_CODE_LANGUAGES)) {
      names.set(load, (names.get(load) ?? new Set()).add(name));
    }
    for (const [load, listed] of names) {
      const registrations = (await load()).default as { name: string; aliases?: string[] }[];
      const own = registrations[registrations.length - 1];
      expect([...listed].sort(), own.name).toEqual([own.name, ...(own.aliases ?? [])].sort());
    }
  });

  it('colors a language from an app’s table by the grammar its module lists last', async () => {
    const languages: NeatCodeLanguages = {
      'pipeline-script': () => Promise.resolve(demoGrammar('pipeline')),
    };
    const highlighter = await highlighterFor('pipeline-script', languages);

    expect(highlighter!.lines('stage decode')[0].runs).toEqual([
      { text: 'stage', kind: 'keyword' },
      { text: ' decode', kind: null },
    ]);
  });

  it('leaves a language it has no grammar for plain, saying so once in dev mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await highlighterFor('klingon', DEFAULT_CODE_LANGUAGES)).toBeUndefined();
    expect(await highlighterFor('klingon', DEFAULT_CODE_LANGUAGES)).toBeUndefined();
    expect(await highlighterFor('constructor', DEFAULT_CODE_LANGUAGES)).toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toContain('no grammar for the language "klingon"');
  });

  it('leaves a language plain whose grammar did not load, and tries again for the next block', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const load = vi
      .fn<NeatCodeLanguages[string]>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValue(demoGrammar('retry'));

    expect(await highlighterFor('retry', { retry: load })).toBeUndefined();
    expect(warn.mock.calls[0][0]).toContain('the grammar of "retry" did not load');
    expect(await highlighterFor('retry', { retry: load })).toBeDefined();
  });

  it('shows code plain that its grammar fails on, saying so once in dev mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken = () =>
      Promise.resolve({
        default: [
          {
            name: 'broken',
            scopeName: 'source.broken',
            patterns: [{ match: '(?<', name: 'keyword.other.broken' }],
          },
        ],
      });
    const highlighter = await highlighterFor('broken', { broken });

    expect(highlighter!.lines('stage one\n')).toEqual(plainLines('stage one\n'));
    expect(highlighter!.lines('stage two')).toEqual(plainLines('stage two'));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('could not color code in "broken"');
  });
});
