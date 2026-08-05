import { TIME_WINDOWS, type TimeWindow } from '@/utils/sampleBuffer';

/**
 * The time window a config asks for, as one of the windows the chart understands.
 *
 * The config stores **seconds** (the reference's `windowSec`, which is also what sizes the ring
 * buffers) while the chart takes a named window. This is the one place that translation happens, so
 * a config carrying a value no window matches falls back to the shortest rather than to no chart.
 */
export function windowFromConfig(config: Record<string, unknown>): TimeWindow {
  const seconds = config['windowSec'];
  if (typeof seconds !== 'number') return '5m';
  // `TIME_WINDOWS` is milliseconds; the config is seconds.
  const match = (Object.keys(TIME_WINDOWS) as TimeWindow[]).find(
    (name) => TIME_WINDOWS[name] === seconds * 1000,
  );
  return match ?? '5m';
}
