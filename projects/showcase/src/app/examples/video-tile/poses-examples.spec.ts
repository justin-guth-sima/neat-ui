import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { type NeatTileFrame, type NeatTileFrameListener, NeatVideoTile } from '@sima/neat-ui/video';
import { Poses } from './2-poses.example';
import { HAND_LANDMARKS, poseMessage } from './pose-source';

describe('the poses example', () => {
  it('flips the Boxes switch', async () => {
    const fixture = TestBed.createComponent(Poses);
    await fixture.whenStable();
    const boxes = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      'button[role="switch"]',
    )!;

    expect(boxes.getAttribute('aria-checked')).toBe('true');
    boxes.click();
    await fixture.whenStable();
    expect(boxes.getAttribute('aria-checked')).toBe('false');
  });

  it('flips the Mirror switch onto the tile', async () => {
    const fixture = TestBed.createComponent(Poses);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const mirror = element.querySelectorAll<HTMLElement>('button[role="switch"]')[1];
    const tile = element.querySelector('neat-video-tile')!;

    expect(tile.hasAttribute('data-mirrored')).toBe(false);
    mirror.click();
    await fixture.whenStable();
    expect(tile.hasAttribute('data-mirrored')).toBe(true);
  });

  it('counts the poses of a frame from the tile’s frame listener', async () => {
    const fixture = TestBed.createComponent(Poses);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const listener = fixture.debugElement
      .query(By.directive(NeatVideoTile))
      .componentInstance.frameListener() as NeatTileFrameListener;
    const frame = (poses: number): NeatTileFrame => ({
      now: 0,
      messages: [
        {
          message: { type: 'pose-estimation', data: { poses: Array.from({ length: poses }) } },
          held: false,
        },
      ],
    });

    listener(frame(3));
    await fixture.whenStable();
    expect(element.querySelector('p')!.textContent).toBe('3 poses in this frame');

    listener(frame(1));
    await fixture.whenStable();
    expect(element.querySelector('p')!.textContent).toBe('1 pose in this frame');

    listener({ now: 1, messages: [] });
    await fixture.whenStable();
    expect(element.querySelector('p')!.textContent).toBe('0 poses in this frame');
  });

  it('publishes two hands with the 21 landmark names, and a person', () => {
    const { poses } = poseMessage(10).data as {
      poses: { label: string; keypoints: { name: string }[] }[];
    };

    expect(poses.map((pose) => pose.label)).toEqual(['person', 'hand', 'hand']);
    expect(poses[1].keypoints.map((kp) => kp.name)).toEqual(HAND_LANDMARKS);
    expect(HAND_LANDMARKS).toHaveLength(21);
    expect(poses[0].keypoints).toHaveLength(17);
  });
});
