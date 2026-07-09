# 채팅 라이브 이식 + 대화 기억(B안: 요약 압축 하이브리드) 정밀 구현 설계서

작성: 2026-07-08 · 대상: 후속 구현 에이전트가 그대로 실행할 수 있는 설계서 · 성격: 읽기 전용 분석의 산출물(코드 미수정)

이 문서는 "services/api(휴면·폐기 경로)에만 존재하는 LLM 프리미엄 채팅"을 라이브 Supabase-only
아키텍처(Edge Function + migrations + credit_wallets 원장 + 모바일 functions.invoke)로 이식하고,
장기 대화 연속성을 **요약 압축 하이브리드(B안)**로 구현하는 것을 목표로 한다.

모든 판단은 실측 코드 라인에 근거한다. 인용 표기: `파일:라인`.

---

## 0. 실측 요약 (근거 라인)

| 자산 | 위치 | 상태 |
|---|---|---|
| LLM 프리미엄 채팅 프로바이더 | `services/api/src/premiumChatProvider.ts` (452줄) | 완성. 단, Node/서버 경로 — 라이브에 미배포 |
| 입력/출력 모더레이션(위기·전문가조언) | `services/api/src/premiumChatModeration.ts` (151줄) | 완성. 단, 위기 시 **422 하드 거절** → P15 위반 |
| 대화 저장소 | `services/api/src/postgresChatRepository.ts` (427줄) | 완성. 단, 라이브 migrations에 대화 테이블 **없음** |
| 정책(컨텍스트/보존/레이트) | `services/api/src/premiumChatPolicy.ts` | 컨텍스트 16, 보존 30일, 레이트 10/60s |
| 턴 조립 로직(참조 구현) | `services/api/src/postgresApiService.ts:2210-2370` | 이식 대상 흐름의 정본 |
| 크레딧 서버 원장 | `supabase/migrations/0004_credit_ledger.sql` | 배포됨. `consume_credits`/`refund_credits`/`grant_credits` RPC |
| Edge Function 패턴(정본) | `supabase/functions/generate-avatar/index.ts`, `.../delete-account/index.ts` | 배포됨. Deno.serve + authClient/admin + DRY_RUN |
| 라이브 대화 테이블 | `supabase/migrations/` (0001~0005) | **없음** — 신규 0006 필요 |
| 채팅 Edge Function | `supabase/functions/` | **없음**(generate-avatar, delete-account만) |
| 모바일 채팅 UI/게이트 | `apps/mobile/src/features/chat/ChatGateScreen.tsx`, `chatGatePresentation.ts` | 완성. 티켓 pip·크레딧·잠금 카피 |
| 무료 "기억하는 인사" | `packages/shared/src/domain/chatGreeting.ts` | 완성. 로컬 결정론, 서버 불필요 |
| 채팅 기억 컨텍스트 | `packages/shared/src/api/mobileContracts.ts:306-321` (`ChatMemoryContext`) | 완성. 클라에서 프롬프트용으로 준비 |
| 클라 세션 어댑터 | `apps/mobile/src/features/session/apiPremiumChatSession.ts` | HTTP 기반(services/api) — 교체 대상 |
| 티켓/크레딧 진실원 | `packages/shared/src/domain/wallet.ts`, `careStreak.ts:3`(`DAILY_FREE_CHAT_TICKETS=3`) | 클라 로컬 shape. 서버 `credit_wallets`와 drift |
| Supabase 클라 팩토리 | `apps/mobile/src/features/session/supabaseClient.ts` | `getSupabaseClient()` 메모이즈, anon key |

**핵심 드리프트 경고 (리스크 §9-5의 근거):** `wallet.ts`의 `CreditWallet`은 `{ credits, bonusCredits,
freeChatTickets }`(클라 로컬)인데, 서버 `credit_wallets`(`0004`)는 `{ balance }` 하나뿐이다. `freeChatTickets`
와 `bonusCredits`는 **서버에 존재하지 않는다**. 라이브에서는 티켓은 로컬 진실, 유료 턴만 서버 `balance` 차감으로
분리해야 한다(§4).

---

## 1. 아키텍처 결정 — 채팅 Edge Function 구성

### 1.1 결론: 단일 함수 `chat-turn` (find-or-create + 턴 처리)

기존 3단계 계약(`createPremiumConversation` → `getConversationThread` → `sendPremiumConversationMessage`,
`mobileApiClient.ts:294-300`)을 라이브에서는 **쓰기 경로 1개 Edge Function `chat-turn`**으로 통합한다.
읽기(스레드 이력)는 별도 함수 없이 **RLS select-own 직접 조회**로 처리한다(generate-avatar 폴링이
`generation_jobs`를 RLS로 직접 읽는 것과 동일 패턴).

`chat-turn` 요청 바디:
```
{ petId: string, conversationId?: string, text: string,
  disclosureAccepted: boolean, requestId: string,
  memoryContext?: ChatMemoryContext, careContext?: {satiety,energy,...,daysAway} }
```
동작: `conversationId`가 없으면 해당 pet의 open premium 대화를 find-or-create → 입력 모더레이션 →
컨텍스트(요약+최근 8) 조립 → OpenAI 호출 → 출력 모더레이션 → **유료 턴이면** `consume_credits` →
user/pet 메시지 2건 저장 → (조건 충족 시) 요약 갱신 → `{ conversation, userMessage, petMessage,
safetyFlags, serverBalance, chargedCredit }` 반환.

### 1.2 왜 1개인가 (vs 2개: start-conversation + send-turn)

| 기준 | 1개 `chat-turn` (권고) | 2개 `start-conversation` + `send-turn` |
|---|---|---|
| 대화 생성 | 첫 턴에 find-or-create(빈 INSERT, OpenAI 미호출) | 별도 함수 = 추가 콜드스타트 + 왕복, 순수 DB insert에 함수 하나 낭비 |
| 무료 인사 | `chatGreeting.ts` 로컬 — 서버 호출 자체가 불필요, 스레드 오픈에 서버 왕복 안 씀 | start 함수가 사실상 하는 일이 없음 |
| 클라 복잡도 | invoke 1회 + 실패 재시도 단순 | 2-phase(생성 실패 시 부분 상태) 처리 필요 |
| 멱등성 | `requestId` 하나로 대화생성+과금+메시지 저장 전부 커버 | 두 함수에 각각 멱등 키 관리 |
| 이식 충실도 | `postgresApiService.ts`의 `sendPremiumConversationMessage`가 이미 "대화 찾기+모더레이션+프로바이더+과금+저장"을 한 함수에 담음 — 1:1 대응 | 인위적 분할 |

