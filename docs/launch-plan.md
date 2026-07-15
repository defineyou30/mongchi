# Mongchi 전체 계획서 (Launch Plan)

> 최종 갱신: 2026-07-12 · 이 문서는 제품/BM 계획 기준이다. 실제 런타임,
> 배포, 보안 출시 게이트는 `docs/current/backend-release-audit-2026-07-12.md`를
> 단일 기준으로 우선한다.
> 관련: `docs/game-economy-bm-proposal.md`(BM 상세), `docs/improvement-backlog.md`(백로그), `docs/security-boundaries.md`

---

## 1. 제품 정의

**한 줄**: 내 반려동물 사진이 캐릭터가 되어 정원(garden)에 이사 와서(moving in) 함께 사는 힐링 앱.

- **코어 약속**: "우리 집 반려동물이 폰 안에 산다" — 사진→AI 캐릭터화가 유일한 차별점이자 존재 이유
- **리텐션 엔진**: 돌봄 의식(케어·스트릭·산책·반응·유대) — Finch 모델. 전부 온디바이스. 기억/에피소드 스파인(2026-07 구축): 함께한 순간이 기록되고(추억 앨범), 반려동물이 어제 일을 언급하며(에피소드 대사), 케어 패턴이 버릇이 되고(개별성), 30일 편지로 축적이 감정 보상이 되는 구조
- **세계관**: moving-in / garden 통일. hatch·avatar·terrarium은 사용자 노출 금지 (내부 코드명만 허용)
- **톤 원칙 (불변)**: 영어 카피, 따뜻한 펫 톤, **죄책감 유발 절대 금지**. 펫은 돈 없이도 항상 완전히 행복할 수 있다
- **타겟**: 해외(미국 1차) 반려인. 포지셔닝은 "펫 게임"이 아니라 "반려인의 앱". 획득 채널 = 펫 인스타/커뮤니티 + 아바타 공유 바이럴

## 2. 아키텍처 (확정)

**로컬 우선 + 생성 전용 미니 백엔드 (Supabase 올인)**

| 레이어 | 위치 | 비고 |
|---|---|---|
| 케어/스트릭/산책/인벤토리/알림 | 폰 (AsyncStorage) | schemaVersion envelope + 마이그레이션 완비, 손상 시 corrupt-backup |
| 사진→아바타 생성 | Supabase Edge Function `generate-avatar` | OpenAI 키는 secret. 202 즉시 응답→백그라운드, 완료 시 원본 사진 자동 삭제 |
| 파일 (원본/아바타) | Supabase Storage `pet-media` (private) | signed URL로만 접근, RLS 본인 폴더만 |
| 잡/쿼터/크레딧 원장 | Supabase Postgres | 폰은 읽기 전용(RLS), 쓰기는 전부 service_role |
| 인증 | Supabase 익명 로그인 → 정식 계정 전환(identity linking) | 생성 버튼 시점에만 익명 생성. 온보딩 로그인 강요 금지 |
| **리전** | **us-east-1 (N. Virginia)** | 해외 타겟 확정. 변경 불가이므로 고정 |

- 무료 생성 = 표정 3종(idle/happy/sleep), 원가 ~$0.13/건. 풀셋 16종은 유료(원가 ~$0.55, medium 화질 기준)
- **아트 스타일 (2026-07-12 현재)**: **piki 픽셀 스프라이트 계약** (pikibit `openai_image_provider.py`에서 이식 — "cute 2D low-resolution pixel-art sprite, chunky silhouette, 1-2px dark outline, 16-24 colors, flat cel shading" + 발끝 앵커 계약). `generate-avatar` 코드의 기본 모델은 **gpt-image-1.5**이며 `OPENAI_IMAGE_MODEL`로 배포 시 오버라이드할 수 있다. 근거: 소프트 일러스트는 단독으론 예쁘지만 픽셀 정원 배경 위에서 이질감 — 픽셀 스프라이트가 세계의 주민처럼 보임. 투명 배경은 **균일 녹색 크로마키 + 함수 내 BFS 제거** 방식 (검증 완료). 기존 번들 스프라이트와 스타일 일치라 재생성 불필요
- 폐기: Fly/Docker/Neon/Auth0 라이브 배포 계획. `services/api`·`workers/ai`는 라이브 폐기하되 **workers/ai는 종별 기본 에셋 배치 생산 내부 도구로 보존**
- 백업(Phase D): 세션 envelope 통째로 `user_backups`에, last-write-wins. 기본 백업은 영원히 무료

## 3. BM: 범용 크레딧 + 구독 1종 (확정)

**최종 SKU 5개**: 크레딧 팩 4종(소모성) + Mongchi Plus 구독 1종. 비소모성 없음.

### 3.1 크레딧 소비표 (1크레딧 = $0.10 가치 앵커)

