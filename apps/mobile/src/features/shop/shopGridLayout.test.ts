import { describe, expect, it } from "vitest";

import { balanceShopItemName, resolveShopGridLayout } from "./shopGridLayout";

describe("shop grid layout", () => {
  it("fills a standard portrait shelf with four equal cards", () => {
    // Given: the measured shelf width on a standard portrait iPhone.
    const containerWidth = 361;

    // When: the non-Moment grid resolves its measured layout.
    const layout = resolveShopGridLayout({ containerWidth, fontScale: 1 });

    // Then: four cards and their gaps exactly consume the inner shelf width.
    expect(layout.columnCount).toBe(4);
    expect(layout.cardWidth).toBe(79);
    expect(layout.cardWidth * layout.columnCount + layout.gap * (layout.columnCount - 1)).toBe(layout.innerWidth);
  });

  it("uses three readable columns on a compact portrait shelf", () => {
    // Given: a compact iPhone shelf that cannot hold four readable cards.
    const containerWidth = 288;

    // When: the grid resolves the compact layout.
    const layout = resolveShopGridLayout({ containerWidth, fontScale: 1 });

    // Then: it uses three columns and keeps every target comfortably above 44 points.
    expect(layout.columnCount).toBe(3);
    expect(layout.cardWidth).toBeGreaterThanOrEqual(44);
  });

  it("uses two columns for accessibility text without wasting the row", () => {
    // Given: a standard shelf with an accessibility font scale.
    const containerWidth = 361;

    // When: the grid resolves the large-text layout.
    const layout = resolveShopGridLayout({ containerWidth, fontScale: 1.5 });

    // Then: two equal cards fill the inner shelf and leave room for two-line names.
    expect(layout.columnCount).toBe(2);
    expect(layout.cardWidth).toBe(165);
    expect(layout.cardWidth * layout.columnCount + layout.gap).toBe(layout.innerWidth);
  });

  it("balances a long item name across two complete lines without truncating it", () => {
    // Given: the long catalog label visible in the reported broken screenshot.
    const name = "Sweet Potato Chews";

    // When: the card formats the label for its two-line name slot.
    const balanced = balanceShopItemName(name);

    // Then: all words remain visible and the line break is intentional.
    expect(balanced).toBe("Sweet\nPotato Chews");
    expect(balanced.replace("\n", " ")).toBe(name);
  });
});
