import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import helmContent from '../ui/popover/src/lib/hlm-popover-content.ts?source' with {
  loader: 'text',
};
import { KIOSK_POINTER_IDLE_MS, KioskService } from '../kiosk/kiosk.service';
import { NeatPageToolbar } from '../shell/page-toolbar';
import { NeatShell } from '../shell/shell';
import { contrastRatio } from '../theme/color';
import { MIN_FILL_CONTRAST } from '../theme/contrast-rules';
import { spartanThemeTokens } from '../theme/spartan-theme';
import { stateColor, stateValue } from '../theme/state-colors';
import type { NeatColorScheme } from '../theme/theme.service';
import {
  NeatPopover,
  type NeatPopoverAlign,
  NeatPopoverContent,
  NeatPopoverTrigger,
  POPOVER_HELM_CLASSES,
} from './popover';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
/** The surfaces a popover opens over: the page and a card. */
const SURFACES = ['background', 'card'] as const;

@Component({
  imports: [NeatPopover, NeatPopoverTrigger, NeatPopoverContent],
  template: `
    <button type="button" class="outside">Elsewhere</button>
    <p class="outside-text">Page text</p>
    <neat-popover label="View options" [align]="align()" [(open)]="open">
      <button type="button" neatPopoverTrigger>Options</button>
      <ng-template neatPopoverContent>
        <p>How the tiles look.</p>
        <button type="button" class="first">Bars</button>
        <button type="button">Hide empty slots</button>
      </ng-template>
    </neat-popover>
  `,
})
class PopoverHost {
  readonly open = signal(false);
  readonly align = signal<NeatPopoverAlign>('center');
}

/**
 * A page with a popover in its toolbar and another in its body, as the viewer has. The toolbar's
 * popover sits in a view of its own (`@if`), as toolbar controls often do.
 */
@Component({
  imports: [NeatPageToolbar, NeatPopover, NeatPopoverTrigger, NeatPopoverContent],
  template: `
    <div *neatPageToolbar>
      @if (toolbarReady()) {
        <neat-popover label="View options" [(open)]="toolbarOpen">
          <button type="button" neatPopoverTrigger>View options</button>
          <ng-template neatPopoverContent><button type="button">Bars</button></ng-template>
        </neat-popover>
      }
    </div>
    <neat-popover label="Details" [(open)]="bodyOpen">
      <button type="button" neatPopoverTrigger>Details</button>
      <ng-template neatPopoverContent><button type="button">More</button></ng-template>
    </neat-popover>
  `,
})
class ToolbarPopoverPage {
  readonly toolbarReady = signal(true);
  readonly toolbarOpen = signal(false);
  readonly bodyOpen = signal(false);
}

@Component({
  imports: [NeatShell, RouterOutlet],
  template: `
    <neat-shell appName="Neat Insight" [navItems]="[]">
      <router-outlet />
    </neat-shell>
  `,
})
class AppHost {}

