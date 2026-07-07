# Multi-Pet W1 — 정밀 구현 설계서 (도메인 번들화 + 마이그레이션 v7)

2026-07-07. 대상: `deep-reasoner` 분석 → 후속 구현 에이전트가 그대로 실행. 배경: `docs/multi-pet-slot-plan.md`(아키텍처 섹션), `docs/readiness-diagnosis.md`.

## 0. W1의 한 줄 정의

`PrototypeSessionState`의 per-pet 필드 12종을 `pets: Record<PetId, PetBundle>` + `activePetId`로 이관하되, **겉(UI·공개 순수함수 시그니처)은 완전 동일**. 멀티펫 표면은 W4. 이번엔 "속을 번들로, 겉은 그대로".

**핵심 불변식(전 웨이브 검증 대상):**
- INV-1: `Object.keys(state.pets).length === 1` (W1 종료 시점, 항상 단일 펫).
- INV-2: `state.activePetId`는 항상 `state.pets`의 유효 키.
- INV-3: 첫 펫 id는 `pet_local_001` 유지 (하드코딩 리프트, API/산책/이슈리포트 호환).
- INV-4: 프로바이더가 노출하는 컨텍스트 값의 키 집합은 W1 전후로 **바이트 단위 동일**.

핵심 근거 파일:
- `/Users/kohyun/Desktop/AppProject/mongchi/packages/shared/src/session/prototypeSession.ts` (1860줄, 순수함수 전량)
- `/Users/kohyun/Desktop/AppProject/mongchi/packages/shared/src/session/sessionMigrations.ts` (442줄, 마이그레이션 체인)
- `/Users/kohyun/Desktop/AppProject/mongchi/apps/mobile/src/features/session/TerrariumSessionProvider.tsx` (1918줄, UI 호환 레이어)

---

## 1. PetBundle 최종 타입 정의

### 1.1 분류 결정표 (각 필드 + 코드 근거)

현재 `PrototypeSessionState` 필드는 `prototypeSession.ts:138-167`에 정의됨. 아래로 재배치한다.

| 현재 필드 | 배치 | 근거 (라인) |
|---|---|---|
| `petProfile: PetProfile \| null` | **per-pet** | `prototypeSession.ts:142`. 펫 정체성 자체. |
| `acceptedAsset: GeneratedAsset \| null` | **per-pet** (파생 셀렉터로 강등, 아래 1.4) | `:143`. 펫별 스프라이트. |
| `acceptedAssets: GeneratedAsset[]` | **per-pet** | `:144`. 펫별 표정 시트. 두 번째 펫이 첫 펫을 덮는 최대 위험원(`:770,834`). |
| `careState: CareState` | **per-pet** | `:145`. `CareState.petId` 이미 존재(`domain/care.ts:16`). |
| `relationshipState: RelationshipState` | **per-pet** | `:146`. `RelationshipState.petId` 이미 존재(`domain/relationship.ts:5`). |
| `currentReaction: SelectedReaction \| null` | **per-pet** | `:151`. 펫의 말풍선. |
| `lastCareReward: CareActionReward \| null` | **per-pet** | `:152`. 마지막 케어 결과 배지. |
| `recentReactions: RecentReaction[]` | **per-pet** | `:153`. 펫별 최근 반응(중복 억제 슬라이스, `appendReaction` `:889-903`). |
| `activeWalk: WalkSession \| null` | **per-pet** | `:149`. `WalkSession.petId` 이미 존재(`domain/walk.ts:8`). |
| `lastWalkDiscovery: {...} \| null` | **per-pet** | `:162`. 방금 산책 발견 배너. |
| `generationIssueReport: GenerationIssueReport \| null` | **per-pet** | `:157`. `GenerationIssueReport.petId` 이미 존재(`:126`). |
| `memories: MemoryEntry[]` | **per-pet** | `:164`. `MemoryEntry`에는 아직 `petId` 없음(`domain/petMemories.ts:34`) → **번들 이동으로 스코프 획득**. petId 필드 부여는 W3+. |
| `careStats: CareStats` | **per-pet** | `:166`. 펫별 케어 습관 카운터(`bumpCareStats`). |
| — | | |
| `draft: PetSetupDraft` | **최상위(온보딩 임시)** | `:139`. 생성 흐름 입력. §4에서 `onboardingFlow`로 재편. |
| `photo: MockPhotoState` | **최상위(온보딩 임시)** | `:140`. 동상. |
| `generation: MockGenerationState` | **최상위(온보딩 임시)** | `:141`. 동상. §4. |
| `wallet: CreditWallet` | **공유** | `:147`. 가족 지갑. `applyPrototypeDailyTicketRefill`도 wallet만 만짐(`:372-391`). |
| `inventory: Inventory` | **공유** | `:148`. 가족 간식/테마/표정팩 소유권. |
| `weatherState: PrototypeWeatherState` | **공유** | `:150`. 한 정원의 날씨. |
| `firstRewardClaimedAt: string \| null` | **공유** | `:156`. 유저 단위 최초 보상 플래그. |
| `careStreak: CareStreakState` | **공유** (확정) | `:158`. **유저 습관**. 근거 아래 1.2. |
| `lastTicketRefillDayKey: string \| null` | **공유** | `:159`. 유저 단위 채팅 티켓 일일 리필. |
| `activeBuffs: ActiveCareBuff[]` | **공유** | `:160`. 동거 버프(W3+)의 자연스러운 그릇. W1은 현행 유지(단일 펫이므로 의미 동일). |
| `walkCollection: WalkCollectionState` | **공유** (확정) | `:161`. **가족 공동 도감**. 근거 아래 1.2. |
| `originalPhotoDeletedAt: string \| null` | **최상위(유저 프라이버시)** | `:154`. §2 주의: `deletePrototypeOriginalPhoto`는 `petProfile`도 만짐(`:1851`). |
| `chatHistoryDeletedAt: string \| null` | **최상위(유저 프라이버시)** | `:155`. |

> 참고: 프롬프트가 "공유 유지"로 언급한 `entitlements`는 `PrototypeSessionState`에 **존재하지 않는다**. 엔타이틀먼트는 프로바이더의 별도 상태(`apiEntitlements`, `TerrariumSessionProvider.tsx:485`)에서 온다. W1에서 건드릴 것 없음.

### 1.2 애매 항목 배치 확정 (근거 포함)

**walkCollection = 공유 (가족 공동 도감).**
- 근거: `claimPrototypeWalkReward`가 `state.walkCollection`을 `addToWalkCollection`으로 갱신(`prototypeSession.ts:1730-1732`), 완성 시 지갑에 크레딧 지급(`:1733-1735`). 도감은 "이 유저가 모은 발견들"의 성격이며 `WalkCollectionState`에 petId 없음(`domain/walkCollection.ts`). 발견자 뱃지(펫별)는 W4. **W1은 구조 이동 없음 — 이미 공유이므로 그대로 최상위 유지.**

