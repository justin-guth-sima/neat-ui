import { TestBed } from '@angular/core/testing';
import { ChannelSettings } from './1-channel-settings.example';

describe('the tabs examples', () => {
  it('open the arrow key’s tab, skipping the disabled one and wrapping', async () => {
    const fixture = TestBed.createComponent(ChannelSettings);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(host.querySelectorAll<HTMLElement>('[role="tab"]'));
    const open = () => host.querySelector('[role="tabpanel"]:not([hidden])')?.textContent?.trim();
    const press = async (tab: HTMLElement) => {
      tab.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true }),
      );
      await fixture.whenStable();
    };

    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Metadata', 'General', 'ROI']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(open()).toBe('Overlay types, confidence thresholds and tracking.');

    await press(tabs[0]);
    expect(open()).toBe('Video sync buffer, metadata retention and line width.');

    await press(tabs[1]);
    expect(open()).toBe('Overlay types, confidence thresholds and tracking.');
  });
});
