import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, shadows } from "../design/tokens";
import { LottieAnimation } from "./LottieAnimation";
import type { LottieAnimationSource } from "./LottieAnimation";

export interface AppDialogOptions {
  readonly title: string;
  readonly message: string;
  readonly primaryLabel?: string;
  readonly secondaryLabel?: string;
  readonly onPrimary?: () => void;
  readonly onSecondary?: () => void;
  readonly animationSource?: LottieAnimationSource;
}

interface AppDialogContextValue {
  readonly showDialog: (options: AppDialogOptions) => void;
  readonly dismissDialog: () => void;
}

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

export function AppDialogProvider({ children }: PropsWithChildren) {
  const [dialog, setDialog] = useState<AppDialogOptions | null>(null);
  const dismissDialog = useCallback(() => setDialog(null), []);
  const showDialog = useCallback((options: AppDialogOptions) => setDialog(options), []);
  const value = useMemo<AppDialogContextValue>(() => ({ dismissDialog, showDialog }), [dismissDialog, showDialog]);

  const handlePrimary = () => {
    const onPrimary = dialog?.onPrimary;

    dismissDialog();
    onPrimary?.();
  };

  const handleSecondary = () => {
    const onSecondary = dialog?.onSecondary;

    dismissDialog();
    onSecondary?.();
  };

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      <Modal transparent animationType="fade" statusBarTranslucent visible={dialog !== null} onRequestClose={dismissDialog}>
        <View style={styles.overlay}>
          <View accessibilityRole="alert" style={styles.dialog}>
            {dialog?.animationSource ? (
              <LottieAnimation
                accessibilityLabel={`${dialog.title} animation`}
                loop
                source={dialog.animationSource}
                style={styles.animation}
              />
            ) : null}
            <Text accessibilityRole="header" style={styles.title}>
              {dialog?.title}
            </Text>
            <Text style={styles.message}>{dialog?.message}</Text>
            <View style={styles.actions}>
              {dialog?.secondaryLabel ? (
                <Pressable accessibilityRole="button" style={[styles.button, styles.secondaryButton]} onPress={handleSecondary}>
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>{dialog.secondaryLabel}</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" style={[styles.button, styles.primaryButton]} onPress={handlePrimary}>
                <Text style={[styles.buttonText, styles.primaryButtonText]}>{dialog?.primaryLabel ?? "OK"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const value = useContext(AppDialogContext);

  if (!value) {
    throw new Error("useAppDialog must be used inside AppDialogProvider.");
  }

  return value;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,24,38,0.42)",
    padding: 24
  },
  dialog: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 28,
    borderWidth: 4,
    borderBottomWidth: 7,
    borderColor: colors.cream,
    backgroundColor: "rgba(255,245,222,0.98)",
    padding: 18,
    alignItems: "center",
    gap: 12,
    ...shadows.gamePanel
  },
  animation: {
    width: 112,
    height: 112
  },
  title: {
    color: colors.ink,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "900",
    textAlign: "center"
  },
  message: {
    color: colors.mutedInk,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center"
  },
  actions: {
    width: "100%",
    flexDirection: "row",
    gap: 10
  },
  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    borderWidth: 3,
    borderBottomWidth: 5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  primaryButton: {
    backgroundColor: colors.apple,
    borderColor: colors.cream
  },
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.78)",
    borderColor: "rgba(255,255,255,0.92)"
  },
  buttonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900"
  },
  primaryButtonText: {
    color: colors.white
  },
  secondaryButtonText: {
    color: colors.woodDark
  }
});
