import { classStyles, styleFor } from './class-styles';

describe('class styles', () => {
  const rows = [
    { label: 'car', color: 'blue', width: 3 },
    { label: 'default', color: 'grey', width: 1 },
  ];

  it('finds a label its own row, else the default row', () => {
    const { styles } = classStyles(rows);
    expect(styleFor(styles, 'car')?.width).toBe(3);
    expect(styleFor(styles, 'bus')?.color).toBe('grey');
    expect(styleFor(classStyles([rows[0]]).styles, 'bus')).toBeUndefined();
  });

  it("gives the rows' colours as overrides", () => {
    expect({ ...classStyles(rows).overrides }).toEqual({ car: 'blue', default: 'grey' });
  });

  it('finds no row for a label that names a prototype member', () => {
    const { styles, overrides } = classStyles([rows[0]]);
    expect(styleFor(styles, 'constructor')).toBeUndefined();
    expect(overrides['toString' as keyof typeof overrides]).toBeUndefined();
  });
});
