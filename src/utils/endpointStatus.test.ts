import type { EndpointState } from '@/types/glances';
import {
  endpointIsStale,
  endpointOverlay,
  endpointPulses,
  endpointStateLabel,
  endpointTone,
} from './endpointStatus';

const ALL_STATES: EndpointState[] = [
  'connecting',
  'online',
  'degraded',
  'offline',
  'unsupported-version',
  'disabled',
];

describe('endpointTone', () => {
  it('gives a healthy endpoint its own accent', () => {
    expect(endpointTone('online', 'cyan')).toEqual({ kind: 'accent', name: 'cyan' });
  });

  it('falls back to a signal colour when no accent is set', () => {
    // `null` is the default, so this is the ordinary case, not an edge one.
    expect(endpointTone('online', null)).toEqual({ kind: 'signal', role: 'info' });
  });

  it('lets state beat the accent on every unhealthy state', () => {
    // Telling hosts apart matters right up until one of them is in trouble, and then it does not.
    for (const state of ALL_STATES.filter((s) => s !== 'online')) {
      expect(endpointTone(state, 'lime').kind).toBe('signal');
    }
  });

  it('separates paused from failed', () => {
    // A deliberate pause must never wear the failure colour.
    expect(endpointTone('disabled', null)).toEqual({ kind: 'signal', role: 'muted' });
    expect(endpointTone('offline', null)).toEqual({ kind: 'signal', role: 'error' });
  });

  it('escalates degraded to warning and offline to error', () => {
    expect(endpointTone('degraded', null)).toEqual({ kind: 'signal', role: 'warning' });
    expect(endpointTone('unsupported-version', null)).toEqual({ kind: 'signal', role: 'error' });
  });
});

describe('endpointPulses', () => {
  it('pulses only while genuinely live', () => {
    for (const state of ALL_STATES) {
      expect(endpointPulses(state)).toBe(state === 'online');
    }
  });
});

describe('endpointStateLabel', () => {
  it('names every state, and calls a disabled endpoint paused rather than off', () => {
    for (const state of ALL_STATES) expect(endpointStateLabel(state)).toBeTruthy();
    expect(endpointStateLabel('disabled')).toBe('Paused');
  });
});

describe('endpointOverlay', () => {
  it('covers a widget only when its data cannot be trusted at all', () => {
    expect(endpointOverlay('offline')).toBe('Endpoint offline');
    expect(endpointOverlay('disabled')).toBe('Endpoint paused');
    expect(endpointOverlay('unsupported-version')).toMatch(/Unsupported/);
  });

  it('does not cover a healthy, degraded or still-connecting endpoint', () => {
    // Degraded: one or two missed polls with the last reading still on screen is when a dashboard
    // is most useful, and an overlay would hide the numbers exactly then.
    // Connecting: transient, and the widget may already hold good data — replacing a live reading
    // with "Connecting…" would be a regression on every launch.
    expect(endpointOverlay('online')).toBeNull();
    expect(endpointOverlay('degraded')).toBeNull();
    expect(endpointOverlay('connecting')).toBeNull();
  });
});

describe('endpointIsStale', () => {
  it('dims data that may no longer be true, and nothing else', () => {
    expect(endpointIsStale('degraded')).toBe(true);
    expect(endpointIsStale('offline')).toBe(true);
    expect(endpointIsStale('online')).toBe(false);
    expect(endpointIsStale('connecting')).toBe(false);
  });
});
