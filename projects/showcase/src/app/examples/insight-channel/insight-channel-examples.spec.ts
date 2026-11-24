import { TestBed } from '@angular/core/testing';
import { WatchingAChannel } from './1-watching-a-channel.example';
import { HoldingTheVideo } from './2-holding-the-video.example';

describe('the Insight channel example', () => {
  it('says why the channel cannot be watched, in the callout and on the tile', async () => {
    // jsdom has no WebRTC, so the channel fails at once without posting an offer.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const fixture = TestBed.createComponent(WatchingAChannel);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('neat-callout')?.textContent).toContain('This browser has no WebRTC');
    expect(host.querySelector('neat-video-tile .no-video')?.textContent?.trim()).toBe(
      'This browser has no WebRTC',
    );
    expect(host.querySelector('neat-video-tile .bar .label')?.textContent).toBe('Channel 0');
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('shows the video buffer setting, and that a browser without one shows frames at once', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const fixture = TestBed.createComponent(HoldingTheVideo);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('neat-slider')).not.toBeNull();
    expect(host.querySelector('.showcase-muted')?.textContent?.trim()).toBe(
      '300 ms. This browser shows each frame at once.',
    );
    vi.unstubAllGlobals();
  });
});
