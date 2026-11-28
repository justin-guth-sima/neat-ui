import helmSidebar from '../ui/sidebar/src/lib/hlm-sidebar.ts?source' with { loader: 'text' };
import helmWrapper from '../ui/sidebar/src/lib/hlm-sidebar-wrapper.ts?source' with {
  loader: 'text',
};
import helmHeader from '../ui/sidebar/src/lib/hlm-sidebar-header.ts?source' with { loader: 'text' };
import helmContent from '../ui/sidebar/src/lib/hlm-sidebar-content.ts?source' with {
  loader: 'text',
};
import helmFooter from '../ui/sidebar/src/lib/hlm-sidebar-footer.ts?source' with { loader: 'text' };
import helmMenu from '../ui/sidebar/src/lib/hlm-sidebar-menu.ts?source' with { loader: 'text' };
import helmGroup from '../ui/sidebar/src/lib/hlm-sidebar-group.ts?source' with { loader: 'text' };
import helmMenuItem from '../ui/sidebar/src/lib/hlm-sidebar-menu-item.ts?source' with {
  loader: 'text',
};
import helmMenuSub from '../ui/sidebar/src/lib/hlm-sidebar-menu-sub.ts?source' with {
  loader: 'text',
};
import helmMenuSubItem from '../ui/sidebar/src/lib/hlm-sidebar-menu-sub-item.ts?source' with {
  loader: 'text',
};
import helmMenuButton from '../ui/sidebar/src/lib/hlm-sidebar-menu-button.ts?source' with {
  loader: 'text',
};
import helmMenuSubButton from '../ui/sidebar/src/lib/hlm-sidebar-menu-sub-button.ts?source' with {
  loader: 'text',
};
import helmRail from '../ui/sidebar/src/lib/hlm-sidebar-rail.ts?source' with { loader: 'text' };
import helmInset from '../ui/sidebar/src/lib/hlm-sidebar-inset.ts?source' with { loader: 'text' };
import helmSeparator from '../ui/sidebar/src/lib/hlm-sidebar-separator.ts?source' with {
  loader: 'text',
};
import helmSheetOverlay from '../ui/sheet/src/lib/hlm-sheet-overlay.ts?source' with {
  loader: 'text',
};
import helmSheetContent from '../ui/sheet/src/lib/hlm-sheet-content.ts?source' with {
  loader: 'text',
};
import {
  classSet,
  helmCvaBase,
  helmHostClasses,
  takenFromHelm,
  type HelmDepartures,
} from '../typography/helm-classes.testing';
import {
  DRAWER_HELM_CLASSES,
  DRAWER_WIDTH_CLASSES,
  MENU_BUTTON_HELM_CLASSES,
  MENU_BUTTON_LG_COLLAPSED_CLASSES,
  MENU_SUB_BUTTON_HELM_CLASSES,
  SIDEBAR_BRAND_CLASSES,
  SIDEBAR_CLASSES,
  SIDEBAR_CONTAINER_CLASSES,
  SIDEBAR_HELM_CLASSES,
} from './sidebar-classes';

const words = (classes: string): string[] => classes.split(/\s+/).filter(Boolean);

/** The quoted strings of `text`, in order. */
const quoted = (text: string): string[] =>
  [...text.matchAll(/'([^']*)'|"([^"]*)"/g)].map((match) => match[1] ?? match[2]);

/** The text from `start` up to the first `end` after it. */
function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  if (from < 0) throw new Error(`no "${start}" in the helm file`);
  const to = source.indexOf(end, from);
  if (to < 0) throw new Error(`no "${end}" after "${start}" in the helm file`);
  return source.slice(from, to);
}

/** Helm's motion classes get this prefix in the kit, so no motion runs under reduced motion. */
const motionSafe = (names: readonly string[]): string[] =>
  names.map((name) => `motion-safe:${name}`);

