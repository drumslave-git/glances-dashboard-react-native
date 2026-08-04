import { rawLimits } from '@/__fixtures__/payloads';
import { flattenLimits } from './probe';
import { sensorThresholdLevel, thresholdLevel, thresholdTone } from './thresholds';

const limits = flattenLimits(rawLimits);

describe('thresholdLevel', () => {
  it('classifies against the real limits the server published', () => {
    // cpu_total is careful 65 / warning 75 / critical 85 on this host.
    expect(thresholdLevel(limits, 'cpu_total', 10)).toBe('ok');
    expect(thresholdLevel(limits, 'cpu_total', 70)).toBe('careful');
    expect(thresholdLevel(limits, 'cpu_total', 80)).toBe('warning');
    expect(thresholdLevel(limits, 'cpu_total', 90)).toBe('critical');
  });

  it('treats a limit as inclusive', () => {
    expect(thresholdLevel(limits, 'cpu_total', 65)).toBe('careful');
    expect(thresholdLevel(limits, 'cpu_total', 85)).toBe('critical');
  });

  it('never invents a threshold the server did not publish', () => {
    // A host with no limit for a stat is not a host in trouble.
    expect(thresholdLevel(limits, 'no_such_stat', 100)).toBe('ok');
    expect(thresholdLevel(undefined, 'cpu_total', 100)).toBe('ok');
    expect(thresholdLevel({}, 'cpu_total', 100)).toBe('ok');
  });

  it('reads an unreported metric as ok, not as critical', () => {
    // A vendor that does not report GPU temperature must not paint the panel red.
    expect(thresholdLevel(limits, 'gpu_temperature', null)).toBe('ok');
    expect(thresholdLevel(limits, 'gpu_temperature', undefined)).toBe('ok');
    expect(thresholdLevel(limits, 'gpu_temperature', Number.NaN)).toBe('ok');
  });

  it('uses the highest level that applies when several are crossed', () => {
    expect(thresholdLevel({ x_careful: 10, x_warning: 20, x_critical: 30 }, 'x', 999)).toBe('critical');
  });

  it('works with only some levels defined', () => {
    expect(thresholdLevel({ x_critical: 30 }, 'x', 25)).toBe('ok');
    expect(thresholdLevel({ x_critical: 30 }, 'x', 35)).toBe('critical');
  });
});

describe('thresholdTone', () => {
  it('paints a healthy reading in the accent rather than a green', () => {
    // Green is reserved for the one place it means something of its own — upload against a cyan
    // download — so "fine" and "upload" never say the same thing in two colours.
    expect(thresholdTone('ok')).toBe('accent');
  });

  it('maps the rest onto the design semantic tones', () => {
    expect(thresholdTone('careful')).toBe('info');
    expect(thresholdTone('warning')).toBe('warning');
    expect(thresholdTone('critical')).toBe('error');
  });
});

describe('sensorThresholdLevel', () => {
  it('uses the per-item limits a sensor carries, since a fan and a core share no scale', () => {
    expect(sensorThresholdLevel(50, 80, 100)).toBe('ok');
    expect(sensorThresholdLevel(85, 80, 100)).toBe('warning');
    expect(sensorThresholdLevel(105, 80, 100)).toBe('critical');
  });

  it('is ok when the sensor reports nothing, or carries no limits', () => {
    expect(sensorThresholdLevel(null, 80, 100)).toBe('ok');
    expect(sensorThresholdLevel(999, undefined, undefined)).toBe('ok');
  });
});