describe('NeatPopover', () => {
  const panel = (): HTMLElement | null => document.querySelector('[role="dialog"]');

  async function render(setup: (host: PopoverHost) => void = () => undefined) {
    const fixture = TestBed.createComponent(PopoverHost);
    setup(fixture.componentInstance);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const trigger = root.querySelector<HTMLButtonElement>('[neatPopoverTrigger]')!;
    // jsdom lays nothing out: give the viewport a size and put the trigger in its middle, so the
    // panel fits below it and does not flip above.
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
    trigger.getBoundingClientRect = () => new DOMRect(472, 368, 80, 32);
    /** Runs pending timers and render hooks (focus moves after render; closing waits a frame). */
    const settle = async () => {
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      }
    };
    return { fixture, host: fixture.componentInstance, root, trigger, settle };
  }

  const escape = () =>
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );

  /** A pointer press and release on `element`, as CDK's outside-click handling hears it. */
  const clickOn = (element: HTMLElement) => {
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    element.click();
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
    history.replaceState(null, '', '/');
  });

  it('opens on trigger click with focus on the first focusable element; Escape closes and refocuses the trigger', async () => {
    const { host, trigger, settle } = await render();
    expect(panel()).toBeNull();

    trigger.focus();
    trigger.click();
    await settle();

    expect(host.open()).toBe(true);
    expect(panel()?.textContent).toContain('How the tiles look.');
    expect(document.activeElement).toBe(panel()?.querySelector('.first'));

    escape();
    await settle();

    expect(host.open()).toBe(false);
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('a click outside closes it; setting open=false closes it and refocuses the trigger', async () => {
    const { fixture, host, root, trigger, settle } = await render();

    trigger.click();
    await settle();
    expect(panel()).not.toBeNull();

    clickOn(root.querySelector('.outside-text')!);
    await settle();
    expect(host.open()).toBe(false);
    expect(panel()).toBeNull();

    trigger.click();
    await settle();
    expect(document.activeElement).toBe(panel()?.querySelector('.first'));

    host.open.set(false);
    await fixture.whenStable();
    await settle();
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('setting open=true opens it from wherever focus is, and closing returns focus to the trigger', async () => {
    const { fixture, host, root, trigger, settle } = await render();
    const elsewhere = root.querySelector<HTMLButtonElement>('.outside')!;
    elsewhere.focus();

    // How an app opens it from a keyboard shortcut.
    host.open.set(true);
    await fixture.whenStable();
    await settle();
    expect(document.activeElement).toBe(panel()?.querySelector('.first'));

    escape();
    await settle();
    expect(host.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('a click on the trigger while open closes it', async () => {
    const { host, trigger, settle } = await render();

    trigger.click();
    await settle();
    clickOn(trigger);
    await settle();

    expect(host.open()).toBe(false);
    expect(panel()).toBeNull();
  });

  it('the trigger has aria-haspopup=dialog and aria-expanded; the panel is named by label', async () => {
    const { trigger, settle } = await render();
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
    expect(trigger.type).toBe('button');

    trigger.click();
    await settle();

    const dialog = panel()!;
    expect(dialog.getAttribute('aria-label')).toBe('View options');
    // Non-modal: the page stays usable around it.
    expect(dialog.hasAttribute('aria-modal')).toBe(false);
    expect(document.querySelector('.cdk-overlay-backdrop')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(dialog.id).toBeTruthy();
    expect(trigger.getAttribute('aria-controls')).toBe(dialog.id);
    // One dialog: the overlay pane around the panel carries no role of its own.
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);

    escape();
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
  });

  it('opens below the trigger, centred on it by default', async () => {
    const { trigger, settle } = await render();

    trigger.click();
    await settle();

    const box = panel()!.closest<HTMLElement>('.cdk-overlay-connected-position-bounding-box')!;
    // From the trigger's bottom edge (368 + 32 = 400) down, 4px apart, centred on the trigger's
    // middle: CDK spans the box evenly around 472 + 40 = 512 and centres the pane in it.
    expect(box.style.top).toBe('400px');
    expect(box.style.justifyContent).toBe('flex-start');
    expect((box.firstElementChild as HTMLElement).style.transform).toBe('translateY(4px)');
    expect(box.style.left).toBe('0px');
    expect(box.style.width).toBe('1024px');
    expect(box.style.alignItems).toBe('center');
  });

  it('align=end lines the panel up with the trigger’s end edge', async () => {
    const { trigger, settle } = await render((host) => host.align.set('end'));

    trigger.click();
    await settle();

    const box = panel()!.closest<HTMLElement>('.cdk-overlay-connected-position-bounding-box')!;
    // The trigger's end edge is at 472 + 80 = 552, so 1024 - 552 = 472 from the viewport's right.
    expect(box.style.right).toBe('472px');
    expect(box.style.alignItems).toBe('flex-end');
  });

  describe('in kiosk mode', () => {
    let harness: RouterTestingHarness;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([
            {
              path: '',
              component: AppHost,
              children: [{ path: 'viewer', component: ToolbarPopoverPage }],
            },
          ]),
        ],
      });
    });

    async function startKiosk() {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      harness = await RouterTestingHarness.create('/viewer');
      const kiosk = TestBed.inject(KioskService);
      await kiosk.enter();
      await harness.fixture.whenStable();
      const shell: HTMLElement = harness.fixture.nativeElement;
      const settle = async () => {
        for (let i = 0; i < 3; i++) {
          await vi.advanceTimersByTimeAsync(0);
          await harness.fixture.whenStable();
        }
      };
      const button = (name: string) =>
        Array.from(shell.querySelectorAll('button')).find((b) => b.textContent?.trim() === name)!;
      return { kiosk, shell, settle, button };
    }

    it('an open popover from the floating toolbar keeps pointerIdle false past KIOSK_POINTER_IDLE_MS; closing releases it', async () => {
      const { kiosk, shell, settle, button } = await startKiosk();
      const trigger = button('View options');
      expect(shell.querySelector('.kiosk-toolbar')?.contains(trigger)).toBe(true);

      trigger.click();
      await settle();
      expect(panel()).not.toBeNull();

      // The pointer rests over the panel, outside the floating bar: the bar must stay.
      await vi.advanceTimersByTimeAsync(KIOSK_POINTER_IDLE_MS * 2);
      await settle();
      expect(kiosk.pointerIdle()).toBe(false);
      expect(shell.querySelector('.kiosk-chrome')?.getAttribute('data-shown')).toBe('true');

      escape();
      await settle();
      expect(panel()).toBeNull();
      await vi.advanceTimersByTimeAsync(KIOSK_POINTER_IDLE_MS);
      await settle();
      expect(kiosk.pointerIdle()).toBe(true);
      expect(shell.querySelector('.kiosk-chrome')?.getAttribute('data-shown')).toBe('false');
    });

    it('a popover outside the page toolbar does not hold it', async () => {
      const { kiosk, settle, button } = await startKiosk();

      button('Details').click();
      await settle();
      expect(panel()).not.toBeNull();

      await vi.advanceTimersByTimeAsync(KIOSK_POINTER_IDLE_MS);
      await settle();
      expect(kiosk.pointerIdle()).toBe(true);
    });

    it('a toolbar popover destroyed while open releases its hold', async () => {
      const { kiosk, settle, button } = await startKiosk();
      button('View options').click();
      await settle();

      // The page tears the toolbar's view down while kiosk mode stays on: the destroyed popover's
      // hold must go with it, or the bar would stay shown forever.
      harness.fixture.debugElement
        .query(By.directive(ToolbarPopoverPage))
        .componentInstance.toolbarReady.set(false);
      await settle();
      expect(button('View options')).toBeUndefined();
      await vi.advanceTimersByTimeAsync(KIOSK_POINTER_IDLE_MS);
      await settle();
      expect(kiosk.active()).toBe(true);
      expect(kiosk.pointerIdle()).toBe(true);
    });
  });

  it('draws the panel with helm’s popover classes on the popover surface, outlined in --border', async () => {
    const { trigger, settle } = await render();
    trigger.click();
    await settle();

    const classes = [...panel()!.classList];
    expect(classes).toEqual(expect.arrayContaining(['bg-popover', 'text-popover-foreground']));
    expect(classes).toEqual(expect.arrayContaining(['ring-1', 'ring-border', 'shadow-md']));
    expect(classes).not.toContain('ring-foreground/10');
  });

  it('helm drift: the copied class string still appears in the vendored helm popover', () => {
    expect(helmContent).toContain(POPOVER_HELM_CLASSES.content);
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      // The panel's colour classes carry no state variants: it looks the same open and closing.
      const q = { tokens, vocabulary: {}, on: [] };

      it(`${scheme}: panel text and border meet the theme contrast rules`, async () => {
        const { trigger, settle } = await render();
        trigger.click();
        await settle();
        const classes = [...panel()!.classList];

        const fill = stateColor(classes, 'bg', q, tokens['background']);
        const text = stateColor(classes, 'text', q, fill);
        expect(fill).toBe(tokens['popover']);
        expect(contrastRatio(text, fill), `${scheme}: ${text} on ${fill}`).toBeGreaterThanOrEqual(
          4.5,
        );

        // The border is decoration (the theme holds only form controls to 3:1), so the rule for
        // it is the theme's border token, visible against the panel and what the panel covers.
        expect(stateValue(classes, 'ring', q)).toBe('border');
        const border = stateColor(classes, 'ring', q, fill);
        for (const surface of [fill, ...SURFACES.map((name) => tokens[name])]) {
          expect(
            contrastRatio(border, surface),
            `${scheme}: border ${border} on ${surface}`,
          ).toBeGreaterThanOrEqual(MIN_FILL_CONTRAST);
        }
      });
    }
  });
});
