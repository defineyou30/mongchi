# 크레딧 Phase 1 — 서버 크레딧 원장 구현 설계서

> **구현 상태(2026-07-08):** P1a+1b 커밋 `1114ff9`에서 랜드·배포(서버 원장 `credit_wallets`/`credit_ledger` + RPC 4종 + 표정팩 서버 선차감 게이팅). P1c 커밋 `f881743`(클라 서버잔액 하이드레이트, 표정팩 로컬차감→서버 선차감, bonusCredits 로컬 진실 유지). 크레딧 안전 커밋 `c5d405c`(start-flow throw 실드, `request_id` 멱등 재시도로 이중차감 불가). **P1d(IAP)는 RevenueCat으로 방향 전환** — 직접 영수증검증 불필요(RC가 검증·환불 웹훅·크로스플랫폼 대행), 스토어 상품 생성+RC 대시보드 매핑은 사장 액션, 셋업 무관 코드 토대(크레딧 팩 카탈로그·상점 UI·grant 웹훅 Edge)는 후속 구축. 아래 설계 기록은 원안 보존.

> 작성: 2026-07-07 · deep-reasoner 읽기전용 분석 산출물. 후속 구현 에이전트가 그대로 실행하는 정밀 설계서.
> 관련: `docs/launch-plan.md` §3.5(원장 정합), `docs/readiness-diagnosis.md` 항목 2(보안 critical), `docs/multi-pet-slot-plan.md`(슬롯 선행 블로커)
> 검증 대상 실측 완료: `supabase/migrations/0001_init.sql`, `supabase/functions/generate-avatar/index.ts`(1475줄), `packages/shared/src/domain/wallet.ts`, `packages/shared/src/session/prototypeSession.ts`, `apps/mobile/src/features/session/{TerrariumSessionProvider,supabaseGenerationSession}.tsx?`

---

## 0. 한 줄 결론과 권고

**generation_quota를 폐기하지 말고, 그 위에 크레딧 원장을 얹어라.** `credit_wallets`(잔액)+`credit_ledger`(append-only 감사)를 신설하고, "생성권"은 **크레딧에서 파생되는 흐름**으로 재사용한다. 즉 유료 생성 소비처(표정 팩/재생성/풀셋/슬롯번들)는 전부 **하나의 `consume_credits` RPC**를 통해 서버 권위로 차감하고, 무료 1회(free_used/free_limit)만 기존 `consume_generation_quota`에 남긴다. `generation_quota.paid_credits`는 **이관 후 사용 중단**(deprecated, drop은 안 함)한다.

**Phase 1 범위 권고: IAP 실배선은 빼라.** Phase 1은 "grant RPC + 영수증 검증 자리(Edge Function 스텁)"까지만. 실제 Apple/Google 결제 UI·expo-iap 배선은 별도 웨이브(P1d, 스토어 상품 승인·사용자 액션 대기). 이유는 §4에 상술 — Phase 1의 두 목적(보안 봉합·슬롯 생성권)은 IAP 없이 **관리자 grant + 서버 차감**만으로 완결되고, IAP는 리스크·외부 의존(스토어 심사)이 가장 큰 조각이라 크리티컬 경로에서 분리해야 한다.

---

## 1. 현재 상태 실측 (근거)

### 1.1 서버
- `supabase/migrations/0001_init.sql`: `generation_quota(user_id PK, free_used, free_limit DEFAULT 1, paid_credits, updated_at)`. RPC `consume_generation_quota(p_user)`는 **paid_credits 우선 → free_used 폴백**으로 1단위 차감(라인 96-102), `refund_generation_quota(p_user)`는 소비 우선순위 역순 환불(라인 127-132). 둘 다 `SECURITY DEFINER`, `SET search_path = public`. RLS는 본인 SELECT만, 쓰기 정책 없음(전부 service_role).
- `0002_rate_limit.sql`: `generation_rate_limits` + `check_generation_rate_limit(p_user, p_window_seconds, p_max)`. **RPC 작성 패턴의 참조 템플릿**(SECURITY DEFINER + 원자적 count/insert + 확률적 프루닝).
- `0003_expression_pack_source_asset.sql`: `generation_jobs.source_asset_path` nullable 컬럼 추가.
- `credit_wallets`/`credit_ledger`: **미구현**. launch-plan §3.5에 원칙만 존재.

### 1.2 Edge Function (`supabase/functions/generate-avatar/index.ts`)
- 파일 최상단 주석(라인 10-20)이 이미 "expression pack mode … skips consume_generation_quota (billed against the client's local credit balance instead — server-side credit accounting is a Phase 1 follow-up)"라고 **명시**.
- **핵심 구멍(라인 1411-1418)**:
  ```ts
  const { data: quotaConsumed, error: quotaError } = isExpressionPackRequest
    ? { data: true, error: null }          // ← 서버 차감 전면 스킵
    : await admin.rpc("consume_generation_quota", { p_user: userId });
  ```
  `isExpressionPackRequest = source_asset_path`가 `avatars/{userId}/`로 시작하는지(라인 1335, 1369)로만 판정. 표정 팩은 rate limit(라인 1387-1409, fail-closed)만 통과하면 **무제한 무료 OpenAI 생성**. 커밋 dc0a82d가 `requested_states` dedup + `MAX_EXPRESSION_PACK_STATES` 상한 + rate-limit fail-closed를 붙였으나, 이는 "1회당 증폭"과 "fail-open"만 막을 뿐 **rate-limit 윈도우(예: 5분당 3회)마다 반복 무료 생성**은 여전히 가능. 근본 대응은 서버 크레딧 차감.
