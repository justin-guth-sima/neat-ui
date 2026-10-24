import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  NeatAsideActions,
  NeatAsideHeading,
  NeatAsidePanel,
  NeatAsideTitle,
  NeatAsideToggle,
  NeatCode,
} from './aside';

@Component({
  imports: [NeatAsideToggle],
  template: `<neat-aside-toggle [label]="label()" [(open)]="open" />`,
})
class ToggleHost {
  readonly label = signal('Side panel');
  readonly open = signal(true);
  readonly toggle = viewChild.required(NeatAsideToggle);
}

@Component({
  imports: [NeatAsideToggle],
  template: `<neat-aside-toggle [(open)]="open" />`,
})
class DefaultToggleHost {
  readonly open = signal(false);
}

@Component({
  imports: [NeatAsideActions, NeatAsideHeading, NeatAsidePanel, NeatAsideTitle, NeatCode],
  template: `
    <section neatAsidePanel>
      <h2 neatAsideTitle>src3</h2>
      <div neatAsideActions><button type="button">Start</button></div>
      <h3 neatAsideHeading>Source</h3>
      <p>Publishes to <code neatCode>rtsp://…/src3</code>.</p>
      <h3 neatAsideHeading>Details</h3>
    </section>
  `,
})
class PanelHost {}

async function settle(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

const classesOf = (element: Element) => [...element.classList];

describe('NeatAsideToggle', () => {
  async function render() {
    const fixture = TestBed.createComponent(ToggleHost);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    return { fixture, host: fixture.componentInstance, button };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('is one small, text, icon-only kit button with the side-panel icon, named "Side panel" by default', async () => {
    const fixture = TestBed.createComponent(DefaultToggleHost);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    expect(button.getAttribute('data-slot')).toBe('button');
    expect(button.type).toBe('button');
    expect(classesOf(button)).toEqual(expect.arrayContaining(['size-8', 'hover:bg-accent']));
    expect(button.querySelector('neat-icon[name="side-panel"]')).not.toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Side panel');
  });

  it('shows whether the panel is open as its pressed state', async () => {
    const { fixture, host, button } = await render();
    expect(button.getAttribute('aria-pressed')).toBe('true');

    host.open.set(false);
    await fixture.whenStable();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('opens and closes the panel on a click, through the model the page binds', async () => {
    const { fixture, host, button } = await render();

    button.click();
    await fixture.whenStable();
    expect(host.open()).toBe(false);
    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    await fixture.whenStable();
    expect(host.open()).toBe(true);
  });

  it('takes its name and its tooltip from label', async () => {
    const { fixture, host, button } = await render();
    host.label.set('Inspector');
    await fixture.whenStable();
    expect(button.getAttribute('aria-label')).toBe('Inspector');

    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    button.getBoundingClientRect = () => new DOMRect(472, 368, 32, 32);
    button.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await settle(fixture);
    await fixture.whenStable();
    expect(document.querySelector('[role="tooltip"]')?.textContent?.trim()).toBe('Inspector');
  });

  it('focus() puts the focus on its button, for a page that closes the panel from inside it', async () => {
    const { host, button } = await render();

    host.toggle().focus();

    expect(document.activeElement).toBe(button);
  });

  it('takes no box of its own in the toolbar', async () => {
    const { fixture } = await render();

    expect(classesOf(fixture.nativeElement.querySelector('neat-aside-toggle'))).toContain(
      'contents',
    );
  });
});

describe('the side panel’s parts', () => {
  async function render() {
    const fixture = TestBed.createComponent(PanelHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    return {
      panel: root.querySelector('section')!,
      title: root.querySelector('h2')!,
      actions: root.querySelector('[neatAsideActions]')!,
      headings: [...root.querySelectorAll('h3')],
      code: root.querySelector('code')!,
    };
  }

  it('neatAsidePanel stacks the panel’s parts a column apart by one gap', async () => {
    const { panel } = await render();

    expect(classesOf(panel)).toEqual(
      expect.arrayContaining(['flex', 'flex-col', 'gap-(--neat-space-3)']),
    );
  });

  it('neatAsideTitle names the panel: no margin, the base size at medium weight', async () => {
    const { title } = await render();

    expect(classesOf(title)).toEqual(expect.arrayContaining(['m-0', 'text-base', 'font-medium']));
  });

  it('neatAsideHeading names a section, nearer to it than to the section before (none first)', async () => {
    const { headings } = await render();

    expect(classesOf(headings[0])).toEqual(
      expect.arrayContaining([
        'mb-0',
        'mt-(--neat-space-3)',
        'first:mt-0',
        'text-(length:--neat-text-sm)',
        'font-semibold',
      ]),
    );
  });

  it('neatAsideActions sets buttons in a row that wraps, a small gap apart', async () => {
    const { actions } = await render();

    expect(classesOf(actions)).toEqual(
      expect.arrayContaining(['flex', 'flex-wrap', 'items-center', 'gap-(--neat-space-2)']),
    );
  });

  it('neatCode sets a URL or path a step smaller in the kit’s size, and lets it wrap anywhere', async () => {
    const { code } = await render();

    expect(classesOf(code)).toEqual(
      expect.arrayContaining(['text-(length:--neat-text-xs)', 'wrap-anywhere']),
    );
  });
});
