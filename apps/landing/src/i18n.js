const LOCALES = [
  { code: "en-US", label: "English", short: "EN" },
  { code: "ko-KR", label: "한국어", short: "KO" },
  { code: "ja-JP", label: "日本語", short: "JA" },
  { code: "zh-TW", label: "繁體中文", short: "ZH" },
  { code: "de-DE", label: "Deutsch", short: "DE" },
  { code: "fr-FR", label: "Français", short: "FR" },
  { code: "pt-BR", label: "Português (Brasil)", short: "PT" },
  { code: "es-MX", label: "Español (México)", short: "ES" },
];

const LEGAL_LOADERS = {
  "en-US": () => import("../../mobile/src/localization/resources/en-US.ts").then(({ enUS }) => enUS.legal),
  "ko-KR": () => import("../../mobile/src/localization/resources/ko-KR.ts").then(({ koKR }) => koKR.legal),
  "ja-JP": () => import("../../mobile/src/localization/resources/ja-JP.ts").then(({ jaJP }) => jaJP.legal),
  "zh-TW": () => import("../../mobile/src/localization/resources/zh-TW.ts").then(({ zhTW }) => zhTW.legal),
  "de-DE": () => import("../../mobile/src/localization/resources/de-DE.ts").then(({ deDE }) => deDE.legal),
  "fr-FR": () => import("../../mobile/src/localization/resources/fr-FR.ts").then(({ frFR }) => frFR.legal),
  "pt-BR": () => import("../../mobile/src/localization/resources/pt-BR.ts").then(({ ptBR }) => ptBR.legal),
  "es-MX": () => import("../../mobile/src/localization/resources/es-MX.ts").then(({ esMX }) => esMX.legal),
};

const ENGLISH = {
  "meta.landing.title": "Mongchi - Your pet, living in your phone",
  "meta.landing.description": "One photo becomes a tiny pixel friend in Mongchi. Care for them, share your day, and collect little memories in a cozy pocket garden.",
  "meta.privacy.title": "Privacy Policy - Mongchi",
  "meta.privacy.description": "What Mongchi collects, how your pet's photo is handled, and your privacy choices.",
  "meta.terms.title": "Terms of Service - Mongchi",
  "meta.terms.description": "The terms that govern your use of Mongchi, including AI content, photos, purchases, and acceptable use.",
  "a11y.skip": "Skip to content",
  "a11y.header": "Mongchi site header",
  "a11y.home": "Mongchi home",
  "a11y.primaryNav": "Primary navigation",
  "a11y.footerNav": "Footer navigation",
  "a11y.language": "Website language",
  "a11y.preview": "Mongchi app preview",
  "a11y.activities": "Mongchi activities",
  "a11y.features": "Mongchi feature stories",
  "a11y.principles": "Mongchi principles",
  "a11y.storeOptions": "Coming soon download options",
  "nav.start": "How it starts",
  "nav.life": "Life together",
  "nav.download": "Download",
  "nav.home": "Home",
  "nav.privacy": "Privacy",
  "nav.terms": "Terms",
  "hero.kicker": "One photo becomes a tiny friend.",
  "hero.title": "Your pet,<br />living in your phone.",
  "hero.lead": "Turn one favorite photo into a tiny pixel companion who moves into a warm pocket garden.",
  "hero.primary": "Join the garden",
  "hero.secondary": "See how it starts",
  "hero.release": "Coming soon on iOS and Android.",
  "hero.photoCaption": "One real photo",
  "marquee": "MEET · CARE · CHAT · PLAY · REMEMBER · GROW CLOSER",
  "photo.kicker": "How it starts",
  "photo.title": "One favorite photo.<br />Their tiny self.",
  "photo.lead": "Pick a clear photo, meet their pixel version, then step into the garden together.",
  "photo.caption": "Your favorite photo",
  "photo.note": "Your photo is used to create your tiny friend.",
  "photo.policy": "Read the Privacy Policy.",
  "care.kicker": "A world that grows with you",
  "care.title": "Life together,<br />one tiny moment at a time.",
  "care.lead": "Real app screens, surrounded by the same handcrafted pixel world waiting inside.",
  "care.gentleTitle": "Gentle rhythm",
  "care.gentleBody": "No guilt if you miss a day.",
  "care.chatTitle": "Personality-shaped chat",
  "care.chatBody": "Warm AI conversations, clearly disclosed.",
  "care.memoryTitle": "Little memories",
  "care.memoryBody": "Walk finds, expressions, and letters over time.",
  "download.kicker": "The garden opens soon",
  "download.title": "Bring their tiny world home.",
  "download.lead": "Built for quiet check-ins and the feeling of keeping a beloved friend close.",
  "download.coming": "Coming soon on",
  "download.meta": "Free to download · iOS and Android",
  "footer.tagline": "Mongchi - Tiny Pet Terrarium",
  "footer.support": "Support",
  "footer.legalTitle": "Legal",
  "footer.privacy": "Privacy Policy",
  "footer.terms": "Terms of Service",
  "footer.delete": "Data deletion",
  "footer.language": "Language",
  "footer.copyright": "© 2026 DefineYou. All rights reserved.",
  "legal.back": "← Back to Mongchi",
  "legal.eyebrow": "Legal",
  "legal.overview": "The same plain-language overview shown in the app",
  "legal.fullEnglish": "Read the full English legal text",
  "legal.note": "This localized overview matches the in-app notice. The full English text below remains available as the complete published policy. Contact support if you need help in your language.",
  "legal.contact": "Questions? Email support",
  "privacy.heading": "Mongchi Privacy Policy",
  "privacy.updated": "Published July 12, 2026 · Full policy v1.1",
  "terms.heading": "Mongchi Terms of Service",
  "terms.updated": "Published July 12, 2026 · Full terms v1.0",
};

