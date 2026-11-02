import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Variants } from './1-variants.example';
import { StartAndStop } from './2-start-and-stop.example';
import { TextActions } from './3-text-actions.example';
import { States } from './4-states.example';
import { Pressed } from './5-pressed.example';
import { OnACard } from './6-on-a-card.example';
import { VARIANTS } from './variants';

async function render<T>(component: new () => T): Promise<ComponentFixture<T>> {
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture;
}

const buttons = (fixture: ComponentFixture<unknown>, selector = 'button'): HTMLButtonElement[] =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(selector));

describe('the button examples', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('show every variant in four sizes, icon-only, and rounded as pill and circle', async () => {
    const fixture = await render(Variants);
    const host = fixture.nativeElement as HTMLElement;
    const sections = Array.from(host.querySelectorAll('section'));

    expect(sections.map((section) => section.querySelector('h4')?.textContent)).toEqual(VARIANTS);
    for (const section of sections) {
      const row = Array.from(section.querySelectorAll('button'));
      expect(row.map((button) => button.textContent?.trim())).toEqual([
        'small',
        'medium',
        'large',
        'touch',
        '',
        '',
        '',
        '',
        'rounded',
        '',
      ]);
      // An icon-only button has no text, so its name is its label.
      expect(
        row
          .filter((button) => !button.textContent?.trim())
          .map((b) => b.getAttribute('aria-label')),
      ).toEqual([
        'Stream, small',
        'Stream, medium',
        'Stream, large',
        'Stream, touch',
        'Stream, rounded',
      ]);
    }
  });

  it('pair start with a play icon and stop with a stop icon', async () => {
    const fixture = await render(StartAndStop);
    const [start, stop] = buttons(fixture);

    expect(start.textContent?.trim()).toBe('Start');
    expect(start.querySelector('neat-icon')?.getAttribute('name')).toBe('play');
    expect(stop.textContent?.trim()).toBe('Stop');
    expect(stop.querySelector('neat-icon')?.getAttribute('name')).toBe('stop');
  });

  it('put a quiet red Delete among the text buttons', async () => {
    const fixture = await render(TextActions);

    expect(buttons(fixture).map((button) => button.textContent?.trim())).toEqual([
      'Rename',
      'Duplicate',
      'Delete',
    ]);
  });

  it('show a disabled button, a waiting one that keeps focus, and a link per variant', async () => {
    const fixture = await render(States);
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.showcase-row'),
    );

    expect(rows).toHaveLength(VARIANTS.length);
    for (const row of rows) {
      const [withIcon, disabled, waiting] = Array.from(row.querySelectorAll('button'));
      const link = row.querySelector('a')!;

      expect(withIcon.querySelector('neat-icon')).not.toBeNull();
      expect(disabled.disabled).toBe(true);
      // Waiting is not disabled: it stays in the Tab order, which `disabled` would take it out of.
      expect(waiting.disabled).toBe(false);
      expect(waiting.getAttribute('aria-disabled')).toBe('true');
      expect(link.getAttribute('href')).toBe('/components/actions/button');
    }
  });

  it('toggle a variant’s pressed state on the page and on the card together', async () => {
    const fixture = await render(Pressed);
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.showcase-row'),
    );
    const pressed = () =>
      rows.map((row) =>
        Array.from(row.querySelectorAll('button'), (button) => button.getAttribute('aria-pressed')),
      );

    expect(rows.map((row) => row.classList.contains('card'))).toEqual([false, true]);
    const initial = ['false', 'true', 'true', 'false', 'false', 'false', 'false'];
    // The last button is not a toggle: it has no state to announce.
    expect(pressed()).toEqual([
      [...initial, null],
      [...initial, null],
    ]);

    rows[0].querySelector('button')!.click();
    await fixture.whenStable();
    rows[1].querySelectorAll('button')[1].click();
    await fixture.whenStable();

    const after = ['true', 'false', 'true', 'false', 'false', 'false', 'false', null];
    expect(pressed()).toEqual([after, after]);
  });

  it('show every variant on a card', async () => {
    const fixture = await render(OnACard);
    const row = (fixture.nativeElement as HTMLElement).querySelector('.card')!;

    expect(Array.from(row.querySelectorAll('button'), (b) => b.textContent?.trim())).toEqual(
      VARIANTS,
    );
  });
});
