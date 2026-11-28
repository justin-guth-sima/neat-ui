import helmBubble from '../../../src/lib/ui/bubble/src/lib/hlm-bubble.ts?source' with {
  loader: 'text',
};
import helmBubbleContent from '../../../src/lib/ui/bubble/src/lib/hlm-bubble-content.ts?source' with {
  loader: 'text',
};
import helmMessage from '../../../src/lib/ui/message/src/lib/hlm-message.ts?source' with {
  loader: 'text',
};
import helmMessageContent from '../../../src/lib/ui/message/src/lib/hlm-message-content.ts?source' with {
  loader: 'text',
};
import helmMessageFooter from '../../../src/lib/ui/message/src/lib/hlm-message-footer.ts?source' with {
  loader: 'text',
};
import {
  classSet,
  helmCvaBase,
  helmCvaVariant,
  helmHostClasses,
  takenFromHelm,
} from '../../../src/lib/typography/helm-classes.testing';
import { TRANSCRIPT_CLASSES } from './transcript-classes';

const split = (classes: string) => classes.split(' ');

/** Helm's tinted fills, relative colors of the primary in place of which the kit takes a token. */
const TINTED_FILLS = [
  '*:data-[slot=bubble-content]:bg-[oklch(from_var(--primary)_0.93_calc(c*0.4)_h)]',
  'dark:*:data-[slot=bubble-content]:bg-[oklch(from_var(--primary)_0.3_calc(c*0.4)_h)]',
];

/** Helm's hover looks of a bubble that is a button or a link: neither message is one. */
const TINTED_HOVER = [
  '[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--primary)_0.88_calc(c*0.5)_h)]',
  'dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-[oklch(from_var(--primary)_0.35_calc(c*0.5)_h)]',
];
const GHOST_HOVER = [
  '[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted',
  '[&>[data-slot=bubble-content]:is(button,a):hover]:text-foreground',
  'dark:[&>[data-slot=bubble-content]:is(button,a):hover]:bg-muted/50',
];

describe('TRANSCRIPT_CLASSES', () => {
  it('helm drift: a message is helm’s message at the base text size', () => {
    expect(classSet(split(TRANSCRIPT_CLASSES.message))).toEqual(
      takenFromHelm(helmHostClasses(helmMessage), { departures: ['text-sm'] }),
    );
  });

  it('helm drift: its content is helm’s message content, class for class', () => {
    expect(classSet(split(TRANSCRIPT_CLASSES.messageContent))).toEqual(
      classSet(helmHostClasses(helmMessageContent)),
    );
  });

  it('helm drift: its footer is helm’s message footer, its items wrapping apart', () => {
    expect(classSet(split(TRANSCRIPT_CLASSES.footer))).toEqual(
      takenFromHelm(helmHostClasses(helmMessageFooter), { additions: ['flex-wrap', 'gap-2'] }),
    );
  });

  it('helm drift: the question is helm’s tinted bubble, its fill the theme’s token, no hover', () => {
    expect(classSet(split(TRANSCRIPT_CLASSES.questionBubble))).toEqual(
      takenFromHelm([...helmCvaBase(helmBubble), ...helmCvaVariant(helmBubble, 'tinted')], {
        departures: [...TINTED_FILLS, ...TINTED_HOVER],
        additions: ['*:data-[slot=bubble-content]:bg-neat-question-fill'],
      }),
    );
  });

  it('helm drift: the reply is helm’s ghost bubble across the width, no hover', () => {
    expect(classSet(split(TRANSCRIPT_CLASSES.replyBubble))).toEqual(
      takenFromHelm([...helmCvaBase(helmBubble), ...helmCvaVariant(helmBubble, 'ghost')], {
        departures: ['w-fit', ...GHOST_HOVER],
        additions: ['w-full'],
      }),
    );
  });

  it('helm drift: the question’s content is helm’s bubble content at the base size, unclipped', () => {
    expect(classSet(split(TRANSCRIPT_CLASSES.questionContent))).toEqual(
      takenFromHelm(helmHostClasses(helmBubbleContent), {
        departures: ['text-sm', 'overflow-hidden'],
      }),
    );
  });

  it('helm drift: the reply’s content is the same across the width', () => {
    expect(classSet(split(TRANSCRIPT_CLASSES.replyContent))).toEqual(
      takenFromHelm(helmHostClasses(helmBubbleContent), {
        departures: ['text-sm', 'overflow-hidden', 'w-fit'],
        additions: ['w-full'],
      }),
    );
  });
});
