import { TestBed } from '@angular/core/testing';
import { DiagramFromTheApp } from './7-from-the-app.example';

describe('the diagram from-the-app example', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({ observe: vi.fn(), disconnect: vi.fn() })),
    );
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('puts a block in focus from its row, and marks the row the drawing hovers', async () => {
    const fixture = TestBed.createComponent(DiagramFromTheApp);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.blocks button'));
    rows[0].dispatchEvent(new PointerEvent('pointerenter'));
    await fixture.whenStable();
    expect(root.querySelectorAll('neat-diagram .dim').length).toBeGreaterThan(0);
    expect(root.querySelector('.report dd')?.textContent).toBe('block onnx');
    rows[0].dispatchEvent(new PointerEvent('pointerleave'));
    await fixture.whenStable();
    expect(root.querySelectorAll('neat-diagram .dim').length).toBe(0);

    const block = root.querySelector('neat-diagram [data-node="compile"] .label')!;
    block.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    await fixture.whenStable();
    expect(root.querySelector('.blocks button[data-current]')?.textContent?.trim()).toBe('Compile');
  });
});