**careStreak = 공유 (유저 습관).**
- 근거: `updateCareStreakOnCare`는 "하루에 한 번이라도 케어했는가"를 추적(`performPrototypeCareAction:1207`, `startPrototypeWalk:1293`). 어느 펫을 돌보든 오늘의 습관은 하나. 두 펫이 각자 스트릭을 가지면 "둘 다 매일 케어" 압박(노동 2배) → 기획 반대(`multi-pet-slot-plan.md:28`). 친구 페이지 "N days together" 카피 변경 승인은 `multi-pet-slot-plan.md:62`의 미결 항목이나 **W1은 데이터 배치만 확정(공유), 카피는 W5.** W1은 이미 공유이므로 그대로 최상위 유지.

**ownedExpressionPackIds = 이번엔 공유 유지 (per-pet 이전은 W3).**
- 근거: 현재 `inventory.ownedExpressionPackIds`에 저장(`confirmPrototypeExpressionPackPurchase:1641`), 즉 inventory(공유)의 일부. per-pet 이전은 "샀는데 에셋 없는 펫" 방지를 위한 것이며(`multi-pet-slot-plan.md:34`), 이는 **두 번째 펫이 실제로 존재해야 문제가 됨**. W1은 펫이 1마리뿐이라 공유/펫별 구분이 관측 불가능 → 지금 옮기면 순수 리스크(구매/폴 상태머신 `TerrariumSessionProvider.tsx:1340-1420` 재배선)만 발생하고 이득 0. **inventory에 공유 유지, per-pet 이전은 W3(슬롯 구매 + 두 번째 펫 온보딩)과 묶어 원자적으로.**

### 1.3 최종 타입 (신규 코드, `prototypeSession.ts` 상단에 추가)

```ts
import type { PetId } from "../domain"; // PetId = string (domain/common.ts:6)

/** 한 펫에 귀속되는 모든 상태. 최상위 공유 필드(wallet/inventory/weather/streak/collection/buffs)는 제외. */
export interface PetBundle {
  petProfile: PetProfile | null;
  acceptedAsset: GeneratedAsset | null;   // 파생 셀렉터로 강등 예정(1.4), W1은 필드 유지
  acceptedAssets: GeneratedAsset[];
  careState: CareState;
  relationshipState: RelationshipState;
  currentReaction: SelectedReaction | null;
  lastCareReward: CareActionReward | null;
  recentReactions: RecentReaction[];
  activeWalk: WalkSession | null;
  lastWalkDiscovery: { collectibleId: string; isNew: boolean; collectionCompleted: boolean } | null;
  generationIssueReport: GenerationIssueReport | null;
  memories: MemoryEntry[];
  careStats: CareStats;
}

export interface PrototypeSessionState {
  // ── 온보딩 임시(생성 흐름) — §4 ──
  draft: PetSetupDraft;
  photo: MockPhotoState;
  generation: MockGenerationState;
  // ── 펫 번들 ──
  pets: Record<PetId, PetBundle>;
  activePetId: PetId;
  // ── 공유 ──
  wallet: CreditWallet;
  inventory: Inventory;
  weatherState: PrototypeWeatherState;
  careStreak: CareStreakState;
  walkCollection: WalkCollectionState;
  activeBuffs: ActiveCareBuff[];
  lastTicketRefillDayKey: string | null;
  firstRewardClaimedAt: string | null;
  // ── 유저 프라이버시 플래그 ──
  originalPhotoDeletedAt: string | null;
  chatHistoryDeletedAt: string | null;
}
```

### 1.4 acceptedAsset 강등 방침 (W1 최소)

`acceptedAsset`(단수)은 `acceptedAssets[0]` 또는 idle 에셋의 파생값이다. W1에서는 **필드를 유지**하되(호환), 새 파생 셀렉터를 도입해 두고 실제 강등(필드 제거)은 W5로 미룬다. 이유: `TerrariumSessionProvider.tsx:658,1823`, `generatedAssetUriMap.ts:22-29` 등이 `acceptedAsset`을 직접 읽음 → W1에서 제거하면 UI 변경이 발생(무파괴 원칙 위반). W1 신규 셀렉터:

```ts
export const selectPrimaryAsset = (bundle: PetBundle): GeneratedAsset | null =>
  bundle.acceptedAsset
  ?? bundle.acceptedAssets.find((a) => a.state === "idle")
  ?? bundle.acceptedAssets[0]
  ?? null;
```

`acceptedAsset` 필드는 계속 기록/보존하고, 이 셀렉터는 미래 콜사이트를 위해 export만 해둔다(W1 동작 무변경).

---

## 2. 렌즈 헬퍼 API

### 2.1 시그니처 (신규, `prototypeSession.ts`)

```ts
export const getActivePetBundle = (state: PrototypeSessionState): PetBundle =>
  state.pets[state.activePetId];   // INV-2에 의해 항상 정의됨. 방어는 §8 함정 3 참조.

export const getPetBundle = (state: PrototypeSessionState, petId: PetId): PetBundle | undefined =>
  state.pets[petId];

/**
 * 액티브 펫 번들을 fn으로 변환해 되쓴 새 state를 반환. 불변 갱신의 유일 통로.
 * fn은 (bundle) => Partial<PetBundle> 를 반환(패치 병합) — 전체 번들 반환보다
 * 콜사이트가 간결하고, "건드린 필드만 바꾼다"가 명시적이라 실수 방지.
 */
export const withActivePetBundle = (
  state: PrototypeSessionState,
  fn: (bundle: PetBundle) => Partial<PetBundle>
): PrototypeSessionState => {
  const current = state.pets[state.activePetId];
  const patch = fn(current);
  return {
    ...state,
    pets: {
      ...state.pets,
      [state.activePetId]: { ...current, ...patch }
    }
  };
};
```

설계 선택 근거: 순수함수들이 `{ ...state, careState, relationshipState, memories, ... }`처럼 **여러 per-pet 필드를 한 번에** 갱신한다(`performPrototypeCareAction:1223-1237`). `fn`이 `Partial<PetBundle>`을 반환하게 하면 한 번의 `withActivePetBundle` 호출로 다중 필드 패치가 자연스럽게 담긴다. 반면 공유 필드(wallet/inventory/streak 등)를 함께 바꿔야 하는 함수는 최상위 스프레드와 `withActivePetBundle`을 조합한다(아래 2.3 패턴 B).

### 2.2 `getActivePrototypePet` 유지 (외부 시그니처 불변)

`getActivePrototypePet(state, now)`는 **외부에서 유일하게 참조되는 seam**이다(mobile 콜러: `TerrariumSessionProvider.tsx:22,656,1348,1415` — 전부 `state`를 넘김). 내부만 번들 경유로 바꾸고 시그니처는 유지:

```ts
export const getActivePrototypePet = (state: PrototypeSessionState, now: string = FALLBACK_NOW): PetProfile =>
  getActivePetBundle(state).petProfile ?? buildPrototypePetProfile(state.draft, now);
```

