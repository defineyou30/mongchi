# 펫 슬롯 추가 (두 번째 친구) — 실행 계획서

2026-07-07. 단일 펫 전제 전수 조사 + UX·아키텍처 병렬 설계 종합. 원본 워크플로: wgo83cldj.

> **2026-07-08 결정: 슬롯은 출시 후 첫 대형 업데이트(v1.1)로 연기.** 출시 전엔 "한 마리라도 되는가"(핵심 훅 검증)에 집중. W1(도메인 번들화)·W2(서버 네임스페이스)는 이미 랜드·배포됐고 그대로 재사용 가능. W3(슬롯 구매+2번째 펫 온보딩) 진행분은 `git stash`로 보관(라벨 `slot-w3-wip`) — 출시 후 재개 시 그대로 복원. W4(멀티펫 표면)는 미착수.

## 왜 큰 공사인가

세션 상태 27필드가 전부 "펫 1마리" 전제다. 분류: **per-pet 12개**(케어·유대·기억·표정에셋·careStats·산책·생성플로우), **공유 7개**(지갑·간식 인벤토리·테마·날씨·티켓리필·entitlements), **애매 6개**(스트릭·도감·표정팩 소유권·버프·채팅티켓·정원이벤트 기억). UI 표면 10곳이 activePet을 읽는다.

**가장 위험한 단일 펫 전제 (조사 실측):**
1. `startPrototypeGeneration`이 `acceptedAssets`를 통째로 비움 — 두 번째 펫 생성을 시작하는 순간 **첫 펫 스프라이트가 삭제**됨 (가장 파괴적)
2. `pet_local_001` 하드코딩 — 모든 로컬 펫이 같은 id → API 호출·산책·이슈리포트 충돌
3. 기억 id가 전역 싱글턴(`mem_moved_in` 등) + MemoryEntry에 petId 없음 → 두 번째 펫이 자기 "이사 온 날"조차 기록 못 하고 앨범·편지·채팅이 뒤섞임
4. `acceptedAssets`가 state당 1개 평면 배열 → 펫 B 에셋이 펫 A를 덮어씀, 표정 팩 시드가 "첫 idle"을 집음
5. 기기 전역 AsyncStorage 위성 키들(케어 쿨다운·홈 토스트·편지 열람·알림 last-sent)이 펫 스코프 없음

## 아키텍처 (확정 추천)

**상태 모델**: `pets: Record<PetId, PetBundle>` + `activePetId` + 공유 필드 최상위 유지. 도메인에 "액티브 펫 렌즈" 헬퍼(`getActivePetBundle`/`withActivePetBundle`) 한 쌍 도입 → 기존 순수 함수(state 전체를 받는 구조)를 렌즈 경유로 전환해 테스트 파급 최소화.

**PetBundle**: profile·careState·relationshipState·careStats·acceptedAssets·memories·reactions·walk·생성결과. (`acceptedAsset` 단수는 `selectPrimaryAsset` 파생 셀렉터로 강등.)

**마이그레이션 v7**: 기존 세션 → `firstPetId = 기존 id(pet_local_001 유지)`로 첫 번들 리프트(무손실·멱등). v6 원본 별도 키 스냅샷. 신규 id 체계는 "두 번째 펫부터" 적용. 위성 AsyncStorage 키도 v7 범위에 포함.

## UX (확정 추천)

- **발견 = 정원에서 시작**: 조건 충족 시 울타리 옆 "이사 상자" 등장 + 기존 펫이 바라봄. 탭 → 초대 시트 "Another friend wants to move in. Shall we get a room ready?" → 50cr 결제. 상점 카드는 보조 입구로 유지. "슬롯을 산다"가 아니라 "방을 준비한다".
- **정원 공존 (스위칭 기각)**: 두 마리 모두 홈에 idle 렌더(고정 앵커 2개, 신규 아트 0). **말풍선·에피소드·케어 트레이·모먼트는 포커스 펫 1마리만** → 충돌 원천 차단 + 기존 연출 코드 재사용. 비포커스 펫은 조용히 idle.
- **케어 = 노동 2배 금지**: 펫별 상태 유지하되 **"동거 버프"**로 감쇠 대폭 완화 + 슬픔 단계 도달 불가 클램프. 서사 "They keep each other company while you're away." → 두 번째 펫이 오히려 케어 부담을 줄이는 긍정 프레임. 하루 1회 아무 펫 케어면 둘 다 유지가 목표 밸런스.

## BM (확정 추천)

- **슬롯 50cr에 새 펫 생성 1회 번들 포함** — "방 준비했는데 입주비 또 내라"는 이중 과금 금지. launch-plan "무료 생성 미포함"은 "유저 무료 쿼터(free_limit)를 다시 안 준다"로 해석.
- 슬롯 최대 = **총 2마리**로 출시 (데이터는 pets[] 배열로 N 대비, UI만 2 고정). 3마리째는 수요 확인 후.
- **표정 팩 소유권을 per-pet으로 이전** (현재 공유 → "샀는데 에셋 없는 펫" 방지). per-pet 구매 = 잡 1회 = 비용 1배 확정. 구매 시 항상 대상 펫 선택("A gift box for Bean") — 죄책감 문구 금지.

## 웨이브 분해 (1인 개발)