| 기능 | 크레딧 | 원가 | 비고 |
|---|---|---|---|
| 재생성 (3종 표정) | 8 | $0.13 | 무료 1회 소진 후 |
| 풀셋 16종 | 30 | $0.55 | 최고 객단가 소비처 |
| 스타일 팩 재생성 | 8 | $0.13 | 수채화/픽셀 등 |
| 테마 번들 | 18 | ~0 | 기존 themeBundles 유지 |
| 추가 펫 슬롯 | 50 | ~0 | 신규 펫 무료 생성 미포함 |
| 프리미엄 채팅 | 1/메시지 · 5/일일권 | ~0 | 기존 spendPremiumChatTurn |
| 간식/장식 | 2~8 | ~0 | 기존 starterCreditItemPrices |
| 산책 조기 귀가 | 1 | ~0 | ✅ 구현됨 (2026-07-03) — 첫 시간단축형 소비처. 광고 버튼(Greet now/2x gift) 대체 |

### 3.2 크레딧 팩

| SKU | 가격 | 크레딧 | 비고 |
|---|---|---|---|
| credits_small | $2.99 | 25 | |
| credits_medium | $5.99 | 60 | "정가" 앵커 |
| credits_large | $9.99 | 120 (+20%) | |
| credits_mega | $19.99 | 280 (+27%) | 보너스 27% 상한 준수 (원가율 방어) |

첫 구매 보너스: medium 이상 첫 결제 시 +10 (1회). 최악 원가율 37% 검증 완료.

### 3.3 플레이 획득 (간식 중심 — bonusCredits는 유대 마일스톤/도감 완성에만)

**2026-07 재설계**: 플레이 보상의 기본값은 간식/장난감 아이템이다. `bonusCredits`는 유대 레벨 마일스톤(L5·L10)과 산책 도감 완성 1회에만 지급한다 (유료 `credits` 버킷과는 완전히 분리 — 코드가 잘못 지급하던 버그 수정 완료).

- **출석 스트릭**: 3일마다 간식 1개(`item_apple_biscuit`), 7일마다 스페셜 간식 1개(`item_milk_pup_cup`, 겹치는 날은 스페셜만). 크레딧 지급 없음
- **산책 보상**: 매 산책 종료 시 날씨별 간식/식품 아이템 1개 (rain/storm → Chicken Jerky, snow/cold → Bone Biscuit, wind → Tuna Crunch, hot → Treat Plate, 그 외 → Sweet Potato Chew). 화분류 아이템은 어떤 날씨에서도 지급되지 않음
- **산책 도감 완성**(1회): +20 bonusCredits
- **유대 레벨업**: L2 간식 2개+무료채팅권 2, L3 간식 2개, L4 휴식 아이템 1개, **L5 +5 bonusCredits**, L7 간식 2개, **L10 +10 bonusCredits+무료채팅권 3**
- 무과금 기준: 재생성 ~2주 1회, 풀셋 ~7주 (가능하되 느리게 — "절대 불가" 금지)
- 폐기: 광고 보상형 시스템(리워드 애드 게이트, 산책 보상 2배 부스트) 전면 제거 완료 — 잔재 없음

**2026-07-07 케어 체감 밸런스 수리**: 방치 감쇠에 바닥값(최저 15) 도입(happiness는 배고픔/불결 페널티 포함해도 동일 바닥) + 케어 이득 캐치업 배수(해당 스탯 40 미만이면 선형 증폭, 0에서 최대 2.0배, 버프 배수와 곱 중첩 시 3.0배 상한 클램프) + 밥/물주기에 에너지 회복 +14(공놀이/산책의 에너지 소모 -8/-12는 리듬 요소로 유지). 간식 쿨다운 60분→2분(구매 소모품 즉시 사용 가능), 유대 XP 파밍 방지로 간식은 하루 3회·talk는 하루 10회까지만 XP 지급(스탯/기분 효과는 무제한, `careStats`에 optional 필드로 추가, 스키마 버전 범프 없음).

**2026-07-07 구매 아이템 쿨다운 면제**: 간식 쿨다운 2분→0(연타 방지는 기존 3초 액션 잠금이 담당)으로 완전 면제, play/affection 트레이에서 Buddy Plush·Rose Cushion 같은 구매 아이템을 지정 실행하면 해당 액션의 기본 쿨다운(20분/5분)도 우회. 파밍 방어는 쿨다운 대신 XP 일일 상한으로: play도 간식/talk와 동일 패턴으로 하루 5회까지만 유대 XP 지급(스탯/행복 효과는 무제한).

### 3.4 Mongchi Plus (Phase 3)

$4.99/월 (연 $39.99) = 매월 30크레딧 + 무제한 힐링챗 + 기기 동기화 + 월간 한정 테마. 월 순마진 ~$2.94.

### 3.5 원장 정합 (확정 원칙)

- `bonusCredits`(플레이 획득) = **로컬 진실** (소실돼도 CS 이슈 아님)
- `credits`(현금 구매) = **서버 진실** (`credit_wallets` 잔액 + `credit_ledger` append-only 감사 로그)
- 생성 소비는 반드시 서버 선차감 → 실패 시 자동 환불 (RPC)

