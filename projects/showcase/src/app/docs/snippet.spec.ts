import { ApplicationRef } from '@angular/core';
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

  it('shows the file exactly as written, its runs colored by kind', async () => {
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

  it('lists the files as tabs in their given order, which choosing another does not change', async () => {
    const { fixture, host, open } = await render([MAIN, DATA]);
    await open();
    const names = () =>
      Array.from(host.querySelectorAll('[role="tab"]'), (t) => t.textContent?.trim());

    expect(host.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Files');
    expect(names()).toEqual([MAIN.name, DATA.name]);

    (host.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(names()).toEqual([MAIN.name, DATA.name]);
  });

  it('keeps only Copy in the trigger row', async () => {
    const { host, open } = await render([MAIN, DATA]);
    await open();
    const row = host.querySelector('[data-slot="collapsible-row"]') as HTMLElement;

    expect(row.querySelector('[data-slot="collapsible-trigger"]')?.textContent?.trim()).toBe(
      'Code',
    );
    expect(
      Array.from(row.querySelectorAll('.files button'), (b) => b.getAttribute('aria-label')),
    ).toEqual(['Copy messaging-pipeline.example.ts']);
    expect(row.querySelector('.files code')).toBeNull();
  });

  it('shows the code of the chosen tab, and Copy copies that file', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { fixture, host, open } = await render([MAIN, DATA]);
    await open();

    (host.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(host.querySelector('[role="tabpanel"]:not([hidden]) pre')?.textContent).toBe(text(DATA));
    const copy = host.querySelector('app-copy-button button') as HTMLButtonElement;
    expect(copy.getAttribute('aria-label')).toBe('Copy pipeline-data.ts');
    copy.click();
    expect(writeText).toHaveBeenCalledWith(text(DATA));
    vi.unstubAllGlobals();
  });

  it('has no tab list for an example of one file', async () => {
    const { host, open } = await render([MAIN]);
    await open();

    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(host.querySelector('pre')?.textContent).toBe(text(MAIN));
  });

  it('names where the showcase classes are defined, only for a file that uses one', async () => {
    const LAYOUT: DocsExampleFile = {
      name: 'layout.example.ts',
      code: [['string', '`<div class="showcase-row"></div>`']],
    };
    const { host, open } = await render([LAYOUT, MAIN]);
    await open();

    expect(host.querySelector('[neatNote]')?.textContent).toContain(
      'projects/showcase/src/styles.css',
    );

    (host.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement).click();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(host.querySelector('[role="tabpanel"]:not([hidden]) pre')?.textContent).toBe(text(MAIN));
    expect(host.querySelector('[neatNote]')).toBeNull();
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