- 실패 환불 경로(라인 900-902, `markJobFailed`): `refund=true`일 때만 `refund_generation_quota` 호출. `runPipeline`(라인 925, 932)에서 `isExpressionPackMode`면 `shouldRefundOnFailure=false` — 표정 팩은 서버가 아무것도 차감하지 않았으니 환불도 안 함. **Phase 1 이후 이 로직이 credit 환불로 뒤집혀야 함.**

### 1.3 클라이언트
- `packages/shared/src/domain/wallet.ts`: `CreditWallet{ credits, bonusCredits, freeChatTickets }`. `getSpendableCreditBalance = credits + bonusCredits`. `spendCredits`는 **bonusCredits 먼저, 그다음 credits** 차감(라인 190-191). 전부 **순수 로컬 함수**.
- `packages/shared/src/session/prototypeSession.ts`:
  - `createInitialPrototypeSession`(라인 424): `wallet: { ...mockCreditWallet }`. `mockData.ts` 라인 144-146: `credits:0, bonusCredits:25, freeChatTickets:3`.
  - `validatePrototypeExpressionPackPurchase`(라인 1678): 프리플라이트, 지갑 무변경.
  - `confirmPrototypeExpressionPackPurchase`(라인 1713): `spendCredits(state.wallet, pack.creditCost, now)` 로컬 차감 + `ownedExpressionPackIds` 기록 + 메모리. **"잡 시작 성공 후" 로컬 차감**이 핵심 — 서버 권위 아님.
- `apps/mobile/src/features/session/TerrariumSessionProvider.tsx` `purchaseExpressionPack`(라인 1436-1511):
  1. `validatePrototypeExpressionPackPurchase` 프리플라이트.
  2. Supabase 없으면 로컬 즉시 confirm + mock 에셋 머지(dev).
  3. Supabase 있으면 `startSupabaseExpressionPackFlow`(잡 시작) → 성공 시 `confirmPrototypeExpressionPackPurchase`(**로컬 차감**) → jobId 폴링.
- `supabaseGenerationSession.ts` `invokeGenerateAvatarWithBody`(라인 286-327): 402→`generation_quota_exceeded`, 429→`rate_limited` 매핑. **서버 잔액을 읽어오는 경로는 어디에도 없음** — 클라는 서버 지갑을 조회조차 안 함.
- dev 언락: `DEVELOPMENT_STORE_CREDIT_BALANCE=9999`(라인 270), `EXPO_PUBLIC_TINY_PET_DEV_UNLOCK_STORE`. production off 확인은 release 검증에 있음.

### 1.4 결론적 진단
현재 아키텍처는 **"서버 원장 없음 + 클라 로컬 지갑이 유일 진실"**. 표정 팩은 서버 차감 완전 스킵, 슬롯 생성은 free_limit=1 때문에 402. 두 문제의 공통 뿌리는 "유료 생성권을 서버가 발급·검증하지 않는다"다.

---

## 2. DB 스키마 (P1a)

신규 마이그레이션 **`supabase/migrations/0004_credit_ledger.sql`**. 아래 순서/불변식을 그대로 따른다.

### 2.1 테이블

```sql
BEGIN;

-- credit_wallets: 현금성 크레딧 잔액(서버 진실). user당 1행.
-- bonusCredits(플레이 획득)는 여기에 넣지 않는다 — 그건 로컬 진실이며 소실 OK.
-- 서버는 "구매/환불/생성소비"만 권위적으로 관리한다.
CREATE TABLE IF NOT EXISTS public.credit_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- credit_ledger: append-only 감사 로그. 절대 UPDATE/DELETE 하지 않는다.
-- 모든 잔액 변화는 여기에 1행씩 남고, credit_wallets.balance는 그 합의 캐시.
-- balance_after = 이 delta 적용 직후 잔액 스냅샷(재구성/감사용).
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,               -- 충전 +N, 소비 -N, 환불 +N, 클로백 -N
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reason TEXT NOT NULL,                 -- 'grant_purchase' | 'grant_admin' | 'grant_migration'
                                        -- | 'consume_expression_pack' | 'consume_regeneration'
                                        -- | 'consume_full_set' | 'consume_pet_slot'
                                        -- | 'consume_theme_bundle' | 'refund_generation'
                                        -- | 'chargeback_refund'
  ref_type TEXT,                        -- 'generation_job' | 'iap_transaction' | 'pet_slot' | null
  ref_id TEXT,                          -- 잡 id / 영수증 tx id / 슬롯 id 등 (멱등키로도 사용)
  metadata JSONB,                       -- 자유 진단(패키지 id, 상품 sku 등)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_ledger_user_created_idx
  ON public.credit_ledger(user_id, created_at DESC);

-- 멱등성 방어: 같은 (reason, ref_type, ref_id) 조합은 한 번만.
-- 재시도로 인한 이중 충전/이중 환불을 DB 레벨에서 차단한다.
-- ref_id가 null인 항목(순수 관리자 grant 등)은 제약 밖(부분 유니크).
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_idempotency_idx
  ON public.credit_ledger(user_id, reason, ref_type, ref_id)
  WHERE ref_id IS NOT NULL;
```

**불변식**: `credit_wallets.balance == SUM(credit_ledger.delta WHERE user_id)`. RPC가 항상 같은 트랜잭션에서 둘을 함께 쓴다. 이 등식이 깨지면 데이터 손상 신호(옵스 알림 대상).

### 2.2 generation_quota와의 관계 (확정)