const COPY = {
  "en-US": ENGLISH,
  "ko-KR": {
    ...ENGLISH,
    "meta.landing.title": "Mongchi - 휴대폰 속에 사는 우리 아이",
    "meta.landing.description": "한 장의 사진이 작은 픽셀 친구가 돼요. 포근한 주머니 정원에서 돌보고, 하루를 나누고, 작은 추억을 모아 보세요.",
    "meta.privacy.title": "개인정보 처리방침 - Mongchi",
    "meta.privacy.description": "Mongchi가 처리하는 정보, 반려동물 사진의 사용 방식과 사용자의 선택을 확인하세요.",
    "meta.terms.title": "이용약관 - Mongchi",
    "meta.terms.description": "AI 콘텐츠, 사진, 구매와 허용되는 이용을 포함한 Mongchi 이용약관입니다.",
    "a11y.skip": "본문으로 건너뛰기",
    "a11y.header": "Mongchi 사이트 헤더",
    "a11y.home": "Mongchi 홈",
    "a11y.primaryNav": "주요 메뉴",
    "a11y.footerNav": "푸터 메뉴",
    "a11y.language": "웹사이트 언어",
    "a11y.preview": "Mongchi 앱 미리보기",
    "a11y.activities": "Mongchi 활동",
    "a11y.features": "Mongchi 기능 이야기",
    "a11y.principles": "Mongchi의 원칙",
    "a11y.storeOptions": "출시 예정 다운로드 옵션",
    "nav.start": "시작하는 법",
    "nav.life": "함께하는 일상",
    "nav.download": "다운로드",
    "nav.home": "홈",
    "nav.privacy": "개인정보",
    "nav.terms": "이용약관",
    "hero.kicker": "사진 한 장이 작은 친구가 돼요.",
    "hero.title": "우리 아이가,<br />휴대폰 속에 살아요.",
    "hero.lead": "가장 좋아하는 사진 한 장으로, 따뜻한 주머니 정원에 이사 오는 작은 픽셀 친구를 만나 보세요.",
    "hero.primary": "정원에 함께하기",
    "hero.secondary": "어떻게 시작하나요?",
    "hero.release": "iOS와 Android에서 곧 만나요.",
    "hero.photoCaption": "진짜 사진 한 장",
    "marquee": "만나고 · 돌보고 · 대화하고 · 놀고 · 기억하며 · 가까워져요",
    "photo.kicker": "시작하는 법",
    "photo.title": "가장 좋아하는 사진.<br />그 아이의 작은 모습.",
    "photo.lead": "선명한 사진을 고르고 픽셀로 태어난 모습을 만난 뒤, 함께 정원으로 들어가요.",
    "photo.caption": "가장 좋아하는 사진",
    "photo.note": "사진은 작은 친구를 만드는 데 사용돼요.",
    "photo.policy": "개인정보 처리방침 보기",
    "care.kicker": "함께 자라는 세계",
    "care.title": "함께하는 일상,<br />작은 순간을 하나씩.",
    "care.lead": "실제 앱 화면과 그 안에서 기다리는 손으로 만든 픽셀 세계를 그대로 담았어요.",
    "care.gentleTitle": "다정한 리듬",
    "care.gentleBody": "하루를 놓쳐도 미안해하지 않아도 돼요.",
    "care.chatTitle": "성격을 닮은 대화",
    "care.chatBody": "AI 대화임을 분명히 알리고 따뜻하게 이야기해요.",
    "care.memoryTitle": "작은 추억",
    "care.memoryBody": "산책에서 찾은 것, 표정과 편지가 쌓여요.",
    "download.kicker": "정원이 곧 열려요",
    "download.title": "작은 세계를 집으로 데려오세요.",
    "download.lead": "조용히 안부를 확인하고 사랑하는 친구를 가까이 두는 마음으로 만들었어요.",
    "download.coming": "곧 출시",
    "download.meta": "무료 다운로드 · iOS 및 Android",
    "footer.support": "고객지원",
    "footer.legalTitle": "정책",
    "footer.privacy": "개인정보 처리방침",
    "footer.terms": "이용약관",
    "footer.delete": "데이터 삭제",
    "footer.language": "언어",
    "legal.back": "← Mongchi로 돌아가기",
    "legal.eyebrow": "정책",
    "legal.overview": "앱과 동일한 쉬운 정책 요약",
    "legal.fullEnglish": "전체 영문 정책 보기",
    "legal.note": "이 번역 요약은 앱의 안내와 같습니다. 아래 전체 영문은 게시된 완전한 정책으로 계속 제공됩니다. 한국어 도움이 필요하면 고객지원으로 연락해 주세요.",
    "legal.contact": "문의가 있나요? 이메일 고객지원",
    "privacy.heading": "Mongchi 개인정보 처리방침",
    "privacy.updated": "2026년 7월 12일 게시 · 전체 정책 v1.1",
    "terms.heading": "Mongchi 이용약관",
    "terms.updated": "2026년 7월 12일 게시 · 전체 약관 v1.0",
  },
  "ja-JP": {
    ...ENGLISH,
    "meta.landing.title": "Mongchi - スマホの中で暮らす、うちの子",
    "meta.landing.description": "一枚の写真が小さなピクセルのお友だちに。居心地のよいポケットガーデンで、お世話をして、今日を話して、思い出を集めましょう。",
    "meta.privacy.title": "プライバシーポリシー - Mongchi",
    "meta.privacy.description": "Mongchiが扱うデータ、ペットの写真の処理方法、利用者の選択について説明します。",
    "meta.terms.title": "利用規約 - Mongchi",
    "meta.terms.description": "AIコンテンツ、写真、購入、利用上のルールを含むMongchiの利用規約です。",
    "a11y.skip": "本文へ移動",
    "a11y.header": "Mongchiサイトヘッダー",
    "a11y.home": "Mongchiホーム",
    "a11y.primaryNav": "メインナビゲーション",
    "a11y.footerNav": "フッターナビゲーション",
    "a11y.language": "ウェブサイトの言語",
    "a11y.preview": "Mongchiアプリのプレビュー",
    "a11y.activities": "Mongchiでできること",
    "a11y.features": "Mongchiの機能紹介",
    "a11y.principles": "Mongchiの考え方",
    "a11y.storeOptions": "配信予定のストア",
    "nav.start": "はじまり",
    "nav.life": "一緒の毎日",
    "nav.download": "ダウンロード",
    "nav.home": "ホーム",
    "nav.privacy": "プライバシー",
    "nav.terms": "利用規約",
    "hero.kicker": "一枚の写真が、小さなお友だちに。",
    "hero.title": "うちの子が、<br />スマホの中で暮らす。",
    "hero.lead": "お気に入りの一枚から、あたたかなポケットガーデンに引っ越してくる小さなピクセルのお友だちを作れます。",
    "hero.primary": "庭へ行こう",
    "hero.secondary": "はじまりを見る",
    "hero.release": "iOSとAndroidで近日配信。",
    "hero.photoCaption": "本物の写真一枚",
    "marquee": "出会う · お世話 · おしゃべり · 遊ぶ · 思い出 · もっと近くに",
    "photo.kicker": "はじまり",
    "photo.title": "お気に入りの一枚。<br />小さなあの子の姿。",
    "photo.lead": "はっきり写った写真を選び、ピクセルの姿と出会ったら、一緒に庭へ入りましょう。",
    "photo.caption": "お気に入りの写真",
    "photo.note": "写真は小さなお友だちを作るために使います。",
    "photo.policy": "プライバシーポリシーを見る",
    "care.kicker": "一緒に育つ世界",
    "care.title": "一緒の毎日を、<br />小さなひとときずつ。",
    "care.lead": "実際のアプリ画面と、その中で待つ手作りのピクセル世界をそのまま紹介します。",
    "care.gentleTitle": "やさしいリズム",
    "care.gentleBody": "一日休んでも責められません。",
    "care.chatTitle": "性格を映すチャット",
    "care.chatBody": "AI生成だと分かる、あたたかな会話。",
    "care.memoryTitle": "小さな思い出",
    "care.memoryBody": "散歩の発見、表情、手紙が少しずつ増えます。",
    "download.kicker": "庭はもうすぐ開きます",
    "download.title": "小さな世界を、おうちへ。",
    "download.lead": "そっと様子を見に行き、大切な存在を近くに感じられるように作りました。",
    "download.coming": "近日配信",
    "download.meta": "無料ダウンロード · iOS / Android",
    "footer.support": "サポート",
    "footer.legalTitle": "法的情報",
    "footer.privacy": "プライバシーポリシー",
    "footer.terms": "利用規約",
    "footer.delete": "データの削除",
    "footer.language": "言語",
    "legal.back": "← Mongchiに戻る",
    "legal.eyebrow": "法的情報",
    "legal.overview": "アプリと同じ、わかりやすい概要",
    "legal.fullEnglish": "英語の全文を読む",
    "legal.note": "この翻訳概要はアプリ内の案内と同じ内容です。下の英語全文は、公開された完全なポリシーとして引き続き閲覧できます。日本語でのサポートが必要な場合はお問い合わせください。",
    "legal.contact": "ご質問はメールサポートへ",
    "privacy.heading": "Mongchi プライバシーポリシー",
    "privacy.updated": "2026年7月12日公開 · 全文 v1.1",
    "terms.heading": "Mongchi 利用規約",
    "terms.updated": "2026年7月12日公開 · 全文 v1.0",
  },
  "zh-TW": {
    ...ENGLISH,
    "meta.landing.title": "Mongchi - 住在手機裡的毛孩",
    "meta.landing.description": "一張照片變成小小像素朋友。在溫暖的口袋花園裡照顧牠、分享一天並收藏回憶。",
    "meta.privacy.title": "隱私權政策 - Mongchi",
    "meta.privacy.description": "了解Mongchi處理哪些資料、如何使用寵物照片，以及你擁有的選擇。",
    "meta.terms.title": "服務條款 - Mongchi",
    "meta.terms.description": "包含AI內容、照片、購買與使用規範的Mongchi服務條款。",
    "a11y.skip": "跳到主要內容",
    "a11y.header": "Mongchi網站頁首",
    "a11y.home": "Mongchi首頁",
    "a11y.primaryNav": "主要導覽",
    "a11y.footerNav": "頁尾導覽",
    "a11y.language": "網站語言",
    "a11y.preview": "Mongchi應用程式預覽",
    "a11y.activities": "Mongchi活動",
    "a11y.features": "Mongchi功能故事",
    "a11y.principles": "Mongchi原則",
    "a11y.storeOptions": "即將推出的下載選項",
    "nav.start": "如何開始",
    "nav.life": "一起生活",
    "nav.download": "下載",
    "nav.home": "首頁",
    "nav.privacy": "隱私權",
    "nav.terms": "條款",
    "hero.kicker": "一張照片，變成小小朋友。",
    "hero.title": "你的毛孩，<br />住進手機裡。",
    "hero.lead": "用一張最喜歡的照片，讓小小像素夥伴搬進溫暖的口袋花園。",
    "hero.primary": "走進花園",
    "hero.secondary": "看看如何開始",
    "hero.release": "即將登上iOS與Android。",
    "hero.photoCaption": "一張真實照片",
    "marquee": "相遇 · 照顧 · 聊天 · 玩耍 · 回憶 · 更靠近彼此",
    "photo.kicker": "如何開始",
    "photo.title": "最喜歡的一張照片。<br />牠的小小模樣。",
    "photo.lead": "選一張清楚的照片，和像素版本的牠相遇，再一起走進花園。",
    "photo.caption": "你最喜歡的照片",
    "photo.note": "照片只用來創造你的小小朋友。",
    "photo.policy": "閱讀隱私權政策",
    "care.kicker": "與你一起成長的世界",
    "care.title": "一起生活，<br />收藏每個小小時刻。",
    "care.lead": "真正的應用程式畫面，周圍就是等待你走進的手作像素世界。",
    "care.gentleTitle": "溫柔的節奏",
    "care.gentleBody": "錯過一天也不必愧疚。",
    "care.chatTitle": "貼近個性的聊天",
    "care.chatBody": "清楚標示AI生成的溫暖對話。",
    "care.memoryTitle": "小小回憶",
    "care.memoryBody": "散步發現、表情與信件慢慢累積。",
    "download.kicker": "花園即將開放",
    "download.title": "把牠的小小世界帶回家。",
    "download.lead": "為安靜的問候，以及把心愛朋友留在身邊的感覺而打造。",
    "download.coming": "即將推出",
    "download.meta": "免費下載 · iOS與Android",
    "footer.support": "支援",
    "footer.legalTitle": "法律資訊",
    "footer.privacy": "隱私權政策",
    "footer.terms": "服務條款",
    "footer.delete": "刪除資料",
    "footer.language": "語言",
    "legal.back": "← 返回Mongchi",
    "legal.eyebrow": "法律資訊",
    "legal.overview": "與應用程式相同的易讀概要",
    "legal.fullEnglish": "閱讀完整英文法律文字",
    "legal.note": "此翻譯概要與應用程式內的說明一致。下方完整英文內容仍是正式發布的完整政策。如需語言協助，請聯絡支援團隊。",
    "legal.contact": "有問題嗎？寄信給支援團隊",
    "privacy.heading": "Mongchi 隱私權政策",
    "privacy.updated": "發布於2026年7月12日 · 完整政策v1.1",
    "terms.heading": "Mongchi 服務條款",
    "terms.updated": "發布於2026年7月12日 · 完整條款v1.0",
  },
  "de-DE": {
    ...ENGLISH,
    "meta.landing.title": "Mongchi - Dein Tier lebt in deinem Handy",
    "meta.landing.description": "Ein Foto wird zu einem kleinen Pixelfreund. Kümmere dich um ihn, erzähle von deinem Tag und sammle Erinnerungen in einem gemütlichen Taschengarten.",
    "meta.privacy.title": "Datenschutzerklärung - Mongchi",
    "meta.privacy.description": "Welche Daten Mongchi verarbeitet, wie das Foto deines Tieres behandelt wird und welche Wahlmöglichkeiten du hast.",
    "meta.terms.title": "Nutzungsbedingungen - Mongchi",
    "meta.terms.description": "Die Mongchi-Nutzungsbedingungen zu KI-Inhalten, Fotos, Käufen und zulässiger Nutzung.",
    "a11y.skip": "Zum Inhalt springen",
    "a11y.header": "Mongchi-Seitenkopf",
    "a11y.home": "Mongchi-Startseite",
    "a11y.primaryNav": "Hauptnavigation",
    "a11y.footerNav": "Fußnavigation",
    "a11y.language": "Websitesprache",
    "a11y.preview": "Mongchi-App-Vorschau",
    "a11y.activities": "Mongchi-Aktivitäten",
    "a11y.features": "Mongchi-Funktionen",
    "a11y.principles": "Mongchi-Grundsätze",
    "a11y.storeOptions": "Bald verfügbare Downloads",
    "nav.start": "So beginnt es",
    "nav.life": "Gemeinsamer Alltag",
    "nav.download": "Download",
    "nav.home": "Start",
    "nav.privacy": "Datenschutz",
    "nav.terms": "Bedingungen",
    "hero.kicker": "Ein Foto wird zu einem kleinen Freund.",
    "hero.title": "Dein Tier,<br />lebendig in deinem Handy.",
    "hero.lead": "Verwandle ein Lieblingsfoto in einen kleinen Pixelgefährten, der in einen warmen Taschengarten einzieht.",
    "hero.primary": "In den Garten",
    "hero.secondary": "So beginnt es",
    "hero.release": "Bald für iOS und Android.",
    "hero.photoCaption": "Ein echtes Foto",
    "marquee": "TREFFEN · PFLEGEN · REDEN · SPIELEN · ERINNERN · NÄHERKOMMEN",
    "photo.kicker": "So beginnt es",
    "photo.title": "Ein Lieblingsfoto.<br />Sein kleines Ich.",
    "photo.lead": "Wähle ein klares Foto, lerne die Pixelversion kennen und betretet gemeinsam den Garten.",
    "photo.caption": "Dein Lieblingsfoto",
    "photo.note": "Dein Foto wird verwendet, um deinen kleinen Freund zu erschaffen.",
    "photo.policy": "Datenschutzerklärung lesen",
    "care.kicker": "Eine Welt, die mit euch wächst",
    "care.title": "Gemeinsamer Alltag,<br />ein kleiner Moment nach dem anderen.",
    "care.lead": "Echte App-Bildschirme in derselben handgefertigten Pixelwelt, die drinnen auf euch wartet.",
    "care.gentleTitle": "Sanfter Rhythmus",
    "care.gentleBody": "Kein schlechtes Gewissen, wenn ein Tag ausfällt.",
    "care.chatTitle": "Charaktervoller Chat",
    "care.chatBody": "Warme KI-Gespräche, klar gekennzeichnet.",
    "care.memoryTitle": "Kleine Erinnerungen",
    "care.memoryBody": "Spaziergangsfunde, Ausdrücke und Briefe mit der Zeit.",
    "download.kicker": "Der Garten öffnet bald",
    "download.title": "Hol seine kleine Welt nach Hause.",
    "download.lead": "Für ruhige Besuche und das Gefühl, einen geliebten Freund nah bei dir zu haben.",
    "download.coming": "Bald bei",
    "download.meta": "Kostenloser Download · iOS und Android",
    "footer.support": "Support",
    "footer.legalTitle": "Rechtliches",
    "footer.privacy": "Datenschutzerklärung",
    "footer.terms": "Nutzungsbedingungen",
    "footer.delete": "Daten löschen",
    "footer.language": "Sprache",
    "legal.back": "← Zurück zu Mongchi",
    "legal.eyebrow": "Rechtliches",
    "legal.overview": "Dieselbe verständliche Übersicht wie in der App",
    "legal.fullEnglish": "Vollständigen englischen Rechtstext lesen",
    "legal.note": "Diese übersetzte Übersicht entspricht dem Hinweis in der App. Der vollständige englische Text bleibt unten als vollständig veröffentlichte Richtlinie verfügbar. Wende dich an den Support, wenn du Hilfe brauchst.",
    "legal.contact": "Fragen? E-Mail an den Support",
    "privacy.heading": "Mongchi Datenschutzerklärung",
    "privacy.updated": "Veröffentlicht am 12. Juli 2026 · Volltext v1.1",
    "terms.heading": "Mongchi Nutzungsbedingungen",
    "terms.updated": "Veröffentlicht am 12. Juli 2026 · Volltext v1.0",
  },
  "fr-FR": {
    ...ENGLISH,
    "meta.landing.title": "Mongchi - Votre compagnon vit dans votre téléphone",
    "meta.landing.description": "Une photo devient un petit compagnon pixelisé. Prenez-en soin, racontez votre journée et collectionnez des souvenirs dans un jardin de poche.",
    "meta.privacy.title": "Politique de confidentialité - Mongchi",
    "meta.privacy.description": "Les données traitées par Mongchi, l'utilisation de la photo de votre compagnon et vos choix.",
    "meta.terms.title": "Conditions d'utilisation - Mongchi",
    "meta.terms.description": "Les conditions de Mongchi concernant le contenu IA, les photos, les achats et l'utilisation acceptable.",
    "a11y.skip": "Aller au contenu",
    "a11y.header": "En-tête du site Mongchi",
    "a11y.home": "Accueil Mongchi",
    "a11y.primaryNav": "Navigation principale",
    "a11y.footerNav": "Navigation du pied de page",
    "a11y.language": "Langue du site",
    "a11y.preview": "Aperçu de l'application Mongchi",
    "a11y.activities": "Activités Mongchi",
    "a11y.features": "Fonctionnalités Mongchi",
    "a11y.principles": "Principes Mongchi",
    "a11y.storeOptions": "Téléchargements bientôt disponibles",
    "nav.start": "Le début",
    "nav.life": "La vie ensemble",
    "nav.download": "Télécharger",
    "nav.home": "Accueil",
    "nav.privacy": "Confidentialité",
    "nav.terms": "Conditions",
    "hero.kicker": "Une photo devient un petit compagnon.",
    "hero.title": "Votre compagnon,<br />dans votre téléphone.",
    "hero.lead": "Transformez une photo préférée en petit compagnon pixelisé qui emménage dans un chaleureux jardin de poche.",
    "hero.primary": "Entrer dans le jardin",
    "hero.secondary": "Voir le début",
    "hero.release": "Bientôt sur iOS et Android.",
    "hero.photoCaption": "Une vraie photo",
    "marquee": "RENCONTRER · SOIGNER · DISCUTER · JOUER · SE SOUVENIR · SE RAPPROCHER",
    "photo.kicker": "Le début",
    "photo.title": "Une photo préférée.<br />Sa petite version.",
    "photo.lead": "Choisissez une photo nette, rencontrez sa version pixelisée, puis entrez ensemble dans le jardin.",
    "photo.caption": "Votre photo préférée",
    "photo.note": "Votre photo sert à créer votre petit compagnon.",
    "photo.policy": "Lire la politique de confidentialité",
    "care.kicker": "Un monde qui grandit avec vous",
    "care.title": "La vie ensemble,<br />un petit moment à la fois.",
    "care.lead": "De vrais écrans de l'application, entourés du même monde pixelisé fait main qui vous attend.",
    "care.gentleTitle": "Rythme bienveillant",
    "care.gentleBody": "Aucune culpabilité si vous manquez une journée.",
    "care.chatTitle": "Discussion à son image",
    "care.chatBody": "Des échanges chaleureux avec l'IA, clairement signalés.",
    "care.memoryTitle": "Petits souvenirs",
    "care.memoryBody": "Trouvailles de promenade, expressions et lettres au fil du temps.",
    "download.kicker": "Le jardin ouvre bientôt",
    "download.title": "Ramenez son petit monde chez vous.",
    "download.lead": "Conçu pour de douces visites et le sentiment de garder un être aimé tout près.",
    "download.coming": "Bientôt sur",
    "download.meta": "Téléchargement gratuit · iOS et Android",
    "footer.support": "Assistance",
    "footer.legalTitle": "Mentions légales",
    "footer.privacy": "Politique de confidentialité",
    "footer.terms": "Conditions d'utilisation",
    "footer.delete": "Suppression des données",
    "footer.language": "Langue",
    "legal.back": "← Retour à Mongchi",
    "legal.eyebrow": "Mentions légales",
    "legal.overview": "Le même résumé clair que dans l'application",
    "legal.fullEnglish": "Lire le texte juridique complet en anglais",
    "legal.note": "Ce résumé traduit correspond aux informations de l'application. Le texte anglais complet reste disponible ci-dessous comme politique publiée intégrale. Contactez l'assistance si vous avez besoin d'aide.",
    "legal.contact": "Une question ? Écrire à l'assistance",
    "privacy.heading": "Politique de confidentialité de Mongchi",
    "privacy.updated": "Publiée le 12 juillet 2026 · Texte complet v1.1",
    "terms.heading": "Conditions d'utilisation de Mongchi",
    "terms.updated": "Publiées le 12 juillet 2026 · Texte complet v1.0",
  },
  "pt-BR": {
    ...ENGLISH,
    "meta.landing.title": "Mongchi - Seu bichinho vivendo no celular",
    "meta.landing.description": "Uma foto vira um pequeno amigo em pixel. Cuide dele, conte sobre seu dia e guarde lembranças em um jardim de bolso aconchegante.",
    "meta.privacy.title": "Política de Privacidade - Mongchi",
    "meta.privacy.description": "O que o Mongchi processa, como a foto do seu bichinho é tratada e quais são suas escolhas.",
    "meta.terms.title": "Termos de Serviço - Mongchi",
    "meta.terms.description": "Os termos do Mongchi sobre conteúdo de IA, fotos, compras e uso aceitável.",
    "a11y.skip": "Pular para o conteúdo",
    "a11y.header": "Cabeçalho do site Mongchi",
    "a11y.home": "Início do Mongchi",
    "a11y.primaryNav": "Navegação principal",
    "a11y.footerNav": "Navegação do rodapé",
    "a11y.language": "Idioma do site",
    "a11y.preview": "Prévia do app Mongchi",
    "a11y.activities": "Atividades do Mongchi",
    "a11y.features": "Histórias do Mongchi",
    "a11y.principles": "Princípios do Mongchi",
    "a11y.storeOptions": "Opções de download em breve",
    "nav.start": "Como começa",
    "nav.life": "Vida juntos",
    "nav.download": "Baixar",
    "nav.home": "Início",
    "nav.privacy": "Privacidade",
    "nav.terms": "Termos",
    "hero.kicker": "Uma foto vira um pequeno amigo.",
    "hero.title": "Seu bichinho,<br />vivendo no seu celular.",
    "hero.lead": "Transforme uma foto favorita em um pequeno companheiro de pixel que se muda para um jardim de bolso acolhedor.",
    "hero.primary": "Entrar no jardim",
    "hero.secondary": "Ver como começa",
    "hero.release": "Em breve no iOS e Android.",
    "hero.photoCaption": "Uma foto de verdade",
    "marquee": "CONHECER · CUIDAR · CONVERSAR · BRINCAR · LEMBRAR · FICAR MAIS PERTO",
    "photo.kicker": "Como começa",
    "photo.title": "Uma foto favorita.<br />A versão pequenininha dele.",
    "photo.lead": "Escolha uma foto nítida, conheça a versão em pixel e entre no jardim com seu amigo.",
    "photo.caption": "Sua foto favorita",
    "photo.note": "Sua foto é usada para criar seu pequeno amigo.",
    "photo.policy": "Ler a Política de Privacidade",
    "care.kicker": "Um mundo que cresce com vocês",
    "care.title": "Vida juntos,<br />um pequeno momento de cada vez.",
    "care.lead": "Telas reais do app cercadas pelo mesmo mundo em pixel feito à mão que espera lá dentro.",
    "care.gentleTitle": "Ritmo gentil",
    "care.gentleBody": "Sem culpa se você perder um dia.",
    "care.chatTitle": "Conversa com personalidade",
    "care.chatBody": "Conversas acolhedoras com IA, claramente identificadas.",
    "care.memoryTitle": "Pequenas lembranças",
    "care.memoryBody": "Achados de passeio, expressões e cartas com o tempo.",
    "download.kicker": "O jardim abre em breve",
    "download.title": "Leve o mundinho dele para casa.",
    "download.lead": "Feito para visitas tranquilas e para sentir um amigo querido sempre por perto.",
    "download.coming": "Em breve na",
    "download.meta": "Download grátis · iOS e Android",
    "footer.support": "Suporte",
    "footer.legalTitle": "Informações legais",
    "footer.privacy": "Política de Privacidade",
    "footer.terms": "Termos de Serviço",
    "footer.delete": "Exclusão de dados",
    "footer.language": "Idioma",
    "legal.back": "← Voltar ao Mongchi",
    "legal.eyebrow": "Informações legais",
    "legal.overview": "O mesmo resumo simples mostrado no app",
    "legal.fullEnglish": "Ler o texto jurídico completo em inglês",
    "legal.note": "Este resumo traduzido corresponde ao aviso no app. O texto completo em inglês continua disponível abaixo como a política publicada integral. Fale com o suporte se precisar de ajuda.",
    "legal.contact": "Dúvidas? Envie um e-mail ao suporte",
    "privacy.heading": "Política de Privacidade do Mongchi",
    "privacy.updated": "Publicada em 12 de julho de 2026 · Texto completo v1.1",
    "terms.heading": "Termos de Serviço do Mongchi",
    "terms.updated": "Publicados em 12 de julho de 2026 · Texto completo v1.0",
  },
  "es-MX": {
    ...ENGLISH,
    "meta.landing.title": "Mongchi - Tu mascota vive en tu teléfono",
    "meta.landing.description": "Una foto se convierte en un pequeño amigo de píxeles. Cuídalo, cuéntale tu día y guarda recuerdos en un acogedor jardín de bolsillo.",
    "meta.privacy.title": "Política de Privacidad - Mongchi",
    "meta.privacy.description": "Qué datos procesa Mongchi, cómo se trata la foto de tu mascota y cuáles son tus opciones.",
    "meta.terms.title": "Términos de Servicio - Mongchi",
    "meta.terms.description": "Los términos de Mongchi sobre contenido de IA, fotos, compras y uso aceptable.",
    "a11y.skip": "Saltar al contenido",
    "a11y.header": "Encabezado del sitio de Mongchi",
    "a11y.home": "Inicio de Mongchi",
    "a11y.primaryNav": "Navegación principal",
    "a11y.footerNav": "Navegación del pie de página",
    "a11y.language": "Idioma del sitio",
    "a11y.preview": "Vista previa de la app Mongchi",
    "a11y.activities": "Actividades de Mongchi",
    "a11y.features": "Historias de funciones de Mongchi",
    "a11y.principles": "Principios de Mongchi",
    "a11y.storeOptions": "Opciones de descarga próximamente",
    "nav.start": "Cómo empieza",
    "nav.life": "La vida juntos",
    "nav.download": "Descargar",
    "nav.home": "Inicio",
    "nav.privacy": "Privacidad",
    "nav.terms": "Términos",
    "hero.kicker": "Una foto se convierte en un pequeño amigo.",
    "hero.title": "Tu mascota,<br />viviendo en tu teléfono.",
    "hero.lead": "Convierte una foto favorita en un pequeño compañero de píxeles que se muda a un cálido jardín de bolsillo.",
    "hero.primary": "Entrar al jardín",
    "hero.secondary": "Ver cómo empieza",
    "hero.release": "Próximamente en iOS y Android.",
    "hero.photoCaption": "Una foto real",
    "marquee": "CONOCER · CUIDAR · CHARLAR · JUGAR · RECORDAR · ACERCARSE",
    "photo.kicker": "Cómo empieza",
    "photo.title": "Una foto favorita.<br />Su pequeña versión.",
    "photo.lead": "Elige una foto clara, conoce su versión en píxeles y entren juntos al jardín.",
    "photo.caption": "Tu foto favorita",
    "photo.note": "Tu foto se usa para crear a tu pequeño amigo.",
    "photo.policy": "Leer la Política de Privacidad",
    "care.kicker": "Un mundo que crece con ustedes",
    "care.title": "La vida juntos,<br />un pequeño momento a la vez.",
    "care.lead": "Pantallas reales de la app rodeadas por el mismo mundo de píxeles hecho a mano que espera dentro.",
    "care.gentleTitle": "Ritmo amable",
    "care.gentleBody": "Sin culpa si te saltas un día.",
    "care.chatTitle": "Chat con personalidad",
    "care.chatBody": "Conversaciones cálidas con IA, claramente identificadas.",
    "care.memoryTitle": "Pequeños recuerdos",
    "care.memoryBody": "Hallazgos del paseo, expresiones y cartas con el tiempo.",
    "download.kicker": "El jardín abre pronto",
    "download.title": "Lleva su pequeño mundo a casa.",
    "download.lead": "Hecho para visitas tranquilas y para sentir cerca a un amigo querido.",
    "download.coming": "Próximamente en",
    "download.meta": "Descarga gratis · iOS y Android",
    "footer.support": "Soporte",
    "footer.legalTitle": "Información legal",
    "footer.privacy": "Política de Privacidad",
    "footer.terms": "Términos de Servicio",
    "footer.delete": "Eliminación de datos",
    "footer.language": "Idioma",
    "legal.back": "← Volver a Mongchi",
    "legal.eyebrow": "Información legal",
    "legal.overview": "El mismo resumen claro que aparece en la app",
    "legal.fullEnglish": "Leer el texto legal completo en inglés",
    "legal.note": "Este resumen traducido coincide con el aviso de la app. El texto completo en inglés sigue disponible abajo como la política publicada integral. Comunícate con soporte si necesitas ayuda.",
    "legal.contact": "¿Tienes preguntas? Envía un correo a soporte",
    "privacy.heading": "Política de Privacidad de Mongchi",
    "privacy.updated": "Publicada el 12 de julio de 2026 · Texto completo v1.1",
    "terms.heading": "Términos de Servicio de Mongchi",
    "terms.updated": "Publicados el 12 de julio de 2026 · Texto completo v1.0",
  },
};

