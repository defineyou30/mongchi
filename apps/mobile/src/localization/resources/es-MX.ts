import type { enUS } from "./en-US";

type DeepStringShape<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : DeepStringShape<T[Key]>;
};

export const esMX = {
  common: {
    actions: {
      apply: "Aplicar",
      applied: "Aplicado",
      backHome: "Volver al inicio",
      cancel: "Cancelar",
      camera: "Cámara",
      checking: "Comprobando",
      change: "Cambiar",
      chooseAnotherPhoto: "Elegir otra foto",
      clear: "Borrar",
      cleared: "Borrado",
      continue: "Continuar",
      delete: "Eliminar",
      deleting: "Eliminando",
      enable: "Activar",
      export: "Exportar",
      next: "Siguiente",
      ok: "Aceptar",
      open: "Abrir",
      reportIssue: "Reportar un problema",
      restore: "Restaurar",
      restoring: "Restaurando",
      saved: "Guardado",
      seeProfile: "Ver perfil",
      share: "Compartir",
      shop: "Tienda",
      skip: "Omitir",
      tryAgain: "Intentar de nuevo",
      turnOff: "Desactivar",
      unlock: "Desbloquear",
      viewHome: "Ver inicio"
    }
  },
  languageSelector: {
    openAccessibilityLabel: "Elegir idioma de la aplicación",
    title: "Idioma",
    subtitle: "Usa el idioma del dispositivo o conserva uno para Mongchi.",
    automatic: "Automático",
    automaticDetail: "Usar el idioma del dispositivo · {{language}}",
    selected: "Seleccionado",
    saveError: "No se pudo guardar el idioma. Inténtalo de nuevo.",
    closeAccessibilityLabel: "Cerrar selector de idioma"
  },
  splash: {
    accessibilityLabel: "Pantalla de carga del pequeño hogar de tu mascota",
    logoAccessibilityLabel: "Logo de la aplicación Mongchi",
    animationAccessibilityLabel: "Animación de carga del pequeño mundo",
    opening: "Abriendo el pequeño hogar",
    warming: "Preparando una habitación acogedora"
  },
  welcome: {
    accessibilityLabel: "Bienvenida inicial de Mongchi",
    page: "Página de bienvenida {{current}} de {{total}}",
    skipAccessibilityLabel: "Omitir la bienvenida inicial",
    start: "Empezar con una foto",
    slides: {
      first: {
        step: "Paso 1",
        title: "Tu mascota, cerca cada día",
        body: "Convierte una foto favorita de tu mascota en un pequeño amigo que te espera en su jardín."
      },
      second: {
        step: "Paso 2",
        title: "Solo necesitas una foto",
        body: "Elige una foto clara de tu mascota y agrega su nombre y su tierna personalidad."
      },
      third: {
        step: "Paso 3",
        title: "Fortalezcan su vínculo cada día",
        body: "Dale de comer, juega, charla y vuelve cada día al acogedor jardín de tu mascota."
      }
    }
  },
  photoIntro: {
    accessibilityLabel: "Introducción a la foto de tu mascota",
    artAccessibilityLabel: "Una foto de una mascota que se abre hacia un pequeño hogar en el jardín",
    title: "Lleva a tu querida mascota siempre cerca",
    body: "Empieza con una foto clara de tu mascota, agrega su nombre y personalidad, y conoce al pequeño amigo que te espera en el jardín.",
    quest: {
      photo: "Foto",
      name: "Nombre",
      moveIn: "Mudanza"
    },
    privacy: "La foto de tu mascota solo se usa para crear a tu pequeño amigo. Puedes eliminar la original cuando termine su mudanza.",
    choosePhoto: "Elegir foto de la mascota"
  },
  photoUpload: {
    accessibilityLabel: "Carga de foto de la mascota",
    back: "Volver a la introducción de la foto",
    title: "Elige su mejor foto",
    artAccessibilityLabel: "Panel seguro para elegir la foto de tu mascota",
    changeSelected: "Cambiar la foto seleccionada de la mascota",
    choosePhoto: "Elegir foto de la mascota",
    selectedPreview: "Vista previa de la foto seleccionada de {{petName}}",
    selectedSamplePreview: "Vista previa de la foto de muestra seleccionada de {{petName}}",
    samplePreview: "Vista previa de la foto de muestra de la mascota",
    sampleSelected: "Foto de muestra seleccionada",
    photoSelected: "Foto de la mascota seleccionada",
    purpose: "Se usa para crear al pequeño amigo que vive en tu jardín.",
    library: "Galería de fotos",
    privacy: "Solo se usa para crear a tu pequeño amigo. Puedes eliminar la original después de su mudanza.",
    errors: {
      invalidTitle: "No se puede usar la foto",
      invalidType: "Elige una foto de tu mascota en formato JPEG, PNG o WebP.",
      tooLarge: "Elige una imagen de menos de 10 MB donde tu mascota se vea claramente.",
      libraryTitle: "Se necesita acceso a tus fotos",
      libraryMessage: "Elige una foto de tu mascota para que la aplicación pueda crear a tu pequeño amigo.",
      cameraTitle: "Se necesita acceso a la cámara",
      cameraMessage: "La cámara solo se usa cuando eliges tomar una foto de tu mascota."
    }
  },
  petSetup: {
    accessibilityLabel: "Configuración de la mascota",
    back: "Volver a la foto",
    artAccessibilityLabel: "Escritorio para la mudanza de la pequeña mascota, con placa de nombre y cama acogedora",
    eyebrow: "Papeles de mudanza",
    title: "Ponle nombre a tu pequeño amigo",
    summary: "{{species}} / {{voice}} · preparándose para la mudanza",
    speciesQuestion: "¿Quién se muda?",
    petName: "Nombre de la mascota",
    nameHint: "Este es el nombre con el que te recibirá en la puerta cada día.",
    personalityQuestion: "¿Cómo es la personalidad de tu amiguito?",
    voiceQuestion: "¿Cómo suena su vocecita?",
    favoriteQuestion: "¿Qué le encanta desde ahora?",
    favoriteThing: "Pequeña cosa favorita",
    memoryQuestion: "¿Algún pequeño recuerdo que quieras llevar contigo?",
    firstMemory: "Primer pequeño recuerdo",
    firstMemoryPlaceholder: "Un pequeño recuerdo con tu amiguito…",
    continueHint: "Elige un nombre, un ánimo y una voz para continuar.",
    species: { dog: "Perro", cat: "Gato" },
    personality: {
      playful: "Juguetón",
      calm: "Tranquilo",
      shy: "Tímido",
      curious: "Curioso",
      sleepy: "Dormilón",
      affectionate: "Cariñoso"
    },
    voice: {
      cute: "Tierna",
      gentle: "Dulce",
      cheerful: "Alegre",
      comforting: "Reconfortante"
    }
  },
  generation: {
    accessibilityLabel: "Proceso de mudanza de {{petName}}",
    back: "Volver a la configuración de la mascota",
    eyebrow: "Mudanza",
    titleReady: "{{petName}} está listo",
    titleMoving: "{{petName}} se está mudando",
    warmAccessibilityLabel: "Entibiar el huevito de {{petName}} con un toque suave",
    artAccessibilityLabel: "Escena mágica de la mudanza de {{petName}}",
    forming: "Tu pequeño amigo está tomando forma con los detalles de la foto.",
    favoriteFallback: "pequeñas cosas acogedoras",
    progressAccessibilityLabel: "Progreso de la mudanza",
    recapTitle: "Quién viene en camino",
    failureTitle: "Mudanza en pausa",
    quotaFailure: "Tu pequeño amigo pronto estará listo para mudarse. Vuelve en un ratito.",
    retryFailure: "La puertita se atoró. Intentemos crear a {{petName}} de nuevo.",
    safetyFailure: "No pudimos ayudar a tu mascota a mudarse con esta foto. Intenta con otra foto donde se vea claramente a tu mascota.",
    reveal: "Descubrir mascota",
    steps: {
      preparing: "Preparando la foto",
      details: "Buscando pequeños detalles",
      creating: "Creando a tu compañero",
      polishing: "Puliendo el pequeño mundo",
      movingIn: "Mudándose"
    },
    observations: {
      first: "Estudiando los colores del pelaje en tu foto...",
      second: "Dibujando con mucho cuidado la forma de las orejas de {{petName}}...",
      third: "Eligiendo uno por uno los píxeles más esponjosos...",
      fourth: "Practicando el primer saludo de {{petName}}...",
      fifth: "Midiendo el movimiento de colita perfecto...",
      sixth: "Enseñándole al sol dónde dormirá la siesta {{petName}}...",
      seventh: "Empacando pequeños recuerdos de {{favoriteThing}}...",
      eighth: "Puliendo sus ojitos brillantes hasta que resplandezcan..."
    },
    warmLines: {
      first: "Tu calor llegó al huevito. ¡Se movió un poquito!",
      second: "Ahora el huevito se siente más acogedor.",
      third: "Un pequeño latido te dio las gracias.",
      fourth: "Ya casi. Tu mano está ayudando."
    },
    statuses: {
      created: "Preparando el pequeño estudio.",
      queued: "Esperando un lugar libre para la mudanza.",
      claimed: "Abriendo el pequeño estudio.",
      validating: "Revisando los detalles de la foto.",
      preprocessing: "Preparando la foto.",
      safety_checking: "Comprobando que el pequeño amigo pueda mudarse con seguridad.",
      generating: "Creando al primer pequeño compañero.",
      postprocessing: "Suavizando el pelaje y los detalles finales.",
      quality_checking: "Revisando el aspecto final.",
      uploading_assets: "Preparando a la mascota para ir a casa.",
      cleanup_pending: "Ordenando la foto antes de la mudanza.",
      completed: "Listo para conocerte.",
      failed: "Mudanza en pausa.",
      cancelled: "La mudanza se detuvo.",
      expired: "Se agotó el tiempo de la mudanza."
    },
    teaser: {
      playful: "Alguien juguetón está empacando...",
      calm: "Alguien tranquilo está empacando...",
      shy: "Alguien un poquito tímido está empacando...",
      curious: "Alguien curioso está empacando...",
      sleepy: "Alguien dormilón está empacando...",
      affectionate: "Alguien muy cariñoso está empacando...",
      fallback: "Alguien muy cariñoso está empacando..."
    },
    guidance: "Mantén una conexión estable. Si se interrumpe la aplicación, esta misma mudanza continuará cuando regreses."
  },
  reveal: {
    accessibilityLabel: "Presentación de {{petName}}",
    back: "Volver a la mudanza",
    artAccessibilityLabel: "Celebración alegre de la presentación de {{petName}}",
    eyebrow: "Presentación de la mascota",
    title: "Conoce a {{petName}}",
    enter: "Entrar al jardín",
    shareAccessibilityLabel: "Compartir a {{petName}}",
    notRight: "¿No quedó del todo bien?",
    shareMessages: {
      first: "Conoce a {{petName}}, mi nuevo pequeño amigo del jardín. Creado con Mongchi.",
      second: "{{petName}} acaba de mudarse a un pequeño jardín de píxeles. Creado con Mongchi."
    }
  },
  home: {
    localeAccessibilityLabel: "Pequeño hogar jugable de {{petName}} en el jardín",
    hud: {
      accessibilityLabel: "Estado del juego en el pequeño jardín",
      labels: {
        fullness: "Saciado",
        thirst: "Agua",
        mood: "Ánimo",
        energy: "Energía",
        cleanliness: "Limpio"
      },
      meterAccessibilityLabel: "Estado de {{label}}. Toca para ver los detalles.",
      artAccessibilityLabel: "Ilustración del estado de {{label}}"
    },
    rail: {
      openShop: "Abrir la tienda",
      shopArt: "Ilustración del botón de la tienda",
      openChat: "Abrir el chat de {{petName}}",
      chatArt: "Ilustración del botón de chat",
      openFriend: "Abrir el perfil de {{petName}}",
      friendArt: "Ilustración del botón de amistad",
      letterWaiting: "{{label}}. Hay una carta nueva esperando.",
      openSettings: "Abrir configuración",
      settingsArt: "Ilustración del botón de configuración"
    },
    pet: {
      accessibilityLabel: "Acariciar a {{petName}}",
      longPressHint: "Mantén presionado para abrir el perfil de {{petName}}",
      avatarAccessibilityLabel: "Avatar generado de la mascota",
      finishMessageHint: "Toca para mostrar ahora el mensaje completo.",
      walkingPaws: "Huellitas de {{petName}} al caminar"
    },
    butterflyAccessibilityLabel: "Una mariposita vino de visita. Toca para saludarla.",
    care: {
      actions: {
        feed: "Alimentar",
        talk: "Hablar",
        walk: "Pasear",
        play: "Jugar",
        rest: "Descansar",
        affection: "Acariciar",
        water_garden: "Regar",
        clean: "Limpiar",
        treat: "Premio"
      },
      iconAccessibilityLabel: "Ícono de cuidado: {{label}}",
      itemAccessibilityLabel: "Artículo de cuidado: {{label}}",
      feedCooldown: "Menú de comida. Tiempo de espera de la comida diaria: {{cooldown}}. Quizá aún haya premios disponibles.",
      feedMenu: "Menú de comida para {{petName}}.",
      walkActive: "El paseo está activo. {{petName}} vuelve en {{seconds}} segundos.",
      optionCooldown: "Menú de {{label}}. Tiempo de espera de la opción básica: {{cooldown}}. Quizá aún haya artículos especiales disponibles.",
      recommended: "Recomendado: {{label}} a {{petName}}. {{hint}}",
      actionAccessibilityLabel: "{{label}} a {{petName}}",
      tray: {
        titles: {
          affection: "Impulsores del vínculo",
          feed: "Comida y premios",
          play: "Opciones de juego",
          walk: "Opciones de ruta",
          water_garden: "Agua"
        },
        optionsAccessibilityLabel: "Opciones de {{title}}",
        shopOption: "Abrir la tienda para {{title}}.",
        cooldownOption: "{{title}} estará disponible en {{cooldown}}.",
        useOption: "Usar {{title}} con {{petName}}.",
        openShop: "Abrir la tienda de artículos de cuidado.",
        shop: "Tienda"
      },
      options: {
        pet: "Caricias",
        meal: "Comida",
        ball: "Pelota",
        path: "Ruta",
        water: "Agua",
        bath: "Baño",
        treat: "Premio"
      },
      meta: {
        bond: "+Vínculo",
        fullness: "+Saciedad",
        mood: "+Ánimo",
        thirst: "+Hidratación",
        fresh: "+Frescura",
        shop: "Tienda"
      }
    },
    walk: {
      activeTitle: "{{petName}} está de paseo · vuelve en {{time}}",
      activeSubcopy: "Puedes cerrar la aplicación; te avisaremos cuando vuelva {{petName}}.",
      bringHomeAccessibilityLabel: "Gastar {{cost}} crédito para traer a {{petName}} a casa ahora",
      cannotBringHomeAccessibilityLabel: "No hay créditos suficientes para traer a {{petName}} a casa ahora",
      coinAccessibilityLabel: "Moneda",
      openCreditStoreAccessibilityLabel: "Abrir la tienda de créditos",
      commentary: {
        early: "{{petName}} sigue un aroma muy importante...",
        mid: "{{petName}} se detuvo a saludar una hoja.",
        late: "¡{{petName}} encontró algo y lo lleva a casa!"
      },
      bringHome: "Traer a casa ahora · {{cost}}",
      openCreditStore: "Conseguir créditos",
      insufficientHint: "Consigue créditos o espera a que vuelva {{petName}}.",
      waiting: "{{petName}} volverá pronto. Espera un poquito.",
      returned: "¡{{petName}} volvió con un regalito!",
      claimAccessibilityLabel: "Recibir a {{petName}} y reclamar el regalo del paseo",
      claim: "Recibir y reclamar"
    },
    guide: {
      tryAction: "Prueba primero “{{action}}”; a {{petName}} le encantará.",
      chooseAction: "Elige una pequeña acción de cuidado para {{petName}}.",
      closeAccessibilityLabel: "Cerrar la guía de indicadores",
      accessibilityLabel: "Guía de indicadores",
      gotIt: "Entendido"
    },
    originalPhotoDeleted: "Se eliminó la foto original de esta sesión.",
    welcome: {
      accessibilityLabel: "Te damos la bienvenida a tu pequeño jardín",
      title: "Te damos la bienvenida al pequeño jardín de {{petName}}",
      body: "{{petName}} ahora vive aquí y cuenta contigo para sus pequeños momentos de cuidado.",
      care: "Dale de comer, agua, juega y acarícialo para mantener altos sus indicadores.",
      speech: "El globo de diálogo te dice qué necesita {{petName}} en este momento.",
      streak: "Vuelve cada día para aumentar tu racha de cuidados.",
      action: "Empezar a cuidar"
    },
    notificationPrePermission: {
      title: "¿Quieres recibir noticias de {{petName}}?",
      body: "Solo un avisito discreto cuando te extrañe, como máximo una vez al día.",
      accept: "Suena bien",
      decline: "Tal vez después"
    }
  },
  chat: {
    screenAccessibilityLabel: "Chat de {{petName}}",
    screenReaderTitle: "Chatear con {{petName}}",
    back: "Volver al inicio",
    petAccessibilityLabel: "Mascota en el chat",
    petSays: "{{petName}} dice: {{text}}",
    finishMessageHint: "Toca para mostrar el mensaje completo de inmediato",
    opening: "Abriendo una charla acogedora...",
    unavailableTitle: "La charla larga está descansando",
    unavailableDetail: "Las charlas breves y todas las reacciones de cuidado siguen disponibles durante la revisión de seguridad.",
    unavailableInput: "La charla larga aún no está disponible",
    networkError: "No pudimos conectarnos al chat. Inténtalo de nuevo.",
    startersAccessibilityLabel: "Ideas para iniciar la conversación",
    starterAccessibilityLabel: "Usar esta idea: {{starter}}",
    inputAccessibilityLabel: "Mensaje del chat Plus",
    inputPlaceholder: "Escríbele a {{petName}}",
    sendAccessibilityLabel: "Enviar mensaje del chat Plus",
    disclosure: "Esta conversación fue generada por IA a partir del perfil de tu mascota. No es la conciencia de tu mascota real.",
    disclosureBanner: {
      dismissAccessibilityLabel: "Cerrar aviso de IA"
    },
    info: {
      button: "Sobre esta charla",
      title: "Sobre esta charla",
      aiTitle: "Charla generada por IA",
      billingTitle: "Charlas y créditos",
      billingBody: "Las charlas incluidas y los créditos se verifican de forma segura en el momento en que envías tu mensaje. Cuando se acaben las charlas gratis de hoy, un Day Pass o créditos pueden mantener la conversación.",
      close: "Entendido"
    },
    report: {
      button: "Reportar esta respuesta de IA",
      reported: "Esta respuesta de IA ya fue reportada",
      title: "Reportar esta respuesta",
      detail: "Elige el motivo más cercano. Solo guardamos la referencia del mensaje y el motivo para revisarlo.",
      reasons: {
        harmful: "Dañina o insegura",
        inappropriate: "Inapropiada",
        inaccurate: "Incorrecta o engañosa",
        other: "Otro problema"
      },
      cancel: "Cerrar reporte",
      sending: "Enviando reporte...",
      success: "Gracias. Esta respuesta fue enviada a revisión.",
      error: "No pudimos enviar el reporte. Inténtalo de nuevo."
    },
    history: {
      accessibilityLabel: "Historial de conversaciones con {{petName}}",
      user: "Tú",
      notice: "Aviso",
      empty: "Tu conversación acogedora empieza aquí.",
      notSent: "Aún no se ha enviado.",
      retryAccessibilityLabel: "Volver a intentar enviar el mensaje",
      retry: "Reintentar",
      typing: "{{petName}} está escribiendo..."
    },
    deterministicErrors: {
      emptyMessage: "Primero escribe un mensaje corto.",
      locked: "Usa un boleto, un crédito o un pase Plus para seguir chateando.",
      session: "No pudimos iniciar tu acogedora sesión de chat. Inténtalo de nuevo.",
      history: "Aún no pudimos cargar este chat. Inténtalo de nuevo.",
      credits: "Ya no tienes créditos para este chat. Puede haber más charlas acogedoras cuando quieras.",
      rateLimited: "La conversación necesita una pequeña pausa. Inténtalo de nuevo pronto.",
      rejected: "No se pudo enviar ese mensaje. Prueba con otro mensaje corto.",
      unavailable: "El chat está descansando un momento. Inténtalo de nuevo."
    }
  },
  friend: {
    accessibilityLabel: "Perfil de {{petName}}",
    back: "Volver al inicio",
    share: "Compartir a {{petName}}",
    movedIn: { today: "Se mudó hoy", daysAgo: "Se mudó hace {{count}} días" },
    stats: {
      bond: "Vínculo",
      streak: "Racha",
      together: "Juntos",
      bondAccessibilityLabel: "Progreso del vínculo hacia el nivel {{level}}: {{label}}"
    },
    sections: {
      lately: "Últimamente, {{petName}}...",
      walkFinds: "Hallazgos del paseo",
      moments: "Nuestros pequeños momentos",
      letter: "Carta de {{petName}}",
      memoryNote: "Nota de recuerdo"
    },
    walkFindAccessibilityLabel: "{{name}}, encontrado {{count}} veces",
    undiscoveredWalkFind: "Hallazgo de paseo sin descubrir",
    letter: {
      giftAccessibilityLabel: "La carta de {{petName}} está envuelta como regalo y lista para abrirse",
      openAccessibilityLabel: "Abrir la carta del primer mes de {{petName}}",
      open: "Abrir",
      checking: "Buscando la carta de hoy..."
    },
    pose: {
      accessibilityLabel: "Pose {{pose}} de {{petName}}",
      collectionAccessibilityLabel: "Poses de {{petName}}",
      position: "Pose {{current}} de {{total}} · {{pose}}",
      moreAccessibilityLabel: "Ver más paquetes de tres poses en la tienda de Momentos",
      more: "Ver más poses",
      labels: { everyday: "Cotidiana", happy: "Feliz", sleepy: "Dormilona" },
      sleepLockedHint: "Vuelve de noche para descubrir la pose dormidita."
    },
    shareMessages: {
      days: "{{petName}} ha sido mi pequeño amigo del jardín durante {{count}} días. Creado con Mongchi.",
      fallback: "Conoce a {{petName}}, mi pequeño amigo del jardín. Creado con Mongchi."
    },
    shareCard: {
      title: "Personalizar y compartir",
      subtitle: "Elige una pose y un fondo que tus amigos van a amar.",
      poseSectionTitle: "Pose",
      themeSectionTitle: "Fondo",
      poseOptionAccessibilityLabel: "Pose {{pose}}",
      themeOptionAccessibilityLabel: "Fondo {{theme}}",
      selected: "Seleccionado",
      previewAccessibilityLabel: "Vista previa de la tarjeta para compartir de {{petName}}",
      closeAccessibilityLabel: "Cerrar personalización de la tarjeta",
      shareAccessibilityLabel: "Compartir la tarjeta de {{petName}}"
    }
  },
  shop: {
    accessibilityLabel: "Tienda del jardín",
    title: "Tienda",
    back: "Volver al inicio",
    walletAccessibilityLabel: "Cartera de la tienda: {{credits}} créditos y {{owned}} artículos del conjunto en propiedad",
    creditGemAccessibilityLabel: "Ícono de crédito de la tienda",
    openCreditStore: "Abrir la tienda de créditos",
    categories: {
      all: "Todo",
      treats: "Premios",
      drinks: "Bebidas",
      toys: "Juguetes",
      rest: "Descanso",
      moments: "Momentos",
      themes: "Temas"
    },
    tabs: {
      care: "Premios y juguetes",
      customize: "Poses y temas"
    },
    sections: {
      careItems: "Premios, bebidas y juguetes",
      careItemsDescription: "Elige pequeñas recompensas, juguetes y objetos acogedores.",
      posePacks: "Packs de poses",
      posePacksDescription: "Desbloquea tres expresiones y poses a juego en cada pack.",
      themes: "Temas del jardín",
      themesDescription: "Cambia por completo el ambiente del hogar de tu compañero."
    },
    careFiltersAccessibilityLabel: "Filtros de artículos de cuidado",
    customizeFiltersAccessibilityLabel: "Filtros de personalización",
    categoryAccessibilityLabel: "{{label}}, {{count}} artículos",
    emptyPreview: "Aquí aparecerán nuevos artículos acogedores cuando llenemos este estante.",
    emptyShelf: "Estamos llenando este estante.",
    comingSoon: "Próximamente",
    soon: "Pronto",
    owned: "Adquirido",
    ownedQuantity: "Tienes x{{count}}",
    devOpen: "Abrir en desarrollo",
    available: "Disponible",
    locked: "Bloqueado",
    creditsNeeded: "Faltan {{count}} créditos",
    backgroundPreview: "Vista previa del fondo {{name}}",
    largePreview: "Vista previa grande de {{name}}",
    backgroundThumbnail: "Miniatura del fondo {{name}}",
    itemIcon: "Ícono de {{name}}",
    pricesAccessibilityLabel: "Se aceptan precios en créditos y monedas",
    walletGemAccessibilityLabel: "Precio en créditos",
    coinAccessibilityLabel: "Moneda",
    gemPriceAccessibilityLabel: "Precio en créditos",
    actions: {
      unlockTheme: "Desbloquear tema",
      applyTheme: "Aplicar tema",
      getItem: "Comprar",
      unlockPack: "Desbloquear paquete",
      topUpCredits: "Recargar créditos"
    },
    grants: {
      consumable: "Crédito",
      durable: "Adquisición permanente",
      subscription: "Suscripción"
    },
    products: {
      premiumChat: {
        name: "Chat mensual Plus",
        description: "Charlas más largas y cálidas mientras el pase Plus esté activo."
      },
      extraPetSlot: {
        name: "Espacio extra para mascota",
        description: "Haz lugar para un perfil más de pequeña mascota."
      },
      regenerationCredit: {
        name: "Crédito de regeneración",
        description: "Un nuevo intento de avatar cuando quieras un aspecto fresco."
      },
      starterTheme: {
        name: "Paquete de tema inicial",
        description: "Un fondo renovado para el pequeño hogar."
      },
      itemPack: {
        name: "Paquete de artículos",
        description: "Una selección especial de premios y juguetes."
      },
      treatPack: {
        name: "Paquete de premios",
        description: "Bocaditos especiales para momentos de reacciones tiernas."
      },
      plusPass: {
        name: "Pase Plus",
        description: "Ventajas especiales para el vínculo, con charlas más largas y futuras funciones Plus."
      }
    },
    actionAccessibility: {
      unlockTheme: "Desbloquear {{name}} por {{price}}",
      themeLocked: "{{name}} está bloqueado",
      applyTheme: "Aplicar {{name}}",
      themeApplied: "{{name}} está aplicado",
      buy: "Comprar {{name}}",
      topUpCredits: "Recargar créditos para {{name}}"
    },
    summary: {
      accessibilityLabel: "{{owned}} artículos del conjunto en propiedad y {{locked}} artículos bloqueados en la tienda",
      owned: "Conjunto adquirido",
      locked: "{{count}} artículos bloqueados en la tienda"
    },
    dialogs: {
      checkout: "Finalizar compra",
      checkoutFailed: "No pudimos iniciar la compra en este momento. Inténtalo de nuevo.",
      shop: "Tienda",
      shopFailed: "No pudimos agregar ese artículo en este momento. Inténtalo de nuevo.",
      itemAdded: "Artículo agregado",
      itemAddedMessage: "Tu nuevo artículo te espera en el inventario.",
      posePack: "Paquete de poses",
      posePackFailed: "No pudimos iniciar ese paquete de poses en este momento. Inténtalo de nuevo.",
      posesOnWay: "Tres poses vienen en camino",
      posesOnWayMessage: "Las tres nuevas poses de tu compañero se están creando juntas.",
      theme: "Tema",
      themeFailed: "No pudimos cambiar ese tema en este momento. Inténtalo de nuevo.",
      makeover: "¡Nuevo aspecto para el jardín!",
      themeApplied: "Tema aplicado",
      themeAppliedMessage: "{{name}} ahora es el fondo de tu jardín."
    },
    expressionPacks: {
      poseCount: "3 POSES",
      boardAccessibilityLabel: "{{name}}, paquete de tres poses, {{price}}. {{status}}",
      creditGemAccessibilityLabel: "Precio en créditos",
      allOwned: "Las 3 adquiridas",
      allPrice: "Las 3 · {{credits}}",
      actionAccessibilityLabel: "{{action}} de {{name}}",
      actions: {
        generate: "Generar las 3",
        retry: "Reintentar las 3",
        needCredits: "Obtener créditos",
        making: "Creando poses...",
        owned: "Adquiridas en el perfil"
      }
    },
    themes: {
      defaultName: "Jardín acogedor",
      defaultDescription: "El fondo original del jardín, siempre gratis.",
      fairyName: "Jardín de hadas",
      fairyDescription: "Un jardín de hadas brillante para días tranquilos y de ensueño en casa.",
      seasideName: "Cala marina",
      seasideDescription: "Un fondo costero luminoso para paseos con brisa.",
      autumnName: "Bosque otoñal",
      autumnDescription: "Hojas cálidas y una suave luz dorada para los cuidados de temporada.",
      winterName: "Luces de invierno",
      winterDescription: "Un fondo de tarde nevada con un suave brillo festivo."
    }
  },
  creditsStore: {
    accessibilityLabel: "Tienda de créditos",
    title: "Tienda de créditos",
    back: "Volver a la tienda del jardín",
    balanceAccessibilityLabel: "Saldo actual: {{credits}} créditos",
    heroTitle: "Descubre más pequeños momentos",
    heroBody: "Usa créditos para paquetes de poses, temas y cuidados especiales.",
    starterTitle: "Regalo del primer amigo · {{credits}}",
    starterBody: "Se agrega una sola vez cuando tu primer compañero termina de mudarse.",
    choosePack: "Elige un paquete de créditos",
    popular: "POPULAR",
    packAmount: "{{credits}} créditos",
    storePrice: "Precio de App Store",
    purchaseAccessibilityLabel: "Comprar {{credits}} créditos",
    packs: {
      small: "Prueba abriendo un paquete",
      popular: "Ideal para poses y temas",
      large: "Colecciona y decora por más tiempo"
    },
    actions: {
      buy: "Comprar",
      purchasing: "Verificando...",
      arriving: "En camino...",
      preparing: "Tienda en preparación"
    },
    storeNotice: "Los pagos se procesan en App Store. Solo los créditos verificados se agregan al saldo.",
    dialogs: {
      failedTitle: "Compra no completada",
      failedBody: "Revisa tu conexión e inténtalo de nuevo.",
      successTitle: "Llegaron tus créditos",
      successBody: "Los créditos verificados se agregaron a tu saldo.",
      pendingTitle: "Ya casi",
      pendingBody: "Tu compra está esperando la confirmación de la tienda. Los créditos llegarán en cuanto se apruebe.",
      delayedTitle: "Tus créditos están en camino",
      delayedBody: "¡Tu compra se completó! Los créditos pueden tardar un poco más en aparecer — vuelve a revisar en un momento."
    }
  },
  inventory: {
    accessibilityLabel: "Inventario",
    title: "Inventario",
    back: "Volver al inicio",
    giveAccessibilityLabel: "Dar {{name}} ahora",
    giveHint: "Vuelve al hogar y abre la bandeja de este artículo",
    iconAccessibilityLabel: "Ícono de inventario de {{name}}",
    empty: "Aún no hay nada aquí; los premios y juguetes que consigas aparecerán en este estante.",
    shop: "Tienda"
  },
  settings: {
    accessibilityLabel: "Configuración y espacio de privacidad de {{petName}}",
    title: "Configuración",
    back: "Volver al inicio",
    hero: "Clima, recordatorios, privacidad y ayuda, todo en un mismo lugar acogedor.",
    language: {
      title: "Idioma de la aplicación",
      english: "Inglés",
      korean: "Coreano",
      detail: "Elige aquí o usa el idioma del dispositivo.",
      action: "Cambiar"
    },
    status: {
      needsCheck: "Necesita revisión",
      syncing: "Sincronizando",
      attention: "Una acción de privacidad necesita atención",
      inProgress: "Acción de privacidad en curso",
      errorDetail: "El cambio no pudo completarse de forma segura. Revisa tu conexión e inténtalo de nuevo.",
      keepOpen: "Mantén la aplicación abierta mientras termina el cambio."
    },
    sections: {
      reminders: "Pequeños recordatorios",
      sound: "Sonido y sensación",
      account: "Cuenta",
      privacy: "Privacidad y cuidado",
      support: "Ayuda y asuntos legales"
    },
    notifications: {
      careReminders: "Recordatorios de cuidado",
      careRemindersDetail: "Avisos suaves sobre comidas, agua, saluditos y tu carta mensual.",
      walkUpdates: "Novedades del paseo",
      walkUpdatesDetail: "Un aviso breve cuando termina el paseo y tu amigo ya está en casa."
    },
    weather: {
      scenes: "Escenas del clima",
      useLocation: "Usar mi ubicación",
      useLocationDetail: "Tu ubicación aproximada se envía una sola vez para consultar el clima local real del jardín — nunca se guarda, nunca se comparte.",
      preview: "Vista previa del clima",
      next: "Siguiente: {{weather}}",
      locationMessages: {
        requesting: "Consultando el clima local real de hoy para el jardín.",
        ready: "El clima local está listo.",
        denied: "No se otorgó permiso de ubicación. Aún puedes probar el clima manualmente.",
        error: "El clima local no está disponible en este momento. Prueba una vista previa manual."
      },
      options: {
        clear: { label: "Despejado", detail: "Jardín soleado predeterminado." },
        rain: {
          label: "Lluvia",
          detail: "Efecto de lluvia y frases acogedoras sobre el clima."
        },
        snow: {
          label: "Nieve",
          detail: "Fondo invernal y frases suaves sobre el frío."
        },
        wind: {
          label: "Viento",
          detail: "Movimiento de hojas y descubrimientos en el paseo."
        },
        hot: {
          label: "Cálido",
          detail: "Escena soleada y más sugerencias para cuidar el jardín."
        }
      }
    },
    sound: {
      effects: "Sonidos",
      effectsDetail: "Pequeñas campanitas y toques, acompañados de vibraciones suaves.",
      music: "Música y ambiente",
      musicDetail: "Música suave de jardín y sonidos de fondo, como el canto de aves o la lluvia."
    },
    account: {
      linkTitle: "Vincular con Apple",
      linkDetail: "Protege tu jardín — tu amigo y sus recuerdos siguen seguros, aunque cambies de teléfono.",
      linkAction: "Conectar",
      linkActionInFlight: "Conectando",
      recoverTitle: "Recuperar un jardín",
      recoverDetail: "¿Ya vinculaste un jardín antes? Tráelo de vuelta aquí.",
      recoverAction: "Recuperar",
      recoverActionInFlight: "Recuperando",
      connectedTitle: "Vinculado con Apple",
      connectedDetail: "Tu jardín se guarda de forma segura.",
      connectedEmailDetail: "Vinculado como {{email}}",
      unavailableMessage: "El inicio de sesión con Apple no está disponible en este dispositivo por ahora.",
      alreadyLinkedMessage: "Este ID de Apple ya está vinculado a otro jardín. Usa \"Recuperar un jardín\" abajo para traerlo aquí.",
      linkFailedMessage: "No pudimos vincular tu ID de Apple en este momento. Inténtalo de nuevo en un rato.",
      recoverConfirmTitle: "¿Recuperar este jardín?",
      recoverConfirmMessage: "Si recuperas un jardín guardado, reemplazará el jardín de este teléfono. Antes, guardaremos con cariño a tu amigo actual. ¿Quieres continuar?",
      recoverFailedMessage: "No pudimos recuperar tu jardín en este momento. Inténtalo de nuevo en un rato.",
      recoveredMessage: "Tu jardín se recuperó.",
      recoveredNoSnapshotMessage: "No encontramos un jardín guardado, pero los dibujos y créditos de tu amigo ya están de vuelta."
    },
    privacy: {
      localPhoto: "Copia local de la foto",
      photoDeleted: "Eliminada de este dispositivo.",
      photoStored: "Se guarda una copia solo en este dispositivo.",
      photoNote: "Tu foto solo se usó para crear a tu amigo y quedó bien guardada justo después de la mudanza.",
      chatHistory: "Historial de chat",
      chatDeleted: "Eliminado para esta sesión.",
      chatDetail: "Administra aquí las conversaciones más largas.",
      backup: "Respaldar a tu amigo",
      backupDetail: "Guarda una copia de tu jardín para que nunca exista solo en este dispositivo.",
      restore: "Restaurar desde un respaldo",
      restoreDetail: "Pega un respaldo guardado para recuperar tu jardín."
    },
    links: { privacy: "Privacidad", terms: "Términos", support: "Ayuda" },
    reset: {
      title: "Restablecer",
      detail: "Elimina la configuración local de la mascota en este dispositivo y vuelve a iniciar la bienvenida.",
      action: "Eliminar datos de la mascota"
    },
    dialogs: {
      errorLog: "Registro de errores",
      noErrors: "No hay errores recientes registrados en este dispositivo.",
      deletePhotoTitle: "¿Eliminar la copia local de la foto?",
      deletePhotoMessage: "Esto borra la copia de la foto guardada en este dispositivo. Tu amigo ya fue creado; nada en él cambiará.",
      deleteChatTitle: "¿Eliminar el historial de chat?",
      deleteChatMessage: "Esto borra el historial de chat local de esta sesión. No afecta las reacciones de cuidado gratuitas.",
      backup: "Respaldo",
      backupFailed: "No pudimos preparar un respaldo en este momento. Inténtalo de nuevo.",
      shareFailed: "No pudimos abrir las opciones para compartir. Inténtalo de nuevo.",
      restore: "Restaurar desde un respaldo",
      restoreFailed: "No se pudo restaurar ese respaldo. Revisa el texto guardado e inténtalo de nuevo.",
      pasteFirst: "Primero pega el texto de tu respaldo.",
      restoreConfirmTitle: "¿Restaurar este respaldo?",
      restoreConfirmMessage: "Esto reemplazará tu jardín actual. Primero respaldaremos a tu amigo actual, por si acaso.",
      restoredTitle: "¡Qué gusto tenerte de vuelta!",
      restoredMessage: "Tu jardín se restauró desde el respaldo.",
      accountLink: "Vincular con Apple",
      accountRecover: "Recuperar un jardín",
      deleteAllTitle: "¿Eliminar todos tus datos?",
      deleteAllMessage:
        "Esto elimina de este dispositivo la configuración de la mascota, la mascota generada, el estado de sus cuidados y el inventario. También solicita a nuestros servidores que eliminen tu foto, los avatares generados y los datos de la cuenta. Esta acción no se puede deshacer.",
      serverRetry: "Hay que reintentar la eliminación del servidor",
      serverRetryMessage:
        "Los datos de tu dispositivo ya se borraron. Mantén la aplicación abierta e inténtalo de nuevo más tarde para completar también la eliminación de la copia del servidor."
    },
    restoreModal: {
      accessibilityLabel: "Restaurar desde un respaldo",
      title: "Restaurar desde un respaldo",
      hint: "Pega el texto del respaldo que guardaste antes, ya sea en iCloud, Notas o un correo electrónico.",
      placeholder: "Pega aquí el JSON de tu respaldo",
      inputAccessibilityLabel: "Texto del respaldo"
    },
    dev: {
      fontTitle: "Desarrollo: combinación de fuentes",
      fontDetail: "Compara las dos combinaciones de fuentes W2 en toda la aplicación. No aparece en las versiones de producción.",
      errorTitle: "Desarrollo: registro de errores",
      errorCount: "{{count}} errores recientes registrados en este dispositivo.",
      shareLog: "Compartir registro",
      clearLog: "Borrar registro"
    }
  },
  notifications: {
    channel: {
      name: "Novedades del jardín",
      description: "Novedades amables sobre tu jardín"
    },
    walkReturn: {
      fallbackPetName: "Tu mascota",
      title: "¡{{petName}} volvió del paseo!",
      body: "Ven a ver qué encontró {{petName}} por ahí."
    },
    garden: {
      meal_due: {
        title: "{{petName}} está pensando en su platito",
        body: "Una pequeña comida le devolvería una saciedad agradable."
      },
      meal_urgent: {
        title: "Hoy queda espacio en el platito de {{petName}}",
        body: "Una comida básica sería un lindo premio para {{petName}} ahora mismo."
      },
      thirst_due: {
        title: "Al platito de agua de {{petName}} le vendría bien un poco más",
        body: "Darle agua alegraría un poquito su ánimo."
      },
      thirst_hot_weather: {
        title: "A {{petName}} le vendría bien un traguito fresco",
        body: "Hoy se siente caluroso. Un platito con agua fresca es el mejor primer cuidado."
      },
      bored_play: {
        title: "{{petName}} volvió a encontrar el juguete",
        body: "Un ratito de juego suena divertido ahora mismo."
      },
      attention_return: {
        title: "{{petName}} tiene un saludito preparado",
        body: "Abre el jardín para darle una caricia, hablarle o ver cómo está."
      },
      walk_window: {
        title: "Hora del pequeño sendero",
        body: "Quizá {{petName}} disfrute hoy un paseo tranquilo."
      },
      rest_needed: {
        title: "{{petName}} está en modo dormilón",
        body: "Un descanso mantendrá un ritmo tranquilo esta noche."
      },
      rainy_cozy_check: {
        title: "Un pequeño saludo bajo la lluvia",
        body: "{{petName}} está muy a gusto. Un saludo le quedaría perfecto a este clima."
      },
      return_after_1_day: {
        title: "Apareció una huellita junto a la puerta",
        body: "{{petName}} se preguntaba cuándo volverías a pasar por aquí."
      },
      return_after_1_day_streak: {
        title: "{{petName}} mantiene acogedora su pequeña rutina",
        body: "Tu racha sigue calientita. Una visita rápida hoy mantendrá su brillo."
      },
      return_after_3_days: {
        title: "El jardín guardó un lugar para ti",
        body: "Han pasado unos días. A {{petName}} le encantará recibir un saludito cuando quieras."
      }
    },
    monthlyLetter: {
      fallbackPetName: "Tu mascota",
      title: "Una carta te espera",
      body: "Una carta de {{petName}} te espera en el jardín."
    }
  },
  errorBoundary: {
    fallbackPetName: "Tu amigo",
    title: "Hubo un pequeño tropiezo",
    message: "{{petName}} está bien. Esta pantalla solo necesita empezar de nuevo.",
    retry: "Intentar de nuevo"
  },
  legal: {
    back: "Volver a configuración",
    privacy: {
      accessibilityLabel: "Política de privacidad y aviso sobre IA",
      eyebrow: "Privacidad",
      title: "Seguridad de fotos y chats",
      updated: "Última actualización: 8 de julio de 2026 · v1.1",
      items: {
        first: "Sin cuenta ni correo electrónico: la aplicación se abre con una sesión anónima, no con un registro.",
        second:
          "La foto original de tu mascota se envía a OpenAI solo para realizar una revisión de seguridad y generar el avatar. Después, se elimina automáticamente de nuestros servidores en cuanto termina la generación.",
        third:
          "Al desbloquear más expresiones después, se reutiliza la ilustración del avatar ya generado, no la foto original, pues para entonces ya no existe en nuestros servidores.",
        fourth:
          "Los avatares generados se guardan en un depósito privado y solo se muestran mediante enlaces firmados de corta duración, nunca con una URL pública.",
        fifth:
          "Las estadísticas de cuidado, los recuerdos y el progreso del jardín se guardan localmente en tu dispositivo, por lo que desinstalar la aplicación los elimina de forma permanente.",
        sixth: "Si lo permites, tu ubicación aproximada se redondea y se envía una sola vez para consultar el clima local real del jardín. Nunca se guarda, y si la consulta falla, tu dispositivo crea un ambiente de clima parecido por su cuenta.",
        seventh: "El chat de pago se identifica como generado por IA y se modera antes de mostrar los mensajes.",
        eighth:
          "No usamos kits de desarrollo para anuncios o rastreo, y los análisis evitan las fotos originales, el texto original del chat y los datos de pago."
      },
      sections: {
        sharingTitle: "Terceros con quienes compartimos datos",
        sharingBody:
          "OpenAI procesa la foto original de tu mascota para las revisiones de seguridad y la generación del avatar. Para el chat de pago, procesa el perfil de tu mascota y el contexto reciente de la conversación. Supabase aloja nuestra base de datos, almacenamiento privado y autenticación anónima. Apple o Google gestionan directamente los pagos dentro de la aplicación; nosotros recibimos un comprobante, nunca los datos de tu tarjeta.",
        rightsTitle: "Tus derechos",
        rightsBody:
          "Puedes eliminar la foto original por separado. Para borrar todo, elige Eliminar datos de la mascota en Configuración. Esto borra los datos locales y solicita a nuestros servidores que eliminen la foto, los avatares generados, la cuenta anónima y los registros relacionados. Si no se puede contactar al servidor, los datos locales se borran de inmediato y la aplicación te pide reintentar más tarde el paso del servidor.",
        childrenTitle: "Menores",
        childrenBody:
          "Mongchi no está dirigido a menores de 13 años. Si crees que un menor proporcionó información mediante una foto o un chat, comunícate con el equipo de ayuda y la eliminaremos."
      },
      policyLink: "Enlace a la política",
      policyFallback: "Aquí aparecerá un enlace seguro a la política de privacidad cuando esté disponible.",
      openPolicy: "Abrir política",
      aiTitle: "Aviso sobre IA",
      aiBody: "Esta conversación fue generada por IA a partir del perfil de tu mascota. No es la conciencia de tu mascota real."
    },
    support: {
      accessibilityLabel: "Ayuda y reportes de generación",
      eyebrow: "Ayuda",
      title: "Ayuda y reportes",
      updated: "Última actualización: 7 de julio de 2026 · v1.0",
      website: {
        title: "Sitio web de Mongchi",
        description: "Encuentra noticias y ayuda en nuestro sitio web.",
        action: "Abrir sitio web"
      },
      faqTitle: "Preguntas frecuentes",
      faq: {
        photoQuestion: "¿Está segura la foto de mi mascota?",
        photoAnswer:
          "Tu foto solo se usa para una revisión de seguridad y para generar el avatar. Se elimina automáticamente de nuestros servidores cuando termina la generación.",
        deleteQuestion: "¿Cómo elimino mis datos?",
        deleteAnswer:
          "Elimina la foto original por separado durante el proceso de la foto, o usa Eliminar datos de la mascota en Configuración para solicitar la eliminación completa de los datos locales y del servidor.",
        creditQuestion: "¿Qué pasa con mis créditos si falla la generación?",
        creditAnswer:
          "Una falla del sistema, de seguridad o de la revisión de calidad no debería consumir un crédito pagado. Repórtala abajo si parece que se usó un crédito de manera injusta."
      },
      reportTitle: "Reportar un problema de generación",
      reportDetail: "Los reportes usan una categoría segura y evitan enviar fotos originales a través de los análisis.",
      options: {
        wrong: {
          label: "No se parece",
          description: "La especie, las marcas o la cara no se ven bien."
        },
        unsafe: {
          label: "Aspecto inquietante",
          description: "Algo resulta incómodo o da miedo."
        },
        quality: {
          label: "Resultado borroso",
          description: "Es difícil reconocer a la mascota."
        }
      },
      report: "Reportar",
      saved: "Guardado",
      lastReport: "Último reporte: {{label}}",
      savedTitle: "Reporte guardado",
      savedMessage: "Solo se guardó la categoría del problema. No se adjuntaron la foto original ni el texto del chat.",
      feedback: {
        title: "Cuéntanos lo que sea",
        prompt: "Cuéntanos lo que sea — qué se sintió raro, o qué te sacó una sonrisa.",
        messagePlaceholder: "Escribe lo que se te ocurra…",
        messageAccessibilityLabel: "Mensaje de comentarios",
        contactPlaceholder: "Un contacto si quieres que te respondamos (opcional)",
        contactAccessibilityLabel: "Contacto opcional para una respuesta",
        send: "Enviar comentarios",
        savedTitle: "Gracias",
        savedMessage: "Leemos cada mensaje con cariño. Gracias por compartirlo."
      }
    },
    terms: {
      accessibilityLabel: "Términos y valor pagado",
      eyebrow: "Términos",
      title: "Uso justo y valor pagado",
      updated: "Última actualización: 7 de julio de 2026 · v1.0",
      items: {
        first:
          "Mongchi es entretenimiento generado por IA; tu compañero y el chat no son la conciencia ni la memoria de tu mascota real, ni ofrecen asesoría médica.",
        second: "El proceso de la primera mascota mantiene la foto seleccionada bajo tu control y te permite eliminarla por separado.",
        third: "Las generaciones defectuosas, las fallas del sistema y las revisiones de calidad no deberían consumir beneficios pagados.",
        fourth: "Los cuidados básicos siguen siendo gratis. Los artículos de pago añaden expresión y no sustituyen los cuidados cotidianos.",
        fifth: "Los créditos y artículos de pago no tienen valor en efectivo; los reembolsos siguen la política de la tienda donde se realizó la compra.",
        sixth: "Las conversaciones generadas de la mascota nunca deben afirmar que son la conciencia de la mascota real."
      },
      sections: {
        useTitle: "Uso aceptable",
        useBody:
          "No subas fotos que contengan personas, contenido explícito o gráfico, ni nada ilegal. No evadas los límites de generación o las revisiones de seguridad, ni intentes vulnerar el chat.",
        portabilityTitle: "Sin portabilidad de cuenta",
        portabilityBody:
          "Mongchi no usa cuentas tradicionales. Los datos de la sesión y del juego local viven en tu dispositivo, así que desinstalar la aplicación o cambiar de dispositivo sin un respaldo puede causar la pérdida permanente del progreso local, los recuerdos y los créditos.",
        disclaimerTitle: "Descargo de responsabilidad",
        disclaimerBody:
          "Mongchi se proporciona tal cual. El contenido generado por IA puede ser inexacto o fallar de vez en cuando, incluso con revisiones de seguridad y calidad. Consulta los términos completos para conocer todas las limitaciones."
      },
      linkTitle: "Enlace a los términos",
      linkFallback: "Aquí aparecerá un enlace seguro a los términos cuando esté disponible.",
      openTerms: "Abrir términos"
    }
  }
} satisfies DeepStringShape<typeof enUS>;
