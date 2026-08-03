import { cpuFixture, memFixture, systemFixture } from '@/__fixtures__/glances';

import {
  formatDeltaFromAvg,
  formatStat,
  gaugeReading,
  heroReading,
  humaniseField,
  looksLikePercent,
  readFields,
} from './widgetPresentation';

describe('looksLikePercent', () => {
  it('accepts fields whose name and range both agree', () => {
    expect(looksLikePercent('percent', 16.1)).toBe(true);
    expect(looksLikePercent('memory_percent', 12.8)).toBe(true);
    expect(looksLikePercent('cpu_percent', 99)).toBe(true);
  });

  it('accepts the cpu plugin’s unlabelled percentages', () => {
    expect(looksLikePercent('total', cpuFixture.total)).toBe(true);
    expect(looksLikePercent('idle', cpuFixture.idle)).toBe(true);
  });

  it('rejects a byte count that merely happens to be small', () => {
    // mem.total is 132 GB — a meter would show it full the moment it dipped.
    expect(looksLikePercent('total', memFixture.total)).toBe(false);
    expect(looksLikePercent('free', 5)).toBe(false);
  });

  it('rejects non-numbers and out-of-range values', () => {
    expect(looksLikePercent('percent', null)).toBe(false);
    expect(looksLikePercent('percent', 140)).toBe(false);
    expect(looksLikePercent('percent', -1)).toBe(false);
  });
});

describe('humaniseField', () => {
  it('turns a snake_case key into a label', () => {
    expect(humaniseField('memory_percent')).toBe('Memory percent');
    expect(humaniseField('cpu-percent')).toBe('Cpu percent');
    expect(humaniseField('total')).toBe('Total');
  });

  it('leaves a key it cannot improve alone', () => {
    expect(humaniseField('_')).toBe('_');
  });
});

describe('readFields', () => {
  it('reads the selected fields with their numbers, text and percentages', () => {
    const readings = readFields(cpuFixture, ['total', 'cpucore']);

    expect(readings[0]).toMatchObject({
      name: 'total',
      label: 'Total',
      value: 46.8,
      percent: 46.8,
      unit: '%',
    });
    expect(readings[1]).toMatchObject({ name: 'cpucore', value: 12, percent: null, unit: null });
  });

  it('rounds an inferred percentage to one decimal', () => {
    // Glances serves full float precision; a meter labelled 36.442326476857346%
    // is not a readout.
    expect(readFields({ percent: 36.442326476857346 }, ['percent'])[0].text).toBe('36.4');
  });

  it('lets an explicit formatter override that rounding', () => {
    expect(readFields({ percent: 36.44 }, ['percent'], { percent: 'round(0)' })[0].text).toBe('36');
  });

  it('caps decimals on any unformatted float, without padding short ones', () => {
    expect(readFields({ cpucore: 12.5 }, ['cpucore'])[0].text).toBe('12.5');
    expect(readFields({ ratio: 85.40915631665675 }, ['ratio'])[0].text).toBe('85.41');
    // Integers are left exactly as they are.
    expect(readFields({ cpucore: 16 }, ['cpucore'])[0].text).toBe('16');
  });

  it('applies the field’s formatter, and then does not add a unit of its own', () => {
    const readings = readFields(cpuFixture, ['total'], { total: 'round(0)' });
    expect(readings[0].text).toBe('47');
    expect(readings[0].unit).toBeNull();
  });

  it('reads every key when no fields are selected', () => {
    expect(readFields(systemFixture, [])).toHaveLength(Object.keys(systemFixture).length);
  });

  it('says so when a field is not in the payload', () => {
    expect(readFields(cpuFixture, ['nope'])[0].text).toBe('(not found)');
  });

  it('has nothing to read from a non-object payload', () => {
    expect(readFields(null, ['total'])).toEqual([]);
    expect(readFields(42, ['total'])).toEqual([]);
  });
});

describe('heroReading', () => {
  it('promotes a lone numeric field to the hero', () => {
    expect(heroReading(readFields(cpuFixture, ['total']))?.name).toBe('total');
  });

  it('declines when there is more than one number to choose between', () => {
    expect(heroReading(readFields(cpuFixture, ['total', 'user']))).toBeNull();
  });

  it('declines when there is no number at all', () => {
    expect(heroReading(readFields(systemFixture, ['hostname']))).toBeNull();
  });
});

describe('gaugeReading', () => {
  it('prefers a percentage', () => {
    expect(gaugeReading(readFields(memFixture, ['total', 'percent']))?.name).toBe('percent');
  });

  it('falls back to any number, then to nothing', () => {
    expect(gaugeReading(readFields(memFixture, ['total']))?.name).toBe('total');
    expect(gaugeReading(readFields(systemFixture, ['hostname']))).toBeNull();
  });
});

describe('footer readouts', () => {
  it('reports a delta in percentage points, not percent', () => {
    expect(formatDeltaFromAvg(2.14, true)).toBe('+2.1 pt vs window avg');
    expect(formatDeltaFromAvg(-2.14, true)).toBe('−2.1 pt vs window avg');
    expect(formatDeltaFromAvg(12.4, true)).toBe('+12 pt vs window avg');
  });

  it('drops the unit when the series is not a percentage', () => {
    expect(formatDeltaFromAvg(3.2, false)).toBe('+3.2 vs window avg');
  });

  it('says nothing about a value it cannot compute', () => {
    expect(formatDeltaFromAvg(Number.NaN, true)).toBe('');
  });

  it('formats stat blocks at one decimal until they get big', () => {
    expect(formatStat(71.23, '%')).toBe('71.2%');
    expect(formatStat(534.1, '%')).toBe('534%');
    expect(formatStat(16, null)).toBe('16.0');
  });
});
