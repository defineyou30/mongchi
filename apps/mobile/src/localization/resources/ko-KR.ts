import type { enUS } from "./en-US";

type DeepStringShape<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : DeepStringShape<T[Key]>;
};

export const koKR = {
  common: {
    actions: {
      apply: "적용",
      applied: "적용됨",
      backHome: "홈으로 돌아가기",
      cancel: "취소",
      camera: "카메라",
      checking: "확인 중",
      change: "변경",
      chooseAnotherPhoto: "다른 사진 선택",
      clear: "지우기",
      cleared: "지움",
      continue: "계속하기",
      delete: "삭제",
      deleting: "삭제 중",
      enable: "켜기",
      export: "내보내기",
      next: "다음",
      ok: "확인",
      open: "열기",
      reportIssue: "문제 신고",
      restore: "복원",
      restoring: "복원 중",
      saved: "저장됨",
      seeProfile: "프로필 보기",
      share: "공유하기",
      shop: "상점",
      skip: "건너뛰기",
      tryAgain: "다시 시도",
      turnOff: "끄기",
      unlock: "열기",
      viewHome: "홈 보기"
    }
  },
  languageSelector: {
    openAccessibilityLabel: "앱 언어 선택",
    title: "언어 선택",
    subtitle: "기기 언어를 따르거나 원하는 언어를 선택할 수 있어요.",
    automatic: "자동",
    automaticDetail: "이 기기 언어 사용 · {{language}}",
    selected: "선택됨",
    saveError: "언어를 저장하지 못했어요. 다시 시도해 주세요.",
    closeAccessibilityLabel: "언어 선택 닫기"
  },
  splash: {
    accessibilityLabel: "작은 반려동물의 휴대폰 속 집을 여는 화면",
    logoAccessibilityLabel: "Mongchi 앱 로고",
    animationAccessibilityLabel: "작은 세상 로딩 애니메이션",
    opening: "작은 집을 열고 있어요",
    warming: "포근한 방을 데우고 있어요"
  },
  welcome: {
    accessibilityLabel: "Mongchi 시작 안내",
    page: "시작 안내 {{total}}개 중 {{current}}번째",
    skipAccessibilityLabel: "시작 안내 건너뛰기",
    start: "사진으로 시작하기",
    slides: {
      first: {
        step: "1단계",
        title: "매일 곁에 있는 우리 반려동물",
        body: "좋아하는 반려동물 사진 한 장으로 정원에서 기다리는 작은 친구를 만나보세요."
      },
      second: {
        step: "2단계",
        title: "사진 한 장이면 충분해요",
        body: "반려동물이 선명하게 나온 사진을 고르고 이름과 작은 성격을 알려 주세요."
      },
      third: {
        step: "3단계",
        title: "매일 유대감을 키워요",
        body: "밥을 주고, 놀고, 대화하며 매일 포근한 정원으로 돌아오세요."
      }
    }
  },
  photoIntro: {
    accessibilityLabel: "반려동물 사진 시작 안내",
    artAccessibilityLabel: "반려동물 사진 한 장이 작은 정원 집으로 이어지는 모습",
    title: "사랑하는 반려동물을 손안에 가까이",
    body: "반려동물이 선명하게 나온 사진 한 장과 이름, 성격을 알려주면 정원에서 기다리는 작은 친구를 만날 수 있어요.",
    quest: { photo: "사진", name: "이름", moveIn: "입주" },
    privacy: "반려동물 사진은 작은 친구를 만드는 데만 사용돼요. 입주가 끝나면 언제든 원본을 삭제할 수 있어요.",
    choosePhoto: "반려동물 사진 선택"
  },
  photoUpload: {
    accessibilityLabel: "반려동물 사진 업로드",
    back: "사진 안내로 돌아가기",
    title: "가장 잘 나온 사진을 골라주세요",
    artAccessibilityLabel: "안전한 반려동물 사진 선택 보드",
    changeSelected: "선택한 반려동물 사진 변경",
    choosePhoto: "반려동물 사진 선택",
    selectedPreview: "{{petName}}의 선택된 반려동물 사진 미리보기",
    selectedSamplePreview: "{{petName}}의 선택된 샘플 사진 미리보기",
    samplePreview: "샘플 반려동물 사진 미리보기",
    sampleSelected: "샘플 사진을 선택했어요",
    photoSelected: "반려동물 사진을 선택했어요",
    purpose: "정원에 사는 작은 친구를 만드는 데 사용해요.",
    library: "사진 보관함",
    sampleAction: "사진이 없나요? 샘플 친구 만나기",
    sampleAccessibilityLabel: "샘플 친구 만나기",
    privacy: "작은 친구를 만드는 데만 사용돼요. 입주 후 원본을 삭제할 수 있어요.",
    errors: {
      invalidTitle: "이 사진은 사용할 수 없어요",
      invalidType: "JPEG, PNG 또는 WebP 형식의 반려동물 사진을 골라주세요.",
      tooLarge: "반려동물이 선명하게 보이는 10MB 이하의 사진을 골라주세요.",
      libraryTitle: "사진 접근 권한이 필요해요",
      libraryMessage: "작은 친구를 만들 반려동물 사진 한 장을 선택해 주세요.",
      cameraTitle: "카메라 권한이 필요해요",
      cameraMessage: "카메라 권한은 반려동물 사진을 직접 촬영할 때만 사용돼요."
    }
  },
  petSetup: {
    accessibilityLabel: "반려동물 설정",
    back: "사진으로 돌아가기",
    artAccessibilityLabel: "이름표와 포근한 침대가 있는 작은 친구의 입주 준비 책상",
    eyebrow: "입주 신청서",
    title: "작은 친구의 이름을 지어주세요",
    summary: "{{species}} / {{voice}} · 입주 준비 중",
    speciesQuestion: "누가 입주하나요?",
    petName: "반려동물 이름",
    nameHint: "매일 문 앞에서 반겨줄 이름이에요.",
    personalityQuestion: "우리 친구의 성격은 어떤가요?",
    voiceQuestion: "작은 목소리는 어떤 느낌인가요?",
    favoriteQuestion: "무엇을 가장 좋아하나요?",
    favoriteThing: "좋아하는 것",
    memoryQuestion: "함께 가져갈 작은 추억이 있나요?",
    firstMemory: "첫 번째 추억",
    firstMemoryPlaceholder: "우리 친구와의 작은 추억…",
    continueHint: "이름과 기분, 목소리를 선택해 주세요.",
    species: { dog: "강아지", cat: "고양이" },
    personality: {
      playful: "장난꾸러기",
      calm: "차분함",
      shy: "수줍음",
      curious: "호기심 많음",
      sleepy: "졸림",
      affectionate: "다정함"
    },
    voice: {
      cute: "귀엽게",
      gentle: "다정하게",
      cheerful: "발랄하게",
      comforting: "포근하게"
    }
  },
  generation: {
    accessibilityLabel: "{{petName}}의 입주 과정",
    back: "반려동물 설정으로 돌아가기",
    eyebrow: "입주 중",
    titleReady: "{{petName}}가 준비됐어요",
    titleMoving: "{{petName}}가 입주하고 있어요",
    warmAccessibilityLabel: "{{petName}}의 알을 부드럽게 눌러 따뜻하게 해주기",
    artAccessibilityLabel: "{{petName}}의 마법 같은 입주 장면",
    forming: "사진 속 특징을 따라 작은 친구가 모습을 갖추고 있어요.",
    favoriteFallback: "포근한 작은 것들",
    progressAccessibilityLabel: "입주 진행률",
    recapTitle: "누가 오고 있을까요?",
    failureTitle: "입주가 잠시 멈췄어요",
    quotaFailure: "작은 친구가 곧 입주할 수 있어요. 잠시 후 다시 확인해 주세요.",
    retryFailure: "작은 문이 걸렸어요. {{petName}}를 다시 만들어 볼게요.",
    safetyFailure: "이 사진으로는 입주를 도와줄 수 없었어요. 반려동물이 또렷하게 보이는 다른 사진으로 시도해 주세요.",
    reveal: "친구 만나기",
    steps: {
      preparing: "사진 준비",
      details: "작은 특징 찾기",
      creating: "친구 만들기",
      polishing: "작은 세상 다듬기",
      movingIn: "입주하기"
    },
    observations: {
      first: "사진 속 털색을 살펴보고 있어요...",
      second: "{{petName}}의 귀 모양을 조심조심 그리고 있어요...",
      third: "가장 포근한 픽셀을 하나씩 고르고 있어요...",
      fourth: "{{petName}}의 첫 인사를 연습하고 있어요...",
      fifth: "꼬리가 가장 예쁘게 흔들리는 각도를 재고 있어요...",
      sixth: "{{petName}}가 낮잠 잘 자리에 햇살을 놓고 있어요...",
      seventh: "{{favoriteThing}}에 대한 작은 추억을 챙기고 있어요...",
      eighth: "눈이 반짝일 때까지 윤기를 내고 있어요..."
    },
    warmLines: {
      first: "따뜻한 손길이 닿자 알이 살짝 움직였어요!",
      second: "알이 한결 포근해졌어요.",
      third: "작은 심장 소리가 고맙다고 인사했어요.",
      fourth: "거의 다 왔어요. 손길이 큰 힘이 되고 있어요."
    },
    statuses: {
      created: "작은 작업실을 데우고 있어요.",
      queued: "입주할 자리를 기다리고 있어요.",
      claimed: "작은 작업실 문을 열고 있어요.",
      validating: "사진 속 특징을 확인하고 있어요.",
      preprocessing: "사진을 준비하고 있어요.",
      safety_checking: "안전하게 입주할 수 있는지 확인하고 있어요.",
      generating: "첫 번째 작은 친구를 만들고 있어요.",
      postprocessing: "털과 마지막 디테일을 다듬고 있어요.",
      quality_checking: "마지막 모습을 확인하고 있어요.",
      uploading_assets: "집으로 갈 짐을 챙기고 있어요.",
      cleanup_pending: "입주 전에 사진을 깔끔히 정리하고 있어요.",
      completed: "만날 준비가 됐어요.",
      failed: "입주가 잠시 멈췄어요.",
      cancelled: "입주가 중단됐어요.",
      expired: "입주 시간이 만료됐어요."
    },
    teaser: {
      playful: "장난꾸러기 친구가 짐을 챙기고 있어요...",
      calm: "차분한 친구가 짐을 챙기고 있어요...",
      shy: "조금 수줍은 친구가 짐을 챙기고 있어요...",
      curious: "호기심 많은 친구가 짐을 챙기고 있어요...",
      sleepy: "졸린 친구가 짐을 챙기고 있어요...",
      affectionate: "다정한 친구가 짐을 챙기고 있어요...",
      fallback: "사랑스러운 친구가 짐을 챙기고 있어요..."
    },
    guidance: "안정적인 연결을 유지해 주세요. 앱이 중단되어도 돌아오면 같은 입주 과정이 이어져요."
  },
  reveal: {
    accessibilityLabel: "{{petName}} 공개",
    back: "입주 과정으로 돌아가기",
    artAccessibilityLabel: "{{petName}}를 처음 만나는 즐거운 축하 장면",
    plaque: "새 친구",
    eyebrow: "친구 공개",
    title: "{{petName}}를 만나보세요",
    enter: "정원으로 들어가기",
    shareAccessibilityLabel: "{{petName}} 공유하기",
    notRight: "조금 다른가요?",
    shareMessages: {
      first: "새로운 작은 정원 친구 {{petName}}를 만나보세요. Mongchi에서 만들었어요.",
      second: "{{petName}}가 작은 픽셀 정원에 입주했어요. Mongchi에서 만들었어요."
    }
  },
  home: {
    localeAccessibilityLabel: "{{petName}}의 작은 정원 홈",
    hud: {
      accessibilityLabel: "작은 정원 게임 상태",
      labels: {
        fullness: "배부름",
        thirst: "물",
        mood: "기분",
        energy: "에너지",
        cleanliness: "청결"
      },
      meterAccessibilityLabel: "{{label}} 상태. 자세히 보려면 눌러주세요.",
      artAccessibilityLabel: "{{label}} 상태 그림"
    },
    rail: {
      openShop: "상점 열기",
      shopArt: "상점 버튼 그림",
      openChat: "{{petName}}와의 채팅 열기",
      chatArt: "채팅 버튼 그림",
      openFriend: "{{petName}}의 친구 페이지 열기",
      friendArt: "친구 버튼 그림",
      letterWaiting: "{{label}} 새 편지가 기다리고 있어요.",
      openSettings: "설정 열기",
      settingsArt: "설정 버튼 그림"
    },
    pet: {
      accessibilityLabel: "반려동물 {{petName}}",
      longPressHint: "길게 누르면 {{petName}}의 친구 페이지가 열려요",
      avatarAccessibilityLabel: "생성된 반려동물 아바타",
      finishMessageHint: "누르면 전체 메시지가 바로 보여요.",
      walkingPaws: "산책 중인 {{petName}}의 발자국"
    },
    butterflyAccessibilityLabel: "작은 나비가 놀러 왔어요. 인사하려면 눌러주세요.",
    care: {
      actions: {
        feed: "밥",
        talk: "대화",
        walk: "산책",
        play: "놀이",
        rest: "휴식",
        affection: "쓰다듬기",
        water_garden: "물",
        clean: "목욕",
        treat: "간식"
      },
      iconAccessibilityLabel: "{{label}} 돌봄 아이콘",
      itemAccessibilityLabel: "{{label}} 돌봄 아이템",
      feedCooldown: "밥 메뉴. 기본 식사는 {{cooldown}} 뒤에 가능해요. 간식은 사용할 수 있어요.",
      feedMenu: "{{petName}}의 밥 메뉴",
      walkActive: "산책 중이에요. {{petName}}가 {{seconds}}초 뒤에 돌아와요.",
      optionCooldown: "{{label}} 메뉴. 기본 선택은 {{cooldown}} 뒤에 가능해요. 특별 아이템은 사용할 수 있어요.",
      recommended: "추천: {{petName}}에게 {{label}}. {{hint}}",
      actionAccessibilityLabel: "{{petName}}에게 {{label}}",
      tray: {
        titles: {
          affection: "유대감 선물",
          feed: "밥과 간식",
          play: "놀이 선택",
          walk: "산책길 선택",
          water_garden: "물과 목욕"
        },
        optionsAccessibilityLabel: "{{title}} 선택지",
        shopOption: "{{title}}을 위해 상점 열기",
        cooldownOption: "{{title}}은 {{cooldown}} 동안 쉬고 있어요.",
        useOption: "{{petName}}에게 {{title}} 사용하기",
        openShop: "돌봄 아이템 상점 열기",
        shop: "상점"
      },
      options: {
        pet: "쓰다듬기",
        meal: "밥",
        ball: "공",
        path: "산책길",
        water: "물",
        bath: "목욕",
        treat: "간식"
      },
      meta: {
        bond: "+유대감",
        fullness: "+배부름",
        mood: "+기분",
        thirst: "+갈증",
        fresh: "+청결",
        shop: "상점"
      }
    },
    walk: {
      activeTitle: "{{petName}}가 산책 중이에요 · {{time}} 뒤에 돌아와요",
      activeSubcopy: "앱을 닫아도 괜찮아요. {{petName}}가 돌아오면 알려드릴게요.",
      bringHomeAccessibilityLabel: "크레딧 {{cost}}개를 사용해 {{petName}}를 지금 데려오기",
      cannotBringHomeAccessibilityLabel: "크레딧이 부족해 {{petName}}를 지금 데려올 수 없어요",
      coinAccessibilityLabel: "코인 재화",
      openCreditStoreAccessibilityLabel: "보석 상점 열기",
      commentary: {
        early: "{{petName}}가 아주 중요한 냄새를 따라가고 있어요...",
        mid: "{{petName}}가 나뭇잎 친구에게 인사했어요.",
        late: "{{petName}}가 무언가를 발견해 집으로 가져오고 있어요!"
      },
      bringHome: "지금 데려오기 · {{cost}}",
      openCreditStore: "보석 충전하기",
      insufficientHint: "보석을 충전하거나 {{petName}}가 돌아오길 기다려 주세요.",
      waiting: "{{petName}}가 곧 돌아올 거예요. 조금만 기다려 주세요.",
      returned: "{{petName}}가 작은 선물을 들고 돌아왔어요!",
      claimAccessibilityLabel: "{{petName}}를 반기고 산책 선물 받기",
      claim: "반기고 받기"
    },
    guide: {
      tryAction: "먼저 ‘{{action}}’을 해보세요. {{petName}}가 좋아할 거예요.",
      chooseAction: "{{petName}}를 위한 작은 돌봄 하나를 골라주세요.",
      closeAccessibilityLabel: "상태 안내 닫기",
      accessibilityLabel: "상태 안내",
      gotIt: "알겠어요"
    },
    originalPhotoDeleted: "이 세션에서 원본 사진을 삭제했어요.",
    welcome: {
      accessibilityLabel: "작은 정원에 오신 것을 환영해요",
      title: "{{petName}}의 작은 정원에 오신 걸 환영해요",
      body: "이제 {{petName}}가 이곳에 살며 당신의 작은 돌봄을 기다려요.",
      care: "밥과 물을 주고, 놀아주고, 쓰다듬어 상태를 채워주세요.",
      speech: "말풍선을 보면 지금 {{petName}}에게 필요한 것을 알 수 있어요.",
      streak: "매일 돌아와 연속 돌봄 기록을 키워보세요.",
      action: "돌보기 시작"
    }
  },
  chat: {
    screenAccessibilityLabel: "{{petName}}와의 채팅",
    screenReaderTitle: "{{petName}}와 대화하기",
    back: "홈으로 돌아가기",
    petAccessibilityLabel: "채팅 속 반려동물",
    petSays: "{{petName}}의 말: {{text}}",
    finishMessageHint: "전체 메시지를 바로 보려면 탭하세요",
    opening: "포근한 대화방을 열고 있어요...",
    unavailableTitle: "긴 대화는 잠시 쉬고 있어요",
    unavailableDetail: "안전 검수를 마치는 동안에도 짧은 대화와 모든 돌봄 반응은 그대로 만날 수 있어요.",
    unavailableInput: "긴 대화는 지금 준비 중이에요",
    networkError: "지금은 채팅에 연결할 수 없어요. 다시 시도해 주세요.",
    startersAccessibilityLabel: "대화 시작 문장",
    starterAccessibilityLabel: "시작 문장 사용: {{starter}}",
    inputAccessibilityLabel: "프리미엄 채팅 메시지",
    inputPlaceholder: "{{petName}}에게 메시지 보내기",
    sendAccessibilityLabel: "프리미엄 채팅 메시지 보내기",
    disclosure: "반려동물의 프로필을 바탕으로 AI가 만든 대화예요. 실제 반려동물의 의식이나 생각을 나타내지 않아요.",
    disclosureBanner: {
      dismissAccessibilityLabel: "AI 고지 안내 닫기"
    },
    info: {
      button: "이 채팅 안내",
      title: "이 채팅에 대해",
      aiTitle: "AI가 만든 대화",
      billingTitle: "대화 횟수와 크레딧",
      billingBody: "보내는 순간 포함 대화와 크레딧을 안전하게 확인해요. 오늘의 무료 대화를 다 쓰면 데이 패스나 크레딧으로 계속 이야기할 수 있어요.",
      close: "확인했어요"
    },
    report: {
      button: "이 AI 응답 신고하기",
      reported: "이미 신고한 AI 응답이에요",
      title: "이 응답 신고하기",
      detail: "가장 가까운 이유를 골라주세요. 검토를 위해 메시지 참조와 이유만 저장해요.",
      reasons: {
        harmful: "해롭거나 위험해요",
        inappropriate: "부적절해요",
        inaccurate: "부정확하거나 오해를 불러요",
        other: "다른 문제가 있어요"
      },
      cancel: "신고 닫기",
      sending: "신고를 보내고 있어요...",
      success: "고마워요. 이 응답을 검토하도록 보냈어요.",
      error: "신고를 보내지 못했어요. 다시 시도해 주세요."
    },
    history: {
      accessibilityLabel: "{{petName}}와의 대화 기록",
      user: "나",
      notice: "안내",
      empty: "포근한 대화가 여기서 시작돼요.",
      notSent: "아직 전송되지 않았어요.",
      retryAccessibilityLabel: "메시지 다시 보내기",
      retry: "다시 보내기",
      typing: "{{petName}}가 답장을 쓰고 있어요..."
    },
    deterministicErrors: {
      emptyMessage: "먼저 짧은 메시지를 적어주세요.",
      locked: "무료 대화, 크레딧 또는 Plus 패스로 대화를 이어갈 수 있어요.",
      session: "포근한 대화 세션을 시작하지 못했어요. 다시 시도해 주세요.",
      history: "대화 기록을 불러오지 못했어요. 다시 시도해 주세요.",
      credits: "대화에 사용할 크레딧이 부족해요. 준비되면 다시 포근하게 이야기해요.",
      rateLimited: "대화가 잠깐 쉬어갈 시간이 필요해요. 곧 다시 시도해 주세요.",
      rejected: "이 메시지는 보낼 수 없어요. 다른 짧은 메시지를 적어주세요.",
      unavailable: "채팅이 잠시 쉬고 있어요. 다시 시도해 주세요."
    }
  },
  friend: {
    accessibilityLabel: "{{petName}}의 친구 페이지",
    back: "홈으로 돌아가기",
    share: "{{petName}} 공유하기",
    movedIn: {
      today: "오늘 입주했어요",
      daysAgo: "입주한 지 {{count}}일 됐어요"
    },
    stats: {
      bond: "유대감",
      streak: "연속 돌봄",
      together: "함께한 시간",
      bondAccessibilityLabel: "레벨 {{level}}까지의 유대감 진행: {{label}}"
    },
    sections: {
      lately: "요즘 {{petName}}는...",
      walkFinds: "산책 발견물",
      moments: "우리의 작은 순간",
      letter: "{{petName}}의 편지",
      memoryNote: "추억 메모"
    },
    walkFindAccessibilityLabel: "{{name}}, {{count}}번 발견",
    undiscoveredWalkFind: "아직 발견하지 못한 산책 발견물",
    letter: {
      giftAccessibilityLabel: "{{petName}}의 편지가 선물처럼 포장되어 열어보길 기다려요",
      openAccessibilityLabel: "{{petName}}의 한 달 편지 열기",
      open: "열기",
      checking: "오늘의 편지를 확인하고 있어요..."
    },
    pose: {
      accessibilityLabel: "{{petName}}의 {{pose}} 포즈",
      collectionAccessibilityLabel: "{{petName}}의 포즈 모음",
      position: "포즈 {{total}}개 중 {{current}}번째 · {{pose}}",
      moreAccessibilityLabel: "순간 상점에서 포즈 3개 팩 더 보기",
      more: "포즈 더 보기",
      labels: { everyday: "일상", happy: "행복", sleepy: "졸림" }
    },
    shareMessages: {
      days: "{{petName}}와 작은 정원에서 함께한 지 {{count}}일 됐어요. Mongchi에서 만들었어요.",
      fallback: "작은 정원 친구 {{petName}}를 만나보세요. Mongchi에서 만들었어요."
    },
    shareCard: {
      title: "꾸미고 공유하기",
      subtitle: "친구들이 좋아할 포즈와 배경을 골라보세요.",
      poseSectionTitle: "포즈",
      themeSectionTitle: "배경",
      poseOptionAccessibilityLabel: "{{pose}} 포즈",
      themeOptionAccessibilityLabel: "{{theme}} 배경",
      selected: "선택됨",
      previewAccessibilityLabel: "{{petName}}의 공유 카드 미리보기",
      closeAccessibilityLabel: "카드 꾸미기 닫기",
      shareAccessibilityLabel: "{{petName}}의 카드 공유하기"
    }
  },
  shop: {
    accessibilityLabel: "정원 상점",
    title: "정원 상점",
    back: "홈으로 돌아가기",
    walletAccessibilityLabel: "상점 지갑, 크레딧 {{credits}}개와 보유 아이템 {{owned}}개",
    creditGemAccessibilityLabel: "상점 크레딧 보석 아이콘",
    openCreditStore: "보석 충전소 열기",
    categories: {
      all: "전체",
      treats: "간식",
      drinks: "음료",
      toys: "놀이",
      rest: "휴식",
      moments: "순간",
      themes: "테마"
    },
    tabs: {
      care: "간식·장난감",
      customize: "포즈·테마"
    },
    sections: {
      careItems: "먹을 것·마실 것·장난감",
      careItemsDescription: "작은 보상, 신나는 놀이, 포근한 휴식을 골라보세요.",
      posePacks: "포즈 팩",
      posePacksDescription: "팩마다 어울리는 표정과 포즈 3개를 함께 열어요.",
      themes: "정원 테마",
      themesDescription: "친구가 사는 공간의 분위기를 통째로 바꿔보세요."
    },
    careFiltersAccessibilityLabel: "돌봄 아이템 필터",
    customizeFiltersAccessibilityLabel: "커스터마이즈 필터",
    categoryAccessibilityLabel: "{{label}}, 아이템 {{count}}개",
    emptyPreview: "이 선반에 새로운 포근한 아이템이 찾아올 거예요.",
    emptyShelf: "선반을 채우고 있어요.",
    comingSoon: "준비 중",
    soon: "곧 만나요",
    owned: "보유 중",
    ownedQuantity: "보유 x{{count}}",
    devOpen: "개발용 열림",
    available: "구매 가능",
    locked: "잠김",
    backgroundPreview: "{{name}} 배경 미리보기",
    largePreview: "{{name}} 크게 미리보기",
    backgroundThumbnail: "{{name}} 배경 썸네일",
    itemIcon: "{{name}} 아이콘",
    pricesAccessibilityLabel: "보석과 코인 가격을 사용할 수 있어요",
    walletGemAccessibilityLabel: "지갑 크레딧 보석",
    coinAccessibilityLabel: "코인 재화",
    gemPriceAccessibilityLabel: "보석 가격",
    actions: {
      unlockTheme: "테마 열기",
      applyTheme: "테마 적용",
      getItem: "구매하기",
      unlockPack: "팩 열기"
    },
    grants: { consumable: "크레딧", durable: "1회 보유", subscription: "구독" },
    products: {
      premiumChat: {
        name: "Plus 월간 채팅",
        description: "Plus 패스가 활성화된 동안 더 길고 포근하게 대화해요."
      },
      extraPetSlot: {
        name: "추가 친구 자리",
        description: "작은 친구 프로필을 하나 더 만들 수 있어요."
      },
      regenerationCredit: {
        name: "다시 만들기 크레딧",
        description: "새로운 모습이 필요할 때 아바타를 한 번 다시 만들어요."
      },
      starterTheme: {
        name: "기본 테마 팩",
        description: "작은 집에 새로운 배경을 선물해요."
      },
      itemPack: {
        name: "아이템 팩",
        description: "간식과 장난감을 포근하게 모은 팩이에요."
      },
      treatPack: {
        name: "간식 팩",
        description: "귀여운 반응을 만나는 특별한 간식 모음이에요."
      },
      plusPass: {
        name: "Plus 패스",
        description: "긴 대화와 앞으로의 Plus 기능을 위한 특별한 유대감 혜택이에요."
      }
    },
    actionAccessibility: {
      unlockTheme: "{{price}}에 {{name}} 열기",
      themeLocked: "{{name}} 잠김",
      applyTheme: "{{name}} 적용하기",
      themeApplied: "{{name}} 적용됨",
      buy: "{{name}} 구매하기"
    },
    summary: {
      accessibilityLabel: "보유 아이템 {{owned}}개, 잠긴 상점 아이템 {{locked}}개",
      owned: "보유 아이템",
      locked: "잠긴 상점 아이템 {{count}}개"
    },
    dialogs: {
      checkout: "결제",
      checkoutFailed: "지금은 결제를 시작할 수 없어요. 다시 시도해 주세요.",
      shop: "상점",
      shopFailed: "지금은 아이템을 받을 수 없어요. 다시 시도해 주세요.",
      itemAdded: "아이템을 받았어요",
      itemAddedMessage: "새 아이템이 보관함에서 기다리고 있어요.",
      posePack: "포즈 팩",
      posePackFailed: "지금은 포즈 팩을 시작할 수 없어요. 다시 시도해 주세요.",
      posesOnWay: "새 포즈 3개가 오고 있어요",
      posesOnWayMessage: "새로운 포즈 3개를 한 번에 함께 만들고 있어요.",
      theme: "테마",
      themeFailed: "지금은 테마를 바꿀 수 없어요. 다시 시도해 주세요.",
      makeover: "정원이 새로워졌어요!",
      themeApplied: "테마를 적용했어요",
      themeAppliedMessage: "{{name}} 테마가 정원 배경에 적용됐어요."
    },
    expressionPacks: {
      poseCount: "포즈 3개",
      boardAccessibilityLabel: "{{name}}, 포즈 3개 팩, {{price}}. {{status}}",
      creditGemAccessibilityLabel: "크레딧 보석",
      allOwned: "3개 모두 보유 중",
      allPrice: "3개 모두 · {{credits}}",
      actionAccessibilityLabel: "{{name}}에서 {{action}}",
      actions: {
        generate: "3개 모두 만들기",
        retry: "3개 모두 다시 시도",
        needCredits: "보석 충전하기",
        making: "포즈 만드는 중...",
        owned: "프로필에 보관 중"
      }
    },
    themes: {
      defaultName: "포근한 정원",
      defaultDescription: "언제나 무료인 기본 정원 배경이에요.",
      fairyName: "요정 정원",
      fairyDescription: "포근하고 몽환적인 날을 위한 반짝이는 요정 정원이에요.",
      seasideName: "바닷가 오솔길",
      seasideDescription: "산뜻한 산책 이야기에 어울리는 밝은 바닷가 배경이에요.",
      autumnName: "가을 숲",
      autumnDescription: "따뜻한 낙엽과 금빛 햇살이 머무는 계절 배경이에요.",
      winterName: "겨울 불빛",
      winterDescription: "포근한 축제 불빛이 빛나는 눈 내리는 저녁 배경이에요."
    }
  },
  creditsStore: {
    accessibilityLabel: "보석 충전소",
    title: "보석 충전소",
    back: "정원 상점으로 돌아가기",
    balanceAccessibilityLabel: "현재 보석 {{credits}}개",
    heroTitle: "새로운 순간을 더 만나보세요",
    heroBody: "보석은 포즈 팩, 테마와 특별한 돌봄에 사용돼요.",
    starterTitle: "첫 친구 선물 · {{credits}}개",
    starterBody: "첫 친구가 입주를 마치면 계정에 한 번만 지급돼요.",
    choosePack: "보석 팩 고르기",
    popular: "인기",
    packAmount: "보석 {{credits}}개",
    storePrice: "App Store 가격",
    purchaseAccessibilityLabel: "보석 {{credits}}개 구매하기",
    packs: {
      small: "가볍게 한 팩을 열어보기",
      popular: "여러 포즈 팩과 테마에 알맞아요",
      large: "오랫동안 모으고 꾸미기"
    },
    actions: {
      buy: "구매하기",
      purchasing: "확인 중...",
      preparing: "스토어 준비 중"
    },
    storeNotice: "결제는 App Store에서 처리되고, 확인된 보석만 잔액에 추가돼요.",
    dialogs: {
      failedTitle: "구매를 마치지 못했어요",
      failedBody: "연결 상태를 확인하고 다시 시도해 주세요.",
      successTitle: "보석이 도착했어요",
      successBody: "확인된 보석이 잔액에 추가됐어요."
    }
  },
  inventory: {
    accessibilityLabel: "보관함",
    title: "보관함",
    back: "홈으로 돌아가기",
    giveAccessibilityLabel: "{{name}} 지금 주기",
    giveHint: "홈으로 돌아가 이 아이템의 돌봄 메뉴를 열어요",
    iconAccessibilityLabel: "{{name}} 보관함 아이콘",
    empty: "아직 비어 있어요. 모은 간식과 장난감이 이 선반에 나타나요.",
    shop: "상점"
  },
  settings: {
    accessibilityLabel: "{{petName}}의 설정과 개인정보 보관함",
    title: "설정",
    back: "홈으로 돌아가기",
    hero: "날씨, 알림과 개인정보를 한곳에서 관리해요.",
    language: {
      title: "앱 언어",
      english: "영어",
      korean: "한국어",
      detail: "앱에서 선택하거나 기기 언어를 따라갑니다.",
      action: "변경"
    },
    status: {
      needsCheck: "확인 필요",
      syncing: "동기화 중",
      attention: "개인정보 작업을 확인해 주세요",
      inProgress: "개인정보 작업을 진행 중이에요",
      errorDetail: "작업을 안전하게 마치지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.",
      keepOpen: "작업이 끝날 때까지 앱을 열어두세요."
    },
    sections: {
      reminders: "작은 알림",
      sound: "소리와 느낌",
      account: "계정",
      privacy: "개인정보와 돌봄",
      support: "도움말과 약관"
    },
    notifications: {
      careReminders: "돌봄 알림",
      careRemindersDetail: "밥, 물, 짧은 인사와 한 달 편지 소식을 포근하게 알려드려요.",
      walkUpdates: "산책 알림",
      walkUpdatesDetail: "산책이 끝나면 친구가 돌아왔다고 살짝 알려드려요."
    },
    weather: {
      scenes: "날씨 장면",
      useLocation: "내 위치 사용",
      useLocationDetail: "대략적인 위치를 한 번 보내서 정원의 실제 현지 날씨를 확인해요 — 저장하지도, 다른 곳과 공유하지도 않아요.",
      preview: "날씨 미리보기",
      next: "다음: {{weather}}",
      locationMessages: {
        requesting: "오늘의 실제 현지 날씨를 정원에 반영하는 중이에요.",
        ready: "지역 날씨를 준비했어요.",
        denied: "위치 권한을 허용하지 않았어요. 수동 날씨 미리보기는 계속 사용할 수 있어요.",
        error: "지금은 지역 날씨를 불러올 수 없어요. 수동 미리보기를 사용해 주세요."
      },
      options: {
        clear: { label: "맑음", detail: "기본 햇살 정원이에요." },
        rain: { label: "비", detail: "빗방울과 포근한 날씨 대사가 나타나요." },
        snow: {
          label: "눈",
          detail: "겨울 배경과 부드러운 추위 대사가 나타나요."
        },
        wind: {
          label: "바람",
          detail: "나뭇잎이 움직이고 산책 발견물이 찾아와요."
        },
        hot: {
          label: "따뜻함",
          detail: "맑은 장면과 정원 돌봄 안내가 더해져요."
        }
      }
    },
    sound: {
      effects: "효과음",
      effectsDetail: "작은 종소리와 탭 소리, 부드러운 진동이 함께해요.",
      music: "음악과 환경음",
      musicDetail: "새소리와 빗소리 같은 잔잔한 정원 소리예요."
    },
    account: {
      linkTitle: "Apple로 연결",
      linkDetail: "내 정원 지키기 — 기기를 바꿔도 친구와 추억이 안전해요",
      linkAction: "연결",
      linkActionInFlight: "연결하는 중",
      recoverTitle: "정원 불러오기",
      recoverDetail: "이미 연결해 둔 정원이 있다면 여기로",
      recoverAction: "불러오기",
      recoverActionInFlight: "불러오는 중",
      connectedTitle: "Apple로 연결됨",
      connectedDetail: "정원이 안전하게 보관되고 있어요",
      connectedEmailDetail: "{{email}}로 연결됨",
      unavailableMessage: "이 기기에서는 지금 Apple 로그인을 사용할 수 없어요.",
      alreadyLinkedMessage: "이 Apple ID는 이미 다른 정원과 연결돼 있어요. 아래 '정원 불러오기'로 데려올 수 있어요",
      linkFailedMessage: "지금은 Apple 계정을 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
      recoverConfirmTitle: "이 정원을 불러올까요?",
      recoverConfirmMessage: "저장된 정원을 불러오면 이 폰의 정원은 그 정원으로 바뀌어요. 지금 친구는 한쪽에 소중히 둘게요. 계속할까요?",
      recoverFailedMessage: "지금은 정원을 불러올 수 없어요. 잠시 후 다시 시도해 주세요.",
      recoveredMessage: "정원을 불러왔어요.",
      recoveredNoSnapshotMessage: "저장된 정원은 못 찾았지만, 친구의 그림과 크레딧은 돌아왔어요"
    },
    privacy: {
      localPhoto: "기기 속 원본 사진",
      photoDeleted: "이 기기에서 삭제했어요.",
      photoStored: "이 기기에만 사진 사본이 있어요.",
      photoNote: "사진은 작은 친구를 만드는 데만 사용했고, 입주가 끝난 뒤 서버에서 바로 정리했어요.",
      chatHistory: "채팅 기록",
      chatDeleted: "이 세션에서 삭제했어요.",
      chatDetail: "긴 대화 기록을 여기서 관리해요.",
      backup: "친구 백업하기",
      backupDetail: "정원을 저장해 이 기기에만 남지 않도록 해요.",
      restore: "백업에서 복원",
      restoreDetail: "저장한 백업을 붙여넣어 정원을 되돌려요."
    },
    links: { privacy: "개인정보", terms: "이용약관", support: "도움말" },
    reset: {
      title: "초기화",
      detail: "이 기기의 반려동물 설정을 삭제하고 온보딩을 다시 시작해요.",
      action: "반려동물 데이터 삭제"
    },
    dialogs: {
      errorLog: "오류 기록",
      noErrors: "이 기기에 최근 오류 기록이 없어요.",
      deletePhotoTitle: "기기 속 사진 사본을 삭제할까요?",
      deletePhotoMessage: "이 기기에 저장된 사진 사본만 지워요. 친구는 이미 만들어졌으니 아무것도 달라지지 않아요.",
      deleteChatTitle: "채팅 기록을 삭제할까요?",
      deleteChatMessage: "이 세션의 로컬 채팅 기록만 지워요. 무료 돌봄 반응은 그대로예요.",
      backup: "백업",
      backupFailed: "지금은 백업을 만들 수 없어요. 다시 시도해 주세요.",
      shareFailed: "공유 화면을 열지 못했어요. 다시 시도해 주세요.",
      restore: "백업에서 복원",
      restoreFailed: "백업을 복원하지 못했어요. 저장한 내용을 확인하고 다시 시도해 주세요.",
      pasteFirst: "먼저 백업 내용을 붙여넣어 주세요.",
      restoreConfirmTitle: "이 백업을 복원할까요?",
      restoreConfirmMessage: "현재 정원이 교체돼요. 혹시 모르니 지금 친구는 먼저 백업할게요.",
      restoredTitle: "다시 만나 반가워요!",
      restoredMessage: "백업에서 정원을 복원했어요.",
      accountLink: "Apple로 연결",
      accountRecover: "정원 불러오기",
      deleteAllTitle: "모든 데이터를 삭제할까요?",
      deleteAllMessage:
        "이 기기의 반려동물 설정, 생성된 친구, 돌봄 상태와 보관함을 삭제하고 서버에도 사진, 아바타와 계정 데이터 삭제를 요청해요. 되돌릴 수 없어요.",
      serverRetry: "서버 삭제를 다시 시도해 주세요",
      serverRetryMessage: "기기 데이터는 삭제했어요. 앱을 열어두고 나중에 다시 시도해 서버 데이터 삭제도 마무리해 주세요."
    },
    restoreModal: {
      accessibilityLabel: "백업에서 복원",
      title: "백업에서 복원",
      hint: "iCloud, 메모 또는 이메일에 저장한 백업 내용을 붙여넣어 주세요.",
      placeholder: "백업 JSON 붙여넣기",
      inputAccessibilityLabel: "백업 내용"
    },
    dev: {
      fontTitle: "개발용: 글꼴 조합",
      fontDetail: "앱 전체의 W2 글꼴 조합 두 가지를 비교해요. 출시 빌드에는 보이지 않아요.",
      errorTitle: "개발용: 오류 기록",
      errorCount: "이 기기에 최근 오류 {{count}}개가 기록됐어요.",
      shareLog: "기록 공유",
      clearLog: "기록 지우기"
    }
  },
  notifications: {
    channel: {
      name: "정원 소식",
      description: "작은 정원의 포근한 소식을 전해드려요"
    },
    walkReturn: {
      fallbackPetName: "우리 친구",
      title: "{{petName}}가 산책에서 돌아왔어요!",
      body: "{{petName}}가 무엇을 발견했는지 만나보세요."
    },
    garden: {
      meal_due: {
        title: "{{petName}}가 밥그릇을 바라보고 있어요",
        body: "작은 식사로 배부름을 포근하게 채워주세요."
      },
      meal_urgent: {
        title: "{{petName}}의 밥그릇이 비어가요",
        body: "지금 기본 식사를 챙겨주면 {{petName}}가 좋아할 거예요."
      },
      thirst_due: {
        title: "{{petName}}의 물그릇을 채워주세요",
        body: "신선한 물 한 그릇이면 작은 기분도 밝아져요."
      },
      thirst_hot_weather: {
        title: "{{petName}}에게 시원한 물이 필요해요",
        body: "오늘은 공기가 따뜻해요. 먼저 신선한 물을 챙겨주세요."
      },
      bored_play: {
        title: "{{petName}}가 장난감을 찾았어요",
        body: "지금 짧게 놀아주면 즐거운 시간이 될 거예요."
      },
      attention_return: {
        title: "{{petName}}가 작은 인사를 준비했어요",
        body: "정원을 열어 쓰다듬거나 이야기를 나눠보세요."
      },
      walk_window: {
        title: "작은 산책 시간",
        body: "오늘 {{petName}}와 차분한 산책을 즐겨보세요."
      },
      rest_needed: {
        title: "{{petName}}가 졸려 보여요",
        body: "오늘 밤은 포근하게 쉬도록 도와주세요."
      },
      rainy_cozy_check: {
        title: "비 오는 날의 작은 안부",
        body: "{{petName}}가 포근하게 쉬고 있어요. 인사를 건네보세요."
      },
      return_after_1_day: {
        title: "문 앞에 작은 발자국이 생겼어요",
        body: "{{petName}}가 언제 돌아올지 기다리고 있어요."
      },
      return_after_1_day_streak: {
        title: "{{petName}}가 작은 일상을 포근하게 지키고 있어요",
        body: "연속 돌봄은 아직 따뜻해요. 오늘 잠깐 만나면 반짝임이 이어져요."
      },
      return_after_3_days: {
        title: "정원이 자리를 남겨두었어요",
        body: "며칠이 지났어요. 편할 때 {{petName}}에게 짧게 인사해 주세요."
      }
    },
    monthlyLetter: {
      fallbackPetName: "우리 친구",
      title: "편지가 도착했어요",
      body: "{{petName}}의 편지가 정원에서 기다리고 있어요."
    }
  },
  errorBoundary: {
    fallbackPetName: "우리 친구",
    title: "화면이 잠시 멈췄어요",
    message: "{{petName}}는 괜찮아요. 화면을 새로 시작해 볼게요.",
    retry: "다시 시도"
  },
  legal: {
    back: "설정으로 돌아가기",
    privacy: {
      accessibilityLabel: "개인정보 처리방침과 AI 안내",
      eyebrow: "개인정보",
      title: "사진과 대화의 안전",
      updated: "2026년 7월 8일 업데이트 · v1.1",
      items: {
        first: "계정이나 이메일 가입 없이 익명 세션으로 앱을 시작해요.",
        second: "반려동물 원본 사진은 안전 확인과 아바타 생성에만 OpenAI로 전송되며 생성 완료 즉시 서버에서 자동 삭제돼요.",
        third: "추가 표정을 열 때는 이미 생성된 아바타를 사용하며, 서버에서 삭제된 원본 사진은 다시 사용하지 않아요.",
        fourth: "생성된 아바타는 비공개 저장소에 보관되고 짧게 유효한 서명 링크로만 보여요.",
        fifth: "돌봄 상태, 추억과 정원 진행은 기기에 저장되므로 앱을 삭제하면 함께 삭제돼요.",
        sixth: "허용하면 대략적인 위치를 반올림해 한 번만 보내서 정원의 실제 현지 날씨를 확인해요. 저장하지 않고, 조회에 실패하면 기기가 비슷한 날씨 느낌을 스스로 만들어요.",
        seventh: "프리미엄 채팅은 AI 생성 대화임을 알리고 화면에 보이기 전 안전 확인을 거쳐요.",
        eighth: "광고나 추적 SDK를 사용하지 않으며 분석에 원본 사진, 채팅 원문과 결제 정보를 담지 않아요."
      },
      sections: {
        sharingTitle: "정보를 처리하는 외부 서비스",
        sharingBody:
          "OpenAI는 사진 안전 확인과 아바타 생성, 프리미엄 채팅의 프로필과 최근 대화 맥락을 처리해요. Supabase는 데이터베이스, 비공개 저장소와 익명 인증을 제공해요. 인앱 결제는 Apple 또는 Google이 직접 처리하며 Mongchi는 카드 정보가 아닌 영수증만 받아요.",
        rightsTitle: "사용자의 권리",
        rightsBody:
          "원본 사진은 따로 삭제할 수 있어요. 전체 삭제는 설정의 반려동물 데이터 삭제를 이용하세요. 기기 데이터를 지우고 서버에 사진, 아바타, 익명 계정과 연결된 기록 삭제를 요청해요. 서버에 닿지 않아도 기기 데이터는 바로 지우고 서버 작업은 나중에 다시 안내해요.",
        childrenTitle: "어린이",
        childrenBody:
          "Mongchi는 만 13세 미만 어린이를 대상으로 하지 않아요. 어린이가 사진이나 채팅을 통해 정보를 제공했다고 생각되면 도움말로 연락해 주세요. 관련 정보를 삭제할게요."
      },
      policyLink: "정책 링크",
      policyFallback: "안전한 개인정보 처리방침 링크가 준비되면 여기에 표시돼요.",
      openPolicy: "정책 열기",
      aiTitle: "AI 안내",
      aiBody: "반려동물 프로필을 바탕으로 AI가 만든 대화예요. 실제 반려동물의 의식이나 생각을 나타내지 않아요."
    },
    support: {
      accessibilityLabel: "도움말과 생성 문제 신고",
      eyebrow: "도움말",
      title: "도움과 신고",
      updated: "2026년 7월 7일 업데이트 · v1.0",
      contact: "문의하기",
      contactFallback: "아래 신고 기능을 이용해 주세요. 이메일 주소가 준비되면 메일 문의도 열려요.",
      email: "이메일 문의",
      faqTitle: "자주 묻는 질문",
      faq: {
        photoQuestion: "반려동물 사진은 안전한가요?",
        photoAnswer: "사진은 안전 확인과 아바타 생성에만 사용하고 생성이 끝나면 서버에서 자동으로 삭제해요.",
        deleteQuestion: "데이터는 어떻게 삭제하나요?",
        deleteAnswer: "사진 흐름에서 원본 사진만 따로 지우거나 설정의 반려동물 데이터 삭제로 기기와 서버의 전체 삭제를 요청할 수 있어요.",
        creditQuestion: "생성에 실패하면 크레딧은 어떻게 되나요?",
        creditAnswer: "시스템, 안전 확인 또는 품질 확인 실패로 유료 크레딧이 차감되어서는 안 돼요. 잘못 사용된 것 같다면 아래에서 신고해 주세요."
      },
      reportTitle: "생성 문제 신고",
      reportDetail: "문제 신고는 안전한 분류만 사용하며 분석에 원본 사진을 보내지 않아요.",
      options: {
        wrong: {
          label: "모습이 달라요",
          description: "종류, 무늬 또는 얼굴이 어색해 보여요."
        },
        unsafe: {
          label: "불편한 모습",
          description: "불편하거나 무섭게 느껴지는 부분이 있어요."
        },
        quality: {
          label: "흐린 결과",
          description: "반려동물을 알아보기 어려워요."
        }
      },
      report: "신고",
      saved: "저장됨",
      lastReport: "최근 신고: {{label}}",
      savedTitle: "신고를 저장했어요",
      savedMessage: "문제 분류만 저장했어요. 원본 사진이나 채팅 내용은 첨부하지 않았어요.",
      feedback: {
        title: "무엇이든 들려주세요",
        prompt: "불편했던 점이나 좋았던 순간, 무엇이든 들려주세요.",
        messagePlaceholder: "떠오르는 대로 편하게 적어 주세요...",
        messageAccessibilityLabel: "피드백 메시지",
        contactPlaceholder: "답장을 원하시면 연락처를 남겨 주세요 (선택)",
        contactAccessibilityLabel: "답장을 위한 선택 연락처",
        send: "피드백 보내기",
        savedTitle: "감사합니다",
        savedMessage: "보내주신 모든 이야기를 소중히 읽고 있어요."
      }
    },
    terms: {
      accessibilityLabel: "이용약관과 유료 가치",
      eyebrow: "이용약관",
      title: "공정한 이용과 유료 가치",
      updated: "2026년 7월 7일 업데이트 · v1.0",
      items: {
        first: "Mongchi는 AI 생성 엔터테인먼트예요. 작은 친구와 채팅은 실제 반려동물의 의식, 기억 또는 의료 조언이 아니에요.",
        second: "첫 친구 만들기에서 선택한 사진은 사용자가 관리하고 따로 삭제할 수 있어요.",
        third: "잘못된 생성, 시스템 오류와 품질 확인 실패는 유료 가치를 소모하지 않아야 해요.",
        fourth: "기본 돌봄은 무료예요. 유료 아이템은 방치 회복이 아니라 표현을 더해요.",
        fifth: "크레딧과 유료 아이템은 현금 가치가 없으며 환불은 구매한 스토어 정책을 따라요.",
        sixth: "생성된 반려동물 대화는 실제 반려동물의 의식이라고 주장하지 않아요."
      },
      sections: {
        useTitle: "허용되는 이용",
        useBody:
          "사람, 노골적이거나 잔인한 내용 또는 불법적인 내용이 담긴 사진을 올리지 마세요. 생성 제한이나 안전 확인을 우회하거나 채팅을 탈옥하려 하지 마세요.",
        portabilityTitle: "계정 이동성 없음",
        portabilityBody:
          "Mongchi는 일반 계정을 사용하지 않아요. 세션과 게임 데이터는 기기에 있으므로 백업 없이 앱을 삭제하거나 기기를 바꾸면 진행, 추억과 크레딧을 잃을 수 있어요.",
        disclaimerTitle: "면책 안내",
        disclaimerBody:
          "Mongchi는 현재 상태로 제공돼요. AI 생성 콘텐츠는 안전 및 품질 확인에도 가끔 부정확하거나 생성에 실패할 수 있어요. 자세한 제한은 전체 약관을 확인해 주세요."
      },
      linkTitle: "약관 링크",
      linkFallback: "안전한 이용약관 링크가 준비되면 여기에 표시돼요.",
      openTerms: "약관 열기"
    }
  }
} satisfies DeepStringShape<typeof enUS>;