| 항목 | 소속 | Phase 1 이후 역할 |
|---|---|---|
| 무료 1회 (`free_used`/`free_limit`) | `generation_quota` 유지 | 신규 유저 첫 아바타. `consume_generation_quota`가 계속 담당 |
| 유료 생성권 (`paid_credits`) | **deprecated** | 신규 소비는 전부 `credit_wallets`. 컬럼은 이관 후 남겨두되(drop 안 함) 아무도 안 씀 |
| 크레딧 잔액 | `credit_wallets` | 표정 팩/재생성/풀셋/슬롯 전부 여기서 차감 |
| 감사 로그 | `credit_ledger` | 모든 delta append |

즉 **생성권 = 크레딧 잔액에서 파생**(별도 버킷 아님). 사진 재생성 12cr, 풀셋 30cr, 표정 팩 12cr, 슬롯 50cr 전부 `consume_credits(user, cost, reason)` 한 경로를 사용한다. 무료 1회만 `generation_quota`에 남는다. 사진 재생성은 현재 판매하지 않으며, 새 사진 업로드·선차감·실패 환불·기존 캐릭터 보존을 하나의 서버 트랜잭션 계약으로 구현한 뒤 연다.

### 2.3 RLS

```sql
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger  ENABLE ROW LEVEL SECURITY;

-- 본인 잔액/원장 읽기 전용. 쓰기 정책 없음 → 전부 service_role(Edge Function) 또는
-- SECURITY DEFINER RPC 경유. 0001/0002의 기존 테이블 정책과 정확히 동일한 계약.
CREATE POLICY credit_wallets_select_own ON public.credit_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY credit_ledger_select_own ON public.credit_ledger
  FOR SELECT USING (auth.uid() = user_id);
```

클라는 지갑 잔액을 **직접 SELECT로 읽고**(본인 행), 쓰기는 절대 못 한다. 이것이 "서버 진실"의 물리적 보장이다.

---

## 3. RPC 설계 (P1a)

전부 `SECURITY DEFINER`, `SET search_path = public`, `LANGUAGE plpgsql`. `0001`/`0002`의 기존 RPC와 동일 계약. **음수 방어·row lock·멱등성**을 각 함수에 내장.

### 3.1 consume_credits — 원자적 차감 (핵심)

```sql
-- 성공 시 새 잔액(INTEGER) 반환, 잔액 부족 시 -1 반환(예외 아님 → 402 매핑 용이).
-- FOR UPDATE row lock으로 동시 요청 직렬화(이중 차감 방지).
-- p_ref_id가 주어지면 credit_ledger 멱등 유니크로 재시도 이중 차감을 원천 차단.
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user   UUID,
  p_cost   INTEGER,
  p_reason TEXT,
  p_ref_type TEXT DEFAULT NULL,
  p_ref_id   TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_existing INTEGER;
BEGIN
  IF p_cost <= 0 THEN
    RAISE EXCEPTION 'consume_credits: p_cost must be positive (got %)', p_cost;
  END IF;

  -- 멱등: 같은 소비가 이미 기록됐으면 현재 잔액만 돌려주고 재차감 안 함.
  IF p_ref_id IS NOT NULL THEN
    SELECT balance_after INTO v_existing
    FROM public.credit_ledger
    WHERE user_id = p_user AND reason = p_reason
      AND ref_type IS NOT DISTINCT FROM p_ref_type
      AND ref_id = p_ref_id
    LIMIT 1;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  -- 지갑 행 확보 + 배타 잠금. 없으면 0 잔액으로 생성.
  INSERT INTO public.credit_wallets (user_id) VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance
  FROM public.credit_wallets WHERE user_id = p_user
  FOR UPDATE;

  IF v_balance < p_cost THEN
    RETURN -1;                       -- 잔액 부족: 호출측이 402로 변환
  END IF;

  v_balance := v_balance - p_cost;
  UPDATE public.credit_wallets
    SET balance = v_balance, updated_at = now()
    WHERE user_id = p_user;

  INSERT INTO public.credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, metadata)
    VALUES (p_user, -p_cost, v_balance, p_reason, p_ref_type, p_ref_id, p_metadata);

  RETURN v_balance;
END;
$$;
```

### 3.2 refund_credits — 환불 (생성 실패 시)

```sql
-- 생성 실패로 소비를 되돌린다. 멱등: 같은 잡의 환불은 한 번만(원장 유니크).
-- 소비 원장을 찾아 그 절대값만큼 되돌리고 balance CHECK(>=0)로 상한 보장.
CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user   UUID,
  p_ref_type TEXT,
  p_ref_id   TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_consumed INTEGER;
  v_balance INTEGER;
BEGIN
  -- 이미 환불됐으면(refund_generation 원장 존재) no-op.
  PERFORM 1 FROM public.credit_ledger
    WHERE user_id = p_user AND reason = 'refund_generation'
      AND ref_type = p_ref_type AND ref_id = p_ref_id;
  IF FOUND THEN
    SELECT balance INTO v_balance FROM public.credit_wallets WHERE user_id = p_user;
    RETURN COALESCE(v_balance, 0);
  END IF;

  -- 원래 소비액(음수 delta)의 절대값. 소비 기록이 없으면 환불할 것 없음.
  SELECT -delta INTO v_consumed
  FROM public.credit_ledger
  WHERE user_id = p_user AND ref_type = p_ref_type AND ref_id = p_ref_id
    AND reason LIKE 'consume_%'
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND OR v_consumed IS NULL OR v_consumed <= 0 THEN
    SELECT balance INTO v_balance FROM public.credit_wallets WHERE user_id = p_user;
    RETURN COALESCE(v_balance, 0);
  END IF;

  UPDATE public.credit_wallets
    SET balance = balance + v_consumed, updated_at = now()
    WHERE user_id = p_user
    RETURNING balance INTO v_balance;

  INSERT INTO public.credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id)
    VALUES (p_user, v_consumed, v_balance, 'refund_generation', p_ref_type, p_ref_id);

  RETURN v_balance;
END;
$$;
```

