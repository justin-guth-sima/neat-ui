import { Directive } from '@angular/core';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. The values are the theme's `--muted-foreground` and the kit's `--neat-text-xs`.
 */
const NOTE_CLASSES = 'm-0 text-muted-foreground text-(length:--neat-text-xs)';

/**
 * A short note under a control or a heading: no margin, in the muted text color and the small
 * text size, as `<p neatNote>Applies to every channel without its own value.</p>`. It sets the look
 * only; the words, and any role, are the app's. A `neatInlineButton` inside takes the note's size
 * and color, so an action set into the note ("Show", "Use global") reads like the words around it.
 */
@Directive({
  selector: '[neatNote]',
  host: { class: NOTE_CLASSES },
})
export class NeatNote {}