function normalizeLocale(rawLocale) {
  const value = String(rawLocale || "").replace("_", "-").toLowerCase();
  if (value.startsWith("ko")) return "ko-KR";
  if (value.startsWith("ja")) return "ja-JP";
  if (value.startsWith("zh")) return "zh-TW";
  if (value.startsWith("de")) return "de-DE";
  if (value.startsWith("fr")) return "fr-FR";
  if (value.startsWith("pt")) return "pt-BR";
  if (value.startsWith("es")) return "es-MX";
  return "en-US";
}

function initialLocale() {
  const requested = new URL(window.location.href).searchParams.get("lang");
  if (requested) return normalizeLocale(requested);

  const saved = window.localStorage.getItem("mongchi.websiteLocale");
  if (saved) return normalizeLocale(saved);

  for (const locale of window.navigator.languages || [window.navigator.language]) {
    const normalized = normalizeLocale(locale);
    if (normalized !== "en-US" || String(locale).toLowerCase().startsWith("en")) return normalized;
  }
  return "en-US";
}

function copyFor(locale) {
  return COPY[locale] || COPY["en-US"];
}

function updateLocalizedLinks(locale) {
  document.querySelectorAll("a[data-localized-link]").forEach((link) => {
    const originalHref = link.dataset.baseHref || link.getAttribute("href");
    if (!originalHref || originalHref.startsWith("#") || originalHref.startsWith("mailto:")) return;
    link.dataset.baseHref = originalHref;
    const url = new URL(originalHref, window.location.origin);
    url.searchParams.set("lang", locale);
    link.setAttribute("href", `${url.pathname}${url.search}${url.hash}`);
  });
}

