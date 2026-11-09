import type { NeatBevObject } from './model';
import { summaryText } from './summary';

const at = (x: number, y: number, label: string): NeatBevObject => ({
  x,
  y,
  length: 4,
  width: 2,
  yaw: 0,
  label,
});

describe('summaryText', () => {
  it('counts each label within the range, in the order the labels first appear', () => {
    const objects = [at(5, 0, 'car'), at(10, 3, 'pedestrian'), at(-8, 2, 'car'), at(0, 20, 'bus')];
    expect(summaryText(objects, 60)).toBe('2 car, 1 pedestrian, 1 bus within 60 m');
  });

  it('leaves out what lies beyond the range', () => {
    expect(summaryText([at(5, 0, 'car'), at(70, 0, 'truck')], 60)).toBe('1 car within 60 m');
  });

  it('says so when there is nothing', () => {
    expect(summaryText([], 30)).toBe('Nothing within 30 m');
    expect(summaryText(undefined, 30)).toBe('Nothing within 30 m');
  });
});
