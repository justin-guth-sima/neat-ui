import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import helmCard from '../../../src/lib/ui/card/src/lib/hlm-card.ts?source' with { loader: 'text' };
import helmAction from '../../../src/lib/ui/card/src/lib/hlm-card-action.ts?source' with {
  loader: 'text',
};
import helmContent from '../../../src/lib/ui/card/src/lib/hlm-card-content.ts?source' with {
  loader: 'text',
};
import helmDescription from '../../../src/lib/ui/card/src/lib/hlm-card-description.ts?source' with {
  loader: 'text',
};
import helmFooter from '../../../src/lib/ui/card/src/lib/hlm-card-footer.ts?source' with {
  loader: 'text',
};
import helmHeader from '../../../src/lib/ui/card/src/lib/hlm-card-header.ts?source' with {
  loader: 'text',
};
import helmTitle from '../../../src/lib/ui/card/src/lib/hlm-card-title.ts?source' with {
  loader: 'text',
};
import { CARD_HELM_CLASSES, CARD_KIT_DROPPED, kitCardClasses, NeatCard } from './card';
import cardStyles from './card.css' with { loader: 'text' };

/** The variant that takes the header out of the layout while it holds nothing to show. */
const HEADER_HIDDEN_WHEN_EMPTY =
  '[&:not(:has([data-slot=card-title],[data-slot=card-description],[data-slot=card-action]:not(:empty)))]:hidden';

/** The value a rule with exactly this selector declares for a property, or `undefined`. */
function declared(selector: string, property: string): string | undefined {
  const escaped = selector.replace(/[.:()[\]*,]/g, '\\$&');
  const body = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(cardStyles)?.[1] ?? '';
  return new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(body)?.[1];
}

@Component({
  imports: [NeatCard],
  template: `
    <neat-card title="Detections">
      <button type="button" neatCardTitle class="own">Detections</button>
      <p>Nothing yet.</p>
    </neat-card>
  `,
})
class TitleSlotHost {}

// Only NeatCard is imported: the actions and footer attributes are the card's own selectors.
@Component({
  imports: [NeatCard],
  template: `
    <neat-card [title]="title()" [subtitle]="subtitle()">
      @if (withActions()) {
        <button type="button" neatCardActions>Clear</button>
      }
      @if (withFooter()) {
        <p neatCardFooter>Updated now</p>
      }
      <p class="content">Nothing yet.</p>
    </neat-card>
  `,
})
class CardHost {
  readonly title = signal('Detections');
  readonly subtitle = signal('Last minute');
  readonly withActions = signal(true);
  readonly withFooter = signal(true);
}

