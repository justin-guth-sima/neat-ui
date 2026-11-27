/**
 * The classes of Spartan's breadcrumb (helm's `hlm-breadcrumb-*` parts), copied verbatim. Helm
 * keeps them inline in each part, so they are held here as data: the drift spec reads the vendored
 * files and holds each part to its file both ways, so a helm update that adds or drops a class
 * fails until this is reviewed. What the kit adds to two of them, a button crumb's needs and the
 * separator's centering, is `neat-breadcrumbs`' own (breadcrumbs.ts says why).
 */
export const BREADCRUMB_HELM_CLASSES = {
  list: 'text-muted-foreground gap-1.5 text-sm sm:gap-2.5 flex flex-wrap items-center wrap-break-word',
  item: 'gap-1.5 inline-flex items-center',
  link: 'hover:text-foreground transition-colors',
  page: 'text-foreground font-normal',
  separator: '[&>neat-icon]:text-[length:--spacing(3.5)] [&>neat-icon]:flex',
} as const;
