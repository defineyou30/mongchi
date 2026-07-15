import { DEFAULT_THEME_ID, getCreditItemPrice, isConsumableCareItem } from "@mongchi/shared";
import type { CareActionType, CommerceProduct, Entitlement, ExpressionPack, GeneratedAssetState, Inventory, Item, ItemId } from "@mongchi/shared";
import type { AppLocale } from "../../localization/localeNormalization";
import { getResourcesForLocale } from "../../localization/resourceCatalog";
import { isCareShopCategory } from "./shopRouteParams";
import type { CareShopCategoryId, ShopCategoryId } from "./shopRouteParams";

export interface LocalizedCatalogItemCopy {
  readonly name: string;
  readonly description: string;
}

interface ComputedShopCopy {
  readonly buyMore: string;
  readonly buyAndPlace: string;
  readonly premiumPreview: string;
  readonly starter: string;
  readonly preview: string;
  readonly making: string;
  readonly generating: string;
  readonly retry: string;
  readonly retryPack: string;
  readonly saving: string;
  readonly free: string;
  readonly ownedQuantity: (count: number) => string;
  readonly creditPrice: (credits: number) => string;
  readonly keptStates: (owned: number, total: number) => string;
  readonly readyStates: (owned: number, total: number) => string;
}

const computedShopCopyByLocale = {
  "en-US": {
    buyMore: "Buy more", buyAndPlace: "Buy & place", premiumPreview: "Premium preview", starter: "Starter", preview: "Preview", making: "Making", generating: "Generating", retry: "Retry", retryPack: "Retry pack", saving: "Saving", free: "Free",
    ownedQuantity: (count: number) => `Owned x${count}`,
    creditPrice: (credits: number) => `${credits}`,
    keptStates: (owned: number, total: number) => `${owned}/${total} kept`,
    readyStates: (owned: number, total: number) => `${owned}/${total} ready`
  },
  "ko-KR": {
    buyMore: "더 구매", buyAndPlace: "구매하기", premiumPreview: "프리미엄 미리보기", starter: "기본", preview: "미리보기", making: "만드는 중", generating: "생성 중", retry: "다시 시도", retryPack: "팩 다시 시도", saving: "저장 중", free: "무료",
    ownedQuantity: (count: number) => `보유 x${count}`,
    creditPrice: (credits: number) => `${credits}`,
    keptStates: (owned: number, total: number) => `${owned}/${total}개 보관`,
    readyStates: (owned: number, total: number) => `${owned}/${total}개 준비`
  },
  "ja-JP": {
    buyMore: "追加購入", buyAndPlace: "購入する", premiumPreview: "プレミアムプレビュー", starter: "スターター", preview: "プレビュー", making: "作成中", generating: "生成中", retry: "再試行", retryPack: "パックを再試行", saving: "保存中", free: "無料",
    ownedQuantity: (count: number) => `所持数 ×${count}`,
    creditPrice: (credits: number) => `${credits}`,
    keptStates: (owned: number, total: number) => `${owned}/${total}所持済み`,
    readyStates: (owned: number, total: number) => `${owned}/${total}準備済み`
  },
  "zh-TW": {
    buyMore: "再買一些", buyAndPlace: "購買", premiumPreview: "進階預覽", starter: "新手", preview: "預覽", making: "製作中", generating: "生成中", retry: "重試", retryPack: "重試套組", saving: "儲存中", free: "免費",
    ownedQuantity: (count: number) => `擁有 ×${count}`,
    creditPrice: (credits: number) => `${credits}`,
    keptStates: (owned: number, total: number) => `已收藏 ${owned}/${total}`,
    readyStates: (owned: number, total: number) => `已準備 ${owned}/${total}`
  },
  "de-DE": {
    buyMore: "Mehr kaufen", buyAndPlace: "Kaufen", premiumPreview: "Premium-Vorschau", starter: "Starter", preview: "Vorschau", making: "Wird erstellt", generating: "Wird generiert", retry: "Erneut versuchen", retryPack: "Pack erneut versuchen", saving: "Wird gespeichert", free: "Kostenlos",
    ownedQuantity: (count: number) => `Besitz ×${count}`,
    creditPrice: (credits: number) => `${credits}`,
    keptStates: (owned: number, total: number) => `${owned}/${total} gesammelt`,
    readyStates: (owned: number, total: number) => `${owned}/${total} bereit`
  },
  "fr-FR": {
    buyMore: "En acheter plus", buyAndPlace: "Acheter", premiumPreview: "Aperçu premium", starter: "Départ", preview: "Aperçu", making: "Création", generating: "Génération", retry: "Réessayer", retryPack: "Réessayer le pack", saving: "Enregistrement", free: "Gratuit",
    ownedQuantity: (count: number) => `Possédé x${count}`,
    creditPrice: (credits: number) => `${credits}`,
    keptStates: (owned: number, total: number) => `${owned}/${total} conservées`,
    readyStates: (owned: number, total: number) => `${owned}/${total} prêtes`
  },
  "pt-BR": {
    buyMore: "Comprar mais", buyAndPlace: "Comprar", premiumPreview: "Prévia premium", starter: "Inicial", preview: "Prévia", making: "Criando", generating: "Gerando", retry: "Tentar novamente", retryPack: "Tentar o pacote novamente", saving: "Salvando", free: "Grátis",
    ownedQuantity: (count: number) => `Possui x${count}`,
    creditPrice: (credits: number) => `${credits}`,
    keptStates: (owned: number, total: number) => `${owned}/${total} guardadas`,
    readyStates: (owned: number, total: number) => `${owned}/${total} prontas`
  },
  "es-MX": {
    buyMore: "Comprar más", buyAndPlace: "Comprar", premiumPreview: "Vista previa premium", starter: "Inicial", preview: "Vista previa", making: "Creando", generating: "Generando", retry: "Reintentar", retryPack: "Reintentar paquete", saving: "Guardando", free: "Gratis",
    ownedQuantity: (count: number) => `Tienes x${count}`,
    creditPrice: (credits: number) => `${credits}`,
    keptStates: (owned: number, total: number) => `${owned}/${total} adquiridas`,
    readyStates: (owned: number, total: number) => `${owned}/${total} listas`
  }
} satisfies Record<AppLocale, ComputedShopCopy>;

