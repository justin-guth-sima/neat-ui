import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatCodeBlock } from './code-block';
import { highlighterFor, resetWarned } from './highlighter';
import { DEFAULT_CODE_LANGUAGES, provideNeatCodeLanguages } from './languages';
import type { NeatCodeMark, NeatCodeStep } from './marks';
import { FakeIntersectionObserver } from './near-view.testing';
import { NeatCodeNote } from './note';
import { nextTurn } from './turns';

const CODE = '<neat-diagram [diagram]="set">\n  <ng-template neatDiagramBlock let-node>';

async function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(NeatCodeBlock);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/** Code the app colored itself, inside the element, as the docs' snippets do, with a mark. */
@Component({
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-code-block [code]="code" copy="line" [marks]="[{ line: 1, text: 'url' }]">
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

const WALK: readonly NeatCodeStep[] = [
  { marks: [{ line: 1 }], label: 'Import pyneat' },
  { marks: [{ line: 3, text: 'pyneat.Session()' }], label: 'Open a session' },
  { marks: [{ line: 3, text: '# one per app' }] },
];

/** A block with steps whose step the page binds, as an app shows a note beside it. */
@Component({
  imports: [NeatCodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-code-block [code]="code" [steps]="steps" [(step)]="at" stepControls />
    <p>{{ at() }}</p>
  `,
})
class Walk {
  readonly code = PYTHON;
  readonly steps = WALK;
  readonly at = signal(0);
}

/** Steps with their notes in the block's bubble. */
@Component({
  imports: [NeatCodeBlock, NeatCodeNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-code-block [code]="code" [steps]="steps" [(step)]="at">
      <ng-template [neatCodeNote]="steps" let-step let-index="index"
        >{{ index + 1 }}. {{ step.note }}</ng-template
      >
    </neat-code-block>
  `,
})
class NotedWalk {
  readonly code = PYTHON;
  readonly steps: readonly (NeatCodeStep & { readonly note: string })[] = [
    { marks: [{ line: 1 }], note: 'The module' },
    { marks: [], note: 'All of it' },
    { marks: [{ line: 3, text: 'pyneat.Session()' }], note: 'One session' },
  ];
  readonly at = signal(0);
}

type NotedMark = NeatCodeMark & { readonly note: string };

/** Marks whose notes show on hover, focus or a tap. */
@Component({
  imports: [NeatCodeBlock, NeatCodeNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-code-block [code]="code" [marks]="marks">
      <ng-template [neatCodeNote]="marks" let-mark>{{ mark.note }}</ng-template>
    </neat-code-block>
    <button type="button">Elsewhere</button>
  `,
})
class NotedMarks {
  readonly code = PYTHON;
  readonly marks: readonly NotedMark[] = [
    { lines: [1, 2], note: 'The import' },
    { line: 3, text: 'pyneat.Session()', note: 'A session' },
  ];
}

const shown = (host: HTMLElement) =>
  Array.from(host.querySelectorAll('mark[data-on]:not([data-line])'), (mark) => mark.textContent);
const press = (element: Element, key: string) =>
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

describe('NeatCodeBlock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetWarned();
    FakeIntersectionObserver.last = undefined;
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

  it('colors its code only once it comes near the view, and stays colored', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const fixture = TestBed.createComponent(NeatCodeBlock);
    fixture.componentRef.setInput('code', PYTHON);
    fixture.componentRef.setInput('language', 'python');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const observer = FakeIntersectionObserver.last!;

    expect(observer.watched).toEqual([host]);
    expect(host.querySelectorAll('.line')).toHaveLength(3);
    expect(host.querySelector('[data-kind]')).toBeNull();
    observer.report(false);
    await fixture.whenStable();
    expect(host.querySelector('[data-kind]')).toBeNull();

    observer.report(true);
    await fixture.whenStable();
    expect(host.querySelector('[data-kind="keyword"]')?.textContent).toBe('import');
    expect(observer.disconnected).toBe(true);
  });

  it('stops watching for the view when it goes', async () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const fixture = TestBed.createComponent(NeatCodeBlock);
    fixture.componentRef.setInput('code', PYTHON);
    await fixture.whenStable();
    const observer = FakeIntersectionObserver.last!;

    expect(observer.watched).toEqual([fixture.nativeElement]);
    expect(observer.disconnected).toBe(false);
    fixture.destroy();
    expect(observer.disconnected).toBe(true);
  });

  /** A Python block held back from the view, and a spy on the highlighter it colors with. */
  async function heldBack() {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    const highlighter = (await highlighterFor('python', DEFAULT_CODE_LANGUAGES))!;
    const lines = vi.spyOn(highlighter, 'lines');
    const fixture = TestBed.createComponent(NeatCodeBlock);
    fixture.componentRef.setInput('code', PYTHON);
    fixture.componentRef.setInput('language', 'python');
    await fixture.whenStable();
    return { fixture, lines, observer: FakeIntersectionObserver.last! };
  }

  it('colors only the latest code when the code changes before its turn comes', async () => {
    const { fixture, lines, observer } = await heldBack();
    observer.report(true);
    fixture.detectChanges();
    fixture.componentRef.setInput('code', 'print(1)\n');
    fixture.detectChanges();
    fixture.componentRef.setInput('code', 'print(2)\n');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(lines.mock.calls).toEqual([['print(2)\n']]);
    expect(host.querySelector('pre')!.textContent).toBe('print(2)\n');
    expect(host.querySelector('[data-kind="function"]')?.textContent).toBe('print');
  });

  it('colors nothing when it goes while its turn waits', async () => {
    const { fixture, lines, observer } = await heldBack();
    observer.report(true);
    fixture.detectChanges();
    fixture.destroy();
    // A turn asked for now comes only after the one the block gave up.
    await nextTurn();

    expect(lines).not.toHaveBeenCalled();
  });

  it('colors in a new language only in a turn of its own, plain until then', async () => {
    const stage = () => grammar('stage');
    TestBed.configureTestingModule({ providers: [provideNeatCodeLanguages({ stage })] });
    const highlighter = (await highlighterFor('stage', { stage }))!;
    const lines = vi.spyOn(highlighter, 'lines');
    const fixture = TestBed.createComponent(NeatCodeBlock);
    fixture.componentRef.setInput('code', 'stage = print');
    fixture.componentRef.setInput('language', 'python');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-kind="function"]')?.textContent).toBe('print');

    fixture.componentRef.setInput('language', 'stage');
    fixture.detectChanges();
    // The grammar is there: the new language's highlighter resolves, but the turn has not come.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    fixture.detectChanges();
    expect(host.querySelector('[data-kind]')).toBeNull();
    expect(lines).not.toHaveBeenCalled();

    await fixture.whenStable();
    expect(host.querySelector('[data-kind="keyword"]')?.textContent).toBe('stage');
    expect(lines).toHaveBeenCalledTimes(1);
  });

  it('colors new code at once once it has colored, never showing it plain', async () => {
    const fixture = TestBed.createComponent(NeatCodeBlock);
    fixture.componentRef.setInput('code', PYTHON);
    fixture.componentRef.setInput('language', 'python');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentRef.setInput('code', 'print(session)\n');
    fixture.detectChanges();
    expect(host.querySelector('pre')!.textContent).toBe('print(session)\n');
    expect(host.querySelector('[data-kind="function"]')?.textContent).toBe('print');
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

  it('marks lines with a band and parts as mark elements, and dims the rest', async () => {
    const host = await render({
      code: PYTHON,
      marks: [{ line: 1 }, { line: 3, text: 'pyneat.Session()' }],
    });
    const pre = host.querySelector('pre')!;
    const lines = pre.querySelectorAll('.line');

    expect(lines[0].hasAttribute('data-marked')).toBe(true);
    expect(lines[0].querySelector('mark[data-line][data-on]')?.textContent).toBe('import pyneat');
    expect(lines[2].hasAttribute('data-marked')).toBe(false);
    expect(shown(host)).toEqual(['pyneat.Session()']);
    expect(pre.hasAttribute('data-dim')).toBe(true);
    expect(pre.textContent).toBe(PYTHON);
  });

  it('dims nothing with dim off, or without marks', async () => {
    const off = await render({ code: PYTHON, marks: [{ line: 1 }], dim: false });
    const none = await render({ code: PYTHON });

    expect(off.querySelector('pre')!.hasAttribute('data-dim')).toBe(false);
    expect(off.querySelector('.line[data-marked]')).not.toBeNull();
    expect(none.querySelector('pre')!.hasAttribute('data-dim')).toBe(false);
    expect(none.querySelector('mark')).toBeNull();
  });

  it('marks colored code, its runs keeping their kinds inside the mark', async () => {
    const host = await render({
      code: PYTHON,
      language: 'python',
      marks: [{ line: 3, text: 'session = pyneat' }],
    });
    const mark = host.querySelector('mark[data-on]')!;

    expect(mark.textContent).toBe('session = pyneat');
    expect(host.querySelector('[data-kind="comment"]')?.closest('mark')).toBeNull();
    expect(host.querySelector('pre')!.textContent).toBe(PYTHON);
  });

  it('copies the code as given while it has marks', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const host = await render({ code: PYTHON, copy: 'example', marks: [{ lines: [1, 3] }] });
    (host.querySelector('neat-copy-button button') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith(PYTHON);
  });

  it('throws in dev mode for a mark that names no line', async () => {
    await expect(render({ code: PYTHON, marks: [{ line: 9 }] })).rejects.toThrow(
      'the code has lines 1 to 3',
    );
  });

  it("shows no marks on the app's own spans", async () => {
    const fixture = TestBed.createComponent(Colored);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('mark')).toBeNull();
    expect(host.querySelector('pre > code')?.children).toHaveLength(3);
  });

  it('is no tab stop without steps', async () => {
    const host = await render({ code: PYTHON, marks: [{ line: 1 }] });

    expect(host.hasAttribute('tabindex')).toBe(false);
    expect(host.hasAttribute('role')).toBe(false);
  });

  it('shows the marks of the step shown, and not marks, while it has steps', async () => {
    const host = await render({ code: PYTHON, steps: WALK, step: 1, marks: [{ line: 2 }] });

    expect(shown(host)).toEqual(['pyneat.Session()']);
    expect(host.querySelector('.line[data-marked]')).toBeNull();
  });

  it('keeps every mark of every step as an element, so a step changes only their state', async () => {
    const fixture = TestBed.createComponent(Walk);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const marks = Array.from(host.querySelectorAll('mark'));

    expect(marks.map((mark) => mark.textContent)).toEqual([
      'import pyneat',
      'pyneat.Session()',
      '# one per app',
    ]);
    expect(marks.map((mark) => mark.getAttribute('role'))).toEqual([null, 'none', 'none']);
    fixture.componentInstance.at.set(1);
    await fixture.whenStable();

    expect(Array.from(host.querySelectorAll('mark'))).toEqual(marks);
    expect(marks.map((mark) => mark.hasAttribute('data-on'))).toEqual([false, true, false]);
    expect(host.querySelector('.line[data-marked]')).toBeNull();
  });

  it('steps with the arrow keys and its buttons, the page following its step', async () => {
    const fixture = TestBed.createComponent(Walk);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const block = host.querySelector('neat-code-block')!;
    const [previous, next] = Array.from(block.querySelectorAll('.steps button'));

    expect(block.getAttribute('tabindex')).toBe('0');
    expect(block.getAttribute('role')).toBe('group');
    expect(block.querySelector('.position')?.textContent).toBe('1 of 3');
    expect(previous.getAttribute('aria-disabled')).toBe('true');
    expect(press(block, 'ArrowRight')).toBe(false);
    await fixture.whenStable();

    expect(host.querySelector('p')?.textContent).toBe('1');
    expect(block.querySelector('.position')?.textContent).toBe('2 of 3');
    (next as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(fixture.componentInstance.at()).toBe(2);
    expect(next.getAttribute('aria-disabled')).toBe('true');
    expect(press(block, 'ArrowRight')).toBe(true);
    (next as HTMLButtonElement).click();
    press(block, 'ArrowLeft');
    await fixture.whenStable();

    expect(fixture.componentInstance.at()).toBe(1);
  });

  it('leaves the arrow keys to the code, and to the page with a modifier', async () => {
    const fixture = TestBed.createComponent(Walk);
    await fixture.whenStable();
    const block = (fixture.nativeElement as HTMLElement).querySelector('neat-code-block')!;

    expect(press(block.querySelector('pre')!, 'ArrowRight')).toBe(true);
    block.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(fixture.componentInstance.at()).toBe(0);
  });

  it('says the step shown in a polite live region, with its label when it has one', async () => {
    const fixture = TestBed.createComponent(Walk);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const region = () => host.querySelector('[aria-live="polite"]')?.textContent;

    expect(region()).toBe('Step 1 of 3: Import pyneat');
    fixture.componentInstance.at.set(2);
    await fixture.whenStable();

    expect(region()).toBe('Step 3 of 3');
  });

  it('shows the nearest step for a step outside them, leaving step as it is', async () => {
    const fixture = TestBed.createComponent(NeatCodeBlock);
    fixture.componentRef.setInput('code', PYTHON);
    fixture.componentRef.setInput('steps', WALK);
    fixture.componentRef.setInput('step', 7);
    await fixture.whenStable();

    expect(shown(fixture.nativeElement)).toEqual(['# one per app']);
    expect(fixture.componentInstance.step()).toBe(7);
  });

  it('has no step controls unless asked', async () => {
    const host = await render({ code: PYTHON, steps: WALK });

    expect(host.querySelector('.steps')).toBeNull();
    expect(host.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  describe('notes', () => {
    const bubble = () => document.querySelector<HTMLElement>('.cdk-overlay-container .bubble');
    const hover = (element: Element, type: 'pointerover' | 'pointerleave' = 'pointerover') =>
      element.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', bubbles: true }));
    /** Lets the note's close delay pass, and the block render. */
    const settle = async (fixture: { whenStable(): Promise<unknown> }, ms = 0) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      await fixture.whenStable();
    };

    afterEach(() => {
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((container) => container.remove());
    });

    it("show the shown step's note in a bubble, its marks the anchor, and follow the step", async () => {
      const fixture = TestBed.createComponent(NotedWalk);
      await settle(fixture);
      const host = fixture.nativeElement as HTMLElement;

      expect(bubble()?.textContent?.trim()).toBe('1. The module');
      // The template stays out of the code's own slot, which still shows the block's lines.
      expect(host.querySelectorAll('.line')).toHaveLength(3);

      fixture.componentInstance.at.set(2);
      await settle(fixture);
      expect(bubble()?.textContent?.trim()).toBe('3. One session');
    });

    it('make each noted mark one tab stop, and leave the marks alone without a note', async () => {
      const fixture = TestBed.createComponent(NotedMarks);
      await settle(fixture);
      const host = fixture.nativeElement as HTMLElement;

      expect(
        Array.from(host.querySelectorAll('pre [tabindex="0"]'), (mark) => mark.textContent),
      ).toEqual(['import pyneat', 'pyneat.Session()']);
      expect(bubble()).toBeNull();

      const plain = await render({ code: PYTHON, marks: [{ line: 1 }] });
      expect(plain.querySelector('[data-mark], pre [tabindex]')).toBeNull();
    });

    it("show a mark's note while the pointer is over it or the bubble, and describe the mark by it", async () => {
      const fixture = TestBed.createComponent(NotedMarks);
      await settle(fixture);
      const host = fixture.nativeElement as HTMLElement;
      const session = host.querySelector('mark[data-mark="1"]')!;

      hover(session.firstElementChild ?? session);
      await settle(fixture);
      expect(bubble()?.textContent?.trim()).toBe('A session');
      expect(session.getAttribute('aria-describedby')).toBe(bubble()?.id);

      // Onto the bubble: it stays.
      hover(host.querySelector('pre')!, 'pointerleave');
      bubble()!.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
      await settle(fixture, 200);
      expect(bubble()).not.toBeNull();

      bubble()!.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
      await settle(fixture, 200);
      expect(bubble()).toBeNull();
      expect(session.hasAttribute('aria-describedby')).toBe(false);
    });

    it("show a marked line's note over its whole band, a marked part's over the part alone", async () => {
      const fixture = TestBed.createComponent(NotedMarks);
      await settle(fixture);
      const host = fixture.nativeElement as HTMLElement;
      const [band, , partLine] = Array.from(host.querySelectorAll('.line'));

      // The band reaches past the line's text: the pointer is on the line itself.
      hover(band);
      await settle(fixture);
      expect(bubble()?.textContent?.trim()).toBe('The import');

      hover(host.querySelector('pre')!, 'pointerleave');
      await settle(fixture, 200);
      expect(bubble()).toBeNull();

      // A line with only a marked part: its empty remainder shows nothing.
      hover(partLine);
      await settle(fixture);
      expect(bubble()).toBeNull();
    });

    it("show a mark's note on keyboard focus and a tap, until the focus leaves or a press elsewhere", async () => {
      const fixture = TestBed.createComponent(NotedMarks);
      await settle(fixture);
      const host = fixture.nativeElement as HTMLElement;
      const [imports, session] = Array.from(
        host.querySelectorAll<HTMLElement>('pre [tabindex="0"]'),
      );

      imports.focus();
      await settle(fixture);
      expect(bubble()?.textContent?.trim()).toBe('The import');

      host.querySelector<HTMLElement>('button')!.focus();
      await settle(fixture, 200);
      expect(bubble()).toBeNull();

      session.click();
      await settle(fixture);
      expect(bubble()?.textContent?.trim()).toBe('A session');

      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await settle(fixture);
      expect(bubble()).toBeNull();
    });

    it('put a note away on Escape, which stays away until the pointer comes back', async () => {
      const fixture = TestBed.createComponent(NotedMarks);
      await settle(fixture);
      const host = fixture.nativeElement as HTMLElement;
      const session = host.querySelector('mark[data-mark="1"]')!;

      hover(session);
      await settle(fixture);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle(fixture);
      expect(bubble()).toBeNull();

      hover(session.firstElementChild ?? session);
      await settle(fixture);
      expect(bubble()).toBeNull();

      hover(host.querySelector('pre')!, 'pointerleave');
      hover(session);
      await settle(fixture);
      expect(bubble()?.textContent?.trim()).toBe('A session');
    });
  });
});
