# 출시 준비도 종합 진단 — "부족한 부분"

2026-07-07. 보안·출시 준비도·엔지니어링 3축 감사 (17 에이전트, critical/high 14건 교차 검증). 원본: wvve5g6r5.

## 한 줄 결론

**콘텐츠·게임필·감정 시스템은 이미 강하다. 부족한 건 "출시 인프라"다** — 버전 관리, 데이터 내구성, 관측성, 법적 표면, 서버 남용 방어. 대부분 코드 품질이 아니라 "아직 안 깐 것"이라 빠르게 메울 수 있다.

## 🔴 즉시 (출시 이전 절대 필수)

1. **git 버전 관리 부재** — 32,000줄이 디스크 한 장에만. → **오늘 해소함**: `git init` + 초기 커밋 완료(1,838 파일, 시크릿 미포함 확인). 다음: GitHub private 원격 push (사용자 계정 필요).
2. **보안 critical 2건** (표정 팩 무한 무료 생성 / requested_states 증폭) → **패치 진행 중** (증폭 상한·fail-closed). 근본 대응(서버 크레딧 원장)은 크레딧 Phase 1.
3. **법적 문서 미발행** — privacy/terms/support가 전부 env 미설정 플레이스홀더, 호스팅된 정책 페이지 없음. 앱스토어 제출 차단. → 정책 페이지 발행 + env 주입 필요.
4. **유저 데이터 기기 단일 저장** — 펫·기억·크레딧이 AsyncStorage 한 키에. 앱 삭제/기기 변경 시 감정 자산 전량 소실 + 서버 아바타 고아화. 익명 auth 세션도 로컬. → 최소 "세션 내보내기" 또는 백업 Phase D.

## 🟠 높음 (출시 직후 첫 주)

5. **관측성 0** — 크래시 SDK·ErrorBoundary·생성 실패율 알림·앱 내 지원 연락처 전부 없음. 출시 후 무계기 비행. → Sentry + ErrorBoundary + 지원 이메일.
6. **서버 데이터 삭제 경로가 프로덕션에서 도달 불가** — Apple 계정 삭제 요건·GDPR 삭제권 미충족(설정 리셋은 로컬만). → delete-account Edge Function.
7. **dev/prod Supabase 미분리 + free_limit=100 QA 상태 잔존** — 프로덕션에 QA 설정이 남아 OpenAI 비용 직격. → prod 프로젝트 분리 + free_limit 1 복원.
8. **익명 계정 무한 생성** (quota·rate-limit 모두 user_id 기준 리셋) → Supabase 익명 로그인 rate limit/CAPTCHA (대시보드 설정, 사용자 액션).
9. **OTA(expo-updates) 부재** — JS 버그 하나에도 심사 재제출. → expo-updates 설정 (재빌드 필요 — 사운드/위젯 빌드와 묶기).

## 🟡 중간 (출시 사이클 내)

- EAS projectId 미연결, 프로덕션 빌드 프로파일 env 주입 경로
- Info.plist Apple 템플릿 위치 권한 문구 + 불필요한 Always 키 (5.1.1 리젝 리스크)
- 상점 'Soon' 플레이스홀더 상품 노출 (2.1 완성도)
- 앱스토어 개인정보 영양표시 최종화 (OpenAI 사진 처리 3rd-party 고지)
- TerrariumHomeScreen 3,158줄 + 매초 전체 리렌더 → 클록 격리·분할
- 배경 PNG 1.6-1.8MB 최적화

## 강점 (감사가 확인)

RLS 견고(본인 행 읽기 전용, 쓰기는 service_role만), 스토리지 소유자 스코프, 표정 팩 소유권 접두어 검사, **리포에 실제 시크릿 커밋 없음**(공개 anon key만, .env gitignored), 소스 사진 안전 분류기, 프롬프트 인젝션 방어(분리된 instructions + strict JSON + 응답 캡), 생성 후 원본 자동 삭제, 광고/트래킹 SDK 0, 권한 문구 품질, 도메인 테스트 119파일. **코드 건강 양호**(TODO 3건, npm audit moderate 10건).

## 권장 순서

1. ✅ git init + 커밋 (완료) → GitHub push
2. 🔄 보안 패치 2건 (진행 중)
3. 법적 페이지 발행 + env 주입 → delete-account 함수
4. Sentry + ErrorBoundary + 지원 이메일
5. prod 환경 분리 + free_limit 복원 + 릴리스 검증 강화
6. 최소 백업(세션 내보내기) 또는 Phase D
7. OTA·EAS·Info.plist 정리 (재빌드 묶음)