async function render(setup: (host: CardHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(CardHost);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const card: HTMLElement = fixture.nativeElement.querySelector('neat-card');
  const slot = (name: string) => card.querySelector<HTMLElement>(`[data-slot="${name}"]`);
  return { fixture, card, slot };
}

describe('NeatCard', () => {
  it('renders the title and the subtitle and names the region by the title', async () => {
    const { card, slot } = await render();

    const title = slot('card-title')!;
    expect(title.textContent!.trim()).toBe('Detections');
    expect(slot('card-description')!.textContent!.trim()).toBe('Last minute');
    expect(card.getAttribute('role')).toBe('region');
    expect(title.id).not.toBe('');
    expect(card.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('takes an element for the title with neatCardTitle, which still names the region', async () => {
    const fixture = TestBed.createComponent(TitleSlotHost);
    await fixture.whenStable();
    const card: HTMLElement = fixture.nativeElement.querySelector('neat-card');
    const title = card.querySelector<HTMLElement>('[data-slot="card-title"]')!;

    // The element stands in the title's heading, in place of its text; the content has none of it.
    expect(title.tagName).toBe('H2');
    expect(title.querySelector('button.own')?.textContent).toBe('Detections');
    expect(title.textContent!.trim()).toBe('Detections');
    expect(card.querySelector('[data-slot="card-content"] button')).toBeNull();
    expect(card.getAttribute('role')).toBe('region');
    expect(card.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('draws no native tooltip from the title attribute', async () => {
    const { card } = await render();

    expect(card.hasAttribute('title')).toBe(false);
  });

  it('has no header text and no role without a title', async () => {
    const { card, slot } = await render((host) => {
      host.title.set('');
      host.subtitle.set('');
      host.withActions.set(false);
    });

    expect(slot('card-title')).toBeNull();
    expect(slot('card-description')).toBeNull();
    expect(card.hasAttribute('role')).toBe(false);
    expect(card.hasAttribute('aria-labelledby')).toBe(false);
    // Review focus 1: the header has nothing to show, so it leaves the layout (the one rule for it).
    expect(slot('card-header')!.className).toContain(HEADER_HIDDEN_WHEN_EMPTY);
    expect(slot('card-content')!.textContent!.trim()).toBe('Nothing yet.');
  });

  it('puts actions without a title at the header’s end', async () => {
    const { card, slot } = await render((host) => {
      host.title.set('');
      host.subtitle.set('');
    });

    // Review focus 2: the actions are in the header's end cell (helm's second column, first row),
    // and the card is still no region.
    const header = slot('card-header')!;
    const action = header.querySelector<HTMLElement>('[data-slot="card-action"]')!;
    expect(action.querySelector('button')?.textContent).toBe('Clear');
    expect(action.className).toContain('col-start-2');
    expect(header.className).toContain('has-data-[slot=card-action]:grid-cols-[1fr_auto]');
    expect(card.hasAttribute('role')).toBe(false);
  });

  it('projects actions into the header and the rest into the content', async () => {
    const { slot } = await render();

    expect(slot('card-header')!.querySelector('button[neatCardActions]')?.textContent).toBe(
      'Clear',
    );
    expect(slot('card-content')!.querySelector('button')).toBeNull();
    expect(slot('card-content')!.textContent!.trim()).toBe('Nothing yet.');
  });

  it('projects the footer outside the content', async () => {
    const { slot } = await render();

    expect(slot('card-footer')!.textContent!.trim()).toBe('Updated now');
    expect(slot('card-content')!.textContent).not.toContain('Updated now');
  });

  it('takes no space for empty actions and an empty footer, following the projection', async () => {
    const { fixture, slot } = await render((host) => {
      host.withActions.set(false);
      host.withFooter.set(false);
    });

    for (const name of ['card-action', 'card-footer']) {
      expect(slot(name)!.childElementCount).toBe(0);
      expect(slot(name)!.className).toContain('empty:hidden');
    }

    fixture.componentInstance.withActions.set(true);
    fixture.componentInstance.withFooter.set(true);
    await fixture.whenStable();
    expect(slot('card-action')!.querySelector('button')).not.toBeNull();
    expect(slot('card-footer')!.querySelector('p')).not.toBeNull();
  });

  it('sets the surface and the text colour of the card it draws', async () => {
    const { card } = await render();

    expect(declared(':host', '--neat-surface')).toBe('var(--card)');
    expect(declared(':host', 'color')).toBe('var(--card-foreground)');
    expect(cardStyles).not.toContain('!important');
    expect(card.className).toContain('bg-card');
    expect(card.className).toContain('text-card-foreground');
  });

  it('draws every part with helm’s classes restyled by the kit', async () => {
    const { card, slot } = await render();

    expect(Array.from(card.classList).sort()).toEqual(kitCardClasses('card').split(' ').sort());
    for (const [name, key] of [
      ['card-header', 'header'],
      ['card-title', 'title'],
      ['card-description', 'description'],
      ['card-action', 'action'],
      ['card-content', 'content'],
      ['card-footer', 'footer'],
    ] as const) {
      expect(Array.from(slot(name)!.classList).sort()).toEqual(
        kitCardClasses(key).split(' ').sort(),
      );
    }
  });

  it('has the chart card’s frame: a border, the radius, no ring, shadow or clipping', () => {
    const classes = kitCardClasses('card').split(' ');

    expect(classes).toEqual(
      expect.arrayContaining(['border', 'border-border', 'rounded-(--radius)']),
    );
    expect(classes).toContain('[--card-spacing:var(--neat-space-4)]');
    expect(classes).toContain('gap-(--neat-space-2)');
    for (const gone of ['ring-1', 'shadow-xs', 'overflow-hidden', 'rounded-xl']) {
      expect(classes).not.toContain(gone);
    }
    expect(kitCardClasses('title').split(' ')).toContain('text-sm');
    expect(kitCardClasses('title').split(' ')).not.toContain('text-base');
    expect(kitCardClasses('description').split(' ')).toContain('text-xs');
  });

  it('keeps the header as tall with actions as without', () => {
    expect(kitCardClasses('header').split(' ')).toContain('min-h-[var(--neat-card-header-min-height,2rem)]');
  });

  it('only drops classes that helm still has', () => {
    for (const [part, { drop }] of Object.entries(CARD_KIT_DROPPED)) {
      const helm = CARD_HELM_CLASSES[part as keyof typeof CARD_HELM_CLASSES].split(' ');
      for (const cls of drop) expect(helm).toContain(cls);
    }
  });

  it('helm drift: the copied class strings still appear in the vendored helm card', () => {
    expect(helmCard).toContain(CARD_HELM_CLASSES.card);
    expect(helmHeader).toContain(CARD_HELM_CLASSES.header);
    expect(helmTitle).toContain(CARD_HELM_CLASSES.title);
    expect(helmDescription).toContain(CARD_HELM_CLASSES.description);
    expect(helmAction).toContain(CARD_HELM_CLASSES.action);
    expect(helmContent).toContain(CARD_HELM_CLASSES.content);
    expect(helmFooter).toContain(CARD_HELM_CLASSES.footer);
  });
});
