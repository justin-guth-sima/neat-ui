import helmEmpty from '../../../src/lib/ui/empty/src/lib/hlm-empty.ts?source' with {
  loader: 'text',
};
import helmEmptyContent from '../../../src/lib/ui/empty/src/lib/hlm-empty-content.ts?source' with {
  loader: 'text',
};
import helmEmptyDescription from '../../../src/lib/ui/empty/src/lib/hlm-empty-description.ts?source' with {
  loader: 'text',
};
import helmEmptyHeader from '../../../src/lib/ui/empty/src/lib/hlm-empty-header.ts?source' with {
  loader: 'text',
};
import helmEmptyMedia from '../../../src/lib/ui/empty/src/lib/hlm-empty-media.ts?source' with {
  loader: 'text',
};
import helmEmptyTitle from '../../../src/lib/ui/empty/src/lib/hlm-empty-title.ts?source' with {
  loader: 'text',
};
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NeatIcon, type NeatIconName } from '@sima/neat-ui';
import {
  classSet,
  helmCvaBase,
  helmCvaVariant,
  helmHostClasses,
  takenFromHelm,
} from '../../../src/lib/typography/helm-classes.testing';
import { NeatEmpty } from './empty';

@Component({
  imports: [NeatEmpty],
  template: `
    <neat-empty [icon]="icon()" heading="No streams to show" [headingLevel]="level()">
      Every tile is hidden.
      @if (withAction()) {
        <button type="button" neatEmptyActions>Show all tiles</button>
      }
    </neat-empty>
  `,
})
class EmptyHost {
  readonly icon = signal<NeatIconName | undefined>('media');
  readonly level = signal<2 | 3 | 4 | 5 | 6>(3);
  readonly withAction = signal(true);
}

async function render(setup: (host: EmptyHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(EmptyHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const empty: HTMLElement = fixture.nativeElement.querySelector('neat-empty');
  const slot = (name: string) => empty.querySelector<HTMLElement>(`[data-slot="empty-${name}"]`);
  return { fixture, host: fixture.componentInstance, empty, slot };
}

describe('NeatEmpty', () => {
  it('shows the icon, the heading, the description and the actions', async () => {
    const { slot, fixture } = await render();

    expect(slot('title')!.textContent!.trim()).toBe('No streams to show');
    expect(slot('description')!.textContent!.trim()).toBe('Every tile is hidden.');
    expect(slot('description')!.querySelector('button')).toBeNull();
    expect(slot('content')!.querySelector('button')!.textContent).toBe('Show all tiles');
    expect(slot('media')!.querySelector('neat-icon')).not.toBeNull();
    expect(fixture.debugElement.query(By.directive(NeatIcon)).componentInstance.name()).toBe(
      'media',
    );
  });

  it('draws the icon on helm’s icon media and none without an icon', async () => {
    const { slot, host, fixture } = await render();
    expect(slot('media')!.getAttribute('data-variant')).toBe('icon');

    host.icon.set(undefined);
    await fixture.whenStable();
    expect(slot('media')).toBeNull();
  });

  it('puts the title in a real heading at headingLevel, 3 by default', async () => {
    const { slot, host, fixture } = await render();
    const title = slot('title')!;
    expect(title.getAttribute('role')).toBe('heading');
    expect(title.getAttribute('aria-level')).toBe('3');

    host.level.set(2);
    await fixture.whenStable();
    expect(title.getAttribute('aria-level')).toBe('2');
  });

  it('leaves out the actions row when there are no actions', async () => {
    const { slot, host, fixture } = await render();
    host.withAction.set(false);
    await fixture.whenStable();
    expect([...slot('content')!.classList]).toContain('empty:hidden');
    expect(slot('content')!.children.length).toBe(0);
  });

  it('helm drift: the host, header, title, description and content are helm’s classes', async () => {
    const { empty, slot } = await render();
    // The description and the actions row hide when empty, so no gap stays for them.
    const cases: [HTMLElement, string, string[]][] = [
      [empty, helmEmpty, []],
      [slot('header')!, helmEmptyHeader, []],
      [slot('title')!, helmEmptyTitle, []],
      [slot('description')!, helmEmptyDescription, ['empty:hidden']],
      [slot('content')!, helmEmptyContent, ['empty:hidden']],
    ];
    for (const [element, helm, additions] of cases) {
      expect(classSet(element.classList), element.dataset['slot']).toEqual(
        takenFromHelm(helmHostClasses(helm), { additions }),
      );
    }
  });

  it('helm drift: the media is helm’s base and its icon variant', async () => {
    const { slot } = await render();
    expect(classSet(slot('media')!.classList)).toEqual(
      takenFromHelm([...helmCvaBase(helmEmptyMedia), ...helmCvaVariant(helmEmptyMedia, 'icon')]),
    );
  });
});