/** Each change of the kit's against helm's: what it leaves out, and what it has instead. */
function expectTable(kit: string, helm: readonly string[], changes?: HelmDepartures): void {
  expect(classSet(words(kit))).toEqual(takenFromHelm(helm, changes));
}

// The sidebar's desktop branch, as hlm-sidebar.ts writes it: the strings of its gap and container
// classes less the floating and inset variant (the kit has only the default variant).
const desktop = (computedName: string): string[] =>
  quoted(between(helmSidebar, `${computedName} = computed(`, '\n  );'))
    .filter((text) => !['floating', 'inset'].includes(text) && !text.includes('spacing(4)'))
    .flatMap(words);
const helmGap = desktop('_sidebarGapComputedClass');
const helmContainer = desktop('_sidebarContainerComputedClass');
const helmSidebarHost = words(/hlm\('(group peer [^']*)'\)/.exec(helmSidebar)![1]);
const helmInner = words(/data-slot="sidebar-inner"\s+class="([^"]*)"/.exec(helmSidebar)![1]);
const helmMobileSidebar = words(/data-mobile="true"\s+class="([^"]*)"/.exec(helmSidebar)![1]);

// The menu button's cva: its base and its `size` variants.
const helmSizes = /size:\s*\{([^}]*)\}/.exec(helmMenuButton)![1];
const helmSize = (name: string): string[] =>
  words(new RegExp(`\\b${name}:\\s*'([^']*)'`).exec(helmSizes)![1]);

// The sheet content's `classes([...])` strings, in order: the base, its animation, one per side.
const helmSheetStrings = quoted(between(helmSheetContent, 'classes(() => [', ']);'));
const helmSheetSide = (side: string): string[] =>
  words(helmSheetStrings.find((text) => text.startsWith(`data-[side=${side}]:data-closed`))!);

const ACTIVE_BUTTON = [
  'data-active:bg-sidebar-accent',
  'data-active:text-sidebar-accent-foreground',
];
const asCurrentPage = (names: readonly string[]): string[] =>
  names.map((name) => name.replace('data-active:', 'aria-[current=page]:'));

describe('SIDEBAR_HELM_CLASSES', () => {
  it('wrapper is hlm-sidebar-wrapper’s, h-full of the shell instead of min-h-svh', () => {
    expectTable(SIDEBAR_HELM_CLASSES.wrapper, helmHostClasses(helmWrapper), {
      departures: ['min-h-svh'],
      additions: ['h-full'],
    });
  });

  it('gap is hlm-sidebar’s desktop gap, its width transition only under motion-safe', () => {
    const motion = ['transition-[width]', 'duration-200', 'ease-linear'];
    expectTable(SIDEBAR_HELM_CLASSES.gap, helmGap, {
      departures: motion,
      additions: motionSafe(motion),
    });
  });

  it('inner is hlm-sidebar’s sidebar-inner', () => {
    expectTable(SIDEBAR_HELM_CLASSES.inner, helmInner);
  });

  it('header, content, footer, menu and menu items are their helm files’', () => {
    expectTable(SIDEBAR_HELM_CLASSES.header, helmHostClasses(helmHeader));
    // Collapsed, helm stops the content scrolling; the kit hides only the sideways overflow, so a
    // short window still reaches every page.
    expectTable(SIDEBAR_HELM_CLASSES.content, helmHostClasses(helmContent), {
      departures: ['group-data-[collapsible=icon]:overflow-hidden'],
      additions: ['group-data-[collapsible=icon]:overflow-x-hidden'],
    });
    expectTable(SIDEBAR_HELM_CLASSES.footer, helmHostClasses(helmFooter));
    expectTable(SIDEBAR_HELM_CLASSES.group, helmHostClasses(helmGroup));
    expectTable(SIDEBAR_HELM_CLASSES.menu, helmHostClasses(helmMenu));
    expectTable(SIDEBAR_HELM_CLASSES.menuItem, helmHostClasses(helmMenuItem));
    expectTable(SIDEBAR_HELM_CLASSES.menuSub, helmHostClasses(helmMenuSub));
    expectTable(SIDEBAR_HELM_CLASSES.menuSubItem, helmHostClasses(helmMenuSubItem));
  });

  it('rail is hlm-sidebar-rail’s, flex without a breakpoint, its transition only under motion-safe', () => {
    const motion = ['transition-all', 'ease-linear'];
    expectTable(SIDEBAR_HELM_CLASSES.rail, helmHostClasses(helmRail), {
      departures: ['hidden', 'sm:flex', ...motion],
      additions: ['flex', ...motionSafe(motion)],
    });
  });

  it('inset and separator are their helm files’', () => {
    expectTable(SIDEBAR_HELM_CLASSES.inset, helmHostClasses(helmInset));
    expectTable(SIDEBAR_HELM_CLASSES.separator, helmHostClasses(helmSeparator));
  });
});