function renderLanguageMenus(locale) {
  const activeLocale = LOCALES.find(({ code }) => code === locale) || LOCALES[0];

  document.querySelectorAll("[data-language-menu]").forEach((menu) => {
    menu.querySelectorAll("[data-language-current]").forEach((label) => {
      label.textContent = activeLocale.label;
    });
    menu.querySelectorAll("[data-language-current-short]").forEach((label) => {
      label.textContent = activeLocale.short;
    });

    const panel = menu.querySelector("[data-language-options]");
    if (!panel) return;

    if (panel.children.length === 0) {
      LOCALES.forEach(({ code, label, short }) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "language-menu__option";
        option.dataset.localeOption = code;
        option.setAttribute("role", "option");

        appendTextElement(option, "span", "language-menu__option-label", label);
        appendTextElement(option, "span", "language-menu__option-code", short);
        panel.append(option);
      });
    }

    panel.querySelectorAll("[data-locale-option]").forEach((option) => {
      const selected = option.dataset.localeOption === locale;
      option.setAttribute("aria-selected", String(selected));
      option.tabIndex = 0;
    });
  });
}

function applyCopy(locale, page) {
  const copy = copyFor(locale);
  document.documentElement.lang = locale;
  document.body.dataset.locale = locale;
  document.title = copy[`meta.${page}.title`];

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const translated = copy[element.dataset.i18n];
    if (translated) element.textContent = translated;
  });

  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    const translated = copy[element.dataset.i18nHtml];
    if (translated) element.innerHTML = translated;
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
    const [attribute, key] = element.dataset.i18nAttr.split(":");
    const translated = copy[key];
    if (attribute && translated) element.setAttribute(attribute, translated);
  });

  document.querySelectorAll('[data-i18n-content="description"]').forEach((element) => {
    element.setAttribute("content", copy[`meta.${page}.description`]);
  });

  renderLanguageMenus(locale);
  updateLocalizedLinks(locale);
  return copy;
}

