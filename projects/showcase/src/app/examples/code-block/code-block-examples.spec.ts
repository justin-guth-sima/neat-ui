import { TestBed } from '@angular/core/testing';
import { InstallCommand } from './1-install-command.example';
import { WholeFile } from './2-whole-file.example';
import { PythonFile } from './3-python-file.example';
import { LineNumbers } from './4-line-numbers.example';
import { AnotherLanguage } from './5-another-language.example';
import { ColoredByTheApp } from './6-colored-by-the-app.example';
import { StreamURL } from './7-stream-url.example';

async function render<T>(component: new () => T): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

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
