import { TestBed } from '@angular/core/testing';
import { InstallCommand } from './1-install-command.example';
import { WholeFile } from './2-whole-file.example';
import { ColoredByTheApp } from './3-colored-by-the-app.example';
import { StreamURL } from './4-stream-url.example';

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
