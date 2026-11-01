import { TestBed } from '@angular/core/testing';
import type { DocsExampleFile } from './model';
import { Snippet } from './snippet';

const MAIN: DocsExampleFile = {
  name: 'messaging-pipeline.example.ts',
  code: [
    ['keyword', 'import'],
    ['text', ' { PIPELINE } '],
    ['keyword', 'from'],
    ['text', ' '],
    ['string', "'./pipeline-data'"],
    ['text', ';\n\n'],
    ['comment', '// The figure line.'],
    ['text', '\n  '],
    ['string', '`\n    <neat-diagram />\n  `'],
    ['text', '\n'],
  ],
};
const DATA: DocsExampleFile = {
  name: 'pipeline-data.ts',
  code: [
    ['keyword', 'export const'],
    ['text', ' PIPELINE = {};\n'],
  ],
};
const text = (file: DocsExampleFile): string => file.code.map(([, run]) => run).join('');

async function render(files: readonly DocsExampleFile[]) {
  const fixture = TestBed.createComponent(Snippet);
  fixture.componentRef.setInput('files', files);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const open = async (): Promise<void> => {
    (host.querySelector('[data-slot="collapsible-trigger"]') as HTMLButtonElement).click();
    await fixture.whenStable();
  };
  return { fixture, host, open };
}

describe('Snippet', () => {
  it('starts closed, naming the file, and renders no code until opened', async () => {
    const { host } = await render([MAIN]);
    const trigger = host.querySelector('[data-slot="collapsible-trigger"]') as HTMLElement;

    expect(trigger.textContent).toContain('Code');
    expect(trigger.textContent).toContain('messaging-pipeline.example.ts');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('pre')).toBeNull();
  });

  it('shows the file exactly as written, its runs coloured by kind', async () => {
    const { host, open } = await render([MAIN]);
    await open();

    expect(host.querySelector('pre')?.textContent).toBe(text(MAIN));
    expect(Array.from(host.querySelectorAll('pre .keyword'), (s) => s.textContent)).toEqual([
      'import',
      'from',
    ]);
    expect(host.querySelectorAll('pre .string')).toHaveLength(2);
    expect(host.querySelector('pre .comment')?.textContent).toBe('// The figure line.');
    expect(host.querySelector('neat-segmented')).toBeNull();
    expect(host.textContent).toContain('messaging-pipeline.example.ts');
  });

  it('shows one file at a time, the example first, the files it imports on choice', async () => {
    const { fixture, host, open } = await render([MAIN, DATA]);
    await open();

    const files = Array.from(host.querySelectorAll<HTMLElement>('[role="radio"]'));
    expect(host.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('File');
    expect(files.map((file) => file.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(host.querySelector('pre')?.textContent).toBe(text(MAIN));

    files[1].click();
    await fixture.whenStable();

    expect(host.querySelector('pre')?.textContent).toBe(text(DATA));
    expect(host.querySelector('app-copy-button button')?.getAttribute('aria-label')).toBe(
      'Copy pipeline-data.ts',
    );
  });

  it("copies the shown file's text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { host, open } = await render([MAIN, DATA]);
    await open();

    const copy = host.querySelector('app-copy-button button');
    expect(copy?.getAttribute('aria-label')).toBe('Copy messaging-pipeline.example.ts');
    (copy as HTMLButtonElement).click();

    expect(writeText).toHaveBeenCalledWith(text(MAIN));
    vi.unstubAllGlobals();
  });
});
