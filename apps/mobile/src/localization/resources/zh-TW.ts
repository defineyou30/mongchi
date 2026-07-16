import type { enUS } from "./en-US";

type DeepStringShape<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : DeepStringShape<T[Key]>;
};

export const zhTW = {
  common: {
    actions: {
      apply: "套用",
      applied: "已套用",
      backHome: "回到主畫面",
      cancel: "取消",
      camera: "相機",
      checking: "檢查中",
      change: "變更",
      chooseAnotherPhoto: "選擇其他照片",
      clear: "清除",
      cleared: "已清除",
      continue: "繼續",
      delete: "刪除",
      deleting: "刪除中",
      enable: "開啟",
      export: "匯出",
      next: "下一步",
      ok: "確定",
      open: "開啟",
      reportIssue: "回報問題",
      restore: "還原",
      restoring: "還原中",
      saved: "已儲存",
      seeProfile: "查看檔案",
      share: "分享",
      shop: "商店",
      skip: "略過",
      tryAgain: "再試一次",
      turnOff: "關閉",
      unlock: "解鎖",
      viewHome: "查看家園"
    }
  },
  languageSelector: {
    openAccessibilityLabel: "選擇應用程式語言",
    title: "選擇語言",
    subtitle: "可跟隨裝置語言，或固定使用你喜歡的語言。",
    automatic: "自動",
    automaticDetail: "跟隨此裝置 · {{language}}",
    selected: "已選擇",
    saveError: "無法儲存語言，請再試一次。",
    closeAccessibilityLabel: "關閉語言選擇"
  },
  splash: {
    accessibilityLabel: "迷你寵物回家載入畫面",
    logoAccessibilityLabel: "Mongchi 應用程式標誌",
    animationAccessibilityLabel: "迷你世界載入動畫",
    opening: "正在打開迷你家園",
    warming: "正在暖起溫馨小屋"
  },
  welcome: {
    accessibilityLabel: "Mongchi 歡迎導覽",
    page: "歡迎頁面，第 {{current}} 頁，共 {{total}} 頁",
    skipAccessibilityLabel: "略過歡迎導覽",
    start: "從一張照片開始",
    slides: {
      first: {
        step: "第 1 步",
        title: "每天都有你的毛孩相伴",
        body: "把一張最喜歡的寵物照片，\n變成在花園等你的小小朋友。"
      },
      second: {
        step: "第 2 步",
        title: "一張照片就夠了",
        body: "選一張清楚的寵物照片，再填上名字和可愛個性。"
      },
      third: {
        step: "第 3 步",
        title: "讓每天的陪伴更深",
        body: "餵食、玩耍、聊天，每天回到毛孩的溫馨花園。"
      }
    }
  },
  photoIntro: {
    accessibilityLabel: "迷你寵物照片介紹",
    artAccessibilityLabel: "一張寵物照片展開成迷你花園家園",
    title: "把最愛的毛孩留在身邊",
    body: "從一張清楚的寵物照片開始，加上名字和個性，就能遇見在花園等你的小小朋友。",
    quest: { photo: "照片", name: "名字", moveIn: "搬進來" },
    privacy: "寵物的照片只會用來創造你的小小朋友。牠搬進來後，隨時都能刪除原始照片。",
    choosePhoto: "選擇寵物照片"
  },
  photoUpload: {
    accessibilityLabel: "上傳寵物照片",
    back: "返回照片介紹",
    title: "挑一張牠最棒的照片",
    artAccessibilityLabel: "安全選擇寵物照片的面板",
    changeSelected: "更換已選的寵物照片",
    choosePhoto: "選擇寵物照片",
    selectedPreview: "{{petName}} 已選寵物照片預覽",
    selectedSamplePreview: "{{petName}} 已選範例寵物照片預覽",
    samplePreview: "範例寵物照片預覽",
    sampleSelected: "已選擇範例照片",
    photoSelected: "已選擇寵物照片",
    purpose: "用來創造住在花園裡的小小朋友。",
    library: "照片圖庫",
    sampleAction: "手邊沒有照片？先認識範例朋友",
    sampleAccessibilityLabel: "認識範例朋友",
    privacy: "只會用來創造你的小小朋友。牠搬進來後，就能刪除原始照片。",
    errors: {
      invalidTitle: "無法使用這張照片",
      invalidType: "請選擇 JPEG、PNG 或 WebP 格式的寵物照片。",
      tooLarge: "請選擇小於 10 MB，且能清楚看見寵物的照片。",
      libraryTitle: "需要照片取用權限",
      libraryMessage: "請選一張寵物照片，讓應用程式創造你的小小朋友。",
      cameraTitle: "需要相機權限",
      cameraMessage: "只有在你選擇拍攝寵物照片時，才會使用相機權限。"
    }
  },
  petSetup: {
    accessibilityLabel: "寵物設定",
    back: "返回照片",
    artAccessibilityLabel: "有名牌和溫暖小床的迷你寵物入住書桌",
    eyebrow: "入住資料",
    title: "為你的小小朋友取個名字",
    summary: "{{species}} / {{voice}} · 正準備搬進來",
    speciesQuestion: "誰要搬進來？",
    petName: "寵物名字",
    nameHint: "每天在門口迎接你時，牠就會用這個名字。",
    personalityQuestion: "你的小夥伴是什麼個性？",
    voiceQuestion: "牠的小小聲音聽起來如何？",
    favoriteQuestion: "牠已經喜歡上什麼了？",
    favoriteThing: "最喜歡的小東西",
    memoryQuestion: "有沒有想讓牠帶著的小小回憶？",
    firstMemory: "第一段小回憶",
    firstMemoryPlaceholder: "和小夥伴的一段小回憶…",
    continueHint: "選好名字、心情和聲音，就能繼續。",
    species: { dog: "狗狗", cat: "貓咪" },
    personality: {
      playful: "愛玩",
      calm: "沉穩",
      shy: "害羞",
      curious: "好奇",
      sleepy: "愛睏",
      affectionate: "黏人"
    },
    voice: {
      cute: "可愛",
      gentle: "溫柔",
      cheerful: "開朗",
      comforting: "療癒"
    }
  },
  generation: {
    accessibilityLabel: "{{petName}} 的入住流程",
    back: "返回寵物設定",
    eyebrow: "搬進來囉",
    titleReady: "{{petName}} 準備好了",
    titleMoving: "{{petName}} 正在搬進來",
    warmAccessibilityLabel: "輕輕點一下，溫暖 {{petName}} 的蛋",
    artAccessibilityLabel: "{{petName}} 的魔法入住場景",
    forming: "正從照片的細節中，慢慢塑造你的小小朋友。",
    favoriteFallback: "溫馨的小東西",
    progressAccessibilityLabel: "入住進度",
    recapTitle: "誰正在來的路上",
    failureTitle: "入住暫停了",
    quotaFailure: "你的小小朋友很快就能準備好。請稍後再回來看看。",
    retryFailure: "小門卡住了。讓我們再試一次，創造 {{petName}}。",
    safetyFailure: "這張照片沒辦法幫助你的寵物入住呢。請換一張能清楚看到寵物的照片再試一次。",
    reveal: "揭曉寵物",
    steps: {
      preparing: "準備照片",
      details: "尋找小細節",
      creating: "創造小夥伴",
      polishing: "妝點迷你世界",
      movingIn: "搬進來"
    },
    observations: {
      first: "正在研究照片裡的毛色...",
      second: "正仔細描繪 {{petName}} 的耳朵形狀...",
      third: "正一個個挑出最蓬鬆的像素...",
      fourth: "正練習 {{petName}} 的第一聲招呼...",
      fifth: "正測量最完美的搖尾巴幅度...",
      sixth: "正教陽光找到 {{petName}} 午睡的位置...",
      seventh: "正打包關於 {{favoriteThing}} 的小小回憶...",
      eighth: "正把亮晶晶的眼睛擦得閃閃發光..."
    },
    warmLines: {
      first: "你的溫暖傳到蛋裡了。它輕輕動了一下！",
      second: "蛋裡變得更溫暖了。",
      third: "小小的心跳說了聲謝謝。",
      fourth: "快好了。你的手正在幫忙喔。"
    },
    statuses: {
      created: "正在暖起迷你工作室。",
      queued: "正在等待合適的入住空位。",
      claimed: "正在打開小工作室。",
      validating: "正在檢查照片細節。",
      preprocessing: "正在準備照片。",
      safety_checking: "正在確認小小朋友能安全搬進來。",
      generating: "正在創造第一個小夥伴。",
      postprocessing: "正在柔化毛髮和最後細節。",
      quality_checking: "正在檢查最後的模樣。",
      uploading_assets: "正在打包寵物的回家行李。",
      cleanup_pending: "入住前正在整理照片。",
      completed: "準備見面了。",
      failed: "入住暫停了。",
      cancelled: "入住已停止。",
      expired: "入住等候逾時。"
    },
    teaser: {
      playful: "有個愛玩的小傢伙正在打包行李...",
      calm: "有個沉穩的小傢伙正在打包行李...",
      shy: "有個有點害羞的小傢伙正在打包行李...",
      curious: "有個好奇的小傢伙正在打包行李...",
      sleepy: "有個愛睏的小傢伙正在打包行李...",
      affectionate: "有個甜甜的小傢伙正在打包行李...",
      fallback: "有個甜甜的小傢伙正在打包行李..."
    },
    guidance: "請保持連線穩定。如果應用程式中斷，下次回來時會從同一段入住流程繼續。"
  },
  reveal: {
    accessibilityLabel: "揭曉 {{petName}}",
    back: "返回入住流程",
    artAccessibilityLabel: "{{petName}} 開心亮相的慶祝畫面",
    plaque: "新朋友",
    eyebrow: "寵物揭曉",
    title: "來認識 {{petName}}",
    enter: "走進花園",
    shareAccessibilityLabel: "分享 {{petName}}",
    notRight: "看起來不太對？",
    shareMessages: {
      first: "來認識 {{petName}}，我的迷你花園新朋友。由 Mongchi 創造。",
      second: "{{petName}} 剛搬進一座迷你像素花園。由 Mongchi 創造。"
    }
  },
  home: {
    localeAccessibilityLabel: "{{petName}} 可互動的迷你花園家園",
    hud: {
      accessibilityLabel: "迷你花園遊戲狀態",
      labels: {
        fullness: "飽足",
        thirst: "水分",
        mood: "心情",
        energy: "活力",
        cleanliness: "乾淨"
      },
      meterAccessibilityLabel: "{{label}}狀態。點一下查看詳情。",
      artAccessibilityLabel: "{{label}}狀態圖示"
    },
    rail: {
      openShop: "開啟商店",
      shopArt: "商店按鈕圖示",
      openChat: "開啟與 {{petName}} 的聊天",
      chatArt: "聊天按鈕圖示",
      openFriend: "開啟 {{petName}} 的朋友頁面",
      friendArt: "朋友按鈕圖示",
      letterWaiting: "{{label}}。有一封新信等著你。",
      openSettings: "開啟設定",
      settingsArt: "設定按鈕圖示"
    },
    pet: {
      accessibilityLabel: "摸摸 {{petName}}",
      longPressHint: "長按以開啟 {{petName}} 的朋友頁面",
      avatarAccessibilityLabel: "生成的寵物頭像",
      finishMessageHint: "點一下立即顯示完整訊息。",
      walkingPaws: "{{petName}} 散步的腳印"
    },
    butterflyAccessibilityLabel: "一隻小蝴蝶來作客了。點一下和牠打招呼。",
    care: {
      actions: {
        feed: "餵食",
        talk: "聊天",
        walk: "散步",
        play: "玩耍",
        rest: "休息",
        affection: "摸摸",
        water_garden: "喝水",
        clean: "清潔",
        treat: "點心"
      },
      iconAccessibilityLabel: "{{label}}照顧圖示",
      itemAccessibilityLabel: "{{label}}照顧用品",
      feedCooldown: "餵食選單。每日正餐冷卻時間 {{cooldown}}。點心可能仍可使用。",
      feedMenu: "{{petName}} 的餵食選單。",
      walkActive: "正在散步。{{petName}} 會在 {{seconds}} 秒後回來。",
      optionCooldown: "{{label}}選單。基本選項冷卻時間 {{cooldown}}。特殊用品可能仍可使用。",
      recommended: "推薦：為 {{petName}}{{label}}。{{hint}}",
      actionAccessibilityLabel: "為 {{petName}}{{label}}",
      tray: {
        titles: {
          affection: "增進感情",
          feed: "食物與點心",
          play: "玩耍選擇",
          walk: "散步路線",
          water_garden: "喝水"
        },
        optionsAccessibilityLabel: "{{title}}選項",
        shopOption: "開啟商店查看{{title}}。",
        cooldownOption: "{{title}}還需冷卻 {{cooldown}}。",
        useOption: "為 {{petName}} 使用{{title}}。",
        openShop: "開啟商店查看照顧用品。",
        shop: "商店"
      },
      options: {
        pet: "摸摸",
        meal: "正餐",
        ball: "球球",
        path: "小徑",
        water: "喝水",
        bath: "洗澡",
        treat: "點心"
      },
      meta: {
        bond: "+感情",
        fullness: "+飽足",
        mood: "+心情",
        thirst: "+水分",
        fresh: "+清爽",
        shop: "商店"
      }
    },
    walk: {
      activeTitle: "{{petName}} 正在小徑上 · {{time}} 後回來",
      activeSubcopy: "放心關閉應用程式吧——{{petName}} 回來時，我們會通知你。",
      bringHomeAccessibilityLabel: "花費 {{cost}} 點數，立即帶 {{petName}} 回家",
      cannotBringHomeAccessibilityLabel: "點數不足，現在無法帶 {{petName}} 回家",
      coinAccessibilityLabel: "金幣",
      openCreditStoreAccessibilityLabel: "開啟點數商店",
      commentary: {
        early: "{{petName}} 正追著一個非常重要的氣味...",
        mid: "{{petName}} 停下來和一片葉子打招呼。",
        late: "{{petName}} 找到東西，正帶回家！"
      },
      bringHome: "立即帶回家 · {{cost}}",
      openCreditStore: "補充點數",
      insufficientHint: "補充點數，或等待 {{petName}} 回家。",
      waiting: "{{petName}} 很快就回來，再等一下喔。",
      returned: "{{petName}} 帶著一份小禮物回來了！",
      claimAccessibilityLabel: "迎接 {{petName}} 並領取散步禮物",
      claim: "迎接並領取"
    },
    guide: {
      tryAction: "先試試「{{action}}」——{{petName}} 會很喜歡。",
      chooseAction: "為 {{petName}} 選一個小小照顧行動。",
      closeAccessibilityLabel: "關閉狀態條指南",
      accessibilityLabel: "狀態條指南",
      gotIt: "知道了"
    },
    originalPhotoDeleted: "已刪除此工作階段的原始照片。",
    welcome: {
      accessibilityLabel: "歡迎來到你的迷你花園",
      title: "歡迎來到 {{petName}} 的迷你花園",
      body: "{{petName}} 現在住在這裡，期待你每天給牠一點小小照顧。",
      care: "餵食、喝水、玩耍和摸摸，讓各項狀態保持飽滿。",
      speech: "對話泡泡會告訴你 {{petName}} 現在需要什麼。",
      streak: "每天回來，讓你的照顧連續紀錄繼續成長。",
      action: "開始照顧"
    }
  },
  chat: {
    screenAccessibilityLabel: "與 {{petName}} 的聊天",
    screenReaderTitle: "和 {{petName}} 聊天",
    back: "回到主畫面",
    petAccessibilityLabel: "聊天中的寵物",
    petSays: "{{petName}} 說：{{text}}",
    finishMessageHint: "點一下立即顯示完整訊息",
    opening: "正在打開溫馨話題...",
    unavailableTitle: "長篇聊天暫時休息中",
    unavailableDetail: "安全審查完成前，簡短對話與所有照顧反應仍可正常使用。",
    unavailableInput: "長篇聊天目前準備中",
    networkError: "目前無法連上聊天。請再試一次。",
    startersAccessibilityLabel: "聊天開場話題",
    starterAccessibilityLabel: "使用開場話題：{{starter}}",
    inputAccessibilityLabel: "進階聊天訊息",
    inputPlaceholder: "傳訊息給 {{petName}}",
    sendAccessibilityLabel: "傳送進階聊天訊息",
    disclosure: "這是依照寵物檔案由 AI 生成的對話，並不是你真實寵物的意識。",
    disclosureBanner: {
      dismissAccessibilityLabel: "關閉 AI 提示訊息"
    },
    info: {
      button: "關於此聊天",
      title: "關於此聊天",
      aiTitle: "AI 生成的對話",
      billingTitle: "聊天次數與點數",
      billingBody: "傳送訊息的當下，會安全確認已包含的聊天次數與點數。今天的免費聊天用完後，可以用日間通行證或點數繼續聊天。",
      close: "知道了"
    },
    report: {
      button: "檢舉這則 AI 回覆",
      reported: "這則 AI 回覆已檢舉",
      title: "檢舉這則回覆",
      detail: "請選擇最接近的原因。我們只會儲存訊息參照與原因供審查。",
      reasons: {
        harmful: "有害或不安全",
        inappropriate: "不適當",
        inaccurate: "不正確或具誤導性",
        other: "其他問題"
      },
      cancel: "關閉檢舉",
      sending: "正在送出檢舉...",
      success: "謝謝。這則回覆已送交審查。",
      error: "無法送出檢舉。請再試一次。"
    },
    history: {
      accessibilityLabel: "與 {{petName}} 的聊天記錄",
      user: "你",
      notice: "提醒",
      empty: "你們的溫馨對話就從這裡開始。",
      notSent: "尚未傳送。",
      retryAccessibilityLabel: "重新傳送訊息",
      retry: "重試",
      typing: "{{petName}} 正在輸入..."
    },
    deterministicErrors: {
      emptyMessage: "請先寫一則短訊息。",
      locked: "使用聊天券、點數或 Plus 通行證繼續聊天。",
      session: "無法開始溫馨聊天。請再試一次。",
      history: "目前無法載入聊天記錄。請再試一次。",
      credits: "這次聊天的點數用完了。等你準備好，再回來溫馨聊聊。",
      rateLimited: "對話需要短暫休息一下。請稍後再試。",
      rejected: "無法傳送這則訊息。請換一則短訊息試試。",
      unavailable: "聊天正在休息片刻。請再試一次。"
    }
  },
  friend: {
    accessibilityLabel: "{{petName}} 的朋友頁面",
    back: "回到主畫面",
    share: "分享 {{petName}}",
    movedIn: { today: "今天搬進來", daysAgo: "{{count}} 天前搬進來" },
    stats: {
      bond: "感情",
      streak: "連續紀錄",
      together: "相伴日子",
      bondAccessibilityLabel: "前往第 {{level}} 級的感情進度：{{label}}"
    },
    sections: {
      lately: "最近的 {{petName}}...",
      walkFinds: "散步發現",
      moments: "我們的小時光",
      letter: "{{petName}} 的信",
      memoryNote: "回憶小箋"
    },
    walkFindAccessibilityLabel: "{{name}}，已找到 {{count}} 次",
    undiscoveredWalkFind: "尚未發現的散步物品",
    letter: {
      giftAccessibilityLabel: "{{petName}} 的信包成了禮物，正等著開啟",
      openAccessibilityLabel: "開啟 {{petName}} 的滿月信",
      open: "開啟",
      checking: "正在查看今天的信..."
    },
    pose: {
      accessibilityLabel: "{{petName}} 的{{pose}}姿勢",
      collectionAccessibilityLabel: "{{petName}} 的姿勢",
      position: "第 {{current}} 個姿勢，共 {{total}} 個 · {{pose}}",
      moreAccessibilityLabel: "到回憶商店查看更多三姿勢套組",
      more: "查看更多姿勢",
      labels: { everyday: "日常", happy: "開心", sleepy: "想睡" }
    },
    shareMessages: {
      days: "{{petName}} 已經當我的迷你花園朋友 {{count}} 天了。由 Mongchi 創造。",
      fallback: "來認識 {{petName}}，我的迷你花園朋友。由 Mongchi 創造。"
    },
    shareCard: {
      title: "自訂並分享",
      subtitle: "挑選朋友會喜歡的姿勢和背景。",
      poseSectionTitle: "姿勢",
      themeSectionTitle: "背景",
      poseOptionAccessibilityLabel: "{{pose}} 姿勢",
      themeOptionAccessibilityLabel: "{{theme}} 背景",
      selected: "已選擇",
      previewAccessibilityLabel: "{{petName}} 的分享卡預覽",
      closeAccessibilityLabel: "關閉卡片自訂",
      shareAccessibilityLabel: "分享 {{petName}} 的卡片"
    }
  },
  shop: {
    accessibilityLabel: "花園商店",
    title: "花園商店",
    back: "回到主畫面",
    walletAccessibilityLabel: "商店錢包，有 {{credits}} 點數和 {{owned}} 件已擁有的套組物品",
    creditGemAccessibilityLabel: "商店點數圖示",
    openCreditStore: "開啟點數商店",
    categories: {
      all: "全部",
      treats: "點心",
      drinks: "飲品",
      toys: "玩具",
      rest: "休息",
      moments: "回憶",
      themes: "主題"
    },
    tabs: {
      care: "點心・玩具",
      customize: "姿勢・主題"
    },
    sections: {
      careItems: "食物・飲品・玩具",
      careItemsDescription: "挑選小獎勵、好玩的玩具和舒適的休息用品。",
      posePacks: "姿勢包",
      posePacksDescription: "每個套組可一起解鎖3個相配的表情與姿勢。",
      themes: "花園主題",
      themesDescription: "一次改變夥伴小屋的整體氣氛。"
    },
    careFiltersAccessibilityLabel: "照顧物品篩選",
    customizeFiltersAccessibilityLabel: "自訂篩選",
    categoryAccessibilityLabel: "{{label}}，{{count}} 件物品",
    emptyPreview: "貨架補滿後，新的溫馨物品就會出現在這裡。",
    emptyShelf: "正在補充這個貨架。",
    comingSoon: "即將推出",
    soon: "即將推出",
    owned: "已擁有",
    ownedQuantity: "已擁有 x{{count}}",
    devOpen: "開發版開放",
    available: "可使用",
    locked: "已鎖定",
    backgroundPreview: "{{name}} 背景預覽",
    largePreview: "{{name}} 大圖預覽",
    backgroundThumbnail: "{{name}} 背景縮圖",
    itemIcon: "{{name}} 圖示",
    pricesAccessibilityLabel: "可使用點數或金幣價格",
    walletGemAccessibilityLabel: "點數價格",
    coinAccessibilityLabel: "金幣",
    gemPriceAccessibilityLabel: "點數價格",
    actions: {
      unlockTheme: "解鎖主題",
      applyTheme: "套用主題",
      getItem: "購買",
      unlockPack: "解鎖套組"
    },
    grants: { consumable: "點數", durable: "永久擁有", subscription: "訂閱" },
    products: {
      premiumChat: {
        name: "Plus 每月聊天",
        description: "Plus 通行證有效期間，隨時享受更長、更溫暖的聊天。"
      },
      extraPetSlot: {
        name: "額外寵物欄位",
        description: "為另一個迷你寵物檔案騰出位置。"
      },
      regenerationCredit: {
        name: "重新生成點數",
        description: "想換個新模樣時，可重試一次頭像。"
      },
      starterTheme: {
        name: "入門主題套組",
        description: "為迷你家園換上清新的背景。"
      },
      itemPack: { name: "物品套組", description: "精選的點心和玩具組合。" },
      treatPack: {
        name: "點心套組",
        description: "帶來可愛反應時刻的特別零食。"
      },
      plusPass: {
        name: "Plus 通行證",
        description: "享有更長聊天與未來 Plus 功能的進階感情福利。"
      }
    },
    actionAccessibility: {
      unlockTheme: "以 {{price}} 解鎖 {{name}}",
      themeLocked: "{{name}} 已鎖定",
      applyTheme: "套用 {{name}}",
      themeApplied: "已套用 {{name}}",
      buy: "購買 {{name}}"
    },
    summary: {
      accessibilityLabel: "已擁有 {{owned}} 件套組物品、{{locked}} 件鎖定的商店物品",
      owned: "已擁有套組",
      locked: "{{count}} 件鎖定的商店物品"
    },
    dialogs: {
      checkout: "結帳",
      checkoutFailed: "目前無法開始結帳。請再試一次。",
      shop: "商店",
      shopFailed: "目前無法加入該物品。請再試一次。",
      itemAdded: "已加入物品",
      itemAddedMessage: "你的新物品正在物品欄裡等著你。",
      posePack: "姿勢套組",
      posePackFailed: "目前無法開始製作該姿勢套組。請再試一次。",
      posesOnWay: "三個姿勢正在路上",
      posesOnWayMessage: "正在一起製作你小夥伴的三個新姿勢。",
      theme: "主題",
      themeFailed: "目前無法變更該主題。請再試一次。",
      makeover: "花園大變身！",
      themeApplied: "已套用主題",
      themeAppliedMessage: "{{name}} 現在是你的花園背景了。"
    },
    expressionPacks: {
      poseCount: "3 個姿勢",
      boardAccessibilityLabel: "{{name}}，三姿勢套組，{{price}}。{{status}}",
      creditGemAccessibilityLabel: "點數價格",
      allOwned: "3 個全都擁有",
      allPrice: "全部 3 個 · {{credits}}",
      actionAccessibilityLabel: "在 {{name}} 執行{{action}}",
      actions: {
        generate: "生成全部 3 個",
        retry: "重試全部 3 個",
        needCredits: "補充點數",
        making: "正在製作姿勢...",
        owned: "檔案中已擁有"
      }
    },
    themes: {
      defaultName: "溫馨花園",
      defaultDescription: "花園原本的免費背景，永遠都能使用。",
      fairyName: "精靈花園",
      fairyDescription: "散發柔光的精靈花園背景，陪你度過夢幻居家時光。",
      seasideName: "海邊小灣",
      seasideDescription: "明亮的海岸背景，適合微風輕拂的散步故事。",
      autumnName: "秋日森林",
      autumnDescription: "以溫暖落葉和柔和金光，陪伴季節照顧時光。",
      winterName: "冬日燈火",
      winterDescription: "雪夜背景帶著柔和的節慶光芒。"
    }
  },
  creditsStore: {
    accessibilityLabel: "點數商店",
    title: "點數商店",
    back: "返回花園商店",
    balanceAccessibilityLabel: "目前有 {{credits}} 點數",
    heroTitle: "遇見更多小小時刻",
    heroBody: "點數可用於姿勢套組、主題和特別照顧時刻。",
    starterTitle: "第一位夥伴禮物 · {{credits}} 點",
    starterBody: "第一位夥伴完成入住後，只會發放一次。",
    choosePack: "選擇點數包",
    popular: "熱門",
    packAmount: "{{credits}} 點數",
    storePrice: "App Store 價格",
    purchaseAccessibilityLabel: "購買 {{credits}} 點數",
    packs: {
      small: "先試著開一個套組",
      popular: "適合姿勢套組與主題",
      large: "長期收集與裝飾"
    },
    actions: { buy: "購買", purchasing: "確認中...", arriving: "送達中...", preparing: "商店準備中" },
    storeNotice: "付款由 App Store 處理，只有完成驗證的點數會加入餘額。",
    dialogs: {
      failedTitle: "未能完成購買",
      failedBody: "請檢查連線後再試一次。",
      successTitle: "點數已送達",
      successBody: "已驗證的點數已加入餘額。",
      pendingTitle: "就快好了",
      pendingBody: "購買正在等待商店確認，核准後點數就會送達。",
      delayedTitle: "點數正在路上",
      delayedBody: "購買已完成！點數入帳可能需要多一點時間，請稍後再確認一次。"
    }
  },
  inventory: {
    accessibilityLabel: "物品欄",
    title: "物品欄",
    back: "回到主畫面",
    giveAccessibilityLabel: "立即送出 {{name}}",
    giveHint: "回到家園並開啟這件物品的托盤",
    iconAccessibilityLabel: "{{name}} 物品欄圖示",
    empty: "這裡還空空的——你取得的點心和玩具會出現在這個架上。",
    shop: "商店"
  },
  settings: {
    accessibilityLabel: "{{petName}} 的設定與隱私保管庫",
    title: "設定",
    back: "回到主畫面",
    hero: "天氣、提醒、隱私與支援，都收在這個溫馨角落。",
    language: {
      title: "應用程式語言",
      english: "英文",
      korean: "韓文",
      detail: "可在應用程式中選擇或跟隨裝置。",
      action: "變更"
    },
    status: {
      needsCheck: "需要檢查",
      syncing: "同步中",
      attention: "隱私操作需要留意",
      inProgress: "正在執行隱私操作",
      errorDetail: "無法安全完成變更。請檢查網路連線後再試一次。",
      keepOpen: "變更完成前，請保持應用程式開啟。"
    },
    sections: {
      reminders: "貼心小提醒",
      sound: "聲音與觸感",
      account: "帳號",
      privacy: "隱私與照顧",
      support: "支援與法律資訊"
    },
    notifications: {
      careReminders: "照顧提醒",
      careRemindersDetail: "溫柔提醒餵食、喝水、小小問候，還有信件到來的消息。",
      walkUpdates: "散步通知",
      walkUpdatesDetail: "散步結束時，輕輕提醒你朋友已經回家了。"
    },
    weather: {
      scenes: "天氣場景",
      useLocation: "使用我的位置",
      useLocationDetail: "你的大致位置只會傳送一次，用來查詢花園的真實當地天氣 — 不會被儲存，也不會分享。",
      preview: "預覽天氣",
      next: "下一個：{{weather}}",
      locationMessages: {
        requesting: "正在查詢今天的真實當地天氣，反映到花園裡。",
        ready: "當地天氣已準備好。",
        denied: "未取得位置權限。你仍可手動預覽天氣。",
        error: "目前無法取得當地天氣。請改用手動預覽。"
      },
      options: {
        clear: { label: "晴朗", detail: "預設的陽光花園。" },
        rain: { label: "下雨", detail: "雨景效果和溫馨天氣對話。" },
        snow: { label: "下雪", detail: "冬季背景和輕柔寒冷對話。" },
        wind: { label: "起風", detail: "葉片飄動和散步發現。" },
        hot: { label: "溫暖", detail: "晴朗場景和更多花園照顧提示。" }
      }
    },
    sound: {
      effects: "音效",
      effectsDetail: "輕巧鈴聲和點按聲，搭配柔和震動。",
      music: "音樂與環境音",
      musicDetail: "輕柔的花園音樂和背景聲，例如鳥鳴或雨聲。"
    },
    account: {
      linkTitle: "與 Apple 連結",
      linkDetail: "守護你的花園 — 就算換手機，朋友和回憶也依然安全。",
      linkAction: "連結",
      linkActionInFlight: "連結中",
      recoverTitle: "找回花園",
      recoverDetail: "如果你之前連結過花園，這裡可以把它找回來。",
      recoverAction: "找回",
      recoverActionInFlight: "找回中",
      connectedTitle: "已與 Apple 連結",
      connectedDetail: "你的花園正被安全地保管著。",
      connectedEmailDetail: "已連結：{{email}}",
      unavailableMessage: "這台裝置目前無法使用 Apple 登入。",
      alreadyLinkedMessage: "這個 Apple ID 已經連結到另一座花園。可以用下方的「找回花園」把它帶過來。",
      linkFailedMessage: "目前無法連結你的 Apple ID。請稍後再試一次。",
      recoverConfirmTitle: "要找回這座花園嗎？",
      recoverConfirmMessage: "找回已儲存的花園後，這台手機的花園會被換成那一座。現在的朋友，我們會先妥善收好。要繼續嗎？",
      recoverFailedMessage: "目前無法找回你的花園。請稍後再試一次。",
      recoveredMessage: "已找回你的花園。",
      recoveredNoSnapshotMessage: "沒有找到已儲存的花園，不過朋友的畫作和點數已經找回來了。"
    },
    privacy: {
      localPhoto: "本機照片副本",
      photoDeleted: "已從此裝置刪除。",
      photoStored: "副本只保留在此裝置上。",
      photoNote: "你的照片只用來創造朋友——牠搬進來後，照片就已妥善收起。",
      chatHistory: "聊天記錄",
      chatDeleted: "已刪除此工作階段的記錄。",
      chatDetail: "在這裡管理較長的對話。",
      backup: "備份你的朋友",
      backupDetail: "儲存花園副本，別讓它只留在這台裝置上。",
      restore: "從備份還原",
      restoreDetail: "貼上已儲存的備份，帶回你的花園。"
    },
    links: { privacy: "隱私權", terms: "條款", support: "支援" },
    reset: {
      title: "重設",
      detail: "刪除此裝置上的本機寵物設定，並重新開始新手導覽。",
      action: "刪除寵物資料"
    },
    dialogs: {
      errorLog: "錯誤記錄",
      noErrors: "此裝置最近沒有錯誤記錄。",
      deletePhotoTitle: "刪除本機照片副本？",
      deletePhotoMessage: "這會清除此裝置上儲存的照片副本。你的朋友已經創造完成，牠不會有任何改變。",
      deleteChatTitle: "刪除聊天記錄？",
      deleteChatMessage: "這會清除此工作階段的本機聊天記錄，不會影響免費的照顧反應。",
      backup: "備份",
      backupFailed: "目前無法建立備份。請再試一次。",
      shareFailed: "無法開啟分享選單。請再試一次。",
      restore: "從備份還原",
      restoreFailed: "無法還原該備份。請檢查儲存的文字後再試一次。",
      pasteFirst: "請先貼上備份文字。",
      restoreConfirmTitle: "還原這份備份？",
      restoreConfirmMessage: "這會取代你目前的花園。為了保險起見，我們會先備份現在的朋友。",
      restoredTitle: "歡迎回來！",
      restoredMessage: "你的花園已從備份還原。",
      accountLink: "與 Apple 連結",
      accountRecover: "找回花園",
      deleteAllTitle: "刪除所有資料？",
      deleteAllMessage: "這會刪除此裝置上的寵物設定、生成寵物、照顧狀態與物品欄，也會要求伺服器刪除你的照片、生成頭像和帳號資料。此操作無法復原。",
      serverRetry: "需要重試伺服器刪除",
      serverRetryMessage: "裝置資料已清除。請保持應用程式開啟，稍後再試一次，讓伺服器副本也完成刪除。"
    },
    restoreModal: {
      accessibilityLabel: "從備份還原",
      title: "從備份還原",
      hint: "貼上你先前儲存的備份文字（來自 iCloud、備忘錄或電子郵件）。",
      placeholder: "在此貼上備份 JSON",
      inputAccessibilityLabel: "備份文字"
    },
    dev: {
      fontTitle: "開發：字型組合",
      fontDetail: "比較整個應用程式中的兩組 W2 字型。正式版本不會顯示。",
      errorTitle: "開發：錯誤記錄",
      errorCount: "此裝置最近記錄了 {{count}} 個錯誤。",
      shareLog: "分享記錄",
      clearLog: "清除記錄"
    }
  },
  notifications: {
    channel: { name: "花園近況", description: "關於花園的貼心近況" },
    walkReturn: {
      fallbackPetName: "你的寵物",
      title: "{{petName}} 散步回來了！",
      body: "快來看看 {{petName}} 在外面發現了什麼。"
    },
    garden: {
      meal_due: {
        title: "{{petName}} 正想著碗裡的事",
        body: "來一份小餐點，就能讓飽足感回到舒服的範圍。"
      },
      meal_urgent: {
        title: "{{petName}} 的碗今天還有些空間",
        body: "現在來一份基本餐點，會是給 {{petName}} 的暖心享受。"
      },
      thirst_due: {
        title: "{{petName}} 的水碗可以加點水了",
        body: "很快地補點水，就能讓小心情亮起來。"
      },
      thirst_hot_weather: {
        title: "{{petName}} 想喝口涼水",
        body: "今天空氣暖暖的。先換一碗清水，是最棒的照顧。"
      },
      bored_play: {
        title: "{{petName}} 又找到玩具了",
        body: "現在一起玩一下，好像會很開心。"
      },
      attention_return: {
        title: "{{petName}} 準備了一聲小小招呼",
        body: "打開花園，摸摸牠、聊聊天，或來看看牠吧。"
      },
      walk_window: {
        title: "迷你散步時間",
        body: "{{petName}} 今天也許會喜歡一段悠閒散步。"
      },
      rest_needed: {
        title: "{{petName}} 開啟想睡模式了",
        body: "讓牠休息一下，今晚的步調會更溫柔。"
      },
      rainy_cozy_check: {
        title: "雨天的小小問候",
        body: "{{petName}} 正舒舒服服地待著。這種天氣很適合來打聲招呼。"
      },
      return_after_1_day: {
        title: "門邊出現了一個小腳印",
        body: "{{petName}} 一直想著你什麼時候會再走進來。"
      },
      return_after_1_day_streak: {
        title: "{{petName}} 正守著你們溫馨的小日常",
        body: "連續紀錄還暖暖的。今天來看看，就能讓它繼續發光。"
      },
      return_after_3_days: {
        title: "花園一直為你留著位置",
        body: "過了幾天。等你準備好時，{{petName}} 會很開心聽見你的招呼。"
      }
    },
    monthlyLetter: {
      fallbackPetName: "你的寵物",
      title: "有一封信在等你",
      body: "{{petName}} 的信正在花園裡等著你。"
    }
  },
  errorBoundary: {
    fallbackPetName: "你的朋友",
    title: "剛剛打了個小嗝",
    message: "{{petName}} 沒事。這個畫面只需要重新開始。",
    retry: "再試一次"
  },
  legal: {
    back: "返回設定",
    privacy: {
      accessibilityLabel: "隱私權政策與 AI 揭露",
      eyebrow: "隱私權",
      title: "照片與聊天安全",
      updated: "最後更新：2026 年 7 月 8 日 · v1.1",
      items: {
        first: "不需要帳號或電子郵件——應用程式會以匿名工作階段開啟，不必註冊。",
        second: "寵物原始照片只會傳送給 OpenAI 進行安全檢查和生成頭像，生成完成時就會立即從伺服器自動刪除。",
        third: "日後解鎖更多表情時，會重複使用已生成的頭像圖，不會使用原始照片——屆時原始照片早已不在伺服器上。",
        fourth: "生成的頭像存放在私密儲存空間，只會透過短效簽署連結顯示，絕不使用公開網址。",
        fifth: "照顧狀態、回憶和花園進度會儲存在你的裝置上，因此解除安裝應用程式會永久移除這些資料。",
        sixth: "如果你允許，你的大致位置會四捨五入後只傳送一次，用來查詢花園的真實當地天氣。不會被儲存；如果查詢失敗，裝置會自行產生相近的天氣氛圍。",
        seventh: "進階聊天會標示為 AI 生成，訊息顯示前也會經過內容審核。",
        eighth: "不使用廣告或追蹤 SDK，分析資料也不包含原始照片、原始聊天文字或付款資訊。"
      },
      sections: {
        sharingTitle: "我們與哪些第三方分享資料",
        sharingBody:
          "OpenAI 會處理寵物原始照片，以進行安全檢查和生成頭像；進階聊天時，也會處理寵物檔案和近期對話脈絡。Supabase 提供資料庫、私密儲存空間和匿名驗證。應用程式內付款由 Apple 或 Google 直接處理；我們只會收到收據，絕不會收到你的信用卡資料。",
        rightsTitle: "你的權利",
        rightsBody:
          "你可以單獨刪除原始照片。若要完整刪除，請在「設定」中選擇「刪除寵物資料」。這會清除本機資料，並要求伺服器移除照片、生成頭像、匿名帳號及相關記錄。若無法連上伺服器，本機資料仍會立即清除，應用程式會請你稍後重試伺服器步驟。",
        childrenTitle: "兒童",
        childrenBody: "Mongchi 並非以 13 歲以下兒童為對象。若你認為有兒童透過照片或聊天提供資訊，請聯絡支援團隊，我們會將其刪除。"
      },
      policyLink: "政策連結",
      policyFallback: "安全的隱私權政策連結準備好後，會顯示在這裡。",
      openPolicy: "開啟政策",
      aiTitle: "AI 揭露",
      aiBody: "這是依照寵物檔案由 AI 生成的對話，並不是你真實寵物的意識。"
    },
    support: {
      accessibilityLabel: "支援與生成問題回報",
      eyebrow: "支援",
      title: "協助與回報",
      updated: "最後更新：2026 年 7 月 7 日 · v1.0",
      contact: "聯絡支援團隊",
      contactFallback: "請使用下方的回報功能。電子郵件地址備妥後，即可透過電子郵件聯絡支援團隊。",
      email: "寄信給支援團隊",
      faqTitle: "常見問題",
      faq: {
        photoQuestion: "我的寵物照片安全嗎？",
        photoAnswer: "照片只會用於安全檢查和生成頭像。生成完成後，就會從伺服器自動刪除。",
        deleteQuestion: "如何刪除我的資料？",
        deleteAnswer: "你可以在照片流程中單獨刪除原始照片，或在「設定」中使用「刪除寵物資料」，提出完整刪除本機與伺服器資料的要求。",
        creditQuestion: "生成失敗時，我的點數會怎麼處理？",
        creditAnswer: "系統、安全或品質檢查失敗時，不應扣除付費點數。若你認為點數遭到不當使用，請在下方回報。"
      },
      reportTitle: "回報生成問題",
      reportDetail: "問題回報只會使用安全分類，分析資料不會傳送原始照片。",
      options: {
        wrong: {
          label: "模樣不對",
          description: "種類、花紋或臉看起來不太像。"
        },
        unsafe: {
          label: "模樣不舒服",
          description: "有些地方讓人感到不舒服或害怕。"
        },
        quality: { label: "結果模糊", description: "很難認出這隻寵物。" }
      },
      report: "回報",
      saved: "已儲存",
      lastReport: "上次回報：{{label}}",
      savedTitle: "回報已儲存",
      savedMessage: "只儲存了問題分類，未附上原始照片或聊天文字。",
      feedback: {
        title: "跟我們說說看",
        prompt: "不管是覺得哪裡怪怪的，還是哪個瞬間讓你會心一笑，都歡迎告訴我們。",
        messagePlaceholder: "想到什麼都可以寫下來…",
        messageAccessibilityLabel: "意見回饋內容",
        contactPlaceholder: "如果希望我們回覆，可以留下聯絡方式（選填）",
        contactAccessibilityLabel: "選填的回覆聯絡方式",
        send: "送出意見",
        savedTitle: "謝謝你",
        savedMessage: "我們會仔細看每一則訊息，謝謝你的分享。"
      }
    },
    terms: {
      accessibilityLabel: "條款與付費價值",
      eyebrow: "條款",
      title: "公平使用與付費價值",
      updated: "最後更新：2026 年 7 月 7 日 · v1.0",
      items: {
        first: "Mongchi 是 AI 生成的娛樂內容——你的小夥伴與聊天並非真實寵物的意識、記憶或醫療建議。",
        second: "第一次建立寵物時，你可以自行管理所選照片，也能單獨將它刪除。",
        third: "生成結果不佳、系統失敗和品質檢查失敗時，不應耗用付費價值。",
        fourth: "基本照顧永遠免費。付費物品是增添表現方式，不是用來彌補疏於照顧。",
        fifth: "點數和付費物品不具現金價值；退款依購買時使用的商店政策辦理。",
        sixth: "生成的寵物對話絕不可聲稱自己是真實寵物的意識。"
      },
      sections: {
        useTitle: "可接受的使用方式",
        useBody: "請勿上傳包含人物、露骨或血腥內容，或任何非法內容的照片。請勿規避生成限制或安全檢查，也不要嘗試破解聊天限制。",
        portabilityTitle: "不支援帳號移轉",
        portabilityBody:
          "Mongchi 不使用傳統帳號。工作階段與本機遊戲資料都保存在你的裝置上，因此若未備份就解除安裝或更換裝置，可能會永久失去本機進度、回憶和點數。",
        disclaimerTitle: "免責聲明",
        disclaimerBody: "Mongchi 依現況提供。即使經過安全和品質檢查，AI 生成內容仍可能偶爾不準確或生成失敗。完整限制請參閱完整條款。"
      },
      linkTitle: "條款連結",
      linkFallback: "安全的條款連結準備好後，會顯示在這裡。",
      openTerms: "開啟條款"
    }
  }
} satisfies DeepStringShape<typeof enUS>;