const catalogCopyByLocale: Readonly<Record<AppLocale, Readonly<Record<string, LocalizedCatalogItemCopy>>>> = {
  "en-US": {
    item_food_bowl_basic: { name: "Little Food Bowl", description: "A starter bowl for gentle daily feeding." },
    item_toy_ball_mint: { name: "Mint Toy Ball", description: "A soft ball for tiny play sessions." },
    item_plush_toy_buddy: { name: "Buddy Plush Toy", description: "A cuddly shelf toy for cozy play corners." },
    item_rope_ring_mint: { name: "Mint Rope Ring", description: "A braided ring for lively tug-and-chase play." },
    item_star_squeaker_sunny: { name: "Sunny Star Squeaker", description: "A bright fabric star for quick playful bursts." },
    item_ribbon_wand_garden: { name: "Garden Ribbon Wand", description: "Soft colorful ribbons for a tiny chase game." },
    item_clover_puzzle_mint: { name: "Clover Puzzle Toy", description: "A gentle sliding puzzle for curious playtime." },
    item_cloud_cushion_sky: { name: "Cloud Nap Cushion", description: "A soft cloud cushion for peaceful little rests." },
    item_flower_pot_sunny: { name: "Sunny Flower Pot", description: "A small pot that brightens the tiny garden." },
    item_stepping_stone_path: { name: "Stepping Stone Path", description: "Rounded stones for a tiny walk route." },
    item_treat_plate_biscuit: { name: "Treat Plate", description: "A tiny plate of biscuits for reward moments." },
    item_bone_biscuit: { name: "Bone Biscuit", description: "A soft biscuit bone for cozy reward moments." },
    item_salmon_bites: { name: "Salmon Bites", description: "Soft salmon cubes for a happy little boost." },
    item_chicken_jerky: { name: "Chicken Jerky", description: "A chewy snack for extra attention moments." },
    item_pumpkin_cookie: { name: "Pumpkin Cookie", description: "A cozy pumpkin cookie for gentle mood care." },
    item_berry_yogurt: { name: "Berry Yogurt", description: "A cool berry cup for bright little reactions." },
    item_sweet_potato_chew: { name: "Sweet Potato Chew", description: "A soft chew for calm snack time." },
    item_tuna_crunch: { name: "Tuna Crunch", description: "Tiny fish-shaped crunchies for curious pets." },
    item_duck_biscuit: { name: "Duck Biscuit", description: "A golden biscuit for special training moments." },
    item_cheese_puff: { name: "Cheese Puff", description: "A tiny cheese snack for playful moods." },
    item_apple_biscuit: { name: "Apple Biscuit", description: "A crisp apple-shaped biscuit for daily care." },
    item_milk_pup_cup: { name: "Milk Pup Cup", description: "A creamy cup for premium cozy reactions." },
    item_cushion_rose: { name: "Rose Nap Cushion", description: "A soft cushion for sleepy home afternoons." }
  },
  "ko-KR": {
    item_food_bowl_basic: { name: "작은 밥그릇", description: "매일 다정하게 밥을 챙겨주는 기본 그릇이에요." },
    item_toy_ball_mint: { name: "민트 장난감 공", description: "작은 놀이 시간에 어울리는 부드러운 공이에요." },
    item_plush_toy_buddy: { name: "친구 봉제 인형", description: "포근한 놀이 시간에 꼭 안기 좋은 인형이에요." },
    item_rope_ring_mint: { name: "민트 로프 링", description: "함께 당기고 쫓아다니며 놀기 좋은 꼬임 장난감이에요." },
    item_star_squeaker_sunny: { name: "햇살 별 삑삑이", description: "짧고 신나는 놀이를 위한 밝은 패브릭 별이에요." },
    item_ribbon_wand_garden: { name: "정원 리본 막대", description: "알록달록한 부드러운 리본을 따라 신나게 놀아요." },
    item_clover_puzzle_mint: { name: "클로버 퍼즐 장난감", description: "호기심을 깨우는 부드러운 밀기 퍼즐이에요." },
    item_cloud_cushion_sky: { name: "구름 낮잠 쿠션", description: "편안하게 쉬는 시간을 위한 포근한 구름 쿠션이에요." },
    item_flower_pot_sunny: { name: "햇살 화분", description: "작은 정원을 환하게 밝히는 화분이에요." },
    item_stepping_stone_path: { name: "디딤돌 길", description: "작은 산책길을 위한 둥근 돌이에요." },
    item_treat_plate_biscuit: { name: "간식 접시", description: "기분 좋은 보상 순간을 위한 작은 비스킷 접시예요." },
    item_bone_biscuit: { name: "뼈다귀 비스킷", description: "포근한 보상 시간에 어울리는 부드러운 비스킷이에요." },
    item_salmon_bites: { name: "연어 한입", description: "기분을 살짝 북돋아 주는 부드러운 연어 큐브예요." },
    item_chicken_jerky: { name: "치킨 육포", description: "관심이 필요한 순간을 위한 쫄깃한 간식이에요." },
    item_pumpkin_cookie: { name: "호박 쿠키", description: "마음을 다정하게 돌보는 포근한 호박 쿠키예요." },
    item_berry_yogurt: { name: "베리 요거트", description: "산뜻한 반응을 불러오는 시원한 베리 컵이에요." },
    item_sweet_potato_chew: { name: "고구마 말랑이", description: "차분한 간식 시간에 어울리는 부드러운 간식이에요." },
    item_tuna_crunch: { name: "참치 바삭이", description: "호기심 많은 친구를 위한 작은 물고기 모양 간식이에요." },
    item_duck_biscuit: { name: "오리 비스킷", description: "특별한 연습 시간에 어울리는 노릇한 비스킷이에요." },
    item_cheese_puff: { name: "치즈 퍼프", description: "장난기 가득한 기분을 위한 작은 치즈 간식이에요." },
    item_apple_biscuit: { name: "사과 비스킷", description: "매일의 돌봄을 위한 바삭한 사과 모양 비스킷이에요." },
    item_milk_pup_cup: { name: "밀크 퍼피 컵", description: "특별하고 포근한 반응을 위한 부드러운 우유 컵이에요." },
    item_cushion_rose: { name: "장미 낮잠 쿠션", description: "나른한 오후에 쉬기 좋은 부드러운 쿠션이에요." }
  },
  "ja-JP": {
    item_food_bowl_basic: { name: "小さなフードボウル", description: "毎日のやさしいごはんに使う基本のボウルです。" },
    item_toy_ball_mint: { name: "ミントのおもちゃボール", description: "ちいさな遊び時間にぴったりのやわらかなボールです。" },
    item_plush_toy_buddy: { name: "おともだちぬいぐるみ", description: "ほっこり遊ぶ場所で抱きしめたくなるぬいぐるみです。" },
    item_rope_ring_mint: { name: "ミントロープリング", description: "引っぱりっこと追いかけ遊びにぴったりの編みリングです。" },
    item_star_squeaker_sunny: { name: "おひさま星スクイーカー", description: "短く元気に遊べる明るい布の星です。" },
    item_ribbon_wand_garden: { name: "ガーデンリボンワンド", description: "やわらかなカラフルリボンを追いかけて遊べます。" },
    item_clover_puzzle_mint: { name: "クローバーパズルトイ", description: "好奇心をくすぐるやさしいスライドパズルです。" },
    item_cloud_cushion_sky: { name: "雲のおひるねクッション", description: "穏やかに休めるふわふわの雲クッションです。" },
    item_flower_pot_sunny: { name: "おひさま植木鉢", description: "小さな庭を明るくしてくれる植木鉢です。" },
    item_stepping_stone_path: { name: "飛び石の小道", description: "小さなお散歩コースに並べる丸い石です。" },
    item_treat_plate_biscuit: { name: "おやつプレート", description: "ごほうびの時間にうれしい小さなビスケット皿です。" },
    item_bone_biscuit: { name: "骨型 ビスケット", description: "ほっこりしたごほうび時間のやわらかなビスケットです。" },
    item_salmon_bites: { name: "サーモン ひとくち", description: "気分をそっと明るくするやわらかなサーモンキューブです。" },
    item_chicken_jerky: { name: "チキン ジャーキー", description: "もう少しかまってほしい時のかみごたえあるおやつです。" },
    item_pumpkin_cookie: { name: "かぼちゃ クッキー", description: "気分をやさしく整えるほっこりかぼちゃクッキーです。" },
    item_berry_yogurt: { name: "ベリー ヨーグルト", description: "明るいリアクションを引き出すひんやりベリーカップです。" },
    item_sweet_potato_chew: { name: "さつまいも チュー", description: "落ち着いたおやつ時間に合うやわらかなチューです。" },
    item_tuna_crunch: { name: "ツナ クランチ", description: "好奇心いっぱいのお友だち向けの小さな魚型おやつです。" },
    item_duck_biscuit: { name: "あひる ビスケット", description: "特別な練習時間にぴったりの黄金色のビスケットです。" },
    item_cheese_puff: { name: "チーズ パフ", description: "遊びたい気分にうれしい小さなチーズおやつです。" },
    item_apple_biscuit: { name: "りんご ビスケット", description: "毎日のお世話に合うさくさくのりんご型ビスケットです。" },
    item_milk_pup_cup: { name: "ミルク パップカップ", description: "特別でほっこりしたリアクションのためのクリーミーなカップです。" },
    item_cushion_rose: { name: "ローズお昼寝クッション", description: "眠たい午後のおうち時間にぴったりのやわらかなクッションです。" }
  },
  "zh-TW": {
    item_food_bowl_basic: { name: "小食盆", description: "每天溫柔餵食時使用的基本食盆。" },
    item_toy_ball_mint: { name: "薄荷玩具球", description: "適合短短玩耍時光的柔軟小球。" },
    item_plush_toy_buddy: { name: "好朋友絨毛玩具", description: "在溫馨遊戲角落裡很適合抱抱的玩偶。" },
    item_rope_ring_mint: { name: "薄荷編織拉環", description: "適合開心拉扯與追逐遊戲的編織玩具。" },
    item_star_squeaker_sunny: { name: "陽光星星啾啾玩具", description: "適合短暫活力玩耍的明亮布星。" },
    item_ribbon_wand_garden: { name: "花園彩帶棒", description: "追著柔軟彩帶玩一場小小追逐遊戲。" },
    item_clover_puzzle_mint: { name: "幸運草益智玩具", description: "為好奇玩耍準備的溫和滑動益智玩具。" },
    item_cloud_cushion_sky: { name: "雲朵午睡墊", description: "讓小夥伴安靜休息的柔軟雲朵坐墊。" },
    item_flower_pot_sunny: { name: "陽光花盆", description: "讓小花園亮起來的小花盆。" },
    item_stepping_stone_path: { name: "踏石小徑", description: "為小小散步路線準備的圓潤石頭。" },
    item_treat_plate_biscuit: { name: "點心盤", description: "獎勵時刻享用的一小盤餅乾。" },
    item_bone_biscuit: { name: "骨頭餅乾", description: "適合溫馨獎勵時刻的柔軟骨頭餅乾。" },
    item_salmon_bites: { name: "鮭魚小方", description: "讓心情小小振奮的柔軟鮭魚丁。" },
    item_chicken_jerky: { name: "雞肉乾", description: "想多一點陪伴時享用的耐嚼點心。" },
    item_pumpkin_cookie: { name: "南瓜餅乾", description: "溫柔照顧心情的暖心南瓜餅乾。" },
    item_berry_yogurt: { name: "莓果優格", description: "帶來明亮反應的清涼莓果杯。" },
    item_sweet_potato_chew: { name: "地瓜咬咬", description: "適合安靜點心時間的柔軟咬咬。" },
    item_tuna_crunch: { name: "鮪魚脆餅", description: "給好奇小夥伴的迷你魚形脆餅。" },
    item_duck_biscuit: { name: "鴨肉餅乾", description: "特別練習時刻享用的金黃餅乾。" },
    item_cheese_puff: { name: "起司泡芙", description: "適合調皮心情的迷你起司點心。" },
    item_apple_biscuit: { name: "蘋果餅乾", description: "日常照顧時享用的酥脆蘋果形餅乾。" },
    item_milk_pup_cup: { name: "牛奶幼犬杯", description: "帶來特別溫馨反應的香濃牛奶杯。" },
    item_cushion_rose: { name: "玫瑰午睡墊", description: "適合慵懶午後休息的柔軟坐墊。" }
  },
  "de-DE": {
    item_food_bowl_basic: { name: "Kleiner Futternapf", description: "Ein einfacher Napf für liebevolle tägliche Mahlzeiten." },
    item_toy_ball_mint: { name: "Mintfarbener Spielball", description: "Ein weicher Ball für kleine Spielrunden." },
    item_plush_toy_buddy: { name: "Kuschelfreund", description: "Ein kuscheliges Spielzeug für gemütliche Spielecken." },
    item_rope_ring_mint: { name: "Mintfarbener Seilring", description: "Ein geflochtener Ring für lebhafte Zerr- und Fangspiele." },
    item_star_squeaker_sunny: { name: "Sonnenstern-Quietscher", description: "Ein heller Stoffstern für kurze, fröhliche Spielrunden." },
    item_ribbon_wand_garden: { name: "Garten-Bänderstab", description: "Weiche bunte Bänder für ein kleines Fangspiel." },
    item_clover_puzzle_mint: { name: "Kleeblatt-Puzzlespielzeug", description: "Ein sanftes Schiebepuzzle für neugierige Spielzeit." },
    item_cloud_cushion_sky: { name: "Wolken-Schlafkissen", description: "Ein weiches Wolkenkissen für friedliche kleine Pausen." },
    item_flower_pot_sunny: { name: "Sonniger Blumentopf", description: "Ein kleiner Topf, der den winzigen Garten aufhellt." },
    item_stepping_stone_path: { name: "Trittsteinpfad", description: "Runde Steine für einen kleinen Spazierweg." },
    item_treat_plate_biscuit: { name: "Leckerli-Teller", description: "Ein kleiner Teller mit Keksen für Belohnungsmomente." },
    item_bone_biscuit: { name: "Knochenkeks", description: "Ein weicher Knochenkeks für gemütliche Belohnungsmomente." },
    item_salmon_bites: { name: "Lachshappen", description: "Weiche Lachswürfel für einen kleinen Glücksschub." },
    item_chicken_jerky: { name: "Hähnchen-Dörrfleisch", description: "Ein zäher Snack für Momente mit extra viel Aufmerksamkeit." },
    item_pumpkin_cookie: { name: "Kürbiskeks", description: "Ein gemütlicher Kürbiskeks für sanfte Stimmungspflege." },
    item_berry_yogurt: { name: "Beerenjoghurt", description: "Ein kühler Beerenbecher für fröhliche kleine Reaktionen." },
    item_sweet_potato_chew: { name: "Süßkartoffel-Kausnack", description: "Ein weicher Kausnack für ruhige Leckerli-Zeit." },
    item_tuna_crunch: { name: "Thunfisch-Knusperli", description: "Kleine fischförmige Knusperhappen für neugierige Freunde." },
    item_duck_biscuit: { name: "Entenkeks", description: "Ein goldener Keks für besondere Trainingsmomente." },
    item_cheese_puff: { name: "Käsehäppchen", description: "Ein kleiner Käsesnack für verspielte Laune." },
    item_apple_biscuit: { name: "Apfelkeks", description: "Ein knuspriger Apfelkeks für die tägliche Fürsorge." },
    item_milk_pup_cup: { name: "Milchbecher", description: "Ein cremiger Becher für besonders gemütliche Reaktionen." },
    item_cushion_rose: { name: "Rosen-Schlafkissen", description: "Ein weiches Kissen für schläfrige Nachmittage zu Hause." }
  },
  "fr-FR": {
    item_food_bowl_basic: { name: "Petite gamelle", description: "Une gamelle de départ pour de doux repas quotidiens." },
    item_toy_ball_mint: { name: "Balle menthe", description: "Une balle douce pour de petites séances de jeu." },
    item_plush_toy_buddy: { name: "Peluche compagnon", description: "Une peluche à câliner dans un coin de jeu douillet." },
    item_rope_ring_mint: { name: "Anneau corde menthe", description: "Un anneau tressé pour tirer et courir joyeusement." },
    item_star_squeaker_sunny: { name: "Étoile couineuse soleil", description: "Une étoile en tissu vive pour de courtes parties de jeu." },
    item_ribbon_wand_garden: { name: "Baguette à rubans du jardin", description: "Des rubans doux et colorés pour une petite course-poursuite." },
    item_clover_puzzle_mint: { name: "Jouet puzzle trèfle", description: "Un puzzle coulissant tout doux pour les moments curieux." },
    item_cloud_cushion_sky: { name: "Coussin sieste nuage", description: "Un coussin nuage moelleux pour de petites pauses paisibles." },
    item_flower_pot_sunny: { name: "Pot de fleurs ensoleillé", description: "Un petit pot qui illumine le jardin miniature." },
    item_stepping_stone_path: { name: "Chemin de pas japonais", description: "Des pierres rondes pour un petit parcours de promenade." },
    item_treat_plate_biscuit: { name: "Assiette de friandises", description: "Une petite assiette de biscuits pour les moments de récompense." },
    item_bone_biscuit: { name: "Biscuit en os", description: "Un tendre biscuit en os pour de douces récompenses." },
    item_salmon_bites: { name: "Bouchées de saumon", description: "De tendres cubes de saumon pour un petit élan de bonheur." },
    item_chicken_jerky: { name: "Poulet séché", description: "Une friandise à mâcher pour les moments où il faut plus d’attention." },
    item_pumpkin_cookie: { name: "Biscuit à la citrouille", description: "Un biscuit réconfortant pour prendre soin de son humeur." },
    item_berry_yogurt: { name: "Yaourt aux baies", description: "Un pot frais aux baies pour de jolies petites réactions." },
    item_sweet_potato_chew: { name: "Bouchée de patate douce", description: "Une bouchée tendre pour une pause friandise paisible." },
    item_tuna_crunch: { name: "Croquant au thon", description: "De petits croquants en forme de poisson pour les curieux." },
    item_duck_biscuit: { name: "Biscuit au canard", description: "Un biscuit doré pour les séances d’apprentissage spéciales." },
    item_cheese_puff: { name: "Soufflé au fromage", description: "Une petite friandise au fromage pour les humeurs joueuses." },
    item_apple_biscuit: { name: "Biscuit à la pomme", description: "Un biscuit croquant en forme de pomme pour les soins quotidiens." },
    item_milk_pup_cup: { name: "Petite tasse de lait", description: "Une tasse crémeuse pour des réactions tendres et spéciales." },
    item_cushion_rose: { name: "Coussin sieste rose", description: "Un coussin doux pour les après-midi somnolents à la maison." }
  },
  "pt-BR": {
    item_food_bowl_basic: { name: "Tigela pequena", description: "Uma tigela inicial para refeições diárias cheias de carinho." },
    item_toy_ball_mint: { name: "Bolinha de menta", description: "Uma bola macia para pequenas brincadeiras." },
    item_plush_toy_buddy: { name: "Pelúcia companheira", description: "Uma pelúcia gostosa de abraçar em cantinhos de brincadeira." },
    item_rope_ring_mint: { name: "Argola de corda menta", description: "Uma argola trançada para puxar e correr com alegria." },
    item_star_squeaker_sunny: { name: "Estrela sonora ensolarada", description: "Uma estrela de tecido brilhante para brincadeiras rápidas." },
    item_ribbon_wand_garden: { name: "Varinha de fitas do jardim", description: "Fitas macias e coloridas para uma pequena perseguição." },
    item_clover_puzzle_mint: { name: "Brinquedo-puzzle de trevo", description: "Um puzzle deslizante suave para momentos curiosos." },
    item_cloud_cushion_sky: { name: "Almofada nuvem", description: "Uma almofada macia para descansos tranquilos." },
    item_flower_pot_sunny: { name: "Vaso ensolarado", description: "Um vasinho que ilumina o pequeno jardim." },
    item_stepping_stone_path: { name: "Caminho de pedras", description: "Pedras redondas para uma pequena rota de passeio." },
    item_treat_plate_biscuit: { name: "Prato de petiscos", description: "Um pratinho de biscoitos para momentos de recompensa." },
    item_bone_biscuit: { name: "Biscoito de osso", description: "Um biscoito macio em forma de osso para recompensas aconchegantes." },
    item_salmon_bites: { name: "Pedacinhos de salmão", description: "Cubinhos macios de salmão para uma dose de alegria." },
    item_chicken_jerky: { name: "Tirinha de frango", description: "Um petisco mastigável para momentos de atenção extra." },
    item_pumpkin_cookie: { name: "Biscoito de abóbora", description: "Um biscoito acolhedor para cuidar do humor com carinho." },
    item_berry_yogurt: { name: "Iogurte de frutas vermelhas", description: "Um copinho gelado para reações alegres." },
    item_sweet_potato_chew: { name: "Mordedor de batata-doce", description: "Um petisco macio para uma pausa tranquila." },
    item_tuna_crunch: { name: "Crocante de atum", description: "Pequenos crocantes em forma de peixe para amigos curiosos." },
    item_duck_biscuit: { name: "Biscoito de pato", description: "Um biscoito dourado para momentos especiais de treino." },
    item_cheese_puff: { name: "Bolinha de queijo", description: "Um pequeno petisco de queijo para o clima de brincadeira." },
    item_apple_biscuit: { name: "Biscoito de maçã", description: "Um biscoito crocante de maçã para o cuidado diário." },
    item_milk_pup_cup: { name: "Copinho de leite", description: "Um copinho cremoso para reações especiais e aconchegantes." },
    item_cushion_rose: { name: "Almofada rosa para soneca", description: "Uma almofada macia para tardes sonolentas em casa." }
  },
  "es-MX": {
    item_food_bowl_basic: { name: "Plato pequeño", description: "Un plato inicial para alimentar con cariño cada día." },
    item_toy_ball_mint: { name: "Pelota de menta", description: "Una pelota suave para pequeños ratos de juego." },
    item_plush_toy_buddy: { name: "Peluche compañero", description: "Un peluche abrazable para rincones de juego acogedores." },
    item_rope_ring_mint: { name: "Aro de cuerda menta", description: "Un aro trenzado para tirar y perseguir con alegría." },
    item_star_squeaker_sunny: { name: "Estrella chillona soleada", description: "Una estrella de tela brillante para juegos rápidos." },
    item_ribbon_wand_garden: { name: "Varita de cintas del jardín", description: "Cintas suaves y coloridas para una pequeña persecución." },
    item_clover_puzzle_mint: { name: "Juguete rompecabezas de trébol", description: "Un rompecabezas deslizante suave para ratos curiosos." },
    item_cloud_cushion_sky: { name: "Cojín siesta de nube", description: "Un cojín suave para pequeños descansos tranquilos." },
    item_flower_pot_sunny: { name: "Maceta soleada", description: "Una maceta pequeña que ilumina el jardín diminuto." },
    item_stepping_stone_path: { name: "Camino de piedras", description: "Piedras redondas para una pequeña ruta de paseo." },
    item_treat_plate_biscuit: { name: "Plato de premios", description: "Un platito de galletas para los momentos de recompensa." },
    item_bone_biscuit: { name: "Galleta de hueso", description: "Una galleta suave en forma de hueso para premios acogedores." },
    item_salmon_bites: { name: "Bocaditos de salmón", description: "Cubitos suaves de salmón para un pequeño impulso de alegría." },
    item_chicken_jerky: { name: "Tira de pollo", description: "Un premio masticable para momentos de atención extra." },
    item_pumpkin_cookie: { name: "Galleta de calabaza", description: "Una galleta acogedora para cuidar el ánimo con ternura." },
    item_berry_yogurt: { name: "Yogur de frutos rojos", description: "Un vasito fresco para reacciones alegres." },
    item_sweet_potato_chew: { name: "Mordida de camote", description: "Un premio suave para una pausa tranquila." },
    item_tuna_crunch: { name: "Crujiente de atún", description: "Pequeños crujientes con forma de pez para mascotas curiosas." },
    item_duck_biscuit: { name: "Galleta de pato", description: "Una galleta dorada para momentos especiales de entrenamiento." },
    item_cheese_puff: { name: "Bocadito de queso", description: "Un pequeño premio de queso para ánimos juguetones." },
    item_apple_biscuit: { name: "Galleta de manzana", description: "Una galleta crujiente de manzana para el cuidado diario." },
    item_milk_pup_cup: { name: "Vasito de leche", description: "Un vasito cremoso para reacciones especiales y acogedoras." },
    item_cushion_rose: { name: "Cojín rosa para siesta", description: "Un cojín suave para tardes soñolientas en casa." }
  }
};

