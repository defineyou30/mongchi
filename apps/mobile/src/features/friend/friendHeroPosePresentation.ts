import type { ExpressionPack, GeneratedAssetState } from "@mongchi/shared";
import { expressionPacks } from "@mongchi/shared";

import type { FriendPoseCard, FriendPoseCell } from "./friendProfilePresentation";

export interface HeroPoseSlide {
  cell: FriendPoseCell;
  /** Present only for a locked cell -- the pack card that would unlock it. Null for an owned cell, or (defensively) if no pack claims the state. */
  lockedCard: FriendPoseCard | null;
}

/**
 * Orders the pose gallery's cells for the hero pager: idle always leads (it's
 * the pet's everyday default look, so swiping should start from "how they
 * usually look"), every other owned pose follows in its existing order, then
 * locked poses trail at the end -- so the pager reads left-to-right as
 * "familiar -> still undiscovered", the same direction the old grid's reveal
 * stagger animated in.
 */
export const orderHeroPoseCells = (cells: readonly FriendPoseCell[]): FriendPoseCell[] => {
  const idleIndex = cells.findIndex((cell) => cell.state === "idle");

  if (idleIndex <= 0) {
    return [...cells];
  }

  const idleCell = cells[idleIndex]!;

  return [idleCell, ...cells.slice(0, idleIndex), ...cells.slice(idleIndex + 1)];
};

const findPackForState = (state: GeneratedAssetState): ExpressionPack | null =>
  (expressionPacks as readonly ExpressionPack[]).find((pack) => pack.states.includes(state)) ?? null;

/**
 * Pairs each ordered pose cell with the pack card that would unlock it
 * (locked cells only), so the hero pager's locked slide can render its own
 * "Unlock" overlay without the screen re-deriving the state -> pack lookup
 * inline. Purely a display-layer join over the two arrays
 * getFriendPoseGalleryPresentation already returns -- it doesn't change what
 * either one contains.
 */
export const buildHeroPoseSlides = (cells: readonly FriendPoseCell[], cards: readonly FriendPoseCard[]): HeroPoseSlide[] =>
  orderHeroPoseCells(cells).map((cell) => {
    if (cell.status === "owned") {
      return { cell, lockedCard: null };
    }

    const pack = findPackForState(cell.state);
    const lockedCard = pack ? (cards.find((card) => card.packId === pack.id) ?? null) : null;

    return { cell, lockedCard };
  });

/**
 * How many locked slides in this pager belong to each pack. A pack's unlock
 * card renders identically on every one of its locked slides (see
 * buildHeroPoseSlides above), which used to read like a per-slide price tag
 * -- this count lets the hero pager's overlay instead say "Unlock 3 more
 * moments · 12cr", making it unmistakable that the price buys the whole
 * pack's remaining poses at once, not just the one slide it happens to be
 * showing.
 */
export const getRemainingPoseCountByPackId = (slides: readonly HeroPoseSlide[]): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const slide of slides) {
    if (slide.cell.status !== "locked" || !slide.lockedCard) {
      continue;
    }

    const packId = slide.lockedCard.packId;
    counts[packId] = (counts[packId] ?? 0) + 1;
  }

  return counts;
};

/** "Unlock 3 more moments · 12cr" -- the hero pager's locked-slide overlay headline, built from the pack-wide remaining count rather than the (misleadingly per-slide-looking) card.label. */
export const getUnlockOverlayHeadline = (remainingCount: number, creditCost: number): string =>
  `Unlock ${remainingCount} more moment${remainingCount === 1 ? "" : "s"} · ${creditCost}cr`;
