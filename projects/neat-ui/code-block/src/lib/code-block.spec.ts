import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatCodeBlock } from './code-block';
import { resetWarned } from './highlighter';
import { provideNeatCodeLanguages } from './languages';

const CODE = '<neat-diagram [diagram]="set">\n  <ng-template neatDiagramBlock let-node>';

async function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(NeatCodeBlock);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/** Code the app colored itself, inside the element, as the docs' snippets do. */
@Component({
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-code-block [code]="code" copy="line">
      @for (run of runs; track $index) {
        <span [class]="run[0]">{{ run[1] }}</span>
      }
    </neat-code-block>
  `,
})
class Colored {
  readonly runs = [
    ['keyword', 'const'],
    ['text', ' url = '],
    ['string', "'rtsp://neat.local/src3'"],
  ] as const;
  readonly code = this.runs.map(([, text]) => text).join('');
}

/** A grammar module as `@shikijs/langs` gives one, in which `stage` is a keyword. */
function grammar(name: string) {
  return Promise.resolve({
    default: [
      {
        name,
        scopeName: `source.${name}`,
        patterns: [{ match: '\\bstage\\b', name: `keyword.other.${name}` }],
      },
    ],
  });
}

/** Blocks in a language of the app's, one of the component's own, and one of the kit's. */
@Component({
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideNeatCodeLanguages({ page: () => grammar('page') })],
  template: `
    <neat-code-block id="app" code="stage decode" language="app" />
    <neat-code-block id="page" code="stage decode" language="page" />
    <neat-code-block id="python" code="stage = print" language="python" />
  `,
})
class WithLanguages {}

const PYTHON = 'import pyneat\n\nsession = pyneat.Session()  # one per app\n';

describe('NeatCodeBlock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetWarned();
  });

  it('shows the code as written, its lines and indents kept, and wraps long lines', async () => {
    const host = await render({ code: CODE });
    const pre = host.querySelector('pre')!;

    expect(pre.textContent).toBe(CODE);
    expect(pre.getAttribute('data-overflow')).toBe('wrap');
  });

  it('scrolls long lines sideways when asked to', async () => {
    const host = await render({ code: CODE, overflow: 'scroll' });

    expect(host.querySelector('pre')?.getAttribute('data-overflow')).toBe('scroll');
  });

  it('has no Copy button until it is told what the code is', async () => {
    const host = await render({ code: CODE });

    expect(host.querySelector('neat-copy-button')).toBeNull();
  });

  it('copies its code with a button named after what the code is', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const host = await render({ code: 'npm install ./vendor/kit.tgz', copy: 'install command' });
    const button = host.querySelector('neat-copy-button button') as HTMLButtonElement;

    expect(button.getAttribute('aria-label')).toBe('Copy install command');
    button.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('npm install ./vendor/kit.tgz');
  });

  it("shows the app's own spans in place of the code, and copies the code", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const fixture = TestBed.createComponent(Colored);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const code = host.querySelector('pre > code')!;

    expect(code.textContent).toBe("const url = 'rtsp://neat.local/src3'");
    expect(Array.from(code.children, (span) => span.className)).toEqual([
      'keyword',
      'text',
      'string',
    ]);
    (host.querySelector('neat-copy-button button') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("const url = 'rtsp://neat.local/src3'");
  });

  it('colors the code in its language, each line an element and its text the code', async () => {
    const host = await render({ code: PYTHON, language: 'python' });
    const lines = host.querySelectorAll('pre > code > .line');

    expect(lines).toHaveLength(3);
    expect(host.querySelector('pre')!.textContent).toBe(PYTHON);
    expect(lines[0].querySelector('[data-kind="keyword"]')?.textContent).toBe('import');
    expect(lines[2].querySelector('[data-kind="comment"]')?.textContent).toBe('# one per app');
  });

  it('shows the code plain, in the same lines, while its grammar loads', async () => {
    const fixture = TestBed.createComponent(NeatCodeBlock);
    fixture.componentRef.setInput('code', PYTHON);
    fixture.componentRef.setInput('language', 'py');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.line')).toHaveLength(3);
    expect(host.querySelector('[data-kind]')).toBeNull();
    await fixture.whenStable();
    expect(host.querySelectorAll('.line')).toHaveLength(3);
    expect(host.querySelector('[data-kind]')).not.toBeNull();
  });

  it('shows a language it has no grammar for plain, and names it once in dev mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const first = await render({ code: 'fn main() {}', language: 'rust' });
    await render({ code: 'fn other() {}', language: 'rust' });

    expect(first.querySelector('pre')!.textContent).toBe('fn main() {}');
    expect(first.querySelector('[data-kind]')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('"rust"');
  });

  it('colors the languages provideNeatCodeLanguages adds, a component’s on top of the app’s', async () => {
    TestBed.configureTestingModule({
      providers: [provideNeatCodeLanguages({ app: () => grammar('app') })],
    });
    const fixture = TestBed.createComponent(WithLanguages);
    await fixture.whenStable();
    const blocks = (fixture.nativeElement as HTMLElement).querySelectorAll('neat-code-block');

    for (const block of Array.from(blocks).slice(0, 2)) {
      expect(block.querySelector('[data-kind="keyword"]')?.textContent, block.id).toBe('stage');
    }
    expect(blocks[2].querySelector('[data-kind="function"]')?.textContent).toBe('print');
  });

  it('numbers its lines only when asked, the gutter as wide as the last number', async () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join('\n');
    const plain = await render({ code: twelve });
    const numbered = await render({ code: twelve, lineNumbers: true });
    const pre = numbered.querySelector('pre') as HTMLElement;

    expect(plain.querySelector('pre')!.hasAttribute('data-line-numbers')).toBe(false);
    expect(pre.hasAttribute('data-line-numbers')).toBe(true);
    expect(pre.style.getPropertyValue('--line-number-digits')).toBe('2');
    expect(pre.textContent).toBe(twelve);
  });

  it('copies colored code as given', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const host = await render({ code: PYTHON, language: 'python', copy: 'example' });
    (host.querySelector('neat-copy-button button') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(PYTHON);
  });
});
