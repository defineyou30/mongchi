import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, shadows, spacing } from "../design/tokens";

interface SectionProps {
  title: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: radii.panel,
    backgroundColor: "rgba(255,232,199,0.88)",
    borderWidth: 3,
    borderBottomWidth: 6,
    borderColor: "rgba(255,255,255,0.88)",
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.gamePanel
  },
  title: {
    color: colors.skyDeep,
    fontSize: 17,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  body: {
    gap: spacing.md
  }
});