function appendTextElement(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

async function renderLegalOverview(page, locale, copy) {
  const container = document.querySelector("[data-legal-overview]");
  if (!container) return;

  const legal = await LEGAL_LOADERS[locale]();
  if (document.body.dataset.locale !== locale) return;
  const content = legal[page];
  const items = Object.values(content.items);
  const sectionKeys = page === "privacy"
    ? [["sharingTitle", "sharingBody"], ["rightsTitle", "rightsBody"], ["childrenTitle", "childrenBody"]]
    : [["useTitle", "useBody"], ["portabilityTitle", "portabilityBody"], ["disclaimerTitle", "disclaimerBody"]];

  container.replaceChildren();
  appendTextElement(container, "p", "legal-overview-label", copy["legal.overview"]);
  appendTextElement(container, "h2", "legal-overview-title", content.title);
  appendTextElement(container, "p", "legal-overview-meta", content.updated);

  const list = document.createElement("ul");
  list.className = "legal-overview-list";
  items.forEach((item) => appendTextElement(list, "li", "", item));
  container.append(list);

  const sections = document.createElement("div");
  sections.className = "legal-overview-sections";
  sectionKeys.forEach(([titleKey, bodyKey]) => {
    const section = document.createElement("section");
    section.className = "legal-overview-card";
    appendTextElement(section, "h3", "", content.sections[titleKey]);
    appendTextElement(section, "p", "", content.sections[bodyKey]);
    sections.append(section);
  });
  container.append(sections);

  const note = appendTextElement(container, "p", "legal-localization-note", copy["legal.note"]);
  note.setAttribute("role", "note");
  const contact = document.createElement("a");
  contact.className = "legal-support-link";
  contact.href = "mailto:lucas@define-you.com";
  contact.textContent = `${copy["legal.contact"]}: lucas@define-you.com`;
  container.append(contact);

  const fullPolicy = document.querySelector("[data-full-english]");
  if (fullPolicy) fullPolicy.open = locale === "en-US";
}

async function setLocale(locale, page, persist = false) {
  const normalized = normalizeLocale(locale);
  if (persist) window.localStorage.setItem("mongchi.websiteLocale", normalized);
  const copy = applyCopy(normalized, page);
  if (page === "privacy" || page === "terms") await renderLegalOverview(page, normalized, copy);
}

export async function initI18n(page) {
  const locale = initialLocale();
  await setLocale(locale, page);

  document.querySelectorAll("[data-language-menu]").forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      document.querySelectorAll("[data-language-menu][open]").forEach((otherMenu) => {
        if (otherMenu !== menu) otherMenu.open = false;
      });
    });

    menu.addEventListener("click", async (event) => {
      const option = event.target.closest("[data-locale-option]");
      if (!option) return;

      const nextLocale = normalizeLocale(option.dataset.localeOption);
      const url = new URL(window.location.href);
      url.searchParams.set("lang", nextLocale);
      window.history.replaceState({}, "", url);
      await setLocale(nextLocale, page, true);
      menu.open = false;
      menu.querySelector("summary")?.focus();
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-language-menu]")) return;
    document.querySelectorAll("[data-language-menu][open]").forEach((menu) => {
      menu.open = false;
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll("[data-language-menu][open]").forEach((menu) => {
      menu.open = false;
      menu.querySelector("summary")?.focus();
    });
  });
}