type ExpandedCareCopyKind = "treat" | "drink" | "toy" | "rest";
type NonEnglishAppLocale = Exclude<AppLocale, "en-US">;

const expandedCareCopySeeds = [
  { id: "item_honey_paw_wafer", kind: "treat" },
  { id: "item_dewdrop_water", kind: "drink" },
  { id: "item_apple_sip", kind: "drink" },
  { id: "item_berry_milk", kind: "drink" },
  { id: "item_pumpkin_cream", kind: "drink" },
  { id: "item_blueberry_smoothie", kind: "drink" },
  { id: "item_carrot_cooler", kind: "drink" },
  { id: "item_sweet_potato_shake", kind: "drink" },
  { id: "item_salmon_broth", kind: "drink" },
  { id: "item_tuna_broth", kind: "drink" },
  { id: "item_coconut_splash", kind: "drink" },
  { id: "item_pear_nectar", kind: "drink" },
  { id: "item_moon_frisbee", kind: "toy" },
  { id: "item_bell_roller", kind: "toy" },
  { id: "item_feather_teaser", kind: "toy" },
  { id: "item_snuffle_mat", kind: "toy" },
  { id: "item_wobble_treat_ball", kind: "toy" },
  { id: "item_crinkle_leaf", kind: "toy" },
  { id: "item_sunbeam_spinner", kind: "toy" },
  { id: "item_clover_nap_mat", kind: "rest" },
  { id: "item_moon_pillow", kind: "rest" },
  { id: "item_star_blanket", kind: "rest" },
  { id: "item_cozy_basket", kind: "rest" },
  { id: "item_window_perch", kind: "rest" },
  { id: "item_patchwork_rug", kind: "rest" },
  { id: "item_sleep_tent", kind: "rest" },
  { id: "item_donut_bed", kind: "rest" },
  { id: "item_garden_hammock", kind: "rest" },
  { id: "item_lantern_nest", kind: "rest" }
] as const satisfies readonly { id: ItemId; kind: ExpandedCareCopyKind }[];