**2026-07-07 크레딧 Phase 1a+1b 완료 (서버 배포됨)**: `supabase/migrations/0004_credit_ledger.sql` — `credit_wallets`(잔액)/`credit_ledger`(append-only 감사, `(user_id, reason, ref_type, ref_id)` 멱등 유니크) 신설 + RPC 4종(`consume_credits`/`refund_credits`/`grant_credits`/`get_credit_balance`, 전부 SECURITY DEFINER + row lock + 멱등) + `generation_jobs.credit_ref` 컬럼 + 기존 `generation_quota.paid_credits` → `credit_wallets` 1회 이관(멱등, 이관 후 `paid_credits`=0). `generate-avatar`(`supabase/functions/generate-avatar/index.ts`)가 표정 팩 요청을 이제 잡 생성 **전에** `consume_credits(cost=12, reason='consume_expression_pack')`로 서버 선차감(잔액 부족 시 402 `insufficient_credits`) — 기존에는 이 경로가 서버 차감을 완전히 스킵해 무제한 무료 생성이 가능했던 보안 구멍이었음. 실패 시 환불 로직도 함께 뒤집음: `shouldRefundOnFailure=!isExpressionPackMode`(표정 팩은 환불 안 함, 회귀 버그)를 제거하고 잡의 `credit_ref` 유무로 `refund_credits`/`refund_generation_quota`를 분기 → 표정 팩도 실패 시 항상 환불됨. 멱등키는 클라 `request_id`(UUID, 없으면 서버가 요청당 폴백 생성 — 이 폴백은 재시도 중복 차감은 못 막지만 기존 동작 대비 회귀 없음). 무료 1회(`free_used`/`free_limit`)는 `generation_quota`/`consume_generation_quota` 그대로 유지.

**2026-07-08 크레딧 Phase 1c 완료 (커밋 f881743)**: 클라이언트가 서버 잔액을 하이드레이트하고, 표정 팩 구매 시 로컬 `spendCredits` 대신 서버 응답 잔액에 동기화한다(`credits`=서버 진실). `bonusCredits`는 계속 로컬 진실로 유지. 이어 **크레딧 안전 보강(커밋 c5d405c)**: start-flow가 throw할 때의 실드 + `request_id` 멱등 재시도 가드로 이중차감 불가 경로 확정.

**P1d(결제) 방향 = RevenueCat**: 사장 기존 앱들에 이미 RevenueCat이 있어 이를 사용한다. RevenueCat이 영수증 검증·환불 웹훅·크로스플랫폼을 대신하므로 직접 verify-purchase Edge Function 구현은 불필요(이게 P1d 위험의 핵심이었음). 코드 토대(크레딧 팩 카탈로그·상점 UI·grant 웹훅 Edge)는 후속 구축하고, RC 연결(스토어 상품 생성 + RC 대시보드 매핑)은 "결제 켜기" 최종 단계=사장 액션. **현 코드에 크레딧 구매 SKU는 아직 없음**(`premium_chat_monthly` 구독만 존재) — 크레딧 경제 데드엔드(소비처는 있으나 버는 곳·사는 곳 부재)가 출시 전 매출 급소. 상세: `docs/credit-phase1-design.md`.

### 3.6 수익 전망 (참고)

1,000 MAU: 현실적 월 ~$135 / 관대 ~$540. 고정비 ~0으로 1일차 흑자 구조. 병목은 수익화가 아니라 획득.

### 3.7 리텐션 시스템 현황 (2026-07-08)

**기억 스파인**: MemoryEntry 10종 자동 기록(이사/첫산책/첫발견/레어/도감완성/유대레벨/스트릭 7·14·30/함께한 날 7·14·30/첫간식/테마), 최대 200개, 친구 페이지 "Our little moments" 앨범에 표시

**개별성**: CareStats → 버릇 힌트 8종 → "Lately, {name}…" 카드 + 홈 에피소드 대사

**30일 편지**: buildMonthlyLetter — day 30 도달 시 친구 페이지에서 개봉, D7/14/30 홈 토스트

**스트릭 그레이스**: 1일 공백 유지(7일 쿨다운), 위협 문구 금지 원칙

**테마**: 소유 기록(ownedThemeIds) + 기본 1종 무료 + 4종 18cr, 재과금 불가

**게임필 순간 연출 (Tier 2/3/4, 커밋 236f580·ca706c8·66a4289)**:
- Tier 2(236f580): 밥그릇/물그릇/공/하트 케어 순간의 컨텍스트 연출
- Tier 3(ca706c8): 밤 수면(22–6시), 자율 idle 행동, 나비 방문객
- Tier 4(66a4289): 간식 취향 반응, 장난감/쿠션 개별성, 인벤토리 Give now

**산책 대기 경험 (커밋 570db25)**: 발자국 중앙확대·실황 라인 10종·귀가 로컬알림·산책 중 채팅 인지

**Bath(clean) 액션 배선 (커밋 570db25·554e2ea)**: 물 트레이 Bath 옵션·비눗방울 연출·뽀송 대사·water SFX. 도메인 clean 액션은 있었으나 진입점이 없던 데드엔드를 수리. (단 cleanliness HUD 미터 표시는 별도 — 아래 미해결)

**데이터 백업 (커밋 dbfc906)**: 세션 내보내기/가져오기 — 기기 로컬 데이터 안전장치(Phase D 클라우드 백업과는 별개의 로컬 수동 백업)