**대안(2개)의 유일한 장점**은 기존 모바일 계약(`apiPremiumChatSession.ts`의 start/send 2단계)과 1:1 매핑되어
클라 리팩터가 적다는 점뿐이다. 그러나 `chat-turn` 하나로도 `startApiPremiumChatThread`(생성)와
`sendApiPremiumChatTurn`(전송)을 얇은 어댑터로 감쌀 수 있으므로(§6) 이 장점은 상쇄된다.

### 1.3 premiumChatProvider.ts(452줄, Node) → Deno Edge 이식 방법

generate-avatar가 `@mongchi/shared`를 **전혀 import하지 않고** 필요한 타입을 인라인한다는 사실이 정본 선례다
(generate-avatar/index.ts는 `npm:@supabase/supabase-js@2`와 `./chromakey.ts`만 import). 따라서:

1. **의존성 제거**: `import type { ... } from "@mongchi/shared"`(provider 1행), `import type { ApiRuntimeConfig }
   from "./apiRuntimeConfig"`(3행) 전부 삭제. 필요한 최소 타입(`PetProfile` 부분집합, `ConversationMessage`
   `{sender,text,createdAt}`, care band 등)을 `chat-turn/chatProvider.ts` 상단에 인라인 정의한다.
2. **fetch 주입 추상화 제거**: `OpenAiPremiumChatFetch`(provider 39-49), `getGlobalFetch`(137-145)는
   테스트 주입용. Deno에서는 전역 `fetch` 사용 + generate-avatar의 `fetchWithRetry`/`fetchWithTimeout`
   (`generate-avatar/index.ts:487-512`, `AbortSignal.timeout(OPENAI_CALL_TIMEOUT_MS)`)을 재사용한다.
3. **그대로 이식할 핵심**(라인 근거):
   - 모델: `defaultPremiumChatModel = "gpt-5.5"`(provider 96) → `Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-5.5"`
   - 토큰 상한: `defaultMaxOutputTokens = 260`(97), `maxReplyTextLength = 280`(98)
   - 시스템 프롬프트: `defaultInstructions`(101-113) 문자열 배열 — **문자 그대로 복사**(힐링 목적/1-3문장/
     진단·위기 금지 지침 포함)
   - 컨텍스트 조립: `buildProviderContext`(272-327) — pet 프로필(id/name/species/personalityTags/
     talkingStyle/favoriteThing/memoryNote), care band(`meterBand`, 291), `recentMessages.slice(-8)`(320),
     `userMessage`. **여기에 B안의 `conversationSummary`를 추가 주입**(§3.4).
   - Responses API 호출: `POST {baseUrl}/responses`, `text.format = json_schema strict`
     (`premiumChatReplySchema`, 115-135), `store: false`(367), `metadata`(362-366)
   - refusal 처리: `extractOutput`(197-235) → `refusal`이면 `refusalTextForLocale`(261-264) 반환(416-421)
   - 정규화: `normalizeReplyText`(167-179), `normalizeSafetyFlags`(159-165)
4. **로컬 mock**: `createLocalPremiumChatProvider`(371-376)에 해당하는 DRY_RUN 응답을 함수 내부에 둔다.
5. **파일 배치**: generate-avatar가 순수 로직(`chromakey.ts`)과 HTTP(`index.ts`)를 분리해 Deno 테스트를
   가능케 한 선례를 따른다. `chat-turn/`에 `index.ts`(Deno.serve), `chatProvider.ts`(OpenAI 호출·프롬프트),
   `moderation.ts`(위기/전문가 필터), `summary.ts`(요약 프로바이더)를 두어 `deno test`로 npm/HTTP 없이 단위 검증.

### 1.4 CORS/OPTIONS

generate-avatar·delete-account 모두 OPTIONS 핸들러·CORS 헤더가 **없다**(브라우저가 아닌 RN
`functions.invoke` 호출이라 preflight 불필요). `chat-turn`도 동일하게 `jsonResponse`(Content-Type만)
패턴을 따르고 CORS를 추가하지 않는다.

---

## 2. 라이브 대화 스키마 — `supabase/migrations/0006_conversations.sql`

`0001`~`0005` 패턴 준수: `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`, RLS **select-own만**,
쓰기는 Edge Function service_role 또는 SECURITY DEFINER RPC로만.

### 2.1 컬럼 설계 (postgresChatRepository.ts 컬럼과 정렬)

`conversations` (repo `ConversationRow`, `postgresChatRepository.ts:15-25` 기준):
```
id                    UUID PK DEFAULT gen_random_uuid()
user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
pet_id                TEXT                       -- NULL = 첫/유일 펫 (0005 pet_id 모델과 동일: 클라 소유 문자열, pets 테이블 없음)
type                  TEXT NOT NULL DEFAULT 'premium_ai_chat' CHECK (type IN ('premium_ai_chat','support'))
status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','archived','deleted'))
disclosure_accepted_at TIMESTAMPTZ
-- B안 요약(§3): 대화 테이블에 인라인
summary               TEXT                       -- 압축된 장기 요약 (없으면 NULL)
summary_updated_at    TIMESTAMPTZ
summary_msg_count     INTEGER NOT NULL DEFAULT 0 -- 요약이 커버하는 누적 메시지 수(진단/트리거용)
summarized_through    TIMESTAMPTZ                -- 워터마크: 이 시각 이전(이하) 원문은 요약에 반영됨
deleted_at            TIMESTAMPTZ
created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
```
`conversation_messages` (repo `ConversationMessageRow`, `postgresChatRepository.ts:27-34` 기준):
```
id              UUID PK DEFAULT gen_random_uuid()   -- 참고: services/api는 msg_<uuid> 문자열; 라이브는 UUID로 통일
conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE
user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE  -- RLS/삭제 편의를 위해 비정규화(선택). 없으면 conversations JOIN으로 RLS
sender          TEXT NOT NULL CHECK (sender IN ('user','pet_ai','system'))
text            TEXT NOT NULL
safety_flags    JSONB NOT NULL DEFAULT '[]'::jsonb
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```
**멀티펫 대비**: `pet_id TEXT NULL`은 `0005`의 `generation_jobs.pet_id`와 동일한 규약(NULL=첫 펫,
클라가 보내면 그 문자열). FK를 걸 `pets` 테이블이 라이브에 없으므로 FK 없이 문자열로 둔다. 대화-펫 스코프는
find-or-create 시 `(user_id, pet_id, status='open', type)`로 조회(`postgresChatRepository.ts:182-201`의
`listOpenConversationsForPet` 참조).

