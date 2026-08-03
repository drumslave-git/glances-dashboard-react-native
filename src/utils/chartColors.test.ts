import { CHART_PALETTE, defaultColorForField, getFieldColor, randomChartColor } from './chartColors';

describe('defaultColorForField', () => {
  it('is deterministic for the same field name', () => {
    expect(defaultColorForField('cpu')).toBe(defaultColorForField('cpu'));
  });

  it('always returns a colour from the palette', () => {
    for (const field of ['cpu', 'mem', 'used', 'free', '', 'a-very-long-field-name']) {
      expect(CHART_PALETTE).toContain(defaultColorForField(field));
    }
  });

  it('spreads different field names across the palette', () => {
    const colours = new Set(
      ['cpu', 'mem', 'swap', 'load', 'free', 'used', 'total'].map(defaultColorForField),
    );
    expect(colours.size).toBeGreaterThan(1);
  });
});

describe('getFieldColor', () => {
  it('prefers a configured colour', () => {
    expect(getFieldColor('cpu', { cpu: '#ABCDEF' })).toBe('#ABCDEF');
  });

  it('falls back to the default when no config is given', () => {
    expect(getFieldColor('cpu')).toBe(defaultColorForField('cpu'));
    expect(getFieldColor('cpu', null)).toBe(defaultColorForField('cpu'));
    expect(getFieldColor('cpu', {})).toBe(defaultColorForField('cpu'));
  });

  it('ignores malformed colours', () => {
    for (const bad of ['red', '#abc', '#12345', '#1234567', 'ABCDEF']) {
      expect(getFieldColor('cpu', { cpu: bad })).toBe(defaultColorForField('cpu'));
    }
  });
});

describe('randomChartColor', () => {
  it('returns a palette colour', () => {
    expect(CHART_PALETTE).toContain(randomChartColor());
  });
});
