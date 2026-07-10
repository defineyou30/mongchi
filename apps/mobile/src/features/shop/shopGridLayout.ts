const DEFAULT_CONTENT_INSET = 12;
const DEFAULT_GAP = 7;
const MIN_STANDARD_CARD_WIDTH = 72;
const MIN_COMPACT_CARD_WIDTH = 64;
const MIN_TOUCH_TARGET_WIDTH = 44;
const ACCESSIBILITY_FONT_SCALE = 1.4;

type ShopGridColumnCount = 1 | 2 | 3 | 4;

interface ShopGridLayoutInput {
  readonly containerWidth: number;
  readonly fontScale: number;
  readonly contentInset?: number;
  readonly gap?: number;
}

export interface ShopGridLayout {
  readonly cardWidth: number;
  readonly columnCount: ShopGridColumnCount;
  readonly gap: number;
  readonly innerWidth: number;
}

const cardWidthFor = (innerWidth: number, gap: number, columnCount: ShopGridColumnCount): number =>
  (innerWidth - gap * (columnCount - 1)) / columnCount;

export const resolveShopGridLayout = ({
  containerWidth,
  fontScale,
  contentInset = DEFAULT_CONTENT_INSET,
  gap = DEFAULT_GAP
}: ShopGridLayoutInput): ShopGridLayout => {
  const innerWidth = Math.max(0, containerWidth - contentInset * 2);
  const preferredColumns: readonly ShopGridColumnCount[] =
    fontScale >= ACCESSIBILITY_FONT_SCALE ? [2, 1] : [4, 3, 2, 1];
  const columnCount =
    preferredColumns.find((candidate) => {
      const minimumWidth = candidate === 4 ? MIN_STANDARD_CARD_WIDTH : candidate === 3 ? MIN_COMPACT_CARD_WIDTH : MIN_TOUCH_TARGET_WIDTH;
      return cardWidthFor(innerWidth, gap, candidate) >= minimumWidth;
    }) ?? 1;

  return {
    cardWidth: cardWidthFor(innerWidth, gap, columnCount),
    columnCount,
    gap,
    innerWidth
  };
};

export const balanceShopItemName = (name: string): string => {
  const words = name.trim().split(/\s+/u);
  if (words.length < 2) {
    return name.trim();
  }

  let best = name.trim();
  let bestLongestLine = Number.POSITIVE_INFINITY;

  for (let index = 1; index < words.length; index += 1) {
    const firstLine = words.slice(0, index).join(" ");
    const secondLine = words.slice(index).join(" ");
    const longestLine = Math.max(firstLine.length, secondLine.length);

    if (longestLine < bestLongestLine) {
      best = `${firstLine}\n${secondLine}`;
      bestLongestLine = longestLine;
    }
  }

  return best;
};
