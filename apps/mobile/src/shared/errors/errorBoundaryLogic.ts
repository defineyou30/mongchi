// Pure state-machine logic for ErrorBoundary.tsx, split out so it can be
// unit tested without importing "react-native" (see useTypewriter.ts for
// the same pattern -- this repo's vitest setup has no RN/Metro transform,
// so any test file that imports a module which itself imports
// "react-native" fails to parse under Rolldown/Vite).

export interface ErrorBoundaryLogicState {
  error: Error | null;
}

/** Mirrors React.Component's getDerivedStateFromError contract. */
export const deriveErrorBoundaryState = (error: Error): ErrorBoundaryLogicState => ({ error });

/** The state ErrorBoundary resets to on retry. */
export const clearedErrorBoundaryState: ErrorBoundaryLogicState = { error: null };

export const initialErrorBoundaryState: ErrorBoundaryLogicState = { error: null };