**미해결(다음)**: 크레딧 팩 IAP(RevenueCat 배선 + 사장 스토어 셋업 — 매출 급소), 반복 크레딧 파우셋(데일리) 여전히 없음(검토 대상), cleanliness HUD 미노출, 산책 도감 9종 OS 이모지→픽셀 아이콘, 위젯(네이티브 타깃 필요), L10 이후 트랙

## 4. 로드맵

> 2026-07-12 대조: 세션 스키마 v7, 로컬 마이그레이션 0001–0015. 운영자가 원격 migration history 0001–0013을 확인했고, 채팅 가드레일/신고 `0014`–`0015`는 원격 배포 검증 대기다.

### 4.1 완료·배포됨 (커밋 순서)

| 단계 | 내용 | 상태 |
|---|---|---|
| 온보딩 리디자인 (moving-in, 리빌 보호, 수치 제거) | | ✅ 완료 |
| 세션 schemaVersion 마이그레이션 | 데이터 유실 경로 차단. 현재 v7(pets 번들) | ✅ 완료 |
| 작은 세계 Wave 1-4 — 기억 스파인(memories/careStats, 마이그레이션 v4) + 친구 페이지 앨범·개별성 카드 + 홈 에피소드 대사 레이어 + 채팅 기억 인사·잠금 인상 제거 + 30일 편지·D7/14/30 연출 + 테마 소유 기록(마이그레이션 v5)·Themes 3상태 + 스트릭 그레이스 1일 + 공유 버튼(리빌·친구 페이지) + 알림 퍼미션 배선·복귀 사다리 + 날씨 일 단위 변화 | | ✅ 완료 (2026-07-07) |
| Supabase 스키마 + Edge Function + 모바일 연결 | 생성/삭제 함수 활성, 원격 migration history 0001–0013 확인. 채팅 서버 과금·선예약·전역 제한·신고 0014–0015 로컬 완료 | ⚠️ 0014–0015와 현재 chat-turn 배포 검증 대기 |
| 보안: 표정팩 rate-limit 증폭/무료생성 봉합 (dc0a82d) | | ✅ 완료·배포됨 |
| 출시위생: Info.plist 위치권한 정리·릴리스 검증 강화·미배선 상품 카드 숨김 (308aa95) | | ✅ 완료 |
| 관측성: 로컬 ErrorBoundary + reporter 추상화 (d4a20a5) | Sentry 실연동은 후속 네이티브 재빌드 묶음 | ✅ 완료 |
| 법적: 실제 Privacy/Terms/Support 내용 + docs/legal (b87ceab) | 변호사 검토 항목 표기 | ✅ 완료 |
| 사운드 Phase 1(SFX+햅틱)·Phase 2(주간/야간 BGM + 날씨 앰비언스) (727907c) | 유저 음악 안 끊김(mixWithOthers) | ✅ 완료 |
| 멀티펫 W1 — 세션 pets[petId] 번들화 + 마이그레이션 v7 + 렌즈 헬퍼 (UI 무변경) (031f483) | 첫 펫 파괴 버그(생성 시 에셋 비우기) 제거 포함 | ✅ 완료 (2026-07-07) |
| 게임필 Tier 2 — 밥그릇/물그릇/공/하트 케어 순간 컨텍스트 연출 (236f580) | | ✅ 완료 |
| 데이터 백업 — 세션 내보내기/가져오기 (기기 로컬 안전장치) (dbfc906) | Phase D 클라우드 백업과는 별개의 로컬 수동 백업 | ✅ 완료 |
| 크레딧 Phase 1a+1b — 서버 원장(credit_wallets/ledger, 마이그레이션 0004) + RPC 4종 + 표정 팩 서버 선차감 게이팅 (1114ff9) | 배포 완료, 무료생성 보안 구멍 봉합 | ✅ 완료·배포됨 (2026-07-07) |
| 게임필 Tier 3 — 밤 수면(22–6시)·자율 idle 행동·나비 방문객 (ca706c8) | | ✅ 완료 |
| 크레딧 Phase 1c — 클라 서버잔액 하이드레이트, 표정 팩 로컬 차감 → 서버 응답 잔액 동기화 (f881743) | bonusCredits는 로컬 진실 유지 | ✅ 완료 (2026-07-07) |
| 크레딧 안전 — start-flow throw 실드 + request_id 멱등 재시도(이중차감 불가) (c5d405c) | | ✅ 완료 |
| 게임필 Tier 4 — 간식 취향 반응·장난감/쿠션 개별성·인벤토리 Give now (66a4289) | | ✅ 완료 |
| 산책 대기 경험 (570db25) — 발자국 중앙확대·실황 라인 10종·귀가 로컬알림·산책 중 채팅 인지 | | ✅ 완료 |
| Bath(clean) 액션 배선 (570db25·554e2ea) — 물 트레이 Bath 옵션·비눗방울 연출·뽀송 대사·water SFX | 진입점 없던 데드엔드 수리. cleanliness HUD 미터는 별도(미착수) | ✅ 완료 |
| 멀티펫 W2 — 서버 펫 네임스페이스: generation_jobs/assets pet_id + pet_slots 테이블 + 슬롯 RPC 3종(grant/reserve/refund) + 스토리지 펫 경로(마이그레이션 0005) (9034c7d) | 배포 완료. 상세: multi-pet-slot-plan.md 2026-07-08 노트 | ✅ 완료·배포됨 (2026-07-08) |
| 웰컴 온보딩 — 3슬라이드 인트로(펫 곁에→사진 시작→정원 이사) 셋업 전 표시 + AsyncStorage 기록 + 스플래시 라우팅 분기 (a78a514) | | ✅ 완료 (2026-07-08) |
| 서버 측 데이터 삭제 (`delete-account` Edge Function) | 스토리지+DB cascade+익명 auth 삭제. Apple 계정삭제·GDPR 요건. 상세 §6 | ✅ 완료·배포됨 (2026-07-08) |

