import { APP_BASE_HREF } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SearchingAnApp } from './1-searching-an-app.example';

describe('the search palette examples', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((node) => (node.innerHTML = ''));
  });

  it('finds the docs pages whose name holds what was typed, and says which was opened', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: APP_BASE_HREF, useValue: '/' },
      ],
    });
    const fixture = TestBed.createComponent(SearchingAnApp);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('button.trigger')?.getAttribute('aria-keyshortcuts')).toBeNull();

    (host.querySelector('button.trigger') as HTMLButtonElement).click();
    await fixture.whenStable();
    const field = document.querySelector('[role="dialog"] neat-search input') as HTMLInputElement;
    field.value = 'icon';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const labels = Array.from(
      document.querySelectorAll('[role="dialog"] [role="option"] .option-label'),
      (label) => label.textContent,
    );
    expect(labels).toEqual(['Icons', 'Icon finder']);

    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    expect(host.textContent).toContain('Last opened: Icons');
  });
});