이렇게 하면 프로바이더/mobile 코드 무변경.

### 2.3 순수함수 전수 전환 방침

각 함수는 두 패턴 중 하나:
- **패턴 A (per-pet 전용)**: 전부 `withActivePetBundle`로 감싼다.
- **패턴 B (per-pet + 공유 혼합)**: 최상위 스프레드로 공유 필드를, `withActivePetBundle` 병합으로 per-pet 필드를 각각 갱신.

| 함수 (라인) | 현재 갱신 필드 | 패턴 | 전환 방침 |
|---|---|---|---|
| `createInitialPrototypeSession` (`:318-366`) | 전부 | — | **재작성**: `pets: { [FIRST_PET_ID]: createInitialPetBundle(now) }`, `activePetId: FIRST_PET_ID`, 공유 필드는 그대로. `FIRST_PET_ID = "pet_local_001"`(INV-3). 신규 `createInitialPetBundle(now)` 헬퍼가 mockCareState/mockRelationshipState 시드(`:332-341`)를 담당. |
| `getActivePrototypePet` (`:529`) | 읽기 | — | 2.2대로. |
| `acceptPrototypeGeneratedPet` (`:917-969`) | petProfile, acceptedAsset(s), careState, relationshipState, memories, currentReaction, recentReactions | B (per-pet만) | 본문 로직 그대로 두고 마지막 반환을 `withActivePetBundle(state, () => ({...}))`로 감싼다. `state.petProfile`→`getActivePetBundle(state).petProfile`, `state.recentReactions`→bundle. **주의**: 이 함수가 §4 커밋 지점 — `state.draft`/`state.generation`(온보딩)에서 읽어 활성 번들에 씀. |
| `performPrototypeCareAction` (`:1112-1239`) | careState, relationshipState, wallet, inventory, lastCareReward, careStreak, activeBuffs, careStats, memories, currentReaction, recentReactions | B | 함수 내 `state.careState/relationshipState/careStats/memories/recentReactions`(per-pet) 읽기를 `const bundle = getActivePetBundle(state)`로 치환. wallet/inventory/careStreak/activeBuffs(공유)는 `state.` 그대로. 반환: 공유 필드는 최상위, per-pet 필드는 `pets` 갱신. `applyPrototypeDailyTicketRefill` 래핑은 최상위 wallet만 만지므로 유지. **`getActivePrototypePet(state,now)` 호출(`:1133`)은 시그니처 유지되어 무변경.** |
| `startPrototypeWalk` (`:1241-1316`) | activeWalk, careState, relationshipState, wallet, inventory, careStreak, careStats, memories, currentReaction, recentReactions | B | 동일 패턴. `pet.id`(`:1256`), `pet.userId`(`:1255`)는 `getActivePrototypePet` 경유(무변경). |
| `refreshPrototypeWalk` (`:1318-1359`) | activeWalk, careState, memories, currentReaction, recentReactions | A | 전부 per-pet. `state.activeWalk`→bundle. |
| `completePrototypeWalkEarly` (`:1362-1381`) | activeWalk(중간), refreshPrototypeWalk 위임 | A | `state.activeWalk`(`:1366,1373`)→bundle. 내부적으로 activeWalk만 패치 후 refreshPrototypeWalk 재호출 → **번들 안의 activeWalk를 패치**해야 함(§8 함정 2). |
| `completePrototypeWalkEarlyWithCredit` (`:1393-1412`) | wallet(공유), activeWalk 판정 | B | `state.activeWalk`(`:1398`)→`getActivePetBundle(state).activeWalk`. wallet 스펜드는 공유 최상위. |
| `claimPrototypeWalkReward` (`:1706-1817`) | activeWalk, careState, inventory(공유), wallet(공유), walkCollection(공유), lastWalkDiscovery, lastCareReward, memories, currentReaction, recentReactions | B | per-pet(activeWalk/careState/lastWalkDiscovery/lastCareReward/memories/reactions)는 번들, inventory/wallet/walkCollection은 공유 최상위. `clearCareWalkId`(`:1696`)는 careState 순수변환이라 무변경. |
| `applyBondLevelRewards` (`:971-1030`) | wallet/inventory/memories 반환(호출부가 배치) | — | **호출부(`performPrototypeCareAction:1201`, `startPrototypeWalk:1287`)에서** wallet/inventory(공유)와 memories(per-pet)를 분리 배치. 함수 자체는 인자로 값을 받으므로 시그니처 무변경. |
| `applyCareStreakSnackReward` (`:1043-1110`) | inventory/memories 반환 | — | 동일 — 인자 기반, 시그니처 무변경. 호출부에서 inventory(공유)/memories(per-pet) 분리. |
| `recordDaysTogetherMilestoneIfCrossed` (`:292-316`) | memories 반환 | — | 인자 기반. 호출부에서 `pet.createdAt`(무변경) + bundle.memories 전달. |
| `reportPrototypeGenerationIssue` (`:1819-1835`) | generationIssueReport | A | `withActivePetBundle`. `getActivePrototypePet` 경유 pet.id 무변경. |
| `deletePrototypeOriginalPhoto` (`:1837-1852`) | originalPhotoDeletedAt(공유), photo(온보딩), petProfile(per-pet!) | B | **주의**: `petProfile`(`:1851`)은 per-pet → `withActivePetBundle`로 petProfile 패치. originalPhotoDeletedAt/photo는 최상위. |
| `deletePrototypeChatHistory` (`:1854-1860`) | chatHistoryDeletedAt | — | 공유 최상위. 무변경(번들 안 만짐). |
| `mergePrototypeGeneratedAssets` (`:1673-1694`) | acceptedAssets, acceptedAsset | A | `state.acceptedAssets`(`:1681`)→bundle. `withActivePetBundle`. |
| `purchasePrototypeThemeBundle` (`:1478-1539`) | wallet(공유), inventory(공유), memories(per-pet), currentReaction/recentReactions(per-pet) | B | inventory/wallet 공유, memories/reactions 번들. `getActivePrototypePet`(`:1503`) 무변경. |
| `applyPrototypeTheme` (`:1552-1572`) | inventory(공유) | — | 공유만. 무변경(번들 안 만짐). |
| `purchasePrototypeInventoryItem` (`:1440-1462`) | wallet/inventory(공유) | — | 공유만. 무변경. |
| `confirmPrototypeExpressionPackPurchase` (`:1622-1662`) | wallet/inventory(공유), memories(per-pet) | B | inventory(ownedExpressionPackIds 여기 유지, 1.2)/wallet 공유, memories 번들. |
| `validatePrototypeExpressionPackPurchase` (`:1587-1606`) | 읽기(wallet/inventory 공유) | — | 무변경. |
| `applyPrototypeDailyTicketRefill` (`:372-391`) | wallet(공유) | — | 무변경. |
| `setPrototypeWeather*` (`:541-575`) | weatherState(공유) | — | 무변경. |
| `start/advance/fail/retry/pollPrototypeGeneration` (`:755-887`) | generation(온보딩) | — | §4 참조. `acceptedAsset(s)` 비우기(`:769-770,833-834`)를 **제거**하고 번들은 손대지 않음. |
| `normalizeRestoredGeneration` (`:661-685`) | generation + `state.acceptedAssets` 읽기(`:667`) | — | `state.acceptedAssets`→`getActivePetBundle(state).acceptedAssets`. generation은 온보딩(최상위) 유지. §4/§8 함정 5. |
| `getGenerationAttemptKey`/`getPrototypeGenerationPollSnapshot` (`:587-615`) | `getActivePrototypePet` 읽기 | — | 무변경(seam 유지). |
| 순수 셀렉터들(`canCreatePet`, `getGenerationProgress`, `assetStateFor*`, `selectGeneratedAssetForReaction` 등) | 무관 | — | 무변경. |