### 3.3 grant_credits — 충전 (구매/관리자/이관)

```sql
-- 크레딧 충전. p_ref_id로 멱등(같은 영수증 tx는 한 번만 충전).
-- 반드시 SECURITY DEFINER + service_role 경유(RLS 쓰기 정책 없음)로만 호출.
-- Phase 1에서 호출자: (a) 관리자 수동(대시보드 SQL), (b) 마이그레이션 스크립트,
--  (c) IAP 웨이브에서 영수증 검증 성공 후 Edge Function.
CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user   UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_ref_type TEXT DEFAULT NULL,
  p_ref_id   TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_existing INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'grant_credits: p_amount must be positive (got %)', p_amount;
  END IF;

  IF p_ref_id IS NOT NULL THEN
    SELECT balance_after INTO v_existing FROM public.credit_ledger
    WHERE user_id = p_user AND reason = p_reason
      AND ref_type IS NOT DISTINCT FROM p_ref_type AND ref_id = p_ref_id
    LIMIT 1;
    IF FOUND THEN RETURN v_existing; END IF;   -- 이미 충전됨(재시도)
  END IF;

  INSERT INTO public.credit_wallets (user_id) VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO v_balance FROM public.credit_wallets WHERE user_id = p_user FOR UPDATE;

  v_balance := v_balance + p_amount;
  UPDATE public.credit_wallets SET balance = v_balance, updated_at = now() WHERE user_id = p_user;
  INSERT INTO public.credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id, metadata)
    VALUES (p_user, p_amount, v_balance, p_reason, p_ref_type, p_ref_id, p_metadata);
  RETURN v_balance;
END;
$$;
```

### 3.4 get_credit_balance — 잔액 조회 (편의)

```sql
-- 클라는 credit_wallets를 RLS로 직접 SELECT 하지만, "행 없으면 0"을
-- 서버가 보장해주는 편의 RPC. 관리자/Edge에서도 재사용.
CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT balance FROM public.credit_wallets WHERE user_id = p_user), 0);
$$;
```

### 3.5 각 소비처가 부르는 방식

| 소비처 | reason | ref_type / ref_id | 부르는 위치 | cost |
|---|---|---|---|---|
| 표정 팩 | `consume_expression_pack` | `generation_job` / **잡 생성 전에는 잡 id가 없음** → §3.6 순서 참조 | Edge Function `generate-avatar` | 12 |
| 사진 재생성(3종, 구현 보류) | `consume_regeneration` | `generation_job` / job_id | Edge Function | 12 |
| 풀셋(16종) | `consume_full_set` | `generation_job` / job_id | Edge Function | 30 |
| 슬롯 번들 생성 | `consume_pet_slot` | `pet_slot` / slot_id | Edge Function(슬롯 온보딩 생성) 또는 슬롯 구매 Edge | 50 |
| 테마 번들 | `consume_theme_bundle` | null | (선택) 서버 이관 시. Phase 1은 로컬 유지 가능 | 18 |
| 프리미엄 채팅 | — | — | **서버 차감 안 함**(로컬 bonusCredits/free ticket, launch-plan 원칙) | 1 |

**중요**: 테마 번들·채팅·간식 구매는 실제 OpenAI 비용이 없으므로(원가 ~0) **Phase 1에서 서버 차감으로 옮기지 않는다.** 서버 원장은 "돈이 새는 유료 생성"(표정 팩/재생성/풀셋/슬롯)에만 게이팅. 이 스코프 축소가 Phase 1을 작게 유지하는 핵심 결정이다.

### 3.6 잡 id 순서 문제 (반드시 지킬 것)

표정 팩은 잡을 만들기 전 credit을 차감해야 남용을 막는데, `ref_id=job_id` 멱등은 잡 생성 후에야 가능하다. 해결:
1. **선차감**은 `ref_id = 클라가 보낸 idempotency key`(UUID, 요청 바디의 `request_id`)로 수행. 클라가 재시도 시 같은 `request_id`를 보내면 이중 차감 없음.
2. 잡 생성 성공 후 그 잡의 `metadata`에 `request_id`를 심고, 실패 시 `refund_credits(p_ref_type='credit_request', p_ref_id=request_id)`로 환불.
3. 즉 credit 원장의 ref는 **잡 id가 아니라 request_id**로 통일(`ref_type='credit_request'`). 이렇게 하면 "잡 생성 실패"와 "파이프라인 실패" 둘 다 같은 키로 환불 가능.

---

## 4. Edge Function 통합 (P1b)

파일: `supabase/functions/generate-avatar/index.ts`.

### 4.1 요청 바디 확장
클라가 유료 생성 요청에 다음을 추가로 보낸다:
- `request_id: string`(UUID, 멱등키. 클라가 생성, 재시도 시 동일값 유지)
- `credit_reason: 'expression_pack' | 'regeneration' | 'full_set' | 'pet_slot'`(선택 — 없으면 아래 판정 규칙으로 유도)

서버는 `credit_reason`을 **신뢰하지 않고** 요청 모드로 비용을 재판정한다(클라가 싼 reason을 보내 비싼 생성을 훔치는 것 방지):
- `isExpressionPackRequest`(기존 `source_asset_path` 판정, 라인 1335) → `consume_expression_pack`, cost=12.
- 슬롯 번들: 별도 플래그 `is_pet_slot_generation`(신규) + 서버가 해당 유저에게 "미소비 슬롯 생성권"이 있는지 확인 → `consume_pet_slot`은 **슬롯 구매 시점에 이미 차감**했으므로 여기선 차감이 아니라 "슬롯 생성권 소진 마킹"(§4.4).
- 일반 재생성/풀셋: `required_states` 개수로 판정(3종=재생성 8cr, 16종=풀셋 30cr). 무료 1회 남았으면 `consume_generation_quota` 우선.

