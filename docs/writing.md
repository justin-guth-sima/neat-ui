# Writing for neat-ui

How we write everything people read in this repo: the README, the docs, the showcase, doc comments
and example descriptions. It applies to humans and agents alike.

Our readers are app developers building Neat apps with the kit. Some work with coding agents, some
without. People evaluating the kit read the README's first screen; contributors read
[AGENTS.md](../AGENTS.md).

## The one principle: layered, not trimmed

A person must be able to read our docs unaided, and an agent must lose nothing. So we never cut a
rule or its reason to make a page shorter. We put it in the right layer instead:

1. **First, what a person needs:** what it is, a picture, the shortest example, when to use it.
2. **Then the details:** options, behavior, edge cases, rules and their reasons.
3. **Last, or one link away, the reference:** the full API.

A reader stops when they have enough. An agent reads on.

## The basics

- **American English** (color, center, behavior, analyze). `npm run test:tools` fails on the
  British spellings the repo used to have.
- **[Google's developer documentation style guide](https://developers.google.com/style)** is our
  base. This page covers only what is specific to this repo.
- **Second person, present tense, active voice.** "The chart shows the newest sample", not "the
  newest sample will be shown".
- **Short sentences, one idea each.** Aim for under 25 words. Split a sentence with a semicolon in
  it.
- **Short paragraphs, one topic each.** Three or four sentences at most.
- **Plain words.** Say what a term means the first time it appears, or link to where it is
  explained.
- **No filler.** Leave out "simply", "just", "easily", "obviously", "note that".
- **Code names exactly as in code**, in backticks: `neat-time-chart`, `hovered`, `NeatSeries`.
  Never respell or translate them.
- **Sentence case headings.** A how-to heading names the task: "Share a crosshair between charts".

## Structure

- **Lists** for three or more parallel items. **Numbered lists** for steps in order.
- **Tables** to compare options, or for the API.
- **Rules** read "**Do X.** Why: ...", so a reader sees the rule first and the reason right after.
- **One page shape everywhere.** A reader learns it once; an agent finds the same section in the
  same place.

### A component's page

1. The name and one sentence: what it is for.
2. A picture, light and dark.
3. The shortest working example, with its import.
4. When to use it, and when to use something else.
5. Examples, each a heading that names what it shows.
6. Behavior and details: keyboard, accessibility, sizing, edge cases.
7. The API.

### A doc comment

- **The first sentence stands alone.** Editors show it on hover, and the docs show it in lists.
- Then the details, in the order of the page above.
- An example in an `html` or `ts` code block when usage is not obvious.
- A deprecated part says what to use instead: `@deprecated Use \`colors\`; this name goes in a
  later release.`

### A showcase example's description

- One or two sentences: what it shows.
- Then what to try: "Hover a car", "Drag to pan".

## Words we use

**Use the [glossary](glossary.md)'s name for each thing, and add a new term there before you use
it.** Why: one name per thing lets a reader find every place that talks about it; a second name
makes it look like a second thing. Established UI names (card, dialog, tooltip) win over our own.
Name the thing, not its shape: "the block", not "the box".

| Write               | Not                               |
| ------------------- | --------------------------------- |
| the kit             | the library, neat-ui (in prose)   |
| app                 | application, consumer             |
| entry point         | sub-package, module               |
| the showcase        | the demo, the docs app            |
| color, center, gray | colour, centre, grey              |
| ms, s, px, m        | milliseconds (in figures), metres |

## Pictures

- Every image has alt text that says what it shows, not "screenshot".
- Light and dark, with `<picture>`, so GitHub shows the reader's theme.
- Stills by default. A short loop only where the component moves.
- Small: WebP, cropped to what matters. The docs generator warns past its size budget.
