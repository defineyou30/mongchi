import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const failures = [];

const readText = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), "utf8");

const requireIncludes = (relativePath, fragments, label) => {
  const content = readText(relativePath);

  for (const fragment of fragments) {
    if (!content.includes(fragment)) {
      failures.push(`${label}: ${relativePath} must include ${JSON.stringify(fragment)}.`);
    }
  }
};

const requireExcludes = (relativePath, fragments, label) => {
  const content = readText(relativePath);

  for (const fragment of fragments) {
    if (content.includes(fragment)) {
      failures.push(`${label}: ${relativePath} must not include ${JSON.stringify(fragment)}.`);
    }
  }
};

requireIncludes(
  "docs/design/care-economy-bm-guide.md",
  [
    "Keep care, relationship, and monetization as separate systems.",
    "Satisfaction / Mood",
    "It is not spendable currency.",
    "Bond",
    "It should not decrease from ordinary absence or low satisfaction.",
    "Credits",
    "Free Chat Tickets",
    "Spend priority: free ticket first, then bonus credits, then paid credits.",
    "Plus Pass",
    "Home care actions should give immediate lightweight feedback",
    "Food +28",
    "Mood +14",
    "Energy -8",
    "Basic water care is pet hydration, not a plant reward faucet.",
    "Free short reactions are authored/local and must not call an AI provider.",
    "Longer AI chat requires active Plus entitlement, free chat ticket, or sufficient credits.",
    "Local preview can show saved tickets/credits",
    "ready long chat, local long-chat preview, or locked Plus chat",
    "Treats are repeatable consumables and can support credit BM, but they are not required for baseline happiness.",
    "Store purchase verification, raw receipt tokens, provider keys, and storage credentials stay out of the mobile app."
  ],
  "Care economy guide"
);

requireIncludes(
  "docs/product/product-direction.md",
  [
    "Care, relationship, and monetization stay separate",
    "short local reactions remain free/authored"
  ],
  "Product direction care economy"
);

requireIncludes(
  "packages/shared/src/domain/care.ts",
  [
    "CareSatisfactionSummary",
    "getCareSatisfactionBreakdown",
    "recommendedAction",
    "food: \"A meal would help most.\"",
    "thirst: \"A little water would help.\"",
    "attention: \"Fresh attention would help.\""
  ],
  "Care satisfaction domain"
);

requireIncludes(
  "packages/shared/src/domain/relationship.ts",
  [
    "RelationshipState",
    "bondXpByCareAction",
    "talk: 3",
    "affection: 4",
    "treat: 5",
    "getBondLevelFromXp",
    "grantRelationshipBondXp"
  ],
  "Relationship bond domain"
);

requireIncludes(
  "packages/shared/src/domain/wallet.ts",
  [
    "CreditWallet",
    "bonusCredits",
    "freeChatTickets",
    "PremiumChatPaymentMode",
    "plus_pass",
    "free_ticket",
    "credit",
    "locked",
    "getPremiumChatPaymentPreview",
    "spendPremiumChatTurn",
    "spendCredits"
  ],
  "Wallet and premium chat economy"
);

requireIncludes(
  "packages/shared/src/session/prototypeSession.ts",
  [
    "getAvailableTreatItemId",
    "consumeInventoryItem",
    "spendCredits",
    "action === \"treat\" && !consumableTreatItemId",
    "lastCareReward: null"
  ],
  "Prototype session economy separation"
);

requireIncludes(
  "apps/mobile/src/features/terrarium/terrariumHomePresentation.ts",
  [
    "HomeCareActionFeedbackPresentation",
    "getHomeCareActionFeedbackPresentation",
    "Care rhythm updated.",
    "Bond +"
  ],
  "Home action-result feedback presentation"
);

requireIncludes(
  "apps/mobile/src/features/terrarium/TerrariumHomeScreen.tsx",
  [
    "relationshipState",
    "lastActionSnapshot",
    "careFeedback",
    "careFeedbackBubble",
    "statusIconAssets",
    "actionLockedUntilRef",
    "getVisibleHomeTreatMenuOptions",
    "showTreatAction",
    "Give treat",
    "Food & treats",
    "resourceTrack",
    "resourceSegment",
    "Open shop",
    "Open settings",
    "Open ${activePet.name}'s chat"
  ],
  "Home UI economy affordances"
);

requireExcludes(
  "apps/mobile/src/features/terrarium/TerrariumHomeScreen.tsx",
  [
    "creditBalance",
    "type: \"counter\"",
    "icon: \"kit\"",
    "resourceCounter"
  ],
  "Home UI economy affordances"
);