---

## 3. UI 무파괴 전략 (핵심)

### 3.1 원리

UI 컴포넌트는 세션을 오직 `useTerrariumSession()` 훅으로만 소비한다. 훅은 프로바이더가 만든 `value` 객체를 반환(`TerrariumSessionProvider.tsx:1908-1916`). 이 `value`는 현재 **`...state`로 모든 최상위 필드를 펼친다**(`:1840-1841`). UI(예: `TerrariumHomeScreen.tsx:650-679`)는 거기서 `careState, relationshipState, memories, careStats, acceptedAssets, acceptedAsset, activeWalk, currentReaction, recentReactions, lastWalkDiscovery, weatherState, careStreak, activeBuffs, ...`를 구조분해한다.

W1 이후 이 필드들이 `state.pets[activePetId]` 안으로 들어가면 `...state`만으로는 사라진다. **해결: 프로바이더에서 `...state` 뒤에 활성 번들을 다시 최상위로 펼친다.** 이것이 유일한 호환 레이어이며, UI는 한 줄도 안 바뀐다(INV-4).

### 3.2 정확한 지점과 방식

`TerrariumSessionProvider.tsx:656` (`const activePet = useMemo(...)`) 부근에 활성 번들 도출을 추가:

```ts
import { getActivePetBundle } from "@mongchi/shared"; // 임포트 추가(:22 근처)

const activeBundle = useMemo(() => getActivePetBundle(state), [state]);
```

그리고 `value` 조립부(`:1840`)를 다음처럼 수정 — **`...state` 다음에 `...activeBundle`을 펼쳐** per-pet 필드를 최상위로 복원:

```ts
const value: TerrariumSessionContextValue = {
  ...state,             // draft/photo/generation + 공유필드(wallet/inventory/weatherState/careStreak/walkCollection/activeBuffs/lastTicketRefillDayKey/firstRewardClaimedAt/originalPhotoDeletedAt/chatHistoryDeletedAt) + pets/activePetId
  ...activeBundle,      // ← per-pet 필드(careState/relationshipState/acceptedAsset(s)/memories/careStats/activeWalk/currentReaction/recentReactions/lastWalkDiscovery/lastCareReward/generationIssueReport/petProfile) 복원
  careState: projectedCareState,  // 기존 오버라이드(:1842) — activeBundle.careState를 시간투영값으로 덮어씀. 순서상 ...activeBundle 뒤에 와야 함.
  activePet,
  // ...(나머지 파생/액션 필드 기존 그대로)
};
```

핵심 순서 규칙:
1. `...state` → `...activeBundle` 순서 (per-pet가 `pets` 객체를 덮지 않음; `pets`/`activePetId`는 남되 UI가 안 읽으므로 무해).
2. `careState: projectedCareState`(`:1842`)는 반드시 `...activeBundle` **뒤**. 안 그러면 시간투영이 무효화됨(§8 함정 4).
3. `generatedAssetUriById` 계산(`:1822-1825`)은 `state.acceptedAsset`/`state.acceptedAssets`를 읽으므로 **`activeBundle.acceptedAsset`/`activeBundle.acceptedAssets`로 교체**:
   ```ts
   const generatedAssetUriById = useMemo(
     () => buildGeneratedAssetUriMap(generatedAssetReadUrls, activeBundle.acceptedAsset, activeBundle.acceptedAssets),
     [generatedAssetReadUrls, activeBundle.acceptedAsset, activeBundle.acceptedAssets]
   );
   ```
4. `activeGeneratedAssetId`/`generatedAssetIdsToResolve`(`:658-669`)도 `state.acceptedAsset`/`state.acceptedAssets` → `activeBundle.*`.
5. `projectedCareState`/`satisfactionSummary`(`:1827-1829`)의 `state.careState`/`state.activeBuffs`: careState는 `activeBundle.careState`로, activeBuffs는 공유이므로 `state.activeBuffs` 유지.
6. `bondProgress`(`:1851`) `getBondProgressValue(state.relationshipState)` → `activeBundle.relationshipState`.
7. `getGenerationAttemptKey(state)`/`getMonotonicGenerationProgress(state, ...)`(`:1831,1837`): state 인자 유지(내부에서 seam 경유).

### 3.3 API 패치 경로 호환 (`applyApiStatePatch`)

`applyApiStatePatch`(`:671-676`)는 `apiDailyLoopSession`이 반환한 `Partial<PrototypeSessionState>`를 `{ ...current, ...patch }`로 병합한다. 이 patch는 `careState`/`relationshipState`/`activeWalk`/`currentReaction`/`petProfile`을 **옛 최상위 키**로 담는다(`apiDailyLoopSession.ts:310-316,346-349,404-408`). W1에서 API 모드를 리팩터하지 않으므로, `applyApiStatePatch`가 이 옛-키 patch를 **활성 번들로 라우팅**하도록 어댑터를 둔다:

```ts
const PET_BUNDLE_PATCH_KEYS = ["petProfile","acceptedAsset","acceptedAssets","careState","relationshipState",
  "currentReaction","lastCareReward","recentReactions","activeWalk","lastWalkDiscovery",
  "generationIssueReport","memories","careStats"] as const;

const applyApiStatePatch = useCallback((patch: Partial<PrototypeSessionState> & Partial<PetBundle>) => {
  setState((current) => {
    const bundlePatch: Partial<PetBundle> = {};
    const topPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if ((PET_BUNDLE_PATCH_KEYS as readonly string[]).includes(k)) bundlePatch[k as keyof PetBundle] = v as never;
      else topPatch[k] = v;
    }
    const next = { ...current, ...topPatch } as PrototypeSessionState;
    return Object.keys(bundlePatch).length
      ? withActivePetBundle(next, () => bundlePatch)
      : next;
  });
}, []);
```

이로써 `apiDailyLoopSession.ts`는 W1에서 **한 줄도 안 바뀐다**(옛-키 patch를 계속 반환해도 어댑터가 흡수). API 모드 네이티브 번들화는 W2에서.

