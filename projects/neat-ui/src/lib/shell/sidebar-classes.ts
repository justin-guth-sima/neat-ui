/*
 * The shell's sidebar and its phone drawer, as classes: copies of Spartan's helm `sidebar` and
 * `sheet` (vendored under `lib/ui/`, never imported), each table held to its helm file both ways by
 * `sidebar-classes.spec.ts`. Why copies and not helm's components: `HlmSidebarService` is root
 * provided and writes a cookie, binds Ctrl+B and runs a second 768 px breakpoint of its own, and
 * helm's container is `fixed`, which escapes a bounded shell. The shell keeps its own state
 * (`RailState`), breakpoint (`NeatViewport`) and templates, and takes helm's look from these.
 *
 * Departures from helm, each named in the spec:
 * - The sidebar is a column of the shell's grid, so its container is not `fixed`, has no side
 *   offsets and is `h-full` rather than `h-svh`.
 * - The shell decides narrow or wide through `NeatViewport`, never a CSS breakpoint, so the container
 *   and the rail are `flex` (as helm's wide branch shows them), not `hidden` until `md:` or `sm:`,
 *   and the wrapper is `h-full` of the shell's grid, not `min-h-svh`.
 * - Motion (the width transition, the drawer's slide and fade) runs only under `motion-safe:`.
 * - The icon size is the icon's `[size]`, not a selector (`neat-icon` ignores helm's).
 * - The current page is `aria-current="page"`, which the shell already sets, rather than a second
 *   `data-active` attribute kept in step with it.
 *
 * `gap` and `inner` are the desktop branch of `hlm-sidebar.ts`, default variant; the drawer's
 * width is its mobile branch. Class strings are literals, as Tailwind reads the sources.
 */

/** Helm's sidebar parts, from the matching `hlm-sidebar-*.ts`, `gap` and `inner` from `hlm-sidebar.ts`. */
export const SIDEBAR_HELM_CLASSES = {
  wrapper: 'group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex h-full w-full',
  gap: 'motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-linear relative w-(--sidebar-width) bg-transparent group-data-[collapsible=offcanvas]:w-0 group-data-[side=right]:rotate-180 group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
  inner:
    'bg-sidebar group-data-[variant=floating]:ring-sidebar-border group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 flex size-full flex-col',
  header: 'gap-2 p-2 flex flex-col',
  content:
    'no-scrollbar gap-2 flex min-h-0 flex-1 flex-col overflow-auto group-data-[collapsible=icon]:overflow-hidden',
  footer: 'gap-2 p-2 flex flex-col',
  menu: 'gap-1 flex w-full min-w-0 flex-col',
  menuItem: 'group/menu-item relative',
  menuSub:
    'border-sidebar-border mx-3.5 translate-x-px gap-1 border-s px-2.5 py-0.5 group-data-[collapsible=icon]:hidden rtl:-translate-x-px flex min-w-0 flex-col',
  menuSubItem: 'group/menu-sub-item relative',
  rail: 'hover:after:bg-sidebar-border absolute inset-y-0 z-20 flex w-4 motion-safe:transition-all motion-safe:ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] ltr:-translate-x-1/2 rtl:-translate-x-1/2 in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize [[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full [[data-side=left][data-collapsible=offcanvas]_&]:-right-2 [[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
  inset:
    'bg-background md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ms-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ms-2 relative flex w-full flex-1 flex-col',
  separator: 'bg-sidebar-border mx-2 w-auto',
} as const;

/** Helm's desktop container (default variant), as a column of the shell: not `fixed`, `h-full`. */
export const SIDEBAR_CONTAINER_CLASSES =
  'z-10 flex h-full w-(--sidebar-width) motion-safe:transition-[left,right,width] motion-safe:duration-200 motion-safe:ease-linear group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l';

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
