import { ElementRef, inject, InjectionToken, type FactoryProvider } from '@angular/core';

/**
 * A part of the shell or the page that an expanded element inside it can cover (`NeatExpand`'s
 * `region`), provided by that part to what is inside it: its own template and the content
 * projected into it, a routed page in the shell's outlet among it. Internal.
 */
export interface ExpandArea {
  /** The area's element, once its part has rendered. */
  element(): HTMLElement | undefined;
}

/** The shell's content area (`main.content`), provided by `NeatShell`: the region `content`. */
export const SHELL_CONTENT_AREA = new InjectionToken<ExpandArea>('neat-ui: the shell content area');

/** The page's body, provided by `NeatPage`: the region `body`. */
export const PAGE_BODY_AREA = new InjectionToken<ExpandArea>('neat-ui: the page body');

/**
 * Provides `token` as the element of the providing component's own template that `selector` finds
 * from its host (`:scope > …`, so a nested shell's or page's is not found). Looked up when an
 * element expands, by which time the template has rendered.
 */
export function provideExpandArea(
  token: InjectionToken<ExpandArea>,
  selector: string,
): FactoryProvider {
  return {
    provide: token,
    useFactory: (): ExpandArea => {
      const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
      return { element: () => host.querySelector<HTMLElement>(selector) ?? undefined };
    },
  };
}