### 3.4 무변경 확인 대상 (수정 금지 목록)

다음은 W1에서 **읽기만 검증**하고 수정하지 않는다(전부 훅/파라미터로 소비):
- `terrarium/TerrariumHomeScreen.tsx`, `friend/FriendProfileScreen.tsx`, `chat/ChatGateScreen.tsx`, `petReveal/PetRevealScreen.tsx`, `settings/SettingsScreen.tsx`, `inventory/InventoryScreen.tsx`, `shop/ShopPreviewScreen.tsx`, `onboarding/SplashScreen.tsx`, `generation/GenerationScreen.tsx`
- 프리젠테이션 순수함수: `terrarium/terrariumHomePresentation.ts`, `friend/friendProfilePresentation.ts` — 이미 `careState`/`acceptedAssets`를 **파라미터로 받음**(`terrariumHomePresentation.ts:81,288`; `friendProfilePresentation.ts:412`), 스크린이 값을 넘겨줌.

---

## 4. 생성 상태머신 격리 (첫 펫 파괴 방지)

### 4.1 문제 정밀 재현

`startPrototypeGeneration`(`:769-770`)과 `retryPrototypeGeneration`(`:833-834`)은 `acceptedAsset: null, acceptedAssets: []`로 **에셋을 통째 비운다**. 현재는 단일 펫이라 무해하지만, `acceptedAsset(s)`가 활성 번들로 들어가면 "두 번째 펫 생성 시작 = 첫(=활성) 펫 스프라이트 삭제"가 된다(`multi-pet-slot-plan.md:10`, 가장 파괴적).

### 4.2 설계: 생성은 온보딩 임시 상태, 커밋 전까지 `pets` 무변경

W1 원칙: **생성 흐름(`draft`/`photo`/`generation`)은 최상위 임시 상태로 유지하고, 어떤 펫 번들도 건드리지 않는다.** 번들이 바뀌는 유일 지점은 `acceptPrototypeGeneratedPet`(커밋). 이렇게 하면 §4.1의 파괴가 구조적으로 불가능해진다(생성 중 `pets`는 read-only).

구체 변경:
1. `startPrototypeGeneration`(`:755-771`): 반환에서 `acceptedAsset: null, acceptedAssets: []` **제거**. `generation`만 갱신. 활성 번들의 에셋은 그대로 보존.
2. `retryPrototypeGeneration`(`:819-835`): 동일하게 에셋-비우기 제거.
3. `acceptPrototypeGeneratedPet`(`:917-969`)이 커밋 지점: `draft`/`generation`을 읽어 활성 번들의 petProfile/acceptedAsset(s)/careState/relationshipState/memories를 채운다. **W1은 항상 활성 번들(=유일 펫)에 커밋** — 단일 펫 생성 흐름이 그대로 동작.
4. `mergePrototypeGeneratedAssets`(`:1673-1694`): 활성 번들의 acceptedAssets에 병합(표정팩 폴 완료 후 호출, `TerrariumSessionProvider.tsx:1357`).

### 4.3 W1 범위 명시

`multi-pet-slot-plan.md:40`의 "생성 상태머신을 onboardingFlow로 격리"의 **완전한** 분리(별도 `onboardingFlow` 서브객체 + 커밋 시 새 펫 id 생성)는 W3(두 번째 펫 온보딩)의 몫이다. W1에서는:
- 구조: `draft`/`photo`/`generation`을 **최상위에 유지**(별도 서브객체로 묶는 리네이밍은 하지 않음 — 온보딩 스크린들이 `session.draft`/`session.generation`을 직접 읽음, `PetSetupScreen.tsx`/`GenerationScreen.tsx`).
- 격리: 에셋-비우기 제거로 "생성이 기존 번들을 파괴하지 않음"을 확보.
- 검증: "단일 펫 생성 → 수락 → 홈" 전체 흐름이 기존과 동일하게 그린.

즉 W1은 **행위 격리(에셋 보존)** 를 달성하고, **구조 격리(onboardingFlow 서브객체)** 는 W3로 남긴다. 문서상 이 경계를 명확히 한다.

### 4.4 스토어스크린샷/QA 세션 호환

`storeScreenshotSession.ts`/`qaScreenSession.ts`는 세션을 `updatePrototypeDraft`/`acceptPrototypeGeneratedPet`/`setPrototypeWeatherCondition` 등 **공개 함수 조합**으로 만들고, 직접 만지는 건 `generation`(최상위, `storeScreenshotSession.ts:96-120`)뿐이다. 공개 함수 시그니처가 유지되므로 **무변경**. 단, `withHatchingGeneration`처럼 `generation`만 스프레드하는 코드는 그대로 동작(생성 중 에셋 비우기가 사라져도 무해).

---

## 5. 마이그레이션 v7

### 5.1 버전 범프

`sessionMigrations.ts:21`: `CURRENT_SESSION_SCHEMA_VERSION = 6` → `7`. `sessionMigrations` 레지스트리에 키 `6`(v6→v7) 등록.

### 5.2 v6→v7 리프트 규칙 (무손실·멱등)

```ts
const FIRST_PET_ID = "pet_local_001"; // INV-3

// per-pet으로 이관될 최상위 키
const V6_PER_PET_KEYS = ["petProfile","acceptedAsset","acceptedAssets","careState","relationshipState",
  "currentReaction","lastCareReward","recentReactions","activeWalk","lastWalkDiscovery",
  "generationIssueReport","memories","careStats"] as const;

// v6→v7
6: (state: unknown) => {
  if (!isRecord(state)) return state;

  // 멱등: 이미 v7 형태(pets 존재)면 그대로 통과.
  if (isRecord(state.pets) && typeof state.activePetId === "string") {
    return state;
  }

  const petIdFromProfile =
    isRecord(state.petProfile) && typeof state.petProfile.id === "string"
      ? state.petProfile.id
      : FIRST_PET_ID;              // 기존 펫 id 유지, 없으면 pet_local_001

  const bundle: Record<string, unknown> = {};
  for (const key of V6_PER_PET_KEYS) {
    if (key in state) bundle[key] = (state as Record<string, unknown>)[key];
  }
  // 누락 방어(부분 저장): 기본값 보정은 프로바이더 mergeRestoredSession이 최종 담당(§5.5).
  //  단, careState/relationshipState/acceptedAssets/memories/careStats/recentReactions 등
  //  필수 per-pet 필드가 통째로 없으면 여기서 빈 기본값을 넣지 말고 원본 유지 →
  //  mergeRestoredSession의 번들 폴백이 채운다(중복 기본값 로직 방지).

  const rest = { ...(state as Record<string, unknown>) };
  for (const key of V6_PER_PET_KEYS) delete rest[key];

  return {
    ...rest,                        // draft/photo/generation + 공유필드 전부 유지
    pets: { [petIdFromProfile]: bundle },
    activePetId: petIdFromProfile
  };
}
```