### 4.2 표정 팩 게이팅 교체 (핵심 패치)
현재 라인 1411-1418의 `isExpressionPackRequest ? { data: true } : consume_generation_quota`를 아래로 교체:

```ts
// 4. 유료 생성권 확보(서버 권위). 무료 1회는 여전히 generation_quota.
let creditReason: string | null = null;
let creditCost = 0;

if (isExpressionPackRequest) {
  creditReason = "consume_expression_pack";
  creditCost = EXPRESSION_PACK_CREDIT_COST;  // 12, 서버 상수(클라 값 불신)
}
// (재생성/풀셋 유료화는 크레딧 Phase 2에서. Phase 1은 무료 1회 유지 유지)

if (creditReason) {
  if (typeof body.request_id !== "string" || body.request_id.trim().length === 0) {
    return jsonResponse({ error: "invalid_request" }, 400);
  }
  const { data: newBalance, error: consumeErr } = await admin.rpc("consume_credits", {
    p_user: userId, p_cost: creditCost, p_reason: creditReason,
    p_ref_type: "credit_request", p_ref_id: body.request_id
  });
  if (consumeErr) return jsonResponse({ error: "credit_check_failed" }, 500);
  if (newBalance === -1) {
    return jsonResponse({ error: "insufficient_credits", message: failureMessages.insufficientCredits }, 402);
  }
} else {
  // 무료 1회 경로: 기존 그대로.
  const { data: quotaConsumed, error: quotaError } = await admin.rpc("consume_generation_quota", { p_user: userId });
  if (quotaError) return jsonResponse({ error: "quota_check_failed" }, 500);
  if (quotaConsumed !== true) {
    return jsonResponse({ error: "quota_exhausted", message: failureMessages.quotaExhausted }, 402);
  }
}
```

**주의(테스트 파급 없음이지만 정합 필요)**: `body.request_id`를 `generation_jobs.insert`의 `input_snapshot` 또는 신규 컬럼에 심어야 환불 시 참조 가능. 최소 침습은 잡 insert `metadata` 대신 **`credit_ref` nullable 컬럼**을 `0004`에서 `generation_jobs`에 추가(`ADD COLUMN IF NOT EXISTS credit_ref TEXT`). 파이프라인 실패 핸들러가 이 값으로 환불한다.

### 4.3 실패 환불 뒤집기
- 라인 900-902 `markJobFailed`: `refund_generation_quota` 대신, 잡에 `credit_ref`가 있으면 `refund_credits(p_user, 'credit_request', credit_ref)`, 없으면(무료 1회 경로) 기존 `refund_generation_quota`.
- 라인 925-932 `runPipeline`의 `shouldRefundOnFailure = !isExpressionPackMode`를 **삭제**하고, 잡 행의 `credit_ref` 유무로 분기. 표정 팩이 이제 크레딧을 차감하므로 **실패 시 반드시 환불**해야 한다(현재는 안 함 = 회귀 버그가 될 뻔).
- 라인 1447-1451 잡 insert 실패 시: `isExpressionPackRequest`면 `refund_credits`로 방금 차감한 크레딧을 되돌린다(현재는 `refund_generation_quota`만 호출하고 표정 팩은 스킵).

### 4.4 슬롯 생성 경로 (multi-pet-slot-plan 연동)
슬롯 번들 50cr은 **슬롯 구매 시점에 `consume_credits(reason='consume_pet_slot', ref_id=slot_id)`로 차감**하고, 그때 **슬롯 생성권 1개를 부여**한다. 두 설계 선택지:
- **(권고) generation_quota를 유저별이 아닌 slot 부여로 우회하지 말고**, 슬롯 구매 Edge Function이 `grant_credits`가 아니라 별도 `pet_slots(user_id, slot_id, generation_used bool)` 행을 만든다(multi-pet-slot-plan W2의 `pet_slots` 테이블과 합류). 슬롯 생성 요청 시 Edge가 `generation_used=false`인 슬롯을 찾아 생성 허용 후 `true`로 마킹. 무료 쿼터·크레딧 어느 것도 재차감 안 함(번들에 포함되므로).
- 대안: 슬롯 구매 시 `consume_generation_quota`를 역으로 +1(paid_credits 증가). 트레이드오프: 기존 quota 경로 재사용으로 코드 적지만, deprecated 하려는 paid_credits를 되살려 정합이 지저분해짐. **기각.**

즉 **크레딧 차감(50cr)과 생성권(슬롯 flag)을 분리**한다. 이 문서 Phase 1은 `consume_credits`/원장/RPC/표정팩 게이팅까지 확정하고, `pet_slots` 실테이블·슬롯 온보딩은 multi-pet-slot-plan W2/W3에 위임(단 `consume_credits(reason='consume_pet_slot')` RPC 계약은 여기서 미리 확정해 그쪽이 바로 호출).

---

## 5. IAP 연동 경계 (P1d — 별도 웨이브 권고)

