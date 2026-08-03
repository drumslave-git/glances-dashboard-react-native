import {
  formatFieldValue,
  formatLooseNumber,
  getChartData,
  getRecordFromPayload,
  getTextBody,
  resolveTitleTokens,
} from './widgetData';
import { defaultColorForField } from './chartColors';

describe('getRecordFromPayload', () => {
  it('returns objects unchanged', () => {
    expect(getRecordFromPayload({ cpu: 1 })).toEqual({ cpu: 1 });
  });

  it('takes the first element of an array (fs/gpu payloads)', () => {
    expect(getRecordFromPayload([{ a: 1 }, { b: 2 }])).toEqual({ a: 1 });
  });

  it('returns null for empty arrays and non-objects', () => {
    expect(getRecordFromPayload([])).toBeNull();
    expect(getRecordFromPayload(null)).toBeNull();
    expect(getRecordFromPayload(42)).toBeNull();
    expect(getRecordFromPayload('cpu')).toBeNull();
    expect(getRecordFromPayload(undefined)).toBeNull();
  });
});

describe('formatFieldValue', () => {
  describe('round(n)', () => {
    it('rounds to the requested precision', () => {
      expect(formatFieldValue(3.3456, 'round(2)')).toBe('3.35');
      expect(formatFieldValue(3.3456, 'round(0)')).toBe('3');
    });

    it('parses numeric strings', () => {
      expect(formatFieldValue('3.3456', 'round(1)')).toBe('3.3');
    });

    it('defaults to zero decimals when the spec is malformed', () => {
      expect(formatFieldValue(3.6, 'round()')).toBe('4');
    });

    it('passes non-numeric values through', () => {
      expect(formatFieldValue('abc', 'round(2)')).toBe('abc');
    });
  });

  describe('byte units', () => {
    it('scales bytes automatically', () => {
      expect(formatFieldValue(512, 'bytes')).toBe('512 B');
      expect(formatFieldValue(2048, 'bytes')).toBe('2.00 KB');
      expect(formatFieldValue(5 * 1024 * 1024, 'bytes')).toBe('5.00 MB');
      expect(formatFieldValue(3 * 1024 * 1024 * 1024, 'bytes')).toBe('3.00 GB');
    });

    it('honours explicit units', () => {
      expect(formatFieldValue(2048, 'kb')).toBe('2.00 KB');
      expect(formatFieldValue(1024 * 1024, 'mb')).toBe('1.00 MB');
      expect(formatFieldValue(1024 * 1024 * 1024, 'gb')).toBe('1.00 GB');
    });
  });

  describe('shorten', () => {
    it('abbreviates magnitudes and strips trailing .0', () => {
      expect(formatFieldValue(999, 'shorten')).toBe('999');
      expect(formatFieldValue(1000, 'shorten')).toBe('1k');
      expect(formatFieldValue(1500, 'shorten')).toBe('1.5k');
      expect(formatFieldValue(2_500_000, 'shorten')).toBe('2.5M');
      expect(formatFieldValue(3_000_000_000, 'shorten')).toBe('3B');
    });

    it('keeps the sign for negatives', () => {
      expect(formatFieldValue(-1500, 'shorten')).toBe('-1.5k');
    });
  });

  describe('truncate', () => {
    it('truncates at the end by default position', () => {
      expect(formatFieldValue('abcdefghij', 'truncate(5,end)')).toBe('abcd…');
    });

    it('truncates at the start', () => {
      expect(formatFieldValue('abcdefghij', 'truncate(5,start)')).toBe('…ghij');
    });

    it('truncates in the middle', () => {
      expect(formatFieldValue('abcdefghij', 'truncate(5,middle)')).toBe('ab…ij');
    });

    it('leaves short strings alone', () => {
      expect(formatFieldValue('abc', 'truncate(5,end)')).toBe('abc');
    });
  });

  it('returns the stringified value for unknown formatters', () => {
    expect(formatFieldValue(12, 'nonsense')).toBe('12');
  });
});

