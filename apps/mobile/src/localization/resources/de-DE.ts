import type { enUS } from "./en-US";

type DeepStringShape<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : DeepStringShape<T[Key]>;
};

export const deDE = {
  common: {
    actions: {
      apply: "Anwenden",
      applied: "Angewendet",
      backHome: "Zurück nach Hause",
      cancel: "Abbrechen",
      camera: "Kamera",
      checking: "Wird geprüft",
      change: "Ändern",
      chooseAnotherPhoto: "Anderes Foto wählen",
      clear: "Leeren",
      cleared: "Geleert",
      continue: "Weiter",
      delete: "Löschen",
      deleting: "Wird gelöscht",
      enable: "Aktivieren",
      export: "Exportieren",
      next: "Weiter",
      ok: "OK",
      open: "Öffnen",
      reportIssue: "Problem melden",
      restore: "Wiederherstellen",
      restoring: "Wird wiederhergestellt",
      saved: "Gespeichert",
      seeProfile: "Profil ansehen",
      share: "Teilen",
      shop: "Shop",
      skip: "Überspringen",
      tryAgain: "Erneut versuchen",
      turnOff: "Ausschalten",
      unlock: "Freischalten",
      viewHome: "Zuhause ansehen"
    }
  },
  languageSelector: {
    openAccessibilityLabel: "App-Sprache auswählen",
    title: "Sprache",
    subtitle: "Folge dem Gerät oder behalte eine feste Sprache für Mongchi.",
    automatic: "Automatisch",
    automaticDetail: "Gerätesprache verwenden · {{language}}",
    selected: "Ausgewählt",
    saveError: "Die Sprache konnte nicht gespeichert werden. Bitte versuche es erneut.",
    closeAccessibilityLabel: "Sprachauswahl schließen"
  },
  splash: {
    accessibilityLabel: "Ladebildschirm für das kleine Zuhause deines Lieblings",
    logoAccessibilityLabel: "Mongchi-App-Logo",
    animationAccessibilityLabel: "Ladeanimation der kleinen Welt",
    opening: "Kleines Zuhause wird geöffnet",
    warming: "Das gemütliche Zimmer wird aufgewärmt"
  },
  welcome: {
    accessibilityLabel: "Willkommen bei Mongchi",
    page: "Willkommensseite {{current}} von {{total}}",
    skipAccessibilityLabel: "Willkommen überspringen",
    start: "Mit einem Foto starten",
    slides: {
      first: {
        step: "Schritt 1",
        title: "Dein Liebling, jeden Tag ganz nah",
        body: "Mach aus deinem liebsten Tierfoto einen kleinen Freund, der in deinem Garten auf dich wartet."
      },
      second: {
        step: "Schritt 2",
        title: "Ein Foto genügt",
        body: "Wähle ein klares Foto deines Lieblings und ergänze seinen Namen und seine kleine Persönlichkeit."
      },
      third: {
        step: "Schritt 3",
        title: "Eure Bindung wächst jeden Tag",
        body: "Füttern, spielen, plaudern und jeden Tag in den gemütlichen Garten deines Lieblings zurückkehren."
      }
    }
  },
  photoIntro: {
    accessibilityLabel: "Einführung zum Tierfoto",
    artAccessibilityLabel: "Ein Tierfoto öffnet sich zu einem kleinen Gartenzuhause",
    title: "Dein geliebtes Tier immer nah",
    body: "Beginne mit einem klaren Tierfoto, ergänze Name und Persönlichkeit und lerne den kleinen Freund kennen, der in deinem Garten wartet.",
    quest: {
      photo: "Foto",
      name: "Name",
      moveIn: "Einzug"
    },
    privacy: "Das Foto deines Lieblings wird nur verwendet, um deinen kleinen Freund zu erschaffen. Nach dem Einzug kannst du das Original jederzeit löschen.",
    choosePhoto: "Tierfoto wählen"
  },
  photoUpload: {
    accessibilityLabel: "Tierfoto hochladen",
    back: "Zurück zur Fotoeinführung",
    title: "Wähle das schönste Foto",
    artAccessibilityLabel: "Sichere Auswahltafel für Tierfotos",
    changeSelected: "Ausgewähltes Tierfoto ändern",
    choosePhoto: "Tierfoto wählen",
    selectedPreview: "Vorschau des ausgewählten Tierfotos von {{petName}}",
    selectedSamplePreview: "Vorschau des ausgewählten Beispielfotos von {{petName}}",
    samplePreview: "Vorschau des Beispiel-Tierfotos",
    sampleSelected: "Beispielfoto ausgewählt",
    photoSelected: "Tierfoto ausgewählt",
    purpose: "Damit entsteht der kleine Freund, der in deinem Garten lebt.",
    library: "Fotomediathek",
    sampleAction: "Kein Foto zur Hand? Lerne einen Beispielfreund kennen",
    sampleAccessibilityLabel: "Beispielfreund kennenlernen",
    privacy: "Wird nur verwendet, um deinen kleinen Freund zu erschaffen. Nach dem Einzug kannst du das Original löschen.",
    errors: {
      invalidTitle: "Foto kann nicht verwendet werden",
      invalidType: "Wähle ein Tierfoto als JPEG, PNG oder WebP.",
      tooLarge: "Wähle ein Bild unter 10 MB, auf dem dein Tier gut zu sehen ist.",
      libraryTitle: "Zugriff auf Fotos erforderlich",
      libraryMessage: "Wähle ein Tierfoto, damit die App deinen kleinen Freund erschaffen kann.",
      cameraTitle: "Kamerazugriff erforderlich",
      cameraMessage: "Auf die Kamera wird nur zugegriffen, wenn du ein Tierfoto aufnehmen möchtest."
    }
  },
  petSetup: {
    accessibilityLabel: "Tier einrichten",
    back: "Zurück zum Foto",
    artAccessibilityLabel: "Einzugstisch für den kleinen Liebling mit Namensschild und gemütlichem Bett",
    eyebrow: "Einzugspapiere",
    title: "Gib deinem kleinen Freund einen Namen",
    summary: "{{species}} / {{voice}} · macht sich bereit für den Einzug",
    speciesQuestion: "Wer zieht ein?",
    petName: "Tiername",
    nameHint: "Mit diesem Namen wirst du jeden Tag an der Tür begrüßt.",
    personalityQuestion: "Wie ist dein kleiner Freund so?",
    voiceQuestion: "Wie klingt seine kleine Stimme?",
    favoriteQuestion: "Was liebt dein Liebling schon jetzt?",
    favoriteThing: "Kleine Lieblingssache",
    memoryQuestion: "Welche kleine Erinnerung soll mit einziehen?",
    firstMemory: "Erste kleine Erinnerung",
    firstMemoryPlaceholder: "Eine kleine Erinnerung mit deinem Liebling…",
    continueHint: "Wähle einen Namen, eine Stimmung und eine Stimme, um fortzufahren.",
    species: { dog: "Hund", cat: "Katze" },
    personality: {
      playful: "Verspielt",
      calm: "Ruhig",
      shy: "Schüchtern",
      curious: "Neugierig",
      sleepy: "Verschlafen",
      affectionate: "Anhänglich"
    },
    voice: {
      cute: "Niedlich",
      gentle: "Sanft",
      cheerful: "Fröhlich",
      comforting: "Tröstend"
    }
  },
  generation: {
    accessibilityLabel: "Einzug von {{petName}}",
    back: "Zurück zur Tiereinrichtung",
    eyebrow: "Einzug",
    titleReady: "{{petName}} ist bereit",
    titleMoving: "{{petName}} zieht ein",
    warmAccessibilityLabel: "Wärme das Ei von {{petName}} mit einer sanften Berührung",
    artAccessibilityLabel: "Magische Einzugsszene von {{petName}}",
    forming: "Aus den Details des Fotos entsteht dein kleiner Freund.",
    favoriteFallback: "gemütlichen Kleinigkeiten",
    progressAccessibilityLabel: "Fortschritt des Einzugs",
    recapTitle: "Wer ist unterwegs?",
    failureTitle: "Einzug pausiert",
    quotaFailure: "Dein kleiner Freund kann bald einziehen. Schau in einer kleinen Weile wieder vorbei.",
    retryFailure: "Die kleine Tür klemmt. Versuchen wir noch einmal, {{petName}} zu erschaffen.",
    safetyFailure: "Mit diesem Foto konnten wir deinem Haustier leider nicht beim Einzug helfen. Bitte versuch es mit einem anderen Foto, auf dem dein Haustier gut zu erkennen ist.",
    reveal: "Liebling enthüllen",
    steps: {
      preparing: "Foto wird vorbereitet",
      details: "Kleine Details werden entdeckt",
      creating: "Gefährte wird erschaffen",
      polishing: "Kleine Welt erhält den letzten Schliff",
      movingIn: "Zieht ein"
    },
    observations: {
      first: "Die Fellfarben auf deinem Foto werden genau betrachtet...",
      second: "Die Ohrenform von {{petName}} wird ganz sorgfältig skizziert...",
      third: "Die flauschigsten Pixel werden einzeln ausgesucht...",
      fourth: "{{petName}} übt schon das erste Hallo...",
      fifth: "Das perfekte Schwanzwedeln wird ausgemessen...",
      sixth: "Das Sonnenlicht lernt, wo {{petName}} ein Nickerchen macht...",
      seventh: "Kleine Erinnerungen an {{favoriteThing}} werden eingepackt...",
      eighth: "Die glänzenden Augen werden poliert, bis sie funkeln..."
    },
    warmLines: {
      first: "Deine Wärme hat das Ei erreicht. Es hat ein wenig gewackelt!",
      second: "Das Ei fühlt sich jetzt noch wohliger an.",
      third: "Ein kleiner Herzschlag hat Danke gesagt.",
      fourth: "Fast geschafft. Deine Hand hilft dabei."
    },
    statuses: {
      created: "Das kleine Atelier wird aufgewärmt.",
      queued: "Ein freier Platz für den Einzug wird gesucht.",
      claimed: "Das kleine Atelier wird geöffnet.",
      validating: "Die Fotodetails werden geprüft.",
      preprocessing: "Das Foto wird vorbereitet.",
      safety_checking: "Ein sicherer Einzug für den kleinen Freund wird geprüft.",
      generating: "Der erste kleine Gefährte entsteht.",
      postprocessing: "Fell und letzte Details werden verfeinert.",
      quality_checking: "Das fertige Aussehen wird geprüft.",
      uploading_assets: "Der Liebling packt für sein neues Zuhause.",
      cleanup_pending: "Das Foto wird vor dem Einzug aufgeräumt.",
      completed: "Bereit für euer Kennenlernen.",
      failed: "Einzug pausiert.",
      cancelled: "Der Einzug wurde gestoppt.",
      expired: "Die Zeit für den Einzug ist abgelaufen."
    },
    teaser: {
      playful: "Ein verspielter kleiner Freund packt seine Sachen...",
      calm: "Ein ruhiger kleiner Freund packt seine Sachen...",
      shy: "Ein etwas schüchterner kleiner Freund packt seine Sachen...",
      curious: "Ein neugieriger kleiner Freund packt seine Sachen...",
      sleepy: "Ein verschlafener kleiner Freund packt seine Sachen...",
      affectionate: "Ein lieber kleiner Freund packt seine Sachen...",
      fallback: "Ein lieber kleiner Freund packt seine Sachen..."
    },
    guidance: "Sorge für eine stabile Verbindung. Falls die App unterbrochen wird, geht derselbe Einzug bei deiner Rückkehr weiter."
  },
  reveal: {
    accessibilityLabel: "Enthüllung von {{petName}}",
    back: "Zurück zum Einzug",
    artAccessibilityLabel: "Fröhliche Enthüllungsfeier von {{petName}}",
    plaque: "Neuer Freund",
    eyebrow: "Dein Liebling ist da",
    title: "Lerne {{petName}} kennen",
    enter: "Ab in den Garten",
    shareAccessibilityLabel: "{{petName}} teilen",
    notRight: "Noch nicht ganz richtig?",
    shareMessages: {
      first: "Das ist {{petName}}, mein neuer kleiner Gartenfreund. Erschaffen mit Mongchi.",
      second: "{{petName}} ist gerade in einen kleinen Pixelgarten eingezogen. Erschaffen mit Mongchi."
    }
  },
  home: {
    localeAccessibilityLabel: "Spielbares kleines Gartenzuhause von {{petName}}",
    hud: {
      accessibilityLabel: "Spielstatus des kleinen Gartens",
      labels: {
        fullness: "Satt",
        thirst: "Wasser",
        mood: "Laune",
        energy: "Energie",
        cleanliness: "Sauber"
      },
      meterAccessibilityLabel: "Status: {{label}}. Tippen für Details.",
      artAccessibilityLabel: "Statusgrafik für {{label}}"
    },
    rail: {
      openShop: "Shop öffnen",
      shopArt: "Grafik der Shop-Schaltfläche",
      openChat: "Chat mit {{petName}} öffnen",
      chatArt: "Grafik der Chat-Schaltfläche",
      openFriend: "Freundeseite von {{petName}} öffnen",
      friendArt: "Grafik der Freunde-Schaltfläche",
      letterWaiting: "{{label}}. Ein neuer Brief wartet.",
      openSettings: "Einstellungen öffnen",
      settingsArt: "Grafik der Einstellungen-Schaltfläche"
    },
    pet: {
      accessibilityLabel: "{{petName}} streicheln",
      longPressHint: "Gedrückt halten, um die Freundeseite von {{petName}} zu öffnen",
      avatarAccessibilityLabel: "Erstellter Tieravatar",
      finishMessageHint: "Tippen, um jetzt die ganze Nachricht anzuzeigen.",
      walkingPaws: "Laufende Pfotenschritte von {{petName}}"
    },
    butterflyAccessibilityLabel: "Ein kleiner Schmetterling ist zu Besuch. Tippe, um Hallo zu sagen.",
    care: {
      actions: {
        feed: "Füttern",
        talk: "Reden",
        walk: "Gassi",
        play: "Spielen",
        rest: "Ruhen",
        affection: "Streicheln",
        water_garden: "Wasser",
        clean: "Pflegen",
        treat: "Leckerli"
      },
      iconAccessibilityLabel: "Pflegesymbol für {{label}}",
      itemAccessibilityLabel: "Pflegegegenstand {{label}}",
      feedCooldown: "Futtermenü. Wartezeit für die tägliche Mahlzeit: {{cooldown}}. Leckerlis sind vielleicht noch verfügbar.",
      feedMenu: "Futtermenü für {{petName}}.",
      walkActive: "Der Spaziergang läuft. {{petName}} ist in {{seconds}} Sekunden zurück.",
      optionCooldown: "Menü {{label}}. Wartezeit der Basisoption: {{cooldown}}. Besondere Gegenstände sind vielleicht noch verfügbar.",
      recommended: "Empfohlen: {{petName}} {{label}}. {{hint}}",
      actionAccessibilityLabel: "{{petName}} {{label}}",
      tray: {
        titles: {
          affection: "Bindung stärken",
          feed: "Futter & Leckerlis",
          play: "Spielmöglichkeiten",
          walk: "Weg auswählen",
          water_garden: "Wasser"
        },
        optionsAccessibilityLabel: "Optionen für {{title}}",
        shopOption: "Shop für {{title}} öffnen.",
        cooldownOption: "{{title}} braucht noch {{cooldown}} Pause.",
        useOption: "{{title}} für {{petName}} verwenden.",
        openShop: "Shop für Pflegegegenstände öffnen.",
        shop: "Shop"
      },
      options: {
        pet: "Streicheln",
        meal: "Mahlzeit",
        ball: "Ball",
        path: "Weg",
        water: "Wasser",
        bath: "Bad",
        treat: "Leckerli"
      },
      meta: {
        bond: "+Bindung",
        fullness: "+Satt",
        mood: "+Laune",
        thirst: "+Durst",
        fresh: "+Frische",
        shop: "Shop"
      }
    },
    walk: {
      activeTitle: "{{petName}} ist unterwegs · zurück in {{time}}",
      activeSubcopy: "Du kannst die App ruhig schließen. Wir sagen dir Bescheid, wenn {{petName}} zurück ist.",
      bringHomeAccessibilityLabel: "{{cost}} Credit ausgeben, um {{petName}} sofort nach Hause zu holen",
      cannotBringHomeAccessibilityLabel: "Nicht genug Credits, um {{petName}} sofort nach Hause zu holen",
      coinAccessibilityLabel: "Münzwährung",
      openCreditStoreAccessibilityLabel: "Credit-Shop öffnen",
      commentary: {
        early: "{{petName}} folgt einer sehr wichtigen Spur...",
        mid: "{{petName}} ist stehen geblieben, um ein Blatt zu begrüßen.",
        late: "{{petName}} hat etwas gefunden und bringt es mit nach Hause!"
      },
      bringHome: "Jetzt heimholen · {{cost}}",
      openCreditStore: "Credits holen",
      insufficientHint: "Hol Credits oder warte, bis {{petName}} zurückkommt.",
      waiting: "{{petName}} ist bald zurück. Nur noch einen kleinen Moment.",
      returned: "{{petName}} ist mit einem kleinen Geschenk zurück!",
      claimAccessibilityLabel: "{{petName}} begrüßen und das Spaziergangsgeschenk abholen",
      claim: "Begrüßen & abholen"
    },
    guide: {
      tryAction: "Probiere zuerst „{{action}}“ aus. {{petName}} wird es lieben.",
      chooseAction: "Wähle eine kleine Pflegeaktion für {{petName}}.",
      closeAccessibilityLabel: "Statushilfe schließen",
      accessibilityLabel: "Statushilfe",
      gotIt: "Verstanden"
    },
    originalPhotoDeleted: "Das Originalfoto wurde für diese Sitzung gelöscht.",
    welcome: {
      accessibilityLabel: "Willkommen in deinem kleinen Garten",
      title: "Willkommen im kleinen Garten von {{petName}}",
      body: "{{petName}} lebt jetzt hier und freut sich auf kleine liebevolle Momente mit dir.",
      care: "Füttere, gib Wasser, spiele und streichle, damit die Anzeigen gut gefüllt bleiben.",
      speech: "Die Sprechblase zeigt dir, was {{petName}} gerade braucht.",
      streak: "Komm jeden Tag zurück und lass deine Pflegeserie wachsen.",
      action: "Pflege starten"
    }
  },
  chat: {
    screenAccessibilityLabel: "Chat mit {{petName}}",
    screenReaderTitle: "Mit {{petName}} chatten",
    back: "Zurück nach Hause",
    petAccessibilityLabel: "Liebling im Chat",
    petSays: "{{petName}} sagt: {{text}}",
    finishMessageHint: "Tippen, um sofort die ganze Nachricht anzuzeigen",
    opening: "Ein gemütlicher Chat wird geöffnet...",
    unavailableTitle: "Der lange Chat macht Pause",
    unavailableDetail: "Kurze Gespräche und alle Pflegereaktionen bleiben verfügbar, während die Sicherheitsprüfung läuft.",
    unavailableInput: "Der lange Chat ist noch nicht verfügbar",
    networkError: "Der Chat ist gerade nicht erreichbar. Versuche es noch einmal.",
    startersAccessibilityLabel: "Gesprächseinstiege",
    starterAccessibilityLabel: "Gesprächseinstieg verwenden: {{starter}}",
    inputAccessibilityLabel: "Premium-Chatnachricht",
    inputPlaceholder: "Nachricht an {{petName}}",
    sendAccessibilityLabel: "Premium-Chatnachricht senden",
    disclosure: "Dieses KI-generierte Gespräch richtet sich nach dem Profil deines Lieblings. Es ist nicht das Bewusstsein deines echten Tieres.",
    disclosureBanner: {
      dismissAccessibilityLabel: "KI-Hinweis schließen"
    },
    info: {
      button: "Über diesen Chat",
      title: "Über diesen Chat",
      aiTitle: "KI-generiertes Gespräch",
      billingTitle: "Chats & Credits",
      billingBody: "Inbegriffene Chats und Credits werden in dem Moment, in dem du sendest, sicher geprüft. Sobald die Gratis-Chats für heute aufgebraucht sind, können ein Day Pass oder Credits das Gespräch fortsetzen.",
      close: "Verstanden"
    },
    report: {
      button: "Diese KI-Antwort melden",
      reported: "Diese KI-Antwort wurde gemeldet",
      title: "Diese Antwort melden",
      detail: "Wähle den passendsten Grund. Wir speichern nur die Nachrichtenreferenz und den Grund zur Prüfung.",
      reasons: {
        harmful: "Schädlich oder unsicher",
        inappropriate: "Unangemessen",
        inaccurate: "Falsch oder irreführend",
        other: "Etwas anderes"
      },
      cancel: "Meldung schließen",
      sending: "Meldung wird gesendet...",
      success: "Danke. Diese Antwort wurde zur Prüfung gesendet.",
      error: "Die Meldung konnte nicht gesendet werden. Versuche es erneut."
    },
    history: {
      accessibilityLabel: "Gesprächsverlauf mit {{petName}}",
      user: "Du",
      notice: "Hinweis",
      empty: "Euer gemütliches Gespräch beginnt hier.",
      notSent: "Noch nicht gesendet.",
      retryAccessibilityLabel: "Nachricht erneut senden",
      retry: "Erneut senden",
      typing: "{{petName}} tippt..."
    },
    deterministicErrors: {
      emptyMessage: "Schreibe zuerst eine kurze Nachricht.",
      locked: "Nutze ein Ticket, einen Credit oder einen Plus-Pass, um weiterzuplaudern.",
      session: "Euer gemütlicher Chat konnte nicht gestartet werden. Versuche es noch einmal.",
      history: "Dieser Chat konnte noch nicht geladen werden. Versuche es noch einmal.",
      credits: "Für diesen Chat sind keine Credits mehr da. Weitere gemütliche Gespräche können warten, bis du bereit bist.",
      rateLimited: "Das Gespräch braucht eine kleine Pause. Versuche es bald wieder.",
      rejected: "Diese Nachricht konnte nicht gesendet werden. Probiere eine andere kurze Nachricht.",
      unavailable: "Der Chat ruht sich kurz aus. Bitte versuche es noch einmal."
    }
  },
  friend: {
    accessibilityLabel: "Freundeseite von {{petName}}",
    back: "Zurück nach Hause",
    share: "{{petName}} teilen",
    movedIn: {
      today: "Heute eingezogen",
      daysAgo: "Vor {{count}} Tagen eingezogen"
    },
    stats: {
      bond: "Bindung",
      streak: "Serie",
      together: "Zusammen",
      bondAccessibilityLabel: "Bindungsfortschritt bis Stufe {{level}}: {{label}}"
    },
    sections: {
      lately: "In letzter Zeit hat {{petName}}...",
      walkFinds: "Spaziergangsfunde",
      moments: "Unsere kleinen Momente",
      letter: "Brief von {{petName}}",
      memoryNote: "Erinnerungsnotiz"
    },
    walkFindAccessibilityLabel: "{{name}}, {{count}}-mal gefunden",
    undiscoveredWalkFind: "Noch unentdeckter Spaziergangsfund",
    letter: {
      giftAccessibilityLabel: "Der Brief von {{petName}} ist als Geschenk verpackt und kann geöffnet werden",
      openAccessibilityLabel: "Monatsbrief von {{petName}} öffnen",
      open: "Öffnen",
      checking: "Der heutige Brief wird gesucht..."
    },
    pose: {
      accessibilityLabel: "Pose {{pose}} von {{petName}}",
      collectionAccessibilityLabel: "Posen von {{petName}}",
      position: "Pose {{current}} von {{total}} · {{pose}}",
      moreAccessibilityLabel: "Weitere Dreier-Posenpakete im Momente-Shop ansehen",
      more: "Mehr Posen ansehen",
      labels: { everyday: "Alltag", happy: "Fröhlich", sleepy: "Verschlafen" }
    },
    shareMessages: {
      days: "{{petName}} ist seit {{count}} Tagen mein kleiner Gartenfreund. Erschaffen mit Mongchi.",
      fallback: "Das ist {{petName}}, mein kleiner Gartenfreund. Erschaffen mit Mongchi."
    },
    shareCard: {
      title: "Karte gestalten",
      subtitle: "Wähle eine Pose und einen Hintergrund, den deine Freunde lieben werden.",
      poseSectionTitle: "Pose",
      themeSectionTitle: "Hintergrund",
      poseOptionAccessibilityLabel: "Pose: {{pose}}",
      themeOptionAccessibilityLabel: "Hintergrund: {{theme}}",
      selected: "Ausgewählt",
      previewAccessibilityLabel: "Vorschau von {{petName}}s Freigabekarte",
      closeAccessibilityLabel: "Kartengestaltung schließen",
      shareAccessibilityLabel: "{{petName}}s Karte teilen"
    }
  },
  shop: {
    accessibilityLabel: "Gartenshop",
    title: "Gartenshop",
    back: "Zurück nach Hause",
    walletAccessibilityLabel: "Shop-Guthaben: {{credits}} Credits und {{owned}} eigene Set-Gegenstände",
    creditGemAccessibilityLabel: "Credit-Symbol des Shops",
    openCreditStore: "Credit-Laden öffnen",
    categories: {
      all: "Alle",
      treats: "Leckerlis",
      drinks: "Getränke",
      toys: "Spielzeug",
      rest: "Ruhe",
      moments: "Momente",
      themes: "Themen"
    },
    tabs: {
      care: "Leckerlis & Spielzeug",
      customize: "Posen & Themen"
    },
    sections: {
      careItems: "Leckerlis, Getränke & Spielzeug",
      careItemsDescription: "Wähle kleine Belohnungen, Spielzeug und gemütliche Ruheplätze.",
      posePacks: "Posen-Pakete",
      posePacksDescription: "Schalte in jedem Paket drei passende Ausdrücke und Posen frei.",
      themes: "Gartenthemen",
      themesDescription: "Verändere die ganze Stimmung im Zuhause deines Begleiters."
    },
    careFiltersAccessibilityLabel: "Filter für Pflegeartikel",
    customizeFiltersAccessibilityLabel: "Anpassungsfilter",
    categoryAccessibilityLabel: "{{label}}, {{count}} Gegenstände",
    emptyPreview: "Neue gemütliche Dinge erscheinen hier, sobald dieses Regal gefüllt ist.",
    emptyShelf: "Dieses Regal wird gerade gefüllt.",
    comingSoon: "Demnächst",
    soon: "Bald",
    owned: "Im Besitz",
    ownedQuantity: "Im Besitz: {{count}} ×",
    devOpen: "Für Entwicklung geöffnet",
    available: "Verfügbar",
    locked: "Gesperrt",
    creditsNeeded: "Noch {{count}} Credits nötig",
    backgroundPreview: "Hintergrundvorschau für {{name}}",
    largePreview: "Große Vorschau für {{name}}",
    backgroundThumbnail: "Hintergrundminiatur für {{name}}",
    itemIcon: "Symbol für {{name}}",
    pricesAccessibilityLabel: "Credit- und Münzpreise werden akzeptiert",
    walletGemAccessibilityLabel: "Credit-Preis",
    coinAccessibilityLabel: "Münzwährung",
    gemPriceAccessibilityLabel: "Credit-Preis",
    actions: {
      unlockTheme: "Thema freischalten",
      applyTheme: "Thema anwenden",
      getItem: "Kaufen",
      unlockPack: "Paket freischalten",
      topUpCredits: "Credits aufladen"
    },
    grants: {
      consumable: "Credit",
      durable: "Einmalig im Besitz",
      subscription: "Abonnement"
    },
    products: {
      premiumChat: {
        name: "Monatlicher Plus-Chat",
        description: "Längere, herzlichere Gespräche, solange der Plus-Pass aktiv ist."
      },
      extraPetSlot: {
        name: "Zusätzlicher Tierplatz",
        description: "Schaffe Platz für ein weiteres kleines Tierprofil."
      },
      regenerationCredit: {
        name: "Credit für eine Neuerstellung",
        description: "Ein neuer Avatarversuch, wenn du dir einen frischen Look wünschst."
      },
      starterTheme: {
        name: "Start-Themenpaket",
        description: "Eine frische Kulisse für das kleine Zuhause."
      },
      itemPack: {
        name: "Gegenstandspaket",
        description: "Eine liebevoll zusammengestellte Auswahl an Leckerlis und Spielzeug."
      },
      treatPack: {
        name: "Leckerli-Paket",
        description: "Besondere Snacks für niedliche Reaktionsmomente."
      },
      plusPass: {
        name: "Plus-Pass",
        description: "Premium-Vorteile für eure Bindung, längere Chats und künftige Plus-Funktionen."
      }
    },
    actionAccessibility: {
      unlockTheme: "{{name}} für {{price}} freischalten",
      themeLocked: "{{name}} ist gesperrt",
      applyTheme: "{{name}} anwenden",
      themeApplied: "{{name}} ist angewendet",
      buy: "{{name}} kaufen",
      topUpCredits: "Credits für {{name}} aufladen"
    },
    summary: {
      accessibilityLabel: "{{owned}} eigene Set-Gegenstände und {{locked}} gesperrte Shop-Gegenstände",
      owned: "Set im Besitz",
      locked: "{{count}} gesperrte Shop-Gegenstände"
    },
    dialogs: {
      checkout: "Kasse",
      checkoutFailed: "Der Bezahlvorgang konnte gerade nicht gestartet werden. Bitte versuche es noch einmal.",
      shop: "Shop",
      shopFailed: "Dieser Gegenstand konnte gerade nicht hinzugefügt werden. Bitte versuche es noch einmal.",
      itemAdded: "Gegenstand hinzugefügt",
      itemAddedMessage: "Dein neuer Gegenstand wartet im Inventar.",
      posePack: "Posenpaket",
      posePackFailed: "Dieses Posenpaket konnte gerade nicht gestartet werden. Bitte versuche es noch einmal.",
      posesOnWay: "Drei Posen sind unterwegs",
      posesOnWayMessage: "Die drei neuen Posen deines Gefährten werden gemeinsam erstellt.",
      theme: "Thema",
      themeFailed: "Dieses Thema konnte gerade nicht geändert werden. Bitte versuche es noch einmal.",
      makeover: "Ein neuer Look für den Garten!",
      themeApplied: "Thema angewendet",
      themeAppliedMessage: "{{name}} ist jetzt dein Gartenhintergrund."
    },
    expressionPacks: {
      poseCount: "3 POSEN",
      boardAccessibilityLabel: "{{name}}, Dreier-Posenpaket, {{price}}. {{status}}",
      creditGemAccessibilityLabel: "Credit-Preis",
      allOwned: "Alle 3 im Besitz",
      allPrice: "Alle 3 · {{credits}}",
      actionAccessibilityLabel: "{{action}} aus {{name}}",
      actions: {
        generate: "Alle 3 erstellen",
        retry: "Alle 3 erneut versuchen",
        needCredits: "Credits holen",
        making: "Posen entstehen...",
        owned: "Im Profil vorhanden"
      }
    },
    themes: {
      defaultName: "Gemütlicher Garten",
      defaultDescription: "Die ursprüngliche, immer kostenlose Kulisse des Gartens.",
      fairyName: "Feengarten",
      fairyDescription: "Eine leuchtende Feengartenkulisse für sanfte, verträumte Tage zu Hause.",
      seasideName: "Küstenbucht",
      seasideDescription: "Eine helle Küstenkulisse für luftige Spaziergänge.",
      autumnName: "Herbstwald",
      autumnDescription: "Warme Blätter und sanftes goldenes Licht für die saisonale Pflege.",
      winterName: "Winterlichter",
      winterDescription: "Eine verschneite Abendkulisse mit sanftem Festtagsleuchten."
    }
  },
  creditsStore: {
    accessibilityLabel: "Credit-Laden",
    title: "Credit-Laden",
    back: "Zurück zum Gartenladen",
    balanceAccessibilityLabel: "Aktueller Stand: {{credits}} Credits",
    heroTitle: "Entdecke mehr kleine Momente",
    heroBody: "Nutze Credits für Posenpakete, Themen und besondere Fürsorge.",
    starterTitle: "Geschenk für den ersten Freund · {{credits}}",
    starterBody: "Wird einmal gutgeschrieben, nachdem dein erster Freund eingezogen ist.",
    choosePack: "Credit-Paket wählen",
    popular: "BELIEBT",
    packAmount: "{{credits}} Credits",
    storePrice: "App-Store-Preis",
    purchaseAccessibilityLabel: "{{credits}} Credits kaufen",
    packs: {
      small: "Ein Paket zum Ausprobieren",
      popular: "Ideal für Posen und Themen",
      large: "Lange sammeln und gestalten"
    },
    actions: {
      buy: "Kaufen",
      purchasing: "Wird geprüft...",
      arriving: "Ist unterwegs...",
      preparing: "Store wird vorbereitet"
    },
    storeNotice: "Zahlungen laufen über den App Store. Nur bestätigte Credits werden gutgeschrieben.",
    dialogs: {
      failedTitle: "Kauf nicht abgeschlossen",
      failedBody: "Prüfe deine Verbindung und versuche es erneut.",
      successTitle: "Credits angekommen",
      successBody: "Bestätigte Credits wurden gutgeschrieben.",
      pendingTitle: "Gleich geschafft",
      pendingBody: "Dein Kauf wartet noch auf die Bestätigung des Stores. Sobald er bestätigt ist, kommen deine Credits an.",
      delayedTitle: "Credits sind unterwegs",
      delayedBody: "Dein Kauf war erfolgreich! Es kann etwas dauern, bis die Credits ankommen — schau gleich noch mal vorbei."
    }
  },
  inventory: {
    accessibilityLabel: "Inventar",
    title: "Inventar",
    back: "Zurück nach Hause",
    giveAccessibilityLabel: "{{name}} jetzt geben",
    giveHint: "Kehrt nach Hause zurück und öffnet die Auswahl für diesen Gegenstand",
    iconAccessibilityLabel: "Inventarsymbol für {{name}}",
    empty: "Hier ist noch nichts. Leckerlis und Spielzeug, die du sammelst, erscheinen in diesem Regal.",
    shop: "Shop"
  },
  settings: {
    accessibilityLabel: "Einstellungen und Datenschutzbereich von {{petName}}",
    title: "Einstellungen",
    back: "Zurück nach Hause",
    hero: "Wetter, Erinnerungen, Datenschutz und Hilfe an einem gemütlichen Ort.",
    language: {
      title: "App-Sprache",
      english: "Englisch",
      korean: "Koreanisch",
      detail: "Hier auswählen oder dem Gerät folgen.",
      action: "Ändern"
    },
    status: {
      needsCheck: "Prüfung erforderlich",
      syncing: "Wird synchronisiert",
      attention: "Datenschutzaktion benötigt Aufmerksamkeit",
      inProgress: "Datenschutzaktion läuft",
      errorDetail: "Die Änderung konnte nicht sicher abgeschlossen werden. Prüfe deine Verbindung und versuche es noch einmal.",
      keepOpen: "Lass die App geöffnet, bis die Änderung abgeschlossen ist."
    },
    sections: {
      reminders: "Kleine Erinnerungen",
      sound: "Klang & Gefühl",
      account: "Konto",
      privacy: "Datenschutz & Fürsorge",
      support: "Hilfe & Rechtliches"
    },
    notifications: {
      careReminders: "Pflegeerinnerungen",
      careRemindersDetail: "Sanfte Hinweise zu Futter, Wasser, kleinen Hallos und deinem Monatsbrief.",
      walkUpdates: "Spaziergangs-Updates",
      walkUpdatesDetail: "Ein kleiner Hinweis, wenn ein Spaziergang endet und dein Freund wieder da ist."
    },
    weather: {
      scenes: "Wetterszenen",
      useLocation: "Meinen Standort verwenden",
      useLocationDetail: "Dein ungefährer Standort wird einmal gesendet, um das echte lokale Wetter für den Garten abzurufen — nie gespeichert, nie geteilt.",
      preview: "Wettervorschau",
      next: "Als Nächstes: {{weather}}",
      locationMessages: {
        requesting: "Das echte lokale Wetter von heute wird für den Garten abgerufen.",
        ready: "Das Wetter vor Ort ist bereit.",
        denied: "Die Standortberechtigung wurde nicht erteilt. Du kannst das Wetter weiterhin manuell ansehen.",
        error: "Das Wetter vor Ort ist gerade nicht verfügbar. Nutze stattdessen eine manuelle Vorschau."
      },
      options: {
        clear: { label: "Klar", detail: "Standardmäßig sonniger Garten." },
        rain: {
          label: "Regen",
          detail: "Regenschicht und gemütliche Wetterzeilen."
        },
        snow: {
          label: "Schnee",
          detail: "Winterhintergrund und sanfte Zeilen für kalte Tage."
        },
        wind: {
          label: "Wind",
          detail: "Bewegte Blätter und Entdeckungen beim Spaziergang."
        },
        hot: {
          label: "Warm",
          detail: "Sonnige Szene und zusätzliche Hinweise zur Gartenpflege."
        }
      }
    },
    sound: {
      effects: "Klänge",
      effectsDetail: "Kleine Klänge und Tippgeräusche, begleitet von sanften Vibrationen.",
      music: "Musik & Atmosphäre",
      musicDetail: "Sanfte Gartenmusik und Hintergrundgeräusche wie Vogelstimmen oder Regen."
    },
    account: {
      linkTitle: "Mit Apple verknüpfen",
      linkDetail: "Schütze deinen Garten — dein Freund und eure Erinnerungen bleiben sicher, auch wenn du das Gerät wechselst.",
      linkAction: "Verbinden",
      linkActionInFlight: "Wird verbunden",
      recoverTitle: "Garten wiederherstellen",
      recoverDetail: "Hast du schon einmal einen Garten verknüpft? Hol ihn dir hier zurück.",
      recoverAction: "Wiederherstellen",
      recoverActionInFlight: "Wird wiederhergestellt",
      connectedTitle: "Mit Apple verknüpft",
      connectedDetail: "Dein Garten wird sicher aufbewahrt.",
      connectedEmailDetail: "Verknüpft als {{email}}",
      unavailableMessage: "Apple-Anmeldung ist auf diesem Gerät gerade nicht verfügbar.",
      alreadyLinkedMessage: "Diese Apple-ID ist bereits mit einem anderen Garten verknüpft. Nutze unten „Garten wiederherstellen“, um ihn hierher zu holen.",
      linkFailedMessage: "Deine Apple-ID konnte gerade nicht verbunden werden. Bitte versuche es gleich noch einmal.",
      recoverConfirmTitle: "Diesen Garten wiederherstellen?",
      recoverConfirmMessage: "Wenn du einen gespeicherten Garten wiederherstellst, ersetzt er den Garten auf diesem Gerät. Deinen jetzigen Freund verstauen wir währenddessen sicher. Fortfahren?",
      recoverFailedMessage: "Dein Garten konnte gerade nicht wiederhergestellt werden. Bitte versuche es gleich noch einmal.",
      recoveredMessage: "Dein Garten wurde wiederhergestellt.",
      recoveredNoSnapshotMessage: "Es wurde kein gespeicherter Garten gefunden, aber die Bilder und das Guthaben deines Freundes sind zurück."
    },
    privacy: {
      localPhoto: "Lokale Fotokopie",
      photoDeleted: "Von diesem Gerät gelöscht.",
      photoStored: "Eine Kopie wird nur auf diesem Gerät aufbewahrt.",
      photoNote: "Dein Foto wurde nur verwendet, um deinen Freund zu erschaffen, und gleich nach dem Einzug sicher verstaut.",
      chatHistory: "Chatverlauf",
      chatDeleted: "Für diese Sitzung gelöscht.",
      chatDetail: "Verwalte hier längere Gespräche.",
      backup: "Deinen Freund sichern",
      backupDetail: "Speichere eine Kopie deines Gartens, damit er nie nur auf diesem Gerät bleibt.",
      restore: "Aus Sicherung wiederherstellen",
      restoreDetail: "Füge eine gespeicherte Sicherung ein, um deinen Garten zurückzuholen."
    },
    links: { privacy: "Datenschutz", terms: "Bedingungen", support: "Hilfe" },
    reset: {
      title: "Zurücksetzen",
      detail: "Löscht die lokale Tiereinrichtung auf diesem Gerät und startet die Einführung neu.",
      action: "Tierdaten löschen"
    },
    dialogs: {
      errorLog: "Fehlerprotokoll",
      noErrors: "Auf diesem Gerät wurden in letzter Zeit keine Fehler protokolliert.",
      deletePhotoTitle: "Lokale Fotokopie löschen?",
      deletePhotoMessage: "Dadurch wird die auf diesem Gerät gespeicherte Fotokopie gelöscht. Dein Freund wurde bereits erschaffen und bleibt unverändert.",
      deleteChatTitle: "Chatverlauf löschen?",
      deleteChatMessage: "Dadurch wird der lokale Chatverlauf für diese Sitzung gelöscht. Kostenlose Pflegereaktionen bleiben unberührt.",
      backup: "Sicherung",
      backupFailed: "Gerade konnte keine Sicherung erstellt werden. Bitte versuche es noch einmal.",
      shareFailed: "Das Teilen-Menü konnte nicht geöffnet werden. Bitte versuche es noch einmal.",
      restore: "Aus Sicherung wiederherstellen",
      restoreFailed: "Diese Sicherung konnte nicht wiederhergestellt werden. Prüfe den gespeicherten Text und versuche es noch einmal.",
      pasteFirst: "Füge zuerst den Text deiner Sicherung ein.",
      restoreConfirmTitle: "Diese Sicherung wiederherstellen?",
      restoreConfirmMessage: "Dadurch wird dein aktueller Garten ersetzt. Zur Sicherheit wird dein jetziger Freund zuerst gesichert.",
      restoredTitle: "Willkommen zurück!",
      restoredMessage: "Dein Garten wurde aus der Sicherung wiederhergestellt.",
      accountLink: "Mit Apple verknüpfen",
      accountRecover: "Garten wiederherstellen",
      deleteAllTitle: "Alle deine Daten löschen?",
      deleteAllMessage:
        "Dadurch werden die Tiereinrichtung, das erstellte Tier, der Pflegestatus und das Inventar von diesem Gerät gelöscht. Außerdem bitten wir unsere Server, dein Foto, erstellte Avatare und Kontodaten zu löschen. Das lässt sich nicht rückgängig machen.",
      serverRetry: "Löschen auf dem Server erneut versuchen",
      serverRetryMessage:
        "Deine Gerätedaten sind gelöscht. Lass die App geöffnet und versuche es später erneut, damit auch die Serverkopie vollständig gelöscht werden kann."
    },
    restoreModal: {
      accessibilityLabel: "Aus Sicherung wiederherstellen",
      title: "Aus Sicherung wiederherstellen",
      hint: "Füge den zuvor gespeicherten Sicherungstext ein, etwa aus iCloud, Notizen oder einer E-Mail.",
      placeholder: "Sicherungs-JSON hier einfügen",
      inputAccessibilityLabel: "Sicherungstext"
    },
    dev: {
      fontTitle: "Entwicklung: Schriftpaar",
      fontDetail: "Vergleicht die beiden W2-Schriftpaare in der App. Wird in Produktionsversionen nicht angezeigt.",
      errorTitle: "Entwicklung: Fehlerprotokoll",
      errorCount: "{{count}} kürzlich auf diesem Gerät protokollierte Fehler.",
      shareLog: "Protokoll teilen",
      clearLog: "Protokoll leeren"
    }
  },
  notifications: {
    channel: {
      name: "Gartenneuigkeiten",
      description: "Sanfte Neuigkeiten aus deinem Garten"
    },
    walkReturn: {
      fallbackPetName: "Dein Liebling",
      title: "{{petName}} ist vom Spaziergang zurück!",
      body: "Schau nach, was {{petName}} unterwegs gefunden hat."
    },
    garden: {
      meal_due: {
        title: "{{petName}} denkt gerade ans Futterschälchen",
        body: "Eine kleine Mahlzeit würde die Sättigung wieder in den gemütlichen Bereich bringen."
      },
      meal_urgent: {
        title: "Im Napf von {{petName}} ist heute noch Platz",
        body: "Eine einfache Mahlzeit wäre jetzt eine schöne Freude für {{petName}}."
      },
      thirst_due: {
        title: "Der Wassernapf von {{petName}} könnte Nachschub vertragen",
        body: "Ein wenig frisches Wasser würde die kleine Laune gleich aufhellen."
      },
      thirst_hot_weather: {
        title: "{{petName}} könnte einen kühlen Schluck gebrauchen",
        body: "Heute ist die Luft warm. Ein Napf mit frischem Wasser ist jetzt die beste erste Fürsorge."
      },
      bored_play: {
        title: "{{petName}} hat das Spielzeug wiedergefunden",
        body: "Eine kurze Spielrunde wäre jetzt bestimmt schön."
      },
      attention_return: {
        title: "{{petName}} hat ein kleines Hallo für dich",
        body: "Öffne den Garten für eine kurze Streicheleinheit, ein Gespräch oder einen kleinen Besuch."
      },
      walk_window: {
        title: "Zeit für einen kleinen Weg",
        body: "{{petName}} würde sich heute vielleicht über einen ruhigen Spaziergang freuen."
      },
      rest_needed: {
        title: "{{petName}} ist im Schlafmodus",
        body: "Eine Ruhepause hält den Rhythmus heute Abend ganz sanft."
      },
      rainy_cozy_check: {
        title: "Kleiner Regentagsgruß",
        body: "{{petName}} macht es sich gemütlich. Ein Hallo würde gut zum Wetter passen."
      },
      return_after_1_day: {
        title: "An der Tür ist ein kleiner Pfotenabdruck aufgetaucht",
        body: "{{petName}} fragt sich schon, wann du wieder hereinschaust."
      },
      return_after_1_day_streak: {
        title: "{{petName}} hält eure kleine Routine gemütlich",
        body: "Deine Serie ist noch warm. Ein kurzer Besuch heute lässt sie weiterleuchten."
      },
      return_after_3_days: {
        title: "Der Garten hat dir einen Platz freigehalten",
        body: "Ein paar Tage sind vergangen. {{petName}} freut sich über ein kurzes Hallo, wenn du bereit bist."
      }
    },
    monthlyLetter: {
      fallbackPetName: "Dein Liebling",
      title: "Ein Brief wartet auf dich",
      body: "Ein Brief von {{petName}} wartet im Garten auf dich."
    }
  },
  errorBoundary: {
    fallbackPetName: "Dein Freund",
    title: "Da war ein kleiner Schluckauf",
    message: "{{petName}} geht es gut. Dieser Bildschirm braucht nur einen Neustart.",
    retry: "Erneut versuchen"
  },
  legal: {
    back: "Zurück zu den Einstellungen",
    privacy: {
      accessibilityLabel: "Datenschutzerklärung und KI-Hinweis",
      eyebrow: "Datenschutz",
      title: "Sicherheit für Fotos und Chats",
      updated: "Zuletzt aktualisiert am 8. Juli 2026 · v1.1",
      items: {
        first: "Kein Konto, keine E-Mail: Die App startet mit einer anonymen Sitzung statt mit einer Registrierung.",
        second:
          "Das Originalfoto deines Tieres wird nur für die Sicherheitsprüfung und Avatarerstellung an OpenAI gesendet. Sobald die Erstellung abgeschlossen ist, wird es automatisch von unseren Servern gelöscht.",
        third:
          "Wenn du später weitere Ausdrucksformen freischaltest, wird der bereits erstellte Avatar verwendet, nicht dein Originalfoto. Zu diesem Zeitpunkt ist es auf unseren Servern nicht mehr vorhanden.",
        fourth:
          "Erstellte Avatare liegen in einem privaten Speicherbereich und werden nur über kurzzeitig gültige, signierte Links angezeigt, niemals über eine öffentliche URL.",
        fifth:
          "Pflegewerte, Erinnerungen und Gartenfortschritt werden lokal auf deinem Gerät gespeichert. Wenn du die App deinstallierst, werden sie dauerhaft entfernt.",
        sixth: "Wenn du es erlaubst, wird dein ungefährer Standort gerundet und einmalig gesendet, um das echte lokale Wetter für den Garten abzurufen. Er wird nie gespeichert — und falls die Abfrage fehlschlägt, erzeugt dein Gerät selbst ein ähnliches Wettergefühl.",
        seventh: "Der Premium-Chat ist als KI-generiert gekennzeichnet und wird moderiert, bevor Nachrichten erscheinen.",
        eighth: "Es gibt keine Werbe- oder Tracking-SDKs. Analysen vermeiden Originalfotos, rohe Chattexte und Zahlungsdaten."
      },
      sections: {
        sharingTitle: "Dritte, mit denen wir Daten teilen",
        sharingBody:
          "OpenAI verarbeitet das Ausgangsfoto deines Tieres für Sicherheitsprüfungen und die Avatarerstellung sowie beim Premium-Chat das Profil deines Tieres und den jüngsten Gesprächskontext. Supabase hostet unsere Datenbank, den privaten Speicher und die anonyme Anmeldung. Apple oder Google wickelt In-App-Zahlungen direkt ab. Wir erhalten einen Beleg, niemals deine Kartendaten.",
        rightsTitle: "Deine Rechte",
        rightsBody:
          "Du kannst das Originalfoto separat löschen. Wähle für eine vollständige Löschung in den Einstellungen „Tierdaten löschen“. Dadurch werden lokale Daten gelöscht und unsere Server aufgefordert, das Foto, erstellte Avatare, das anonyme Konto und zugehörige Einträge zu entfernen. Wenn der Server nicht erreichbar ist, werden lokale Daten sofort gelöscht und die App bittet dich, den Serverschritt später erneut zu versuchen.",
        childrenTitle: "Kinder",
        childrenBody:
          "Mongchi richtet sich nicht an Kinder unter 13 Jahren. Wenn du glaubst, dass ein Kind über ein Foto oder einen Chat Informationen bereitgestellt hat, wende dich an den Support. Wir löschen diese Daten."
      },
      policyLink: "Link zur Datenschutzerklärung",
      policyFallback: "Sobald verfügbar, erscheint hier ein sicherer Link zur Datenschutzerklärung.",
      openPolicy: "Datenschutzerklärung öffnen",
      aiTitle: "KI-Hinweis",
      aiBody: "Dieses KI-generierte Gespräch richtet sich nach dem Profil deines Lieblings. Es ist nicht das Bewusstsein deines echten Tieres."
    },
    support: {
      accessibilityLabel: "Hilfe und Meldungen zur Erstellung",
      eyebrow: "Hilfe",
      title: "Hilfe und Meldungen",
      updated: "Zuletzt aktualisiert am 7. Juli 2026 · v1.0",
      website: {
        title: "Mongchi-Website",
        description: "Neuigkeiten und Hilfe findest du auf unserer Website.",
        action: "Website öffnen"
      },
      faqTitle: "Häufig gefragt",
      faq: {
        photoQuestion: "Ist das Foto meines Tieres sicher?",
        photoAnswer:
          "Dein Foto wird nur für eine Sicherheitsprüfung und die Avatarerstellung verwendet. Nach Abschluss der Erstellung wird es automatisch von unseren Servern gelöscht.",
        deleteQuestion: "Wie lösche ich meine Daten?",
        deleteAnswer:
          "Lösche das Originalfoto während des Fotoablaufs separat oder wähle in den Einstellungen „Tierdaten löschen“, um eine vollständige lokale Löschung und Serverlöschung anzufordern.",
        creditQuestion: "Was passiert mit meinen Credits, wenn die Erstellung fehlschlägt?",
        creditAnswer:
          "Ein Systemfehler oder eine fehlgeschlagene Sicherheits- oder Qualitätsprüfung sollte keinen bezahlten Credit kosten. Melde es unten, falls ein Credit zu Unrecht verbraucht wurde."
      },
      reportTitle: "Problem bei der Erstellung melden",
      reportDetail: "Problemmeldungen verwenden eine sichere Kategorie und senden keine Originalfotos über Analysen.",
      options: {
        wrong: {
          label: "Sieht anders aus",
          description: "Tierart, Zeichnung oder Gesicht wirken nicht richtig."
        },
        unsafe: {
          label: "Unangenehmes Aussehen",
          description: "Etwas wirkt unangenehm oder beängstigend."
        },
        quality: {
          label: "Unscharfes Ergebnis",
          description: "Das Tier ist schwer zu erkennen."
        }
      },
      report: "Melden",
      saved: "Gespeichert",
      lastReport: "Letzte Meldung: {{label}}",
      savedTitle: "Meldung gespeichert",
      savedMessage: "Es wurde nur die Problemkategorie gespeichert. Es wurden weder ein Originalfoto noch Chattexte angehängt.",
      feedback: {
        title: "Erzähl uns alles",
        prompt: "Erzähl uns alles – was sich komisch angefühlt hat oder was dich zum Lächeln gebracht hat.",
        messagePlaceholder: "Schreib einfach, was dir in den Sinn kommt …",
        messageAccessibilityLabel: "Feedback-Nachricht",
        contactPlaceholder: "Kontakt für eine Antwort (optional)",
        contactAccessibilityLabel: "Optionaler Kontakt für eine Antwort",
        send: "Feedback senden",
        savedTitle: "Danke dir",
        savedMessage: "Wir lesen jede Nachricht aufmerksam. Danke fürs Teilen."
      }
    },
    terms: {
      accessibilityLabel: "Bedingungen und bezahlte Werte",
      eyebrow: "Bedingungen",
      title: "Faire Nutzung und bezahlte Werte",
      updated: "Zuletzt aktualisiert am 7. Juli 2026 · v1.0",
      items: {
        first:
          "Mongchi ist KI-generierte Unterhaltung. Dein Gefährte und der Chat sind weder das Bewusstsein oder die Erinnerung deines echten Tieres noch eine medizinische Beratung.",
        second: "Beim Erstellen des ersten Lieblings behältst du die Kontrolle über dein ausgewähltes Foto und kannst es separat löschen.",
        third: "Fehlerhafte Erstellungen, Systemfehler und fehlgeschlagene Qualitätsprüfungen sollten keine bezahlten Werte verbrauchen.",
        fourth: "Die grundlegende Pflege bleibt kostenlos. Bezahlte Gegenstände sorgen für mehr Ausdruck, nicht für Erholung nach Vernachlässigung.",
        fifth: "Credits und bezahlte Gegenstände haben keinen Geldwert. Für Erstattungen gelten die Richtlinien des Shops, über den sie gekauft wurden.",
        sixth: "Erstellte Tiergespräche dürfen niemals behaupten, das Bewusstsein des echten Tieres zu sein."
      },
      sections: {
        useTitle: "Zulässige Nutzung",
        useBody:
          "Lade keine Fotos hoch, die Personen, explizite oder drastische Inhalte oder rechtswidrige Inhalte zeigen. Umgehe keine Erstellungslimits oder Sicherheitsprüfungen und versuche nicht, den Chat zu manipulieren.",
        portabilityTitle: "Keine Kontoübertragbarkeit",
        portabilityBody:
          "Mongchi verwendet keine klassischen Konten. Sitzungsdaten und lokale Spieldaten liegen auf deinem Gerät. Wenn du die App ohne Sicherung deinstallierst oder das Gerät wechselst, können lokaler Fortschritt, Erinnerungen und Credits dauerhaft verloren gehen.",
        disclaimerTitle: "Haftungsausschluss",
        disclaimerBody:
          "Mongchi wird im aktuellen Zustand bereitgestellt. KI-generierte Inhalte können trotz Sicherheits- und Qualitätsprüfungen gelegentlich ungenau sein oder nicht erstellt werden. Die vollständigen Einschränkungen findest du in den vollständigen Bedingungen."
      },
      linkTitle: "Link zu den Bedingungen",
      linkFallback: "Sobald verfügbar, erscheint hier ein sicherer Link zu den Bedingungen.",
      openTerms: "Bedingungen öffnen"
    }
  }
} satisfies DeepStringShape<typeof enUS>;