### 5.1 Phase 1에 넣을 것 / 뺄 것
- **넣음**: `grant_credits` RPC(§3.3), credit_ledger의 `reason='grant_purchase'` + `ref_type='iap_transaction'` + `ref_id=<store tx id>` 멱등 자리, 영수증 검증 Edge Function **스텁**(`verify-purchase`, 검증 로직 TODO + grant 호출 골격만). P8/P10 고지 문구는 launch-plan §5.2에 이미 정의됨(구현은 P1c 클라 웨이브).
- **뺌**: 실제 Apple StoreKit/App Store Server API 영수증 검증, Google Play Developer API 검증, `expo-iap` 결제 UI 배선, App Store Server Notification(`REFUND`) 웹훅, Voided Purchases API 폴링.

### 5.2 근거
1. **크리티컬 경로 분리**: Phase 1의 두 목적(표정 팩 보안 봉합 + 슬롯 생성권)은 **관리자 grant + 서버 차감만으로 완결**된다. 실결제 없이도 QA·내부 배포·초기 유저 grant 가능.
2. **외부 의존 최대**: IAP는 스토어 상품 승인(사용자 액션 대기, launch-plan에 명시), 영수증 검증 서버 로직, 환불 웹훅까지 얽혀 리스크가 가장 큼(§8 리스크 5). 이걸 Phase 1에 묶으면 보안 봉합이 스토어 승인에 볼모 잡힘.
3. **영수증 검증 자리 확보**: `verify-purchase` Edge Function 스텁과 `grant_credits` 멱등 계약을 미리 심으면, IAP 웨이브는 "검증 로직 채우기 + UI"만 남아 순수 증분 작업이 된다.

### 5.3 IAP 웨이브 진입 시 계약 (미리 고정)
- 클라 결제 성공 → `verify-purchase` Edge에 영수증 전달 → 서버가 Apple/Google에 검증 → 유효하면 SKU→크레딧 매핑(credits_small=25 등, launch-plan §3.2)으로 `grant_credits(reason='grant_purchase', ref_type='iap_transaction', ref_id=transactionId)`. tx id 멱등으로 재시도·중복 알림 안전.
- 환불 클로백(launch-plan §5.4-3): `REFUND`/Voided 수신 → `grant_credits`의 음수 버전이 아니라 **별도 `chargeback_credits` RPC**(delta 음수 허용, balance 최저 0 클램프, reason='chargeback_refund'). Phase 1에서는 RPC 시그니처만 남기고 웹훅은 IAP 웨이브.

---

## 6. 클라이언트 마이그레이션 (P1c)

### 6.1 이중 버킷 동기화 모델
`CreditWallet`의 `credits`(서버 진실)와 `bonusCredits`(로컬 진실)를 실제로 다르게 다룬다:
- **`bonusCredits`**: 기존 그대로 로컬. 플레이 획득, 소실 OK. `spendCredits`는 계속 bonus 먼저 소진.
- **`credits`**: **서버가 진실**. 클라의 `state.wallet.credits`는 이제 **서버 잔액의 캐시**. 쓰기(차감/충전)는 로컬에서 하지 않고, 서버 응답으로 갱신.

### 6.2 서버 잔액 읽어오는 시점
신규 함수 `hydrateServerCreditBalance(client)` in `apps/mobile/src/features/session/supabaseGenerationSession.ts`:
- Supabase 세션 확보 후 `client.rpc("get_credit_balance", { p_user })` 또는 `credit_wallets` 직접 SELECT(RLS 본인 행).
- 호출 시점: (a) 앱 포그라운드 복귀, (b) 상점/친구 페이지(표정 팩 갤러리) 진입, (c) 구매/생성 완료 직후. 매초 클록엔 태우지 않음(TerrariumHomeScreen 리렌더 부담, readiness-diagnosis 지적).
- 결과를 `setState`로 `wallet.credits`에 반영. **bonusCredits는 건드리지 않음**(로컬 진실 보존).

### 6.3 표정 팩 구매 플로우 변경 (로컬 차감 → 서버 선차감)
`TerrariumSessionProvider.tsx` `purchaseExpressionPack`(라인 1436-1511) 변경:
- **현재**: `startSupabaseExpressionPackFlow` 성공 → `confirmPrototypeExpressionPackPurchase`(로컬 `spendCredits`).
- **변경 후**: `startSupabaseExpressionPackFlow`에 `request_id`(신규 UUID) 동봉 → Edge가 서버 `consume_credits` 선차감. 성공(202) 응답 시 클라는 **로컬 credits를 서버 반환 잔액으로 동기화**하고 `ownedExpressionPackIds`/메모리만 기록(더 이상 로컬 `spendCredits` 호출 안 함). 402(`insufficient_credits`) 응답 시 "크레딧 부족" 시트(launch-plan P11).
- `confirmPrototypeExpressionPackPurchase`는 **소유권+메모리 기록만 남기고 지갑 차감 제거**(또는 신규 함수 `recordExpressionPackUnlock`로 분리해 지갑 무변경). bonusCredits로 표정 팩을 사던 dev 경로는 로컬 폴백(§6.5)에만 유지.
- 402 시 이미 pending 마킹된 상태를 `setExpressionPackFailed`로 되돌리는 기존 경로 재사용.

### 6.4 오프라인/낙관적 처리
- **유료 생성(표정 팩)은 낙관적 처리 금지**: 서버가 진실이고 OpenAI 비용이 실제로 나가므로, 오프라인이면 구매 자체를 막고 "지금은 연결이 필요해요" 톤 메시지(죄책감 금지). 잡 시작(202)이 성공의 정의.
- **bonusCredits 소비(채팅/간식)는 기존 낙관적 로컬 처리 유지** — 서버 무관.
- **잔액 표시**: 서버 캐시가 stale일 수 있으므로 상점 진입 시 하이드레이트 후 표시. 하이드레이트 실패 시 마지막 캐시 표시 + 조용한 재시도(배너 남발 금지).