describe('resolveTitleTokens', () => {
  it('substitutes a plain token', () => {
    expect(resolveTitleTokens('CPU {{total}}%', { total: 42 })).toBe('CPU 42%');
  });

  it('applies a formatter inside a token', () => {
    expect(resolveTitleTokens('VRAM {{mem:round(2)}}%', { mem: 3.3456 })).toBe('VRAM 3.35%');
  });

  it('leaves unknown fields visible so typos are obvious', () => {
    expect(resolveTitleTokens('{{nope}}', { total: 1 })).toBe('{{nope}}');
  });

  it('reads through array payloads', () => {
    expect(resolveTitleTokens('{{name}}', [{ name: 'sda' }])).toBe('sda');
  });

  it('serialises object values', () => {
    expect(resolveTitleTokens('{{obj}}', { obj: { a: 1 } })).toBe('{"a":1}');
  });

  it('returns the title untouched when there is no data', () => {
    expect(resolveTitleTokens('CPU {{total}}%', null)).toBe('CPU {{total}}%');
  });

  it('resolves several tokens in one title', () => {
    expect(resolveTitleTokens('{{a}}/{{b}}', { a: 1, b: 2 })).toBe('1/2');
  });
});

describe('getTextBody', () => {
  it('renders selected fields as key = value lines', () => {
    expect(getTextBody({ a: 1, b: 'x', c: 3 }, ['a', 'b'])).toBe('a = 1\nb = x');
  });

  it('marks missing fields', () => {
    expect(getTextBody({ a: 1 }, ['zzz'])).toBe('zzz = (not found)');
  });

  it('applies per-field formatters', () => {
    expect(getTextBody({ mem: 3.3456 }, ['mem'], { mem: 'round(1)' })).toBe('mem = 3.3');
  });

  it('pretty-prints nested objects', () => {
    expect(getTextBody({ nested: { a: 1 } }, ['nested'])).toBe(
      `nested = ${JSON.stringify({ a: 1 }, null, 2)}`,
    );
  });

  it('falls back to the whole payload when no fields are selected', () => {
    const data = { a: 1 };
    expect(getTextBody(data, [])).toBe(JSON.stringify(data, null, 2));
  });
});

describe('getChartData', () => {
  it('builds one segment per numeric field', () => {
    expect(getChartData({ used: 30, free: 70 }, ['used', 'free'])).toEqual([
      { name: 'used', value: 30, color: defaultColorForField('used') },
      { name: 'free', value: 70, color: defaultColorForField('free') },
    ]);
  });

  it('drops non-numeric fields', () => {
    const segments = getChartData({ used: 30, label: 'nope' }, ['used', 'label']);
    expect(segments.map((s) => s.name)).toEqual(['used']);
  });

  it('uses every key when no fields are selected', () => {
    const segments = getChartData({ a: 1, b: 2 }, []);
    expect(segments.map((s) => s.name)).toEqual(['a', 'b']);
  });

  it('honours configured colours', () => {
    const [segment] = getChartData({ used: 30 }, ['used'], { used: '#123456' });
    expect(segment.color).toBe('#123456');
  });

  it('attaches formatted display labels', () => {
    const [segment] = getChartData({ used: 30.456 }, ['used'], null, false, { used: 'round(1)' });
    expect(segment.displayLabel).toBe('30.5');
  });

  it('returns an empty list without a record', () => {
    expect(getChartData(null, ['used'])).toEqual([]);
  });

  describe('used/free split', () => {
    it('splits a single percentage field into Used and Free', () => {
      const segments = getChartData({ percent: 30 }, ['percent'], null, true);
      expect(segments).toEqual([
        { name: 'Used', value: 30, color: defaultColorForField('percent'), displayLabel: undefined },
        { name: 'Free', value: 70, color: defaultColorForField('free') },
      ]);
    });

    it('does not split when more than one field is selected', () => {
      const segments = getChartData({ a: 30, b: 10 }, ['a', 'b'], null, true);
      expect(segments.map((s) => s.name)).toEqual(['a', 'b']);
    });

    it('does not split values outside 0–100', () => {
      const segments = getChartData({ a: 120 }, ['a'], null, true);
      expect(segments.map((s) => s.name)).toEqual(['a']);
    });
  });
});

describe('formatLooseNumber', () => {
  it('leaves integers alone', () => {
    expect(formatLooseNumber(16)).toBe('16');
    expect(formatLooseNumber(-3)).toBe('-3');
  });

  it('caps decimals rather than padding them', () => {
    expect(formatLooseNumber(12.5)).toBe('12.5');
    expect(formatLooseNumber(85.40915631665675)).toBe('85.41');
  });

  it('drops to one decimal once the number is large enough not to need two', () => {
    expect(formatLooseNumber(304391.4690646782)).toBe('304391.5');
  });

  it('passes non-finite values through rather than inventing a number', () => {
    expect(formatLooseNumber(Number.NaN)).toBe('NaN');
    expect(formatLooseNumber(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });
});