### 4.2 진행 중 / 실기기 QA 대기

| 단계 | 내용 | 상태 |
|---|---|---|
| 푸시 알림 배선 (expo-notifications, 11종 — 상태 기반 9종 + 복귀 유도 +1일/+3일 2종, 상태 기반 일일 2건 캡) | 퍼미션 요청을 첫 케어 액션 직후 1회 호출로 배선, 복귀 유도 알림 추가 | 🔧 코드 배선 완료 (실기기 QA 대기) |
| decay 힐링 톤 완화 | 감쇠 바닥값(15)+케어 캐치업 배수 완료(§3.3), sick→sleepy 톤 재작업은 별도 | 🔧 일부 완료 |
| Dog/Cat 온보딩 | Pet setup 종 선택 + 8개 언어 중립 카피 완료 | 🔧 중립 아트·실사진 종별 QA 대기 |

### 4.3 예정 (출시 전)

| 단계 | 내용 | 상태 |
|---|---|---|
| **크레딧 IAP — RevenueCat 배선** — 크레딧 팩 카탈로그·상점 UI·grant 웹훅 Edge(코드 토대) + RC 대시보드 매핑·스토어 상품 생성(사장 액션) | **매출 급소.** 현 코드에 크레딧 구매 SKU 없음(구독만). RevenueCat이 영수증검증·환불웹훅·크로스플랫폼 대행 → 직접 verify-purchase 불필요. RC 연결은 "결제 켜기" 최종 단계 | 📋 예정 (코드 토대 후속 + 사장 스토어 셋업) |
| 반복 크레딧 파우셋(데일리) | 크레딧 경제 데드엔드 완화 — 버는 곳 부재 대응 | 📋 검토 대상 |
| 실사진 E2E 1왕복 (업로드→생성→표정 3종→signed URL 렌더) | | 📋 예정 |
| V1 에셋 (종 4~6 × 표정) — workers/ai 배치 생산 + 검수 | sad/sick/messy 포함 | 📋 예정 |
| 산책 도감 9종 OS 이모지 → 픽셀 아이콘 | walkCollection.ts | 📋 미착수 |
| cleanliness HUD 미터 노출 | Bath 액션은 배선됨, 미터 표시는 별도 | 📋 미착수 |
| 위기 세이프티 카피 + 전문가 검수 | 채팅 출시 전 필수 | 📋 예정 (채팅 게이트) |
| 스토어 제출 (라벨/심사/스크린샷) | | 📋 예정 |

### 4.4 연기 / 출시 후 (v1.1+)

| 단계 | 내용 | 상태 |
|---|---|---|
| **멀티펫(슬롯) 전체** | 2026-07-08 결정: 출시 후 v1.1로 연기. 근거: 실유저 0명 상태에서 "한 마리라도 되는가" 핵심 훅 검증 우선 | ⏸️ 연기 (v1.1) |
| ├ 멀티펫 W1 (도메인) | 세션 pets 번들·마이그레이션 v7·렌즈 헬퍼 | ✅ 완료 (재사용 가능) |
| ├ 멀티펫 W2 (서버) | 펫 네임스페이스·pet_slots·슬롯 RPC 3종·스토리지 경로 | ✅ 완료·배포됨 |
| ├ 멀티펫 W3 — 슬롯 구매(이사 상자·초대 시트) + 두 번째 펫 온보딩 재사용 | git stash `slot-w3-wip`로 보관 | ⏸️ 연기 (v1.1) |
| └ 멀티펫 W4 — 홈 공존 렌더·펫 전환, 친구/채팅 petId 스코프 | | ⏸️ 미착수 (v1.1) |
| 크레딧 Phase 2 — 재생성/풀셋 등 나머지 생성 소비 서버 차감 전환 | 무료 1회 유지 | 📋 예정 |
| 백업 Phase D — user_backups + identity linking UX | 로컬 수동 백업(dbfc906)은 별개로 완료 | 📋 예정 |
| 크레딧 Phase 3 — Plus 구독 | 소비 데이터 확보 후 | 📋 출시 후 |
| Sentry 실연동 · dev/prod Supabase 분리 · free_limit 복원 · 익명 로그인 rate-limit/CAPTCHA | 후속 네이티브 재빌드/사장 대시보드 묶음 | 📋 예정 |
| 펫로스/추모 모드 | 전문가 검수 필수, 극도로 신중히 | 📋 장기 |

## 4.5 디자인 QA 백로그 (2026-07-03 실기 테스트에서 사용자 확인)

**W1 — 폴리시·버그 (소형)** — ✅ 완료 (2026-07-03)
- [x] 스트릭/버프 배지 → 자동 소멸 토스트, 공 아이콘 정렬, HUD 가이드 팝업