### 6.5 dev 폴백 보존
`getSupabaseClient()`가 없을 때(라인 1461)의 로컬 즉시 confirm + mock 에셋 머지 경로는 dev 그대로 유지(서버 없이 UI 흐름 검증). 단 이 경로는 `EXPO_PUBLIC_TINY_PET_DEV_UNLOCK_STORE` 가드 하에서만 프로덕션 미노출(기존 release 검증).

---

## 7. 하위호환 / 전환 (P1a 마이그레이션 스텝)

### 7.1 기존 generation_quota.paid_credits 이관
`0004` 마이그레이션 말미에 데이터 이관 블록(멱등):
```sql
-- 기존 paid_credits > 0 유저를 credit_wallets로 1회 이관. reason='grant_migration',
-- ref_id=user_id로 멱등 → 재실행해도 이중 충전 없음.
INSERT INTO public.credit_wallets (user_id, balance)
SELECT user_id, paid_credits FROM public.generation_quota WHERE paid_credits > 0
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.credit_ledger (user_id, delta, balance_after, reason, ref_type, ref_id)
SELECT gq.user_id, gq.paid_credits, gq.paid_credits, 'grant_migration', 'user', gq.user_id::text
FROM public.generation_quota gq WHERE gq.paid_credits > 0
ON CONFLICT DO NOTHING;

-- 이관 후 paid_credits를 0으로(소비 경로가 credit_wallets로 넘어갔으므로
-- 이중 잔액 방지). 컬럼 자체는 drop 하지 않음(롤백 여지·감사).
UPDATE public.generation_quota SET paid_credits = 0 WHERE paid_credits > 0;
```
**⚠️ 데이터 마이그레이션 단계** — 되돌리기 어려움(paid_credits를 0으로 밀므로). 실행 전 `generation_quota` 스냅샷 백업 필수. 현재 프로덕션에 실유저 결제가 거의 없다면(런치 전) 리스크 낮음.

### 7.2 신규 유저 vs 기존 유저
- **신규 유저**: `credit_wallets` 행은 첫 `consume_credits`/`grant_credits` 때 lazy 생성(0 잔액). 무료 1회는 `generation_quota`가 담당(변경 없음).
- **기존 유저(무료 1회 소진)**: `free_used=1` 유지. 유료 생성은 credit_wallets 잔액 필요 → grant 없으면 402(정상). paid_credits가 있었으면 §7.1로 이관됨.
- **로컬 세션의 credits 값**: 기존 로컬 `state.wallet.credits`(대개 0, mockData 기준)는 서버 하이드레이트가 덮어씀. bonusCredits는 로컬 유지. 세션 스키마 버전 범프 **불필요**(CreditWallet 형태 불변, 의미만 재해석).

---

## 8. 웨이브 분해 (1인 개발, 각 그린 랜드)

| W | 내용 | 대상 파일 | 규모 |
|---|---|---|---|
| **P1a** | `0004_credit_ledger.sql`: credit_wallets/credit_ledger + RLS + consume/refund/grant/get RPC + paid_credits 이관 + generation_jobs.credit_ref 컬럼 | `supabase/migrations/0004_credit_ledger.sql` | 중 ~1일 (서버만, 앱 무변경) |
| **P1b** | Edge Function 크레딧 게이팅: 표정 팩 `consume_credits` 선차감 + 실패 환불 뒤집기 + request_id 멱등 + credit_ref 잡 기록 | `supabase/functions/generate-avatar/index.ts` | 중 ~1-1.5일 |
| **P1c** | 클라 서버잔액 동기화: `hydrateServerCreditBalance` + purchaseExpressionPack 서버 선차감 전환 + `confirmPrototypeExpressionPackPurchase` 지갑 차감 제거 + P11 부족 시트 배선 | `supabaseGenerationSession.ts`, `TerrariumSessionProvider.tsx`, `prototypeSession.ts`, `wallet.ts`(선택) | 중대 ~2-3일 |
| **P1d** | IAP(별도, 스토어 승인 대기): `verify-purchase` Edge 스텁 채우기 + expo-iap UI + REFUND 웹훅 + chargeback RPC | 신규 `supabase/functions/verify-purchase/`, 신규 클라 결제 모듈 | 대 ~4-6일 (외부 의존) |

**랜드 순서**: P1a→P1b가 함께 랜드해야 보안 구멍이 실제로 닫힌다(P1a만으론 Edge가 아직 안 부름). P1a는 앱을 건드리지 않아 독립 배포 가능. P1c는 P1b 배포 후. P1d는 크리티컬 경로 밖.

**보안 봉합 최소선 = P1a + P1b**. 이 둘만 랜드해도 표정 팩 무한 무료 생성이 서버에서 막힌다(잔액 없으면 402). 슬롯 블로커 해소는 P1a의 `consume_credits(reason='consume_pet_slot')` 계약 + multi-pet W2의 `pet_slots`.

---

## 9. 리스크 톱5

