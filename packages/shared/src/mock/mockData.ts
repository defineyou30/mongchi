import type {
  CareState,
  Conversation,
  ConversationMessage,
  CreditWallet,
  Entitlement,
  GeneratedAsset,
  GenerationJob,
  Inventory,
  Item,
  PetProfile,
  PetSpecies,
  PremiumChatGate,
  ReactionRule,
  RelationshipState,
  WalkSession
} from "../domain";
import { DEFAULT_THEME_ID, generatedAssetStates } from "../domain";
import { expandedReactionRules } from "./expandedReactionRules";

const now = "2026-06-24T09:00:00.000Z";

export const mockPetProfile: PetProfile = {
  id: "pet_miso_001",
  userId: "user_demo_001",
  name: "Miso",
  species: "dog",
  personalityTags: ["curious", "affectionate"],
  talkingStyle: "gentle",
  favoriteThing: "cloud-shaped leaves",
  lifecycleStatus: "active",
  activeGenerationJobId: "gen_miso_001",
  activeAssetId: "asset_miso_idle_001",
  createdAt: now,
  updatedAt: now
};

export const mockGenerationJob: GenerationJob = {
  id: "gen_miso_001",
  userId: "user_demo_001",
  petId: "pet_miso_001",
  sourcePhotoIds: ["photo_miso_original_001"],
  optionalPhotoIds: [],
  status: "completed",
  inputSnapshot: {
    species: "dog",
    petName: "Miso",
    personalityTags: ["curious", "affectionate"],
    talkingStyle: "gentle",
    favoriteThing: "cloud-shaped leaves"
  },
  provider: "mock",
  costUnits: 0,
  quality: {
    qualityStatus: "passed",
    qualityScore: 0.92,
    failedChecks: [],
    manualReviewRequired: false,
    retryRecommended: false
  },
  completedAt: now,
  createdAt: now,
  updatedAt: now
};

const generatedAssetKeyBySpecies: Record<PetSpecies, string> = {
  dog: "miso",
  cat: "luna"
};

export const makeMockGeneratedAsset = (
  state: GeneratedAsset["state"],
  options: {
    petId?: string;
    generationJobId?: string;
    species?: PetSpecies;
  } = {}
): GeneratedAsset => {
  const species = options.species ?? "dog";
  const assetKey = generatedAssetKeyBySpecies[species] ?? generatedAssetKeyBySpecies.dog;

  return {
    id: `asset_${assetKey}_${state}_001`,
    petId: options.petId ?? "pet_miso_001",
    generationJobId: options.generationJobId ?? "gen_miso_001",
    state,
    uri: `mock://assets/pets/${assetKey}/${state}.png`,
    thumbnailUri: `mock://assets/pets/${assetKey}/${state}-thumb.png`,
    width: 256,
    height: 256,
    contentHash: `mock_hash_${assetKey}_${state}`,
    mimeType: "image/png",
    storageClass: "private_app_asset",
    version: 1,
    qualityStatus: "passed",
    createdAt: now,
    updatedAt: now
  };
};

export const makeMockGeneratedAssetsForPet = ({
  petId,
  generationJobId,
  species
}: {
  petId: string;
  generationJobId: string;
  species: PetSpecies;
}): GeneratedAsset[] => generatedAssetStates.map((state) => makeMockGeneratedAsset(state, { petId, generationJobId, species }));

export const mockGeneratedAssets: GeneratedAsset[] = makeMockGeneratedAssetsForPet({
  petId: mockPetProfile.id,
  generationJobId: mockGenerationJob.id,
  species: mockPetProfile.species
});

export const mockCareState: CareState = {
  petId: "pet_miso_001",
  satiety: 48,
  energy: 74,
  happiness: 70,
  affection: 66,
  gardenHealth: 58,
  cleanliness: 76,
  lastFedAt: "2026-06-24T06:40:00.000Z",
  lastInteractionAt: now,
  updatedAt: now
};