**W2 — 전역 디자인 시스템 (기반)** — ✅ 폰트/토큰 완료 (2026-07-03)
- [x] Pixelify Sans + Baloo 2 토큰 시스템, 홈·온보딩·설정·채팅 적용, Menlo 제거. 페어 B 비교 토글은 확정 후 제거 예정
- [ ] OS 이모지 → 픽셀 아이콘: **산책 도감 9종만 남음** (walkCollection.ts — 전수조사 결과 그 외 클린). 아이콘 배치 생산 대기

**W2.5 — 물 액션 의미 확정 (2026-07-03 확정, W2 랜드 직후)**
- [ ] **물 = 강아지 식수로 통일**: 트레이 라벨("Drinks"→"Water" 단일화)·HUD 물방울 가이드·알림 카피 전부 "강아지가 마시는 물" 서사로. 내부 액션명(water_garden)·스탯(gardenHealth)은 무변경 (표시 계층만)
- [ ] **식물 물주기 UI 제거(일단)**: "plant is thirsty, watering can help" 류 식물 성장 큐를 숨김 — 물 버튼과 식물의 연결을 유저에게 노출하지 않음. 도메인(plants)은 보존, 추후 물뿌리개 별도 액션으로 재도입 후보

**W3 — 화면 리뉴얼 (W2 기반 위에서)**
- [ ] 설정 화면 리뉴얼
- [ ] 채팅 화면 리디자인
- [ ] 셋업 온보딩 재재디자인 — 홈 배경·이모티콘 컨셉 기준의 픽셀 힐링게임 분위기 (폰트 포함)

**소품 배치·BM (2026-07-03 확정)**
- **고정 앵커 슬롯**: 슬롯마다 위치 + 사이즈 클래스(S/M/L) + 원근 스케일(뒤 0.7x~앞 1.0x) + 공통 타원 그림자. 자유 배치는 추후 고급 기능 후보
- **소품 에셋 단일 규격**: 256px 정사각 · 바닥 접점 하단 중앙 · 그림자 없이 제작 (그림자는 슬롯이 렌더)
- **BM 단위 = 테마 세트** (배경 + 어울리는 소품 5~6종 + 배치 프리셋, 18cr~) + 낱개 소품(2~8cr) 보조. 단품 나열 판매 금지 (니켈-앤-다임 인상 회피)

## 5. 팝업·안내·고지 목록 (전수)

> 원칙: 모두 영어, 따뜻한 톤, 죄책감 금지. 차단형(모달)은 법적 필수만, 나머지는 비차단 배너. 같은 안내 반복 노출 금지.

### 5.1 온보딩·생성

| # | 시점 | 형식 | 내용 (요지) | 상태 |
|---|---|---|---|---|
| P1 | 사진 선택 화면 | 인라인 고지 | "Only used to create your tiny friend. You can delete the original anytime." + 생성 완료 시 원본 자동 삭제 명시 | ✅ 구현 |
| P2 | 생성 시작 직전 | 인라인 | 사진이 AI 처리를 위해 서버로 전송됨을 1문장 고지 (개인정보처리방침 링크) | 📋 추가 필요 |
| P3 | 생성 실패 | 인라인 카드 | "Move-in paused" + 따뜻한 재시도 안내. 크레딧 소비 건은 자동 환불됐음을 명시 | ✅ 카피 구현 / 환불 문구 📋 |
| P4 | 무료 생성 소진(402) | 시트 | 재생성은 크레딧 안내 — 무료 획득 경로(산책·스트릭)를 **먼저** 제시, 충전은 그 다음 | 📋 |
| P5 | 첫 케어 액션 완료 후 | OS 권한 다이얼로그 + 사전 설명 1장 | 푸시 권한. "Miso will send a small hello sometimes" 톤. 거절 시 재요청 금지 | ✅ 게이트 함수 + 호출 배선 완료 (실기기 QA 대기) |

### 5.2 계정·백업

| # | 시점 | 형식 | 내용 | 상태 |
|---|---|---|---|---|
| P6 | 첫 생성 버튼 탭 | 없음 (무음) | 익명 계정 자동 생성 — 유저에게 팝업 안 띄움. 설정 화면에 "Guest" 상태만 표시 | ✅ |
| P7 | 긍정 이벤트 후 (유대 레벨업/스트릭 7일/첫 산책) | 비차단 배너 (닫으면 장기 미노출) | "Keep {pet}'s memories safe anywhere — link an account" (백업 무료) | 📋 Phase D |
| P8 | **크레딧 구매 완료 직후** | 1회 배너 | "Payment complete! Link an account so your credits stay safe if you change phones." 스킵 가능 | 📋 Phase 1 |
| P9 | 서버 잔액 100크레딧 초과 | 모달 승격 (그래도 결제는 차단 안 함) | 계정 연결 강권유 | 📋 Phase 1 |
| P10 | 익명 상태 구매 시 상점 하단 | 상시 고지 (작게) | "Credits are tied to this device until you link an account. Unlinked credits can't be recovered if the app is deleted." — **환불 분쟁 방어의 핵심 문구** | 📋 Phase 1 필수 |

