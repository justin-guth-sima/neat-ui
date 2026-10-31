/*
 * The one place the results view touches the clipboard, which a page served over plain http (the
 * board's static server, as `python3 -m http.server`) may not use asynchronously: `navigator.
 * clipboard` exists only in a secure context. There the selection and `execCommand('copy')` of a
 * text area still copy, so it is the way out rather than the way in.
 */

/** Copies `text`; whether it was copied. */
export async function copyText(doc: Document, text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No async clipboard, or the browser refused it: copy the old way.
  }
  const area = doc.createElement('textarea');
  area.value = text;
  // Off screen and read-only, so a keyboard or a screen reader never meets it.
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.position = 'fixed';
  area.style.insetBlockStart = '-100vh';
  doc.body.append(area);
  try {
    area.select();
    return doc.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
