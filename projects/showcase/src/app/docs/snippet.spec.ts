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
  });

  it("names the file, the other files and Copy in the trigger's row", async () => {
    const { host, open } = await render([MAIN, DATA]);
    await open();
    const row = host.querySelector('[data-slot="collapsible-row"]') as HTMLElement;
    const trigger = row.querySelector('[data-slot="collapsible-trigger"]') as HTMLElement;

    expect(trigger.textContent?.trim()).toBe('Code');
    expect(row.querySelector('.files code')?.textContent).toBe('messaging-pipeline.example.ts');
    expect(
      Array.from(row.querySelectorAll('.files button'), (b) => b.getAttribute('aria-label')),
    ).toEqual(['Show pipeline-data.ts', 'Copy messaging-pipeline.example.ts']);
    expect(host.querySelector('[data-slot="collapsible-content"] .files')).toBeNull();
  });

  it('offers no other file for an example of one file', async () => {
    const { host, open } = await render([MAIN]);
    await open();

    expect(host.querySelectorAll('.files button')).toHaveLength(1);
  });

  it('shows another file on its button, which stays focused as the files swap', async () => {
    const { fixture, host, open } = await render([MAIN, DATA]);
    document.body.append(host);
    await open();
    const other = host.querySelector('.files button') as HTMLButtonElement;
    other.focus();

    other.click();
    await fixture.whenStable();

    expect(host.querySelector('pre')?.textContent).toBe(text(DATA));
    expect(host.querySelector('.files code')?.textContent).toBe('pipeline-data.ts');
    expect(document.activeElement).toBe(other);
    expect(other.getAttribute('aria-label')).toBe('Show messaging-pipeline.example.ts');
    host.remove();
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