const expandedCareNamesByLocale = {
  "ko-KR": [
    "꿀 발바닥 웨이퍼", "이슬 물", "사과 한 모금", "베리 우유", "호박 크림", "블루베리 스무디", "당근 쿨러", "고구마 셰이크", "연어 수프", "참치 수프", "코코넛 스플래시", "배 넥타",
    "달 프리스비", "방울 롤러", "깃털 장난감", "노즈워크 매트", "오뚝이 간식 공", "바스락 잎", "햇살 스피너",
    "클로버 낮잠 매트", "달 베개", "별 담요", "포근한 바구니", "창가 쿠션", "조각보 러그", "동화 수면 텐트", "도넛 침대", "정원 해먹", "랜턴 둥지"
  ],
  "ja-JP": [
    "はちみつ肉球ウエハース", "しずくの水", "りんごドリンク", "ベリーミルク", "かぼちゃクリーム", "ブルーベリースムージー", "にんじんクーラー", "さつまいもシェイク", "サーモンスープ", "ツナスープ", "ココナッツスプラッシュ", "洋なしネクター",
    "お月さまフリスビー", "鈴のローラー", "羽根じゃらし", "ノーズワークマット", "ゆらゆらおやつボール", "カサカサリーフ", "おひさまスピナー",
    "クローバーお昼寝マット", "お月さままくら", "星のブランケット", "ふかふかバスケット", "窓辺クッション", "パッチワークラグ", "絵本のねむりテント", "ドーナツベッド", "お庭のハンモック", "ランタンの巣"
  ],
  "zh-TW": [
    "蜂蜜肉球威化餅", "露珠清水", "蘋果小飲", "莓果牛奶", "南瓜奶霜", "藍莓冰沙", "胡蘿蔔涼飲", "地瓜奶昔", "鮭魚湯", "鮪魚湯", "椰香沁飲", "西洋梨果露",
    "月亮飛盤", "鈴鐺滾輪", "羽毛逗趣棒", "嗅聞墊", "搖搖零食球", "沙沙葉片", "陽光旋轉盤",
    "幸運草午睡墊", "月亮枕", "星星毯", "暖暖提籃", "窗邊軟墊", "拼布地毯", "童話睡眠帳篷", "甜甜圈床", "花園吊床", "提燈小窩"
  ],
  "de-DE": [
    "Honig-Pfotenwaffel", "Tautropfenwasser", "Apfelschluck", "Beerenmilch", "Kürbiscreme", "Blaubeer-Smoothie", "Karottenkühler", "Süßkartoffel-Shake", "Lachsbrühe", "Thunfischbrühe", "Kokos-Spritz", "Birnennektar",
    "Mond-Frisbee", "Glöckchenroller", "Federwedel", "Schnüffelmatte", "Wackel-Leckerliball", "Knisterblatt", "Sonnenstrahl-Kreisel",
    "Kleeblatt-Schlafmatte", "Mondkissen", "Sternendecke", "Kuscheliger Korb", "Fensterkissen", "Patchwork-Teppich", "Märchen-Schlafzelt", "Donutbett", "Gartenhängematte", "Laternennest"
  ],
  "fr-FR": [
    "Gaufrette patte au miel", "Eau de rosée", "Gorgée de pomme", "Lait aux baies", "Crème de citrouille", "Smoothie myrtille", "Boisson carotte", "Shake patate douce", "Bouillon de saumon", "Bouillon de thon", "Éclat de coco", "Nectar de poire",
    "Frisbee lune", "Rouleau à grelots", "Plumeau de jeu", "Tapis de fouille", "Balle à friandises", "Feuille bruissante", "Toupie rayon de soleil",
    "Tapis sieste trèfle", "Coussin lune", "Couverture étoile", "Panier douillet", "Coussin de fenêtre", "Tapis patchwork", "Tente de sommeil", "Lit donut", "Hamac de jardin", "Nid lanterne"
  ],
  "pt-BR": [
    "Wafer de patinha com mel", "Água de orvalho", "Gole de maçã", "Leite de frutas vermelhas", "Creme de abóbora", "Smoothie de mirtilo", "Refresco de cenoura", "Shake de batata-doce", "Caldo de salmão", "Caldo de atum", "Refresco de coco", "Néctar de pera",
    "Frisbee de lua", "Rolinhos com sinos", "Varinha de penas", "Tapete de farejar", "Bola de petisco", "Folha crocante", "Giro de sol",
    "Tapete soneca de trevo", "Almofada de lua", "Cobertor de estrela", "Cesto aconchegante", "Almofada de janela", "Tapete de retalhos", "Tenda de dormir", "Cama de rosquinha", "Rede de jardim", "Ninho de lanterna"
  ],
  "es-MX": [
    "Oblea de patita con miel", "Agua de rocío", "Sorbo de manzana", "Leche de frutos rojos", "Crema de calabaza", "Licuado de arándanos", "Refresco de zanahoria", "Batido de camote", "Caldo de salmón", "Caldo de atún", "Refresco de coco", "Néctar de pera",
    "Frisbee lunar", "Rodillo con cascabeles", "Plumero de juego", "Tapete olfativo", "Pelota de premios", "Hoja crujiente", "Giro de sol",
    "Tapete siesta de trébol", "Almohada lunar", "Manta de estrellas", "Canasta acogedora", "Cojín de ventana", "Tapete de retazos", "Tienda para dormir", "Cama dona", "Hamaca de jardín", "Nido de linterna"
  ]
} as const satisfies Record<NonEnglishAppLocale, readonly string[]>;

