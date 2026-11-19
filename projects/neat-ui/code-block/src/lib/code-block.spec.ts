import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatCodeBlock } from './code-block';

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

describe('NeatCodeBlock', () => {
  afterEach(() => vi.unstubAllGlobals());

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
});
