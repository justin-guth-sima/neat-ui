import { Component, inject, signal } from '@angular/core';
import { InteractivityChecker } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import helmContent from '../../../src/lib/ui/popover/src/lib/hlm-popover-content.ts?source' with {
  loader: 'text',
};
import {
  KIOSK_POINTER_IDLE_MS,
  KioskService,
  NeatPageToolbar,
  NeatShell,
  contrastRatio,
  type NeatColorScheme,
} from '@sima/neat-ui';
import { NeatConfirm } from '@sima/neat-ui/confirm';
import { MIN_FILL_CONTRAST, MIN_NON_TEXT_CONTRAST } from '../../../src/lib/theme/contrast-rules';
import { spartanThemeTokens } from '../../../src/lib/theme/spartan-theme';
import { stateColor, stateValue } from '../../../src/lib/theme/state-colors';
import {
  NeatPopover,
  type NeatPopoverAlign,
  NeatPopoverContent,
  NeatPopoverDivider,
  NeatPopoverItem,
  NeatPopoverTrigger,
  POPOVER_HELM_CLASSES,
} from './popover';

const SCHEMES: NeatColorScheme[] = ['light', 'dark'];
/** The surfaces a popover opens over: the page and a card. */
const SURFACES = ['background', 'card'] as const;

@Component({
  imports: [NeatPopover, NeatPopoverTrigger, NeatPopoverContent, NeatPopoverItem],
  template: `
    <button type="button" class="outside">Elsewhere</button>
    <p class="outside-text">Page text</p>
    <neat-popover label="View options" [align]="align()" [(open)]="open">
      <button type="button" neatPopoverTrigger>Options</button>
      <ng-template neatPopoverContent>
        <p>How the tiles look.</p>
        <button type="button" class="first">Bars</button>
        <button type="button">Hide empty slots</button>
        <button type="button" neatPopoverItem class="reset" (click)="confirm.ask(resetQuestion)">
          Reset
        </button>
      </ng-template>
    </neat-popover>
    <button type="button" class="after">Next</button>
  `,
})
class PopoverHost {
  protected readonly confirm = inject(NeatConfirm);
  protected readonly resetQuestion = {
    title: 'Reset the view?',
    message: 'Every option goes back.',
    confirmLabel: 'Reset',
  };
  readonly open = signal(false);
  readonly align = signal<NeatPopoverAlign>('center');
}

/**
 * A menu, as Streaming's ⋯ is: rows in two groups with a divider between, one of them disabled.
 * A button after the popover shows where Tab goes on leaving it.
 */
@Component({
  imports: [
    NeatPopover,
    NeatPopoverTrigger,
    NeatPopoverContent,
    NeatPopoverItem,
    NeatPopoverDivider,
  ],
  template: `
    <neat-popover label="Actions" [(open)]="open">
      <button type="button" neatPopoverTrigger>Actions</button>
      <ng-template neatPopoverContent>
        <button type="button" neatPopoverItem class="auto" [disabled]="autoDisabled()">
          Auto assign
        </button>
        <button type="button" neatPopoverItem class="start" [disabled]="startDisabled()">
          Start…
        </button>
        <hr neatPopoverDivider />
        <button type="button" neatPopoverItem class="reset">Reset</button>
        <button type="button" neatPopoverItem class="clear" [disabled]="clearDisabled()">
          Clear renditions
        </button>
      </ng-template>
    </neat-popover>
    <button type="button" class="after">Next</button>
  `,
})
class MenuHost {
  readonly open = signal(false);
  readonly autoDisabled = signal(false);
  readonly startDisabled = signal(true);
  readonly clearDisabled = signal(false);
}

/** Two popovers side by side, as a toolbar has. */
@Component({
  imports: [NeatPopover, NeatPopoverTrigger, NeatPopoverContent],
  template: `
    <neat-popover label="First" [(open)]="firstOpen">
      <button type="button" neatPopoverTrigger>First</button>
      <ng-template neatPopoverContent><button type="button">Inside first</button></ng-template>
    </neat-popover>
    <neat-popover label="Second" [(open)]="secondOpen">
      <button type="button" neatPopoverTrigger>Second</button>
      <ng-template neatPopoverContent><button type="button">Inside second</button></ng-template>
    </neat-popover>
  `,
})
class TwoPopoversHost {
  readonly firstOpen = signal(false);
  readonly secondOpen = signal(false);
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