핵심 속성:
- **무손실**: 모든 per-pet 최상위 값이 `bundle`로 그대로 이동. 공유 필드는 `rest`로 보존.
- **멱등**: `pets`가 이미 있으면 no-op(재실행 안전; `runSessionMigrations`가 v7→v7일 땐 루프 자체가 안 돌지만, 방어적으로 명시).
- **id 규칙**: 기존 `petProfile.id`가 있으면 그걸(=`pet_local_001`), 없으면 `FIRST_PET_ID`. 온보딩 미완(petProfile=null) 세션은 `FIRST_PET_ID`로 빈 번들 생성.

### 5.3 v6 원본 스냅샷 키

마이그레이션 실패 시(`runSessionMigrations.ok===false`) 프로바이더가 이미 `CORRUPT_SESSION_BACKUP_KEY`로 원본을 백업한다(`TerrariumSessionProvider.tsx:245,587`). **추가로** v7은 리프트가 비가역적 구조 변경이므로, 프로바이더 hydration에서 "v6→v7 성공 직후 원본 v6 문자열을 별도 키에 1회 보관"을 권장:
```ts
const V6_PRE_MIGRATION_BACKUP_KEY = `${STORAGE_KEY}.v6-backup`;
```
`load()`(`:558-611`)에서 `migrationResult.fromVersion <= 6 && toVersion === 7`일 때 원본 `stored` 문자열을 이 키에 `setItem`(이미 있으면 skip). 롤백/디버깅 안전망. (W5 "백업 키 정리"에서 만료 정책 추가.)

### 5.4 테스트할 v6 픽스처 3종

`sessionMigrations.test.ts`에 `describe("v6 -> v7 (pet bundle)")` 추가:

1. **온보딩 완료(펫 있음)**: `{ schemaVersion: 6, state: { ...v6shape, petProfile: {id:"pet_local_001",...}, careState, relationshipState, memories:[{type:"moved_in"}], careStats, acceptedAssets:[...] } }`
   - 기대: `migrated.pets["pet_local_001"].petProfile.id === "pet_local_001"`, `migrated.pets["pet_local_001"].memories`가 원본 memories와 동일, `migrated.activePetId === "pet_local_001"`, 최상위 `wallet`/`inventory`/`careStreak`/`walkCollection` 원본 보존, 최상위에서 careState/memories 제거 확인.
2. **온보딩 미완(펫 없음)**: `{ schemaVersion: 6, state: { ...v6shape, petProfile: null } }`
   - 기대: `migrated.activePetId === "pet_local_001"`, `migrated.pets["pet_local_001"].petProfile === null`, `careState`/`relationshipState`(mock 시드 값) 번들에 보존.
3. **생성 중(generation in-flight)**: `{ schemaVersion: 6, state: { ...v6shape, generation: {status:"generating",...}, acceptedAssets: [] } }`
   - 기대: `migrated.generation`(최상위) 그대로, `migrated.pets["pet_local_001"].acceptedAssets === []`, `normalizeRestoredGeneration`이 restore 시 이 조합을 interrupted-failure로 강등하는지 별도 확인(§8 함정 5).

추가 필수 테스트:
4. **v0→v7 전체 체인**(기존 `:363` 스타일): 펫 있는 legacy → 최종 `pets` 구조 + moved_in 백필 유지.
5. **멱등**: v7 envelope 재마이그레이션 = 동일(기존 `:606` 스타일을 v7로 갱신).

### 5.5 `isValidPrototypeSessionShape` + `mergeRestoredSession` 갱신

- `sessionMigrations.ts:420` `REQUIRED_TOP_LEVEL_KEYS`: `careState`/`relationshipState` **제거**, `pets`/`activePetId` **추가** → `["draft","photo","generation","pets","activePetId","wallet","inventory"]`. `isValidPrototypeSessionShape`(`:430-442`)는 `pets`가 object, `activePetId`는… 현재 로직이 "typeof === object" 검사(`:439`)라 문자열 `activePetId`는 통과 못 함 → **특례 처리**: `activePetId`는 `typeof === "string"` 별도 검사로 분기하거나, 검사 대상에서 빼고 `pets`만 검증. 권장: 검사 키는 `["draft","photo","generation","pets","wallet","inventory"]`(object들만), `activePetId`는 mergeRestoredSession이 보정.
- `TerrariumSessionProvider.tsx:402-447` `mergeRestoredSession`: 현재 `restored.acceptedAssets`/`restored.relationshipState`/`restored.petProfile` 등을 최상위에서 폴백 병합(`:407-437`). **번들 인지로 재작성**:
  - `fallback = createInitialPrototypeSession(nowIso())` (이제 pets 구조).
  - `restored.pets`가 있으면 각 번들에 대해 `{ ...fallbackBundle, ...restoredBundle }` 폴백 병합(누락 per-pet 필드 보정).
  - `activePetId` 누락/무효 시 `Object.keys(pets)[0] ?? FIRST_PET_ID`.
  - inventory plantGrowth 보존 로직(`:413-422`)은 공유 inventory라 그대로.
  - `normalizeRestoredGeneration(merged, ...)`(`:446`) 호출 유지 — §8 함정 5대로 내부가 `getActivePetBundle` 경유로 바뀜.

### 5.6 generatedAssetUriById 캐시 키 충돌 처리

`generatedAssetReadUrls`(`TerrariumSessionProvider.tsx:486`)와 `buildGeneratedAssetUriMap`(`generatedAssetUriMap.ts`)은 **`GeneratedAssetId` 단일 키 공간**을 쓴다. W1은 펫 1마리라 asset id 충돌이 없다(각 펫의 asset id는 `asset_{key}_{state}_001`로 species 접두어 상이, `buildPrototypePetProfile:515`). **W1 조치**: 캐시 키 스킴 변경 불필요 — `buildGeneratedAssetUriMap` 인자만 `activeBundle.acceptedAsset(s)`로 교체(§3.2). 멀티펫에서 두 펫이 같은 asset state를 갖되 id가 다르므로 여전히 충돌 없음. **단 문서화**: 만약 W2에서 서버가 `asset_{petId}_...` 대신 재사용 id를 쓰면 그때 키를 `{petId}:{assetId}`로 승격. W1은 현행 유지 + 이 리스크를 W2 인계.

---

## 6. 테스트 전략

### 6.1 깨지는 테스트 카탈로그 (grep 실측)

**shared (`packages/shared/src/__tests__/`):**

