import { bevPlot } from './geometry';
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

const rect = (back: number, front: number, right: number, left: number) =>
  bevPlot('rect', 60, { x: [back, front], y: [right, left] });

describe('summaryText', () => {
  it('counts each label within the range, in the order the labels first appear', () => {
    const objects = [at(5, 0, 'car'), at(10, 3, 'pedestrian'), at(-8, 2, 'car'), at(0, 20, 'bus')];
    expect(summaryText(objects, bevPlot('round', 60))).toBe(
      '2 car, 1 pedestrian, 1 bus within 60 m',
    );
  });

  it('leaves out what lies beyond the range', () => {
    expect(summaryText([at(5, 0, 'car'), at(70, 0, 'truck')], bevPlot('round', 60))).toBe(
      '1 car within 60 m',
    );
  });

  it('says so when there is nothing', () => {
    expect(summaryText([], bevPlot('round', 30))).toBe('Nothing within 30 m');
    expect(summaryText(undefined, bevPlot('round', 30))).toBe('Nothing within 30 m');
  });

  it('counts what lies in a rectangle, corners included, and names its edges', () => {
    const objects = [at(50, 50, 'car'), at(70, 25, 'car'), at(-25, 0, 'bus')];
    expect(summaryText(objects, bevPlot('rect', 60))).toBe('1 car, 1 bus within 60 m');
    expect(summaryText(objects, rect(-20, 80, -30, 30))).toBe(
      '1 car from 20 m behind to 80 m ahead, 30 m either side',
    );
  });

  it('names a rectangle off to one side or ahead of the vehicle', () => {
    expect(summaryText([], rect(10, 80, -5, 20))).toBe(
      'Nothing from 10 m to 80 m ahead, from 5 m right to 20 m left',
    );
    expect(summaryText([], rect(-40, -10, 2, 8))).toBe(
      'Nothing from 10 m to 40 m behind, from 2 m to 8 m left',
    );
  });
});
