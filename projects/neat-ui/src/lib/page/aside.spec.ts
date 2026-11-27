import { CdkPortalOutlet } from '@angular/cdk/portal';
import { Component, inject, signal, Type, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NeatPageToolbar, PageToolbarSlot } from '../shell/page-toolbar';
import {
  AsideToggleSlot,
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
  imports: [NeatAsideToggle],
  template: `
    <neat-aside-toggle />
    @if (second()) {
      <neat-aside-toggle label="Inspector" />
    }
  `,
})
class TwoToggles {
  readonly second = signal(false);
}

@Component({
  imports: [NeatAsideToggle, NeatPageToolbar],
  template: `<div *neatPageToolbar><neat-aside-toggle /></div>`,
})
class ToggleInToolbar {}

/** Renders the registered toggle, as the shell's top bar does at its right edge. */
@Component({
  imports: [CdkPortalOutlet],
  template: `<ng-template [cdkPortalOutlet]="slot.portal()" />`,
})
class Outlet {
  protected readonly slot = inject(AsideToggleSlot);
}

/** Renders the registered page toolbar, as the shell does. */
@Component({
  imports: [CdkPortalOutlet],
  template: `<ng-template [cdkPortalOutlet]="slot.portal()" />`,
})
class ToolbarOutlet {
  protected readonly slot = inject(PageToolbarSlot);
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
  /** The page that declares the toggle, and the outlet where the shell renders its button. */
  async function render<T>(page: Type<T>) {
    const fixture = TestBed.createComponent(page);
    const outlet = TestBed.createComponent(Outlet);
    await fixture.whenStable();
    await outlet.whenStable();
    const button = (): HTMLButtonElement =>
      (outlet.nativeElement as HTMLElement).querySelector('button')!;
    return { fixture, outlet, host: fixture.componentInstance, button };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
  });

  it('renders its button where the shell puts it and nothing where the page declares it', async () => {
    const { fixture, button } = await render(ToggleHost);
    const declared = (fixture.nativeElement as HTMLElement).querySelector('neat-aside-toggle')!;

    expect(button()).not.toBeNull();
    expect(declared.querySelector('button')).toBeNull();
    // No box where it is declared, so it never takes a gap in the page's layout.
    expect(declared.hasAttribute('hidden')).toBe(true);
  });

  it('is drawn as the top bar’s other edge control, the kiosk button: a large, round, text, icon-only kit button', async () => {
    const { button } = await render(DefaultToggleHost);

    expect(button().getAttribute('data-slot')).toBe('button');
    expect(button().type).toBe('button');
    expect(classesOf(button())).toEqual(
      expect.arrayContaining(['size-10', 'rounded-full', 'hover:bg-accent']),
    );
    expect(button().querySelector('neat-icon[name="side-panel"]')).not.toBeNull();
    expect(button().getAttribute('aria-label')).toBe('Side panel');
  });

  it('no longer reorders itself on a narrow screen: the shell puts it last in the first row', async () => {
    const { button } = await render(ToggleHost);

    expect(button().hasAttribute('data-narrow')).toBe(false);
    expect(classesOf(button()).some((name) => /(^|:)order-/.test(name))).toBe(false);
  });

  it('shows whether the panel is open as its pressed state', async () => {
    const { fixture, outlet, host, button } = await render(ToggleHost);
    expect(button().getAttribute('aria-pressed')).toBe('true');

    host.open.set(false);
    await fixture.whenStable();
    await outlet.whenStable();
    expect(button().getAttribute('aria-pressed')).toBe('false');
  });

  it('opens and closes the panel on a click, through the model the page binds', async () => {
    const { fixture, outlet, host, button } = await render(ToggleHost);

    button().click();
    await fixture.whenStable();
    await outlet.whenStable();
    expect(host.open()).toBe(false);
    expect(button().getAttribute('aria-pressed')).toBe('false');

    button().click();
    await fixture.whenStable();
    expect(host.open()).toBe(true);
  });

  it('takes its name and its tooltip from label', async () => {
    const { fixture, outlet, host, button } = await render(ToggleHost);
    host.label.set('Inspector');
    await fixture.whenStable();
    await outlet.whenStable();
    expect(button().getAttribute('aria-label')).toBe('Inspector');

    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    button().getBoundingClientRect = () => new DOMRect(472, 368, 40, 40);
    button().dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    await settle(outlet);
    expect(document.querySelector('[role="tooltip"]')?.textContent?.trim()).toBe('Inspector');
    expect(document.querySelector('[role="tooltip"]')?.getAttribute('data-side')).toBe('bottom');
  });

  it('focus() puts the focus on its button where the shell renders it', async () => {
    const { host, button } = await render(ToggleHost);

    host.toggle().focus();

    expect(document.activeElement).toBe(button());
  });

  it('takes its button out of the shell as soon as the page is destroyed', async () => {
    const { fixture, outlet } = await render(ToggleHost);
    expect(outlet.nativeElement.querySelector('button')).not.toBeNull();

    fixture.destroy();

    // Before any change detection: the button's bindings never run against a destroyed page.
    expect(outlet.nativeElement.querySelector('button')).toBeNull();
    expect(TestBed.inject(AsideToggleSlot).portal()).toBeNull();
  });

  it('a second toggle throws in dev mode: one page, one aside', async () => {
    const fixture = TestBed.createComponent(TwoToggles);
    await fixture.whenStable();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fixture.componentInstance.second.set(true);

    try {
      await expect(fixture.whenStable()).rejects.toThrow(/one aside toggle at a time/);
    } finally {
      error.mockRestore();
    }
  });

  it('declared inside *neatPageToolbar, throws in dev mode: it has a place of its own', async () => {
    TestBed.createComponent(ToggleInToolbar);
    const outlet = TestBed.createComponent(ToolbarOutlet);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(outlet.whenStable()).rejects.toThrow(/outside \*neatPageToolbar/);
    } finally {
      error.mockRestore();
    }
  });
});

describe('the aside’s parts', () => {
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

  it('neatCode sets a URL or path in the kit’s one inline code look, which prose shares', async () => {
    const { code } = await render();

    // The look is Spartan's inline code, held to helm's by prose.spec.
    expect(classesOf(code)).toEqual(['neat-code']);
  });
});
