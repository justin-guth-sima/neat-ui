import { containsTree, Router, UrlTree } from '@angular/router';

/**
 * The open link of a list at `url`: of those whose path the route is under, the longest. Only the
 * path counts, never the query, matrix parameters or fragment. A link whose path is `exactPath`
 * is open on that path alone: a first view on its page's own path would otherwise stay open on
 * every sibling's route. Parsed with the router's own serializer, so every level of the kit's
 * navigation (the rail's sub-pages, the collapsed rail's menu, the page nav) agrees.
 * Internal to the kit.
 */
export function openLink<T extends { readonly path: string }>(
  links: readonly T[],
  url: UrlTree,
  router: Router,
  exactPath?: string,
): T | undefined {
  let open: T | undefined;
  for (const link of links) {
    if (
      (!open || link.path.length > open.path.length) &&
      containsTree(url, router.parseUrl(link.path), {
        paths: link.path === exactPath ? 'exact' : 'subset',
        queryParams: 'ignored',
        matrixParams: 'ignored',
        fragment: 'ignored',
      })
    ) {
      open = link;
    }
  }
  return open;
}
