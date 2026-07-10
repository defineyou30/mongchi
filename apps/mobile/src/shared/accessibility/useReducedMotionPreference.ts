import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotionPreference() {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(true);

  useEffect(() => {
    let mounted = true;
    let receivedNativeChange = false;

    const handleReduceMotionChange = (enabled: boolean) => {
      if (!mounted) {
        return;
      }

      receivedNativeChange = true;
      setReduceMotionEnabled(enabled);
    };

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted && !receivedNativeChange) {
        setReduceMotionEnabled(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", handleReduceMotionChange);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotionEnabled;
}
