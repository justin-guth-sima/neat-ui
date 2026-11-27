import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BREADCRUMB_CLASSES } from './breadcrumb-classes';
import { type NeatBreadcrumb, NeatBreadcrumbs } from './breadcrumbs';

function hasClasses(el: Element, classes: string) {
  return classes.split(' ').every((c) => el.classList.contains(c));
}

@Component({
  imports: [NeatBreadcrumbs],
  template: `<neat-breadcrumbs label="Levels" [crumbs]="crumbs()" (go)="went.push($event)" />`,
})
class CrumbsHost {
  readonly crumbs = signal<readonly NeatBreadcrumb[]>([
    { label: 'Overview' },
    { label: 'YOLOX multi', detail: 'skipped on the way' },
    { label: 'Stages', detail: '4 stages' },
  ]);
  readonly went: number[] = [];
}

async function render() {
  const fixture = TestBed.createComponent(CrumbsHost);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  return {
    fixture,
    nav: root.querySelector('nav') as HTMLElement,
    items: () => Array.from(root.querySelectorAll<HTMLElement>('nav li')),
    buttons: () => Array.from(root.querySelectorAll<HTMLButtonElement>('nav button')),
    current: () => root.querySelector<HTMLElement>('[aria-current="location"]'),
  };
}

describe('NeatBreadcrumbs', () => {
  it('is a navigation landmark named by its label, holding an ordered list', async () => {
    const { nav } = await render();
    expect(nav.getAttribute('aria-label')).toBe('Levels');
    expect(nav.querySelector('ol')).not.toBeNull();
  });

  it('makes each crumb but the last a button, the last the location in plain text', async () => {
    const { buttons, current } = await render();
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['Overview', 'YOLOX multi']);
    for (const button of buttons()) {
      expect(button.getAttribute('type')).toBe('button');
      expect(hasClasses(button, BREADCRUMB_CLASSES.link)).toBe(true);
    }
    expect(current()?.tagName).toBe('SPAN');
    // Its detail follows its label, muted, a space apart in the text too; only the last shows one.
    expect(current()?.textContent).toBe('Stages 4 stages');
    const detail = current()?.querySelector('.text-muted-foreground');
    expect(detail?.textContent?.trim()).toBe('4 stages');
    // The detail is not the foreground-colored page text; the label is.
    expect(hasClasses(current() as HTMLElement, BREADCRUMB_CLASSES.page)).toBe(true);
  });

  it("takes helm's list and item classes", async () => {
    const { nav, items } = await render();
    expect(hasClasses(nav.querySelector('ol') as Element, BREADCRUMB_CLASSES.list)).toBe(true);
    for (const li of items()) expect(hasClasses(li, BREADCRUMB_CLASSES.item)).toBe(true);
  });

  it('sets the crumbs apart by a decorative chevron icon before each but the first', async () => {
    const { items } = await render();
    const separators = items().map((li) => li.querySelector('[aria-hidden="true"]'));
    expect(separators[0]).toBeNull();
    for (const s of separators.slice(1)) {
      expect(s?.querySelector('neat-icon[data-icon="next"], neat-icon')).not.toBeNull();
      expect(hasClasses(s as Element, BREADCRUMB_CLASSES.separator)).toBe(true);
      expect(s?.textContent?.trim()).toBe('');
    }
  });

  it('says which crumb is pressed by its index', async () => {
    const { buttons, fixture } = await render();
    buttons()[1].click();
    buttons()[0].click();
    expect(fixture.componentInstance.went).toEqual([1, 0]);
  });

  it('shows a lone crumb as the location, without a separator', async () => {
    const { fixture, buttons, current, items } = await render();
    fixture.componentInstance.crumbs.set([{ label: 'Media Root' }]);
    await fixture.whenStable();
    expect(buttons()).toEqual([]);
    expect(current()?.textContent).toBe('Media Root');
    expect(items()[0].querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
