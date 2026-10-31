// The page calls the harness through Playwright bindings, which every page of a context has, so
// a page that is closing or was left from an earlier run can still call. The run on screen
// listens for one page, named in `listener.current.page`; a call from any other is dropped.

/** The binding function for `key` (`onEvent` or `onInput`) of whatever listens now. */
export function bindingHandler(listener, key) {
  return (source, event) => {
    const current = listener.current;
    if (!current || source?.page !== current.page) return undefined;
    return current[key]?.(event);
  };
}