const expandedCareDescriptionsByLocale = {
  "en-US": {
    treat: "A sweet little reward for a cozy care moment.",
    drink: "A refreshing little drink for daily care.",
    toy: "A playful little find for curious moments.",
    rest: "A cozy place for a peaceful little rest."
  },
  "ko-KR": { treat: "포근한 돌봄 시간에 건네는 달콤한 보상이에요.", drink: "매일의 돌봄을 위한 상쾌한 음료예요.", toy: "호기심 가득한 놀이 시간을 위한 장난감이에요.", rest: "작은 친구가 편안히 쉬는 포근한 자리예요." },
  "ja-JP": { treat: "ほっこりお世話時間のための甘いごほうびです。", drink: "毎日のお世話にぴったりの爽やかな飲みものです。", toy: "好奇心いっぱいの遊び時間にぴったりです。", rest: "お友だちが静かに休めるほっこりした場所です。" },
  "zh-TW": { treat: "適合溫馨照顧時光的甜蜜獎勵。", drink: "為每日照顧準備的清爽飲品。", toy: "陪伴好奇玩耍時光的趣味小物。", rest: "讓小夥伴安心休息的舒適角落。" },
  "de-DE": { treat: "Eine süße Belohnung für einen gemütlichen Pflegemoment.", drink: "Ein erfrischendes Getränk für die tägliche Fürsorge.", toy: "Ein verspielter Fund für neugierige Momente.", rest: "Ein gemütlicher Platz für eine friedliche kleine Pause." },
  "fr-FR": { treat: "Une douce récompense pour un moment de soin.", drink: "Une boisson rafraîchissante pour les soins quotidiens.", toy: "Une jolie trouvaille pour les moments de jeu curieux.", rest: "Un endroit douillet pour une petite pause paisible." },
  "pt-BR": { treat: "Uma recompensa doce para um momento de carinho.", drink: "Uma bebida refrescante para o cuidado diário.", toy: "Um achado divertido para momentos curiosos.", rest: "Um cantinho aconchegante para um descanso tranquilo." },
  "es-MX": { treat: "Una dulce recompensa para un momento de cariño.", drink: "Una bebida refrescante para el cuidado diario.", toy: "Un hallazgo divertido para momentos curiosos.", rest: "Un rincón acogedor para un descanso tranquilo." }
} as const satisfies Record<AppLocale, Record<ExpandedCareCopyKind, string>>;

const getExpandedCareCatalogCopy = (
  item: Pick<Item, "id" | "name" | "description">,
  locale: AppLocale
): LocalizedCatalogItemCopy | null => {
  const itemIndex = expandedCareCopySeeds.findIndex((seed) => seed.id === item.id);

  if (itemIndex < 0) {
    return null;
  }

  const seed = expandedCareCopySeeds[itemIndex];
  if (!seed) {
    return null;
  }

  if (locale === "en-US") {
    return { name: item.name, description: item.description };
  }

  const name = expandedCareNamesByLocale[locale][itemIndex];
  return name ? { name, description: expandedCareDescriptionsByLocale[locale][seed.kind] } : null;
};

const unknownCatalogCopyByLocale = {
  "en-US": { name: "Cozy item", description: "A cozy little find for your companion." },
  "ko-KR": { name: "포근한 아이템", description: "작은 친구를 위한 포근한 선물이에요." },
  "ja-JP": { name: "ほっこりアイテム", description: "お友だちのための小さなほっこりアイテムです。" },
  "zh-TW": { name: "溫馨小物", description: "送給小夥伴的溫馨小驚喜。" },
  "de-DE": { name: "Gemütlicher Fund", description: "Ein kleiner gemütlicher Fund für deinen Freund." },
  "fr-FR": { name: "Petit objet douillet", description: "Une douce petite trouvaille pour votre compagnon." },
  "pt-BR": { name: "Item aconchegante", description: "Um pequeno achado carinhoso para seu companheiro." },
  "es-MX": { name: "Artículo acogedor", description: "Un pequeño detalle acogedor para tu compañero." }
} as const satisfies Record<AppLocale, LocalizedCatalogItemCopy>;

export const getLocalizedCatalogItemCopy = (item: Pick<Item, "id" | "name" | "description">, locale: AppLocale = "en-US"): LocalizedCatalogItemCopy =>
  catalogCopyByLocale[locale][item.id] ?? getExpandedCareCatalogCopy(item, locale) ?? unknownCatalogCopyByLocale[locale];

export interface LocalizedExpressionPoseCopy {
  readonly name: string;
  readonly usage: string;
}

export interface LocalizedExpressionPackCopy {
  readonly name: string;
  readonly description: string;
  readonly poseCopyByState: Readonly<Record<string, LocalizedExpressionPoseCopy>>;
}

interface ExpressionLocaleCopy {
  readonly packs: Readonly<Record<string, Omit<LocalizedExpressionPackCopy, "poseCopyByState">>>;
  readonly poses: Readonly<Record<string, LocalizedExpressionPoseCopy>>;
}

