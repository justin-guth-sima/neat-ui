import { TestBed } from '@angular/core/testing';
import { InstallCommand } from './1-install-command.example';
import { WholeFile } from './2-whole-file.example';
import { PythonFile } from './3-python-file.example';
import { LineNumbers } from './4-line-numbers.example';
import { AnotherLanguage } from './5-another-language.example';
import { MarksOnAPipeline } from './6-marks-on-a-pipeline.example';
import { StepByStep } from './7-step-by-step.example';
import { StepsInABubble } from './8-steps-in-a-bubble.example';
import { MarksOnPlainCode } from './9-marks-on-plain-code.example';
import { NotesOnHover } from './10-notes-on-hover.example';
import { ColoredByTheApp } from './11-colored-by-the-app.example';
import { StreamURL } from './12-stream-url.example';

async function render<T>(component: new () => T): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const marked = (host: HTMLElement) => ({
  lines: Array.from(host.querySelectorAll('.line[data-marked]'), (line) => line.textContent),
  parts: Array.from(host.querySelectorAll('mark[data-on]:not([data-line])'), (m) => m.textContent),
});

const bubble = () => document.querySelector('.cdk-overlay-container .bubble');

const copyName = (host: HTMLElement) =>
  host.querySelector('neat-copy-button button')?.getAttribute('aria-label');

describe('the code block examples', () => {
  it('show a command that wraps, with its Copy button', async () => {
    const host = await render(InstallCommand);

    expect(host.querySelector('pre')?.textContent).toBe(
      'npm install ./vendor/sima-neat-ui-<version>.tgz',
    );
    expect(host.querySelector('pre')?.getAttribute('data-overflow')).toBe('wrap');
    expect(copyName(host)).toBe('Copy install command');
  });

  it('show a whole file that scrolls, its lines kept', async () => {
    const host = await render(WholeFile);
    const pre = host.querySelector('pre')!;

    expect(pre.getAttribute('data-overflow')).toBe('scroll');
    expect(pre.textContent).toContain("from './app.routes';\n\nexport const appConfig");
    expect(pre.textContent).toContain('\n  providers: [');
    expect(copyName(host)).toBe('Copy app.config.ts');
  });

  it('show a Python file in the code colors, spelled as given', async () => {
    const host = await render(PythonFile);
    const pre = host.querySelector('pre')!;

    expect(pre.textContent?.startsWith('"""Run a ResNet-50 model')).toBe(true);
    expect(pre.textContent?.endsWith('to_numpy()))}")\n')).toBe(true);
    expect(pre.querySelector('[data-kind="keyword"]')?.textContent).toBe('from');
    expect(pre.querySelector('[data-kind="comment"]')?.textContent).toBe('# a gray test frame');
    expect(copyName(host)).toBe('Copy run_model.py');
  });

  it('show a C++ file with its lines numbered', async () => {
    const host = await render(LineNumbers);
    const pre = host.querySelector('pre')!;

    expect(pre.hasAttribute('data-line-numbers')).toBe(true);
    expect(pre.querySelectorAll('.line')).toHaveLength(26);
    expect(pre.querySelector('[data-kind="keyword"]')?.textContent).toBe('#include');
    expect(copyName(host)).toBe('Copy run_model.cpp');
  });

  it('show a diff, a language the example adds, its lines inserted and deleted', async () => {
    const host = await render(AnotherLanguage);

    expect(host.querySelector('[data-kind="tag"]')?.textContent).toContain('-outputs');
    expect(host.querySelector('[data-kind="string"]')?.textContent).toContain('+outputs');
  });

  it('mark the lines that compose a C++ pipeline and the calls that build and run it', async () => {
    const host = await render(MarksOnAPipeline);
    const { lines, parts } = marked(host);

    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('  simaai::neat::Graph graph;\n');
    expect(parts).toEqual(['graph.build', 'run.pull']);
    expect(host.querySelector('pre')?.hasAttribute('data-dim')).toBe(true);
  });

  it('walk through a Python example, the note beside it following the step', async () => {
    const fixture = TestBed.createComponent(StepByStep);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const next = host.querySelectorAll('.steps button')[1] as HTMLButtonElement;

    expect(marked(host).lines).toHaveLength(5);
    expect(host.querySelector('.note .label')?.textContent).toBe('Describe the input');
    next.click();
    next.click();
    await fixture.whenStable();

    expect(marked(host).parts).toEqual(['Tensor.from_numpy', 'graph.build']);
    expect(host.querySelector('.note .label')?.textContent).toBe('Build the pipeline');
    expect(host.querySelector('.steps .position')?.textContent).toBe('3 of 4');
  });

  it("show each step's note in a bubble, which follows the step", async () => {
    const fixture = TestBed.createComponent(StepsInABubble);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(bubble()?.textContent).toContain('Describe the input');
    (host.querySelectorAll('.steps button')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(bubble()?.textContent).toContain('Compose the graph');
    fixture.destroy();
  });

  it('mark plain code, a repeated word by its columns', async () => {
    const host = await render(MarksOnPlainCode);

    expect(marked(host)).toEqual({
      lines: ['frame=3 rtsp_timeout\n'],
      parts: ['rtsp', '--frames 4'],
    });
    const rtsp = host.querySelector('mark[data-on]')!;
    const before = document.createRange();
    before.setStart(rtsp.closest('.line')!, 0);
    before.setEndBefore(rtsp);
    expect(before.toString()).toMatch(/ --url $/);
  });

  it("show a mark's note while it is hovered or focused", async () => {
    const fixture = TestBed.createComponent(NotesOnHover);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(bubble()).toBeNull();
    host
      .querySelector('mark[data-mark="1"]')!
      .dispatchEvent(new PointerEvent('pointerover', { pointerType: 'mouse', bubbles: true }));
    await fixture.whenStable();
    expect(bubble()?.textContent).toBe('The program stops after four frames.');

    host.querySelector<HTMLElement>('.line[data-mark="2"] mark[tabindex]')!.focus();
    await fixture.whenStable();
    expect(bubble()?.textContent).toContain('The fourth frame did not come in time');
    fixture.destroy();
  });

  it("show the app's colored spans, which spell the code", async () => {
    const host = await render(ColoredByTheApp);
    const code = host.querySelector('pre > code')!;

    expect(code.textContent).toBe("const source = 'rtsp://neat.local:8554/src3';");
    expect(code.querySelectorAll('.keyword, .string')).toHaveLength(2);
  });

  it('put a Copy button beside a URL in running text', async () => {
    const host = await render(StreamURL);

    expect(host.querySelector('code')?.textContent).toBe('rtsp://neat.local:8554/src3');
    expect(copyName(host)).toBe('Copy stream URL');
  });
});
