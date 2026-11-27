/**
 * The classes of Spartan's breadcrumb (helm's `hlm-breadcrumb-*` parts), copied verbatim. Helm
 * keeps them inline in each part, so they are held here as data: the drift spec reads the vendored
 * files and fails when a string is no longer in one.
 *
 * The kit's crumbs are buttons, which helm's link (an anchor with a router link) does not cover,
 * so the button adds only what a bare button needs on top of helm's link classes.
 */
export const BREADCRUMB_CLASSES = {
  list: 'text-muted-foreground gap-1.5 text-sm sm:gap-2.5 flex flex-wrap items-center wrap-break-word',
  item: 'gap-1.5 inline-flex items-center',
  link: 'hover:text-foreground transition-colors',
  page: 'text-foreground font-normal',
  separator: '[&>neat-icon]:text-[length:--spacing(3.5)] [&>neat-icon]:flex',
} as const;