const expressionCopyByLocale: Readonly<Record<AppLocale, ExpressionLocaleCopy>> = {
  "en-US": {
    packs: {
      "pack-everyday-moments": { name: "Everyday Moments", description: "A few more everyday looks — curious, playful, and a little hungry." },
      "pack-care-reactions": { name: "Care Reactions", description: "Richer looks for treats, walks, and heart-to-heart chats." },
      "pack-special-days": { name: "Special Days", description: "Celebration, garden-helper, and seasonal looks for milestone days." },
      "pack-tender-care": { name: "Tender Care", description: "Gentler looks for the moments when your companion needs extra care." }
    },
    poses: {
      curious: { name: "Curious", usage: "When something catches their eye" }, play: { name: "Playful", usage: "During playtime" }, hungry: { name: "Hungry", usage: "When the bowl feels empty" },
      treat_reaction: { name: "Treat joy", usage: "After a favorite treat" }, walk_return: { name: "Walk home", usage: "Coming back from a walk" }, chat_portrait: { name: "Chat close-up", usage: "In heart-to-heart chats" },
      celebrate: { name: "Celebrate", usage: "Bond levels and milestones" }, garden_help: { name: "Garden helper", usage: "While tending the garden" }, seasonal: { name: "Seasonal", usage: "Seasonal garden moments" },
      sad: { name: "Needs comfort", usage: "When comfort is needed" }, sick: { name: "Under the weather", usage: "On low-energy care days" }, messy: { name: "A little messy", usage: "After muddy adventures" }
    }
  },
  "ko-KR": {
    packs: {
      "pack-everyday-moments": { name: "일상의 순간들", description: "궁금해하고, 신나게 놀고, 배고파하는 모습까지 — 일상 속 표정을 더 만나보세요." },
      "pack-care-reactions": { name: "돌봄 리액션", description: "간식, 산책, 대화 순간에 더 잘 어울리는 리액션을 열어요." },
      "pack-special-days": { name: "특별한 날", description: "기념일, 정원 돌보기, 계절 분위기에 맞는 특별한 모습을 열어요." },
      "pack-tender-care": { name: "다정한 돌봄", description: "조금 더 세심한 돌봄이 필요한 순간을 위한 표정을 열어요." }
    },
    poses: {
      curious: { name: "궁금해", usage: "무언가 눈길을 끌 때" }, play: { name: "신나게", usage: "함께 놀아줄 때" }, hungry: { name: "배고파", usage: "배가 고파질 때" },
      treat_reaction: { name: "간식 최고", usage: "좋아하는 간식을 먹은 뒤" }, walk_return: { name: "산책 다녀와", usage: "산책에서 돌아올 때" }, chat_portrait: { name: "대화 가까이", usage: "마음을 나누는 대화에서" },
      celebrate: { name: "축하해", usage: "관계 레벨과 기념일에" }, garden_help: { name: "정원 도우미", usage: "정원을 돌볼 때" }, seasonal: { name: "계절 느낌", usage: "계절 이벤트에서" },
      sad: { name: "위로가 필요해", usage: "위로가 필요한 순간에" }, sick: { name: "기운이 없어", usage: "기운이 없는 돌봄 날에" }, messy: { name: "조금 꼬질꼬질", usage: "신나게 뛰놀고 난 뒤" }
    }
  },
  "ja-JP": {
    packs: {
      "pack-everyday-moments": { name: "日々のひととき", description: "気になる顔、遊びたい顔、少しおなかがすいた顔。毎日の表情がもっと増えます。" },
      "pack-care-reactions": { name: "お世話リアクション", description: "おやつ、お散歩、心を通わせる会話にぴったりの表情です。" },
      "pack-special-days": { name: "特別な日", description: "お祝い、庭のお手伝い、季節の節目に出会える特別な表情です。" },
      "pack-tender-care": { name: "やさしいお世話", description: "いつもより少し丁寧なお世話が必要な時のやさしい表情です。" }
    },
    poses: {
      curious: { name: "興味津々", usage: "何かが目に留まった時" }, play: { name: "遊びたい", usage: "一緒に遊ぶ時" }, hungry: { name: "おなかすいた", usage: "お皿が空っぽに感じる時" },
      treat_reaction: { name: "おやつ最高", usage: "お気に入りのおやつの後" }, walk_return: { name: "お散歩帰り", usage: "お散歩から帰った時" }, chat_portrait: { name: "会話アップ", usage: "心を通わせる会話で" },
      celebrate: { name: "お祝い", usage: "絆レベルや記念日に" }, garden_help: { name: "庭のお手伝い", usage: "庭のお世話をする時" }, seasonal: { name: "季節の装い", usage: "季節の庭のひとときに" },
      sad: { name: "なぐさめて", usage: "安心したい時" }, sick: { name: "ちょっと不調", usage: "元気が少ないお世話の日に" }, messy: { name: "少しどろんこ", usage: "泥んこで遊んだ後" }
    }
  },
  "zh-TW": {
    packs: {
      "pack-everyday-moments": { name: "日常時光", description: "多一些好奇、愛玩和有點餓的日常表情。" },
      "pack-care-reactions": { name: "照顧反應", description: "為點心、散步和談心時刻增添更豐富的表情。" },
      "pack-special-days": { name: "特別日子", description: "解鎖慶祝、花園小幫手和季節里程碑的表情。" },
      "pack-tender-care": { name: "溫柔照顧", description: "在小夥伴需要更多照顧時，送上更柔和的表情。" }
    },
    poses: {
      curious: { name: "好奇", usage: "有什麼吸引目光時" }, play: { name: "愛玩", usage: "一起玩耍時" }, hungry: { name: "肚子餓", usage: "食盆看起來空空時" },
      treat_reaction: { name: "點心真棒", usage: "吃完最愛的點心後" }, walk_return: { name: "散步回家", usage: "散步回來時" }, chat_portrait: { name: "談心特寫", usage: "溫暖談心時" },
      celebrate: { name: "慶祝", usage: "感情升級和紀念日時" }, garden_help: { name: "花園小幫手", usage: "照顧花園時" }, seasonal: { name: "季節感", usage: "季節花園時刻" },
      sad: { name: "需要安慰", usage: "想被安慰時" }, sick: { name: "有點不舒服", usage: "活力較低的照顧日" }, messy: { name: "有點髒髒", usage: "泥巴冒險之後" }
    }
  },
  "de-DE": {
    packs: {
      "pack-everyday-moments": { name: "Alltagsmomente", description: "Mehr Blicke für jeden Tag: neugierig, verspielt und ein wenig hungrig." },
      "pack-care-reactions": { name: "Fürsorge-Reaktionen", description: "Ausdrucksstarke Blicke für Leckerlis, Spaziergänge und vertraute Gespräche." },
      "pack-special-days": { name: "Besondere Tage", description: "Feierliche, hilfreiche und saisonale Blicke für Meilensteine." },
      "pack-tender-care": { name: "Sanfte Fürsorge", description: "Sanftere Blicke für Momente, in denen dein Freund mehr Zuwendung braucht." }
    },
    poses: {
      curious: { name: "Neugierig", usage: "Wenn etwas ins Auge fällt" }, play: { name: "Verspielt", usage: "Beim gemeinsamen Spielen" }, hungry: { name: "Hungrig", usage: "Wenn der Napf leer wirkt" },
      treat_reaction: { name: "Leckerli-Freude", usage: "Nach dem Lieblingsleckerli" }, walk_return: { name: "Zurück vom Spaziergang", usage: "Bei der Heimkehr" }, chat_portrait: { name: "Gesprächsnahaufnahme", usage: "Bei vertrauten Gesprächen" },
      celebrate: { name: "Feiern", usage: "Bei Bindungsstufen und Meilensteinen" }, garden_help: { name: "Gartenhilfe", usage: "Bei der Gartenpflege" }, seasonal: { name: "Saisonal", usage: "Bei saisonalen Gartenmomenten" },
      sad: { name: "Braucht Trost", usage: "Wenn Trost guttut" }, sick: { name: "Nicht ganz fit", usage: "An ruhigen Pflegetagen" }, messy: { name: "Etwas schmutzig", usage: "Nach matschigen Abenteuern" }
    }
  },
  "fr-FR": {
    packs: {
      "pack-everyday-moments": { name: "Moments du quotidien", description: "Quelques expressions de plus au quotidien : curieuse, joueuse et un peu affamée." },
      "pack-care-reactions": { name: "Réactions aux soins", description: "Des expressions plus riches pour les friandises, les promenades et les confidences." },
      "pack-special-days": { name: "Jours spéciaux", description: "Des expressions de fête, d’aide au jardin et de saison pour les grands moments." },
      "pack-tender-care": { name: "Soins tout doux", description: "Des expressions plus douces quand votre compagnon a besoin d’une attention particulière." }
    },
    poses: {
      curious: { name: "Curieux", usage: "Quand quelque chose attire son regard" }, play: { name: "Joueur", usage: "Pendant les jeux" }, hungry: { name: "Affamé", usage: "Quand la gamelle semble vide" },
      treat_reaction: { name: "Joie gourmande", usage: "Après sa friandise préférée" }, walk_return: { name: "Retour de promenade", usage: "Au retour d’une balade" }, chat_portrait: { name: "Gros plan complice", usage: "Pendant les confidences" },
      celebrate: { name: "Célébrer", usage: "Pour les niveaux de lien et les étapes" }, garden_help: { name: "Aide au jardin", usage: "Pendant l’entretien du jardin" }, seasonal: { name: "De saison", usage: "Pour les moments saisonniers au jardin" },
      sad: { name: "Besoin de réconfort", usage: "Quand un câlin ferait du bien" }, sick: { name: "Patraque", usage: "Pendant les journées plus calmes" }, messy: { name: "Un peu sale", usage: "Après les aventures dans la boue" }
    }
  },
  "pt-BR": {
    packs: {
      "pack-everyday-moments": { name: "Momentos do dia a dia", description: "Mais expressões cotidianas: curiosa, brincalhona e com um pouco de fome." },
      "pack-care-reactions": { name: "Reações de cuidado", description: "Expressões mais ricas para petiscos, passeios e conversas de coração." },
      "pack-special-days": { name: "Dias especiais", description: "Expressões de celebração, ajuda no jardim e estações para grandes momentos." },
      "pack-tender-care": { name: "Cuidado carinhoso", description: "Expressões mais suaves para quando seu companheiro precisa de atenção extra." }
    },
    poses: {
      curious: { name: "Curioso", usage: "Quando algo chama a atenção" }, play: { name: "Brincalhão", usage: "Durante a brincadeira" }, hungry: { name: "Com fome", usage: "Quando a tigela parece vazia" },
      treat_reaction: { name: "Alegria do petisco", usage: "Depois do petisco favorito" }, walk_return: { name: "Volta do passeio", usage: "Ao chegar do passeio" }, chat_portrait: { name: "Close da conversa", usage: "Nas conversas de coração" },
      celebrate: { name: "Celebrar", usage: "Nos níveis de vínculo e marcos" }, garden_help: { name: "Ajudante do jardim", usage: "Enquanto cuida do jardim" }, seasonal: { name: "Sazonal", usage: "Nos momentos de estação no jardim" },
      sad: { name: "Precisa de carinho", usage: "Quando um carinho faz bem" }, sick: { name: "Meio indisposto", usage: "Nos dias de cuidado com pouca energia" }, messy: { name: "Um pouco sujo", usage: "Depois de aventuras na lama" }
    }
  },
  "es-MX": {
    packs: {
      "pack-everyday-moments": { name: "Momentos cotidianos", description: "Más expresiones del día a día: curiosa, juguetona y con un poco de hambre." },
      "pack-care-reactions": { name: "Reacciones de cuidado", description: "Expresiones más ricas para premios, paseos y charlas de corazón." },
      "pack-special-days": { name: "Días especiales", description: "Expresiones de celebración, ayuda en el jardín y temporada para grandes momentos." },
      "pack-tender-care": { name: "Cuidado cariñoso", description: "Expresiones más suaves para cuando tu compañero necesita atención adicional." }
    },
    poses: {
      curious: { name: "Curioso", usage: "Cuando algo llama su atención" }, play: { name: "Juguetón", usage: "Durante el juego" }, hungry: { name: "Con hambre", usage: "Cuando el plato parece vacío" },
      treat_reaction: { name: "Alegría por el premio", usage: "Después de su premio favorito" }, walk_return: { name: "Vuelta del paseo", usage: "Al regresar de un paseo" }, chat_portrait: { name: "Primer plano de charla", usage: "En las charlas de corazón" },
      celebrate: { name: "Celebrar", usage: "En niveles de vínculo y logros" }, garden_help: { name: "Ayudante del jardín", usage: "Mientras cuida el jardín" }, seasonal: { name: "De temporada", usage: "En momentos de temporada en el jardín" },
      sad: { name: "Necesita consuelo", usage: "Cuando le vendría bien cariño" }, sick: { name: "Un poco indispuesto", usage: "En días de cuidado con poca energía" }, messy: { name: "Un poco sucio", usage: "Después de aventuras con lodo" }
    }
  }
};

