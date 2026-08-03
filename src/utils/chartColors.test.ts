import {
  CONTRAST_FLOOR,
  contrastRatio,
  onColorText,
  seriesPalette,
  tokensFor,
} from '@/theme/telemetry';

import {
  assignSeriesColors,
  chartPalette,
  defaultColorForField,
  getFieldColor,
  isValidHex,
  randomChartColor,
} from './chartColors';

const MODES = ['dark', 'light'] as const;

describe('the palette itself', () => {
  it.each(MODES)('%s opens with the design’s three accents', (mode) => {
    // Lime, cyan, amber — the same hues the endpoint chips use, so a chart and
    // the widget it sits in belong to one system.
    expect(chartPalette(mode).slice(0, 3)).toEqual(
      mode === 'dark' ? ['#b6f24a', '#58aec9', '#d9a13c'] : ['#44761a', '#1d6f8b', '#8f5c10'],
    );
  });

  it.each(MODES)('%s has no duplicate entries', (mode) => {
    const palette = chartPalette(mode);
    expect(new Set(palette).size).toBe(palette.length);
  });

  it.each(MODES)('%s carries readable text on every fill', (mode) => {
    // Slice labels sit on the fill, so every entry has to be able to carry text.
    for (const color of chartPalette(mode)) {
      expect(contrastRatio(onColorText(color), color)).toBeGreaterThanOrEqual(CONTRAST_FLOOR);
    }
  });
});

describe('assignSeriesColors', () => {
  it('takes the palette in order, so the first fields are the most distinct', () => {
    const palette = seriesPalette('dark');
    expect(assignSeriesColors(['a', 'b', 'c'], null, 'dark')).toEqual([
      palette[0],
      palette[1],
      palette[2],
    ]);
  });

  it('never hands two fields the same colour within one palette length', () => {
    const names = Array.from({ length: 10 }, (_, index) => `f${index}`);
    const colors = assignSeriesColors(names, null, 'dark');
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('draws the remainder of a used/free pair in the track colour', () => {
    // The design's memory ring is one accent arc against a track; a used/free
    // donut should read the same way rather than as two rival slices.
    const [used, free] = assignSeriesColors(['used', 'free'], null, 'dark');
    expect(used).toBe(seriesPalette('dark')[0]);
    expect(free).toBe(tokensFor('dark').bg.track);
  });

  it('recognises the pair whatever the case, and for available too', () => {
    expect(assignSeriesColors(['Used', 'Free'], null, 'dark')[1]).toBe(tokensFor('dark').bg.track);
    expect(assignSeriesColors(['used', 'available'], null, 'dark')[1]).toBe(
      tokensFor('dark').bg.track,
    );
  });

  it('treats idle as the remainder on a cpu donut', () => {
    const palette = seriesPalette('dark');
    expect(assignSeriesColors(['user', 'system', 'iowait', 'idle'], null, 'dark')).toEqual([
      palette[0],
      palette[1],
      palette[2],
      tokensFor('dark').bg.track,
    ]);
  });

  it('leaves a lone remainder field a real colour', () => {
    // A chart of free space alone is about free space; the track colour would
    // make it invisible.
    expect(assignSeriesColors(['free'], null, 'dark')).toEqual([seriesPalette('dark')[0]]);
  });

  it('does not leave a gap in the sequence where the track colour was used', () => {
    const palette = seriesPalette('dark');
    expect(assignSeriesColors(['used', 'free', 'cached'], null, 'dark')).toEqual([
      palette[0],
      tokensFor('dark').bg.track,
      palette[1],
    ]);
  });

  it('lets an explicitly configured colour win over everything', () => {
    expect(assignSeriesColors(['used', 'free'], { free: '#ABCDEF' }, 'dark')).toEqual([
      seriesPalette('dark')[0],
      '#ABCDEF',
    ]);
  });

  it('ignores a configured value that is not a hex colour', () => {
    expect(assignSeriesColors(['a'], { a: 'rebeccapurple' }, 'dark')).toEqual([
      seriesPalette('dark')[0],
    ]);
  });

  it('resolves per mode, so a theme switch recolours the chart', () => {
    expect(assignSeriesColors(['a'], null, 'light')).toEqual([seriesPalette('light')[0]]);
  });

  it('cycles rather than running out', () => {
    const names = Array.from({ length: 12 }, (_, index) => `f${index}`);
    const colors = assignSeriesColors(names, null, 'dark');
    expect(colors[10]).toBe(colors[0]);
  });
});

describe('defaultColorForField', () => {
  it('is deterministic for the same field name', () => {
    expect(defaultColorForField('cpu', 'dark')).toBe(defaultColorForField('cpu', 'dark'));
  });

  it('always returns a colour from the palette', () => {
    for (const field of ['cpu', 'mem', 'used', 'free', '', 'a-very-long-field-name']) {
      expect(chartPalette('dark')).toContain(defaultColorForField(field, 'dark'));
    }
  });

  it('spreads different field names across the palette', () => {
    const colours = new Set(
      ['cpu', 'mem', 'swap', 'load', 'free', 'used', 'total'].map((field) =>
        defaultColorForField(field, 'dark'),
      ),
    );
    expect(colours.size).toBeGreaterThan(1);
  });
});

describe('getFieldColor', () => {
  it('prefers a configured colour', () => {
    expect(getFieldColor('cpu', { cpu: '#ABCDEF' }, 'dark')).toBe('#ABCDEF');
  });

  it('falls back to the default when no config is given', () => {
    expect(getFieldColor('cpu', undefined, 'dark')).toBe(defaultColorForField('cpu', 'dark'));
    expect(getFieldColor('cpu', null, 'dark')).toBe(defaultColorForField('cpu', 'dark'));
    expect(getFieldColor('cpu', {}, 'dark')).toBe(defaultColorForField('cpu', 'dark'));
  });

  it('ignores malformed colours', () => {
    for (const bad of ['red', '#abc', '#12345', '#1234567', 'ABCDEF']) {
      expect(getFieldColor('cpu', { cpu: bad }, 'dark')).toBe(defaultColorForField('cpu', 'dark'));
    }
  });
});

describe('isValidHex', () => {
  it('accepts six-digit hex only', () => {
    expect(isValidHex('#b6f24a')).toBe(true);
    expect(isValidHex('#FFF')).toBe(false);
    expect(isValidHex(undefined)).toBe(false);
  });
});

describe('randomChartColor', () => {
  it('returns a palette colour', () => {
    expect(chartPalette('dark')).toContain(randomChartColor('dark'));
  });
});
