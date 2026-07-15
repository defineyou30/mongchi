export const zhTW = {
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
      savedMessage: "只儲存了問題分類，未附上原始照片或聊天文字。"
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
};