| 파일 | 결합도(라인 hit) | 왜 깨지나 | 갱신 방침 |
|---|---|---|---|
| `sessionMigrations.test.ts` | 40 | 대부분 `createInitialPrototypeSession()`을 v0/current 베이스로 쓰고 전체 체인 후 `result.state`가 입력과 같기를 기대(`:26-29,52,404,542,614`). `createInitial`이 이제 pets 구조 → 각 마이그레이션 `1..5`가 `state.inventory`/`state.memories`/`state.careStats`를 최상위에서 찾음. | (a) 마이그레이션 `1..5`는 `state.inventory`(공유)만 만지므로 **여전히 동작**(inventory는 최상위 유지). **문제는 v3→v4**(`:201-238`)가 `state.memories`/`state.careStats`/`state.petProfile`을 최상위에서 읽어 백필 → v7 구조에선 이 필드가 번들 안. **해결: v3→v4, v4→v5, v5→v6는 v6→v7 이전 단계이므로 여전히 "구(舊) 평면 구조"에서 실행됨** — v6→v7이 마지막에 리프트하므로 순서상 문제 없다(체인은 v3→v4→v5→v6→v7). 즉 `1..5` 마이그레이션 함수 **자체는 무변경**. 테스트는 `result.state`의 **최종 형태가 pets 구조**임을 반영해 기대값만 갱신(예: `:282` `migrated.memories` → `migrated.pets[FIRST_PET_ID].memories`). |
| `prototypeSession.test.ts` | 198 | `state.careState/relationshipState/acceptedAsset(s)/memories/careStats/activeWalk/currentReaction` 직접 읽기 다수(`:68-75,114-115` 등). | **선택지 A(권장)**: 테스트 헬퍼 `active(state)` = `getActivePetBundle(state)` 도입, `state.careState`→`active(state).careState` 일괄 치환(sed 가능). 순수함수 반환 검증은 번들 경유로. 산책/케어 흐름 기대값(수치)은 불변. **선택지 B**: 테스트에서 `getActivePetBundle` import 후 국소 치환. ~198 hit이나 기계적. |
| `scenarioQa.test.ts` | 14 | `state.currentReaction/relationshipState/activeWalk/careState/inventory/weatherState` 읽기(`:52-67,78,145-147`) + `{ ...state, inventory: {...} }` 패치(`:33-47`). inventory는 공유라 패치는 그대로 동작. per-pet 읽기만 `active(state).` 치환. | 위 A 패턴. inventory 패치(공유)는 무변경. |
| `bondRewards.test.ts` | 19 | 세션 경유 bond 보상 검증. `relationshipState`/`memories`/`wallet` 읽기. | wallet(공유) 무변경, relationshipState/memories → `active(state).`. |
| `careStreakAndExpression.test.ts` | 28 | careStreak(공유, 무변경) + inventory(공유) + memories(per-pet) + acceptedAssets(per-pet). | per-pet만 치환. careStreak 검증은 최상위 그대로. |
| `expressionPacks.test.ts` | 31 | `confirmPrototypeExpressionPackPurchase` 후 `inventory.ownedExpressionPackIds`(공유, 무변경) + `memories`(per-pet). | memories만 치환. ownedExpressionPackIds 공유 유지(1.2) 덕에 대부분 무변경. |
| `themeBundles.test.ts` | 20 | inventory(공유)/memories(per-pet). | memories만 치환. |
| `walkCollection.test.ts` | 12 | `claimPrototypeWalkReward` 후 walkCollection(공유)/inventory(공유)/lastWalkDiscovery(per-pet)/memories(per-pet). | per-pet만 치환. walkCollection/inventory 무변경. |
| `careBuffs.test.ts` | 8 | activeBuffs(공유)/careState(per-pet). | careState만 치환. |
| `petMemories.test.ts` | (도메인 직접) | `recordPetMemory` 순수함수 단위 테스트, 세션 미사용. | **무변경**. |

**mobile (`apps/mobile/src/features/`):**

| 파일 | 왜 | 방침 |
|---|---|---|
| `terrarium/terrariumScenarioContracts.test.ts` | `createInitialPrototypeSession`/`acceptPrototypeGeneratedPet`/`performPrototypeCareAction` + `.careState`/`.acceptedAsset` 읽기(4 hit). | `getActivePetBundle` 경유 치환. |
| `session/apiDailyLoopSession.test.ts` | API patch 반환 형태(옛-키) 검증. | patch 형태는 **무변경**(어댑터가 프로바이더에서 흡수, §3.3). 테스트 유지. |
| `session/apiGenerationSession.test.ts`, `supabaseGenerationSession.test.ts` | 생성 흐름 patch. | generation은 최상위 유지 → 대체로 무변경. `acceptedAssets` 관련 단정만 확인. |
| `session/storeScreenshotSession.test.ts` | 프리셋 세션 형태. | 공개 함수 조합이라 대체로 무변경, 최종 형태 단정만 갱신. |
| `session/generatedAssetUriMap.test.ts` | 순수 map 빌더. | 인자 기반 → **무변경**. |

### 6.2 신규 테스트

- **렌즈 유닛 테스트**(`packages/shared/src/__tests__/petBundle.test.ts` 신규): `getActivePetBundle`/`getPetBundle`/`withActivePetBundle`가 (a) 활성 번들만 갱신하고 다른 번들·공유 필드 불변, (b) `fn` 반환 Partial 병합, (c) `getPetBundle(state, unknownId) === undefined`.
- **마이그레이션 v6→v7**: §5.4의 픽스처 3종 + 체인/멱등.
- **생성 격리 회귀 테스트**(`prototypeSession.test.ts`에 추가): "acceptedAssets가 있는 상태에서 `startPrototypeGeneration`/`retryPrototypeGeneration` 호출 → 활성 번들 acceptedAssets **불변**"(§4 파괴 방지 증명).
- **프로바이더 호환 레이어**: 가능하면 렌더 없는 유닛으로 `value` 조립부를 추출하기 어렵다면, 최소 "활성 번들 필드가 최상위로 노출됨"을 mobile 통합 테스트로 확인.

### 6.3 "UI 무변경 = 기존 통합 테스트 그대로 통과" 보장

- 프리젠테이션 순수함수 테스트(`terrariumHomePresentation`/`friendProfilePresentation` 관련)는 파라미터 기반이라 **전부 무변경 통과** → 이것이 UI 로직 무변경의 1차 증거.
- INV-4(컨텍스트 키 집합 불변)는 타입으로 강제: `TerrariumSessionContextValue extends PrototypeSessionState`(`:174`)를 유지하되, `PrototypeSessionState`가 이제 per-pet 필드를 안 가지므로 **컨텍스트 타입에 per-pet 필드를 명시 추가**해야 함(안 그러면 UI 구조분해가 타입 에러). 즉:
  ```ts
  interface TerrariumSessionContextValue extends PrototypeSessionState, PetBundle {
    activePet: ...; // 기존 파생/액션 필드
  }
  ```
  `PetBundle`을 extends에 추가 → 컨텍스트가 per-pet 필드를 계속 노출한다고 타입 수준에서 약속. `tsc -p apps/mobile --noEmit`이 그린이면 UI 구조분해가 전부 유효 = 무변경 증명.

