import type { enUS } from "./en-US";

type DeepStringShape<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : DeepStringShape<T[Key]>;
};

export const jaJP = {
  common: {
    actions: {
      apply: "適用",
      applied: "適用済み",
      backHome: "ホームに戻る",
      cancel: "キャンセル",
      camera: "カメラ",
      checking: "確認中",
      change: "変更",
      chooseAnotherPhoto: "別の写真を選ぶ",
      clear: "消去",
      cleared: "消去しました",
      continue: "続ける",
      delete: "削除",
      deleting: "削除中",
      enable: "オンにする",
      export: "書き出す",
      next: "次へ",
      ok: "確認",
      open: "開く",
      reportIssue: "問題を報告",
      restore: "復元",
      restoring: "復元中",
      saved: "保存しました",
      seeProfile: "プロフィールを見る",
      share: "共有",
      shop: "ショップ",
      skip: "スキップ",
      tryAgain: "もう一度試す",
      turnOff: "オフにする",
      unlock: "アンロック",
      viewHome: "ホームを見る"
    }
  },
  languageSelector: {
    openAccessibilityLabel: "アプリの言語を選択",
    title: "言語を選択",
    subtitle: "端末の言語に合わせるか、好きな言語に固定できます。",
    automatic: "自動",
    automaticDetail: "端末の言語を使用 · {{language}}",
    selected: "選択中",
    saveError: "言語を保存できませんでした。もう一度お試しください。",
    closeAccessibilityLabel: "言語選択を閉じる"
  },
  splash: {
    accessibilityLabel: "小さなペットのおうちの読み込み画面",
    logoAccessibilityLabel: "Mongchiアプリのロゴ",
    animationAccessibilityLabel: "小さな世界の読み込みアニメーション",
    opening: "小さなおうちを開いています",
    warming: "居心地のよいお部屋を暖めています"
  },
  welcome: {
    accessibilityLabel: "Mongchiへようこそ",
    page: "ようこそページ {{total}}件中{{current}}件目",
    skipAccessibilityLabel: "はじめの案内をスキップ",
    start: "写真から始める",
    slides: {
      first: {
        step: "ステップ1",
        title: "大切なペットを、\n毎日そばに",
        body: "お気に入りのペット写真一枚から、庭で待つ小さなお友だちが生まれます。"
      },
      second: {
        step: "ステップ2",
        title: "写真は一枚だけで大丈夫",
        body: "ペットがはっきり写った写真を選び、名前とちょっとした性格を教えてください。"
      },
      third: {
        step: "ステップ3",
        title: "毎日の絆を育てよう",
        body: "ごはんや遊び、おしゃべりを楽しみながら、毎日ペットの心地よい庭へ帰りましょう。"
      }
    }
  },
  photoIntro: {
    accessibilityLabel: "小さなペットの写真案内",
    artAccessibilityLabel: "一枚のペット写真から小さな庭のおうちが開く様子",
    title: "大切なペットを、いつもそばに",
    body: "ペットがはっきり写った写真一枚に名前と性格を添えて、庭で待つ小さなお友だちに会いましょう。",
    quest: { photo: "写真", name: "名前", moveIn: "お引っ越し" },
    privacy: "ペットの写真は、小さなお友だちを作るためだけに使います。お引っ越し後はいつでも元の写真を削除できます。",
    choosePhoto: "ペットの写真を選ぶ"
  },
  photoUpload: {
    accessibilityLabel: "ペット写真のアップロード",
    back: "写真の案内に戻る",
    title: "いちばん素敵な一枚を選んでね",
    artAccessibilityLabel: "安全なペット写真の選択ボード",
    changeSelected: "選んだペット写真を変更",
    choosePhoto: "ペット写真を選ぶ",
    selectedPreview: "選択した{{petName}}のペット写真のプレビュー",
    selectedSamplePreview: "選択した{{petName}}のサンプル写真のプレビュー",
    samplePreview: "ペットのサンプル写真のプレビュー",
    sampleSelected: "サンプル写真を選びました",
    photoSelected: "ペット写真を選びました",
    purpose: "庭で暮らす小さなお友だちを作るために使います。",
    library: "写真ライブラリ",
    sampleAction: "写真が手元にない？ サンプルのお友だちに会う",
    sampleAccessibilityLabel: "サンプルのお友だちに会う",
    privacy: "小さなお友だちを作るためだけに使います。お引っ越し後は元の写真を削除できます。",
    errors: {
      invalidTitle: "この写真は使えません",
      invalidType: "JPEG、PNG、またはWebP形式のペット写真を選んでください。",
      tooLarge: "ペットがはっきり写った10 MB未満の画像を選んでください。",
      libraryTitle: "写真へのアクセスが必要です",
      libraryMessage: "小さなお友だちを作るため、ペット写真を一枚選んでください。",
      cameraTitle: "カメラへのアクセスが必要です",
      cameraMessage: "カメラへのアクセスは、ペット写真を撮影するときだけ使います。"
    }
  },
  petSetup: {
    accessibilityLabel: "ペットの設定",
    back: "写真に戻る",
    artAccessibilityLabel: "名札と心地よいベッドがある小さなペットのお引っ越し机",
    eyebrow: "お引っ越しの書類",
    title: "小さなお友だちに名前をつけよう",
    summary: "{{species}} / {{voice}} · お引っ越しの準備中",
    speciesQuestion: "誰がお引っ越しする？",
    petName: "ペットの名前",
    nameHint: "毎日、玄関であなたを迎えてくれる名前です。",
    personalityQuestion: "この子はどんな性格？",
    voiceQuestion: "小さな声はどんな感じ？",
    favoriteQuestion: "もう好きなものはある？",
    favoriteThing: "小さなお気に入り",
    memoryQuestion: "一緒に持っていきたい小さな思い出はある？",
    firstMemory: "最初の小さな思い出",
    firstMemoryPlaceholder: "お友だちとの小さな思い出…",
    continueHint: "名前、気分、声を選ぶと続けられます。",
    species: { dog: "犬", cat: "猫" },
    personality: {
      playful: "遊び好き",
      calm: "穏やか",
      shy: "恥ずかしがり",
      curious: "好奇心旺盛",
      sleepy: "ねむねむ",
      affectionate: "甘えんぼう"
    },
    voice: {
      cute: "かわいい",
      gentle: "やさしい",
      cheerful: "明るい",
      comforting: "ほっとする"
    }
  },
  generation: {
    accessibilityLabel: "{{petName}}のお引っ越しの流れ",
    back: "ペットの設定に戻る",
    eyebrow: "お引っ越し中",
    titleReady: "{{petName}}の準備ができました",
    titleMoving: "{{petName}}がお引っ越し中",
    warmAccessibilityLabel: "やさしくタップして{{petName}}のたまごを温める",
    artAccessibilityLabel: "{{petName}}の魔法のお引っ越しシーン",
    forming: "写真の特徴から、小さなお友だちが少しずつ形になっています。",
    favoriteFallback: "ほっとする小さなもの",
    progressAccessibilityLabel: "お引っ越しの進み具合",
    recapTitle: "やってくるお友だち",
    failureTitle: "お引っ越しはひと休み中",
    quotaFailure: "小さなお友だちはもうすぐお引っ越しできます。少し時間をおいて、また見にきてください。",
    retryFailure: "小さな扉が引っかかったようです。{{petName}}をもう一度作ってみましょう。",
    reveal: "ペットに会う",
    steps: {
      preparing: "写真を準備中",
      details: "小さな特徴を探しています",
      creating: "お友だちを作っています",
      polishing: "小さな世界を仕上げています",
      movingIn: "お引っ越し中"
    },
    observations: {
      first: "写真の毛色をじっくり見ています...",
      second: "{{petName}}の耳の形を丁寧に描いています...",
      third: "いちばんふわふわなピクセルを一つずつ選んでいます...",
      fourth: "{{petName}}が最初のごあいさつを練習しています...",
      fifth: "ちょうどよいしっぽの振り方を測っています...",
      sixth: "{{petName}}がお昼寝する場所を、おひさまに教えています...",
      seventh: "{{favoriteThing}}の小さな思い出を荷造りしています...",
      eighth: "きらきら輝くまで、つやつやの瞳を磨いています..."
    },
    warmLines: {
      first: "あなたのぬくもりがたまごに届きました。少し動いたよ！",
      second: "たまごがもっとぽかぽかしてきました。",
      third: "小さな鼓動が、ありがとうと伝えています。",
      fourth: "あと少し。あなたの手が力になっています。"
    },
    statuses: {
      created: "小さなアトリエを暖めています。",
      queued: "お引っ越しできる場所が空くのを待っています。",
      claimed: "小さなアトリエを開いています。",
      validating: "写真の特徴を確認しています。",
      preprocessing: "写真を準備しています。",
      safety_checking: "小さなお友だちが安全にお引っ越しできるか確認しています。",
      generating: "最初の小さなお友だちを作っています。",
      postprocessing: "毛並みと最後の細部をやさしく整えています。",
      quality_checking: "仕上がりを確認しています。",
      uploading_assets: "ペットの帰宅準備をしています。",
      cleanup_pending: "お引っ越し前に写真を片づけています。",
      completed: "会う準備ができました。",
      failed: "お引っ越しはひと休み中です。",
      cancelled: "お引っ越しを中止しました。",
      expired: "お引っ越しの時間切れです。"
    },
    teaser: {
      playful: "遊び好きな子が荷造り中...",
      calm: "穏やかな子が荷造り中...",
      shy: "ちょっぴり恥ずかしがりな子が荷造り中...",
      curious: "好奇心いっぱいの子が荷造り中...",
      sleepy: "ねむねむな子が荷造り中...",
      affectionate: "やさしい子が荷造り中...",
      fallback: "やさしい子が荷造り中..."
    },
    guidance: "安定した通信環境を保ってください。アプリが中断しても、戻ると同じお引っ越しを再開します。"
  },
  reveal: {
    accessibilityLabel: "{{petName}}のお披露目",
    back: "お引っ越しに戻る",
    artAccessibilityLabel: "{{petName}}を迎える楽しいお披露目のお祝い",
    plaque: "新しいお友だち",
    eyebrow: "ペットのお披露目",
    title: "{{petName}}に会おう",
    enter: "庭へ入る",
    shareAccessibilityLabel: "{{petName}}を共有",
    notRight: "イメージと少し違う？",
    shareMessages: {
      first: "新しい小さな庭のお友だち、{{petName}}です。Mongchiで作りました。",
      second: "{{petName}}が小さなピクセルの庭へお引っ越ししました。Mongchiで作りました。"
    }
  },
  home: {
    localeAccessibilityLabel: "遊べる{{petName}}の小さな庭のおうち",
    hud: {
      accessibilityLabel: "小さな庭のゲーム状況",
      labels: {
        fullness: "満腹",
        thirst: "水分",
        mood: "気分",
        energy: "元気",
        cleanliness: "清潔"
      },
      meterAccessibilityLabel: "{{label}}の状態。タップして詳細を見る。",
      artAccessibilityLabel: "{{label}}の状態を表す画像"
    },
    rail: {
      openShop: "ショップを開く",
      shopArt: "ショップボタンの画像",
      openChat: "{{petName}}とのチャットを開く",
      chatArt: "チャットボタンの画像",
      openFriend: "{{petName}}のお友だちページを開く",
      friendArt: "お友だちボタンの画像",
      letterWaiting: "{{label}}。新しいお手紙が届いています。",
      openSettings: "設定を開く",
      settingsArt: "設定ボタンの画像"
    },
    pet: {
      accessibilityLabel: "{{petName}}をなでる",
      longPressHint: "長押しして{{petName}}のお友だちページを開く",
      avatarAccessibilityLabel: "生成されたペットのアバター",
      finishMessageHint: "タップするとメッセージをすぐ最後まで表示します。",
      walkingPaws: "歩いている{{petName}}の足あと"
    },
    butterflyAccessibilityLabel: "小さなちょうちょが遊びに来ています。タップしてあいさつする。",
    care: {
      actions: {
        feed: "ごはん",
        talk: "おしゃべり",
        walk: "お散歩",
        play: "遊ぶ",
        rest: "休む",
        affection: "なでる",
        water_garden: "お水",
        clean: "きれいにする",
        treat: "おやつ"
      },
      iconAccessibilityLabel: "{{label}}のお世話アイコン",
      itemAccessibilityLabel: "{{label}}のお世話アイテム",
      feedCooldown: "ごはんメニュー。毎日の食事はあと{{cooldown}}。おやつは使えることがあります。",
      feedMenu: "{{petName}}のごはんメニュー。",
      walkActive: "お散歩中です。{{petName}}はあと{{seconds}}秒で戻ります。",
      optionCooldown: "{{label}}メニュー。基本のお世話はあと{{cooldown}}。特別なアイテムは使えることがあります。",
      recommended: "おすすめ：{{petName}}に{{label}}。{{hint}}",
      actionAccessibilityLabel: "{{petName}}に{{label}}",
      tray: {
        titles: {
          affection: "絆を深める",
          feed: "ごはんとおやつ",
          play: "遊びを選ぶ",
          walk: "道を選ぶ",
          water_garden: "お水"
        },
        optionsAccessibilityLabel: "{{title}}の選択肢",
        shopOption: "{{title}}をショップで見る。",
        cooldownOption: "{{title}}はあと{{cooldown}}で使えます。",
        useOption: "{{petName}}に{{title}}を使う。",
        openShop: "お世話アイテムのショップを開く。",
        shop: "ショップ"
      },
      options: {
        pet: "なでる",
        meal: "ごはん",
        ball: "ボール",
        path: "道",
        water: "お水",
        bath: "お風呂",
        treat: "おやつ"
      },
      meta: {
        bond: "+絆",
        fullness: "+満腹",
        mood: "+気分",
        thirst: "+水分",
        fresh: "+さっぱり",
        shop: "ショップ"
      }
    },
    walk: {
      activeTitle: "{{petName}}はお散歩中 · あと{{time}}で帰宅",
      activeSubcopy: "アプリを閉じても大丈夫です。{{petName}}が戻ったらお知らせします。",
      bringHomeAccessibilityLabel: "{{cost}}クレジットを使って{{petName}}を今すぐ家に呼び戻す",
      cannotBringHomeAccessibilityLabel: "{{petName}}を今すぐ家に呼び戻すためのクレジットが足りません",
      coinAccessibilityLabel: "コイン通貨",
      openCreditStoreAccessibilityLabel: "ジェムショップを開く",
      commentary: {
        early: "{{petName}}はとても大切なにおいを追っています...",
        mid: "{{petName}}は葉っぱにあいさつするため立ち止まりました。",
        late: "{{petName}}が何かを見つけて、家へ持ち帰っています！"
      },
      bringHome: "今すぐ帰宅 · {{cost}}",
      openCreditStore: "ジェムを補充",
      insufficientHint: "ジェムを補充するか、{{petName}}の帰りを待ちましょう。",
      waiting: "{{petName}}はもうすぐ戻ります。のんびり待っていてね。",
      returned: "{{petName}}が小さなおみやげを持って帰ってきました！",
      claimAccessibilityLabel: "{{petName}}を迎えて、お散歩のおみやげを受け取る",
      claim: "お迎えして受け取る"
    },
    guide: {
      tryAction: "まずは「{{action}}」を試してみて。{{petName}}もきっと喜びます。",
      chooseAction: "{{petName}}に小さなお世話を一つ選びましょう。",
      closeAccessibilityLabel: "ゲージの案内を閉じる",
      accessibilityLabel: "ゲージの案内",
      gotIt: "わかりました"
    },
    originalPhotoDeleted: "このセッションの元の写真を削除しました。",
    welcome: {
      accessibilityLabel: "小さな庭へようこそ",
      title: "{{petName}}の小さな庭へようこそ",
      body: "{{petName}}は今日からここで暮らし、あなたとの小さなお世話の時間を楽しみにしています。",
      care: "ごはん、お水、遊び、なでなででゲージを保ちましょう。",
      speech: "吹き出しを見ると、今{{petName}}が何を求めているかわかります。",
      streak: "毎日会いに来て、お世話の連続記録を育てましょう。",
      action: "お世話を始める"
    }
  },
  chat: {
    screenAccessibilityLabel: "{{petName}}とのチャット",
    screenReaderTitle: "{{petName}}とチャット",
    back: "ホームに戻る",
    petAccessibilityLabel: "チャットにいるペット",
    petSays: "{{petName}}の発言：{{text}}",
    finishMessageHint: "タップするとメッセージをすぐ最後まで表示します",
    opening: "ほっとするおしゃべりを開いています...",
    unavailableTitle: "長いおしゃべりはお休み中",
    unavailableDetail: "安全確認が終わるまで、短いおしゃべりとお世話の反応はいつも通り楽しめます。",
    unavailableInput: "長いおしゃべりは準備中です",
    networkError: "今はチャットにつながりません。もう一度試してください。",
    startersAccessibilityLabel: "会話のきっかけ",
    starterAccessibilityLabel: "会話のきっかけを使う：{{starter}}",
    inputAccessibilityLabel: "プレミアムチャットのメッセージ",
    inputPlaceholder: "{{petName}}にメッセージ",
    sendAccessibilityLabel: "プレミアムチャットのメッセージを送信",
    disclosure: "これはペットのプロフィールをもとにAIが生成した会話です。実際のペットの意識ではありません。",
    disclosureBanner: {
      dismissAccessibilityLabel: "AI表示のお知らせを閉じる"
    },
    info: {
      button: "このチャットについて",
      title: "このチャットについて",
      aiTitle: "AIが生成した会話",
      billingTitle: "チャット回数とクレジット",
      billingBody: "送信した瞬間に、含まれるチャットとクレジットが安全に確認されます。今日の無料チャットを使い切ったら、デイパスやクレジットでおしゃべりを続けられます。",
      close: "わかった"
    },
    report: {
      button: "このAI応答を報告",
      reported: "このAI応答は報告済みです",
      title: "この応答を報告",
      detail: "最も近い理由を選んでください。確認用にメッセージ参照と理由のみ保存します。",
      reasons: {
        harmful: "有害または危険",
        inappropriate: "不適切",
        inaccurate: "不正確または誤解を招く",
        other: "その他"
      },
      cancel: "報告を閉じる",
      sending: "報告を送信中...",
      success: "ありがとうございます。この応答を確認に送りました。",
      error: "報告を送信できませんでした。もう一度お試しください。"
    },
    history: {
      accessibilityLabel: "{{petName}}との会話履歴",
      user: "あなた",
      notice: "お知らせ",
      empty: "ここから、ほっとする会話が始まります。",
      notSent: "まだ送信されていません。",
      retryAccessibilityLabel: "メッセージの送信を再試行",
      retry: "再試行",
      typing: "{{petName}}が入力中..."
    },
    deterministicErrors: {
      emptyMessage: "まず短いメッセージを書いてください。",
      locked: "チケット、クレジット、またはPlusパスでチャットを続けられます。",
      session: "チャットを始められませんでした。もう一度試してください。",
      history: "まだこのチャットを読み込めません。もう一度試してください。",
      credits: "このチャットのクレジットを使い切りました。また話したくなったときに、ゆっくり続きを楽しめます。",
      rateLimited: "会話にも小さな休憩が必要なようです。少ししてからもう一度試してください。",
      rejected: "そのメッセージは送れませんでした。別の短いメッセージを試してください。",
      unavailable: "チャットは少し休憩中です。もう一度試してください。"
    }
  },
  friend: {
    accessibilityLabel: "{{petName}}のお友だちページ",
    back: "ホームに戻る",
    share: "{{petName}}を共有",
    movedIn: {
      today: "今日お引っ越ししました",
      daysAgo: "{{count}}日前にお引っ越ししました"
    },
    stats: {
      bond: "絆",
      streak: "連続記録",
      together: "一緒の日々",
      bondAccessibilityLabel: "レベル{{level}}までの絆の進み具合：{{label}}"
    },
    sections: {
      lately: "最近の{{petName}}...",
      walkFinds: "お散歩の発見",
      moments: "小さな思い出",
      letter: "{{petName}}からのお手紙",
      memoryNote: "思い出メモ"
    },
    walkFindAccessibilityLabel: "{{name}}、{{count}}回見つけました",
    undiscoveredWalkFind: "まだ見つけていないお散歩の発見",
    letter: {
      giftAccessibilityLabel: "{{petName}}からのお手紙がプレゼントのように包まれ、開封を待っています",
      openAccessibilityLabel: "{{petName}}からの1か月のお手紙を開く",
      open: "開く",
      checking: "今日のお手紙を確認中..."
    },
    pose: {
      accessibilityLabel: "{{petName}}の{{pose}}ポーズ",
      collectionAccessibilityLabel: "{{petName}}のポーズ",
      position: "{{total}}件中{{current}}件目のポーズ · {{pose}}",
      moreAccessibilityLabel: "思い出ショップで3ポーズパックをもっと見る",
      more: "ポーズをもっと見る",
      labels: { everyday: "いつもの", happy: "うれしい", sleepy: "ねむねむ" }
    },
    shareMessages: {
      days: "{{petName}}は{{count}}日間、私の小さな庭のお友だちです。Mongchiで作りました。",
      fallback: "小さな庭のお友だち、{{petName}}です。Mongchiで作りました。"
    },
    shareCard: {
      title: "カードをカスタマイズ",
      subtitle: "お友だちに見せたいポーズと背景を選んでください。",
      poseSectionTitle: "ポーズ",
      themeSectionTitle: "背景",
      poseOptionAccessibilityLabel: "{{pose}}のポーズ",
      themeOptionAccessibilityLabel: "{{theme}}の背景",
      selected: "選択中",
      previewAccessibilityLabel: "{{petName}}のシェアカードのプレビュー",
      closeAccessibilityLabel: "カードのカスタマイズを閉じる",
      shareAccessibilityLabel: "{{petName}}のカードをシェア"
    }
  },
  shop: {
    accessibilityLabel: "庭のショップ",
    title: "庭のショップ",
    back: "ホームに戻る",
    walletAccessibilityLabel: "ショップのお財布、{{credits}}クレジット、所持キットアイテム{{owned}}個",
    creditGemAccessibilityLabel: "ショップのクレジットジェムアイコン",
    openCreditStore: "ジェムストアを開く",
    categories: {
      all: "すべて",
      treats: "おやつ",
      drinks: "飲みもの",
      toys: "おもちゃ",
      rest: "休む",
      moments: "思い出",
      themes: "テーマ"
    },
    tabs: {
      care: "おやつ・おもちゃ",
      customize: "ポーズ・テーマ"
    },
    sections: {
      careItems: "食べもの・飲みもの・おもちゃ",
      careItemsDescription: "ごほうび、おもちゃ、休息アイテムを選べます。",
      posePacks: "ポーズパック",
      posePacksDescription: "各パックでおそろいの表情とポーズを3つ開放できます。",
      themes: "ガーデンテーマ",
      themesDescription: "小さなおうちの雰囲気をまるごと変えられます。"
    },
    careFiltersAccessibilityLabel: "お世話アイテムのフィルター",
    customizeFiltersAccessibilityLabel: "カスタマイズフィルター",
    categoryAccessibilityLabel: "{{label}}、{{count}}アイテム",
    emptyPreview: "この棚に商品が並ぶと、新しいほっこりアイテムがここに表示されます。",
    emptyShelf: "この棚はただいま準備中です。",
    comingSoon: "近日登場",
    soon: "もうすぐ",
    owned: "所持済み",
    ownedQuantity: "所持数 ×{{count}}",
    devOpen: "開発用に開放",
    available: "利用可能",
    locked: "ロック中",
    backgroundPreview: "{{name}}の背景プレビュー",
    largePreview: "{{name}}の大きなプレビュー",
    backgroundThumbnail: "{{name}}の背景サムネイル",
    itemIcon: "{{name}}のアイコン",
    pricesAccessibilityLabel: "ジェムまたはコインで購入できます",
    walletGemAccessibilityLabel: "お財布のクレジットジェム",
    coinAccessibilityLabel: "コイン通貨",
    gemPriceAccessibilityLabel: "ジェム価格",
    actions: {
      unlockTheme: "テーマをアンロック",
      applyTheme: "テーマを適用",
      getItem: "購入する",
      unlockPack: "パックをアンロック"
    },
    grants: {
      consumable: "クレジット",
      durable: "買い切り",
      subscription: "サブスクリプション"
    },
    products: {
      premiumChat: {
        name: "Plus月額チャット",
        description: "Plusパスの有効期間中は、もっと長くあたたかな会話を楽しめます。"
      },
      extraPetSlot: {
        name: "追加ペット枠",
        description: "小さなペットのプロフィールをもう一つ作れます。"
      },
      regenerationCredit: {
        name: "再生成クレジット",
        description: "新しい見た目にしたいとき、アバターを一度作り直せます。"
      },
      starterTheme: {
        name: "スターターテーマパック",
        description: "小さなおうちを新しい背景に着せ替えます。"
      },
      itemPack: {
        name: "アイテムパック",
        description: "おやつとおもちゃを選りすぐったセットです。"
      },
      treatPack: {
        name: "おやつパック",
        description: "かわいいリアクションを楽しめる特別なおやつです。"
      },
      plusPass: {
        name: "Plusパス",
        description: "長いチャットや今後のPlus機能で絆を深められるプレミアム特典です。"
      }
    },
    actionAccessibility: {
      unlockTheme: "{{price}}で{{name}}をアンロック",
      themeLocked: "{{name}}はロックされています",
      applyTheme: "{{name}}を適用",
      themeApplied: "{{name}}を適用済み",
      buy: "{{name}}を購入"
    },
    summary: {
      accessibilityLabel: "所持キットアイテム{{owned}}個、ロック中のショップアイテム{{locked}}個",
      owned: "キット所持済み",
      locked: "ロック中のショップアイテム{{count}}個"
    },
    dialogs: {
      checkout: "購入手続き",
      checkoutFailed: "今は購入手続きを始められません。もう一度試してください。",
      shop: "ショップ",
      shopFailed: "今はそのアイテムを追加できません。もう一度試してください。",
      itemAdded: "アイテムを追加しました",
      itemAddedMessage: "新しいアイテムが持ちものに届いています。",
      posePack: "ポーズパック",
      posePackFailed: "今はそのポーズパックを始められません。もう一度試してください。",
      posesOnWay: "3つのポーズを準備中",
      posesOnWayMessage: "お友だちの新しい3つのポーズをまとめて作っています。",
      theme: "テーマ",
      themeFailed: "今はテーマを変更できません。もう一度試してください。",
      makeover: "庭を模様替え！",
      themeApplied: "テーマを適用しました",
      themeAppliedMessage: "{{name}}が庭の背景になりました。"
    },
    expressionPacks: {
      title: "ポーズパック",
      description: "今の姿から新しい3ポーズを作ります。",
      poseCount: "3ポーズ",
      boardAccessibilityLabel: "{{name}}、3ポーズパック、{{price}}。{{status}}",
      creditGemAccessibilityLabel: "クレジットジェム",
      allOwned: "3つすべて所持済み",
      allPrice: "3つすべて · {{credits}}",
      actionAccessibilityLabel: "{{name}}で{{action}}",
      actions: {
        generate: "3つすべて生成",
        retry: "3つすべて再試行",
        needCredits: "ジェムを追加",
        making: "ポーズを作成中...",
        owned: "プロフィールで所持済み"
      }
    },
    themes: {
      defaultName: "ほっこりガーデン",
      defaultDescription: "いつでも無料で使える、庭のはじめの背景です。",
      fairyName: "妖精の庭",
      fairyDescription: "やさしく夢見るおうち時間に似合う、光きらめく妖精の庭です。",
      seasideName: "海辺の入り江",
      seasideDescription: "潮風を感じるお散歩にぴったりの、明るい海辺の背景です。",
      autumnName: "秋の森",
      autumnDescription: "季節のお世話を彩る、あたたかな落ち葉とやわらかな金色の光。",
      winterName: "冬のきらめき",
      winterDescription: "やさしい祝祭の光が灯る、雪の夜の背景です。"
    }
  },
  creditsStore: {
    accessibilityLabel: "ジェムストア",
    title: "ジェムストア",
    back: "ガーデンショップに戻る",
    balanceAccessibilityLabel: "現在のジェムは{{credits}}個",
    heroTitle: "もっと小さな瞬間に出会おう",
    heroBody: "ジェムはポーズパック、テーマ、特別なお世話に使えます。",
    starterTitle: "最初の友だちギフト・{{credits}}個",
    starterBody: "最初の友だちの入居完了後に一度だけ追加されます。",
    choosePack: "ジェムパックを選ぶ",
    popular: "人気",
    packAmount: "ジェム{{credits}}個",
    storePrice: "App Store価格",
    purchaseAccessibilityLabel: "ジェム{{credits}}個を購入",
    packs: {
      small: "まずは1パック試す",
      popular: "ポーズとテーマにちょうどいい",
      large: "長く集めて飾る"
    },
    actions: {
      buy: "購入する",
      purchasing: "確認中...",
      preparing: "ストア準備中"
    },
    storeNotice: "決済はApp Storeで処理され、確認済みのジェムだけが残高に追加されます。",
    dialogs: {
      failedTitle: "購入を完了できませんでした",
      failedBody: "接続を確認してもう一度お試しください。",
      successTitle: "ジェムが届きました",
      successBody: "確認済みのジェムが残高に追加されました。"
    }
  },
  inventory: {
    accessibilityLabel: "持ちもの",
    title: "持ちもの",
    back: "ホームに戻る",
    giveAccessibilityLabel: "{{name}}を今すぐあげる",
    giveHint: "ホームに戻り、このアイテムのトレイを開きます",
    iconAccessibilityLabel: "持ちものにある{{name}}のアイコン",
    empty: "まだ何もありません。手に入れたおやつやおもちゃが、この棚に並びます。",
    shop: "ショップ"
  },
  settings: {
    accessibilityLabel: "{{petName}}の設定とプライバシー保管庫",
    title: "設定",
    back: "ホームに戻る",
    hero: "天気、リマインダー、プライバシー、サポートを、心地よいこの場所にまとめました。",
    language: {
      title: "アプリの言語",
      english: "英語",
      korean: "韓国語",
      detail: "アプリで選ぶか、端末の言語に合わせます。",
      action: "変更"
    },
    status: {
      needsCheck: "確認が必要",
      syncing: "同期中",
      attention: "プライバシー操作の確認が必要です",
      inProgress: "プライバシー操作を実行中",
      errorDetail: "変更を安全に完了できませんでした。通信を確認して、もう一度試してください。",
      keepOpen: "変更が終わるまでアプリを開いたままにしてください。"
    },
    sections: {
      reminders: "小さなリマインダー",
      sound: "音と感触",
      privacy: "プライバシーとケア",
      support: "サポートと法的情報"
    },
    notifications: {
      careReminders: "お世話の通知",
      careRemindersDetail: "ごはんやお水、ちょっとしたごあいさつ、お手紙のお知らせをやさしく届けます。",
      walkUpdates: "お散歩の通知",
      walkUpdatesDetail: "お散歩が終わったら、お友だちが帰ってきたことをそっとお知らせします。"
    },
    weather: {
      scenes: "天気の風景",
      useLocation: "現在地を使う",
      useLocationDetail: "おおよその位置情報を一度だけ送って、庭のための実際の現地の天気を調べます — 保存も共有もしません。",
      preview: "天気をプレビュー",
      next: "次：{{weather}}",
      locationMessages: {
        requesting: "今日の実際の現地の天気を庭に反映しています。",
        ready: "現在地の天気を準備できました。",
        denied: "位置情報の許可がありません。手動で天気をプレビューできます。",
        error: "現在地の天気を取得できません。代わりに手動プレビューを試してください。"
      },
      options: {
        clear: { label: "晴れ", detail: "いつもの晴れた庭。" },
        rain: { label: "雨", detail: "雨の演出とほっとする天気のことば。" },
        snow: { label: "雪", detail: "冬の背景とやわらかな寒い日のことば。" },
        wind: { label: "風", detail: "葉っぱの動きとお散歩での発見。" },
        hot: { label: "ぽかぽか", detail: "晴れた風景と庭のお世話のヒント。" }
      }
    },
    sound: {
      effects: "効果音",
      effectsDetail: "小さなチャイムやタップ音に、やさしい振動を添えます。",
      music: "音楽と環境音",
      musicDetail: "鳥のさえずりや雨音など、やわらかな庭の音楽と環境音。"
    },
    privacy: {
      localPhoto: "端末内の写真コピー",
      photoDeleted: "この端末から削除しました。",
      photoStored: "コピーはこの端末だけに保存されています。",
      photoNote: "写真はお友だちを作るためだけに使い、お引っ越し後すぐに大切にしまいました。",
      chatHistory: "チャット履歴",
      chatDeleted: "このセッションから削除しました。",
      chatDetail: "長い会話をここで管理できます。",
      backup: "お友だちをバックアップ",
      backupDetail: "庭のコピーを保存して、この端末だけに残らないようにします。",
      restore: "バックアップから復元",
      restoreDetail: "保存したバックアップを貼り付けて、庭を元に戻します。"
    },
    links: { privacy: "プライバシー", terms: "利用規約", support: "サポート" },
    reset: {
      title: "リセット",
      detail: "この端末のペット設定を削除し、最初の案内からやり直します。",
      action: "ペットデータを削除"
    },
    dialogs: {
      errorLog: "エラーログ",
      noErrors: "この端末に最近のエラー記録はありません。",
      deletePhotoTitle: "端末内の写真コピーを削除しますか？",
      deletePhotoMessage: "この端末に保存された写真コピーを消去します。お友だちはすでに完成しているため、何も変わりません。",
      deleteChatTitle: "チャット履歴を削除しますか？",
      deleteChatMessage: "このセッションの端末内チャット履歴を消去します。無料のお世話リアクションには影響しません。",
      backup: "バックアップ",
      backupFailed: "今はバックアップを作成できません。もう一度試してください。",
      shareFailed: "共有画面を開けませんでした。もう一度試してください。",
      restore: "バックアップから復元",
      restoreFailed: "そのバックアップを復元できませんでした。保存したテキストを確認して、もう一度試してください。",
      pasteFirst: "先にバックアップのテキストを貼り付けてください。",
      restoreConfirmTitle: "このバックアップを復元しますか？",
      restoreConfirmMessage: "現在の庭と置き換えます。念のため、今のお友だちを先にバックアップします。",
      restoredTitle: "おかえりなさい！",
      restoredMessage: "バックアップから庭を復元しました。",
      deleteAllTitle: "すべてのデータを削除しますか？",
      deleteAllMessage:
        "この端末のペット設定、生成したペット、お世話の状態、持ちものを削除し、サーバーにも写真、生成したアバター、アカウントデータの削除を依頼します。元に戻すことはできません。",
      serverRetry: "サーバーの削除を再試行してください",
      serverRetryMessage: "端末のデータは消去されました。アプリを開いたまま、あとでもう一度試すとサーバー上のコピーも削除できます。"
    },
    restoreModal: {
      accessibilityLabel: "バックアップから復元",
      title: "バックアップから復元",
      hint: "以前保存したバックアップのテキストを貼り付けてください（iCloud、メモ、メールなど）。",
      placeholder: "バックアップのJSONをここに貼り付け",
      inputAccessibilityLabel: "バックアップのテキスト"
    },
    dev: {
      fontTitle: "開発用：フォントの組み合わせ",
      fontDetail: "アプリ全体で2組のW2フォントを比較します。製品版には表示されません。",
      errorTitle: "開発用：エラーログ",
      errorCount: "この端末に最近のエラーが{{count}}件記録されています。",
      shareLog: "ログを共有",
      clearLog: "ログを消去"
    }
  },
  notifications: {
    channel: {
      name: "庭からのお知らせ",
      description: "庭の様子をやさしくお知らせします"
    },
    walkReturn: {
      fallbackPetName: "ペット",
      title: "{{petName}}がお散歩から帰ってきました！",
      body: "{{petName}}が何を見つけたか、見にきてね。"
    },
    garden: {
      meal_due: {
        title: "{{petName}}はごはんのことを考えています",
        body: "小さなごはんで、満腹度が心地よいところまで戻りそうです。"
      },
      meal_urgent: {
        title: "今日は{{petName}}のお皿に少し余裕があります",
        body: "今なら、いつものごはんが{{petName}}にうれしいごほうびになりそうです。"
      },
      thirst_due: {
        title: "{{petName}}の水入れに少し足してあげよう",
        body: "さっとお水をあげると、気分も少し明るくなりそうです。"
      },
      thirst_hot_weather: {
        title: "{{petName}}は冷たいひと口がほしいみたい",
        body: "今日は空気があたたかめ。まず新鮮なお水を用意してあげましょう。"
      },
      bored_play: {
        title: "{{petName}}がおもちゃを見つけました",
        body: "今なら少し遊ぶのが楽しそうです。"
      },
      attention_return: {
        title: "{{petName}}が小さなごあいさつを用意しています",
        body: "庭を開いて、なでたり話したり、ちょっと様子を見てみましょう。"
      },
      walk_window: {
        title: "小さなお散歩の時間",
        body: "今日は{{petName}}と穏やかなお散歩を楽しめそうです。"
      },
      rest_needed: {
        title: "{{petName}}はねむねむモード",
        body: "今夜は休ませて、やさしいリズムを保ちましょう。"
      },
      rainy_cozy_check: {
        title: "雨の日の小さなごあいさつ",
        body: "{{petName}}はぬくぬく過ごしています。こんな日は、ひと声かけるのもよさそうです。"
      },
      return_after_1_day: {
        title: "ドアのそばに小さな足あとがつきました",
        body: "{{petName}}は、いつ帰ってくるかなと楽しみにしています。"
      },
      return_after_1_day_streak: {
        title: "{{petName}}がいつもの時間をあたためています",
        body: "連続記録はまだぽかぽか。今日少し会いに行くと、その輝きが続きます。"
      },
      return_after_3_days: {
        title: "庭があなたの場所を空けて待っています",
        body: "少し日が空きました。準備ができたら、{{petName}}にひと声かけてあげてね。"
      }
    },
    monthlyLetter: {
      fallbackPetName: "ペット",
      title: "お手紙が届きました",
      body: "{{petName}}からのお手紙が庭で待っています。"
    }
  },
  errorBoundary: {
    fallbackPetName: "お友だち",
    title: "ちょっとしたつまずきがありました",
    message: "{{petName}}は元気です。この画面だけ、もう一度開き直してみましょう。",
    retry: "もう一度試す"
  },
  legal: {
    back: "設定に戻る",
    privacy: {
      accessibilityLabel: "プライバシーポリシーとAIに関する開示",
      eyebrow: "プライバシー",
      title: "写真とチャットの安全",
      updated: "最終更新：2026年7月8日 · v1.1",
      items: {
        first: "アカウントもメールアドレスも不要です。登録ではなく、匿名セッションでアプリが始まります。",
        second: "ペットの元の写真は、安全確認とアバター生成のためだけにOpenAIへ送信され、生成が終わると同時にサーバーから自動的に削除されます。",
        third: "あとで表情を増やすときは、元の写真ではなく、生成済みのアバター画像を再利用します。その時点で元の写真はサーバーに残っていません。",
        fourth: "生成されたアバターは非公開ストレージに保存され、公開URLではなく、有効期限の短い署名付きリンクだけで表示されます。",
        fifth: "お世話の記録、思い出、庭の進み具合は端末内に保存されるため、アプリを削除すると完全に失われます。",
        sixth: "許可すると、おおよその位置情報を丸めて一度だけ送信し、庭のための実際の現地の天気を調べます。保存されることはなく、もし取得できなかった場合は端末が似た天気の雰囲気を自分で作ります。",
        seventh: "プレミアムチャットにはAI生成であることを表示し、メッセージの表示前に内容を確認します。",
        eighth: "広告や追跡用SDKは使いません。分析にも元の写真、未加工のチャット本文、決済情報は含めません。"
      },
      sections: {
        sharingTitle: "データを共有する第三者",
        sharingBody:
          "OpenAIは、安全確認とアバター生成のためにペットの元の写真を処理し、プレミアムチャットではペットのプロフィールと最近の会話内容を処理します。Supabaseは、データベース、非公開ストレージ、匿名認証を提供します。アプリ内決済はAppleまたはGoogleが直接処理し、当社が受け取るのはレシートだけで、カード情報を受け取ることはありません。",
        rightsTitle: "あなたの権利",
        rightsBody:
          "元の写真は個別に削除できます。すべて削除するには、設定で「ペットデータを削除」を選んでください。端末内のデータを消去し、サーバーにも写真、生成したアバター、匿名アカウント、関連記録の削除を依頼します。サーバーに接続できない場合も端末内のデータはすぐに消去され、サーバー側の削除はあとで再試行するよう案内します。",
        childrenTitle: "お子さまについて",
        childrenBody:
          "Mongchiは13歳未満のお子さまを対象としていません。お子さまが写真やチャットを通じて情報を提供したと思われる場合は、サポートへご連絡ください。該当情報を削除します。"
      },
      policyLink: "ポリシーへのリンク",
      policyFallback: "安全なプライバシーポリシーへのリンクは、準備ができ次第ここに表示されます。",
      openPolicy: "ポリシーを開く",
      aiTitle: "AIに関する開示",
      aiBody: "これはペットのプロフィールをもとにAIが生成した会話です。実際のペットの意識ではありません。"
    },
    support: {
      accessibilityLabel: "サポートと生成結果の報告",
      eyebrow: "サポート",
      title: "ヘルプと報告",
      updated: "最終更新：2026年7月7日 · v1.0",
      contact: "サポート窓口",
      contactFallback: "下の報告機能をご利用ください。メールアドレスの準備ができると、メールサポートを開けます。",
      email: "サポートにメール",
      faqTitle: "よくある質問",
      faq: {
        photoQuestion: "ペットの写真は安全ですか？",
        photoAnswer: "写真は安全確認とアバター生成のためだけに使い、生成が終わるとサーバーから自動的に削除されます。",
        deleteQuestion: "データを削除するには？",
        deleteAnswer: "写真の手順で元の写真だけを削除するか、設定の「ペットデータを削除」から端末とサーバー両方の削除を依頼できます。",
        creditQuestion: "生成に失敗した場合、クレジットはどうなりますか？",
        creditAnswer: "システム、安全確認、品質確認で失敗した場合、有料クレジットは消費されません。不当に使われたと思われる場合は、下からご報告ください。"
      },
      reportTitle: "生成の問題を報告",
      reportDetail: "問題の報告には安全な分類だけを使い、分析に元の写真は送信しません。",
      options: {
        wrong: {
          label: "見た目が違う",
          description: "種類、模様、顔つきに違和感があります。"
        },
        unsafe: {
          label: "不安になる見た目",
          description: "不快または怖く感じるところがあります。"
        },
        quality: {
          label: "ぼやけた結果",
          description: "ペットを見分けにくい状態です。"
        }
      },
      report: "報告",
      saved: "保存済み",
      lastReport: "前回の報告：{{label}}",
      savedTitle: "報告を保存しました",
      savedMessage: "問題の分類だけを保存しました。元の写真やチャット本文は添付していません。"
    },
    terms: {
      accessibilityLabel: "利用規約と有料価値",
      eyebrow: "利用規約",
      title: "公正な利用と有料価値",
      updated: "最終更新：2026年7月7日 · v1.0",
      items: {
        first: "MongchiはAI生成のエンターテインメントです。お友だちやチャットは、実際のペットの意識、記憶、医療上の助言ではありません。",
        second: "最初のペット作成で選んだ写真は利用者が管理でき、個別に削除できます。",
        third: "不適切な生成、システム障害、品質確認での失敗によって、有料価値が消費されることはありません。",
        fourth: "基本のお世話は無料です。有料アイテムは放置からの回復ではなく、表現を豊かにするものです。",
        fifth: "クレジットと有料アイテムに現金としての価値はありません。返金には購入したストアのポリシーが適用されます。",
        sixth: "生成されたペットとの会話が、実際のペットの意識であると主張することはありません。"
      },
      sections: {
        useTitle: "利用上のルール",
        useBody:
          "人物、露骨または残酷な内容、違法な内容を含む写真をアップロードしないでください。生成制限や安全確認を回避したり、チャットの制限解除を試みたりしないでください。",
        portabilityTitle: "アカウントの移行不可",
        portabilityBody:
          "Mongchiは一般的なアカウントを使いません。セッションと端末内のゲームデータは端末に保存されるため、バックアップせずにアプリを削除したり端末を変更したりすると、進み具合、思い出、クレジットが完全に失われることがあります。",
        disclaimerTitle: "免責事項",
        disclaimerBody:
          "Mongchiは現状有姿で提供されます。AI生成コンテンツは、安全確認と品質確認を行っても不正確になったり、生成に失敗したりすることがあります。詳しい制限は利用規約全文をご確認ください。"
      },
      linkTitle: "利用規約へのリンク",
      linkFallback: "安全な利用規約へのリンクは、準備ができ次第ここに表示されます。",
      openTerms: "利用規約を開く"
    }
  }
} satisfies DeepStringShape<typeof enUS>;
