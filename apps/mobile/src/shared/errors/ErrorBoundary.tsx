import type { ErrorInfo, PropsWithChildren, ReactNode } from "react";
import { Component } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, shadows, spacing } from "../design/tokens";
import { fontPairFamilies } from "../design/fontPair";
import { reporter as defaultReporter } from "./reporter";
import type { ErrorReporter } from "./reporter";
import { deriveErrorBoundaryState, initialErrorBoundaryState } from "./errorBoundaryLogic";
import type { ErrorBoundaryLogicState } from "./errorBoundaryLogic";

// Root-level crash net (see docs/readiness-diagnosis.md item 5): without
// this, any render-time throw anywhere in the tree takes the whole app down
// to a blank white screen with nothing in the UI to recover from. This
// component wraps the router in app/_layout.tsx, catches render errors, and
// shows a warm "try again" screen instead -- plus reports the crash so it's
// visible after the fact via Settings diagnostics (see readErrorLog).
//
// Intentionally NOT using useFontFamilies/useAppDialog here: those live
// behind hooks/providers that could themselves be implicated in a crash, or
// simply haven't mounted yet (this boundary sits above font loading in
// _layout.tsx). Uses static tokens only so the fallback can never itself throw.

const fallbackFontFamily = fontPairFamilies.A.body;
const fallbackTitleFontFamily = fontPairFamilies.A.display;

export interface ErrorBoundaryProps extends PropsWithChildren {
  /** Injectable for tests; defaults to the app-wide reporter singleton. */
  reporter?: ErrorReporter;
  /** Pet name used in the fallback copy, e.g. "Mochi is fine". Defaults to a generic "Your friend". */
  petName?: string;
  /** Optional custom fallback renderer, given the caught error and a retry callback. */
  renderFallback?: (error: Error, retry: () => void) => ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryLogicState> {
  state: ErrorBoundaryLogicState = initialErrorBoundaryState;

  static getDerivedStateFromError(error: Error): ErrorBoundaryLogicState {
    return deriveErrorBoundaryState(error);
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const reporter = this.props.reporter ?? defaultReporter;
    reporter.captureError(error, {
      source: "error_boundary",
      componentStack: errorInfo.componentStack ?? undefined
    });
  }

  handleRetry = (): void => {
    this.setState(initialErrorBoundaryState);
  };

  render(): ReactNode {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    if (this.props.renderFallback) {
      return this.props.renderFallback(error, this.handleRetry);
    }

    const petName = this.props.petName ?? "Your friend";

    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={[styles.title, { fontFamily: fallbackTitleFontFamily }]}>Something hiccuped</Text>
          <Text style={[styles.message, { fontFamily: fallbackFontFamily }]}>
            {petName} is fine — this screen just tripped over its own paws. Let's try again.
          </Text>
          <Text accessibilityRole="button" style={[styles.retryButton, { fontFamily: fallbackFontFamily }]} onPress={this.handleRetry}>
            Try again
          </Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.sky,
    padding: spacing.xl
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,245,222,0.96)",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.86)",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
    ...shadows.soft
  },
  title: {
    fontSize: 22,
    color: colors.woodDark,
    textAlign: "center"
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.woodDark,
    textAlign: "center"
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.honey,
    color: colors.white,
    fontSize: 16,
    textAlign: "center",
    overflow: "hidden"
  }
});