### 2.2 인덱스 (보존 정책 포함, services/api 0003 정신 계승)

```
conversations_user_pet_open_idx   ON conversations(user_id, pet_id, status)          -- find-or-create
conversation_messages_conv_created_idx ON conversation_messages(conversation_id, created_at)  -- 컨텍스트 조회
conversation_messages_created_idx ON conversation_messages(created_at)               -- 보존 만료 퍼지(30일)
```
보존 퍼지는 `postgresChatRepository.ts:401-426`의 `purgeExpiredMessages`(created_at < cutoff, LIMIT 배치)를
그대로 SQL RPC로 옮긴다(§3.5). 라이브 스케줄러는 pg_cron(Supabase 확장) 또는 스케줄드 Edge Function.

### 2.3 RLS (0001/0004 패턴 그대로)

```
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_select_own ON conversations
  FOR SELECT USING (auth.uid() = user_id AND status <> 'deleted');

-- 메시지에 user_id 비정규화 컬럼을 두면 단순 select-own; 안 두면 conversations JOIN EXISTS
CREATE POLICY conversation_messages_select_own ON conversation_messages
  FOR SELECT USING (auth.uid() = user_id);
```
쓰기 정책 없음 = 모든 INSERT/UPDATE는 `chat-turn`의 service_role로만(0001 주석 137-142와 동일 원칙).
클라 이력 읽기는 이 select-own 정책으로 직접 SELECT.

### 2.4 요약 갱신 RPC (선택, SECURITY DEFINER)

요약 원문 압축 후 워터마크 이하 원문을 즉시 삭제하는 프라이버시-우선 옵션(§3.5)을 원자적으로 하려면
`compact_conversation(p_conversation_id, p_summary, p_through TIMESTAMPTZ)` RPC 하나를 추가한다:
요약/워터마크 UPDATE + `summarized_through` 이하 원문 DELETE를 한 트랜잭션에. Edge는 service_role이라
없이도 되지만, RPC로 두면 원자성과 감사가 명확.

---

## 3. B안 기억 하이브리드 (핵심)

목표: 대화가 길어져도 (a) 비용·토큰을 상한 안에 묶고 (b) 연속성("우리가 지난번에…")을 유지하며 (c) 원문
보존을 최소화(프라이버시).

### 3.1 단기 기억 — 최근 N개 원문 되먹임 (이미 구현된 방식)

`buildProviderContext`가 `recentMessages.slice(-8)`(provider 320)로 최근 8개를 원문 주입. 정책상
컨텍스트 선택은 `selectPremiumChatContextMessages`(policy 63-66)가 `contextMessageLimit=16`(policy 17-22)로
16개를 뽑고, 프로바이더가 다시 8개로 슬라이스한다. 라이브에서도 **최근 8개 원문**을 그대로 유지한다.

### 3.2 장기 기억 — 요약 압축

**트리거**(둘 중 먼저 도달): 
- 워터마크 이후(=아직 요약에 안 들어간) & 최근-8 윈도우보다 오래된 메시지 수 ≥ `SUMMARY_BATCH`(권고 12), 또는
- 스레드 재개 시(마지막 메시지가 `SUMMARY_STALE_MS`, 예 6h 이전) 미요약 원문이 남아 있으면.

**대상**: `[summarized_through, now-최근8윈도우)` 구간의 원문. 즉 "최근 8개는 원문 유지, 그 이전 미반영분을 요약에 병합".

**요약 생성**: `chat-turn/summary.ts`가 별도 OpenAI 호출(짧은 지시 + 기존 summary + 대상 원문 → 갱신된
summary). 
- 모델: `OPENAI_CHAT_SUMMARY_MODEL`(권고 저비용 모델; 미설정 시 채팅 모델 재사용).
- 상한: `max_output_tokens` 200, `text.verbosity: "low"`, `store: false`.
- 프롬프트 원칙(리스크 최소화): "사용자의 정서적 맥락/선호/반복 주제만 3~5문장으로. 민감 개인정보(주소·연락처·
  금융·건강 상세)·자해 관련 원문은 요약에 담지 말 것. 3인칭 관찰 톤." — 프롬프트 인젝션이 요약에 스며들지
  않도록 원문은 데이터로만 전달(지시문과 분리, provider 338-351의 input_text 분리 패턴 준수).

**저장**: `conversations.summary`(단일 컬럼, 병합형). `summary_updated_at`, `summary_msg_count += 반영수`,
`summarized_through = 반영한 마지막 원문의 created_at`.

**주입**: `buildProviderContext`에 `conversationSummary`(있으면) 필드 추가 → 시스템 프롬프트가 최근 8 원문
"이전"의 맥락으로 사용. 지시 한 줄 추가: "conversationSummary는 이 대화의 과거 요약이다. 최근 메시지와
자연스럽게 이으라. 요약을 그대로 낭독하지 말 것."

### 3.3 비용/토큰 효과 (아래 §7에 산식)

요약이 없으면 40턴 스레드는 매 턴 80개 메시지 후보를 되먹여 컨텍스트가 계속 커진다. 하이브리드는
**최근 8 원문 + 요약 1개(~200토큰)**로 상한 고정 → 긴 스레드에서 입력 토큰 약 2.5~3배 절감(§7).

### 3.4 기억 스파인(`memories`)과의 관계 — 분리 유지

- **memories → 채팅 프롬프트**(단방향, 이미 존재): `ChatMemoryContext`(mobileContracts 306-321,
  `recentMemories/favoriteCareAction/favoriteTreatItemId`)가 클라에서 준비되어 프롬프트로 들어간다.
  `chat-turn`은 이 `memoryContext`를 받아 `buildProviderContext`의 pet 프로필 옆에 주입한다.
- **채팅 → memories: 금지(권고)**. 이유 3가지:
  1. 기억 스파인은 UI에 노출되는 **큐레이션된 마일스톤 비트**(`chatGreeting.ts`의 `GREETING_WORTHY_
     MEMORY_TYPES` 8-19)이고, 채팅 요약은 **비공개 대화 연속성**이라 생명주기·톤·노출면이 다르다.
  2. 프라이버시: 대화 내용이 인사 문구(`buildChatGreetingLine`)로 새어 나가면 안 됨.
  3. `memories`는 클라 로컬 도메인(프로토타입 세션)에서 관리 — 서버 요약을 역주입하면 소유권/동기화가 꼬인다.