const unknownExpressionPackCopyByLocale = {
  "en-US": { name: "Special moments", description: "Three cozy new poses for your companion." },
  "ko-KR": { name: "특별한 순간", description: "작은 친구를 위한 포근한 새 포즈 세 가지예요." },
  "ja-JP": { name: "特別なひととき", description: "お友だちのための新しいほっこりポーズ3つです。" },
  "zh-TW": { name: "特別時光", description: "為小夥伴準備的三個溫馨新姿勢。" },
  "de-DE": { name: "Besondere Momente", description: "Drei neue gemütliche Posen für deinen Freund." },
  "fr-FR": { name: "Moments spéciaux", description: "Trois nouvelles poses douces pour votre compagnon." },
  "pt-BR": { name: "Momentos especiais", description: "Três novas poses aconchegantes para seu companheiro." },
  "es-MX": { name: "Momentos especiales", description: "Tres nuevas poses acogedoras para tu compañero." }
} as const satisfies Record<AppLocale, Omit<LocalizedExpressionPackCopy, "poseCopyByState">>;

const unknownExpressionPoseCopyByLocale = {
  "en-US": { name: "Special pose", usage: "For a special moment" },
  "ko-KR": { name: "특별한 포즈", usage: "특별한 순간에" },
  "ja-JP": { name: "特別なポーズ", usage: "特別なひとときに" },
  "zh-TW": { name: "特別姿勢", usage: "在特別時刻" },
  "de-DE": { name: "Besondere Pose", usage: "Für einen besonderen Moment" },
  "fr-FR": { name: "Pose spéciale", usage: "Pour un moment spécial" },
  "pt-BR": { name: "Pose especial", usage: "Para um momento especial" },
  "es-MX": { name: "Pose especial", usage: "Para un momento especial" }
} as const satisfies Record<AppLocale, LocalizedExpressionPoseCopy>;

export const getLocalizedExpressionPackCopy = (pack: ExpressionPack, locale: AppLocale = "en-US"): LocalizedExpressionPackCopy => {
  const localeCopy = expressionCopyByLocale[locale];

  return {
    ...(localeCopy.packs[pack.id] ?? unknownExpressionPackCopyByLocale[locale]),
    poseCopyByState: Object.fromEntries(
      pack.states.map((state) => [state, localeCopy.poses[state] ?? unknownExpressionPoseCopyByLocale[locale]])
    )
  };
};

// Starter kit items granted for free at signup (see mockInventory) — they
// have no purchase path and no in-game use beyond the fixed care-action
// bonus already baked into their base action (feed/play), so surfacing them
// as "Owned" shop entries would just be dead clutter on the shop shelves.
const nonShoppableStarterKitItemIds: ReadonlySet<ItemId> = new Set(["item_food_bowl_basic", "item_toy_ball_mint"]);

export const isNonShoppableStarterKitItem = (itemId: ItemId): boolean => nonShoppableStarterKitItemIds.has(itemId);

export type LocalShopCatalogStatusKind = "owned" | "premium" | "starter" | "available";

export interface LocalShopCatalogPresentation {
  locked: boolean;
  ownedQuantity: number;
  creditCost: number | null;
  repeatable: boolean;
  purchaseLabel: string | null;
  statusKind: LocalShopCatalogStatusKind;
  statusLabel: string;
}

export interface ShopSummaryPresentation {
  lockedCount: number;
  ownedQuantity: number;
  visibleCount: number;
}

export type ExpressionPackShopStatus = "owned" | "generating" | "purchasing" | "failed" | "available" | "locked";

export interface ExpressionPackShopPresentation {
  status: ExpressionPackShopStatus;
  ownedStateCount: number;
  totalStateCount: number;
  canAct: boolean;
  priceLabel: string;
  statusLabel: string;
  actionLabel: string;
}

interface ExpressionPackPurchaseStatusLike {
  readonly status: "pending" | "failed";
  readonly failureMessageSafe?: string;
}

export const isPremiumPassProduct = (product: CommerceProduct) =>
  product.productId === "premium_chat_monthly" ||
  product.entitlementKey === "premium_chat" ||
  product.entitlementKey === "subscription_plus";

export const hasActiveProductEntitlement = (product: CommerceProduct, entitlements: Entitlement[]) =>
  entitlements.some(
    (entitlement) =>
      entitlement.status === "active" &&
      (entitlement.productId === product.productId || entitlement.key === product.entitlementKey)
  );

