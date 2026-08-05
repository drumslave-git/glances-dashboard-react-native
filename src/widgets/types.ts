/**
 * What every widget body is handed.
 *
 * Deliberately small. A body is given its *identity* (which endpoint, which options, how much room)
 * and reads its own data from the feed store — rather than being passed a payload, which would make
 * the frame responsible for knowing which plugins each of thirteen types wants.
 */
import type { EndpointStatus } from '@/types/glances';
import type { SizeMode } from '@/utils/typeScale';

export interface WidgetProps {
  /** The endpoint this widget reads from. `null` only for a **global** widget (M14). */
  endpointId: string | null;
  /** Already parsed against the type's schema — a body never validates its own options. */
  config: Record<string, unknown>;
  /** The measured presentation: width tier plus the short flag. */
  mode: SizeMode;
  /** Measured body box, in points. Charts and rings size off this, never off the window. */
  width: number;
  height: number;
  /** Accent for the healthy state — the endpoint's colour, or the primary accent. */
  accentColor: string;
  /**
   * The endpoint's probe results. Bodies use `limits` for threshold colouring; a body that reads
   * `capabilities` is usually better served by the catalog's own availability rule.
   */
  status?: EndpointStatus;
  testID?: string;
}
