import { TestBed } from '@angular/core/testing';
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
