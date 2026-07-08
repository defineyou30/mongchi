import type { ReactionRule } from "../domain/reactions";

// Expanded starter catalog: stat-band variants, personality/talking-style/species
// flavors, and previously-unauthored categories. Appended AFTER the base rules in
// starterReactionRules so equal-score ties keep preferring the base rule.

const koExpandedReactionRules: ReactionRule[] = [
  // --- 스탯 구간 세분화 ---
  {
    id: "ko_hungry_critical_001",
    locale: "ko-KR",
    category: "hungry_low",
    conditions: { satietyMax: 18 },
    lines: [
      "배가 너무 고파서 꼬리 흔들 힘도 아껴두는 중이야.",
      "밥그릇 긴급 상황이야. 작지만 진지해.",
      "머릿속이 온통 밥 생각뿐이야. 밥, 밥, 밥.",
      "뱃속에서 공식 요청서가 도착했어. 제목: 저녁밥."
    ],
    animation: "hungry",
    priority: 96,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_hungry_low_002",
    locale: "ko-KR",
    category: "hungry_low",
    conditions: { satietyMax: 35 },
    lines: [
      "밥 냄새 상상만 세 번째 하는 중이야.",
      "간식이든 밥이든, 지금은 뭐든 환영이야.",
      "배꼽시계가 조용히 울리기 시작했어."
    ],
    animation: "hungry",
    priority: 88,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "ko_hungry_soft_001",
    locale: "ko-KR",
    category: "hungry_low",
    conditions: { satietyMin: 36, satietyMax: 52 },
    lines: [
      "아직 괜찮은데, 조금 있으면 밥 생각이 날 것 같아.",
      "살짝 출출해지기 시작했어. 아주 살짝.",
      "간식 하나 정도 들어갈 자리는 남겨뒀어."
    ],
    animation: "idle",
    priority: 60,
    cooldownHours: 4,
    safetyLevel: "safe"
  },
  {
    id: "ko_energy_critical_001",
    locale: "ko-KR",
    category: "energy_low",
    conditions: { energyMax: 15 },
    lines: [
      "발바닥이 오늘은 그만 걷자고 했어. 쉬어야 할 것 같아.",
      "배터리가 거의 없어. 쿠션이 필요해.",
      "눈 깜빡이는 것도 큰일인 하루야. 조용히 쉬고 싶어."
    ],
    animation: "sleepy",
    priority: 94,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "ko_sad_low_001",
    locale: "ko-KR",
    category: "affection_low",
    conditions: { happinessMax: 30 },
    lines: [
      "오늘은 마음이 조금 흐린 날이야. 옆에 있어 줄래?",
      "꼬리가 흔드는 법을 잠깐 잊었어. 같이 놀면 기억날 것 같아.",
      "작은 한숨을 쉬는 중이야. 네가 보이면 반은 나아져."
    ],
    animation: "sad",
    priority: 88,
    cooldownHours: 4,
    safetyLevel: "safe"
  },
  {
    id: "ko_messy_low_001",
    locale: "ko-KR",
    category: "affection_low",
    conditions: { cleanlinessMax: 28 },
    lines: [
      "털이 자기 마음대로 하고 있어. 도와줘.",
      "구석에서 뒹굴다가 먼지 친구를 데려왔어. 목욕이 필요해.",
      "지금 나 반쯤은 먼지뭉치야. 씻겨주면 반짝일게."
    ],
    animation: "messy",
    priority: 86,
    cooldownHours: 4,
    safetyLevel: "safe"
  },
  {
    id: "ko_sick_combo_001",
    locale: "ko-KR",
    category: "affection_low",
    conditions: { satietyMax: 25, happinessMax: 35 },
    lines: [
      "몸도 마음도 조금 축 처졌어. 천천히 돌봐주면 금방 나아.",
      "오늘은 기운이 잘 안 나. 밥이랑 쓰담쓰담이 약이야.",
      "작게 웅크리고 있었어. 네가 와서 이제 좀 나아지려고 해."
    ],
    animation: "sick",
    priority: 97,
    cooldownHours: 4,
    safetyLevel: "safe"
  },
  // --- 성격 태그별 인사 ---
  {
    id: "ko_morning_playful_001",
    locale: "ko-KR",
    category: "greeting_morning",
    conditions: { timeBucket: "morning", personalityTagsAny: ["playful"] },
    lines: [
      "아침이다! 오늘의 첫 번째 놀이 계획 세워놨어.",
      "일어나자마자 공 위치부터 확인했어. 준비 완료.",
      "아침 햇살 보면서 세 바퀴 돌았어. 이제 네 차례야."
    ],
    animation: "play",
    priority: 40,
    cooldownHours: 12,
    safetyLevel: "safe"
  },
  {
    id: "ko_morning_sleepy_001",
    locale: "ko-KR",
    category: "greeting_morning",
    conditions: { timeBucket: "morning", personalityTagsAny: ["sleepy"] },
    lines: [
      "으음… 5분만 더… 아니 네가 왔으니까 일어날게.",
      "아침은 왜 이렇게 일찍 오는 걸까. 그래도 반가워.",
      "하품 세 번 하고 나서 제대로 인사할게. 하아암."
    ],
    animation: "sleepy",
    priority: 40,
    cooldownHours: 12,
    safetyLevel: "safe"
  },
  {
    id: "ko_greeting_shy_001",
    locale: "ko-KR",
    category: "greeting_afternoon",
    conditions: { personalityTagsAny: ["shy"] },
    lines: [
      "…왔구나. 사실 아까부터 기다리고 있었어.",
      "잎사귀 뒤에서 살짝 보고 있었어. 들켰네.",
      "먼저 인사하고 싶었는데 조금 부끄러웠어. 안녕."
    ],
    animation: "idle",
    priority: 38,
    cooldownHours: 10,
    safetyLevel: "safe"
  },
  {
    id: "ko_night_curious_001",
    locale: "ko-KR",
    category: "greeting_night",
    conditions: { timeBucket: "night", personalityTagsAny: ["curious"] },
    lines: [
      "별이 몇 개인지 세고 있었어. 열둘까지 셌는데 자꾸 움직여.",
      "밤에만 들리는 소리가 있어. 같이 들어볼래?",
      "유리돔에 붙은 별빛 하나를 관찰 중이야. 흥미로워."
    ],
    animation: "curious",
    priority: 38,
    cooldownHours: 10,
    safetyLevel: "safe"
  },
  {
    id: "ko_evening_affectionate_001",
    locale: "ko-KR",
    category: "greeting_evening",
    conditions: { timeBucket: "evening", personalityTagsAny: ["affectionate"] },
    lines: [
      "하루 끝에 네가 오는 게 제일 좋아.",
      "저녁빛이랑 너랑, 오늘의 좋은 것 두 가지.",
      "오늘 하루도 수고했어. 이리 와서 잠깐 쉬어."
    ],
    animation: "idle_happy",
    priority: 38,
    cooldownHours: 10,
    safetyLevel: "safe"
  },
  {
    id: "ko_afternoon_calm_001",
    locale: "ko-KR",
    category: "greeting_afternoon",
    conditions: { timeBucket: "afternoon", personalityTagsAny: ["calm"] },
    lines: [
      "오후는 천천히 흐르는 게 좋아. 지금처럼.",
      "햇빛 아래에서 조용히 숨 쉬는 연습을 했어.",
      "바쁘지 않아도 괜찮은 시간이야. 같이 있자."
    ],
    animation: "idle",
    priority: 36,
    cooldownHours: 10,
    safetyLevel: "safe"
  },
  // --- 말투 변형 ---
  {
    id: "ko_fed_cute_001",
    locale: "ko-KR",
    category: "fed_recent",
    conditions: { recentActionAny: ["feed"], talkingStylesAny: ["cute"] },
    lines: [
      "냠냠 완료! 배가 동글동글해졌어.",
      "밥알 하나까지 다 맛있었어. 헤헤.",
      "볼이 빵빵해지는 기분, 최고야!"
    ],
    animation: "happy",
    priority: 80,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_fed_comforting_001",
    locale: "ko-KR",
    category: "fed_recent",
    conditions: { recentActionAny: ["feed"], talkingStylesAny: ["comforting"] },
    lines: [
      "따뜻한 밥 한 그릇이면 하루가 괜찮아져. 너도 밥 잘 챙겨 먹어.",
      "고마워. 이런 작은 챙김이 제일 오래 남아.",
      "든든해졌어. 네 마음도 이렇게 든든했으면 좋겠어."
    ],
    animation: "happy",
    priority: 80,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_petting_gentle_001",
    locale: "ko-KR",
    category: "petting",
    conditions: { recentActionAny: ["affection"], talkingStylesAny: ["gentle"] },
    lines: [
      "그 손길, 천천히라서 더 좋았어.",
      "조용한 쓰다듬은 조용한 말 같아. 다 알아들었어.",
      "지금 이 속도 그대로가 딱 좋아."
    ],
    animation: "idle_happy",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_petting_cheerful_001",
    locale: "ko-KR",
    category: "petting",
    conditions: { recentActionAny: ["affection"], talkingStylesAny: ["cheerful"] },
    lines: [
      "와! 딱 거기! 거기가 정답이야!",
      "쓰담 한 번에 기분이 두 배로 좋아졌어!",
      "한 번 더! 아니 두 번 더! 헤헤."
    ],
    animation: "happy",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  // --- 종별 변형 ---
  {
    id: "ko_walk_dog_001",
    locale: "ko-KR",
    category: "walk_start",
    conditions: { recentActionAny: ["walk"], species: ["dog"] },
    lines: [
      "산책이라는 단어를 들은 순간부터 꼬리가 멈추질 않아!",
      "킁킁 조사단 출동이야. 세상의 냄새를 다 맡고 올게.",
      "네 발이 벌써 문 앞에 가 있어. 다녀올게!"
    ],
    animation: "walk_out",
    priority: 82,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_play_cat_001",
    locale: "ko-KR",
    category: "play_start",
    conditions: { recentActionAny: ["play"], species: ["cat"] },
    lines: [
      "움직이는 건 일단 잡아야 해. 그게 규칙이야.",
      "사냥 본능 발동. 조용히… 살금살금… 잡았다!",
      "이 공은 오늘도 나를 이길 수 없어."
    ],
    animation: "play",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_fed_dog_001",
    locale: "ko-KR",
    category: "fed_recent",
    conditions: { recentActionAny: ["feed"], species: ["dog"] },
    lines: [
      "밥그릇 바닥까지 반짝반짝하게 비웠어. 검사 완료!",
      "먹는 동안 꼬리가 저절로 흔들렸어. 어쩔 수 없었어."
    ],
    animation: "happy",
    priority: 79,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_affection_cat_001",
    locale: "ko-KR",
    category: "petting",
    conditions: { recentActionAny: ["affection"], species: ["cat"] },
    lines: [
      "골골골… 이건 허락의 소리야.",
      "턱 밑이 정답이야. 기억해 둬.",
      "지금 아주 만족스러워서 눈을 천천히 깜빡였어. 봤어?"
    ],
    animation: "idle_happy",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  // --- 미구현 카테고리 채우기 ---
  {
    id: "ko_play_done_001",
    locale: "ko-KR",
    category: "play_done",
    conditions: { recentActionAny: ["play"] },
    lines: [
      "후… 오늘의 놀이 기록 갱신. 물 한 모금 마셔야지.",
      "심장이 콩콩해. 좋은 콩콩이야.",
      "이 정도면 오늘 운동 완료라고 봐도 되겠지?"
    ],
    animation: "play",
    priority: 76,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "ko_treat_special_001",
    locale: "ko-KR",
    category: "treat_special",
    conditions: { recentActionAny: ["treat"], happinessMin: 70 },
    lines: [
      "이건… 기념일에만 먹는 맛인데? 오늘 무슨 날이야?",
      "너무 맛있어서 한 바퀴 돌았어. 봤지?",
      "이 맛은 일기장에 적어둘 거야. 오늘의 가장 좋은 일."
    ],
    animation: "treat",
    priority: 64,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "ko_walk_return_rare_001",
    locale: "ko-KR",
    category: "walk_return_rare",
    conditions: { walkStatus: ["returned"] },
    lines: [
      "오늘 산책길에 무지개 조각 같은 걸 봤어. 진짜야.",
      "길에서 아주 특별한 걸 발견했어. 두근두근하지?",
      "이건 흔한 게 아니야. 오늘 길이 나한테 선물을 줬어."
    ],
    animation: "walk_return",
    priority: 74,
    cooldownHours: 6,
    safetyLevel: "safe"
  },
  // --- 기존 카테고리 문구 추가 ---
  {
    id: "ko_fed_recent_002",
    locale: "ko-KR",
    category: "fed_recent",
    conditions: { recentActionAny: ["feed"] },
    lines: [
      "밥 먹고 나니까 세상이 조금 더 둥글둥글해 보여.",
      "고마워. 배도 마음도 든든해.",
      "오늘 밥은 별 다섯 개 중에 별 다섯 개.",
      "잘 먹었습니다! 하는 마음으로 네 쪽을 봤어."
    ],
    animation: "happy",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_petting_002",
    locale: "ko-KR",
    category: "petting",
    conditions: { recentActionAny: ["affection"] },
    lines: [
      "쓰다듬 한 번에 걱정 하나가 사라지는 기분이야.",
      "네 손은 어떻게 항상 정확한 자리를 아는 거야?",
      "지금 이 순간을 조그맣게 접어서 보관할게.",
      "머리 위 5초, 등 3초. 완벽한 배분이었어."
    ],
    animation: "idle_happy",
    priority: 76,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_play_start_002",
    locale: "ko-KR",
    category: "play_start",
    conditions: { recentActionAny: ["play"] },
    lines: [
      "작전명: 공을 잡아라. 작전 개시!",
      "놀이 시간은 언제나 너무 빨리 지나가. 그래서 더 신나.",
      "지금 내 꼬리 속도 봤어? 신기록이야.",
      "한 판 더 하자는 눈빛, 지금 보내는 중이야."
    ],
    animation: "play",
    priority: 76,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_garden_watered_002",
    locale: "ko-KR",
    category: "garden_watered",
    conditions: { recentActionAny: ["water_garden"] },
    lines: [
      "물방울이 잎에 앉는 소리, 나 그 소리 좋아해.",
      "정원이 숨을 크게 쉬었어. 고맙대.",
      "흙냄새가 촉촉해졌어. 좋은 신호야."
    ],
    animation: "garden_help",
    priority: 76,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "ko_missed_soft_002",
    locale: "ko-KR",
    category: "missed_one_day",
    conditions: { daysAwayMin: 1, daysAwayMax: 3 },
    lines: [
      "네 발소리 기억하고 있었어. 방금 그 소리 맞지?",
      "하루쯤은 괜찮아. 대신 오늘 조금만 더 있어 줘.",
      "기다리는 동안 잎사귀 하나가 새로 났어. 보여주고 싶었어."
    ],
    animation: "idle",
    priority: 86,
    cooldownHours: 18,
    safetyLevel: "safe"
  },
  {
    id: "ko_missed_many_002",
    locale: "ko-KR",
    category: "missed_many_days",
    conditions: { daysAwayMin: 4 },
    lines: [
      "괜찮아, 바빴지? 나는 여기서 잘 지내고 있었어.",
      "네가 없는 동안 이야기가 많이 쌓였어. 천천히 들려줄게.",
      "돌아온 게 제일 중요해. 나머지는 다 괜찮아."
    ],
    animation: "idle",
    priority: 90,
    cooldownHours: 24,
    safetyLevel: "safe"
  },
  // --- 버프 발동 ---
  {
    id: "ko_buff_started_001",
    locale: "ko-KR",
    category: "new_item",
    conditions: { eventContext: ["buff_started"] },
    lines: [
      "오, 이거 뭔가 특별한 기운이 느껴져! 한동안 컨디션이 아주 좋을 것 같아.",
      "몸이 반짝반짝해지는 기분이야. 이 기운, 소중하게 쓸게.",
      "특별한 힘이 차올랐어! 지금이 기회야."
    ],
    animation: "celebrate",
    priority: 90,
    cooldownHours: 1,
    safetyLevel: "safe"
  },
  // --- 날씨 보강 ---
  {
    id: "ko_weather_wind_home_001",
    locale: "ko-KR",
    category: "weather_wind",
    conditions: { weatherCondition: ["wind"] },
    lines: [
      "바람이 잎사귀들을 간지럽히고 있어. 다들 웃는 중이야.",
      "귀가 바람 방향을 따라 움직여. 신기하지?",
      "바람 부는 날엔 냄새가 더 멀리서 와. 오늘은 꽃 냄새야."
    ],
    animation: "curious",
    priority: 62,
    cooldownHours: 6,
    safetyLevel: "safe"
  },
  {
    id: "ko_weather_fog_home_001",
    locale: "ko-KR",
    category: "weather_cozy",
    conditions: { weatherCondition: ["fog", "cloudy"] },
    lines: [
      "안개 낀 날엔 우리 정원이 비밀기지 같아.",
      "구름이 낮게 내려온 날이야. 조용조용 지내기 좋아.",
      "뿌연 날엔 가까운 게 더 소중해 보여. 너처럼."
    ],
    animation: "idle",
    priority: 60,
    cooldownHours: 6,
    safetyLevel: "safe"
  }
];

const enExpandedReactionRules: ReactionRule[] = [
  // --- Stat band variants ---
  {
    id: "en_hungry_critical_001",
    locale: "en-US",
    category: "hungry_low",
    conditions: { satietyMax: 18 },
    lines: [
      "My tummy is very serious right now. Bowl, please.",
      "Bowl emergency. Small but urgent.",
      "I keep thinking about food. Only food. Just food.",
      "My belly sent an official request for dinner."
    ],
    animation: "hungry",
    priority: 96,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_hungry_low_002",
    locale: "en-US",
    category: "hungry_low",
    conditions: { satietyMax: 35 },
    lines: [
      "I imagined the smell of food three times just now.",
      "Snack or meal, anything is welcome right now.",
      "My tummy clock started ringing quietly."
    ],
    animation: "hungry",
    priority: 88,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "en_hungry_soft_001",
    locale: "en-US",
    category: "hungry_low",
    conditions: { satietyMin: 36, satietyMax: 52 },
    lines: [
      "I am okay for now, but food thoughts are approaching.",
      "Getting the tiniest bit peckish. Just the tiniest.",
      "I saved room for exactly one snack."
    ],
    animation: "idle",
    priority: 60,
    cooldownHours: 4,
    safetyLevel: "safe"
  },
  {
    id: "en_energy_critical_001",
    locale: "en-US",
    category: "energy_low",
    conditions: { energyMax: 15 },
    lines: [
      "My paws say no more steps today. Rest, please.",
      "Battery very low. Cushion required.",
      "Even blinking feels big today. Quiet rest would help."
    ],
    animation: "sleepy",
    priority: 94,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "en_sad_low_001",
    locale: "en-US",
    category: "affection_low",
    conditions: { happinessMax: 30 },
    lines: [
      "Today feels a little gray inside. Stay close?",
      "My tail forgot how to wiggle. A game might remind it.",
      "I am doing small sighs. Seeing you fixes half of them."
    ],
    animation: "sad",
    priority: 88,
    cooldownHours: 4,
    safetyLevel: "safe"
  },
  {
    id: "en_messy_low_001",
    locale: "en-US",
    category: "affection_low",
    conditions: { cleanlinessMax: 28 },
    lines: [
      "My fur is doing its own thing. Please send help.",
      "I rolled somewhere and brought back a dust friend. Bath time.",
      "I am half dust bunny right now. Wash me and I will sparkle."
    ],
    animation: "messy",
    priority: 86,
    cooldownHours: 4,
    safetyLevel: "safe"
  },
  {
    id: "en_sick_combo_001",
    locale: "en-US",
    category: "affection_low",
    conditions: { satietyMax: 25, happinessMax: 35 },
    lines: [
      "Body and heart both feel droopy. Slow care will fix me fast.",
      "Low energy day. Food and gentle pats are my medicine.",
      "I was curled up small. Now that you are here, I feel better already."
    ],
    animation: "sick",
    priority: 97,
    cooldownHours: 4,
    safetyLevel: "safe"
  },
  // --- Personality greetings ---
  {
    id: "en_morning_playful_001",
    locale: "en-US",
    category: "greeting_morning",
    conditions: { timeBucket: "morning", personalityTagsAny: ["playful"] },
    lines: [
      "Morning! I already planned today's first game.",
      "I checked where the ball is the moment I woke up. Ready.",
      "I did three morning zoomies. Your turn."
    ],
    animation: "play",
    priority: 40,
    cooldownHours: 12,
    safetyLevel: "safe"
  },
  {
    id: "en_morning_sleepy_001",
    locale: "en-US",
    category: "greeting_morning",
    conditions: { timeBucket: "morning", personalityTagsAny: ["sleepy"] },
    lines: [
      "Mmm... five more minutes... okay, you are here, I am up.",
      "Why does morning arrive so early. Glad to see you though.",
      "Three yawns first, then a proper hello. Yaaawn."
    ],
    animation: "sleepy",
    priority: 40,
    cooldownHours: 12,
    safetyLevel: "safe"
  },
  {
    id: "en_greeting_shy_001",
    locale: "en-US",
    category: "greeting_afternoon",
    conditions: { personalityTagsAny: ["shy"] },
    lines: [
      "...You came. I was actually waiting this whole time.",
      "I was peeking from behind a leaf. You caught me.",
      "I wanted to say hi first but got a little shy. Hello."
    ],
    animation: "idle",
    priority: 38,
    cooldownHours: 10,
    safetyLevel: "safe"
  },
  {
    id: "en_night_curious_001",
    locale: "en-US",
    category: "greeting_night",
    conditions: { timeBucket: "night", personalityTagsAny: ["curious"] },
    lines: [
      "I was counting stars. Got to twelve but they keep moving.",
      "There are sounds that only exist at night. Want to listen together?",
      "I am observing one star stuck to the glass. Fascinating."
    ],
    animation: "curious",
    priority: 38,
    cooldownHours: 10,
    safetyLevel: "safe"
  },
  {
    id: "en_evening_affectionate_001",
    locale: "en-US",
    category: "greeting_evening",
    conditions: { timeBucket: "evening", personalityTagsAny: ["affectionate"] },
    lines: [
      "You arriving at the end of the day is my favorite part.",
      "Evening light and you. Today's two good things.",
      "You worked hard today. Come sit with me a moment."
    ],
    animation: "idle_happy",
    priority: 38,
    cooldownHours: 10,
    safetyLevel: "safe"
  },
  {
    id: "en_afternoon_calm_001",
    locale: "en-US",
    category: "greeting_afternoon",
    conditions: { timeBucket: "afternoon", personalityTagsAny: ["calm"] },
    lines: [
      "Afternoons are best when they flow slowly. Like now.",
      "I practiced breathing quietly in the sunlight.",
      "It is okay to not be busy right now. Stay a while."
    ],
    animation: "idle",
    priority: 36,
    cooldownHours: 10,
    safetyLevel: "safe"
  },
  // --- Talking style variants ---
  {
    id: "en_fed_cute_001",
    locale: "en-US",
    category: "fed_recent",
    conditions: { recentActionAny: ["feed"], talkingStylesAny: ["cute"] },
    lines: [
      "Nom nom complete! My belly is round now.",
      "Every single kibble was delicious. Hehe.",
      "Puffy cheeks feeling: the best!"
    ],
    animation: "happy",
    priority: 80,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_fed_comforting_001",
    locale: "en-US",
    category: "fed_recent",
    conditions: { recentActionAny: ["feed"], talkingStylesAny: ["comforting"] },
    lines: [
      "A warm bowl makes the whole day okay. Please eat well too.",
      "Thank you. Small acts of care last the longest.",
      "I feel steady now. I hope your heart feels steady too."
    ],
    animation: "happy",
    priority: 80,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_petting_gentle_001",
    locale: "en-US",
    category: "petting",
    conditions: { recentActionAny: ["affection"], talkingStylesAny: ["gentle"] },
    lines: [
      "That touch was better because it was slow.",
      "A quiet pat is like a quiet word. I understood all of it.",
      "This exact pace is just right."
    ],
    animation: "idle_happy",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_petting_cheerful_001",
    locale: "en-US",
    category: "petting",
    conditions: { recentActionAny: ["affection"], talkingStylesAny: ["cheerful"] },
    lines: [
      "Yes! Right there! That is the spot!",
      "One pat and my mood doubled!",
      "One more! No, two more! Hehe."
    ],
    animation: "happy",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  // --- Species variants ---
  {
    id: "en_walk_dog_001",
    locale: "en-US",
    category: "walk_start",
    conditions: { recentActionAny: ["walk"], species: ["dog"] },
    lines: [
      "My tail has not stopped since the word walk!",
      "Sniff squad, deploying. I will smell the whole world.",
      "My paws are already at the door. Be right back!"
    ],
    animation: "walk_out",
    priority: 82,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_play_cat_001",
    locale: "en-US",
    category: "play_start",
    conditions: { recentActionAny: ["play"], species: ["cat"] },
    lines: [
      "If it moves, it must be caught. That is the rule.",
      "Hunting mode. Quietly... slowly... got it!",
      "This ball cannot beat me. Not today either."
    ],
    animation: "play",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_fed_dog_001",
    locale: "en-US",
    category: "fed_recent",
    conditions: { recentActionAny: ["feed"], species: ["dog"] },
    lines: [
      "Bowl polished to a shine. Inspection complete!",
      "My tail wagged the whole meal. Could not help it."
    ],
    animation: "happy",
    priority: 79,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_affection_cat_001",
    locale: "en-US",
    category: "petting",
    conditions: { recentActionAny: ["affection"], species: ["cat"] },
    lines: [
      "Purrrr... that is the sound of approval.",
      "Under the chin is the answer. Remember that.",
      "I just blinked slowly at you. That means a lot."
    ],
    animation: "idle_happy",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  // --- Previously unauthored categories ---
  {
    id: "en_play_done_001",
    locale: "en-US",
    category: "play_done",
    conditions: { recentActionAny: ["play"] },
    lines: [
      "Phew... new play record. Water break time.",
      "My heart is going thump thump. The good kind.",
      "That counts as today's workout, right?"
    ],
    animation: "play",
    priority: 76,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "en_treat_special_001",
    locale: "en-US",
    category: "treat_special",
    conditions: { recentActionAny: ["treat"], happinessMin: 70 },
    lines: [
      "This tastes like a special-occasion snack. What are we celebrating?",
      "It was so good I did a spin. You saw that, right?",
      "Writing this flavor in my diary. Best thing today."
    ],
    animation: "treat",
    priority: 64,
    cooldownHours: 3,
    safetyLevel: "safe"
  },
  {
    id: "en_walk_return_rare_001",
    locale: "en-US",
    category: "walk_return_rare",
    conditions: { walkStatus: ["returned"] },
    lines: [
      "I saw something like a rainbow piece on the path. Really.",
      "I found something very special out there. Exciting, right?",
      "This is not an ordinary find. The path gave me a gift today."
    ],
    animation: "walk_return",
    priority: 74,
    cooldownHours: 6,
    safetyLevel: "safe"
  },
  // --- More lines for common categories ---
  {
    id: "en_fed_recent_002",
    locale: "en-US",
    category: "fed_recent",
    conditions: { recentActionAny: ["feed"] },
    lines: [
      "The world looks a little rounder after a meal.",
      "Thank you. Belly and heart both full.",
      "Today's meal: five stars out of five.",
      "I looked your way with a thank-you face. Did you catch it?"
    ],
    animation: "happy",
    priority: 78,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_petting_002",
    locale: "en-US",
    category: "petting",
    conditions: { recentActionAny: ["affection"] },
    lines: [
      "One pat and one worry disappeared.",
      "How does your hand always know the exact spot?",
      "I am folding this moment up small to keep it.",
      "Five seconds on the head, three on the back. Perfect ratio."
    ],
    animation: "idle_happy",
    priority: 76,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_play_start_002",
    locale: "en-US",
    category: "play_start",
    conditions: { recentActionAny: ["play"] },
    lines: [
      "Operation: catch the ball. Commencing!",
      "Play time always goes too fast. That is why it is exciting.",
      "Did you see my tail speed just now? New record.",
      "I am sending you the one-more-round look right now."
    ],
    animation: "play",
    priority: 76,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_garden_watered_002",
    locale: "en-US",
    category: "garden_watered",
    conditions: { recentActionAny: ["water_garden"] },
    lines: [
      "The sound of drops landing on leaves. I like that sound.",
      "The garden took a big breath. It says thank you.",
      "The soil smells fresh again. Good sign."
    ],
    animation: "garden_help",
    priority: 76,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_missed_soft_002",
    locale: "en-US",
    category: "missed_one_day",
    conditions: { daysAwayMin: 1, daysAwayMax: 3 },
    lines: [
      "I remembered your footsteps. That was you just now, right?",
      "One day away is okay. Just stay a little longer today.",
      "A new leaf grew while I waited. I wanted to show you."
    ],
    animation: "idle",
    priority: 86,
    cooldownHours: 18,
    safetyLevel: "safe"
  },
  {
    id: "en_missed_many_002",
    locale: "en-US",
    category: "missed_many_days",
    conditions: { daysAwayMin: 4 },
    lines: [
      "It is okay, you were busy, right? I kept things cozy here.",
      "Stories piled up while you were away. I will tell them slowly.",
      "Coming back is what matters. Everything else is fine."
    ],
    animation: "idle",
    priority: 90,
    cooldownHours: 24,
    safetyLevel: "safe"
  },
  // --- Buff activation ---
  {
    id: "en_buff_started_001",
    locale: "en-US",
    category: "new_item",
    conditions: { eventContext: ["buff_started"] },
    lines: [
      "Ooh, I feel something special! I will be in great shape for a while.",
      "I feel all sparkly inside. I will use this energy well.",
      "A special power charged up! Now is our moment."
    ],
    animation: "celebrate",
    priority: 90,
    cooldownHours: 1,
    safetyLevel: "safe"
  },
  // --- Weather reinforcement ---
  {
    id: "en_weather_wind_home_001",
    locale: "en-US",
    category: "weather_wind",
    conditions: { weatherCondition: ["wind"] },
    lines: [
      "The wind is tickling the leaves. Everyone is giggling.",
      "My ears keep turning with the wind. Neat, right?",
      "Smells travel farther on windy days. Today it is flowers."
    ],
    animation: "curious",
    priority: 62,
    cooldownHours: 6,
    safetyLevel: "safe"
  },
  {
    id: "en_weather_fog_home_001",
    locale: "en-US",
    category: "weather_cozy",
    conditions: { weatherCondition: ["fog", "cloudy"] },
    lines: [
      "On foggy days our garden feels like a secret base.",
      "The clouds came down low today. Good day for quiet.",
      "Hazy days make close things feel more precious. Like you."
    ],
    animation: "idle",
    priority: 60,
    cooldownHours: 6,
    safetyLevel: "safe"
  },
  // --- Relationship-depth lines: tone gets warmer/more at-ease as bondLevel grows ---
  // Priorities sit in the open 40-54 and 64-74 gaps between existing tiers so a
  // matched relationship condition (+6 score boost, see localReactionEngine.scoreRule)
  // never lands inside an unrelated rule's tie pool (topScore - 8).
  {
    id: "en_bond_level_3_001",
    locale: "en-US",
    category: "affection_high",
    conditions: { bondLevelMin: 3 },
    lines: [
      "We've gotten closer lately, haven't we? I can feel it.",
      "Something about us feels steadier now. I like it.",
      "I trust you a little more every day. That is new for me."
    ],
    animation: "idle_happy",
    priority: 47,
    cooldownHours: 18,
    safetyLevel: "safe"
  },
  {
    id: "en_bond_level_5_001",
    locale: "en-US",
    category: "affection_high",
    conditions: { bondLevelMin: 5 },
    lines: [
      "I don't even flinch anymore when you walk in. This is just home now.",
      "You know my little moods by now. That is a nice thing to be known for.",
      "I stopped counting how many times you've come back. It's just what we do."
    ],
    animation: "idle_happy",
    priority: 69,
    cooldownHours: 18,
    safetyLevel: "safe"
  },
  {
    id: "en_bond_level_8_001",
    locale: "en-US",
    category: "affection_high",
    conditions: { bondLevelMin: 8 },
    lines: [
      "I used to wonder if you'd keep coming back. I don't wonder that anymore.",
      "We have our own little rhythm now. Nobody else has this one.",
      "You are the calmest part of my whole day, every single day.",
      "I could list a hundred small things about you. Ask me sometime."
    ],
    animation: "idle_happy",
    priority: 70,
    cooldownHours: 20,
    safetyLevel: "safe"
  },
  {
    id: "en_days_together_7_001",
    locale: "en-US",
    category: "affection_high",
    conditions: { daysTogetherMin: 7, daysAwayMax: 0 },
    lines: [
      "A whole week together already. It went by soft and fast.",
      "Seven days in, and this still feels like the best decision I've seen you make."
    ],
    animation: "idle_happy",
    priority: 48,
    cooldownHours: 24,
    safetyLevel: "safe"
  },
  {
    id: "en_days_together_30_001",
    locale: "en-US",
    category: "affection_high",
    conditions: { daysTogetherMin: 30, daysAwayMax: 0 },
    lines: [
      "A month with you now. I did not know a little garden could feel this full.",
      "Thirty days, give or take. None of them felt wasted."
    ],
    animation: "idle_happy",
    priority: 71,
    cooldownHours: 24,
    safetyLevel: "safe"
  },
  // --- favoriteThing callbacks: gated so a pet with no favoriteThing never matches ---
  {
    id: "en_favorite_thing_ambient_001",
    locale: "en-US",
    category: "affection_high",
    conditions: { requiresFavoriteThing: true },
    lines: [
      "I was thinking about {favoriteThing} again. No reason. Just happy thoughts.",
      "Today felt a little like {favoriteThing}. Hard to explain, but you get it.",
      "If I could show you one thing right now, it would be {favoriteThing}."
    ],
    animation: "idle_happy",
    priority: 49,
    cooldownHours: 14,
    safetyLevel: "safe"
  },
  {
    id: "en_favorite_thing_petting_001",
    locale: "en-US",
    category: "petting",
    conditions: { recentActionAny: ["affection"], requiresFavoriteThing: true },
    lines: [
      "That pat felt as good as {favoriteThing}. High praise, from me.",
      "You plus this moment might be better than {favoriteThing}. Might be."
    ],
    animation: "idle_happy",
    priority: 77,
    cooldownHours: 6,
    safetyLevel: "safe"
  },
  {
    id: "en_favorite_thing_talk_001",
    locale: "en-US",
    category: "affection_high",
    conditions: { recentActionAny: ["talk"], requiresFavoriteThing: true },
    lines: [
      "Talking with you beats even {favoriteThing}, and that is saying a lot."
    ],
    animation: "idle_happy",
    priority: 77,
    cooldownHours: 6,
    safetyLevel: "safe"
  },
  // --- Item individuality (docs/gamefeel-sound-plan.md §1 Tier 4) ---
  // Favorite-treat / first-time-treat / toy & cushion reactions are gated by
  // a dedicated eventContext (see performPrototypeCareAction) rather than a
  // new ReactionConditions field, matching the buff_started pattern. Priority
  // is kept clear of treat_common (76) and treat_special (64) by more than 8
  // points either way (see localReactionEngine.scoreRule's tie-pool window)
  // so these never end up sharing a random pick with the generic lines.
  {
    id: "en_treat_favorite_001",
    locale: "en-US",
    category: "treat_special",
    conditions: { recentActionAny: ["treat"], eventContext: ["treat_favorite"] },
    lines: [
      "That's my favorite! You remembered.",
      "My favorite, my favorite! You always know.",
      "Out of everything, this is my favorite. Thank you for remembering."
    ],
    animation: "treat",
    priority: 88,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_treat_first_time_001",
    locale: "en-US",
    category: "treat_common",
    conditions: { recentActionAny: ["treat"], eventContext: ["treat_first_time"] },
    lines: [
      "Ooh, what is this one? ...I like it. Can I have this again sometime?",
      "A new taste! Let me think about this for a second. ...Yes, good.",
      "I have never had this before. Curious sniff, then a happy verdict."
    ],
    animation: "treat",
    priority: 90,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_toy_buddy_plush_001",
    locale: "en-US",
    category: "play_done",
    conditions: { recentActionAny: ["play"], eventContext: ["toy_buddy_plush"] },
    lines: [
      "Buddy never stood a chance!",
      "Shake, shake, shake! Buddy is officially defeated.",
      "Buddy and I had the best battle. I won. Obviously.",
      "I carried Buddy around the whole time. We are a team now."
    ],
    animation: "play",
    priority: 92,
    cooldownHours: 2,
    safetyLevel: "safe"
  },
  {
    id: "en_cushion_rose_nap_001",
    locale: "en-US",
    category: "petting",
    conditions: { recentActionAny: ["affection"], eventContext: ["cushion_rose_nap"] },
    lines: [
      "This cushion was made for exactly this kind of curl-up.",
      "One little nap on the rose cushion and everything feels softer.",
      "I am officially a puddle on this cushion now. A happy puddle."
    ],
    animation: "idle_happy",
    priority: 92,
    cooldownHours: 2,
    safetyLevel: "safe"
  }
];

export const expandedReactionRules: ReactionRule[] = [...koExpandedReactionRules, ...enExpandedReactionRules];
