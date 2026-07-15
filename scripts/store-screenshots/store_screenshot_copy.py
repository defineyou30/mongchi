from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True, slots=True)
class SlideCopy:
    title: str
    subtitle: str


@dataclass(frozen=True, slots=True)
class ChatCopy:
    messages: tuple[str, str, str, str]
    user_body_x: tuple[int, int]


@dataclass(frozen=True, slots=True)
class LocaleCopy:
    font_filename: str
    slides: tuple[SlideCopy, SlideCopy, SlideCopy, SlideCopy, SlideCopy, SlideCopy]
    chat: ChatCopy


LOCALIZED_LOCALES: Final = (
    "ko-KR",
    "ja-JP",
    "zh-TW",
    "de-DE",
    "fr-FR",
    "pt-BR",
    "es-MX",
)


LOCALE_COPY: Final[dict[str, LocaleCopy]] = {
    "ko-KR": LocaleCopy(
        font_filename="FusionPixel10Proportional-ko.ttf",
        slides=(
            SlideCopy("사진 속 우리 아이가\n휴대폰 속 친구로", "사진 한 장이면 작은 친구가 태어나요."),
            SlideCopy("작은 돌봄이\n매일의 유대감으로", "먹이고, 놀고, 쉬며 조금씩 가까워져요."),
            SlideCopy("우리 아이의\n모든 표정을 만나보세요", "새로운 표정을 열고 작은 세상을 공유하세요."),
            SlideCopy("오늘 하루를\n들려주세요", "우리 아이가 곁에서 오늘 이야기를 들어줄 거예요."),
            SlideCopy("매일이 하나의\n추억이 돼요", "산책 보물과 작은 순간, 기다림 끝의 편지를 모아요."),
            SlideCopy("우리 아이만의\n포근한 세상", "간식, 장난감, 쿠션, 포즈와 테마로 채워보세요."),
        ),
        chat=ChatCopy(
            messages=(
                "오늘 하루는 어땠어?",
                "오늘은 햇살도 포근하고 기분도 좋았어. 네가 와줘서 더 반가워!",
                "오늘 조금 힘들었어. 내 이야기 들어줄래?",
                "물론이지. 네 곁에 있을게.\n천천히 이야기해 줘.",
            ),
            user_body_x=(455, 238),
        ),
    ),
    "ja-JP": LocaleCopy(
        font_filename="FusionPixel10Proportional-ja.ttf",
        slides=(
            SlideCopy("写真から生まれる\nスマホの中の小さな友だち", "一枚の写真から、あなただけの友だちが生まれます。"),
            SlideCopy("小さなお世話が\n毎日の絆になる", "食べて、遊んで、休んで。少しずつ仲良くなれます。"),
            SlideCopy("いろんな表情に\n出会おう", "新しいポーズを集めて、小さな世界をシェア。"),
            SlideCopy("今日のことを\n聞かせて", "あなたのそばで、今日の話をやさしく聞いてくれます。"),
            SlideCopy("毎日がひとつの\n思い出になる", "お散歩の宝物や小さな出来事、手紙を集めよう。"),
            SlideCopy("この子だけの\n心地よい世界", "おやつ、おもちゃ、クッション、ポーズ、テーマで彩ろう。"),
        ),
        chat=ChatCopy(
            messages=(
                "今日はどんな一日だった？",
                "今日は日差しが暖かくて、\nいい気分だったよ。\n会いに来てくれてうれしい！",
                "今日は少し疲れたよ。話を聞いてくれる？",
                "もちろん。ここでそばにいるよ。\nゆっくり聞かせてね。",
            ),
            user_body_x=(450, 310),
        ),
    ),
    "zh-TW": LocaleCopy(
        font_filename="FusionPixel10Proportional-zh-TW.ttf",
        slides=(
            SlideCopy("照片裡的牠\n成為手機裡的小夥伴", "只要一張照片，就能遇見專屬於你的小夥伴。"),
            SlideCopy("每一次照顧\n都讓感情更靠近", "餵食、玩耍、休息，讓你們一天比一天親近。"),
            SlideCopy("遇見牠的\n每一種可愛模樣", "解鎖新姿勢，分享你們的小小世界。"),
            SlideCopy("把今天的故事\n說給牠聽", "牠會陪在身邊，溫柔聽你說今天的故事。"),
            SlideCopy("每一天都成為\n珍貴的回憶", "收藏散步發現、小小時刻與等待已久的信。"),
            SlideCopy("打造專屬於牠的\n溫暖小世界", "用點心、玩具、抱枕、姿勢與主題豐富生活。"),
        ),
        chat=ChatCopy(
            messages=(
                "今天過得怎麼樣？",
                "今天陽光暖暖的，心情也很好。你來陪我，我真的很開心！",
                "今天有點累，可以聽我說說話嗎？",
                "當然可以。我會陪在你身邊，\n慢慢說給我聽吧。",
            ),
            user_body_x=(450, 238),
        ),
    ),
    "de-DE": LocaleCopy(
        font_filename="PixelifySans-Regular.ttf",
        slides=(
            SlideCopy("DEIN LIEBLING\nZIEHT INS HANDY EIN", "Aus einem Foto wird dein kleiner Begleiter."),
            SlideCopy("KLEINE GESTEN\nSTÄRKEN EURE BINDUNG", "Füttern, spielen und streicheln - Tag für Tag."),
            SlideCopy("ALLE SEITEN\nDEINES LIEBLINGS", "Schalte neue Posen frei und teile eure kleine Welt."),
            SlideCopy("ERZÄHL VON\nDEINEM TAG", "Dein Liebling hört dir warm und aufmerksam zu."),
            SlideCopy("JEDER TAG WIRD\nZUR ERINNERUNG", "Sammle Momente, Fundstücke und besondere Briefe."),
            SlideCopy("GESTALTE EINE\nKUSCHELIGE WELT", "Mit Leckerlis, Spielzeug, Kissen, Posen und Themen."),
        ),
        chat=ChatCopy(
            messages=(
                "Wie war dein Tag?",
                "Heute war es sonnig und gemütlich. Schön, dass du bei mir bist!",
                "Heute war ein langer Tag. Darf ich dir davon erzählen?",
                "Natürlich. Ich bin ganz nah bei dir und höre dir in Ruhe zu.",
            ),
            user_body_x=(500, 340),
        ),
    ),
    "fr-FR": LocaleCopy(
        font_filename="PixelifySans-Regular.ttf",
        slides=(
            SlideCopy("DE LA PHOTO\nÀ VOTRE TÉLÉPHONE", "Une photo suffit pour créer votre petit compagnon."),
            SlideCopy("DES PETITS SOINS,\nUN LIEN QUI GRANDIT", "Repas, jeux, repos : votre lien grandit chaque jour."),
            SlideCopy("DÉCOUVREZ\nTOUTES SES FACETTES", "Débloquez ses expressions et partagez son univers."),
            SlideCopy("RACONTEZ-LUI\nVOTRE JOURNÉE", "Votre compagnon reste près de vous et vous écoute."),
            SlideCopy("CHAQUE JOUR\nDEVIENT UN SOUVENIR", "Gardez ses trouvailles, vos moments et ses lettres."),
            SlideCopy("CRÉEZ-LUI\nUN MONDE TOUT DOUX", "Friandises, jouets, coussins, poses et thèmes."),
        ),
        chat=ChatCopy(
            messages=(
                "Comment s'est passée ta journée ?",
                "Il a fait doux et ensoleillé. Je suis si content que tu sois là !",
                "La journée a été longue. Je peux t'en parler ?",
                "Bien sûr. Je reste tout près de toi et je t'écoute tranquillement.",
            ),
            user_body_x=(500, 340),
        ),
    ),
    "pt-BR": LocaleCopy(
        font_filename="PixelifySans-Regular.ttf",
        slides=(
            SlideCopy("SEU PET, UM AMIGUINHO\nSEMPRE NO CELULAR", "Com uma foto, ele se muda para o seu jardim."),
            SlideCopy("PEQUENOS CUIDADOS,\nUM LAÇO PARA TODO DIA", "Cuide dele todos os dias e veja o vínculo crescer."),
            SlideCopy("CONHEÇA TODOS\nOS JEITINHOS DO SEU PET", "Descubra poses e compartilhe esse mundinho."),
            SlideCopy("CONTE PARA O SEU PET\nCOMO FOI SEU DIA", "Seu pet fica pertinho e escuta tudo com carinho."),
            SlideCopy("CADA DIA VIRA\nUMA LEMBRANÇA", "Guarde achados e cartinhas cheias de carinho."),
            SlideCopy("CRIE UM CANTINHO\nSÓ PARA O SEU PET", "Petiscos, brinquedos, almofadas, poses e temas."),
        ),
        chat=ChatCopy(
            messages=(
                "Como foi seu dia hoje?",
                "Hoje o sol estava gostoso. Fiquei tão feliz que você veio me ver!",
                "Meu dia foi longo. Posso contar para você?",
                "Claro. Estou aqui pertinho, ouvindo tudo com carinho.",
            ),
            user_body_x=(500, 335),
        ),
    ),
    "es-MX": LocaleCopy(
        font_filename="PixelifySans-Regular.ttf",
        slides=(
            SlideCopy("UNA FOTO, UN AMIGUITO\nEN TU CELULAR", "Una foto y tendrás un amiguito hecho para ti."),
            SlideCopy("CADA CUIDADO\nLOS ACERCA MÁS", "Aliméntalo, juega y déjalo descansar cada día."),
            SlideCopy("DESCUBRE TODAS\nSUS CARITAS", "Desbloquea caritas y comparte su pequeño mundo."),
            SlideCopy("CUÉNTALE\nCÓMO ESTUVO TU DÍA", "Tu mascota se queda cerquita para escucharte."),
            SlideCopy("CADA DÍA SE VUELVE\nUN RECUERDO", "Guarda recuerdos y cartas llenas de cariño."),
            SlideCopy("UN MUNDO ACOGEDOR,\nHECHO A SU MANERA", "Elige premios, juguetes, cojines, poses y temas."),
        ),
        chat=ChatCopy(
            messages=(
                "¿Cómo estuvo tu día?",
                "Hoy estuvo soleado y tranquilo. ¡Me alegra mucho que estés aquí!",
                "Tuve un día largo. ¿Puedo contártelo?",
                "Claro. Estoy aquí cerquita, escuchándote con calma.",
            ),
            user_body_x=(500, 340),
        ),
    ),
}
