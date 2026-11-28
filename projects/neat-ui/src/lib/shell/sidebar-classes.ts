/*
 * The shell's sidebar and its phone drawer, as classes: copies of Spartan's helm `sidebar` and
 * `sheet` (vendored under `lib/ui/`, never imported), each table held to its helm file both ways by
 * `sidebar-classes.spec.ts`. Why copies and not helm's components: `HlmSidebarService` is root
 * provided and writes a cookie, binds Ctrl+B and runs a second 768 px breakpoint of its own, and
 * helm's container is `fixed`, which escapes a bounded shell. The shell keeps its own state
 * (`RailState`), breakpoint (`NeatViewport`) and templates, and takes helm's look from these.
 *
 * Departures from helm, each named in the spec:
 * - The sidebar is a column of the shell's grid, so its container is `relative` rather than
 *   `fixed`, has no side offsets and is `h-full` rather than `h-svh`.
 * - The shell decides narrow or wide through `NeatViewport`, never a CSS breakpoint, so the sidebar
 *   is shown without `hidden md:block`, and the container and the edge strip are `flex` (as helm's
 *   wide branch shows them), not `hidden` until `md:` or `sm:`.
 * - Collapsed, the content hides only its sideways overflow, where helm hides all of it, so the pages
 *   still scroll and a short window reaches every one.
 * - Motion (the width transition, the drawer's slide and fade) runs only under `motion-safe:`.
 * - The icon size is the icon's `[size]`, not a selector (`neat-icon` ignores helm's).
 * - The current page is `aria-current="page"`, which the shell already sets, rather than a second
 *   `data-active` attribute kept in step with it.
 * - The divider stays `w-auto` while horizontal, where helm's base separator is as wide as its
 *   row and overruns the sidebar's inset.
 * - The drawer is the mobile sidebar's 18rem, not the sheet's three quarters of the screen.
 *
 * `inner` is the desktop branch of `hlm-sidebar.ts`, default variant; the drawer's width is its
 * mobile branch. Class strings are literals, as Tailwind reads the sources.
 */

import { hlm } from '../ui/utils/src';

/**
 * Helm's sidebar element on a wide screen (`hlm-sidebar.ts`): the `group` whose state attributes
 * (`data-state`, `data-collapsible`, `data-side`, `data-variant`) the parts' `group-data-[…]`
 * classes key on. Shown without helm's `hidden md:block`: the shell renders it only while wide.
 */
export const SIDEBAR_CLASSES = 'group peer text-sidebar-foreground';

/**
 * Helm's sidebar parts, from the matching `hlm-sidebar-*.ts`, `inner` from `hlm-sidebar.ts`. `edge`
 * is helm's `hlm-sidebar-rail.ts`, the strip along the sidebar's edge that a pointer clicks to
 * toggle it; the kit's "rail" is the whole sidebar.
 */
export const SIDEBAR_HELM_CLASSES = {
  inner:
    'bg-sidebar group-data-[variant=floating]:ring-sidebar-border group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 flex size-full flex-col',
  header: 'gap-2 p-2 flex flex-col',
  group: 'p-2 relative flex w-full min-w-0 flex-col',
  content:
    'no-scrollbar gap-2 flex min-h-0 flex-1 flex-col overflow-auto group-data-[collapsible=icon]:overflow-x-hidden',
  footer: 'gap-2 p-2 flex flex-col',
  menu: 'gap-1 flex w-full min-w-0 flex-col',
  menuItem: 'group/menu-item relative',
  menuSub:
    'border-sidebar-border mx-3.5 translate-x-px gap-1 border-s px-2.5 py-0.5 group-data-[collapsible=icon]:hidden rtl:-translate-x-px flex min-w-0 flex-col',
  menuSubItem: 'group/menu-sub-item relative',
  edge: 'hover:after:bg-sidebar-border absolute inset-y-0 z-20 flex w-4 motion-safe:transition-all motion-safe:ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] ltr:-translate-x-1/2 rtl:-translate-x-1/2 in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize [[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full [[data-side=left][data-collapsible=offcanvas]_&]:-right-2 [[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
  // `data-horizontal:w-auto` is the kit's: helm's base separator is `data-horizontal:w-full`, which
  // outweighs `w-auto` on a divider that writes `data-horizontal` and overruns its row's inset.
  separator: 'bg-sidebar-border mx-2 w-auto data-horizontal:w-auto',
} as const;

