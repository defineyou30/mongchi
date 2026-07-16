import type { enUS } from "./en-US";

type DeepStringShape<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : DeepStringShape<T[Key]>;
};

export const frFR = {
  common: {
    actions: {
      apply: "Appliquer",
      applied: "Appliqué",
      backHome: "Retour à l’accueil",
      cancel: "Annuler",
      camera: "Appareil photo",
      checking: "Vérification",
      change: "Modifier",
      chooseAnotherPhoto: "Choisir une autre photo",
      clear: "Effacer",
      cleared: "Effacé",
      continue: "Continuer",
      delete: "Supprimer",
      deleting: "Suppression",
      enable: "Activer",
      export: "Exporter",
      next: "Suivant",
      ok: "OK",
      open: "Ouvrir",
      reportIssue: "Signaler un problème",
      restore: "Restaurer",
      restoring: "Restauration",
      saved: "Enregistré",
      seeProfile: "Voir le profil",
      share: "Partager",
      shop: "Boutique",
      skip: "Passer",
      tryAgain: "Réessayer",
      turnOff: "Désactiver",
      unlock: "Débloquer",
      viewHome: "Voir l’accueil"
    }
  },
  languageSelector: {
    openAccessibilityLabel: "Choisir la langue de l’application",
    title: "Langue",
    subtitle: "Suivez la langue de l’appareil ou gardez une langue fixe.",
    automatic: "Automatique",
    automaticDetail: "Suivre cet appareil · {{language}}",
    selected: "Sélectionné",
    saveError: "Impossible d’enregistrer la langue. Réessayez.",
    closeAccessibilityLabel: "Fermer le choix de langue"
  },
  splash: {
    accessibilityLabel: "Écran de chargement de la petite maison du compagnon",
    logoAccessibilityLabel: "Logo de l’application Mongchi",
    animationAccessibilityLabel: "Animation de chargement du petit monde",
    opening: "Ouverture de la petite maison",
    warming: "La pièce douillette se réchauffe"
  },
  welcome: {
    accessibilityLabel: "Présentation de bienvenue de Mongchi",
    page: "Page de bienvenue {{current}} sur {{total}}",
    skipAccessibilityLabel: "Passer la présentation de bienvenue",
    start: "Commencer avec une photo",
    slides: {
      first: {
        step: "Étape 1",
        title: "Votre compagnon, près de vous chaque jour",
        body: "Transformez votre photo préférée de votre animal en un petit compagnon qui vous attend dans son jardin."
      },
      second: {
        step: "Étape 2",
        title: "Une seule photo suffit",
        body: "Choisissez une photo nette de votre animal, puis ajoutez son nom et sa petite personnalité."
      },
      third: {
        step: "Étape 3",
        title: "Renforcez votre lien chaque jour",
        body: "Donnez-lui à manger, jouez, discutez et retrouvez chaque jour le jardin douillet de votre compagnon."
      }
    }
  },
  photoIntro: {
    accessibilityLabel: "Présentation de la photo du petit compagnon",
    artAccessibilityLabel: "Une photo d’animal s’ouvre sur une petite maison dans un jardin",
    title: "Gardez votre compagnon adoré tout près",
    body: "Commencez par une photo nette de votre animal, ajoutez son nom et sa personnalité, puis rencontrez le petit compagnon qui vous attend dans son jardin.",
    quest: {
      photo: "Photo",
      name: "Nom",
      moveIn: "Emménagement"
    },
    privacy: "La photo de votre animal sert uniquement à créer votre petit compagnon. Vous pourrez supprimer l’original à tout moment après son emménagement.",
    choosePhoto: "Choisir une photo de l’animal"
  },
  photoUpload: {
    accessibilityLabel: "Importation de la photo du compagnon",
    back: "Retour à la présentation de la photo",
    title: "Choisissez sa plus belle photo",
    artAccessibilityLabel: "Tableau sécurisé de sélection de la photo du compagnon",
    changeSelected: "Modifier la photo sélectionnée",
    choosePhoto: "Choisir une photo du compagnon",
    selectedPreview: "Aperçu de la photo sélectionnée de {{petName}}",
    selectedSamplePreview: "Aperçu de la photo d’exemple sélectionnée de {{petName}}",
    samplePreview: "Aperçu de la photo d’exemple du compagnon",
    sampleSelected: "Photo d’exemple sélectionnée",
    photoSelected: "Photo du compagnon sélectionnée",
    purpose: "Utilisée pour créer le petit compagnon qui vit dans votre jardin.",
    library: "Photothèque",
    privacy: "Utilisée uniquement pour créer votre petit compagnon. Vous pourrez supprimer l’original après son emménagement.",
    errors: {
      invalidTitle: "Cette photo ne peut pas être utilisée",
      invalidType: "Choisissez une photo de votre compagnon au format JPEG, PNG ou WebP.",
      tooLarge: "Choisissez une image de moins de 10 Mo où votre compagnon est bien visible.",
      libraryTitle: "Accès aux photos nécessaire",
      libraryMessage: "Choisissez une photo de votre compagnon pour que l’application puisse créer votre petit ami.",
      cameraTitle: "Accès à l’appareil photo nécessaire",
      cameraMessage: "L’accès à l’appareil photo est utilisé uniquement lorsque vous choisissez de prendre votre compagnon en photo."
    }
  },
  petSetup: {
    accessibilityLabel: "Configuration du compagnon",
    back: "Retour à la photo",
    artAccessibilityLabel: "Petit bureau d’emménagement avec une médaille et un lit douillet",
    eyebrow: "Papiers d’emménagement",
    title: "Donnez un nom à votre petit compagnon",
    summary: "{{species}} / {{voice}} · bientôt prêt à emménager",
    speciesQuestion: "Qui emménage ?",
    petName: "Nom du compagnon",
    nameHint: "C’est le nom qui vous accueillera chaque jour à la porte.",
    personalityQuestion: "Quel est le caractère de votre compagnon ?",
    voiceQuestion: "À quoi ressemble sa petite voix ?",
    favoriteQuestion: "Qu’est-ce qu’il aime déjà ?",
    favoriteThing: "Petit plaisir préféré",
    memoryQuestion: "Un petit souvenir à emporter avec lui ?",
    firstMemory: "Premier petit souvenir",
    firstMemoryPlaceholder: "Un doux souvenir avec votre compagnon…",
    continueHint: "Choisissez un nom, une humeur et une voix pour continuer.",
    species: { dog: "Chien", cat: "Chat" },
    personality: {
      playful: "Joueur",
      calm: "Calme",
      shy: "Timide",
      curious: "Curieux",
      sleepy: "Dormeur",
      affectionate: "Affectueux"
    },
    voice: {
      cute: "Adorable",
      gentle: "Douce",
      cheerful: "Enjouée",
      comforting: "Réconfortante"
    }
  },
  generation: {
    accessibilityLabel: "Emménagement de {{petName}}",
    back: "Retour à la configuration du compagnon",
    eyebrow: "Emménagement",
    titleReady: "{{petName}} est prêt",
    titleMoving: "{{petName}} emménage",
    warmAccessibilityLabel: "Réchauffer doucement l’œuf de {{petName}} d’un toucher",
    artAccessibilityLabel: "Scène d’emménagement magique de {{petName}}",
    forming: "Votre petit compagnon prend forme grâce aux détails de la photo.",
    favoriteFallback: "les petites choses douillettes",
    progressAccessibilityLabel: "Progression de l’emménagement",
    recapTitle: "Qui arrive bientôt ?",
    failureTitle: "Emménagement en pause",
    quotaFailure: "Votre petit compagnon pourra bientôt emménager. Revenez dans un petit moment.",
    retryFailure: "La petite porte est coincée. Essayons de recréer {{petName}}.",
    safetyFailure: "Cette photo ne nous a pas permis d'aider votre compagnon à emménager. Essayez avec une autre photo où votre animal est bien visible.",
    reveal: "Découvrir le compagnon",
    steps: {
      preparing: "Préparation de la photo",
      details: "Recherche des petits détails",
      creating: "Création du compagnon",
      polishing: "Finitions du petit monde",
      movingIn: "Emménagement"
    },
    observations: {
      first: "Observation des couleurs du pelage sur votre photo...",
      second: "Dessin très soigneux des oreilles de {{petName}}...",
      third: "Choix des pixels les plus doux, un par un...",
      fourth: "Répétition du premier bonjour de {{petName}}...",
      fifth: "Mesure du parfait frétillement de queue...",
      sixth: "La lumière apprend où {{petName}} fera la sieste...",
      seventh: "Préparation de petits souvenirs de {{favoriteThing}}...",
      eighth: "Les yeux brillants sont polis jusqu’à étinceler..."
    },
    warmLines: {
      first: "Votre chaleur a atteint l’œuf. Il a un peu remué !",
      second: "L’œuf est encore plus douillet maintenant.",
      third: "Un petit battement de cœur vous a dit merci.",
      fourth: "On y est presque. Votre main lui fait du bien."
    },
    statuses: {
      created: "Le petit atelier se réchauffe.",
      queued: "En attente d’une place pour emménager.",
      claimed: "Ouverture du petit atelier.",
      validating: "Vérification des détails de la photo.",
      preprocessing: "Préparation de la photo.",
      safety_checking: "Vérification que le petit compagnon peut emménager en toute sécurité.",
      generating: "Création du premier petit compagnon.",
      postprocessing: "Finitions du pelage et des derniers détails.",
      quality_checking: "Vérification du résultat final.",
      uploading_assets: "Préparation des affaires pour la maison.",
      cleanup_pending: "Rangement de la photo avant l’emménagement.",
      completed: "Prêt à vous rencontrer.",
      failed: "Emménagement en pause.",
      cancelled: "Emménagement arrêté.",
      expired: "Le délai d’emménagement a expiré."
    },
    teaser: {
      playful: "Un petit joueur prépare ses affaires...",
      calm: "Un petit calme prépare ses affaires...",
      shy: "Un petit timide prépare ses affaires...",
      curious: "Un petit curieux prépare ses affaires...",
      sleepy: "Un petit dormeur prépare ses affaires...",
      affectionate: "Un petit cœur tendre prépare ses affaires...",
      fallback: "Un adorable compagnon prépare ses affaires..."
    },
    guidance: "Gardez une connexion stable. Si l’application s’interrompt, le même emménagement reprendra à votre retour."
  },
  reveal: {
    accessibilityLabel: "Découverte de {{petName}}",
    back: "Retour à l’emménagement",
    artAccessibilityLabel: "Joyeuse célébration de la découverte de {{petName}}",
    eyebrow: "Découverte du compagnon",
    title: "Voici {{petName}}",
    enter: "Entrer dans le jardin",
    shareAccessibilityLabel: "Partager {{petName}}",
    notRight: "Ce n’est pas tout à fait ça ?",
    shareMessages: {
      first: "Voici {{petName}}, mon nouveau petit compagnon de jardin. Créé avec Mongchi.",
      second: "{{petName}} vient d’emménager dans un petit jardin en pixels. Créé avec Mongchi."
    }
  },
  home: {
    localeAccessibilityLabel: "Petite maison-jardin interactive de {{petName}}",
    hud: {
      accessibilityLabel: "État du jeu du petit jardin",
      labels: {
        fullness: "Rassasié",
        thirst: "Eau",
        mood: "Humeur",
        energy: "Énergie",
        cleanliness: "Propre"
      },
      meterAccessibilityLabel: "État {{label}}. Touchez pour plus de détails.",
      artAccessibilityLabel: "Illustration de l’état {{label}}"
    },
    rail: {
      openShop: "Ouvrir la boutique",
      shopArt: "Illustration du bouton Boutique",
      openChat: "Ouvrir la discussion avec {{petName}}",
      chatArt: "Illustration du bouton Discussion",
      openFriend: "Ouvrir la page de {{petName}}",
      friendArt: "Illustration du bouton Compagnon",
      letterWaiting: "{{label}}. Une nouvelle lettre vous attend.",
      openSettings: "Ouvrir les réglages",
      settingsArt: "Illustration du bouton Réglages"
    },
    pet: {
      accessibilityLabel: "Caresser {{petName}}",
      longPressHint: "Appuyez longuement pour ouvrir la page de {{petName}}",
      avatarAccessibilityLabel: "Avatar généré du compagnon",
      finishMessageHint: "Touchez pour afficher tout le message maintenant.",
      walkingPaws: "Petites traces de pas de {{petName}} en promenade"
    },
    butterflyAccessibilityLabel: "Un petit papillon est venu vous voir. Touchez-le pour lui dire bonjour.",
    care: {
      actions: {
        feed: "Nourrir",
        talk: "Parler",
        walk: "Promener",
        play: "Jouer",
        rest: "Repos",
        affection: "Caresser",
        water_garden: "Arroser",
        clean: "Laver",
        treat: "Friandise"
      },
      iconAccessibilityLabel: "Icône de soin {{label}}",
      itemAccessibilityLabel: "Objet de soin {{label}}",
      feedCooldown: "Menu Repas. Prochain repas quotidien dans {{cooldown}}. Des friandises peuvent rester disponibles.",
      feedMenu: "Menu Repas de {{petName}}.",
      walkActive: "La promenade est en cours. {{petName}} revient dans {{seconds}} secondes.",
      optionCooldown: "Menu {{label}}. Option de base à nouveau disponible dans {{cooldown}}. Des objets spéciaux peuvent rester disponibles.",
      recommended: "Conseil : {{label}} {{petName}}. {{hint}}",
      actionAccessibilityLabel: "{{label}} {{petName}}",
      tray: {
        titles: {
          affection: "Petits gestes complices",
          feed: "Repas et friandises",
          play: "Jeux au choix",
          walk: "Chemins au choix",
          water_garden: "Eau"
        },
        optionsAccessibilityLabel: "Options pour {{title}}",
        shopOption: "Ouvrir la boutique pour {{title}}.",
        cooldownOption: "{{title}} sera à nouveau disponible dans {{cooldown}}.",
        useOption: "Utiliser {{title}} pour {{petName}}.",
        openShop: "Ouvrir la boutique d’objets de soin.",
        shop: "Boutique"
      },
      options: {
        pet: "Caresse",
        meal: "Repas",
        ball: "Balle",
        path: "Chemin",
        water: "Eau",
        bath: "Bain",
        treat: "Friandise"
      },
      meta: {
        bond: "+Lien",
        fullness: "+Satiété",
        mood: "+Humeur",
        thirst: "+Hydratation",
        fresh: "+Propreté",
        shop: "Boutique"
      }
    },
    walk: {
      activeTitle: "{{petName}} se promène · retour dans {{time}}",
      activeSubcopy: "Vous pouvez fermer l’application : nous vous préviendrons au retour de {{petName}}.",
      bringHomeAccessibilityLabel: "Dépenser {{cost}} crédit pour faire revenir {{petName}} maintenant",
      cannotBringHomeAccessibilityLabel: "Pas assez de crédits pour faire revenir {{petName}} maintenant",
      coinAccessibilityLabel: "Monnaie en pièces",
      openCreditStoreAccessibilityLabel: "Ouvrir la boutique de crédits",
      commentary: {
        early: "{{petName}} suit une odeur très importante...",
        mid: "{{petName}} s’est arrêté pour saluer une feuille.",
        late: "{{petName}} a trouvé quelque chose et le rapporte à la maison !"
      },
      bringHome: "Faire revenir · {{cost}}",
      openCreditStore: "Obtenir des crédits",
      insufficientHint: "Obtenez des crédits ou attendez le retour de {{petName}}.",
      waiting: "{{petName}} revient bientôt, encore un petit instant.",
      returned: "{{petName}} est de retour avec un petit cadeau !",
      claimAccessibilityLabel: "Accueillir {{petName}} et récupérer le cadeau de promenade",
      claim: "Accueillir et récupérer"
    },
    guide: {
      tryAction: "Essayez d’abord « {{action}} » : {{petName}} va adorer.",
      chooseAction: "Choisissez un petit soin pour {{petName}}.",
      closeAccessibilityLabel: "Fermer le guide des jauges",
      accessibilityLabel: "Guide des jauges",
      gotIt: "Compris"
    },
    originalPhotoDeleted: "Photo originale supprimée pour cette session.",
    welcome: {
      accessibilityLabel: "Bienvenue dans votre petit jardin",
      title: "Bienvenue dans le petit jardin de {{petName}}",
      body: "{{petName}} vit désormais ici et compte sur vos petits gestes attentionnés.",
      care: "Donnez-lui à manger et à boire, jouez et caressez-le pour remplir ses jauges.",
      speech: "La bulle vous indique ce dont {{petName}} a besoin en ce moment.",
      streak: "Revenez chaque jour pour prolonger votre série de soins.",
      action: "Commencer à prendre soin"
    },
    notificationPrePermission: {
      title: "Recevoir des nouvelles de {{petName}} ?",
      body: "Juste un petit mot discret quand vous lui manquez — une fois par jour maximum.",
      accept: "Avec plaisir",
      decline: "Plus tard peut-être"
    }
  },
  chat: {
    screenAccessibilityLabel: "Discussion avec {{petName}}",
    screenReaderTitle: "Discuter avec {{petName}}",
    back: "Retour à l’accueil",
    petAccessibilityLabel: "Compagnon dans la discussion",
    petSays: "{{petName}} dit : {{text}}",
    finishMessageHint: "Touchez pour afficher tout le message immédiatement",
    opening: "Ouverture d’une discussion douillette...",
    unavailableTitle: "La longue discussion fait une pause",
    unavailableDetail: "Les petits échanges et toutes les réactions de soin restent disponibles pendant la vérification de sécurité.",
    unavailableInput: "La longue discussion est indisponible pour le moment",
    networkError: "Impossible de joindre la discussion pour le moment. Réessayez.",
    startersAccessibilityLabel: "Suggestions pour commencer",
    starterAccessibilityLabel: "Utiliser la suggestion : {{starter}}",
    inputAccessibilityLabel: "Message de discussion premium",
    inputPlaceholder: "Écrire à {{petName}}",
    sendAccessibilityLabel: "Envoyer le message de discussion premium",
    disclosure:
      "Cette conversation est générée par une IA à partir du profil de votre compagnon. Elle ne représente pas la conscience de votre véritable animal.",
    disclosureBanner: {
      dismissAccessibilityLabel: "Fermer l’avis sur l’IA"
    },
    info: {
      button: "À propos de ce chat",
      title: "À propos de ce chat",
      aiTitle: "Discussion générée par IA",
      billingTitle: "Discussions et crédits",
      billingBody:
        "Les discussions incluses et les crédits sont vérifiés en toute sécurité dès l’envoi. Une fois les discussions gratuites du jour épuisées, un Day Pass ou des crédits permettent de continuer à discuter.",
      close: "Compris"
    },
    report: {
      button: "Signaler cette réponse de l’IA",
      reported: "Cette réponse de l’IA a été signalée",
      title: "Signaler cette réponse",
      detail: "Choisissez la raison la plus proche. Seules la référence du message et la raison sont conservées pour examen.",
      reasons: {
        harmful: "Nuisible ou dangereuse",
        inappropriate: "Inappropriée",
        inaccurate: "Inexacte ou trompeuse",
        other: "Autre problème"
      },
      cancel: "Fermer le signalement",
      sending: "Envoi du signalement...",
      success: "Merci. Cette réponse a été envoyée pour examen.",
      error: "Impossible d’envoyer le signalement. Réessayez."
    },
    history: {
      accessibilityLabel: "Historique des conversations avec {{petName}}",
      user: "Vous",
      notice: "Information",
      empty: "Votre conversation douillette commence ici.",
      notSent: "Pas encore envoyé.",
      retryAccessibilityLabel: "Réessayer d’envoyer le message",
      retry: "Réessayer",
      typing: "{{petName}} écrit..."
    },
    deterministicErrors: {
      emptyMessage: "Écrivez d’abord un petit message.",
      locked: "Utilisez un ticket, un crédit ou un pass Plus pour continuer à discuter.",
      session: "Impossible de démarrer votre discussion douillette. Réessayez.",
      history: "Impossible de charger cette discussion pour le moment. Réessayez.",
      credits: "Vous n’avez plus de crédits pour cette discussion. D’autres doux échanges pourront attendre que vous soyez prêt.",
      rateLimited: "La conversation a besoin d’une petite pause. Réessayez bientôt.",
      rejected: "Ce message n’a pas pu être envoyé. Essayez un autre petit message.",
      unavailable: "La discussion se repose un instant. Veuillez réessayer."
    }
  },
  friend: {
    accessibilityLabel: "Page de {{petName}}",
    back: "Retour à l’accueil",
    share: "Partager {{petName}}",
    movedIn: {
      today: "A emménagé aujourd’hui",
      daysAgo: "A emménagé il y a {{count}} jours"
    },
    stats: {
      bond: "Lien",
      streak: "Série",
      together: "Ensemble",
      bondAccessibilityLabel: "Progression du lien vers le niveau {{level}} : {{label}}"
    },
    sections: {
      lately: "Dernièrement, {{petName}}...",
      walkFinds: "Trouvailles de promenade",
      moments: "Nos petits moments",
      letter: "Lettre de {{petName}}",
      memoryNote: "Note souvenir"
    },
    walkFindAccessibilityLabel: "{{name}}, trouvé {{count}} fois",
    undiscoveredWalkFind: "Trouvaille de promenade non découverte",
    letter: {
      giftAccessibilityLabel: "La lettre de {{petName}} est emballée comme un cadeau, prête à être ouverte",
      openAccessibilityLabel: "Ouvrir la lettre du premier mois de {{petName}}",
      open: "Ouvrir",
      checking: "Vérification de la lettre du jour..."
    },
    pose: {
      accessibilityLabel: "Pose {{pose}} de {{petName}}",
      collectionAccessibilityLabel: "Poses de {{petName}}",
      position: "Pose {{current}} sur {{total}} · {{pose}}",
      moreAccessibilityLabel: "Voir plus de packs de trois poses dans la boutique Moments",
      more: "Voir plus de poses",
      labels: { everyday: "Quotidien", happy: "Heureux", sleepy: "Endormi" },
      sleepLockedHint: "Revenez la nuit pour découvrir la pose endormie."
    },
    shareMessages: {
      days: "{{petName}} est mon petit compagnon de jardin depuis {{count}} jours. Créé avec Mongchi.",
      fallback: "Voici {{petName}}, mon petit compagnon de jardin. Créé avec Mongchi."
    },
    shareCard: {
      title: "Personnaliser et partager",
      subtitle: "Choisissez une pose et un décor que vos amis adoreront.",
      poseSectionTitle: "Pose",
      themeSectionTitle: "Décor",
      poseOptionAccessibilityLabel: "Pose : {{pose}}",
      themeOptionAccessibilityLabel: "Décor : {{theme}}",
      selected: "Sélectionné",
      previewAccessibilityLabel: "Aperçu de la carte de partage de {{petName}}",
      closeAccessibilityLabel: "Fermer la personnalisation de la carte",
      shareAccessibilityLabel: "Partager la carte de {{petName}}"
    }
  },
  shop: {
    accessibilityLabel: "Boutique du jardin",
    title: "Boutique",
    back: "Retour à l’accueil",
    walletAccessibilityLabel: "Portefeuille de la boutique, {{credits}} crédits et {{owned}} objets possédés",
    creditGemAccessibilityLabel: "Icône de crédit de la boutique",
    openCreditStore: "Ouvrir la boutique de crédits",
    categories: {
      all: "Tout",
      treats: "Friandises",
      drinks: "Boissons",
      toys: "Jouets",
      rest: "Repos",
      moments: "Moments",
      themes: "Thèmes"
    },
    tabs: {
      care: "Friandises & jouets",
      customize: "Poses & thèmes"
    },
    sections: {
      careItems: "Friandises, boissons & jouets",
      careItemsDescription: "Choisissez de petites récompenses, des jouets et des objets douillets.",
      posePacks: "Packs de poses",
      posePacksDescription: "Débloquez trois expressions et poses assorties dans chaque pack.",
      themes: "Thèmes du jardin",
      themesDescription: "Changez toute l'ambiance de la maison de votre compagnon."
    },
    careFiltersAccessibilityLabel: "Filtres des objets de soin",
    customizeFiltersAccessibilityLabel: "Filtres de personnalisation",
    categoryAccessibilityLabel: "{{label}}, {{count}} objets",
    emptyPreview: "De nouveaux objets douillets apparaîtront ici quand ce rayon sera rempli.",
    emptyShelf: "Ce rayon est en cours de remplissage.",
    comingSoon: "Bientôt disponible",
    soon: "Bientôt",
    owned: "Possédé",
    ownedQuantity: "Possédé x{{count}}",
    devOpen: "Ouvert en développement",
    available: "Disponible",
    locked: "Verrouillé",
    creditsNeeded: "Encore {{count}} crédits nécessaires",
    backgroundPreview: "Aperçu de l’arrière-plan {{name}}",
    largePreview: "Grand aperçu de {{name}}",
    backgroundThumbnail: "Miniature de l’arrière-plan {{name}}",
    itemIcon: "Icône de {{name}}",
    pricesAccessibilityLabel: "Prix en crédits et en pièces acceptés",
    walletGemAccessibilityLabel: "Prix en crédits",
    coinAccessibilityLabel: "Monnaie en pièces",
    gemPriceAccessibilityLabel: "Prix en crédits",
    actions: {
      unlockTheme: "Débloquer le thème",
      applyTheme: "Appliquer le thème",
      getItem: "Acheter",
      unlockPack: "Débloquer le pack",
      topUpCredits: "Recharger des crédits"
    },
    grants: {
      consumable: "Crédit",
      durable: "Acquis définitivement",
      subscription: "Abonnement"
    },
    products: {
      premiumChat: {
        name: "Discussion mensuelle Plus",
        description: "Des échanges plus longs et chaleureux tant que le pass Plus est actif."
      },
      extraPetSlot: {
        name: "Emplacement de compagnon supplémentaire",
        description: "Faites une place à un profil de petit compagnon en plus."
      },
      regenerationCredit: {
        name: "Crédit de régénération",
        description: "Une nouvelle tentative d’avatar quand vous souhaitez changer de look."
      },
      starterTheme: {
        name: "Pack de thème de départ",
        description: "Un nouvel arrière-plan pour la petite maison."
      },
      itemPack: {
        name: "Pack d’objets",
        description: "Une sélection soignée de friandises et de jouets."
      },
      treatPack: {
        name: "Pack de friandises",
        description: "Des en-cas spéciaux pour d’adorables réactions."
      },
      plusPass: {
        name: "Pass Plus",
        description: "Des avantages premium pour renforcer votre lien, discuter plus longtemps et profiter des futures fonctions Plus."
      }
    },
    actionAccessibility: {
      unlockTheme: "Débloquer {{name}} pour {{price}}",
      themeLocked: "{{name}} est verrouillé",
      applyTheme: "Appliquer {{name}}",
      themeApplied: "{{name}} est appliqué",
      buy: "Acheter {{name}}",
      topUpCredits: "Recharger des crédits pour {{name}}"
    },
    summary: {
      accessibilityLabel: "{{owned}} objets possédés et {{locked}} objets verrouillés dans la boutique",
      owned: "Objets possédés",
      locked: "{{count}} objets verrouillés dans la boutique"
    },
    dialogs: {
      checkout: "Paiement",
      checkoutFailed: "Impossible de lancer le paiement pour le moment. Veuillez réessayer.",
      shop: "Boutique",
      shopFailed: "Impossible d’ajouter cet objet pour le moment. Veuillez réessayer.",
      itemAdded: "Objet ajouté",
      itemAddedMessage: "Votre nouvel objet vous attend dans l’inventaire.",
      posePack: "Pack de poses",
      posePackFailed: "Impossible de lancer ce pack de poses pour le moment. Veuillez réessayer.",
      posesOnWay: "Trois poses sont en préparation",
      posesOnWayMessage: "Les trois nouvelles poses de votre compagnon sont créées ensemble.",
      theme: "Thème",
      themeFailed: "Impossible de changer ce thème pour le moment. Veuillez réessayer.",
      makeover: "Le jardin change de look !",
      themeApplied: "Thème appliqué",
      themeAppliedMessage: "{{name}} est maintenant l’arrière-plan de votre jardin."
    },
    expressionPacks: {
      poseCount: "3 POSES",
      boardAccessibilityLabel: "{{name}}, pack de trois poses, {{price}}. {{status}}",
      creditGemAccessibilityLabel: "Prix en crédits",
      allOwned: "Les 3 sont possédées",
      allPrice: "Les 3 · {{credits}}",
      actionAccessibilityLabel: "{{action}} depuis {{name}}",
      actions: {
        generate: "Créer les 3",
        retry: "Réessayer les 3",
        needCredits: "Obtenir des crédits",
        making: "Création des poses...",
        owned: "Dans le profil"
      }
    },
    themes: {
      defaultName: "Jardin douillet",
      defaultDescription: "L’arrière-plan original du jardin, toujours gratuit.",
      fairyName: "Jardin féerique",
      fairyDescription: "Un jardin féerique lumineux pour de douces journées rêveuses à la maison.",
      seasideName: "Crique en bord de mer",
      seasideDescription: "Un décor côtier lumineux pour des promenades au grand air.",
      autumnName: "Bois d’automne",
      autumnDescription: "Des feuilles chaudes et une douce lumière dorée pour les soins de saison.",
      winterName: "Lumières d’hiver",
      winterDescription: "Un décor de soirée enneigée baigné d’une douce lueur de fête."
    }
  },
  creditsStore: {
    accessibilityLabel: "Boutique de crédits",
    title: "Boutique de crédits",
    back: "Retour à la boutique du jardin",
    balanceAccessibilityLabel: "Solde actuel : {{credits}} crédits",
    heroTitle: "Découvrez plus de petits moments",
    heroBody: "Utilisez les crédits pour les packs de poses, les thèmes et les soins spéciaux.",
    starterTitle: "Cadeau du premier ami · {{credits}}",
    starterBody: "Ajouté une seule fois après l’arrivée de votre premier compagnon.",
    choosePack: "Choisir un pack de crédits",
    popular: "POPULAIRE",
    packAmount: "{{credits}} crédits",
    storePrice: "Prix App Store",
    purchaseAccessibilityLabel: "Acheter {{credits}} crédits",
    packs: {
      small: "Essayer avec un premier pack",
      popular: "Idéal pour les poses et les thèmes",
      large: "Collectionner et décorer longtemps"
    },
    actions: {
      buy: "Acheter",
      purchasing: "Vérification...",
      arriving: "En chemin...",
      preparing: "Boutique en préparation"
    },
    storeNotice: "Les paiements sont gérés par l’App Store. Seuls les crédits vérifiés sont ajoutés.",
    dialogs: {
      failedTitle: "Achat non terminé",
      failedBody: "Vérifiez votre connexion et réessayez.",
      successTitle: "Les crédits sont arrivés",
      successBody: "Les crédits vérifiés ont été ajoutés.",
      pendingTitle: "Presque terminé",
      pendingBody: "Votre achat attend la confirmation de la boutique. Les crédits arriveront dès qu'il sera approuvé.",
      delayedTitle: "Les crédits arrivent",
      delayedBody: "Votre achat a bien été effectué ! Les crédits peuvent mettre un peu plus de temps à apparaître — revenez bientôt."
    }
  },
  inventory: {
    accessibilityLabel: "Inventaire",
    title: "Inventaire",
    back: "Retour à l’accueil",
    giveAccessibilityLabel: "Donner {{name}} maintenant",
    giveHint: "Retourne à l’accueil et ouvre le plateau de cet objet",
    iconAccessibilityLabel: "Icône d’inventaire de {{name}}",
    empty: "Rien ici pour le moment : les friandises et jouets que vous trouverez apparaîtront sur cette étagère.",
    shop: "Boutique"
  },
  settings: {
    accessibilityLabel: "Réglages et coffre-fort de confidentialité de {{petName}}",
    title: "Réglages",
    back: "Retour à l’accueil",
    hero: "Météo, rappels, confidentialité et assistance, réunis dans un coin douillet.",
    language: {
      title: "Langue de l’application",
      english: "Anglais",
      korean: "Coréen",
      detail: "Choisissez ici ou suivez votre appareil.",
      action: "Modifier"
    },
    status: {
      needsCheck: "Vérification nécessaire",
      syncing: "Synchronisation",
      attention: "Une action de confidentialité demande votre attention",
      inProgress: "Action de confidentialité en cours",
      errorDetail: "La modification n’a pas pu se terminer en toute sécurité. Vérifiez votre connexion et réessayez.",
      keepOpen: "Gardez l’application ouverte jusqu’à la fin de la modification."
    },
    sections: {
      reminders: "Petits rappels",
      sound: "Sons et sensations",
      account: "Compte",
      privacy: "Confidentialité et protection",
      support: "Assistance et mentions légales"
    },
    notifications: {
      careReminders: "Rappels de soins",
      careRemindersDetail: "De doux rappels pour les repas, l’eau, les petits bonjours et votre lettre mensuelle.",
      walkUpdates: "Nouvelles de la promenade",
      walkUpdatesDetail: "Un petit signal quand une promenade se termine et que votre compagnon est rentré."
    },
    weather: {
      scenes: "Ambiances météo",
      useLocation: "Utiliser ma position",
      useLocationDetail: "Votre position approximative est envoyée une seule fois pour connaître la météo locale réelle du jardin — jamais stockée, jamais partagée.",
      preview: "Aperçu de la météo",
      next: "Suivant : {{weather}}",
      locationMessages: {
        requesting: "Recherche de la météo locale réelle d’aujourd’hui pour le jardin.",
        ready: "La météo locale est prête.",
        denied: "L’autorisation d’accéder à votre position n’a pas été accordée. Vous pouvez toujours choisir la météo manuellement.",
        error: "La météo locale est indisponible pour le moment. Essayez plutôt un aperçu manuel."
      },
      options: {
        clear: { label: "Dégagé", detail: "Jardin ensoleillé par défaut." },
        rain: {
          label: "Pluie",
          detail: "Effet de pluie et petits mots douillets sur la météo."
        },
        snow: {
          label: "Neige",
          detail: "Arrière-plan d’hiver et douces paroles bien au chaud."
        },
        wind: {
          label: "Vent",
          detail: "Feuilles en mouvement et découvertes en promenade."
        },
        hot: {
          label: "Chaud",
          detail: "Scène ensoleillée et petits rappels pour prendre soin du jardin."
        }
      }
    },
    sound: {
      effects: "Sons",
      effectsDetail: "De petits tintements et tapotements accompagnés de vibrations douces.",
      music: "Musique et ambiance",
      musicDetail: "Une douce musique de jardin et des sons d’ambiance, comme les oiseaux ou la pluie."
    },
    account: {
      linkTitle: "Se connecter avec Apple",
      linkDetail: "Protégez votre jardin — votre compagnon et vos souvenirs restent en sécurité, même si vous changez de téléphone.",
      linkAction: "Connecter",
      linkActionInFlight: "Connexion",
      recoverTitle: "Retrouver un jardin",
      recoverDetail: "Vous avez déjà connecté un jardin ? Retrouvez-le ici.",
      recoverAction: "Retrouver",
      recoverActionInFlight: "Récupération",
      connectedTitle: "Connecté avec Apple",
      connectedDetail: "Votre jardin est conservé en toute sécurité.",
      connectedEmailDetail: "Connecté avec {{email}}",
      unavailableMessage: "La connexion Apple n’est pas disponible sur cet appareil pour le moment.",
      alreadyLinkedMessage: "Cet identifiant Apple est déjà associé à un autre jardin. Utilisez « Retrouver un jardin » ci-dessous pour le récupérer ici.",
      linkFailedMessage: "Impossible de connecter votre identifiant Apple pour le moment. Veuillez réessayer dans un instant.",
      recoverConfirmTitle: "Retrouver ce jardin ?",
      recoverConfirmMessage: "Si vous retrouvez un jardin enregistré, il remplacera celui de ce téléphone. Votre compagnon actuel sera mis à l’abri en attendant. Continuer ?",
      recoverFailedMessage: "Impossible de retrouver votre jardin pour le moment. Veuillez réessayer dans un instant.",
      recoveredMessage: "Votre jardin a été retrouvé.",
      recoveredNoSnapshotMessage: "Aucun jardin enregistré n’a été trouvé, mais les dessins et les crédits de votre compagnon sont de retour."
    },
    privacy: {
      localPhoto: "Copie locale de la photo",
      photoDeleted: "Supprimée de cet appareil.",
      photoStored: "Une copie est conservée uniquement sur cet appareil.",
      photoNote: "Votre photo a uniquement servi à créer votre compagnon, puis elle a été mise à l’abri juste après son emménagement.",
      chatHistory: "Historique des discussions",
      chatDeleted: "Supprimé pour cette session.",
      chatDetail: "Gérez ici les conversations plus longues.",
      backup: "Sauvegarder votre compagnon",
      backupDetail: "Enregistrez une copie de votre jardin pour qu’il ne reste jamais uniquement sur cet appareil.",
      restore: "Restaurer une sauvegarde",
      restoreDetail: "Collez une sauvegarde enregistrée pour retrouver votre jardin."
    },
    links: {
      privacy: "Confidentialité",
      terms: "Conditions",
      support: "Assistance"
    },
    reset: {
      title: "Réinitialiser",
      detail: "Supprime la configuration locale du compagnon sur cet appareil et relance la présentation.",
      action: "Supprimer les données du compagnon"
    },
    dialogs: {
      errorLog: "Journal des erreurs",
      noErrors: "Aucune erreur récente enregistrée sur cet appareil.",
      deletePhotoTitle: "Supprimer la copie locale de la photo ?",
      deletePhotoMessage: "La copie de la photo enregistrée sur cet appareil sera effacée. Votre compagnon a déjà été créé : rien ne changera pour lui.",
      deleteChatTitle: "Supprimer l’historique des discussions ?",
      deleteChatMessage: "L’historique local des discussions de cette session sera effacé. Les réactions gratuites aux soins ne seront pas touchées.",
      backup: "Sauvegarde",
      backupFailed: "Impossible de préparer une sauvegarde pour le moment. Veuillez réessayer.",
      shareFailed: "Impossible d’ouvrir la fenêtre de partage. Veuillez réessayer.",
      restore: "Restaurer une sauvegarde",
      restoreFailed: "Impossible de restaurer cette sauvegarde. Vérifiez le texte enregistré et réessayez.",
      pasteFirst: "Collez d’abord le texte de votre sauvegarde.",
      restoreConfirmTitle: "Restaurer cette sauvegarde ?",
      restoreConfirmMessage: "Votre jardin actuel sera remplacé. Votre compagnon actuel sera d’abord sauvegardé, par précaution.",
      restoredTitle: "Heureux de vous revoir !",
      restoredMessage: "Votre jardin a été restauré depuis la sauvegarde.",
      accountLink: "Se connecter avec Apple",
      accountRecover: "Retrouver un jardin",
      deleteAllTitle: "Supprimer toutes vos données ?",
      deleteAllMessage:
        "Cette action supprime de cet appareil la configuration du compagnon, le compagnon généré, l’état des soins et l’inventaire. Elle demande aussi à nos serveurs de supprimer votre photo, les avatars générés et les données du compte. Cette action est irréversible.",
      serverRetry: "La suppression sur le serveur doit être relancée",
      serverRetryMessage:
        "Les données de votre appareil ont été effacées. Gardez l’application ouverte et réessayez plus tard pour terminer aussi la suppression de la copie sur le serveur."
    },
    restoreModal: {
      accessibilityLabel: "Restaurer une sauvegarde",
      title: "Restaurer une sauvegarde",
      hint: "Collez le texte de la sauvegarde enregistrée auparavant, depuis iCloud, Notes ou un e-mail.",
      placeholder: "Collez votre sauvegarde JSON ici",
      inputAccessibilityLabel: "Texte de la sauvegarde"
    },
    dev: {
      fontTitle: "Dév : paire de polices",
      fontDetail: "Compare les deux paires de polices W2 dans l’application. Non affiché dans les versions de production.",
      errorTitle: "Dév : journal des erreurs",
      errorCount: "{{count}} erreurs récentes enregistrées sur cet appareil.",
      shareLog: "Partager le journal",
      clearLog: "Effacer le journal"
    }
  },
  notifications: {
    channel: {
      name: "Nouvelles du jardin",
      description: "De douces nouvelles de votre jardin"
    },
    walkReturn: {
      fallbackPetName: "Votre compagnon",
      title: "{{petName}} est de retour de promenade !",
      body: "Venez voir ce que {{petName}} a trouvé dehors."
    },
    garden: {
      meal_due: {
        title: "{{petName}} pense très fort à sa gamelle",
        body: "Un petit repas lui redonnerait une satiété bien douillette."
      },
      meal_urgent: {
        title: "Il reste un peu de place dans la gamelle de {{petName}}",
        body: "Un repas tout simple ferait plaisir à {{petName}} en ce moment."
      },
      thirst_due: {
        title: "La gamelle d’eau de {{petName}} aimerait être remplie",
        body: "Un peu d’eau égayerait doucement sa petite humeur."
      },
      thirst_hot_weather: {
        title: "{{petName}} apprécierait une gorgée bien fraîche",
        body: "L’air est chaud aujourd’hui. Une gamelle d’eau fraîche est le meilleur premier petit soin."
      },
      bored_play: {
        title: "{{petName}} a retrouvé son jouet",
        body: "Une petite partie de jeu serait parfaite maintenant."
      },
      attention_return: {
        title: "{{petName}} a un petit bonjour pour vous",
        body: "Ouvrez le jardin pour une caresse, un mot doux ou un petit coucou."
      },
      walk_window: {
        title: "L’heure du petit chemin",
        body: "{{petName}} aimerait peut-être une promenade tranquille aujourd’hui."
      },
      rest_needed: {
        title: "{{petName}} est en mode dodo",
        body: "Un peu de repos gardera un rythme tout doux ce soir."
      },
      rainy_cozy_check: {
        title: "Petit coucou sous la pluie",
        body: "{{petName}} reste bien au chaud. Un bonjour irait parfaitement avec ce temps."
      },
      return_after_1_day: {
        title: "Une petite empreinte est apparue près de la porte",
        body: "{{petName}} se demandait quand vous repasseriez par ici."
      },
      return_after_1_day_streak: {
        title: "{{petName}} garde votre petite routine bien au chaud",
        body: "Votre série est encore toute chaude. Une petite visite aujourd’hui la fera continuer à briller."
      },
      return_after_3_days: {
        title: "Le jardin vous a gardé une place",
        body: "Quelques jours se sont écoulés. {{petName}} sera ravi d’un petit bonjour quand vous en aurez envie."
      }
    },
    monthlyLetter: {
      fallbackPetName: "Votre compagnon",
      title: "Une lettre vous attend",
      body: "Une lettre de {{petName}} vous attend dans le jardin."
    }
  },
  errorBoundary: {
    fallbackPetName: "Votre compagnon",
    title: "Un petit couac s’est produit",
    message: "{{petName}} va bien. Cet écran a simplement besoin d’un nouveau départ.",
    retry: "Réessayer"
  },
  legal: {
    back: "Retour aux réglages",
    privacy: {
      accessibilityLabel: "Politique de confidentialité et informations sur l’IA",
      eyebrow: "Confidentialité",
      title: "Sécurité des photos et des discussions",
      updated: "Dernière mise à jour le 8 juillet 2026 · v1.1",
      items: {
        first: "Aucun compte ni e-mail : l’application s’ouvre avec une session anonyme, sans inscription.",
        second:
          "La photo originale de votre compagnon est envoyée à OpenAI uniquement pour effectuer un contrôle de sécurité et générer l’avatar. Elle est ensuite automatiquement supprimée de nos serveurs dès la fin de la génération.",
        third:
          "Le déblocage ultérieur d’autres expressions réutilise l’avatar déjà généré, et non la photo originale, qui n’existe alors plus sur nos serveurs.",
        fourth:
          "Les avatars générés sont conservés dans un espace de stockage privé et affichés uniquement via des liens signés de courte durée, jamais par une URL publique.",
        fifth:
          "Les statistiques de soins, les souvenirs et la progression du jardin sont stockés localement sur votre appareil. La désinstallation de l’application les supprime donc définitivement.",
        sixth: "Si vous l’autorisez, votre position approximative est arrondie et envoyée une seule fois pour connaître la météo locale réelle du jardin. Elle n’est jamais stockée — et si la recherche échoue, votre appareil crée lui-même une ambiance météo similaire.",
        seventh: "La discussion premium est signalée comme générée par une IA et modérée avant l’affichage des messages.",
        eighth:
          "Aucun kit de développement publicitaire ou de suivi n’est utilisé, et les analyses excluent les photos brutes, le texte brut des discussions et les données de paiement."
      },
      sections: {
        sharingTitle: "Tiers avec lesquels nous partageons des données",
        sharingBody:
          "OpenAI traite la photo source de votre compagnon pour les contrôles de sécurité et la génération de l’avatar ainsi que, pour la discussion premium, le profil de votre compagnon et le contexte récent de la conversation. Supabase héberge notre base de données, notre stockage privé et l’authentification anonyme. Apple ou Google gère directement les paiements intégrés ; nous recevons un reçu, jamais les données de votre carte.",
        rightsTitle: "Vos droits",
        rightsBody:
          "Vous pouvez supprimer séparément la photo originale. Pour tout supprimer, choisissez Supprimer les données du compagnon dans Réglages. Cette action efface les données locales et demande à nos serveurs de supprimer la photo, les avatars générés, le compte anonyme et les données associées. Si le serveur est inaccessible, les données locales sont immédiatement effacées et l’application vous invite à relancer ultérieurement l’étape sur le serveur.",
        childrenTitle: "Enfants",
        childrenBody:
          "Mongchi ne s’adresse pas aux enfants de moins de 13 ans. Si vous pensez qu’un enfant a fourni des informations par le biais d’une photo ou d’une discussion, contactez l’assistance et nous les supprimerons."
      },
      policyLink: "Lien vers la politique",
      policyFallback: "Un lien sécurisé vers la politique de confidentialité apparaîtra ici lorsqu’il sera disponible.",
      openPolicy: "Ouvrir la politique",
      aiTitle: "Informations sur l’IA",
      aiBody: "Cette conversation est générée par une IA à partir du profil de votre compagnon. Elle ne représente pas la conscience de votre véritable animal."
    },
    support: {
      accessibilityLabel: "Assistance et rapports de génération",
      eyebrow: "Assistance",
      title: "Aide et signalements",
      updated: "Dernière mise à jour le 7 juillet 2026 · v1.0",
      website: {
        title: "Site de Mongchi",
        description: "Retrouvez les actualités et l’aide sur notre site.",
        action: "Ouvrir le site"
      },
      faqTitle: "Questions fréquentes",
      faq: {
        photoQuestion: "La photo de mon compagnon est-elle en sécurité ?",
        photoAnswer:
          "Votre photo sert uniquement au contrôle de sécurité et à la génération de l’avatar. Elle est automatiquement supprimée de nos serveurs à la fin de la génération.",
        deleteQuestion: "Comment supprimer mes données ?",
        deleteAnswer:
          "Supprimez séparément la photo originale pendant le parcours photo, ou utilisez Supprimer les données du compagnon dans Réglages pour demander une suppression complète sur l’appareil et le serveur.",
        creditQuestion: "Qu’advient-il de mes crédits si la génération échoue ?",
        creditAnswer:
          "Une défaillance du système, du contrôle de sécurité ou de la qualité ne devrait pas consommer de crédit payant. Signalez-la ci-dessous si un crédit semble avoir été utilisé à tort."
      },
      reportTitle: "Signaler un problème de génération",
      reportDetail: "Les signalements utilisent une catégorie sûre et n’envoient aucune photo brute aux outils d’analyse.",
      options: {
        wrong: {
          label: "Apparence incorrecte",
          description: "L’espèce, les marques ou le visage semblent inexacts."
        },
        unsafe: {
          label: "Apparence inquiétante",
          description: "Quelque chose semble dérangeant ou effrayant."
        },
        quality: {
          label: "Résultat flou",
          description: "Le compagnon est difficile à reconnaître."
        }
      },
      report: "Signaler",
      saved: "Enregistré",
      lastReport: "Dernier signalement : {{label}}",
      savedTitle: "Signalement enregistré",
      savedMessage: "Seule la catégorie du problème a été enregistrée. Aucune photo brute ni aucun texte de discussion n’a été joint.",
      feedback: {
        title: "Dites-nous tout",
        prompt: "Dites-nous tout — ce qui vous a semblé étrange, ou ce qui vous a fait sourire.",
        messagePlaceholder: "Écrivez tout ce qui vous passe par la tête…",
        messageAccessibilityLabel: "Message de retour",
        contactPlaceholder: "Un contact si vous souhaitez une réponse (facultatif)",
        contactAccessibilityLabel: "Contact facultatif pour une réponse",
        send: "Envoyer",
        savedTitle: "Merci",
        savedMessage: "Nous lisons chaque message avec attention. Merci de l'avoir partagé."
      }
    },
    terms: {
      accessibilityLabel: "Conditions et valeur payante",
      eyebrow: "Conditions",
      title: "Usage équitable et valeur payante",
      updated: "Dernière mise à jour le 7 juillet 2026 · v1.0",
      items: {
        first:
          "Mongchi est un divertissement généré par une IA : votre compagnon et ses discussions ne représentent ni la conscience ni les souvenirs de votre véritable animal et ne constituent pas un avis médical.",
        second: "Lors de la création du premier compagnon, vous gardez le contrôle de la photo sélectionnée et pouvez la supprimer séparément.",
        third: "Les générations incorrectes, les défaillances du système et les échecs des contrôles de qualité ne devraient pas consommer de valeur payante.",
        fourth: "Les soins de base restent gratuits. Les objets payants ajoutent de l’expression, sans servir à réparer un manque de soins.",
        fifth: "Les crédits et objets payants n’ont aucune valeur monétaire ; les remboursements suivent la politique de la boutique utilisée pour l’achat.",
        sixth: "Les conversations générées du compagnon ne doivent jamais prétendre représenter la conscience de votre véritable animal."
      },
      sections: {
        useTitle: "Utilisation acceptable",
        useBody:
          "N’importez pas de photos contenant des personnes, du contenu explicite ou choquant, ni quoi que ce soit d’illégal. Ne contournez pas les limites de génération ou les contrôles de sécurité et ne tentez pas de débrider la discussion.",
        portabilityTitle: "Aucune portabilité de compte",
        portabilityBody:
          "Mongchi n’utilise pas de comptes traditionnels. La session et les données locales du jeu restent sur votre appareil. Sans sauvegarde, désinstaller l’application ou changer d’appareil peut donc entraîner la perte définitive de la progression locale, des souvenirs et des crédits.",
        disclaimerTitle: "Clause de non-responsabilité",
        disclaimerBody:
          "Mongchi est fourni en l’état. Le contenu généré par une IA peut parfois être inexact ou échouer malgré les contrôles de sécurité et de qualité. Consultez l’intégralité des conditions pour connaître toutes les limites."
      },
      linkTitle: "Lien vers les conditions",
      linkFallback: "Un lien sécurisé vers les conditions apparaîtra ici lorsqu’il sera disponible.",
      openTerms: "Ouvrir les conditions"
    }
  }
} satisfies DeepStringShape<typeof enUS>;