export const getLocalShopCatalogPresentation = (item: Item, inventory: Inventory, locale: AppLocale = "en-US"): LocalShopCatalogPresentation => {
  const copy = computedShopCopyByLocale[locale];
  const resources = getResourcesForLocale(locale);
  const ownedEntry = inventory.items.find((entry) => entry.itemId === item.id);
  const creditCost = getCreditItemPrice(item.id)?.creditCost ?? null;
  const repeatable = isConsumableCareItem(item);

  if (ownedEntry) {
    return {
      locked: false,
      ownedQuantity: ownedEntry.quantity,
      creditCost,
      repeatable,
      purchaseLabel: repeatable && creditCost !== null ? copy.buyMore : null,
      statusKind: "owned",
      statusLabel: copy.ownedQuantity(ownedEntry.quantity)
    };
  }

  if (item.isPremium) {
    return {
      locked: true,
      ownedQuantity: 0,
      creditCost,
      repeatable,
      purchaseLabel: creditCost !== null ? copy.buyAndPlace : null,
      statusKind: "premium",
      statusLabel: copy.premiumPreview
    };
  }

  if (item.rarity === "starter") {
    return {
      locked: true,
      ownedQuantity: 0,
      creditCost,
      repeatable,
      purchaseLabel: creditCost !== null ? copy.buyAndPlace : null,
      statusKind: "starter",
      statusLabel: copy.starter
    };
  }

  return {
    locked: true,
    ownedQuantity: 0,
    creditCost,
    repeatable,
    purchaseLabel: creditCost !== null ? copy.buyAndPlace : null,
    statusKind: "available",
    statusLabel: creditCost !== null ? resources.shop.available : copy.preview
  };
};

export const getLocalShopSummaryPresentation = (
  items: Item[],
  inventory: Inventory,
  locale: AppLocale = "en-US"
): ShopSummaryPresentation => {
  const itemPresentations = items.map((item) => getLocalShopCatalogPresentation(item, inventory, locale));

  return {
    lockedCount: itemPresentations.filter((presentation) => presentation.locked).length,
    ownedQuantity: inventory.items.reduce((total, item) => total + item.quantity, 0),
    visibleCount: items.length
  };
};

export const getExpressionPackShopPresentation = (
  pack: ExpressionPack,
  acceptedAssetStates: readonly GeneratedAssetState[],
  inventory: Inventory,
  purchaseStatus: ExpressionPackPurchaseStatusLike | undefined,
  devStoreCreditsAvailable: boolean,
  creditBalance: number,
  locale: AppLocale = "en-US"
): ExpressionPackShopPresentation => {
  const copy = computedShopCopyByLocale[locale];
  const resources = getResourcesForLocale(locale);
  const acceptedStateSet = new Set(acceptedAssetStates);
  const ownedStateCount = pack.states.filter((state) => acceptedStateSet.has(state)).length;
  const totalStateCount = pack.states.length;
  const fullyUnlocked = ownedStateCount === totalStateCount;
  const recordedOwned = (inventory.ownedExpressionPackIds ?? []).includes(pack.id);

  if (fullyUnlocked) {
    return {
      status: "owned",
      ownedStateCount,
      totalStateCount,
      canAct: false,
      priceLabel: resources.shop.owned,
      statusLabel: copy.keptStates(ownedStateCount, totalStateCount),
      actionLabel: resources.shop.owned
    };
  }

  if (purchaseStatus?.status === "pending") {
    return {
      status: "purchasing",
      ownedStateCount,
      totalStateCount,
      canAct: false,
      priceLabel: copy.making,
      statusLabel: copy.generating,
      actionLabel: resources.shop.expressionPacks.actions.making
    };
  }

  const affordable = devStoreCreditsAvailable || creditBalance >= pack.creditCost;

  if (purchaseStatus?.status === "failed") {
    return {
      status: "failed",
      ownedStateCount,
      totalStateCount,
      canAct: affordable,
      priceLabel: copy.creditPrice(pack.creditCost),
      statusLabel: copy.retry,
      actionLabel: affordable ? copy.retryPack : resources.shop.expressionPacks.actions.needCredits
    };
  }

  if (recordedOwned) {
    return {
      status: "generating",
      ownedStateCount,
      totalStateCount,
      canAct: false,
      priceLabel: copy.saving,
      statusLabel: copy.readyStates(ownedStateCount, totalStateCount),
      actionLabel: resources.shop.expressionPacks.actions.making
    };
  }

  return {
    status: affordable ? "available" : "locked",
    ownedStateCount,
    totalStateCount,
    canAct: affordable,
    priceLabel: copy.creditPrice(pack.creditCost),
    statusLabel: affordable ? resources.shop.available : resources.shop.locked,
    actionLabel: affordable ? resources.shop.actions.unlockPack : resources.shop.expressionPacks.actions.needCredits
  };
};

/**
 * The three states a garden theme card can be in -- see the "테마 BM 결함" fix.
 * Every theme (default included) renders through this single presentation
 * path now; there is no separate "free instant apply" list anymore.
 */
export type ThemeCardStatus = "default_free" | "locked_for_purchase" | "owned";

export interface ThemeCardPresentation {
  status: ThemeCardStatus;
  owned: boolean;
  applied: boolean;
  /** True when tapping this card's action button should do something (buy or apply). False only for an already-applied card. */
  canAct: boolean;
  priceLabel: string;
  statusLabel: string;
  actionLabel: string;
}

/**
 * Presents a single theme card's price/status/action-button copy from raw
 * ownership + selection state, so ShopPreviewScreen has one rendering path
 * for the default theme, an unpurchased theme, and an owned-but-not-applied
 * theme instead of the old two-list (free-apply vs buy-card) split.
 */
export const getThemeCardPresentation = (
  themeId: ItemId,
  creditCost: number,
  inventory: Inventory,
  devStoreUnlocked: boolean,
  creditBalance: number,
  locale: AppLocale = "en-US"
): ThemeCardPresentation => {
  const copy = computedShopCopyByLocale[locale];
  const resources = getResourcesForLocale(locale);
  const applied = (inventory.selectedTerrariumThemeId ?? DEFAULT_THEME_ID) === themeId;
  const isDefault = themeId === DEFAULT_THEME_ID;
  const owned = isDefault || (inventory.ownedThemeIds ?? []).includes(themeId);

  if (isDefault) {
    return {
      status: "default_free",
      owned: true,
      applied,
      canAct: !applied,
      priceLabel: copy.free,
      statusLabel: applied ? resources.common.actions.applied : copy.free,
      actionLabel: applied ? resources.common.actions.applied : resources.common.actions.apply
    };
  }

  if (owned) {
    return {
      status: "owned",
      owned: true,
      applied,
      canAct: !applied,
      priceLabel: applied ? resources.common.actions.applied : resources.shop.owned,
      statusLabel: applied ? resources.common.actions.applied : resources.shop.owned,
      actionLabel: applied ? resources.common.actions.applied : resources.common.actions.apply
    };
  }

  const affordable = devStoreUnlocked || creditBalance >= creditCost;

  return {
    status: "locked_for_purchase",
    owned: false,
    applied: false,
    canAct: affordable,
    priceLabel: copy.creditPrice(creditCost),
    statusLabel: devStoreUnlocked ? resources.shop.devOpen : resources.shop.locked,
    actionLabel: resources.common.actions.unlock
  };
};

export const getServerShopSummaryPresentation = (
  products: CommerceProduct[],
  entitlements: Entitlement[]
): ShopSummaryPresentation => {
  const visibleProducts = products.filter((product) => !isPremiumPassProduct(product));

  return {
    lockedCount: visibleProducts.filter((product) => !hasActiveProductEntitlement(product, entitlements)).length,
    ownedQuantity: entitlements.filter((entitlement) => entitlement.status === "active").length,
    visibleCount: visibleProducts.length
  };
};

/**
 * Which home care action's Tier 2 "care moment" (see CareMomentLayer /
 * getCareMomentStaging) a shop care category previews with in
 * ShopPreviewScreen's item preview panel, so selecting a care item plays the
 * same bowl/ball/heart-burst choreography the home screen plays when that
 * item is actually used, instead of a static icon. Rest reuses "affection"
 * because bed-category items are the ones `isCareItemEligibleForAction`
 * (packages/shared/src/domain/inventory.ts) already treats as
 * affection-eligible -- there is no dedicated "rest" moment on the home
 * screen. Returns null for non-care categories (moments/themes), which keep
 * their existing static preview.
 */
const careMomentActionByCareShopCategory: Readonly<Record<CareShopCategoryId, CareActionType>> = {
  treats: "feed",
  drinks: "water_garden",
  toys: "play",
  rest: "affection"
};

export const getShopCareMomentPreviewAction = (category: ShopCategoryId): CareActionType | null =>
  isCareShopCategory(category) ? careMomentActionByCareShopCategory[category] : null;

/**
 * Whether a shop grid card should render its small "x{n}" owned-quantity
 * badge. Repeatable (consumable) items keep showing their buy-more credit
 * price in the card's price pill once owned (see ShopEntry's "repeatable"
 * doc comment in ShopPreviewScreen.tsx), so the quantity would otherwise
 * never surface on the card itself -- the badge fills that gap. Non-repeatable
 * owned items already show "Owned x{n}" in the price pill, so no extra badge
 * text is needed for those.
 */
export const shouldShowOwnedQuantityBadge = (entry: { repeatable?: boolean; ownedQuantity: number }): boolean =>
  Boolean(entry.repeatable) && entry.ownedQuantity > 0;