### 5.3 크레딧·상점

| # | 시점 | 형식 | 내용 | 상태 |
|---|---|---|---|---|
| P11 | 잔액 부족 | 시트 | "지금은 부족해요 → 무료로 모으는 법(산책/스트릭) 먼저 → 충전 옵션" 순서 고정. "펫이 슬퍼해요"류 금지 | 📋 |
| P12 | 상점 진입 | — | 크레딧으로 살 수 있는 것 전체 목록 명시 (Apple 3.1.1 소모성 명세 요건) | 📋 |
| P13 | 첫 결제 시 | 1회 고지 | 미성년 보호: "If you're under 18, please purchase with a guardian." OS 결제 다이얼로그에 위임, 자체 원탭 결제 금지 | 📋 |
| P14 | 크레딧 지급 시 (플레이 획득 = 유대 마일스톤 L5·L10/산책 도감 완성 시 bonusCredits) | 펫 축하 연출 | "벌었다"를 기쁨으로 — bondRewards celebration 패턴 재사용 | 📋 |
| — | 금지 사항 | — | 홈 화면 상시 상점 배너 금지 · 소비 화면에 현금 환산액 병기 금지 · 코어 케어 버튼에 크레딧 아이콘/잠금 노출 금지 | 원칙 |

### 5.4 환불 정책

**스토어 구조 (개발자가 통제 못 하는 부분):**
- **Apple**: 유저가 reportaproblem.apple.com 으로 직접 신청, 애플이 재량 승인. 개발자는 직접 환불 불가. App Store Server Notification의 `REFUND` 이벤트를 수신해 대응
- **Google**: Play Console에서 개발자 직접 환불 가능 + Voided Purchases API로 환불 감지

**앱 정책 (우리가 정하는 부분):**
1. **생성 실패 시 크레딧 자동 환불** — 안전성/품질 게이트 실패 포함, 유저 잘못이 아니므로 즉시 (✅ Edge Function `refund_generation_quota` 구현됨)
2. **결과 불만족** — 결과물이 제공된 생성은 원칙적 환불 불가(소모성 디지털 재화). 대신 굿윌: "Not quite right?" 경로에서 1회 무료 재생성 쿠폰 제공 (환불 요청을 재시도로 전환하는 게 만족도·비용 모두 우위)
3. **스토어 환불 발생 시 클로백** — `REFUND`/Voided 수신 → `credit_ledger`에 음수 delta 기록, 잔액 차감(최저 0 클램프). 이미 소비했으면 잔액만 0으로 — 계정 정지 같은 징벌 금지(힐링 톤), 단 반복 악용(구매→소비→환불 3회+)은 신규 구매 차단
4. **환불 반영 시 안내** — "Your refund was processed. {n} credits were removed." 사무적·중립 톤, 사과도 비난도 없이
5. **미사용 크레딧의 앱 삭제 소실** — P10 고지로 방어. 약관에 명문화
6. **구독(Plus, Phase 3)** — 해지는 OS 구독 관리로 안내. 해지 후 기수령 월 크레딧은 회수 안 함

### 5.5 채팅 (프리미엄 채팅 활성화 전 필수)

| # | 항목 | 내용 |
|---|---|---|
| P15 | 위기(자해 등) 감지 시 | 거절(422)로 튕기지 말고 위기 자원 안내로 응대: 미국 988 Lifeline, 국제 findahelpline.com. **정신건강 전문가 검수 후에만 채팅 출시** (백로그 필수 항목) |
| P16 | 채팅 첫 진입 | "This is a playful companion, not a therapist or medical advice." 1회 고지 |
| P17 | AI 고지 | 응답이 AI 생성임을 첫 진입 시 명시 (해외 규제 추세 대응) |

### 5.6 법적·스토어 준비물 (해외 타겟 기준)

- **개인정보처리방침** (필수 갱신): 사진의 제3자 처리(OpenAI) 명시 · 생성 완료 시 원본 자동 삭제 · 보관 기간 · GDPR/CCPA 삭제권 — 인앱 삭제 경로(설정 → 데이터 삭제, 기존 privacy 삭제 플로우 재사용) · 익명 식별자 사용
- **Apple Privacy 라벨**: Photos(User Content) · Identifiers(익명 uid) · Purchases. 푸시는 로컬 알림이라 트래킹 아님
- **이용약관**: 소모성 크레딧 정의, 미연동 계정 소실 조항(P10), 환불 정책(5.4), 연령(4+, 가챠 없음)
- **지원 채널**: 지원 이메일 + 인앱 "Report issue" (✅ 구현, /support 라우팅)
- **OpenAI 지출 캡**: platform.openai.com 월 한도 설정 — 남용 시 서비스가 멈추게 (돈이 새는 것보다 안전)
- **남용 방어**: 익명 재설치 무한 무료 생성 → Edge rate-limit + 무료 셋 원가 최소화($0.13)로 감내, 임계 초과 시 유료 생성에만 계정 요구

## 6. 운영 체크리스트 (출시 전 최종)

