/**
 * How an endpoint's state is presented (ref §7.1, §9).
 *
 * Pure, because the rule matters more than it looks: an endpoint chip appears in the toolbar
 * roster, on every widget header, and in the settings list, and a host has to read identically in
 * all three. Deciding the colour in each of them separately is how they drift apart.
 */
import type { EndpointState } from '@/types/glances';
import type { AccentName } from '@/theme/telemetry';

/** Which palette the chip takes its colour from. */
export type EndpointTone =
  | { kind: 'accent'; name: AccentName }
  | { kind: 'signal'; role: 'info' | 'warning' | 'error' | 'muted' };

/**
 * The colour a chip wears.
 *
 * **The accent only ever colours a healthy endpoint.** Telling three green hosts apart is the
 * entire reason the accent setting exists, but a host that is failing has something more urgent to
 * say than which machine it is — so state wins outright, and a red host is red whatever colour the
 * user picked for it. With no accent set, a healthy chip falls back to the signal palette too,
 * which is why `color: null` is a sensible default rather than a missing value.
 */
export function endpointTone(state: EndpointState, color: AccentName | null): EndpointTone {
  switch (state) {
    case 'online':
      return color ? { kind: 'accent', name: color } : { kind: 'signal', role: 'info' };
    case 'degraded':
      return { kind: 'signal', role: 'warning' };
    case 'offline':
    case 'unsupported-version':
      return { kind: 'signal', role: 'error' };
    case 'disabled':
    case 'connecting':
      return { kind: 'signal', role: 'muted' };
  }
}

/**
 * Whether the dot pulses. Only a live endpoint does — the pulse *is* the liveness cue, so putting
 * it on a paused or failing host would be a lie told once a second.
 */
export function endpointPulses(state: EndpointState): boolean {
  return state === 'online';
}

/** Short label for the state, where one is shown beside the chip. */
export function endpointStateLabel(state: EndpointState): string {
  switch (state) {
    case 'online':
      return 'Online';
    case 'connecting':
      return 'Connecting';
    case 'degraded':
      return 'Degraded';
    case 'offline':
      return 'Offline';
    case 'unsupported-version':
      return 'Unsupported';
    case 'disabled':
      return 'Paused';
  }
}

/**
 * What a widget bound to this endpoint should show *instead of* its body, or `null` to show data.
 *
 * Only the states where the endpoint genuinely cannot serve. Two deliberate omissions:
 *
 * - **`degraded`** — one or two missed polls with the last reading still on screen is exactly when
 *   a dashboard is most useful, and covering it would hide the numbers at the moment someone is
 *   watching them. It dims instead (`endpointIsStale`).
 * - **`connecting`** — transient, and a widget may already be holding perfectly good data while the
 *   probe is still in flight. Replacing a live reading with "Connecting…" would be a regression on
 *   every launch. The chip already says it.
 */
export function endpointOverlay(state: EndpointState): string | null {
  switch (state) {
    case 'offline':
      return 'Endpoint offline';
    case 'unsupported-version':
      return 'Unsupported Glances version';
    case 'disabled':
      return 'Endpoint paused';
    default:
      return null;
  }
}

/** Whether the last data should be shown dimmed, because it may no longer be true. */
export function endpointIsStale(state: EndpointState): boolean {
  return state === 'degraded' || state === 'offline';
}
