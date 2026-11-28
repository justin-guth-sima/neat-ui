import helmAddon from '../../../src/lib/ui/input-group/src/lib/hlm-input-group-addon.ts?source' with {
  loader: 'text',
};
import helmGroup from '../../../src/lib/ui/input-group/src/lib/hlm-input-group.ts?source' with {
  loader: 'text',
};
import helmGroupTextarea from '../../../src/lib/ui/input-group/src/lib/hlm-input-group-textarea.ts?source' with {
  loader: 'text',
};
import helmTextarea from '../../../src/lib/ui/textarea/src/lib/hlm-textarea.ts?source' with {
  loader: 'text',
};
import {
  classSet,
  helmCvaBase,
  helmCvaVariant,
  helmHostClasses,
  takenFromHelm,
} from '../../../src/lib/typography/helm-classes.testing';
import {
  HELM_PARTS,
  INPUT_GROUP_HELM_CLASSES,
  MESSAGE_BOX_CHANGES,
  MESSAGE_BOX_CLASSES,
  TEXTAREA_HELM_CLASSES,
} from './message-box-classes';

const names = (text: string) => text.split(/\s+/).filter(Boolean);
const copy = (text: string) => classSet(names(text));

describe('the message box on helm’s input group', () => {
  it('helm drift: the copied class strings are helm’s input group and textarea, less the inline addons', () => {
    expect(copy(INPUT_GROUP_HELM_CLASSES.group)).toEqual(takenFromHelm(helmHostClasses(helmGroup)));
    const block = ['block-start', 'block-end'];
    const inlineOnly = ['inline-start', 'inline-end']
      .flatMap((align) => helmCvaVariant(helmAddon, align))
      .filter((name) => !block.flatMap((align) => helmCvaVariant(helmAddon, align)).includes(name));
    expect(
      copy(
        [
          INPUT_GROUP_HELM_CLASSES.addonBase,
          INPUT_GROUP_HELM_CLASSES.addon['block-start'],
          INPUT_GROUP_HELM_CLASSES.addon['block-end'],
        ].join(' '),
      ),
    ).toEqual(
      takenFromHelm(
        [
          ...helmCvaBase(helmAddon),
          ...['inline-start', 'inline-end', ...block].flatMap((a) => helmCvaVariant(helmAddon, a)),
        ],
        { departures: inlineOnly },
      ),
    );
    expect(copy(INPUT_GROUP_HELM_CLASSES.textarea)).toEqual(
      takenFromHelm(helmHostClasses(helmGroupTextarea)),
    );
    expect(copy(TEXTAREA_HELM_CLASSES)).toEqual(takenFromHelm(helmHostClasses(helmTextarea)));
  });

  for (const part of ['group', 'textarea', 'pictures', 'row'] as const) {
    it(`the ${part} is helm’s, less exactly its named departures and plus its additions`, () => {
      expect(copy(MESSAGE_BOX_CLASSES[part])).toEqual(
        takenFromHelm(names(HELM_PARTS[part]), MESSAGE_BOX_CHANGES[part]),
      );
    });
  }
});
