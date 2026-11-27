/*
 * The transcript on helm's message and helm's bubble: their classes, copied from the vendored files
 * because helm keeps them inline (`src/lib/ui/message/`, `src/lib/ui/bubble/`). Each message is
 * helm's message (`data-slot="message"`, the question aligned at the end) with no avatar, its
 * content holding one helm bubble and the app's footer. The question is helm's `tinted` bubble, the
 * reply its `ghost` (no fill, no padding). transcript-classes.spec holds each string to its helm
 * file both ways, with the kit's changes named there:
 *
 * - The base text size, not helm's `text-sm` (message and bubble content): the replies are the
 *   kit's prose, whose Spartan typography is set for it (`hlmP`'s `leading-7` stood the lines of
 *   14px text twice their height apart), and the question reads at the reply's size.
 * - The tinted fill is the theme's `--neat-question-fill`, helm's recipe for the primary as a
 *   token, so the theme spec holds the text to it in both schemes. Helm's hover fills of a bubble
 *   that is a button or a link go with its fills: neither message is one.
 * - No `overflow-hidden` on the content: a picture's reading reaches past the question's box (the
 *   viewfinder's label above the picture, the patches flying into the reply's orb), and the orb's
 *   glow where a patch lands reaches past the reply's.
 * - The reply's bubble and content are `w-full`, not `w-fit`: a reply takes the row's width as
 *   before (its word cloud, its speech strip and the equalizer's gutter at its end).
 * - The footer's items wrap and keep apart (`flex-wrap gap-2`), as the app's line did in 0.44.
 *
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading them.
 */
export const TRANSCRIPT_CLASSES = {
  /** `hlm-message.ts`, less `text-sm`. */
  message: 'gap-2.5 group/message relative flex w-full min-w-0 data-[align=end]:flex-row-reverse',
  /** `hlm-message-content.ts`. */
  messageContent:
    'gap-3 flex w-full min-w-0 flex-col wrap-break-word group-data-[align=end]/message:*:data-slot:self-end',
  /** `hlm-message-footer.ts`, plus `flex-wrap gap-2`. */
  footer:
    'text-muted-foreground px-3.5 text-xs font-medium flex flex-wrap gap-2 max-w-full min-w-0 items-center group-has-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end',
  /** `hlm-bubble.ts`: the base and the `tinted` variant, its fill the theme's token. */
  questionBubble:
    'max-w-[80%] gap-1.5 group/bubble relative flex w-fit min-w-0 flex-col group-data-[align=end]/message:self-end data-[align=end]:self-end data-[variant=ghost]:max-w-full *:data-[slot=bubble-content]:text-foreground *:data-[slot=bubble-content]:bg-neat-question-fill',
  /** `hlm-bubble-content.ts`, less `text-sm` and `overflow-hidden`. */
  questionContent:
    'rounded-xl px-3.5 py-2.5 leading-relaxed [button,a]:focus-visible:border-ring [button,a]:focus-visible:ring-ring/50 w-fit max-w-full min-w-0 border border-transparent wrap-break-word group-data-[align=end]/bubble:self-end [button]:text-start [button,a]:transition-colors [button,a]:outline-none [button,a]:focus-visible:ring-3',
  /** `hlm-bubble.ts`: the base and the `ghost` variant, `w-full` for `w-fit`. */
  replyBubble:
    'max-w-[80%] gap-1.5 group/bubble relative flex w-full min-w-0 flex-col group-data-[align=end]/message:self-end data-[align=end]:self-end data-[variant=ghost]:max-w-full [&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted [&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted/50 border-none *:data-[slot=bubble-content]:rounded-none *:data-[slot=bubble-content]:bg-transparent *:data-[slot=bubble-content]:p-0',
  /** `hlm-bubble-content.ts`, less `text-sm` and `overflow-hidden`, `w-full` for `w-fit`. */
  replyContent:
    'rounded-xl px-3.5 py-2.5 leading-relaxed [button,a]:focus-visible:border-ring [button,a]:focus-visible:ring-ring/50 w-full max-w-full min-w-0 border border-transparent wrap-break-word group-data-[align=end]/bubble:self-end [button]:text-start [button,a]:transition-colors [button,a]:outline-none [button,a]:focus-visible:ring-3',
} as const;