  it('opens below the trigger, centered on it by default', async () => {
    const { trigger, settle } = await render();

    trigger.click();
    await settle();

    const box = panel()!.closest<HTMLElement>('.cdk-overlay-connected-position-bounding-box')!;
    // From the trigger's bottom edge (368 + 32 = 400) down, 4px apart, centered on the trigger's
    // middle: CDK spans the box evenly around 472 + 40 = 512 and centers the pane in it.
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

  describe('focus order and focus leaving it', () => {
    // CDK judges an element tabbable only if it has a layout box, which jsdom never gives.
    beforeEach(() => vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1));

    /** A focus move as the browser reports it: `focusout` on the old element, naming the new one. */
    const focusOut = (from: HTMLElement, to: HTMLElement | null) =>
      from.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: to }));

    /** A Tab (or Shift+Tab) keypress on `target`; the event shows whether the kit took it over. */
    const tab = (target: HTMLElement, shiftKey = false) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);
      return event;
    };

    /** Opens the panel; returns its controls and an element another overlay would hold. */
    async function open() {
      const rendered = await render();
      rendered.trigger.click();
      await rendered.settle();
      const controls = {
        first: panel()!.querySelector<HTMLButtonElement>('.first')!,
        last: panel()!.querySelector<HTMLButtonElement>('.reset')!,
        middle: panel()!.querySelector<HTMLButtonElement>('button:nth-of-type(2)')!,
      };
      const otherOverlay = document.createElement('button');
      document.querySelector('.cdk-overlay-container')!.append(otherOverlay);
      return {
        ...rendered,
        controls,
        otherOverlay,
        after: rendered.root.querySelector<HTMLButtonElement>('.after')!,
        outside: rendered.root.querySelector<HTMLButtonElement>('.outside')!,
      };
    }

    it('Tab on the last control closes it and focuses the first tabbable after the trigger', async () => {
      const { host, controls, after, settle } = await open();
      controls.last.focus();

      // The page has tabbable elements before the trigger (`.outside`) and one in another
      // overlay: only the one after the trigger in the page is next.
      const event = tab(controls.last);
      await settle();

      expect(event.defaultPrevented).toBe(true);
      expect(host.open()).toBe(false);
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(after);
    });

    it('Tab on the last control with nothing tabbable after the trigger closes it and leaves the key to the browser', async () => {
      const { host, controls, after, otherOverlay, settle } = await open();
      after.remove();
      controls.last.focus();

      const event = tab(controls.last);
      await settle();

      expect(event.defaultPrevented).toBe(false);
      expect(host.open()).toBe(false);
      expect(document.activeElement).not.toBe(otherOverlay);
    });

    it('Shift+Tab on the first control closes it and focuses the trigger', async () => {
      const { host, controls, trigger, settle } = await open();
      expect(document.activeElement).toBe(controls.first);

      const event = tab(controls.first, true);
      await settle();

      expect(event.defaultPrevented).toBe(true);
      expect(host.open()).toBe(false);
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('Tab and Shift+Tab on a control in the middle, and other keys on the edges, are left alone', async () => {
      const { host, controls, settle } = await open();

      expect(tab(controls.middle).defaultPrevented).toBe(false);
      expect(tab(controls.middle, true).defaultPrevented).toBe(false);
      expect(tab(controls.first).defaultPrevented).toBe(false);
      expect(tab(controls.last, true).defaultPrevented).toBe(false);
      controls.last.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await settle();

      expect(host.open()).toBe(true);
      expect(panel()).not.toBeNull();
    });

    it('focus moving from the last control to an outside button closes it, and focus stays on that button', async () => {
      const { host, controls, outside, settle } = await open();
      controls.last.focus();

      outside.focus();
      await settle();

      expect(host.open()).toBe(false);
      expect(panel()).toBeNull();
      expect(document.activeElement).toBe(outside);
    });

    it('focus moving from the trigger to an outside button closes it', async () => {
      const { host, trigger, outside, settle } = await open();
      trigger.focus();
      await settle();
      expect(host.open()).toBe(true);

      outside.focus();
      await settle();

      expect(host.open()).toBe(false);
    });

    it('focus arriving outside with no focusout naming it (Tab back in from the browser) closes it', async () => {
      const { host, controls, outside, settle } = await open();
      controls.last.focus();

      // Focus left the document by Tab, so no focusout named the element it comes back on.
      outside.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await settle();

      expect(host.open()).toBe(false);
      expect(panel()).toBeNull();
    });

    it('focus moving between the trigger and the panel keeps it open', async () => {
      const { host, controls, trigger, settle } = await open();
      expect(document.activeElement).toBe(controls.first);

      trigger.focus();
      await settle();
      expect(host.open()).toBe(true);
      expect(panel()).not.toBeNull();

      controls.first.focus();
      await settle();
      expect(host.open()).toBe(true);
      expect(document.activeElement).toBe(controls.first);
    });

    it('focus moving into another overlay keeps it open', async () => {
      const { host, otherOverlay, settle } = await open();

      otherOverlay.focus();
      await settle();

      expect(host.open()).toBe(true);
      expect(panel()).not.toBeNull();
    });

    it('focus moving into a dialog opened from inside the panel keeps it open', async () => {
      const { host, controls, settle } = await open();

      controls.last.focus();
      controls.last.click();
      await settle();

      const alert = document.querySelector<HTMLElement>('[role="alertdialog"]')!;
      expect(alert).not.toBeNull();
      expect(alert.contains(document.activeElement)).toBe(true);
      expect(host.open()).toBe(true);
      expect(panel()).not.toBeNull();

      // Answering gives focus back to the control that asked, still inside the open panel.
      alert.querySelector<HTMLButtonElement>('button')!.click();
      await settle();
      expect(host.open()).toBe(true);
      expect(document.activeElement).toBe(controls.last);
    });

    it('a focusout that names no element (another window took focus) does not close it', async () => {
      const { host, controls, trigger, settle } = await open();

      focusOut(controls.first, null);
      focusOut(trigger, null);
      await settle();

      expect(host.open()).toBe(true);
      expect(panel()).not.toBeNull();
    });

    it('focus arriving outside after it closed does nothing', async () => {
      const { host, outside, trigger, settle } = await open();
      escape();
      await settle();
      expect(document.activeElement).toBe(trigger);

      outside.focus();
      await settle();

      expect(host.open()).toBe(false);
      expect(document.activeElement).toBe(outside);
    });

    it('a second popover opened from a shortcut while the first is open closes the first', async () => {
      const fixture = TestBed.createComponent(TwoPopoversHost);
      await fixture.whenStable();
      const host = fixture.componentInstance;
      const settle = async () => {
        for (let i = 0; i < 3; i++) {
          await new Promise((resolve) => setTimeout(resolve));
          await fixture.whenStable();
        }
      };
      fixture.nativeElement.querySelector('[neatPopoverTrigger]').click();
      await settle();
      expect(host.firstOpen()).toBe(true);

      host.secondOpen.set(true);
      await settle();

      expect(host.firstOpen()).toBe(false);
      expect(host.secondOpen()).toBe(true);
      const dialogs = document.querySelectorAll('[role="dialog"]');
      expect(dialogs).toHaveLength(1);
      expect(dialogs[0].getAttribute('aria-label')).toBe('Second');
    });
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

    it('a toolbar popover closed by focus moving elsewhere releases its hold', async () => {
      const { kiosk, settle, button } = await startKiosk();
      button('View options').click();
      await settle();
      expect(panel()).not.toBeNull();

      button('Details').focus();
      await settle();
      expect(panel()).toBeNull();

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

  it('a popover sets --neat-surface to --popover, the fill its content sits on', async () => {
    const { trigger, settle } = await render();
    trigger.click();
    await settle();

    // A select list's sticky header fills with --neat-surface to cover the rows under it.
    expect(panel()!.classList).toContain('[--neat-surface:var(--popover)]');
  });

  describe('a menu of rows', () => {
    async function openMenu(setup: (host: MenuHost) => void = () => undefined) {
      const fixture = TestBed.createComponent(MenuHost);
      setup(fixture.componentInstance);
      await fixture.whenStable();
      const trigger = fixture.nativeElement.querySelector('[neatPopoverTrigger]') as HTMLElement;
      vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1024);
      vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(768);
      trigger.getBoundingClientRect = () => new DOMRect(472, 368, 80, 32);
      trigger.click();
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      }
      const rows = Array.from(panel()!.querySelectorAll<HTMLButtonElement>('[neatPopoverItem]'));
      return { fixture, trigger, rows, after: fixture.nativeElement.querySelector('.after') };
    }

    const classesOf = (element: Element) => [...element.classList];

    it('states the panel inset once, as a property the panel and its rows both read', async () => {
      await openMenu();
      const classes = classesOf(panel()!);

      expect(classes).toEqual(
        expect.arrayContaining([
          '[--neat-popover-inset:var(--neat-space-4)]',
          'p-(--neat-popover-inset)',
          'gap-(--neat-popover-inset)',
          'flex-col',
        ]),
      );
      // The inset replaces helm's literal padding and gap, so there is one number, not two.
      expect(classes).not.toContain('p-4');
      expect(classes).not.toContain('gap-4');
    });

    it('draws an item as a full-width row, left-aligned, with the inset moved into the row', async () => {
      const { rows } = await openMenu();
      expect(rows).toHaveLength(4);

      for (const row of rows) {
        const classes = classesOf(row);
        // A negative inline margin by the inset lets the stretched row reach the panel's edges,
        // and the same inset as padding keeps the text where the panel's padding put it.
        expect(classes).toEqual(
          expect.arrayContaining([
            '-mx-(--neat-popover-inset)',
            'px-(--neat-popover-inset)',
            'text-left',
          ]),
        );
        // A row hugging its text at the panel's start is the look this replaces.
        expect(classes).not.toContain('self-start');
      }
    });

    it('leaves no gap between rows: each takes back half of the panel gap above and below', async () => {
      const { rows } = await openMenu();

      for (const row of rows) {
        expect(classesOf(row)).toContain('-my-[calc(var(--neat-popover-inset)/2)]');
      }
    });

    it('is a divider that spans the panel like a row and is no tab stop', async () => {
      await openMenu();
      const divider = panel()!.querySelector('hr[neatPopoverDivider]') as HTMLElement;

      // Spartan's separator, decorative: the rows' groups are visual, not announced.
      expect(divider.getAttribute('role')).toBe('none');
      expect(divider.getAttribute('data-orientation')).toBe('horizontal');
      expect(divider.hasAttribute('data-horizontal')).toBe(true);
      expect(classesOf(divider)).toEqual(
        expect.arrayContaining([
          '-mx-(--neat-popover-inset)',
          '-my-[calc(var(--neat-popover-inset)/4)]',
          'bg-border',
          'data-horizontal:h-px',
        ]),
      );
      expect(TestBed.inject(InteractivityChecker).isTabbable(divider)).toBe(false);
    });

    it('keeps the rows in document order, as native buttons, in the Tab order written', async () => {
      const { rows } = await openMenu();

      expect(rows.map((row) => row.textContent!.trim())).toEqual([
        'Auto assign',
        'Start…',
        'Reset',
        'Clear renditions',
      ]);
      // No tabindex and no reordering class: the Tab order is the order written.
      for (const row of rows) {
        expect(row.tagName).toBe('BUTTON');
        expect(row.hasAttribute('tabindex')).toBe(false);
        expect(classesOf(row).some((name) => /(^|:)order-/.test(name))).toBe(false);
      }
    });

    it('moves focus to the first enabled row on opening', async () => {
      const { rows } = await openMenu((host) => host.autoDisabled.set(true));

      expect(document.activeElement).toBe(rows[2]);
    });

    it('Tab on the last enabled row carries on after the trigger, past a disabled last row', async () => {
      const { rows, after } = await openMenu((host) => host.clearDisabled.set(true));

      rows[2].focus();
      rows[2].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve));

      expect(document.activeElement).toBe(after);
      expect(panel()).toBeNull();
    });

    it('Shift+Tab on the first enabled row goes back to the trigger, past a disabled first row', async () => {
      const { rows, trigger } = await openMenu((host) => {
        host.autoDisabled.set(true);
        host.startDisabled.set(false);
      });

      rows[1].focus();
      rows[1].dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve));

      expect(document.activeElement).toBe(trigger);
      expect(panel()).toBeNull();
    });

    it('shows keyboard focus on a row by an inset ring and the hover fill, not by outline', async () => {
      const { rows } = await openMenu();
      const classes = classesOf(rows[0]);

      expect(classes).toEqual(
        expect.arrayContaining([
          'focus-visible:ring-2',
          'focus-visible:ring-inset',
          'focus-visible:ring-ring',
          'focus-visible:bg-accent',
          // Forced colors drop the ring: the transparent outline is what they paint instead.
          'outline-hidden',
        ]),
      );
    });

    it('reads a disabled row as disabled: muted text, the default cursor, no hover fill', async () => {
      const { rows } = await openMenu();
      const [auto, start] = rows;

      expect(start.disabled).toBe(true);
      expect(classesOf(start)).toEqual(
        expect.arrayContaining(['disabled:text-muted-foreground', 'disabled:cursor-default']),
      );
      // The hover fill belongs to enabled rows only, so a disabled row never lights up.
      expect(classesOf(auto)).toContain('enabled:hover:bg-accent');
      expect(classesOf(auto)).not.toContain('hover:bg-accent');
    });

    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      const vocabulary = {
        enabled: 'enabled',
        disabled: 'disabled',
        hover: 'hover',
        'focus-visible': 'focus',
      };
      const q = (on: string[]) => ({ tokens, vocabulary, on });
      const popover = tokens['popover'];

      it(`${scheme}: row text is ${4.5}:1 at rest and hovered, a disabled row's too and unlike it`, async () => {
        const { rows } = await openMenu();
        const [auto, start] = rows.map(classesOf);

        const rest = stateColor(auto, 'text', q(['enabled']), popover, tokens['foreground']);
        const hoverFill = stateColor(auto, 'bg', q(['enabled', 'hover']), popover);
        const disabled = stateColor(start, 'text', q(['disabled']), popover, tokens['foreground']);
        expect(hoverFill).toBe(tokens['accent']);
        expect(contrastRatio(rest, popover)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(rest, hoverFill)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(disabled, popover)).toBeGreaterThanOrEqual(4.5);
        expect(disabled).not.toBe(rest);
        // A disabled row has no hover fill to light up.
        expect(stateColor(start, 'bg', q(['disabled', 'hover']), popover)).toBe(popover);
      });

      it(`${scheme}: the focus ring is ${MIN_NON_TEXT_CONTRAST}:1 on the panel and on the focused row's fill`, async () => {
        const { rows } = await openMenu();
        const classes = classesOf(rows[0]);
        const ring = stateColor(classes, 'ring', q(['enabled', 'focus']), popover);
        const fill = stateColor(classes, 'bg', q(['enabled', 'focus']), popover);

        expect(fill).toBe(tokens['accent']);
        expect(contrastRatio(ring, popover)).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
        expect(contrastRatio(ring, fill)).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      });
    }
  });

  it('keeps a plain control out of the row look, so a panel can mix fields and rows', async () => {
    const { trigger, settle } = await render();
    trigger.click();
    await settle();

    const items = panel()!.querySelectorAll('[neatPopoverItem]');
    expect(items).toHaveLength(1);
    expect([...items[0].classList]).toContain('reset');
    expect(panel()!.querySelector('.first')!.classList).not.toContain('-mx-(--neat-popover-inset)');
  });

  it('helm drift: the copied class string still appears in the vendored helm popover', () => {
    expect(helmContent).toContain(POPOVER_HELM_CLASSES.content);
  });

  describe('contrast, from the emitted theme tokens', () => {
    for (const scheme of SCHEMES) {
      const tokens = spartanThemeTokens(scheme);
      // The panel's color classes carry no state variants: it looks the same open and closing.
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