requireIncludes(
  "docs/design/home-ui-interaction-contract.md",
  [
    "The right side is for status and temporary context, not permanent duplicate actions.",
    "a permanent `Play` button, because Play already belongs in the bottom dock",
    "a permanent `Treat shop` if there is no active treat need or promotion",
    "Credits/gems are spendable wallet values and belong in Shop, not the main Home scene.",
    "Do not show a coin or gem HUD on Home until a separate Home-specific reward loop exists in data.",
    "Kit is inventory quantity, not currency, and belongs in Shop or Inventory summaries.",
    "Water is pet hydration on Home; plant growth belongs to a separate optional system.",
    "Basic care must never require credits or Plus."
  ],
  "Home UI interaction contract"
);

requireIncludes(
  "apps/mobile/src/features/terrarium/terrariumHomePresentation.test.ts",
  [
    "summarizes feed action meter and bond changes for immediate home feedback",
    "marks play as a cozy tradeoff when it spends energy or cleanliness",
    "keeps water feedback in the pet-care loop without minting credits"
  ],
  "Home action feedback tests"
);

requireIncludes(
  "apps/mobile/src/features/chat/ChatGateScreen.tsx",
  [
    "getPremiumChatPaymentPreview",
    "getPremiumChatAccessPresentation",
    "getShortChatReplyText",
    "petThought",
    "premiumGate",
    "premiumChatReady",
    "premiumChatAccess",
    "startApiPremiumChatThread",
    "sendApiPremiumChatTurn",
    "syncWallet(sent.wallet)",
    "View Plus pass"
  ],
  "Chat free versus premium boundary"
);

requireExcludes(
  "apps/mobile/src/features/chat/ChatGateScreen.tsx",
  [
    "handleFreeTalk",
    "Say hello to",
    "quickBubble",
    "careCtaBubble"
  ],
  "Chat free versus premium boundary simplified UI"
);

requireIncludes(
  "apps/mobile/src/features/chat/chatGatePresentation.ts",
  [
    "getPremiumChatAccessPresentation",
    "Long chat ready",
    "Long chat preview",
    "Tickets and credits are saved for Plus chat.",
    "Plus chat locked"
  ],
  "Chat premium access presentation"
);

requireIncludes(
  "apps/mobile/src/features/chat/chatGatePresentation.test.ts",
  [
    "shows ready long-chat copy when the API path and payment method are available",
    "keeps local-preview ticket and credit balances distinct from the free short hello",
    "explains the locked state when no Plus pass, ticket, or credit can start long chat"
  ],
  "Chat premium access tests"
);

requireIncludes(
  "apps/mobile/src/features/shop/shopCatalogPresentation.ts",
  [
    "premiumPassFallbackProduct",
    "isTreatInventoryItem",
    "repeatable",
    "Buy more",
    "getPremiumPassShopPresentation",
    "server_catalog",
    "local_preview"
  ],
  "Shop BM presentation"
);

requireIncludes(
  "apps/mobile/src/features/shop/ShopPreviewScreen.tsx",
  [
    "Shop credit gem icon",
    "Shop wallet, ${creditBalance} credits and ${shopSummary.ownedQuantity} owned kit items",
    "Wallet credit gem",
    "{creditBalance}",
    "Kit owned",
    "locked shop items"
  ],
  "Shop credit wallet presentation"
);

requireExcludes(
  "apps/mobile/src/features/shop/ShopPreviewScreen.tsx",
  [
    "Shop shelf ticket icon",
    "Shop owned coin",
    "Shop locked gem"
  ],
  "Shop credit wallet presentation"
);

requireIncludes(
  "packages/shared/src/__tests__/wallet.test.ts",
  [
    "previews premium chat payment priority before a reply is sent",
    "plus_pass",
    "free_ticket",
    "credit",
    "locked"
  ],
  "Wallet tests"
);

requireIncludes(
  "packages/shared/src/__tests__/prototypeSession.test.ts",
  [
    "keeps wallet credits, bond growth, and pet water separate from plant growth",
    "does not grant plant bloom rewards from the core pet water action"
  ],
  "Prototype economy tests"
);

requireIncludes(
  "apps/mobile/src/features/shop/shopCatalogPresentation.test.ts",
  [
    "keeps owned treat items repeatable for credit BM loops",
    "shows a local Plus pass fallback when no server catalog is loaded",
    "marks the server premium chat product active from matching entitlements"
  ],
  "Shop economy tests"
);

requireExcludes(
  "docs/design/care-economy-bm-guide.md",
  ["spend heart", "heart currency", "bond penalty", "paywalled basic care"],
  "Care economy anti-patterns"
);

if (failures.length > 0) {
  console.error("Care economy design validation failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Care economy design validation passed.");
