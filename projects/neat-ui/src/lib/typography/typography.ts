import { Directive } from '@angular/core';
import {
  hlmBlockquote,
  hlmH1,
  hlmH2,
  hlmH3,
  hlmH4,
  hlmLarge,
  hlmLead,
  hlmMuted,
  hlmP,
  hlmSmall,
  hlmUl,
} from '../ui/typography/src';

/*
 * Spartan's typography: each directive binds helm's class constant for its element, used as data,
 * so a helm update reaches it by regeneration (typography.spec reads the vendored files and holds
 * each host to them). `neatProse` gives the plain elements of a container the same values in CSS
 * (prose.css, held to the same constants by prose.spec), so a page that mixes the two shows no seam.
 * The classes are literals in the vendored files, which the kit stylesheet's scan reads.
 */

/**
 * A page's title in Spartan's type: the largest size, extra bold, larger again on a wide screen.
 *
 * Like every heading of the typography, it keeps a 5rem scroll margin (Spartan's `scroll-m-20`),
 * so a link to it stops that far below the top of the box that scrolls.
 */
@Directive({
  selector: 'h1[neatH1]',
  host: { '[class]': 'classes' },
})
export class NeatH1 {
  protected readonly classes = hlmH1;
}

/**
 * A section heading in Spartan's type: semibold, ruled off below, with no space above it as the
 * first element of its container.
 */
@Directive({
  selector: 'h2[neatH2]',
  host: { '[class]': 'classes' },
})
export class NeatH2 {
  protected readonly classes = hlmH2;
}

/** A heading below a section's, in Spartan's type: semibold, a size below `neatH2`. */
@Directive({
  selector: 'h3[neatH3]',
  host: { '[class]': 'classes' },
})
export class NeatH3 {
  protected readonly classes = hlmH3;
}

/** The smallest heading of Spartan's type: semibold, a size above the text. */
@Directive({
  selector: 'h4[neatH4]',
  host: { '[class]': 'classes' },
})
export class NeatH4 {
  protected readonly classes = hlmH4;
}

/**
 * A paragraph in Spartan's type: a roomy line height, and 1.5rem above it unless it is the first
 * element of its container.
 */
@Directive({
  selector: 'p[neatP]',
  host: { '[class]': 'classes' },
})
export class NeatP {
  protected readonly classes = hlmP;
}

/** The paragraph that opens a page and says what it is for: large and muted. */
@Directive({
  selector: 'p[neatLead]',
  host: { '[class]': 'classes' },
})
export class NeatLead {
  protected readonly classes = hlmLead;
}

/**
 * Text a step larger than the body and semibold, on any element: a figure or a short statement
 * that stands out without being a heading.
 */
@Directive({
  selector: '[neatLarge]',
  host: { '[class]': 'classes' },
})
export class NeatLarge {
  protected readonly classes = hlmLarge;
}

/** Small print in medium weight, on one tight line: a label or a remark beside a value. */
@Directive({
  selector: 'small[neatSmall]',
  host: { '[class]': 'classes' },
})
export class NeatSmall {
  protected readonly classes = hlmSmall;
}

/**
 * A paragraph in the small size and the muted text color, for a remark under a block of text.
 *
 * Under a control or a heading, use `neatNote`, the kit's remark beside what it is about.
 */
@Directive({
  selector: 'p[neatMuted]',
  host: { '[class]': 'classes' },
})
export class NeatMuted {
  protected readonly classes = hlmMuted;
}

/** A quote in Spartan's type: italic, set off by a border at its start, 1.5rem above it. */
@Directive({
  selector: 'blockquote[neatBlockquote]',
  host: { '[class]': 'classes' },
})
export class NeatBlockquote {
  protected readonly classes = hlmBlockquote;
}

/**
 * A bulleted list in Spartan's type: inset by 1.5rem, 1.5rem above and below it, its items 0.5rem
 * apart.
 *
 * The items are plain `li` elements. A numbered list has no directive (Spartan has none): put it
 * in a `neatProse` container.
 */
@Directive({
  selector: 'ul[neatUl]',
  host: { '[class]': 'classes' },
})
export class NeatUl {
  protected readonly classes = hlmUl;
}

/**
 * Spartan's typography, one directive per element, for text an app sets element by element: the
 * headings `h1[neatH1]` to `h4[neatH4]`, `p[neatP]`, `p[neatLead]`, `[neatLarge]`,
 * `small[neatSmall]`, `p[neatMuted]`, `blockquote[neatBlockquote]` and `ul[neatUl]`. This array
 * holds them all, for a component's `imports`.
 *
 * ```ts
 * @Component({ imports: [NEAT_TYPOGRAPHY], templateUrl: './release-note.html' })
 * ```
 *
 * ```html
 * <h2 neatH2>What is new</h2>
 * <p neatP>A stream starts as soon as its camera answers.</p>
 * ```
 *
 * Inline code is `code[neatCode]` (`NeatCode`), Spartan's inline code. Keys are `neat-shortcut`'s.
 *
 * For a container of text, such as help or a README converted from Markdown, use `neatProse`. It
 * gives the plain elements inside it the same look, so the two never show a seam, and it covers
 * what Spartan has no directive for: `h5`, `h6`, numbered lists, links and keys.
 *
 * The directives set the look of their element only. A paragraph, a list and a quote bring
 * Spartan's space above them; a heading, the lead and small print bring none, so the page spaces
 * them. `neatProse` spaces all its blocks 1.5rem apart.
 */
export const NEAT_TYPOGRAPHY = [
  NeatH1,
  NeatH2,
  NeatH3,
  NeatH4,
  NeatP,
  NeatLead,
  NeatLarge,
  NeatSmall,
  NeatMuted,
  NeatBlockquote,
  NeatUl,
] as const;