describe('SIDEBAR_CLASSES', () => {
  it('is hlm-sidebar’s desktop host, shown without a breakpoint', () => {
    expectTable(SIDEBAR_CLASSES, helmSidebarHost, { departures: ['hidden', 'md:block'] });
  });
});

describe('SIDEBAR_CONTAINER_CLASSES', () => {
  it('is hlm-sidebar’s desktop container less its fixed placement, plus h-full', () => {
    const placement = [
      'fixed',
      'inset-y-0',
      'h-svh',
      'data-[side=left]:left-0',
      'data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]',
      'data-[side=right]:right-0',
      'data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
    ];
    const breakpoint = ['hidden', 'md:flex'];
    const motion = ['transition-[left,right,width]', 'duration-200', 'ease-linear'];
    expectTable(SIDEBAR_CONTAINER_CLASSES, helmContainer, {
      departures: [...placement, ...breakpoint, ...motion],
      // Relative in place of fixed: still the containing block of helm's edge strip.
      additions: ['flex', 'h-full', 'relative', ...motionSafe(motion)],
    });
  });
});

describe('MENU_BUTTON_HELM_CLASSES', () => {
  const base = helmCvaBase(helmMenuButton);

  it('base is hlm-sidebar-menu-button’s less the icon size, with aria-current for data-active', () => {
    const active = [...ACTIVE_BUTTON, 'data-active:font-medium'];
    const motion = ['transition-[width,height,padding]'];
    expectTable(MENU_BUTTON_HELM_CLASSES.base, base, {
      departures: [...active, ...motion, '[&_neat-icon]:text-[length:--spacing(4)]'],
      additions: [...asCurrentPage(active), ...motionSafe(motion)],
    });
  });

  it('default size is the cva’s default size', () => {
    expectTable(MENU_BUTTON_HELM_CLASSES.size.default, helmSize('default'));
  });

  it('lg size is the cva’s lg less the avatar’s collapsed padding', () => {
    expectTable(MENU_BUTTON_HELM_CLASSES.size.lg, helmSize('lg'), {
      departures: ['group-data-[collapsible=icon]:p-0!'],
    });
  });

  it('the lg collapsed classes are the default row’s collapsed size and padding', () => {
    const collapsed = words(MENU_BUTTON_LG_COLLAPSED_CLASSES);
    expect(collapsed).toEqual([
      'group-data-[collapsible=icon]:size-8!',
      'group-data-[collapsible=icon]:p-2!',
    ]);
    for (const name of collapsed) expect(base).toContain(name);
  });
});

describe('SIDEBAR_BRAND_CLASSES', () => {
  it('is the lg menu button’s shape, without what makes a button of it', () => {
    const lg = [...words(MENU_BUTTON_HELM_CLASSES.base), ...helmSize('lg')];
    const brand = words(SIDEBAR_BRAND_CLASSES);
    for (const name of brand) expect(lg).toContain(name);
    // The lg row's height, and collapsed the logo alone, as helm's lg button with an avatar.
    expect(brand).toContain('h-12');
    expect(brand).toContain('group-data-[collapsible=icon]:size-8!');
    expect(brand).toContain('group-data-[collapsible=icon]:p-0!');
    expect(
      brand.filter((name) =>
        /hover:|active:|focus|ring|aria-|disabled|peer|group\/|data-open/.test(name),
      ),
    ).toEqual([]);
  });
});