/**
 * Helm's desktop container (default variant), as a column of the shell: not `fixed` but
 * `relative`, so it is still the containing block of helm's edge strip, and `h-full`.
 */
export const SIDEBAR_CONTAINER_CLASSES =
  'relative z-10 flex h-full w-(--sidebar-width) motion-safe:transition-[left,right,width] motion-safe:duration-200 motion-safe:ease-linear group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l';

/** Helm's menu button (`hlm-sidebar-menu-button.ts`): its base and its `default` and `lg` sizes. */
export const MENU_BUTTON_HELM_CLASSES = {
  base: 'ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground gap-2 rounded-md p-2 text-start text-sm motion-safe:transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pe-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! focus-visible:ring-2 aria-[current=page]:font-medium peer/menu-button group/menu-button flex w-full items-center overflow-hidden outline-hidden disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_neat-icon]:shrink-0 [&>span:last-child]:truncate',
  size: {
    default: 'h-8 text-sm',
    lg: 'h-12 text-sm',
  },
} as const;

/**
 * What the `lg` row takes in place of helm's `group-data-[collapsible=icon]:p-0!` (an avatar's
 * rule): the default row's collapsed size and padding, so a collapsed `lg` row is an icon square.
 */
export const MENU_BUTTON_LG_COLLAPSED_CLASSES =
  'group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!';

/**
 * The sidebar header's brand row (the logo, the app name and its detail): the shape of helm's `lg`
 * menu button, without what makes a button of it (hover, focus ring, active and current looks),
 * since the brand is no control. Collapsed, the logo alone, in helm's `lg` row's `p-0!`.
 */
export const SIDEBAR_BRAND_CLASSES =
  'flex h-12 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-start text-sm motion-safe:transition-[width,height,padding] group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!';

/** Helm's menu sub button (`hlm-sidebar-menu-sub-button.ts`), size `md`. */
export const MENU_SUB_BUTTON_HELM_CLASSES = {
  md: 'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground h-7 gap-2 rounded-md px-2 focus-visible:ring-2 data-[size=md]:text-sm data-[size=sm]:text-xs flex min-w-0 -translate-x-px items-center overflow-hidden outline-hidden group-data-[collapsible=icon]:hidden disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>neat-icon]:shrink-0 [&>span:last-child]:truncate',
} as const;

/** Helm's sheet (`hlm-sheet-overlay.ts`, `hlm-sheet-content.ts`) for the phone drawer, sliding in from the left. */
export const DRAWER_HELM_CLASSES = {
  overlay:
    'motion-safe:data-open:animate-in motion-safe:data-closed:animate-out motion-safe:data-closed:fade-out-0 motion-safe:data-open:fade-in-0 isolate bg-black/10 motion-safe:duration-100 supports-backdrop-filter:backdrop-blur-xs',
  content:
    'bg-popover text-popover-foreground fixed flex flex-col gap-4 bg-clip-padding text-sm shadow-lg motion-safe:transition motion-safe:duration-200 motion-safe:ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm motion-safe:data-open:animate-in motion-safe:data-closed:animate-out',
  left: 'motion-safe:data-[side=left]:data-closed:slide-out-to-left motion-safe:data-[side=left]:data-open:slide-in-from-left',
} as const;

/** Helm's mobile sidebar panel (`hlm-sidebar.ts`): its width is `--sidebar-width`, set to the mobile width on the panel. */
export const DRAWER_WIDTH_CLASSES =
  'bg-sidebar text-sidebar-foreground h-svh w-(--sidebar-width) p-0 [&>button]:hidden';

/**
 * The drawer's scrim and panel: helm's sheet from the left, as helm's mobile sidebar has it. The
 * kit's one addition, `data-[side=left]:w-(--sidebar-width)`: the panel is the mobile sidebar's
 * width (`--sidebar-width`, 18rem in `shell.css`), where helm's own sheet class for the left side
 * (three quarters of the screen) outweighs it, so the merge drops that one.
 */
export const DRAWER_CLASSES = {
  overlay: DRAWER_HELM_CLASSES.overlay,
  panel: hlm(
    DRAWER_HELM_CLASSES.content,
    DRAWER_HELM_CLASSES.left,
    DRAWER_WIDTH_CLASSES,
    'data-[side=left]:w-(--sidebar-width)',
  ),
} as const;