- 결론: 채팅 요약은 `conversations.summary`(서버·비공개)에만 둔다. 인사·앨범·30일 편지 등 "작은 세계"
  시스템(MEMORY.md `small-world-systems`)은 기존대로 memories로만 구동.

### 3.5 프라이버시 — 원문 최소 보존, 요약 우선

- **원문 보존 하한**: 최근 8 원문(단기 컨텍스트)만 실제로 필요. 그 이전은 요약으로 대체 가능.
- **옵션 A(권고, 프라이버시-우선)**: 요약 병합 성공 시 `summarized_through` 이하 원문을 `compact_conversation`
  RPC로 **즉시 삭제**. 남는 원문 = 최근 8 + 미요약 소량. → 원본 사진 즉시 삭제 원칙(generate-avatar가 첫
  생성 후 원본 삭제)과 일관.
- **옵션 B(보수)**: 원문은 30일 보존 퍼지(`purgeExpiredMessages`)까지 유지하고 요약은 병렬 축적.
  요약 오류 정정 여지는 크나 원문 노출면이 커진다. 환경변수로 A/B 토글(`CHAT_PURGE_SUMMARIZED_RAW`).
- **삭제 연동(delete-account)**: `conversations.user_id`·`conversation_messages.user_id`가
  `auth.users(id) ON DELETE CASCADE`이므로 `admin.auth.admin.deleteUser`(delete-account/index.ts:153)가
  **자동 캐스케이드**로 대화·메시지·요약(요약은 conversations 컬럼이므로 함께)까지 지운다.
  `delete-account/index.ts`의 `CASCADED_TABLES`(62-70)에 `conversations`, `conversation_messages`를
  **추가**(카운트/요약 표기용; 실제 삭제는 캐스케이드가 함). delete-account 모듈 주석의 마이그레이션 목록에
  `0006_conversations.sql` 추가.

---

## 4. 크레딧/티켓 연동

### 4.1 진실원 분리 (드리프트 방지)

- **무료 티켓 = 로컬 진실 유지 가능**. `wallet.ts`의 `freeChatTickets`는 서버 `credit_wallets`에 존재하지
  않는 클라 로컬 개념(`DAILY_FREE_CHAT_TICKETS=3`, `careStreak.ts:3`; 매일 리셋
  `prototypeSession.ts:462`). 하루 3장의 소진·리셋은 **클라에서 계속 관리**한다. 서버는 티켓을 모른다.
- **유료 턴 = 서버 진실**. 티켓이 0일 때의 유료 턴만 서버 `credit_wallets.balance`에서 `consume_credits`로
  차감한다.

### 4.2 흐름 (표정 팩 멱등 패턴 재사용, generate-avatar/index.ts:1607-1627)

클라(`ChatGateScreen`/세션)가 턴을 보낼 때 결제 모드를 `getPremiumChatPaymentPreview`(wallet.ts:82-126)로
판정:
- `plus_pass`(Plus 구독) 또는 `free_ticket`(티켓>0): 클라가 로컬에서 티켓 차감(`spendPremiumChatTurn`,
  wallet.ts:128-173) → `chat-turn` 호출 시 `charge: "free"` 전달. 서버는 **크레딧을 건드리지 않음**.
- `credit`(티켓 0, 크레딧≥cost): `chat-turn` 호출 시 `charge: "credit"` + `requestId`(멱등 키) 전달.