describe('MENU_SUB_BUTTON_HELM_CLASSES', () => {
  it('md is hlm-sidebar-menu-sub-button’s less the icon size, with aria-current for data-active', () => {
    expectTable(MENU_SUB_BUTTON_HELM_CLASSES.md, helmHostClasses(helmMenuSubButton), {
      departures: [...ACTIVE_BUTTON, '[&>neat-icon]:text-[length:--spacing(4)]'],
      additions: asCurrentPage(ACTIVE_BUTTON),
    });
  });
});

describe('DRAWER_HELM_CLASSES', () => {
  it('overlay is hlm-sheet-overlay’s, its fade only under motion-safe', () => {
    const [overlay] = quoted(between(helmSheetOverlay, 'hlm(', 'this.userClass()'));
    const motion = [
      'data-open:animate-in',
      'data-closed:animate-out',
      'data-closed:fade-out-0',
      'data-open:fade-in-0',
      'duration-100',
    ];
    expectTable(DRAWER_HELM_CLASSES.overlay, words(overlay), {
      departures: motion,
      additions: motionSafe(motion),
    });
  });

  it('content is hlm-sheet-content’s base and animation, its motion only under motion-safe', () => {
    const motion = [
      'transition',
      'duration-200',
      'ease-in-out',
      'data-open:animate-in',
      'data-closed:animate-out',
    ];
    expectTable(DRAWER_HELM_CLASSES.content, helmSheetStrings.slice(0, 2).flatMap(words), {
      departures: motion,
      additions: motionSafe(motion),
    });
  });

  it('left is hlm-sheet-content’s left slide, only under motion-safe', () => {
    const slide = helmSheetSide('left');
    expectTable(DRAWER_HELM_CLASSES.left, slide, {
      departures: slide,
      additions: motionSafe(slide),
    });
  });
});

describe('DRAWER_WIDTH_CLASSES', () => {
  it('is hlm-sidebar’s mobile sheet content', () => {
    expectTable(DRAWER_WIDTH_CLASSES, helmMobileSidebar);
  });
});

describe('placement', () => {
  it('no sidebar table keeps fixed, svh sizing or inset-y-0', () => {
    // The drawer is exempt: it is a modal over the window, as the dialog is, so `fixed` and
    // `h-svh` are right there. The rail is absolute inside the container, so its inset-y-0 is its
    // own.
    const { rail, ...tables } = SIDEBAR_HELM_CLASSES;
    expect(rail).toContain('absolute');
    const sidebar = [
      ...Object.values(tables),
      SIDEBAR_CLASSES,
      SIDEBAR_CONTAINER_CLASSES,
      SIDEBAR_BRAND_CLASSES,
    ].flatMap(words);
    expect(sidebar.filter((name) => name === 'fixed' || name === 'inset-y-0')).toEqual([]);
    expect(sidebar.filter((name) => /svh|dvh|lvh/.test(name))).toEqual([]);
    expect(words(rail).filter((name) => /svh|dvh|lvh/.test(name))).toEqual([]);
  });

  it('no sidebar table hides itself below a breakpoint', () => {
    const all = [
      ...Object.values(SIDEBAR_HELM_CLASSES),
      SIDEBAR_CLASSES,
      SIDEBAR_CONTAINER_CLASSES,
      SIDEBAR_BRAND_CLASSES,
    ].flatMap(words);
    expect(
      all.filter((name) => name === 'hidden' || /^(sm|md|lg):(flex|block)$/.test(name)),
    ).toEqual([]);
  });
});