- [~] Supabase 프로젝트 + secrets + functions deploy — 원격 migration history 0001–0013 확인. `0014`–`0015` push와 현재 `chat-turn` deploy/행동 검증 필요
- [ ] **⚠️ 출시 전 필수: generation_quota.free_limit을 100(개발용) → 1로 되돌리기** (2026-07-03 QA 편의로 상향한 상태)
- [ ] **⚠️ 출시 전 필수: `GENERATION_TEST_STATES` env 미설정 확인** (`generate-avatar` 함수, 설정 시 모든 생성 잡의 표정 수가 강제로 축소됨)
- [ ] **⚠️ 출시 전 필수: `GENERATION_DRY_RUN`/`GENERATION_DRY_RUN_DELAY_MS` env 미설정 확인** (`generate-avatar` 함수, `GENERATION_DRY_RUN=true`면 `OPENAI_API_KEY` 미설정 시 실제 생성 없이 더미 이미지를 반환 — 이 두 env는 Supabase Edge Function 배포 설정에만 존재하므로 `scripts/validate-release-config.mjs`(Node, 로컬/CI 프로세스 env만 검증) 범위 밖. Supabase 대시보드에서 함수 시크릿 목록을 직접 확인할 것)
- [ ] **⚠️ 출시 전 필수: 개발용 상점 언락(dev 지갑 9999) 꺼짐 확인** — `EXPO_PUBLIC_TINY_PET_DEV_UNLOCK_STORE`가 production에서 미설정/false인지 확인 (`TerrariumSessionProvider.tsx`의 `isDevelopmentStoreUnlockEnabled`; NODE_ENV=production이면 자동 off). 개발 중 dev 지갑으로 구매한 세션 저장분은 잔액이 부풀어 있으므로 실경제 QA는 리셋 후 진행 (`scripts/validate-release-config.mjs`가 production 검증에서 `true`면 실패 처리하도록 가드 추가됨)
- [x] **표정 팩 서버 크레딧 원장(Phase 1a+1b) — 2026-07-07 완료·배포됨**: `generate-avatar`가 표정 팩 요청을 잡 생성 전 `consume_credits`로 서버 선차감(잔액 부족 시 402), 실패 시 `refund_credits`로 자동 환불. requested_states dedup/상한(6개) + rate limit fail-closed는 계속 보조 방어로 유지. 남은 것은 P1c(클라 서버잔액 동기화)뿐 — 서버 보안 구멍 자체는 닫힘
- [x] **서버 측 데이터 삭제 경로 (`delete-account` Edge Function) — 2026-07-08 완료·배포됨**: 인증된 유저의 `pet-media` 스토리지(`original-photos/{userId}/`, `avatars/{userId}/` 전체 재귀 삭제) + `admin.auth.admin.deleteUser`로 익명 auth 유저 삭제 — `generation_jobs`/`generated_assets`/`generation_quota`/`generation_rate_limits`/`credit_wallets`/`credit_ledger`/`pet_slots` 전 테이블이 `user_id ... REFERENCES auth.users(id) ON DELETE CASCADE`라 auth 삭제 한 번으로 cascade됨(마이그레이션 0001/0002/0004/0005 확인). 부분 실패 내성(스토리지 실패해도 계속 진행, 항상 200 + 삭제 요약). 클라이언트: Settings "Delete pet data"가 Supabase 세션이 있을 때 이 함수를 호출하고, 성공/미인증(이미 삭제됨) 시에만 로컬 Supabase 세션도 sign-out, 그 외 실패는 세션을 유지해 나중에 Settings에서 재시도 가능 — 로컬 리셋 자체는 서버 삭제 성패와 무관하게 항상 진행. `docs/legal/privacy-policy.md` §8 / `PrivacyScreen.tsx` 갱신 완료(문의 요청 → 앱 내 직접 삭제로 업그레이드)
- [ ] 실사진 E2E 1왕복 (업로드→생성→표정 3종→signed URL 렌더)
- [ ] 실기기 QA: 푸시 권한/알림 표시, 온보딩 5화면, 생성 90초 UX
- [ ] OpenAI 지출 한도 설정
- [ ] 개인정보처리방침/약관 URL 발행 (HTTPS) + 인앱 링크 연결
- [ ] App Privacy 라벨 작성
- [ ] P2, P4, P11~P13 팝업 구현 확인
- [ ] 스토어 스크린샷/설명 (기존 store-listing-draft.md 갱신)
- [x] **관측성 (2026-07-07 완료)**: 로컬 ErrorBoundary(`apps/mobile/src/shared/errors/ErrorBoundary.tsx`, 앱 루트 `app/_layout.tsx`에 배선) + reporter 추상화(`apps/mobile/src/shared/errors/reporter.ts`, `__DEV__` 콘솔 + AsyncStorage 링버퍼 `mongchi.errorLog.v1` 최근 20개) + 전역 JS 에러/unhandledrejection 훅(`globalErrorHooks.ts`, 기존 핸들러 체인 보존) + Settings 화면 `__DEV__` 진단 섹션(에러 로그 공유/삭제). 네이티브 모듈 미추가 → dev client 재빌드 불요. **Sentry(@sentry/react-native) 실연동은 별도 작업으로 대기 — OTA/사운드/위젯 등 다음 네이티브 재빌드에 묶어서 진행** (reporter 인터페이스가 어댑터 교체 지점).
