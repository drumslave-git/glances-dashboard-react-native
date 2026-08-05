/**
 * Catches a crash inside one widget body.
 *
 * The reference added this after a widget took the whole window with it (its v1.13.0 commit is
 * literally "Catch crashes above the widget bodies instead of blanking the window"). A dashboard is
 * a wall of independent panels: one of them meeting a payload it cannot read should cost that
 * panel, not the eleven around it — and certainly not the toolbar you would use to remove it.
 *
 * A class component because that is still the only way to implement `componentDidCatch`.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { YStack } from 'tamagui';

import { UiText } from '@/components/telemetry/text';

interface Props {
  widgetId: string;
  children: ReactNode;
}

interface State {
  message: string | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : 'Unknown error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Left on the console rather than swallowed: the panel says *that* it failed, and this is
    // where someone finds out why.
    console.error(`Widget ${this.props.widgetId} crashed:`, error, info.componentStack);
  }

  /**
   * Reset when the widget changes.
   *
   * Without this a panel that crashed once stays broken until the board is reloaded, even after
   * the user edits it to something that would render — which looks like the edit failing.
   */
  componentDidUpdate(previous: Props): void {
    if (previous.widgetId !== this.props.widgetId && this.state.message !== null) {
      this.setState({ message: null });
    }
  }

  render(): ReactNode {
    if (this.state.message === null) return this.props.children;
    return (
      <YStack flex={1} minH={0} justify="center" testID={`widget-error-${this.props.widgetId}`}>
        <UiText variant="metric" color="$textDim">
          This widget could not be drawn.
        </UiText>
        <UiText variant="footer" color="$textFaint" numberOfLines={2}>
          {this.state.message}
        </UiText>
      </YStack>
    );
  }
}