서버 `chat-turn`의 과금 단계(표정 팩과 동일 구조):
```
if (charge === "credit") {
  const requestId = body.requestId?.trim() || crypto.randomUUID();  // generate-avatar:1608-1609
  const { data: newBalance, error } = await admin.rpc("consume_credits", {
    p_user: userId, p_cost: CHAT_TURN_CREDIT_COST /*=1*/,
    p_reason: "consume_premium_chat", p_ref_type: "credit_request", p_ref_id: requestId
  });                                                                // generate-avatar:1611-1617
  if (error) return json({ error: "credit_check_failed" }, 500);
  if (newBalance === -1) return json({ error: "insufficient_credits" }, 402);  // 1623-1625
}
```
- **과금 순서(중요)**: 표정 팩은 *생성 전* 선차감이지만, 채팅은 LLM 실패 시 환불 왕복을 피하려 **차감 시점을
  프로바이더 성공 직후·메시지 저장 직전**에 둔다(`postgresApiService.ts:2344-2351`가 "프로바이더 성공 후
  spend"인 것과 동일). 프로바이더 실패는 402/503로 빠지고 과금이 없어 환불이 불필요. 단, `consume_credits`
  자체는 멱등(0004 idempotency idx 74-76)이라 재시도해도 이중과금 없음.
- **`consume_premium_chat` reason 신설**: `0004`의 reason 주석(57-59)에 `consume_premium_chat` 추가
  (문서/주석 갱신만; enum 제약이 아니라 TEXT라 마이그레이션 불필요). refund가 필요하면
  `refund_credits(p_user,'credit_request',requestId)`(0004:165-209)가 `consume_%` 어떤 것이든 역추적하므로
  그대로 동작.
- **응답의 지갑**: 서버는 `balance`(정수)만 안다. 클라는 응답의 `serverBalance`로 자신의 `wallet.credits`를
  보정(reconcile)하고, 티켓/보너스는 로컬 유지. 계약 필드는 §6.2.

### 4.3 이중 소비 방지

동일 `requestId` 재시도(네트워크 재시도/더블탭)는 `consume_credits`의 unique idx(0004:74-76)로 no-op.
클라는 **한 턴당 requestId를 한 번만 생성해 재시도에도 재사용**한다
(supabaseGenerationSession 테스트 1059 "retries with the same request_id"와 동일 원칙).

---

## 5. 위기 안전 카피 (출시 전 필수 · 전문가 검수 게이트)

### 5.1 실측: 현재 로직은 P15를 위반한다 (반드시 변경)

`premiumChatModeration.ts:85-92`의 `moderatePremiumChatInput`은 자해 감지 시 **HTTP 422 하드 거절**
("This message needs immediate human support, not pet chat.")로 튕긴다. 그러나 `launch-plan.md:265`(P15)는
명시적으로 **"거절(422)로 튕기지 말고 위기 자원 안내로 응대: 미국 988 Lifeline, 국제 findahelpline.com"**을
요구한다. 또한 기존 `crisisFallbackText`(moderation 54-57)에는 **988/findahelpline.com 자원이 없다.**
→ 라이브에서는 이 동작을 반드시 교체한다.

### 5.2 감지 위치 — 3-레이어 (LLM 응답 전 + 후 + 프롬프트)

1. **LLM 전 (입력 정규식, 빠름·좁게)**: `selfHarmPattern`(moderation 32) 유지하되, **422 대신 위기-자원
   응답을 즉시 반환**한다. 이 응답은:
   - 티켓/크레딧 **미차감**(§4 과금 단계를 건너뜀).
   - `sender: "system"` 메시지로 저장(플래그 `crisis_referral`), pet_ai 톤과 구분.
   - 위기 자원 카피(§5.3) 반환. LLM 호출 자체를 하지 않음 → 비용 0, 오응답 위험 0.
2. **LLM 후 (출력 필터, 백스톱)**: `moderatePremiumChatProviderReply`(moderation 110-150)의
   `crisis_escalation` 경로 유지 — 프로바이더가 위기성 응답을 내면 `crisisFallbackText`로 치환.
   이 `crisisFallbackText`를 §5.3 카피로 **교체**한다.
3. **프롬프트 지침(이미 존재)**: `defaultInstructions`(provider 107,110-111) "advice 대신 곁에 있기,
   의료·위기·자해 가이던스 금지"를 유지.

### 5.3 위기 자원 카피 (DRAFT — 전문가 검수 전까지 확정 아님)

로케일 인지(`refusalTextForLocale`(provider 261-264)와 동일 분기 패턴). **아래는 초안이며, 정신건강
전문가 검수 후에만 문구를 확정·출시한다(§5.5).**

영어(기본, US 988 + 국제):
```
I'm really glad you told me, and I want you to be safe. I'm a little pet in a game — not a
doctor or a crisis service — so I can't help with this the way you deserve. If you might be in
danger right now, please reach a real person who can help:
• US: call or text 988 (Suicide & Crisis Lifeline), or call 911 for an emergency.
• Anywhere: find a local helpline at findahelpline.com.
I'll still be right here in our little garden when you're ready.
```
한국어(로케일 ko):
```
말해줘서 정말 고마워. 무엇보다 네가 안전했으면 좋겠어. 나는 게임 속 작은 친구라, 의사도 위기 상담
서비스도 아니야. 지금 위험할 수 있다면 도와줄 수 있는 사람에게 꼭 연락해줘:
• 한국: 자살예방상담전화, 정신건강 위기상담 등 (번호는 전문가 검수로 확정 — 예: 109 / 1393, 검증 필요)
• 어디서든: findahelpline.com 에서 가까운 상담처를 찾을 수 있어.
준비되면 우리 작은 정원에서 언제든 다시 이야기하자.
```
**필수 고지(카피에 포함):** 이 앱은 의료·정신건강 서비스가 아니며 위기 대응을 대신할 수 없음.

### 5.4 과잉 트리거 방지 (일상 대화 보호)

- 위기 경로는 `selfHarmPattern`(kill myself/suicide/self-harm/end my life/harm myself/want to die,
  moderation 32)처럼 **좁은 구절**만 매칭. 일반적 슬픔("오늘 너무 힘들었어")은 위기가 아니라 **정상 힐링
  대화**로 흘려보낸다(프롬프트가 공감으로 응대).
- `professionalAdvicePattern`(moderation 33) 경로는 위기와 분리해 유지(422→차감 없는 부드러운 경계 응답으로
  완화 권고, 단 이는 위기만큼 급하지 않음).
- 지역: 출시 최소치는 **US 988 + findahelpline.com**(P15가 명시). 로케일 확장(한국·기타)은 번호 검증 +
  지역 전문가 검수 후.

### 5.5 전문가 검수 게이트 (우리가 최종 확정 못 함)

`launch-plan.md:172,265`는 **"정신건강 전문가 검수 후에만 채팅 출시"**를 필수로 못박는다. 따라서:
- 위기 카피(§5.3)·감지 임계·자원 목록은 **초안 상태**로 두고, 정신건강 전문가 리뷰를 **웨이브 C4의 출시
  게이트**로 명시한다(§8). 이 설계서는 문구를 확정하지 않는다.
- 검수 항목: (a) 문구 톤/책임 한계, (b) 감지 민감도(미탐/과탐), (c) 지역별 자원 정확성, (d) 로그·에스컬레이션
  정책. 검수 완료 전에는 프로덕션에서 채팅 유료화/무제한 노출 금지(무료 인사·프로토타입 대화만 허용).

---

## 6. 모바일 클라 전환

### 6.1 트랜스포트 교체 지점

현재 `ChatGateScreen.tsx`는 `startApiPremiumChatThread`/`sendApiPremiumChatTurn`(`apiPremiumChatSession.ts`)를
`apiRuntime.client`(services/api HTTP, `mobileApiClient.ts:294-300`)로 호출한다. 이 서버는 프로덕션에 없어
응답이 없다. 교체:

- **신규 `supabasePremiumChatSession.ts`**(supabaseGenerationSession.ts 선례): `getSupabaseClient()`
  (supabaseClient.ts:31) →  `ensureSupabaseSession`(익명 로그인, supabaseGenerationSession.ts:101-108) →
  `client.functions.invoke("chat-turn", { body })`. 오류는 `invoked.error.context.status`로 402/429 분기
  (supabaseGenerationSession.ts:306-364의 `readInvokeErrorBody` 패턴 재사용): 402
  `insufficient_credits`→크레딧 부족 카피, 429→레이트, 그 외→재시도 가능 오류.
- **어댑터 유지**: `startApiPremiumChatThread`/`sendApiPremiumChatTurn` 시그니처를 유지하되 내부를
  `supabasePremiumChatSession`으로 라우팅하거나, `ChatGateScreen`이 런타임 모드에 따라 둘 중 하나를 고르게
  한다. `apiReady` 판정(`ChatGateScreen.tsx:126` `runtimeMode === "api" && apiRuntime.mode === "api"`)에
  Supabase 모드(`getSupabaseClient() != null`)를 **추가**한다.

### 6.2 계약(shared) 확장 — `mobileContracts.ts`

`chat-turn` 응답을 위해 신규 타입을 추가(기존 `SendConversationMessageResponse`(mobileContracts 351-357)는
`wallet: CreditWallet`/`walletSpend`를 요구하나, 라이브 서버는 `balance`만 안다 → 라이브 전용 응답 분리):
```
export interface ChatTurnRequest {
  petId: PetId; conversationId?: string; text: string;
  disclosureAccepted: boolean; requestId: string;
  charge: "free" | "credit";           // free=티켓/Plus(로컬 차감), credit=서버 차감
  memoryContext?: ChatMemoryContext; careContext?: ChatCareContext;
}
export interface ChatTurnResponse {
  conversation: Conversation;
  userMessage: ConversationMessage; petMessage: ConversationMessage;
  safetyFlags: string[];
  serverBalance: number;               // credit_wallets.balance (charge='credit'일 때만 변화)
  chargedCredit: number;               // 이번 턴 서버 차감 크레딧(0 또는 CHAT_TURN_CREDIT_COST)
  crisisReferral?: boolean;            // §5.2-1 위기 자원 응답이면 true
}
```
클라는 `charge==='free'`면 로컬 `spendPremiumChatTurn`(wallet.ts:128), `charge==='credit'`면 응답
`serverBalance`로 `wallet.credits`를 보정.

### 6.3 보존해야 할 것 (그대로 재사용)

- **무료 인사**(`chatGreeting.ts` / `getShortChatReplyText`(chatGatePresentation 138)): 서버 무관, 로컬
  결정론. 변경 없음.
- **티켓 UI**(`getChatTicketPipsPresentation`(chatGatePresentation 69), `getPremiumChatAccessPresentation`
  (246)): `freeChatTickets`·`creditBalance` 그대로. 변경 없음.
- **`buildChatMemoryContext`**: 클라에서 준비 → `chat-turn` body의 `memoryContext`로 전달(신규 배선).
- **disclosure**(`premiumChatGate.disclosureText`, ChatGateScreen 402): 첫 턴 `disclosureAccepted: true`로
  전달, 서버가 `disclosure_accepted_at` 기록.
- **대화 시작 문구**(`getChatConversationStarters`, chatGatePresentation 207): 변경 없음.

---

## 7. 비용 통제

### 7.1 DRY_RUN / mock (dev) — 실호출 금지 원칙

generate-avatar의 이중 게이트(`GENERATION_DRY_RUN=true && !OPENAI_API_KEY`, index.ts:208)를 그대로 차용:
`CHAT_DRY_RUN=true && !OPENAI_API_KEY`일 때만 OpenAI를 호출하지 않고 mock 응답(provider의
`createLocalPremiumChatProvider` 상당, provider 371-376)을 반환. **실 OpenAI 키가 있으면 DRY_RUN이 강제
비활성** → dev 실수로 과금될 수 없음.
- **테스트 원칙**: vitest/`deno test`는 실 OpenAI를 절대 호출하지 않는다. 프로바이더는 fetch 주입/DRY_RUN으로
  단위 검증(provider의 `OpenAiPremiumChatFetch` 주입 선례). CI는 `CHAT_DRY_RUN=true`.

### 7.2 토큰 상한 + 요약 절감 산식

턴당 입력 토큰(개략): 시스템 지시 ~250 + pet 프로필 ~80 + care band ~40 + 최근 8 원문 ~320(8×40) +
요약 ~200 + 유저 메시지 ~60 ≈ **~950 토큰**. 출력: 상한 260, 실제 1-3문장 ~60~80.

- **요약 없음(naive)**: N턴 스레드는 매 턴 최대 2N개 메시지를 되먹임. N=40이면 원문만 ~3,200토큰
  (80메시지×40) + 지시/프로필 ~370 ≈ **~3,570토큰/턴**, 스레드 후반일수록 선형 증가.
- **하이브리드(요약)**: 최근 8 원문(~320) + 요약(~200)로 상한 고정 ≈ **~950토큰/턴**(N 무관).
- 절감: 40턴 시점 입력 **~3,570 → ~950 ≈ 3.75배 절감**. 요약 자체 비용은 `SUMMARY_BATCH=12`마다 1회
  (입력 ~500 + 출력 ~200)라 12턴에 1회 → 턴당 상각 ~58토큰. 순절감 확정.

### 7.3 달러 추정 (가격은 구현 시점 OpenAI 공식가로 재확인 필수)

per-turn 비용 = (입력토큰/1e6)×입력단가 + (출력토큰/1e6)×출력단가.
`gpt-5.5` 실단가는 이 문서에서 확정 불가(반드시 확인). **예시**로 입력 $1.25/1M·출력 $10/1M(5급 클래스 가정)
대입:
```
하이브리드 채팅 턴: (950/1e6)×1.25 + (80/1e6)×10 = $0.00119 + $0.00080 = ~$0.0020 / 턴
요약(12턴당 1회):   (500/1e6)×1.25 + (200/1e6)×10 = $0.00063 + $0.00200 = ~$0.0026 → 턴당 상각 ~$0.00022
→ 실질 턴당 ~$0.0022
naive(40턴 시점): (3570/1e6)×1.25 + (80/1e6)×10 = ~$0.00446 + $0.0008 = ~$0.0053 / 턴 (후반 계속 증가)
```
- 무료 3티켓/일 worst-case 비용 ≈ 3×$0.0022 ≈ **$0.0066/일/활성유저**. 유료 턴은 1크레딧/턴으로 과금하므로
  크레딧 단가가 이 원가를 수배 커버(BM 마진 확보).
- **상한 방어**: `max_output_tokens=260`(하드), 입력은 요약으로 상한, 입력 유저 메시지 500자 제한
  (moderation 76-83), 레이트 10/60s(policy 17). 요약 실패는 best-effort(요약 없이 진행)로 채팅을 막지 않음.

---

## 8. 웨이브 분해 (1인 개발, 각 그린 랜드)

| 웨이브 | 범위 | 규모 | DoD(그린) |
|---|---|---|---|
| **C1** 스키마 + `chat-turn` 이식(서버, DRY_RUN) | `0006_conversations.sql`; `chat-turn/{index,chatProvider,moderation}.ts`; DRY_RUN·find-or-create·모더레이션·메시지 저장. OpenAI 실호출 없음 | 中(2~3d) | `deno test`(chatProvider/moderation) 그린; DRY_RUN invoke가 mock 턴 저장; RLS select-own 확인 |
| **C2** 클라 전환 + 티켓/크레딧 | `supabasePremiumChatSession.ts`; `ChatTurnRequest/Response` 계약; `ChatGateScreen` apiReady 확장; `charge='free'` 로컬 차감 + `charge='credit'` `consume_credits`(멱등) | 中(2~3d) | vitest(세션 어댑터·과금 분기) 그린; `tsc -p apps/mobile` 그린; DRY_RUN E2E 대화 성립 |
| **C3** 장기 요약 하이브리드 | `chat-turn/summary.ts`; `compact_conversation` RPC(옵션 A); `buildProviderContext`에 summary 주입; 트리거/워터마크/원문 퍼지 | 中(2~3d) | `deno test`(요약 트리거·워터마크·프라이버시 삭제) 그린; 긴 스레드 토큰 상한 유지 확인 |
| **C4** 위기 안전(전문가 검수 게이트) | 입력 422→위기-자원 응답 교체; `crisisFallbackText` 카피 교체(§5.3); 로케일 분기; delete-account CASCADED_TABLES에 대화 추가; 보존 퍼지 스케줄 | 中(2d) + **검수 대기** | 감지 단위테스트(미탐/과탐) 그린; **정신건강 전문가 검수 완료 = 출시 게이트**(코드로 확정 불가) |

병렬화: C1↔(C4의 카피 초안)은 독립. C3는 C1 이후. C2는 C1의 계약 확정 후.

---

## 9. 리스크 톱5

1. **프롬프트 인젝션**: 유저 메시지가 시스템 지시를 덮어쓰려는 시도. 완화(이미/유지): 컨텍스트를 지시문과
   분리해 데이터로만 전달(provider 338-351 input_text 분리), `store:false`, JSON 스키마 strict
   (provider 115-135), 출력 정규화·플래그(moderation 42-52). **요약 경로 신규 노출면**: 원문이 요약
   프롬프트에 데이터로 들어가므로 동일하게 지시/데이터 분리 + "원문 내 지시 무시" 명령을 요약 프롬프트에 명시.
2. **위기 오/미탐지**: 좁은 정규식은 미탐(오탈자·완곡어) 위험, 넓히면 과탐으로 일상 대화 방해. 완화: 3-레이어
   (입력+출력+프롬프트, §5.2), 좁은 구절 기본 + 국제 자원 항상 제공, **전문가 검수로 임계 조정**(§5.5).
   최종 확정은 우리 권한 밖 — C4 게이트.
3. **비용 폭주**: 긴 스레드/봇 남용. 완화: 요약으로 입력 상한(§7.2), `max_output_tokens=260`, 유저 500자
   제한, 레이트 10/60s, DRY_RUN 이중 게이트, 유료 턴 `consume_credits` 선차감으로 무한 무료 호출 차단.
4. **대화 프라이버시**: 원문 장기 보존·계정 삭제 누락. 완화: 요약-우선 + 원문 즉시 삭제(옵션 A, §3.5),
   30일 보존 퍼지, `ON DELETE CASCADE`로 delete-account 자동 삭제(§3.5). **주의(비가역)**: 옵션 A의
   `compact_conversation` 원문 DELETE는 되돌릴 수 없음 — 요약 검증 후 삭제 순서 보장 필요.
5. **services/api 코드와의 중복/드리프트**: 이식하면 provider/moderation/policy가 두 벌(services/api Node +
   Edge Deno)로 갈린다. 완화: 라이브를 **정본**으로 선언하고 services/api 채팅 경로는 동결/폐기 표기;
   공통 상수(모델·토큰·프롬프트·위기 카피)는 `chat-turn` 내부 단일 출처로 두고 값 변경 시 두 곳 동기화를
   **금지**(services/api는 더 이상 수정하지 않음). `wallet.ts` 티켓/크레딧 드리프트(§0)는 §4.1의 진실원 분리로
   차단.

---

## 10. 구현 플랜 (후속 에이전트가 그대로 실행)

### C1 — 스키마 + Edge `chat-turn`(DRY_RUN)
1. `supabase/migrations/0006_conversations.sql` 신규 작성 — §2.1 컬럼, §2.2 인덱스, §2.3 RLS, §2.4
   `compact_conversation` RPC. `BEGIN;`/`COMMIT;`로 감싸고 `IF NOT EXISTS` 사용(0001~0005 패턴).
2. `supabase/functions/chat-turn/index.ts` 신규 — delete-account/index.ts 골격(메서드·env·authClient/admin·
   jsonResponse) + generate-avatar의 DRY_RUN(index.ts:208)·`fetchWithRetry`(487-512). find-or-create,
   입력 모더레이션, 컨텍스트 조립, 프로바이더 호출, 출력 모더레이션, 메시지 2건 저장.
3. `supabase/functions/chat-turn/chatProvider.ts` 신규 — `premiumChatProvider.ts`의 96-98,101-113,115-135,
   197-264,272-369를 @mongchi/shared·ApiRuntimeConfig 의존 제거하고 인라인 이식(§1.3). summary 주입 필드
   추가(§3.2).
4. `supabase/functions/chat-turn/moderation.ts` 신규 — `premiumChatModeration.ts`(32-150) 이식 + **입력
   자해 경로를 422→위기-자원 응답으로 교체(§5.2-1)**, `crisisFallbackText` 카피 교체(§5.3, 초안).
5. `supabase/functions/chat-turn/{chatProvider,moderation}_test.ts` 신규 — `deno test`(npm/HTTP 없이).
   프로바이더는 fetch 주입/DRY_RUN, 모더레이션은 순수 함수 테스트(chromakey_test.ts 선례).
   영향 테스트: 신규 Deno 테스트만(서버 vitest 큐 클라이언트와 무관).

### C2 — 클라 전환 + 티켓/크레딧
6. `packages/shared/src/api/mobileContracts.ts` — `ChatTurnRequest`/`ChatTurnResponse`/`ChatCareContext`
   추가(§6.2). 기존 `SendConversationMessageResponse`(351-357)는 건드리지 않음(services/api 계약 보존).
   영향 테스트: `packages/shared/src/__tests__/mobileContracts.test.ts`.
7. `apps/mobile/src/features/session/supabasePremiumChatSession.ts` 신규 — `getSupabaseClient`+
   `ensureSupabaseSession`+`functions.invoke("chat-turn")`, 402/429 분기(supabaseGenerationSession.ts:
   294-364 패턴). 턴당 `requestId` 1회 생성·재시도 재사용(§4.3).
8. `apps/mobile/src/features/session/apiPremiumChatSession.ts` — 어댑터가 Supabase 모드면 신규 세션으로
   라우팅(또는 ChatGateScreen에서 분기). 영향 테스트: `apiPremiumChatSession.test.ts` + 신규
   `supabasePremiumChatSession.test.ts`.
9. `apps/mobile/src/features/chat/ChatGateScreen.tsx` — `apiReady`(126)에 Supabase 모드 추가;
   `charge` 결정(`getPremiumChatPaymentPreview`)·로컬 티켓 차감(`spendPremiumChatTurn`)·서버 balance 보정
   배선. `buildChatMemoryContext` 결과를 body `memoryContext`로 전달.
10. 검증: `npx vitest run`, `npm run typecheck`, `npx tsc -p apps/mobile --noEmit`. CI `CHAT_DRY_RUN=true`.

### C3 — 장기 요약 하이브리드
11. `supabase/functions/chat-turn/summary.ts` 신규 — 요약 OpenAI 호출(모델/토큰 상한/프롬프트 §3.2),
    fetch 주입 가능하게. `deno test`.
12. `supabase/functions/chat-turn/index.ts` — 턴 시작 시 요약 트리거 판정(§3.2), 성공 시
    `compact_conversation`(옵션 A) 또는 요약 UPDATE(옵션 B, `CHAT_PURGE_SUMMARIZED_RAW` 토글).
    `buildProviderContext`에 `conversation.summary` 주입.
13. `supabase/migrations/0006_conversations.sql`(또는 후속 `0007`) — 보존 퍼지 함수/pg_cron 스케줄
    (`purgeExpiredMessages` SQL 이식, 30일). 영향 테스트: 신규 Deno 테스트.

### C4 — 위기 안전(검수 게이트)
14. `supabase/functions/chat-turn/moderation.ts` — 위기 카피/감지 최종화는 **정신건강 전문가 검수 후**
    확정(§5.5). 코드로는 자원 카피 상수 + 로케일 분기 + `crisis_referral` 플래그 저장을 준비.
15. `supabase/functions/delete-account/index.ts` — `CASCADED_TABLES`(62-70)에 `conversations`,
    `conversation_messages` 추가(카운트/요약용; 삭제는 캐스케이드). 모듈 주석 마이그레이션 목록에 `0006` 추가.
    영향 테스트: `supabase/functions/delete-account/deletionPlan_test.ts`(storage만 검증하므로 영향 적음,
    카운트 목록 변경 시 index 스모크 확인).
16. 출시 게이트: 전문가 검수 완료 전 프로덕션 채팅 유료화/무제한 노출 금지. `launch-plan.md` 위기 항목
    (172,265) 체크박스 업데이트는 검수 완료 후.

### 비가역/마이그레이션 플래그
- `0006_conversations.sql`은 신규 테이블 생성이라 자체는 안전. 단 **옵션 A의 원문 즉시 삭제
  (`compact_conversation`)와 30일 보존 퍼지 DELETE는 비가역** — 요약 검증 성공 이후에만 삭제하도록 순서 보장.
- `consume_credits` reason `consume_premium_chat`는 TEXT라 스키마 변경 불필요(주석만 갱신).
- delete-account의 캐스케이드 삭제(대화·메시지·요약)는 비가역 — 이미 계정 삭제 계약의 일부.

### 검증 명령(공통)
- 서버 Edge: `deno test supabase/functions/chat-turn/*_test.ts`
- 공유/모바일: `npx vitest run` + `npm run typecheck` + `npx tsc -p apps/mobile --noEmit`
- 실 OpenAI 호출 테스트 금지(§7.1). CI는 `CHAT_DRY_RUN=true`.

---

## 부록 — 핵심 파일 경로 (절대경로)

- `/Users/kohyun/Desktop/AppProject/mongchi/services/api/src/premiumChatProvider.ts` (이식 원본, 452줄)
- `/Users/kohyun/Desktop/AppProject/mongchi/services/api/src/premiumChatModeration.ts` (위기/전문가 필터, 422 교체 대상)
- `/Users/kohyun/Desktop/AppProject/mongchi/services/api/src/premiumChatPolicy.ts` (컨텍스트16/보존30일/레이트)
- `/Users/kohyun/Desktop/AppProject/mongchi/services/api/src/postgresChatRepository.ts` (대화/메시지 컬럼·퍼지 정본)
- `/Users/kohyun/Desktop/AppProject/mongchi/services/api/src/postgresApiService.ts:2210-2370` (턴 조립 정본)
- `/Users/kohyun/Desktop/AppProject/mongchi/supabase/functions/generate-avatar/index.ts` (Edge 패턴·DRY_RUN·consume_credits)
- `/Users/kohyun/Desktop/AppProject/mongchi/supabase/functions/delete-account/index.ts` (auth/admin·CASCADED_TABLES)
- `/Users/kohyun/Desktop/AppProject/mongchi/supabase/migrations/0001_init.sql` (RLS/스토리지 패턴)
- `/Users/kohyun/Desktop/AppProject/mongchi/supabase/migrations/0004_credit_ledger.sql` (consume/refund/grant RPC·멱등)
- `/Users/kohyun/Desktop/AppProject/mongchi/supabase/migrations/0005_pet_namespace.sql` (pet_id 모델)
- `/Users/kohyun/Desktop/AppProject/mongchi/packages/shared/src/domain/wallet.ts` (티켓/크레딧 진실원·drift)
- `/Users/kohyun/Desktop/AppProject/mongchi/packages/shared/src/domain/conversation.ts` (Conversation 타입)
- `/Users/kohyun/Desktop/AppProject/mongchi/packages/shared/src/domain/chatGreeting.ts` (무료 인사, 서버 무관)
- `/Users/kohyun/Desktop/AppProject/mongchi/packages/shared/src/api/mobileContracts.ts:306-357` (ChatMemoryContext·계약)
- `/Users/kohyun/Desktop/AppProject/mongchi/apps/mobile/src/features/session/apiPremiumChatSession.ts` (교체 대상)
- `/Users/kohyun/Desktop/AppProject/mongchi/apps/mobile/src/features/session/supabaseClient.ts` (클라 팩토리)
- `/Users/kohyun/Desktop/AppProject/mongchi/apps/mobile/src/features/session/supabaseGenerationSession.ts:294-364` (invoke 오류 분기 선례)
- `/Users/kohyun/Desktop/AppProject/mongchi/apps/mobile/src/features/chat/ChatGateScreen.tsx` (게이트·apiReady·티켓 UI)
- `/Users/kohyun/Desktop/AppProject/mongchi/apps/mobile/src/features/chat/chatGatePresentation.ts` (티켓 pip·접근 카피)
- `/Users/kohyun/Desktop/AppProject/mongchi/docs/launch-plan.md:172,265` (위기 세이프티·P15·전문가 검수 필수)