| W | 내용 | 규모 |
|---|---|---|
| W1 | 도메인 번들화 + 마이그레이션 v7 + 렌즈 헬퍼 + 생성 상태머신을 onboardingFlow로 격리(첫 펫 파괴 방지) | 대 ~4-6일 |
| W2 | ✅ 서버 펫 네임스페이스: generation_jobs/assets에 pet_id, 스토리지 avatars/{userId}/{petId}/, pet_slots 테이블 + 생성 게이트 | 중 ~2-3일 |
| W3 | 슬롯 구매 + 두 번째 펫 온보딩(기존 플로우 무파괴 재사용) + Splash 라우팅 pets 개수 기반 | 중대 ~3-5일 |
| W4 | 멀티펫 표면: 홈 펫 전환, 친구/채팅/설정 petId 스코프, 알림 복수형 | 대 ~4-6일 |
| W5 | 폴리시: 두 펫 상호작용 연출, 도감 보상 재점검, 스트릭 카피, 백업 키 정리 | 소중 ~2-3일 |

각 웨이브는 그린 상태로 랜드 가능(W1~W2는 UI가 여전히 첫 펫만 보여도 통과).

**2026-07-08 W2 완료 (서버 배포됨)**: `supabase/migrations/0005_pet_namespace.sql` — `generation_jobs`/`generated_assets`에 nullable `pet_id TEXT` 추가(NULL = 기존/첫 펫, 하위호환 기본값) + `pet_slots(user_id PK, extra_slots INT ≤1 CHECK, bundled_generation_available BOOLEAN)` 테이블(RLS 본인 읽기 전용) + RPC 3종: `grant_pet_slot`(50cr `consume_credits` 차감과 `extra_slots`+1·번들 부여를 한 트랜잭션으로 원자 처리, 상한 도달 시 과금 전 차단, `request_id` 멱등) / `reserve_pet_generation_slot`(완료된 펫 수를 `generation_jobs`의 `status='completed' AND original_photo_path IS NOT NULL` distinct `pet_id`로 산정 — `NULL`도 1마리로 카운트, 첫 펫·기존 펫 재생성은 `'ok_default'`로 기존 무료 쿼터 그대로, 신규 두 번째 펫은 슬롯 여유+번들 가용 시 `'ok_slot_bundle'`, 아니면 `'slot_required'`→402) / `refund_pet_generation_slot`(생성 실패 시 번들 환불, 크레딧/쿼터 환불과 동일 원칙). `generate-avatar`(`supabase/functions/generate-avatar/index.ts`) 수정: 요청 body에 optional `pet_id`(검증용 `PET_ID_PATTERN`, 스토리지 경로 세그먼트로 쓰이므로 영숫자/`_`/`-`만 허용) 추가 → 있으면 잡·에셋에 기록하고 업로드 경로를 `avatars/{userId}/{petId}/{jobId}/...`로(없으면 기존 경로 유지, `pet_media_select_own` RLS 정책은 userId가 여전히 인덱스 2라 무변경). 표정 팩 시드 소유권 검사를 기존 `avatars/{userId}/` 접두어 체크에 더해 `generated_assets` 조회로 `pet_id` 일치까지 확인(다른 펫 스프라이트 오시딩 방지). DRY_RUN은 HTTP 핸들러의 게이트(3·4단계) 이후에만 분기하므로 그대로 통과. 검증: `npm run typecheck` + `npx vitest run`(1252/1252 그린, 클라 무변경) + `deno check`(클린) + `deno lint`(기존 `no-import-prefix` 경고만 잔존). 마이그레이션 push + 함수 배포 완료. 슬롯 구매 UI/두 번째 펫 온보딩은 W3로 이월.

## ⚠️ 선행 과제 (블로커)

**슬롯 번들(생성 포함)은 서버 크레딧 원장 또는 최소 quota+1 경로가 선행**이어야 한다. 현재 free_limit=1(유저당)이라 두 번째 펫 생성은 402. 표정 팩처럼 "쿼터 스킵+로컬 차감"으로 가면 이미 지적된 무한 무료 생성 악용을 펫 생성까지 확대(기각). → **크레딧 Phase 1(서버 원장)을 슬롯 앞에 넣거나, 슬롯 구매 시 서버가 generation_quota를 +1 승격하는 최소 grant 경로를 W2에 포함.**

## 사용자 결정 (2026-07-07 확정)

- ✅ **슬롯 50cr에 생성 1회 번들 포함** → 서버 크레딧 원장(크레딧 Phase 1) 또는 quota+1 grant가 슬롯의 선행 과제. 이 순서 수용됨.
- ✅ **정원 공존 렌더** (스위칭 기각) — 두 마리 홈 idle, 포커스 펫만 말풍선/케어.

### 2026-07-08 추천안 기본값 채택 (자율 진행 — 전부 저비용 변경 가능, 사용자 이의 시 조정)
1. **이사 상자 등장 조건**: 첫 펫 bond Lv2+ AND 이사 후 7일+ (복합) ✅ 채택
2. **채팅 무료 티켓**: 유저당 공유 ✅ 채택
3. **산책 도감**: 가족 공동 도감 (발견자 뱃지 펫별은 W4-5) ✅ 채택
4. **동거 버프**: 방향 승인, 수치는 W4 진입 시 밸런스 패스에서 확정
5. **careStreak**: 유저 습관 스트릭으로 공유 유지, 친구 페이지 표기 변경은 W4에서