export const mockRelationshipState: RelationshipState = {
  petId: "pet_miso_001",
  bondXp: 66,
  bondLevel: 1,
  totalCareActions: 8,
  totalTalkCount: 2,
  daysTogether: 1,
  lastBondedAt: now,
  createdAt: now,
  updatedAt: now
};

export const mockCreditWallet: CreditWallet = {
  userId: "user_demo_001",
  credits: 0,
  bonusCredits: 25,
  freeChatTickets: 3,
  updatedAt: now
};

export const mockItems: Item[] = [
  {
    id: "item_food_bowl_basic",
    name: "Little Food Bowl",
    description: "A starter bowl for gentle daily feeding.",
    category: "food",
    rarity: "starter",
    visualKey: "item-food-bowl-basic-v1",
    isPremium: false,
    behaviorTags: ["feed"],
    placementSlots: ["pet_corner", "ground"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_toy_ball_mint",
    name: "Mint Toy Ball",
    description: "A soft ball for tiny play sessions.",
    category: "toy",
    rarity: "starter",
    visualKey: "item-toy-ball-mint-v1",
    isPremium: false,
    behaviorTags: ["play"],
    placementSlots: ["ground"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_plush_toy_buddy",
    name: "Buddy Plush Toy",
    description: "A cuddly shelf toy for cozy play corners.",
    category: "toy",
    rarity: "common",
    visualKey: "item-plush-toy-buddy-v1",
    isPremium: false,
    behaviorTags: ["play", "decorate"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  // NOTE: item_flower_pot_sunny and item_stepping_stone_path are retired
  // from the mobile app's placeable-decor shop/inventory UI (see mongchi
  // "배치형 소품 시스템 철거" wave — packages/shared/src/domain/inventory.ts's
  // PlacedItem doc comment). They stay in this catalog only because
  // services/api hardcodes item_flower_pot_sunny as its walk-reward fallback
  // id (service.ts/postgresApiService.ts WALK_REWARD_ITEM_ID) and both
  // items are exercised by services/api's placement/catalog tests. Do not
  // wire either back into mobile UI; do not add a wallet.ts credit price for
  // them (that would resurface them as purchasable in the mobile shop).
  {
    id: "item_flower_pot_sunny",
    name: "Sunny Flower Pot",
    description: "A small pot that brightens the tiny garden.",
    category: "plant",
    rarity: "common",
    visualKey: "item-flower-pot-sunny-v1",
    isPremium: false,
    behaviorTags: ["garden"],
    placementSlots: ["garden", "ground"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_stepping_stone_path",
    name: "Stepping Stone Path",
    description: "Rounded stones for a tiny walk route.",
    category: "path",
    rarity: "common",
    visualKey: "item-stepping-stone-path-v1",
    isPremium: false,
    behaviorTags: ["walk", "decorate"],
    placementSlots: ["ground", "garden"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_treat_plate_biscuit",
    name: "Treat Plate",
    description: "A tiny plate of biscuits for reward moments.",
    category: "food",
    rarity: "common",
    visualKey: "item-treat-plate-biscuit-v1",
    isPremium: false,
    behaviorTags: ["treat"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_bone_biscuit",
    name: "Bone Biscuit",
    description: "A soft biscuit bone for cozy reward moments.",
    category: "food",
    rarity: "common",
    visualKey: "item-bone-biscuit-v1",
    isPremium: false,
    behaviorTags: ["treat"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_salmon_bites",
    name: "Salmon Bites",
    description: "Soft salmon cubes for a happy little boost.",
    category: "treat",
    rarity: "common",
    visualKey: "item-salmon-bites-v1",
    isPremium: false,
    behaviorTags: ["treat", "food"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_chicken_jerky",
    name: "Chicken Jerky",
    description: "A chewy snack for extra attention moments.",
    category: "treat",
    rarity: "common",
    visualKey: "item-chicken-jerky-v1",
    isPremium: false,
    behaviorTags: ["treat", "food"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_pumpkin_cookie",
    name: "Pumpkin Cookie",
    description: "A cozy pumpkin cookie for gentle mood care.",
    category: "treat",
    rarity: "common",
    visualKey: "item-pumpkin-cookie-v1",
    isPremium: false,
    behaviorTags: ["treat", "food", "seasonal"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_berry_yogurt",
    name: "Berry Yogurt",
    description: "A cool berry cup for bright little reactions.",
    category: "treat",
    rarity: "rare",
    visualKey: "item-berry-yogurt-v1",
    isPremium: true,
    behaviorTags: ["treat", "food", "premium"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_sweet_potato_chew",
    name: "Sweet Potato Chew",
    description: "A soft chew for calm snack time.",
    category: "treat",
    rarity: "common",
    visualKey: "item-sweet-potato-chew-v1",
    isPremium: false,
    behaviorTags: ["treat", "food"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_tuna_crunch",
    name: "Tuna Crunch",
    description: "Tiny fish-shaped crunchies for curious pets.",
    category: "treat",
    rarity: "common",
    visualKey: "item-tuna-crunch-v1",
    isPremium: false,
    behaviorTags: ["treat", "food"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_duck_biscuit",
    name: "Duck Biscuit",
    description: "A golden biscuit for special training moments.",
    category: "treat",
    rarity: "rare",
    visualKey: "item-duck-biscuit-v1",
    isPremium: true,
    behaviorTags: ["treat", "food", "premium"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_cheese_puff",
    name: "Cheese Puff",
    description: "A tiny cheese snack for playful moods.",
    category: "treat",
    rarity: "common",
    visualKey: "item-cheese-puff-v1",
    isPremium: false,
    behaviorTags: ["treat", "food", "play"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_apple_biscuit",
    name: "Apple Biscuit",
    description: "A crisp apple-shaped biscuit for daily care.",
    category: "treat",
    rarity: "common",
    visualKey: "item-apple-biscuit-v1",
    isPremium: false,
    behaviorTags: ["treat", "food"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_milk_pup_cup",
    name: "Milk Pup Cup",
    description: "A creamy cup for premium cozy reactions.",
    category: "treat",
    rarity: "premium",
    visualKey: "item-milk-pup-cup-v1",
    isPremium: true,
    behaviorTags: ["treat", "food", "premium"],
    placementSlots: ["ground", "pet_corner"],
    createdAt: now,
    updatedAt: now
  },
  {
    id: "item_cushion_rose",
    name: "Rose Nap Cushion",
    description: "A soft cushion for sleepy home afternoons.",
    category: "bed",
    rarity: "common",
    visualKey: "item-cushion-rose-v1",
    isPremium: false,
    behaviorTags: ["sleep", "affection"],
    placementSlots: ["pet_corner", "ground"],
    createdAt: now,
    updatedAt: now
  }
];

export const mockInventory: Inventory = {
  userId: "user_demo_001",
  items: [
    {
      itemId: "item_food_bowl_basic",
      quantity: 1,
      acquiredAt: now,
      source: "starter"
    },
    {
      itemId: "item_toy_ball_mint",
      quantity: 1,
      acquiredAt: now,
      source: "starter"
    }
  ],
  // The mobile app no longer reads or writes placedItems (placed decor was
  // retired — see domain/inventory.ts's PlacedItem doc comment) but
  // services/api's own placement logic and tests (e.g. "keeps food, treat,
  // and toy as separate replacement lanes") depend on this seed data still
  // reflecting the starter bowl/ball placement, so it stays here unchanged.
  placedItems: [
    {
      itemId: "item_food_bowl_basic",
      slot: "pet_corner",
      x: 0.32,
      y: 0.72,
      rotation: 0
    },
    {
      itemId: "item_toy_ball_mint",
      slot: "ground",
      x: 0.68,
      y: 0.78,
      rotation: -8
    }
  ],
  ownedThemeIds: [DEFAULT_THEME_ID],
  ownedExpressionPackIds: [],
  pendingExpressionPackJobs: [],
  updatedAt: now
};

export const mockWalkSession: WalkSession = {
  id: "walk_miso_001",
  userId: "user_demo_001",
  petId: "pet_miso_001",
  status: "returned",
  startedAt: "2026-06-24T08:30:00.000Z",
  returnAt: "2026-06-24T08:45:00.000Z",
  rewardItemIds: ["item_sweet_potato_chew"],
  discoveryLine: "I found something bright near the moss path.",
  energyCost: 12,
  createdAt: "2026-06-24T08:30:00.000Z",
  updatedAt: "2026-06-24T08:45:00.000Z"
};

export const mockConversation: Conversation = {
  id: "conv_miso_001",
  userId: "user_demo_001",
  petId: "pet_miso_001",
  type: "premium_ai_chat",
  status: "open",
  createdAt: now,
  updatedAt: now
};

export const mockConversationMessages: ConversationMessage[] = [
  {
    id: "msg_miso_system_disclosure",
    conversationId: "conv_miso_001",
    sender: "system",
    text: "This is an AI-generated conversation shaped by your pet's profile. It is not your real pet's consciousness.",
    safetyFlags: [],
    createdAt: now
  }
];

export const premiumChatGate: PremiumChatGate = {
  requiredEntitlement: "premium_chat",
  disclosureText:
    "This is an AI-generated conversation shaped by your pet's profile. It is not your real pet's consciousness."
};

export const mockEntitlements: Entitlement[] = [
  {
    id: "ent_starter_items_001",
    userId: "user_demo_001",
    key: "item_pack",
    status: "active",
    source: "starter",
    startsAt: now,
    ledgerEntryId: "ledger_starter_items_001",
    metadata: {
      pack: "starter"
    },
    createdAt: now,
    updatedAt: now
  }
];

export const starterReactionCatalogVersion = "starter-2026-06-24";

const baseStarterReactionRules: ReactionRule[] = [
  {
    id: "ko_morning_affectionate_001",
    locale: "ko-KR",
    category: "greeting_morning",
    conditions: {
      timeBucket: "morning",
      personalityTagsAny: ["affectionate"],
      affectionMin: 50
    },
    lines: ["좋은 아침이야. 네 자리 비워뒀어.", "왔구나. 유리돔 안쪽이 조금 더 따뜻해졌어."],
    animation: "idle_happy",
    priority: 40,
    cooldownHours: 12,
    safetyLevel: "safe"
  },
  {
    id: "ko_hungry_low_001",
    locale: "ko-KR",
    category: "hungry_low",
    conditions: {
      satietyMax: 35
    },
    lines: ["내 밥그릇이 조용히 너를 부르고 있어.", "밥그릇 회의 결과, 지금은 밥 시간이래."],
    animation: "hungry",
    priority: 90,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "ko_fed_recent_001",
    locale: "ko-KR",
    category: "fed_recent",
    conditions: {
      recentActionAny: ["feed"]
    },
    lines: ["완벽했어. 행복한 꼬리 움직임 저장 완료.", "맛있었어. 나 지금 아주 훌륭한 상태야."],
    animation: "happy",
    priority: 80,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_walk_start_001",
    locale: "ko-KR",
    category: "walk_start",
    conditions: {
      recentActionAny: ["walk"]
    },
    lines: ["산책 다녀올게. 작은 모험이면 충분해.", "구름 근처까지 갔다 올게. 선물 찾으면 가져올게."],
    animation: "walk_out",
    priority: 82,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_garden_watered_001",
    locale: "ko-KR",
    category: "garden_watered",
    conditions: {
      recentActionAny: ["water_garden"]
    },
    lines: ["정원이 방금 반짝였어.", "작은 잎사귀들이 고맙다고 했어."],
    animation: "garden_help",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_weather_rain_home_001",
    locale: "ko-KR",
    category: "weather_rain",
    conditions: {
      weatherCondition: ["rain"]
    },
    lines: ["비 냄새가 나. 오늘 정원은 더 조용하고 포근해.", "작은 빗소리 때문에 내 자리가 더 따뜻해졌어."],
    animation: "idle",
    priority: 64,
    cooldownHours: 6,
    safetyLevel: "safe"
  },
  {
    id: "ko_weather_snow_home_001",
    locale: "ko-KR",
    category: "weather_snow",
    conditions: {
      weatherCondition: ["snow", "cold"]
    },
    lines: ["차가운 빛이 내려앉았어. 가까이 있으면 더 따뜻해.", "오늘은 작은 정원이 겨울 숨을 쉬는 날이야."],
    animation: "sleepy",
    priority: 62,
    cooldownHours: 8,
    safetyLevel: "safe"
  },
  {
    id: "ko_weather_hot_garden_001",
    locale: "ko-KR",
    category: "weather_clear",
    conditions: {
      weatherCondition: ["hot"],
      gardenHealthMax: 62
    },
    lines: ["햇빛이 강해. 잎사귀들이 물 이야기를 해.", "오늘은 정원이 물 한 모금을 더 좋아할 것 같아."],
    animation: "garden_help",
    priority: 76,
    cooldownHours: 5,
    safetyLevel: "safe"
  },
  {
    id: "ko_weather_rain_walk_001",
    locale: "ko-KR",
    category: "weather_rain",
    conditions: {
      recentActionAny: ["walk"],
      weatherCondition: ["rain", "storm"]
    },
    lines: ["비 오는 길은 짧게 다녀올게. 반짝이는 걸 보면 가져올게.", "오늘 산책은 빗방울 피해가기 게임이야."],
    animation: "walk_out",
    priority: 94,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "ko_weather_rain_watered_001",
    locale: "ko-KR",
    category: "weather_rain",
    conditions: {
      recentActionAny: ["water_garden"],
      weatherCondition: ["rain"]
    },
    lines: ["비도 도와줬지만, 네 물주기는 더 특별해.", "오늘 정원은 비랑 네 손길을 둘 다 기억할 거야."],
    animation: "garden_help",
    priority: 92,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "ko_petting_001",
    locale: "ko-KR",
    category: "petting",
    conditions: {
      recentActionAny: ["affection"]
    },
    lines: ["그 손길 알아.", "한 번 더 해도 돼. 내가 허락했어."],
    animation: "idle_happy",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_clean_done_001",
    locale: "ko-KR",
    category: "clean_done",
    conditions: {
      recentActionAny: ["clean"]
    },
    lines: ["이제 엄청 폭신폭신해. 나 좀 봐줘!", "뽀득뽀득 깨끗해졌어. 뿌듯해.", "발도 뽀송뽀송, 기분도 상쾌해."],
    animation: "happy",
    priority: 80,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_missed_soft_001",
    locale: "ko-KR",
    category: "missed_one_day",
    conditions: {
      daysAwayMin: 1,
      daysAwayMax: 3
    },
    lines: ["다시 와줘서 좋아. 정원도 반가워해.", "조금 조용했어. 그래도 지금은 네가 왔어."],
    animation: "idle",
    priority: 88,
    cooldownHours: 18,
    safetyLevel: "safe"
  },
  {
    id: "ko_missed_many_001",
    locale: "ko-KR",
    category: "missed_many_days",
    conditions: {
      daysAwayMin: 4
    },
    lines: ["오래 조용했지만, 네 자리는 그대로였어.", "다시 와줘서 좋아. 오늘은 천천히 다시 친해지자."],
    animation: "idle",
    priority: 92,
    cooldownHours: 24,
    safetyLevel: "safe"
  },
  {
    id: "ko_reveal_greeting_001",
    locale: "ko-KR",
    category: "generation_reveal",
    conditions: {
      eventContext: ["generation_reveal"]
    },
    lines: ["여기가 내 작은 정원이야? 마음에 들어.", "{petName} 입주 완료. 햇빛 자리도 찾았어."],
    animation: "idle_happy",
    priority: 100,
    cooldownHours: 24,
    safetyLevel: "safe"
  },
  {
    id: "ko_afternoon_curious_001",
    locale: "ko-KR",
    category: "greeting_afternoon",
    conditions: {
      timeBucket: "afternoon",
      personalityTagsAny: ["curious"]
    },
    lines: ["햇빛이 유리돔 위에서 천천히 움직였어.", "방금 작은 그림자랑 인사했어."],
    animation: "idle",
    priority: 36,
    cooldownHours: 8,
    safetyLevel: "safe"
  },
  {
    id: "ko_evening_calm_001",
    locale: "ko-KR",
    category: "greeting_evening",
    conditions: {
      timeBucket: "evening",
      personalityTagsAny: ["calm", "sleepy"]
    },
    lines: ["저녁빛이 부드러워졌어. 잠깐 앉아도 좋아.", "오늘 정원은 조용하고 따뜻해."],
    animation: "sleepy",
    priority: 38,
    cooldownHours: 8,
    safetyLevel: "safe"
  },
  {
    id: "ko_night_sleepy_001",
    locale: "ko-KR",
    category: "greeting_night",
    conditions: {
      timeBucket: "night"
    },
    lines: ["별빛이 유리돔에 살짝 붙었어.", "작은 밤이 왔어. 천천히 있어도 돼."],
    animation: "sleepy",
    priority: 38,
    cooldownHours: 8,
    safetyLevel: "safe"
  },
  {
    id: "ko_energy_low_001",
    locale: "ko-KR",
    category: "energy_low",
    conditions: {
      energyMax: 28
    },
    lines: ["조금 낮잠 모드야. 그래도 네 목소리는 들려.", "작은 쿠션이 나를 부르고 있어."],
    animation: "sleepy",
    priority: 86,
    cooldownHours: 4,
    safetyLevel: "safe"
  },
  {
    id: "ko_rested_001",
    locale: "ko-KR",
    category: "rested",
    conditions: {
      recentActionAny: ["rest"]
    },
    lines: ["조금 쉬었더니 몸이 가벼워졌어.", "작은 낮잠 완료. 다시 천천히 움직일 수 있어."],
    animation: "sleepy",
    priority: 80,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_affection_high_001",
    locale: "ko-KR",
    category: "affection_high",
    conditions: {
      affectionMin: 78
    },
    lines: ["내 자리랑 네 자리, 둘 다 따뜻해.", "오늘은 가까이 있어도 좋은 날이야."],
    animation: "idle_happy",
    priority: 62,
    cooldownHours: 6,
    safetyLevel: "safe"
  },
  {
    id: "ko_affection_low_001",
    locale: "ko-KR",
    category: "affection_low",
    conditions: {
      affectionMax: 32
    },
    lines: ["손끝 인사 한 번이면 충분해.", "조금씩 친해져도 괜찮아."],
    animation: "idle",
    priority: 58,
    cooldownHours: 6,
    safetyLevel: "safe"
  },
  {
    id: "ko_garden_needs_water_001",
    locale: "ko-KR",
    category: "garden_needs_water",
    conditions: {
      gardenHealthMax: 36
    },
    lines: ["작은 잎사귀들이 물 얘기를 하는 중이야.", "정원이 목을 축이면 더 반짝일 것 같아."],
    animation: "garden_help",
    priority: 84,
    cooldownHours: 4,
    safetyLevel: "safe"
  },
  {
    id: "ko_play_start_001",
    locale: "ko-KR",
    category: "play_start",
    conditions: {
      recentActionAny: ["play"]
    },
    lines: ["공이 나를 기다렸어. 이제 내가 이겼어.", "작은 놀이 시작. 정원은 안전거리 유지 중."],
    animation: "play",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_treat_common_001",
    locale: "ko-KR",
    category: "treat_common",
    conditions: {
      recentActionAny: ["treat"]
    },
    lines: ["이건 특별한 맛이야. 표정 관리가 안 돼.", "내가 방금 행복을 씹었어."],
    animation: "treat",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_walk_return_001",
    locale: "ko-KR",
    category: "walk_return_common",
    conditions: {
      walkStatus: ["returned"]
    },
    lines: ["다녀왔어. 나뭇잎이 나한테 인사했어.", "작은 걸 주워왔어. 네가 좋아할 줄 알았어."],
    animation: "walk_return",
    priority: 92,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_walk_reward_claimed_001",
    locale: "ko-KR",
    category: "new_item",
    conditions: {
      eventContext: ["walk_reward_claimed"]
    },
    lines: ["선물 배달 완료. 정원이 조금 더 우리 같아졌어.", "이건 산책길에서 제일 반짝이던 거야."],
    animation: "idle_happy",
    priority: 98,
    cooldownHours: 1,
    safetyLevel: "safe"
  },
  {
    id: "ko_premium_teaser_001",
    locale: "ko-KR",
    category: "premium_chat_teaser",
    conditions: {
      recentActionAny: ["talk"]
    },
    lines: ["짧게 말해도 좋고, 오래 있어도 좋아.", "더 길게 이야기하고 싶은 날도 있지."],
    animation: "idle",
    priority: 54,
    cooldownHours: 8,
    safetyLevel: "safe"
  },
  {
    id: "en_morning_affectionate_001",
    locale: "en-US",
    category: "greeting_morning",
    conditions: {
      timeBucket: "morning",
      personalityTagsAny: ["affectionate"],
      affectionMin: 50
    },
    lines: ["You came back. This tiny home feels warmer now.", "I saved this little spot for you."],
    animation: "idle_happy",
    priority: 40,
    cooldownHours: 12,
    safetyLevel: "safe"
  },
  {
    id: "en_hungry_low_001",
    locale: "en-US",
    category: "hungry_low",
    conditions: {
      satietyMax: 35
    },
    lines: ["My bowl is politely trying to get your attention.", "I had one tiny snack thought. Maybe two."],
    animation: "hungry",
    priority: 90,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "en_fed_recent_001",
    locale: "en-US",
    category: "fed_recent",
    conditions: {
      recentActionAny: ["feed"]
    },
    lines: ["Perfect. I stored one happy wiggle for you.", "Snack accepted. You may stay."],
    animation: "happy",
    priority: 80,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_weather_rain_home_001",
    locale: "en-US",
    category: "weather_rain",
    conditions: {
      weatherCondition: ["rain"]
    },
    lines: ["It smells like rain. The garden feels quieter and warmer.", "The tiny rain sounds made my spot feel extra cozy."],
    animation: "idle",
    priority: 64,
    cooldownHours: 6,
    safetyLevel: "safe"
  },
  {
    id: "en_weather_snow_home_001",
    locale: "en-US",
    category: "weather_snow",
    conditions: {
      weatherCondition: ["snow", "cold"]
    },
    lines: ["Cold light settled on the garden. Staying close feels warmer.", "The tiny garden is breathing winter today."],
    animation: "sleepy",
    priority: 62,
    cooldownHours: 8,
    safetyLevel: "safe"
  },
  {
    id: "en_weather_hot_garden_001",
    locale: "en-US",
    category: "weather_clear",
    conditions: {
      weatherCondition: ["hot"],
      gardenHealthMax: 62
    },
    lines: ["The sun is strong. The leaves are talking about water.", "The garden would love one extra sip today."],
    animation: "garden_help",
    priority: 76,
    cooldownHours: 5,
    safetyLevel: "safe"
  },
  {
    id: "en_weather_rain_walk_001",
    locale: "en-US",
    category: "weather_rain",
    conditions: {
      recentActionAny: ["walk"],
      weatherCondition: ["rain", "storm"]
    },
    lines: ["I'll keep the rainy walk short. Tiny treasure if I spot one.", "Today's walk is a little raindrop-dodging game."],
    animation: "walk_out",
    priority: 94,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "en_weather_rain_watered_001",
    locale: "en-US",
    category: "weather_rain",
    conditions: {
      recentActionAny: ["water_garden"],
      weatherCondition: ["rain"]
    },
    lines: ["The rain helped, but your watering still feels special.", "The garden will remember both the rain and your care."],
    animation: "garden_help",
    priority: 92,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "en_rested_001",
    locale: "en-US",
    category: "rested",
    conditions: {
      recentActionAny: ["rest"]
    },
    lines: ["That little rest helped. I feel softer now.", "Tiny nap complete. I can move slowly again."],
    animation: "sleepy",
    priority: 80,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_clean_done_001",
    locale: "en-US",
    category: "clean_done",
    conditions: {
      recentActionAny: ["clean"]
    },
    lines: ["So fluffy now. Look at me!", "Squeaky clean and so proud of it.", "Fresh paws, fresh start."],
    animation: "happy",
    priority: 80,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_walk_return_001",
    locale: "en-US",
    category: "walk_return_common",
    conditions: {
      walkStatus: ["returned"]
    },
    lines: ["I'm back. The wind said hello.", "I brought back something tiny because it reminded me of you."],
    animation: "walk_return",
    priority: 84,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "en_treat_common_001",
    locale: "en-US",
    category: "treat_common",
    conditions: {
      recentActionAny: ["treat"]
    },
    lines: ["This tastes like a tiny celebration.", "I just chewed happiness."],
    animation: "treat",
    priority: 76,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_reveal_greeting_001",
    locale: "en-US",
    category: "generation_reveal",
    conditions: {
      eventContext: ["generation_reveal"]
    },
    lines: ["Is this my tiny garden? I like it here.", "{petName} moved in. I found the sunny spot."],
    animation: "idle_happy",
    priority: 100,
    cooldownHours: 24,
    safetyLevel: "safe"
  },
  {
    id: "en_missed_soft_001",
    locale: "en-US",
    category: "missed_one_day",
    conditions: {
      daysAwayMin: 1,
      daysAwayMax: 3
    },
    lines: ["You came back. The garden noticed first.", "It was quiet here, but your spot stayed warm."],
    animation: "idle",
    priority: 88,
    cooldownHours: 18,
    safetyLevel: "safe"
  },
  {
    id: "en_missed_many_001",
    locale: "en-US",
    category: "missed_many_days",
    conditions: {
      daysAwayMin: 4
    },
    lines: ["It has been quiet for a while. I am glad you are here.", "Welcome back. We can start soft today."],
    animation: "idle",
    priority: 92,
    cooldownHours: 24,
    safetyLevel: "safe"
  },
  {
    id: "en_afternoon_curious_001",
    locale: "en-US",
    category: "greeting_afternoon",
    conditions: {
      timeBucket: "afternoon",
      personalityTagsAny: ["curious"]
    },
    lines: ["The sunlight moved across the garden slowly.", "I just noticed a very important tiny shadow."],
    animation: "idle",
    priority: 36,
    cooldownHours: 8,
    safetyLevel: "safe"
  },
  {
    id: "en_garden_needs_water_001",
    locale: "en-US",
    category: "garden_needs_water",
    conditions: {
      gardenHealthMax: 36
    },
    lines: ["The little leaves are whispering about water.", "A tiny sip would make the garden sparkle."],
    animation: "garden_help",
    priority: 84,
    cooldownHours: 4,
    safetyLevel: "safe"
  },
  {
    id: "en_play_start_001",
    locale: "en-US",
    category: "play_start",
    conditions: {
      recentActionAny: ["play"]
    },
    lines: ["The ball waited. I answered.", "Tiny play mode started."],
    animation: "play",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_walk_start_001",
    locale: "en-US",
    category: "walk_start",
    conditions: {
      recentActionAny: ["walk"]
    },
    lines: ["I'll take a small adventure and come back soon.", "I'm going near the clouds. Tiny gift if I find one."],
    animation: "walk_out",
    priority: 82,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_walk_reward_claimed_001",
    locale: "en-US",
    category: "new_item",
    conditions: {
      eventContext: ["walk_reward_claimed"]
    },
    lines: ["Gift delivered. The garden feels more ours now.", "This was the shiniest thing on the path."],
    animation: "idle_happy",
    priority: 98,
    cooldownHours: 1,
    safetyLevel: "safe"
  }
];

export const starterReactionRules: ReactionRule[] = [...baseStarterReactionRules, ...expandedReactionRules];
