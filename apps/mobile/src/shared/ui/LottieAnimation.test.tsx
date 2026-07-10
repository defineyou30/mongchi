import { describe, expect, it, vi } from "vitest";

import { LottieAnimation } from "./LottieAnimation";

vi.mock("lottie-react-native", () => ({ default: "LottieView" }));
vi.mock("react-native", () => ({
  StyleSheet: { absoluteFill: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 } },
  View: "View"
}));
vi.mock("../accessibility/useReducedMotionPreference", () => ({
  useReducedMotionPreference: () => true
}));

const source = { uri: "fixture.json" };
const style = { height: 96, width: 96 };

describe("LottieAnimation", () => {
  it("forwards a meaningful label to the native animation wrapper", () => {
    const element = LottieAnimation({ accessibilityLabel: "Pet moving in", source, style });

    expect(element.props.accessibilityLabel).toBe("Pet moving in");
    expect(element.props.accessibilityRole).toBe("image");
    expect(element.props.accessible).toBe(true);
    expect(element.props.accessibilityElementsHidden).toBe(false);
    expect(element.props.importantForAccessibility).toBe("yes");
  });

  it("hides decorative animation from both native accessibility trees", () => {
    const element = LottieAnimation({ decorative: true, source, style });

    expect(element.props.accessibilityLabel).toBeUndefined();
    expect(element.props.accessible).toBe(false);
    expect(element.props.accessibilityElementsHidden).toBe(true);
    expect(element.props.importantForAccessibility).toBe("no-hide-descendants");
  });

  it("treats a malformed dynamic label as decorative instead of announcing an empty element", () => {
    const element = LottieAnimation({ accessibilityLabel: "   ", source, style });

    expect(element.props.accessibilityLabel).toBeUndefined();
    expect(element.props.accessible).toBe(false);
    expect(element.props.accessibilityElementsHidden).toBe(true);
  });

  it("renders a stable poster and stops only visual playback for Reduce Motion", () => {
    const element = LottieAnimation({ accessibilityLabel: "Pet moving in", loop: true, posterProgress: 0.42, source, style });
    const animation = element.props.children;

    expect(animation.props.autoPlay).toBe(false);
    expect(animation.props.loop).toBe(false);
    expect(animation.props.progress).toBe(0.42);
  });

  it("clamps invalid poster progress to a valid static frame", () => {
    const beyondEnd = LottieAnimation({ accessibilityLabel: "Pet moving in", posterProgress: 4, source, style });
    const beforeStart = LottieAnimation({ accessibilityLabel: "Pet moving in", posterProgress: -2, source, style });
    const malformed = LottieAnimation({ accessibilityLabel: "Pet moving in", posterProgress: Number.NaN, source, style });

    expect(beyondEnd.props.children.props.progress).toBe(1);
    expect(beforeStart.props.children.props.progress).toBe(0);
    expect(malformed.props.children.props.progress).toBe(0.5);
  });
});