### 6.4 검증 커맨드
```
npx vitest run                    # shared + 일부 mobile
npm run typecheck
npx tsc -p apps/mobile --noEmit   # 모바일 변경분(호환 레이어/컨텍스트 타입)
```

---

## 7. 구현 순서 체크리스트 (중간중간 그린 유지)

각 단계 후 `npx vitest run` + 타입체크로 그린 확인.

1. **타입 추가 (그린 유지 불가 구간 시작)**: `prototypeSession.ts`에 `PetBundle` 인터페이스 + `createInitialPetBundle(now)` 헬퍼 추가. **아직 `PrototypeSessionState`는 안 바꿈** → 컴파일 그린. 렌즈 헬퍼(`getActivePetBundle`/`getPetBundle`/`withActivePetBundle`/`selectPrimaryAsset`)도 이 단계에서 추가하되, `PrototypeSessionState`가 아직 평면이면 `getActivePetBundle`이 컴파일 안 됨 → **2단계와 원자적으로 묶어 한 커밋.**
2. **상태 재편 + 렌즈**: `PrototypeSessionState`를 pets 구조로 변경 + `createInitialPrototypeSession` 재작성(FIRST_PET_ID 시드) + 렌즈 헬퍼 완성. 이 시점 순수함수/테스트 다수 red. (여기서 잠시 red 허용.)
3. **순수함수 전환**: §2.3 표 순서대로 전 함수를 렌즈 경유로. `getActivePrototypePet` 시그니처 유지. `start/retryPrototypeGeneration`의 에셋-비우기 제거(§4). 이 단계 끝에 **shared 순수함수 컴파일 그린**.
4. **shared 테스트 갱신**: §6.1 표대로 `active(state)` 헬퍼 도입 + per-pet 읽기 치환. `npx vitest run`(마이그레이션 제외) 그린.
5. **마이그레이션 v7**: `CURRENT_SESSION_SCHEMA_VERSION=7`, v6→v7 등록, `REQUIRED_TOP_LEVEL_KEYS`/`isValidPrototypeSessionShape` 갱신. §5.4 신규 테스트 + §6.1 마이그레이션 테스트 기대값 갱신. `sessionMigrations.test.ts` 그린.
6. **프로바이더 호환 레이어**: `TerrariumSessionProvider.tsx`에 `getActivePetBundle` import + `activeBundle` useMemo + `value`에 `...activeBundle` 펼침(§3.2 순서 규칙) + `generatedAssetUriById`/`activeGeneratedAssetId`/`projectedCareState`/`bondProgress` 소스 교체 + `applyApiStatePatch` 어댑터(§3.3) + `mergeRestoredSession` 번들화(§5.5) + `TerrariumSessionContextValue extends ... PetBundle`(§6.3). `npx tsc -p apps/mobile --noEmit` 그린.
7. **mobile 테스트 갱신 + 전체 검증**: §6.1 mobile 표. 전체 `npx vitest run` + `npm run typecheck` + `npx tsc -p apps/mobile --noEmit` 그린.
8. **생성 격리 회귀 테스트 추가**(§6.2) — 이 테스트가 그린이면 "두 번째 펫이 첫 펫을 파괴하지 않는다"의 구조적 증명(W3 대비).

> 2~3단계는 필연적으로 red 구간이 있다. 커밋 경계는 "4단계 끝(shared 그린)"과 "7단계 끝(전체 그린)"에 둔다.

---

## 8. 함정·리스크 톱5

1. **`careState: projectedCareState` 오버라이드 순서(§3.2 규칙 2).** 프로바이더 `value`에서 `...activeBundle`을 `careState` 오버라이드(`:1842`) **뒤에** 펼치면 시간투영이 무효화된다(정지된 careState가 UI에 뜸). 반드시 `...activeBundle` → 그다음 `careState: projectedCareState`. `projectedCareState`의 입력도 `state.careState`가 아니라 `activeBundle.careState`(`:1828`).

2. **`completePrototypeWalkEarly`의 중간 activeWalk 패치(`:1362-1381`).** 이 함수는 `{ ...state, activeWalk: {...returnAt:now} }`로 최상위 activeWalk를 패치한 뒤 `refreshPrototypeWalk`를 재호출한다. activeWalk가 번들 안으로 가면 **최상위 스프레드로는 안 먹는다** → `withActivePetBundle(state, b => ({ activeWalk: {...b.activeWalk, returnAt: now} }))` 후 refresh. 놓치면 "빨리 데려오기"가 조용히 무동작.

3. **`getActivePetBundle`의 undefined 방어.** `state.pets[state.activePetId]`가 `undefined`면 이후 모든 `bundle.xxx`가 크래시. `activePetId`가 손상/불일치한 복원 세션에서 발생 가능. **방어**: `mergeRestoredSession`에서 `activePetId`를 `Object.keys(pets)[0] ?? FIRST_PET_ID`로 정규화하고, pets가 비면 `{ [FIRST_PET_ID]: createInitialPetBundle }` 시드(§5.5). 렌즈 자체는 non-null 반환을 계약으로 두되, 복원 경계에서 불변식을 세운다.

4. **마이그레이션 순서 착각 — `1..5`를 번들 구조로 바꾸려는 유혹.** v3→v4가 `state.memories`/`state.careStats`/`state.petProfile`을 최상위에서 읽는다(`:207-224`). "이제 번들 안이니 고쳐야지"는 **오답**이다. 체인은 v3→v4→v5→v6→**v7** 순서라, v3→v4 실행 시점엔 아직 평면 구조다(v7 리프트가 마지막). `1..5`를 건드리면 오히려 과거 세이브의 백필이 깨진다. **`1..5`는 절대 손대지 말고 v6→v7만 추가.** 단 이들 테스트의 최종 기대값(`result.state`)은 pets 구조로 갱신(§6.1).

5. **`normalizeRestoredGeneration`의 stranded-completion 검사(`:667`).** `status === "completed" && state.acceptedAssets.length === 0`을 interrupted-failure로 강등한다. `acceptedAssets`가 번들로 가면 이 검사가 `getActivePetBundle(state).acceptedAssets`를 봐야 한다. 안 고치면 (a) 항상 `state.acceptedAssets===undefined`로 `.length` 크래시, 또는 (b) 평면 잔재를 읽어 오판. 복원 파이프라인(`mergeRestoredSession:446`)에서 호출되므로 앱 부팅 크래시로 직결. §5.5 재작성 필수. 추가로 §5.4 픽스처 3(생성 중)이 이 경로를 반드시 커버.

**보너스 리스크(6):** `deletePrototypeOriginalPhoto`(`:1837-1852`)가 `originalPhotoDeletedAt`(공유)+`photo`(온보딩)+`petProfile`(per-pet!)을 **동시에** 만진다. petProfile을 최상위로 착각해 스프레드하면 무동작. §2.3 표대로 B 패턴(공유 최상위 + `withActivePetBundle`로 petProfile).

