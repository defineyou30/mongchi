import type { CreditWalletGrant } from "./wallet";
import type { ItemId } from "./common";

/**
 * Bond level-up reward track. Levels without an entry still trigger the
 * celebration reaction; entries add tangible rewards on top so accumulating
 * bond XP always leads somewhere.
 */
export interface BondLevelReward {
  wallet?: CreditWalletGrant;
  items?: Array<{ itemId: ItemId; quantity: number }>;
  celebrationKo: string;
  celebrationEn: string;
}

export const bondLevelRewards: Partial<Record<number, BondLevelReward>> = {
  2: {
    wallet: { freeChatTickets: 2 },
    items: [{ itemId: "item_salmon_bites", quantity: 2 }],
    celebrationKo: "우리 사이가 한 뼘 더 가까워졌어! 이야기 나눌 시간도 늘었어.",
    celebrationEn: "We got a whole step closer! More time to talk together too."
  },
  3: {
    items: [{ itemId: "item_berry_yogurt", quantity: 2 }],
    celebrationKo: "친해진 기념으로 맛있는 걸 나눠 먹자!",
    celebrationEn: "Let's share something tasty to celebrate getting closer!"
  },
  4: {
    items: [{ itemId: "item_cushion_rose", quantity: 1 }],
    celebrationKo: "우리 집에 포근한 자리가 하나 늘었어.",
    celebrationEn: "Our little home just got one more cozy spot."
  },
  5: {
    wallet: { bonusCredits: 5 },
    celebrationKo: "다섯 번째 마음 표시! 오늘은 특별한 날로 기억할래.",
    celebrationEn: "Five hearts strong! I am remembering today as a special one."
  },
  7: {
    items: [{ itemId: "item_duck_biscuit", quantity: 2 }],
    celebrationKo: "이제 눈빛만 봐도 알 것 같아. 간식 타임이지?",
    celebrationEn: "I can read your eyes now. Snack time, right?"
  },
  10: {
    wallet: { bonusCredits: 10, freeChatTickets: 3 },
    celebrationKo: "우리는 이제 진짜 단짝이야. 언제나 네 편이야.",
    celebrationEn: "We are true best friends now. I am always on your side."
  }
};

/** Levels crossed when XP moves from previousLevel to nextLevel (exclusive/inclusive). */
export const getCrossedBondLevels = (previousLevel: number, nextLevel: number): number[] => {
  const levels: number[] = [];

  for (let level = previousLevel + 1; level <= nextLevel; level += 1) {
    levels.push(level);
  }

  return levels;
};
