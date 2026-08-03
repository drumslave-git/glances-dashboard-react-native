import { formatFieldValue } from './widgetData';

import {
  buildFormatterSpec,
  describeFormatter,
  parseFormatterSpec,
  pickFormatters,
  setFieldFormatter,
} from './formatterSpec';

describe('parseFormatterSpec', () => {
  it('reads an empty spec as no formatter', () => {
    expect(parseFormatterSpec(undefined).kind).toBe('none');
    expect(parseFormatterSpec('').kind).toBe('none');
    expect(parseFormatterSpec('   ').kind).toBe('none');
    expect(parseFormatterSpec(null).kind).toBe('none');
  });

  it('reads round with its decimals', () => {
    expect(parseFormatterSpec('round(3)')).toMatchObject({ kind: 'round', decimals: 3 });
  });

  it('clamps absurd decimal counts to what the formatter supports', () => {
    expect(parseFormatterSpec('round(99)').decimals).toBe(20);
  });

  it('reads the byte-unit formatters', () => {
    expect(parseFormatterSpec('bytes').kind).toBe('bytes');
    expect(parseFormatterSpec('KB').kind).toBe('kb');
    expect(parseFormatterSpec('gb').kind).toBe('gb');
  });

  it('reads shorten', () => {
    expect(parseFormatterSpec('shorten').kind).toBe('shorten');
  });

  it('reads truncate with its length and position', () => {
    expect(parseFormatterSpec('truncate(24,middle)')).toMatchObject({
      kind: 'truncate',
      length: 24,
      position: 'middle',
    });
  });

  // Whitespace inside the parentheses is tolerated exactly as far as
  // `formatFieldValue` tolerates it — its own gate is `startsWith('round(')`,
  // so a space before the paren is not a valid spec anywhere in the app.
  it('tolerates whitespace inside the parentheses', () => {
    expect(parseFormatterSpec(' round( 1 ) ')).toMatchObject({ kind: 'round', decimals: 1 });
    expect(parseFormatterSpec('truncate( 8 , start )')).toMatchObject({
      kind: 'truncate',
      length: 8,
      position: 'start',
    });
  });

  it('reads an unparseable spec as no formatter rather than throwing', () => {
    expect(parseFormatterSpec('round()').kind).toBe('none');
    expect(parseFormatterSpec('truncate(10,sideways)').kind).toBe('none');
    expect(parseFormatterSpec('nonsense').kind).toBe('none');
  });
});

describe('buildFormatterSpec', () => {
  it('returns null for no formatter, so the field can be cleared', () => {
    expect(buildFormatterSpec(parseFormatterSpec(''))).toBeNull();
  });

  it('round-trips every formatter kind', () => {
    for (const spec of ['round(0)', 'round(4)', 'bytes', 'kb', 'mb', 'gb', 'shorten', 'truncate(12,start)']) {
      expect(buildFormatterSpec(parseFormatterSpec(spec))).toBe(spec);
    }
  });

  it('clamps out-of-range values into a spec the formatter accepts', () => {
    expect(buildFormatterSpec({ kind: 'round', decimals: -4, length: 10, position: 'end' })).toBe('round(0)');
    expect(buildFormatterSpec({ kind: 'round', decimals: 40, length: 10, position: 'end' })).toBe('round(20)');
    expect(buildFormatterSpec({ kind: 'truncate', decimals: 2, length: 0, position: 'end' })).toBe('truncate(1,end)');
  });

  it('produces specs that formatFieldValue understands', () => {
    const spec = buildFormatterSpec({ kind: 'round', decimals: 1, length: 10, position: 'end' });
    expect(formatFieldValue(12.345, spec!)).toBe('12.3');

    const truncated = buildFormatterSpec({ kind: 'truncate', decimals: 2, length: 5, position: 'end' });
    expect(formatFieldValue('abcdefgh', truncated!)).toBe('abcd…');
  });
});

describe('describeFormatter', () => {
  it('summarises each kind for the collapsed row', () => {
    expect(describeFormatter(undefined)).toBe('None');
    expect(describeFormatter('round(2)')).toBe('Round 2');
    expect(describeFormatter('truncate(10,middle)')).toBe('Truncate 10 middle');
    expect(describeFormatter('gb')).toBe('GB');
    expect(describeFormatter('shorten')).toBe('Shorten');
  });
});

describe('setFieldFormatter', () => {
  it('sets a formatter without touching the others', () => {
    expect(setFieldFormatter({ a: 'gb' }, 'b', 'round(1)')).toEqual({ a: 'gb', b: 'round(1)' });
  });

  it('removes the entry when the spec is null', () => {
    expect(setFieldFormatter({ a: 'gb', b: 'round(1)' }, 'b', null)).toEqual({ a: 'gb' });
  });

  it('does not mutate the input', () => {
    const formatters = { a: 'gb' };
    setFieldFormatter(formatters, 'a', null);
    expect(formatters).toEqual({ a: 'gb' });
  });
});

describe('pickFormatters', () => {
  it('keeps only formatters for still-selected fields', () => {
    expect(pickFormatters({ a: 'gb', b: 'mb' }, ['b', 'c'])).toEqual({ b: 'mb' });
  });
});