1. **이중 차감(동시성)** — 같은 유저가 표정 팩 버튼 연타 → 병렬 요청 2건이 각각 12cr 차감. **방어**: `consume_credits`의 `SELECT ... FOR UPDATE` row lock으로 직렬화 + `request_id` 멱등 유니크(같은 요청 재시도는 1회만). 클라도 pending 마킹으로 UI 이중 탭 차단(기존 `expressionPackPurchaseStatusById`).
2. **환불 누락(회귀 위험)** — 표정 팩이 이제 크레딧을 차감하므로, 파이프라인 실패 시 환불 안 하면 유저가 돈만 잃음. 현재 코드는 표정 팩 실패 시 **의도적으로 환불 안 함**(라인 932 `shouldRefundOnFailure=!isExpressionPackMode`) — P1b에서 이 로직을 뒤집지 않으면 정확히 이 버그가 발생. **방어**: `credit_ref` 있는 모든 잡은 실패 시 `refund_credits` 강제 + refund 멱등(이중 환불도 방지).
3. **오프라인/부분 실패** — 202는 받았는데 클라가 응답 전 앱 종료 → 서버는 차감·잡 시작, 클라는 소유권 미기록. **방어**: 소유권 판정을 로컬 플래그가 아니라 **실제 acceptedAssets 존재**(`isExpressionPackUnlocked`, expressionPacks.ts 라인 48)로 하고, 폴링이 완료 잡을 머지하면 자동 소유. request_id 멱등으로 재구매 시도해도 이중 차감 없음.
4. **마이그레이션(비가역)** — §7.1이 `paid_credits`를 0으로 밀어 되돌리기 어려움. **방어**: 실행 전 `generation_quota` 백업, 멱등 ON CONFLICT, 런치 전(실결제 거의 0) 실행 권고. credit_ledger가 append-only라 이관 자체는 감사 추적 가능.
5. **IAP 영수증 위조** — 클라가 가짜 영수증으로 `grant_credits` 유도. **방어**: `grant_credits`는 RLS 쓰기 정책 없음 → 클라 직접 호출 불가. **오직 service_role Edge(`verify-purchase`)만 호출**하고, 그 Edge는 Apple/Google **서버 API로 영수증 재검증** 후에만 grant. tx id 멱등으로 같은 영수증 재사용 차단. **이 방어는 P1d에서 완성** — Phase 1(P1a-c)은 실 IAP를 노출하지 않으므로 이 리스크는 P1d 진입 전까지 비활성(관리자 grant만 존재).

---

## 10. 테스트 영향 (실행 에이전트 체크리스트)

- **신규**: `supabase/migrations`에는 vitest 테스트가 없다(0001-0003 무테스트). RPC 검증은 `supabase db reset` 후 psql 스모크 또는 Edge 통합으로. **`services/api/src/__tests__/dbMigrations.test.ts`는 `services/api/migrations`(별도 Node/Postgres 스택) 대상이라 supabase/migrations와 무관** — 혼동 금지. (실측: grep에 잡혔으나 다른 마이그레이션 디렉터리.)
- **P1b Edge**: `generate-avatar`는 전용 유닛 테스트 없음(`chromakey_test.ts`만 존재). 수동 E2E(표정 팩 구매→402/성공→실패 환불) 스모크 필요.
- **P1c 도메인**: `packages/shared/src/__tests__/expressionPacks.test.ts`, `prototypeSession.test.ts`, `wallet.test.ts`가 `confirmPrototypeExpressionPackPurchase`/`spendCredits`를 검증 중. **지갑 차감 제거/분리 시 이 3개 테스트 갱신 필수.** `sessionMigrations.test.ts`는 스키마 버전 범프 없으면 무영향.
- **P1c 프로바이더**: `TerrariumSessionProvider.tsx`의 `purchaseExpressionPack` 변경은 별도 프로바이더 테스트 없음(수동 QA). `apiDailyLoopSession.test.ts`/`supabaseGenerationSession.test.ts`는 invoke 계약 변경(request_id 추가) 시 확인.
- **⚠️ services/api QueueDatabaseClient**: 이 Phase는 `services/api`(라이브 폐기, launch-plan §2)를 건드리지 않는다 — 크레딧 원장은 전부 Supabase 스택. `services/api`의 스크립트된 쿼리 큐는 무관하므로 **손대지 말 것**.

검증 명령: `npx vitest run`(도메인) + `npm run typecheck` + `npx tsc -p apps/mobile --noEmit`(P1c 모바일 변경 시). Deno Edge는 CI 밖 수동.

---

## 11. 현재 배포 순서

이 변경은 구 Edge와 새 DB를 동시에 서비스하는 rolling deploy가 아니다. 짧은 생성 유지보수 구간을 먼저 열어야 한다.

1. `supabase secrets set GENERATION_MAINTENANCE_MODE=true` 후 현재 코드의 `generate-avatar`를 먼저 배포한다. 유지보수 모드는 신규 작업을 만들지 않고 503을 반환하며, 일반 생성 요청이 이미 올린 미소유 원본 사진도 정리한다.
2. 생성 중인 `generation_jobs`가 없는지 확인한다. `0013_generation_job_durability.sql`은 자금 출처를 확정할 수 없는 활성 잡이 있으면 추측하지 않고 중단된다.
3. `supabase db push`로 `0013_generation_job_durability.sql`을 배포한다. 이 단계는 구 7-인자 `create_expression_pack_job` 오버로드를 제거하고, 내구성 메타데이터가 없는 활성 잡 생성을 DB 제약으로 차단한다.
4. `supabase secrets set GENERATION_MAINTENANCE_MODE=false` 후 같은 `generate-avatar`를 다시 배포해 신규 RPC 경로를 연다.
5. 일반 생성 1건과 표정 팩 1건을 스모크 테스트한 뒤 앱을 마지막에 배포한다. 새 앱은 모든 일반 생성과 표정 팩 요청에 영속 request ID를 보내므로 구 Edge와 혼용하지 않는다.

원본 사진 정리는 `cleanup_pending` 상태로 별도 추적된다. 삭제가 실패하면 잡을 완료 처리하지 않고 lease 만료 후 재개하며, 삭제와 `finalize_generation_source_cleanup`이 모두 성공해야 `completed`가 된다.
