import type { enUS } from "./en-US";

type DeepStringShape<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : DeepStringShape<T[Key]>;
};

export const ptBR = {
  common: {
    actions: {
      apply: "Aplicar",
      applied: "Aplicado",
      backHome: "Voltar ao início",
      cancel: "Cancelar",
      camera: "Câmera",
      checking: "Verificando",
      change: "Alterar",
      chooseAnotherPhoto: "Escolher outra foto",
      clear: "Limpar",
      cleared: "Limpo",
      continue: "Continuar",
      delete: "Excluir",
      deleting: "Excluindo",
      enable: "Ativar",
      export: "Exportar",
      next: "Avançar",
      ok: "OK",
      open: "Abrir",
      reportIssue: "Relatar problema",
      restore: "Restaurar",
      restoring: "Restaurando",
      saved: "Salvo",
      seeProfile: "Ver perfil",
      share: "Compartilhar",
      shop: "Loja",
      skip: "Pular",
      tryAgain: "Tentar de novo",
      turnOff: "Desativar",
      unlock: "Desbloquear",
      viewHome: "Ver início"
    }
  },
  languageSelector: {
    openAccessibilityLabel: "Escolher idioma do app",
    title: "Idioma",
    subtitle: "Siga o idioma do aparelho ou mantenha o Mongchi em um idioma.",
    automatic: "Automático",
    automaticDetail: "Seguir este aparelho · {{language}}",
    selected: "Selecionado",
    saveError: "Não foi possível salvar o idioma. Tente novamente.",
    closeAccessibilityLabel: "Fechar seletor de idioma"
  },
  splash: {
    accessibilityLabel: "Tela de carregamento do lar do bichinho",
    logoAccessibilityLabel: "Logo do app Mongchi",
    animationAccessibilityLabel: "Animação de carregamento do pequeno mundo",
    opening: "Abrindo o pequeno lar",
    warming: "Aquecendo o cantinho aconchegante"
  },
  welcome: {
    accessibilityLabel: "Boas-vindas ao Mongchi",
    page: "Página de boas-vindas {{current}} de {{total}}",
    skipAccessibilityLabel: "Pular as boas-vindas",
    start: "Começar com uma foto",
    slides: {
      first: {
        step: "Etapa 1",
        title: "Seu bichinho pertinho todos os dias",
        body: "Transforme uma foto favorita do seu bichinho em um amiguinho que espera por você no jardim."
      },
      second: {
        step: "Etapa 2",
        title: "Uma foto é tudo o que você precisa",
        body: "Escolha uma foto nítida do seu bichinho e adicione o nome e um pouco da personalidade dele."
      },
      third: {
        step: "Etapa 3",
        title: "Fortaleça esse laço todo dia",
        body: "Alimente, brinque, converse e volte ao jardim aconchegante do seu bichinho todos os dias."
      }
    }
  },
  photoIntro: {
    accessibilityLabel: "Introdução à foto do bichinho",
    artAccessibilityLabel: "Foto de um bichinho se abrindo para um pequeno lar no jardim",
    title: "Tenha seu bichinho amado sempre por perto",
    body: "Comece com uma foto nítida do seu bichinho, adicione o nome e a personalidade e conheça o amiguinho que espera por você no jardim.",
    quest: {
      photo: "Foto",
      name: "Nome",
      moveIn: "Chegada"
    },
    privacy: "A foto do seu bichinho só é usada para criar seu amiguinho. Você pode excluir a original quando ele chegar.",
    choosePhoto: "Escolher foto do bichinho"
  },
  photoUpload: {
    accessibilityLabel: "Envio da foto do bichinho",
    back: "Voltar à introdução da foto",
    title: "Escolha a melhor foto dele",
    artAccessibilityLabel: "Painel seguro para escolher a foto do bichinho",
    changeSelected: "Trocar a foto selecionada do bichinho",
    choosePhoto: "Escolher foto do bichinho",
    selectedPreview: "Prévia da foto selecionada de {{petName}}",
    selectedSamplePreview: "Prévia da foto de exemplo selecionada de {{petName}}",
    samplePreview: "Prévia da foto de exemplo do bichinho",
    sampleSelected: "Foto de exemplo selecionada",
    photoSelected: "Foto do bichinho selecionada",
    purpose: "Usada para criar o amiguinho que vai morar no seu jardim.",
    library: "Galeria de fotos",
    sampleAction: "Sem foto por perto? Conheça um amiguinho de exemplo",
    sampleAccessibilityLabel: "Conhecer um amiguinho de exemplo",
    privacy: "Usada apenas para criar seu amiguinho. Você pode excluir a original depois que ele chegar.",
    errors: {
      invalidTitle: "Esta foto não pode ser usada",
      invalidType: "Escolha uma foto do bichinho em JPEG, PNG ou WebP.",
      tooLarge: "Escolha uma imagem de até 10 MB em que seu bichinho apareça com nitidez.",
      libraryTitle: "Acesso às fotos necessário",
      libraryMessage: "Escolha uma foto do bichinho para o app criar seu amiguinho.",
      cameraTitle: "Acesso à câmera necessário",
      cameraMessage: "A câmera só é acessada quando você decide tirar uma foto do bichinho."
    }
  },
  petSetup: {
    accessibilityLabel: "Configuração do bichinho",
    back: "Voltar à foto",
    artAccessibilityLabel: "Mesinha de chegada do bichinho com plaquinha de nome e cama aconchegante",
    eyebrow: "Papéis da chegada",
    title: "Dê um nome ao seu amiguinho",
    summary: "{{species}} / {{voice}} · preparando a chegada",
    speciesQuestion: "Quem está chegando?",
    petName: "Nome do bichinho",
    nameHint: "Este é o nome que vai receber você na porta todos os dias.",
    personalityQuestion: "Como é a personalidade do seu companheiro?",
    voiceQuestion: "Como é a vozinha dele?",
    favoriteQuestion: "Do que ele já gosta?",
    favoriteThing: "Coisinha favorita",
    memoryQuestion: "Alguma lembrança especial para levar com ele?",
    firstMemory: "Primeira lembrança",
    firstMemoryPlaceholder: "Uma pequena lembrança com seu companheiro…",
    continueHint: "Escolha um nome, um jeitinho e uma voz para continuar.",
    species: { dog: "Cão", cat: "Gato" },
    personality: {
      playful: "Brincalhão",
      calm: "Calmo",
      shy: "Tímido",
      curious: "Curioso",
      sleepy: "Sonolento",
      affectionate: "Carinhoso"
    },
    voice: {
      cute: "Fofa",
      gentle: "Meiga",
      cheerful: "Alegre",
      comforting: "Acolhedora"
    }
  },
  generation: {
    accessibilityLabel: "Chegada de {{petName}}",
    back: "Voltar à configuração do bichinho",
    eyebrow: "Chegando",
    titleReady: "{{petName}} está pronto",
    titleMoving: "{{petName}} está chegando",
    warmAccessibilityLabel: "Aquecer o ovo de {{petName}} com um toque suave",
    artAccessibilityLabel: "Cena mágica da chegada de {{petName}}",
    forming: "Seu amiguinho está ganhando forma com os detalhes da foto.",
    favoriteFallback: "coisinhas aconchegantes",
    progressAccessibilityLabel: "Progresso da chegada",
    recapTitle: "Quem está a caminho",
    failureTitle: "Chegada pausada",
    quotaFailure: "Seu amiguinho estará pronto para chegar em breve. Volte daqui a pouquinho.",
    retryFailure: "A portinha emperrou. Vamos tentar criar {{petName}} de novo.",
    reveal: "Conhecer bichinho",
    steps: {
      preparing: "Preparando a foto",
      details: "Encontrando pequenos detalhes",
      creating: "Criando o companheiro",
      polishing: "Caprichando no pequeno mundo",
      movingIn: "Chegando"
    },
    observations: {
      first: "Observando as cores do pelo na sua foto...",
      second: "Desenhando com todo cuidado as orelhas de {{petName}}...",
      third: "Escolhendo os pixels mais fofinhos, um por um...",
      fourth: "Ensaiando o primeiro oi de {{petName}}...",
      fifth: "Medindo o balanço de cauda perfeito...",
      sixth: "Ensinando ao sol onde {{petName}} vai cochilar...",
      seventh: "Guardando pequenas lembranças de {{favoriteThing}}...",
      eighth: "Lustrando os olhinhos brilhantes até cintilarem..."
    },
    warmLines: {
      first: "Seu carinho chegou ao ovo. Ele se mexeu um pouquinho!",
      second: "O ovo está mais aconchegante agora.",
      third: "Um pequeno coração bateu em agradecimento.",
      fourth: "Quase lá. Sua mão está ajudando."
    },
    statuses: {
      created: "Aquecendo o pequeno ateliê.",
      queued: "Esperando um espacinho livre para a chegada.",
      claimed: "Abrindo o pequeno ateliê.",
      validating: "Verificando os detalhes da foto.",
      preprocessing: "Preparando a foto.",
      safety_checking: "Garantindo que o amiguinho possa chegar em segurança.",
      generating: "Criando o primeiro pequeno companheiro.",
      postprocessing: "Suavizando o pelo e os detalhes finais.",
      quality_checking: "Conferindo o visual final.",
      uploading_assets: "Preparando o bichinho para ir para casa.",
      cleanup_pending: "Organizando a foto antes da chegada.",
      completed: "Pronto para conhecer você.",
      failed: "Chegada pausada.",
      cancelled: "A chegada foi interrompida.",
      expired: "O tempo da chegada se esgotou."
    },
    teaser: {
      playful: "Alguém brincalhão está arrumando as malas...",
      calm: "Alguém calmo está arrumando as malas...",
      shy: "Alguém um pouquinho tímido está arrumando as malas...",
      curious: "Alguém curioso está arrumando as malas...",
      sleepy: "Alguém sonolento está arrumando as malas...",
      affectionate: "Alguém carinhoso está arrumando as malas...",
      fallback: "Alguém carinhoso está arrumando as malas..."
    },
    guidance: "Mantenha uma conexão estável. Se o app for interrompido, a chegada continuará daqui quando você voltar."
  },
  reveal: {
    accessibilityLabel: "Apresentação de {{petName}}",
    back: "Voltar à chegada",
    artAccessibilityLabel: "Comemoração alegre da apresentação de {{petName}}",
    plaque: "Novo amiguinho",
    eyebrow: "Apresentação do bichinho",
    title: "Conheça {{petName}}",
    enter: "Entrar no jardim",
    shareAccessibilityLabel: "Compartilhar {{petName}}",
    notRight: "Não ficou bem assim?",
    shareMessages: {
      first: "Conheça {{petName}}, meu novo amiguinho do jardim. Feito com Mongchi.",
      second: "{{petName}} acabou de chegar a um pequeno jardim de pixels. Feito com Mongchi."
    }
  },
  home: {
    localeAccessibilityLabel: "Pequeno lar interativo de {{petName}} no jardim",
    hud: {
      accessibilityLabel: "Estado do jogo no pequeno jardim",
      labels: {
        fullness: "Saciedade",
        thirst: "Água",
        mood: "Humor",
        energy: "Energia",
        cleanliness: "Limpeza"
      },
      meterAccessibilityLabel: "Estado de {{label}}. Toque para ver detalhes.",
      artAccessibilityLabel: "Arte do estado de {{label}}"
    },
    rail: {
      openShop: "Abrir loja",
      shopArt: "Arte do botão da loja",
      openChat: "Abrir a conversa de {{petName}}",
      chatArt: "Arte do botão de conversa",
      openFriend: "Abrir a página de amizade de {{petName}}",
      friendArt: "Arte do botão de amizade",
      letterWaiting: "{{label}}. Uma nova cartinha está esperando.",
      openSettings: "Abrir ajustes",
      settingsArt: "Arte do botão de ajustes"
    },
    pet: {
      accessibilityLabel: "Fazer carinho em {{petName}}",
      longPressHint: "Mantenha pressionado para abrir a página de amizade de {{petName}}",
      avatarAccessibilityLabel: "Avatar gerado do bichinho",
      finishMessageHint: "Toque para mostrar a mensagem inteira agora.",
      walkingPaws: "Pegadinhas de {{petName}} caminhando"
    },
    butterflyAccessibilityLabel: "Uma borboletinha veio visitar. Toque para dizer oi.",
    care: {
      actions: {
        feed: "Alimentar",
        talk: "Conversar",
        walk: "Passear",
        play: "Brincar",
        rest: "Descansar",
        affection: "Acariciar",
        water_garden: "Dar água",
        clean: "Limpar",
        treat: "Petisco"
      },
      iconAccessibilityLabel: "Ícone de cuidado: {{label}}",
      itemAccessibilityLabel: "Item de cuidado: {{label}}",
      feedCooldown: "Menu de alimentação. Refeição diária disponível em {{cooldown}}. Talvez ainda haja petiscos.",
      feedMenu: "Menu de alimentação de {{petName}}.",
      walkActive: "O passeio está em andamento. {{petName}} volta em {{seconds}} segundos.",
      optionCooldown: "Menu de {{label}}. Opção básica disponível em {{cooldown}}. Talvez ainda haja itens especiais.",
      recommended: "Recomendado: {{label}} com {{petName}}. {{hint}}",
      actionAccessibilityLabel: "{{label}} com {{petName}}",
      tray: {
        titles: {
          affection: "Carinho e vínculo",
          feed: "Comida e petiscos",
          play: "Opções de brincadeira",
          walk: "Opções de caminho",
          water_garden: "Água"
        },
        optionsAccessibilityLabel: "Opções de {{title}}",
        shopOption: "Abrir a loja de {{title}}.",
        cooldownOption: "{{title}} estará disponível em {{cooldown}}.",
        useOption: "Usar {{title}} com {{petName}}.",
        openShop: "Abrir a loja de itens de cuidado.",
        shop: "Loja"
      },
      options: {
        pet: "Carinho",
        meal: "Refeição",
        ball: "Bola",
        path: "Caminho",
        water: "Água",
        bath: "Banho",
        treat: "Petisco"
      },
      meta: {
        bond: "+Vínculo",
        fullness: "+Saciedade",
        mood: "+Humor",
        thirst: "+Sede",
        fresh: "+Frescor",
        shop: "Loja"
      }
    },
    walk: {
      activeTitle: "{{petName}} está passeando · volta em {{time}}",
      activeSubcopy: "Pode fechar o app — avisaremos quando {{petName}} voltar.",
      bringHomeAccessibilityLabel: "Gastar {{cost}} crédito para trazer {{petName}} para casa agora",
      cannotBringHomeAccessibilityLabel: "Créditos insuficientes para trazer {{petName}} para casa agora",
      coinAccessibilityLabel: "Moeda",
      openCreditStoreAccessibilityLabel: "Abrir loja de gemas",
      commentary: {
        early: "{{petName}} está seguindo um cheiro muito importante...",
        mid: "{{petName}} parou para cumprimentar uma folha.",
        late: "{{petName}} encontrou algo e está trazendo para casa!"
      },
      bringHome: "Trazer para casa agora · {{cost}}",
      openCreditStore: "Obter gemas",
      insufficientHint: "Obtenha gemas ou espere {{petName}} voltar.",
      waiting: "{{petName}} volta logo — só mais um pouquinho.",
      returned: "{{petName}} voltou com um presentinho!",
      claimAccessibilityLabel: "Receber {{petName}} e pegar o presente do passeio",
      claim: "Receber e pegar"
    },
    guide: {
      tryAction: "Experimente “{{action}}” primeiro — {{petName}} vai adorar.",
      chooseAction: "Escolha um pequeno cuidado para {{petName}}.",
      closeAccessibilityLabel: "Fechar guia dos medidores",
      accessibilityLabel: "Guia dos medidores",
      gotIt: "Entendi"
    },
    originalPhotoDeleted: "Foto original excluída desta sessão.",
    welcome: {
      accessibilityLabel: "Boas-vindas ao seu pequeno jardim",
      title: "Boas-vindas ao pequeno jardim de {{petName}}",
      body: "{{petName}} mora aqui agora e conta com você para pequenos momentos de cuidado.",
      care: "Alimente, dê água, brinque e faça carinho para manter os medidores cheios.",
      speech: "O balão de fala mostra do que {{petName}} precisa agora.",
      streak: "Volte todos os dias para aumentar sua sequência de cuidados.",
      action: "Começar a cuidar"
    }
  },
  chat: {
    screenAccessibilityLabel: "Conversa de {{petName}}",
    screenReaderTitle: "Conversar com {{petName}}",
    back: "Voltar ao início",
    petAccessibilityLabel: "Bichinho na conversa",
    petSays: "{{petName}} diz: {{text}}",
    finishMessageHint: "Toque para mostrar a mensagem inteira agora",
    opening: "Abrindo uma conversa aconchegante...",
    unavailableTitle: "A conversa longa está descansando",
    unavailableDetail: "Papos rápidos e todas as reações de cuidado continuam disponíveis durante a revisão de segurança.",
    unavailableInput: "A conversa longa ainda não está disponível",
    networkError: "Não foi possível acessar a conversa agora. Tente de novo.",
    startersAccessibilityLabel: "Sugestões para começar a conversa",
    starterAccessibilityLabel: "Usar sugestão: {{starter}}",
    inputAccessibilityLabel: "Mensagem da conversa premium",
    inputPlaceholder: "Mensagem para {{petName}}",
    sendAccessibilityLabel: "Enviar mensagem da conversa premium",
    disclosure: "Esta conversa é gerada por IA com base no perfil do seu bichinho. Ela não é a consciência real dele.",
    disclosureBanner: {
      dismissAccessibilityLabel: "Fechar aviso sobre IA"
    },
    info: {
      button: "Sobre esta conversa",
      title: "Sobre esta conversa",
      aiTitle: "Conversa gerada por IA",
      billingTitle: "Conversas e créditos",
      billingBody: "As conversas incluídas e os créditos são verificados com segurança assim que você envia. Quando as conversas grátis de hoje acabarem, um Day Pass ou créditos podem manter o papo continuando.",
      close: "Entendi"
    },
    report: {
      button: "Denunciar esta resposta da IA",
      reported: "Esta resposta da IA foi denunciada",
      title: "Denunciar esta resposta",
      detail: "Escolha o motivo mais próximo. Salvamos apenas a referência da mensagem e o motivo para análise.",
      reasons: {
        harmful: "Prejudicial ou insegura",
        inappropriate: "Inadequada",
        inaccurate: "Incorreta ou enganosa",
        other: "Outro problema"
      },
      cancel: "Fechar denúncia",
      sending: "Enviando denúncia...",
      success: "Obrigado. Esta resposta foi enviada para análise.",
      error: "Não foi possível enviar a denúncia. Tente de novo."
    },
    history: {
      accessibilityLabel: "Histórico de conversa com {{petName}}",
      user: "Você",
      notice: "Aviso",
      empty: "Sua conversa aconchegante começa aqui.",
      notSent: "Ainda não enviada.",
      retryAccessibilityLabel: "Tentar enviar a mensagem de novo",
      retry: "Tentar de novo",
      typing: "{{petName}} está digitando..."
    },
    deterministicErrors: {
      emptyMessage: "Escreva uma mensagem curtinha primeiro.",
      locked: "Use um ingresso, crédito ou passe Plus para continuar a conversa.",
      session: "Não foi possível iniciar sua conversa aconchegante. Tente de novo.",
      history: "Ainda não foi possível carregar esta conversa. Tente de novo.",
      credits: "Seus créditos para esta conversa acabaram. Mais papos aconchegantes podem esperar até você querer voltar.",
      rateLimited: "A conversa precisa de uma pequena pausa. Tente novamente em breve.",
      rejected: "Não foi possível enviar essa mensagem. Tente outra mensagem curtinha.",
      unavailable: "A conversa está descansando um pouquinho. Tente de novo."
    }
  },
  friend: {
    accessibilityLabel: "Página de amizade de {{petName}}",
    back: "Voltar ao início",
    share: "Compartilhar {{petName}}",
    movedIn: { today: "Chegou hoje", daysAgo: "Chegou há {{count}} dias" },
    stats: {
      bond: "Vínculo",
      streak: "Sequência",
      together: "Juntos",
      bondAccessibilityLabel: "Progresso do vínculo até o nível {{level}}: {{label}}"
    },
    sections: {
      lately: "Ultimamente, {{petName}}...",
      walkFinds: "Achados do passeio",
      moments: "Nossos pequenos momentos",
      letter: "Carta de {{petName}}",
      memoryNote: "Nota de lembrança"
    },
    walkFindAccessibilityLabel: "{{name}}, encontrado {{count}} vezes",
    undiscoveredWalkFind: "Achado do passeio ainda não descoberto",
    letter: {
      giftAccessibilityLabel: "A carta de {{petName}} está embrulhada como presente, pronta para abrir",
      openAccessibilityLabel: "Abrir a carta de um mês de {{petName}}",
      open: "Abrir",
      checking: "Procurando a carta de hoje..."
    },
    pose: {
      accessibilityLabel: "Pose {{pose}} de {{petName}}",
      collectionAccessibilityLabel: "Poses de {{petName}}",
      position: "Pose {{current}} de {{total}} · {{pose}}",
      moreAccessibilityLabel: "Ver mais pacotes de três poses na loja de Momentos",
      more: "Ver mais poses",
      labels: { everyday: "Dia a dia", happy: "Feliz", sleepy: "Com sono" }
    },
    shareMessages: {
      days: "{{petName}} é meu amiguinho do jardim há {{count}} dias. Feito com Mongchi.",
      fallback: "Conheça {{petName}}, meu amiguinho do jardim. Feito com Mongchi."
    },
    shareCard: {
      title: "Personalizar e compartilhar",
      subtitle: "Escolha uma pose e um cenário que seus amigos vão adorar.",
      poseSectionTitle: "Pose",
      themeSectionTitle: "Cenário",
      poseOptionAccessibilityLabel: "Pose {{pose}}",
      themeOptionAccessibilityLabel: "Cenário {{theme}}",
      selected: "Selecionado",
      previewAccessibilityLabel: "Prévia do cartão de compartilhamento de {{petName}}",
      closeAccessibilityLabel: "Fechar personalização do cartão",
      shareAccessibilityLabel: "Compartilhar o cartão de {{petName}}"
    }
  },
  shop: {
    accessibilityLabel: "Loja do jardim",
    title: "Loja",
    back: "Voltar ao início",
    walletAccessibilityLabel: "Carteira da loja, {{credits}} créditos e {{owned}} itens do conjunto adquiridos",
    creditGemAccessibilityLabel: "Ícone de gema de crédito da loja",
    openCreditStore: "Abrir a loja de gemas",
    categories: {
      all: "Todos",
      treats: "Petiscos",
      drinks: "Bebidas",
      toys: "Brinquedos",
      rest: "Descanso",
      moments: "Momentos",
      themes: "Temas"
    },
    tabs: {
      care: "Petiscos e brinquedos",
      customize: "Poses e temas"
    },
    sections: {
      careItems: "Petiscos, bebidas e brinquedos",
      careItemsDescription: "Escolha pequenas recompensas, brinquedos e itens aconchegantes.",
      posePacks: "Pacotes de poses",
      posePacksDescription: "Desbloqueie três expressões e poses combinando em cada pacote.",
      themes: "Temas do jardim",
      themesDescription: "Mude todo o clima da casa do seu companheiro."
    },
    careFiltersAccessibilityLabel: "Filtros de itens de cuidado",
    customizeFiltersAccessibilityLabel: "Filtros de personalização",
    categoryAccessibilityLabel: "{{label}}, {{count}} itens",
    emptyPreview: "Novos itens aconchegantes aparecerão aqui quando esta prateleira estiver abastecida.",
    emptyShelf: "Estamos abastecendo esta prateleira.",
    comingSoon: "Em breve",
    soon: "Logo",
    owned: "Adquirido",
    ownedQuantity: "Você tem x{{count}}",
    devOpen: "Aberto para desenvolvimento",
    available: "Disponível",
    locked: "Bloqueado",
    backgroundPreview: "Prévia do cenário {{name}}",
    largePreview: "Prévia ampliada de {{name}}",
    backgroundThumbnail: "Miniatura do cenário {{name}}",
    itemIcon: "Ícone de {{name}}",
    pricesAccessibilityLabel: "Preços aceitos em gemas e moedas",
    walletGemAccessibilityLabel: "Gema de crédito da carteira",
    coinAccessibilityLabel: "Moeda",
    gemPriceAccessibilityLabel: "Preço em gemas",
    actions: {
      unlockTheme: "Desbloquear tema",
      applyTheme: "Aplicar tema",
      getItem: "Comprar",
      unlockPack: "Desbloquear pacote"
    },
    grants: {
      consumable: "Crédito",
      durable: "Compra única",
      subscription: "Assinatura"
    },
    products: {
      premiumChat: {
        name: "Conversa mensal Plus",
        description: "Conversas mais longas e acolhedoras enquanto o passe Plus estiver ativo."
      },
      extraPetSlot: {
        name: "Espaço extra para bichinho",
        description: "Abra espaço para mais um perfil de bichinho."
      },
      regenerationCredit: {
        name: "Crédito de nova geração",
        description: "Uma nova tentativa de avatar quando você quiser outro visual."
      },
      starterTheme: {
        name: "Pacote de tema inicial",
        description: "Um novo cenário para o pequeno lar."
      },
      itemPack: {
        name: "Pacote de itens",
        description: "Uma seleção especial de petiscos e brinquedos."
      },
      treatPack: {
        name: "Pacote de petiscos",
        description: "Petiscos especiais para momentos de reações fofas."
      },
      plusPass: {
        name: "Passe Plus",
        description: "Benefícios premium de vínculo para conversas mais longas e futuros recursos Plus."
      }
    },
    actionAccessibility: {
      unlockTheme: "Desbloquear {{name}} por {{price}}",
      themeLocked: "{{name}} está bloqueado",
      applyTheme: "Aplicar {{name}}",
      themeApplied: "{{name}} está aplicado",
      buy: "Comprar {{name}}"
    },
    summary: {
      accessibilityLabel: "{{owned}} itens do conjunto adquiridos e {{locked}} itens bloqueados na loja",
      owned: "Conjunto adquirido",
      locked: "{{count}} itens bloqueados na loja"
    },
    dialogs: {
      checkout: "Finalizar compra",
      checkoutFailed: "Não foi possível iniciar a compra agora. Tente de novo.",
      shop: "Loja",
      shopFailed: "Não foi possível adicionar esse item agora. Tente de novo.",
      itemAdded: "Item adicionado",
      itemAddedMessage: "Seu novo item está esperando no inventário.",
      posePack: "Pacote de poses",
      posePackFailed: "Não foi possível iniciar esse pacote de poses agora. Tente de novo.",
      posesOnWay: "Três poses estão a caminho",
      posesOnWayMessage: "As três novas poses do seu companheiro estão sendo criadas juntas.",
      theme: "Tema",
      themeFailed: "Não foi possível alterar esse tema agora. Tente de novo.",
      makeover: "Jardim renovado!",
      themeApplied: "Tema aplicado",
      themeAppliedMessage: "{{name}} agora é o cenário do seu jardim."
    },
    expressionPacks: {
      poseCount: "3 POSES",
      boardAccessibilityLabel: "{{name}}, pacote de três poses, {{price}}. {{status}}",
      creditGemAccessibilityLabel: "Gema de crédito",
      allOwned: "Todas as 3 adquiridas",
      allPrice: "Todas as 3 · {{credits}}",
      actionAccessibilityLabel: "{{action}} de {{name}}",
      actions: {
        generate: "Gerar todas as 3",
        retry: "Tentar as 3 de novo",
        needCredits: "Obter gemas",
        making: "Criando poses...",
        owned: "Adquirido no perfil"
      }
    },
    themes: {
      defaultName: "Jardim Aconchegante",
      defaultDescription: "O cenário original do jardim, sempre gratuito.",
      fairyName: "Jardim das Fadas",
      fairyDescription: "Um jardim de fadas iluminado para dias suaves e sonhadores em casa.",
      seasideName: "Enseada à Beira-Mar",
      seasideDescription: "Um cenário litorâneo radiante para passeios com brisa.",
      autumnName: "Bosque de Outono",
      autumnDescription: "Folhas quentes e uma luz dourada suave para cuidados da estação.",
      winterName: "Luzes de Inverno",
      winterDescription: "Um cenário de noite nevada com um brilho festivo delicado."
    }
  },
  creditsStore: {
    accessibilityLabel: "Loja de gemas",
    title: "Loja de gemas",
    back: "Voltar à loja do jardim",
    balanceAccessibilityLabel: "Saldo atual: {{credits}} gemas",
    heroTitle: "Encontre mais pequenos momentos",
    heroBody: "Use gemas em pacotes de poses, temas e cuidados especiais.",
    starterTitle: "Presente do primeiro amigo · {{credits}}",
    starterBody: "Adicionado uma vez após a chegada do seu primeiro companheiro.",
    choosePack: "Escolha um pacote de gemas",
    popular: "POPULAR",
    packAmount: "{{credits}} gemas",
    storePrice: "Preço da App Store",
    purchaseAccessibilityLabel: "Comprar {{credits}} gemas",
    packs: {
      small: "Experimente abrindo um pacote",
      popular: "Boa escolha para poses e temas",
      large: "Colecione e decore por mais tempo"
    },
    actions: {
      buy: "Comprar",
      purchasing: "Verificando...",
      preparing: "Loja em preparação"
    },
    storeNotice: "Os pagamentos são processados pela App Store. Só gemas verificadas entram no saldo.",
    dialogs: {
      failedTitle: "Compra não concluída",
      failedBody: "Verifique a conexão e tente novamente.",
      successTitle: "As gemas chegaram",
      successBody: "As gemas verificadas foram adicionadas ao saldo."
    }
  },
  inventory: {
    accessibilityLabel: "Inventário",
    title: "Inventário",
    back: "Voltar ao início",
    giveAccessibilityLabel: "Dar {{name}} agora",
    giveHint: "Volta ao lar e abre as opções deste item",
    iconAccessibilityLabel: "Ícone de {{name}} no inventário",
    empty: "Ainda não há nada aqui — os petiscos e brinquedos que você conseguir aparecerão nesta prateleira.",
    shop: "Loja"
  },
  settings: {
    accessibilityLabel: "Ajustes e área de privacidade de {{petName}}",
    title: "Ajustes",
    back: "Voltar ao início",
    hero: "Clima, lembretes, privacidade e ajuda — tudo em um cantinho aconchegante.",
    language: {
      title: "Idioma do app",
      english: "Inglês",
      korean: "Coreano",
      detail: "Escolha aqui ou siga o seu aparelho.",
      action: "Alterar"
    },
    status: {
      needsCheck: "Precisa de verificação",
      syncing: "Sincronizando",
      attention: "A ação de privacidade precisa de atenção",
      inProgress: "Ação de privacidade em andamento",
      errorDetail: "Não foi possível concluir a alteração com segurança. Verifique sua conexão e tente de novo.",
      keepOpen: "Mantenha o app aberto enquanto a alteração é concluída."
    },
    sections: {
      reminders: "Pequenos lembretes",
      sound: "Som e sensação",
      privacy: "Privacidade e cuidado",
      support: "Ajuda e termos legais"
    },
    notifications: {
      careReminders: "Lembretes de cuidado",
      careRemindersDetail: "Avisos gentis sobre refeições, água, oizinhos e sua carta mensal.",
      walkUpdates: "Novidades do passeio",
      walkUpdatesDetail: "Um aviso rápido quando o passeio termina e seu amiguinho está de volta."
    },
    weather: {
      scenes: "Cenários de clima",
      useLocation: "Usar minha localização",
      useLocationDetail: "Sua localização aproximada é enviada uma vez para buscar o clima local real do jardim — nunca é armazenada, nunca é compartilhada.",
      preview: "Prévia do clima",
      next: "Próximo: {{weather}}",
      locationMessages: {
        requesting: "Buscando o clima local real de hoje para o jardim.",
        ready: "O clima local está pronto.",
        denied: "A permissão de localização não foi concedida. Você ainda pode escolher o clima manualmente.",
        error: "O clima local não está disponível agora. Tente escolher uma opção manualmente."
      },
      options: {
        clear: { label: "Céu limpo", detail: "Jardim ensolarado padrão." },
        rain: {
          label: "Chuva",
          detail: "Chuva sobre o cenário e falas aconchegantes."
        },
        snow: {
          label: "Neve",
          detail: "Cenário de inverno e falas suaves sobre o frio."
        },
        wind: {
          label: "Vento",
          detail: "Folhas em movimento e descobertas no passeio."
        },
        hot: {
          label: "Quente",
          detail: "Cenário ensolarado e mais lembretes para cuidar do jardim."
        }
      }
    },
    sound: {
      effects: "Sons",
      effectsDetail: "Pequenos sinos e toques acompanhados de vibrações suaves.",
      music: "Música e ambiente",
      musicDetail: "Música suave do jardim e sons ambientes, como pássaros ou chuva."
    },
    privacy: {
      localPhoto: "Cópia local da foto",
      photoDeleted: "Excluída deste dispositivo.",
      photoStored: "Uma cópia é mantida apenas neste dispositivo.",
      photoNote: "Sua foto só foi usada para criar seu amiguinho — ela foi guardada logo depois da chegada.",
      chatHistory: "Histórico de conversa",
      chatDeleted: "Excluído desta sessão.",
      chatDetail: "Gerencie aqui as conversas mais longas.",
      backup: "Fazer cópia de segurança do seu amiguinho",
      backupDetail: "Salve uma cópia do seu jardim para que ele nunca fique apenas neste dispositivo.",
      restore: "Restaurar cópia de segurança",
      restoreDetail: "Cole uma cópia salva para trazer seu jardim de volta."
    },
    links: { privacy: "Privacidade", terms: "Termos", support: "Ajuda" },
    reset: {
      title: "Redefinir",
      detail: "Exclui a configuração local do bichinho neste dispositivo e reinicia as boas-vindas.",
      action: "Excluir dados do bichinho"
    },
    dialogs: {
      errorLog: "Registro de erros",
      noErrors: "Nenhum erro recente foi registrado neste dispositivo.",
      deletePhotoTitle: "Excluir a cópia local da foto?",
      deletePhotoMessage: "Isso apaga a cópia da foto salva neste dispositivo. Seu amiguinho já foi criado — nada nele vai mudar.",
      deleteChatTitle: "Excluir histórico de conversa?",
      deleteChatMessage: "Isso apaga o histórico local de conversa desta sessão. As reações gratuitas de cuidado não serão afetadas.",
      backup: "Cópia de segurança",
      backupFailed: "Não foi possível preparar uma cópia de segurança agora. Tente de novo.",
      shareFailed: "Não foi possível abrir as opções de compartilhamento. Tente de novo.",
      restore: "Restaurar cópia de segurança",
      restoreFailed: "Não foi possível restaurar essa cópia. Confira o texto salvo e tente de novo.",
      pasteFirst: "Primeiro, cole o texto da sua cópia de segurança.",
      restoreConfirmTitle: "Restaurar esta cópia?",
      restoreConfirmMessage: "Isso substituirá seu jardim atual. Antes, faremos uma cópia dele por segurança.",
      restoredTitle: "Que bom ter você de volta!",
      restoredMessage: "Seu jardim foi restaurado da cópia de segurança.",
      deleteAllTitle: "Excluir todos os seus dados?",
      deleteAllMessage:
        "Isso exclui deste dispositivo a configuração do bichinho, o bichinho gerado, o estado dos cuidados e o inventário. Também solicita aos nossos servidores a exclusão da sua foto, dos avatares gerados e dos dados da conta. Esta ação não pode ser desfeita.",
      serverRetry: "A exclusão no servidor precisa de nova tentativa",
      serverRetryMessage: "Os dados do dispositivo foram apagados. Mantenha o app aberto e tente mais tarde para concluir também a exclusão no servidor."
    },
    restoreModal: {
      accessibilityLabel: "Restaurar cópia de segurança",
      title: "Restaurar cópia de segurança",
      hint: "Cole o texto da cópia que você salvou antes, no iCloud, Notas ou e-mail.",
      placeholder: "Cole aqui o JSON da sua cópia de segurança",
      inputAccessibilityLabel: "Texto da cópia de segurança"
    },
    dev: {
      fontTitle: "Desenv.: combinação de fontes",
      fontDetail: "Compara as duas combinações de fontes W2 em todo o app. Não aparece nas versões de produção.",
      errorTitle: "Desenv.: registro de erros",
      errorCount: "{{count}} erros recentes registrados neste dispositivo.",
      shareLog: "Compartilhar registro",
      clearLog: "Limpar registro"
    }
  },
  notifications: {
    channel: {
      name: "Novidades do jardim",
      description: "Novidades gentis sobre seu jardim"
    },
    walkReturn: {
      fallbackPetName: "Seu bichinho",
      title: "{{petName}} voltou do passeio!",
      body: "Venha ver o que {{petName}} encontrou por aí."
    },
    garden: {
      meal_due: {
        title: "{{petName}} está pensando na tigelinha",
        body: "Uma pequena refeição deixaria a saciedade aconchegante de novo."
      },
      meal_urgent: {
        title: "A tigelinha de {{petName}} tem um espacinho hoje",
        body: "Uma refeição simples cairia muito bem para {{petName}} agora."
      },
      thirst_due: {
        title: "A tigela de água de {{petName}} pode ganhar mais um pouquinho",
        body: "Dar água agora deixaria o humor um pouquinho mais alegre."
      },
      thirst_hot_weather: {
        title: "{{petName}} aceitaria um gole fresquinho",
        body: "O dia está quente. Uma tigela de água fresca é o melhor primeiro cuidado."
      },
      bored_play: {
        title: "{{petName}} encontrou o brinquedo de novo",
        body: "Uma brincadeira rápida parece divertida agora."
      },
      attention_return: {
        title: "{{petName}} tem um pequeno oi esperando",
        body: "Abra o jardim para um carinho, uma conversa ou uma visitinha rápida."
      },
      walk_window: {
        title: "Hora de uma pequena caminhada",
        body: "{{petName}} talvez goste de um passeio tranquilo hoje."
      },
      rest_needed: {
        title: "{{petName}} está com soninho",
        body: "Um descanso mantém o ritmo tranquilo nesta noite."
      },
      rainy_cozy_check: {
        title: "Uma visitinha em dia de chuva",
        body: "{{petName}} está bem aconchegado. Um oi combina com este clima."
      },
      return_after_1_day: {
        title: "Uma pegadinha apareceu perto da porta",
        body: "{{petName}} ficou pensando em quando você voltaria por aqui."
      },
      return_after_1_day_streak: {
        title: "{{petName}} está mantendo sua rotina bem aconchegante",
        body: "Sua sequência continua quentinha. Uma visita rápida hoje mantém o brilho."
      },
      return_after_3_days: {
        title: "O jardim guardou um lugar para você",
        body: "Já faz alguns dias. {{petName}} adoraria um oi quando você quiser voltar."
      }
    },
    monthlyLetter: {
      fallbackPetName: "Seu bichinho",
      title: "Uma carta está esperando",
      body: "Uma carta de {{petName}} está esperando no jardim."
    }
  },
  errorBoundary: {
    fallbackPetName: "Seu amiguinho",
    title: "Algo deu uma engasgadinha",
    message: "{{petName}} está bem. Esta tela só precisa recomeçar.",
    retry: "Tentar de novo"
  },
  legal: {
    back: "Voltar aos ajustes",
    privacy: {
      accessibilityLabel: "Política de privacidade e aviso sobre IA",
      eyebrow: "Privacidade",
      title: "Segurança de fotos e conversas",
      updated: "Última atualização em 8 de julho de 2026 · v1.1",
      items: {
        first: "Sem conta e sem e-mail — o app abre com uma sessão anônima, sem cadastro.",
        second:
          "A foto original do seu bichinho é enviada à OpenAI apenas para a verificação de segurança e a geração do avatar. Ela é excluída automaticamente dos nossos servidores assim que a geração termina.",
        third:
          "Ao desbloquear mais expressões depois, usamos a arte do avatar já gerado, não a foto original — a essa altura, ela já não existe nos nossos servidores.",
        fourth: "Os avatares gerados ficam em um armazenamento privado e só aparecem por links assinados de curta duração, nunca por uma URL pública.",
        fifth:
          "Dados de cuidados, lembranças e progresso do jardim ficam armazenados localmente no seu dispositivo. Ao desinstalar o app, eles são excluídos para sempre.",
        sixth: "Se você permitir, sua localização aproximada é arredondada e enviada uma única vez para buscar o clima local real do jardim. Ela nunca é armazenada — e se a busca falhar, seu aparelho cria um clima parecido por conta própria.",
        seventh: "A conversa premium é identificada como gerada por IA e moderada antes que as mensagens apareçam.",
        eighth: "Não usamos SDKs de anúncios ou rastreamento, e as análises não incluem fotos originais, texto bruto de conversas nem dados de pagamento."
      },
      sections: {
        sharingTitle: "Terceiros com quem compartilhamos dados",
        sharingBody:
          "A OpenAI processa a foto original do seu bichinho para verificações de segurança e geração do avatar e, na conversa premium, o perfil do bichinho e o contexto recente da conversa. O Supabase hospeda nosso banco de dados, armazenamento privado e autenticação anônima. A Apple ou o Google processam pagamentos no app diretamente; recebemos um comprovante, nunca os dados do seu cartão.",
        rightsTitle: "Seus direitos",
        rightsBody:
          "Você pode excluir a foto original separadamente. Para excluir tudo, escolha Excluir dados do bichinho nos Ajustes. Isso apaga os dados locais e solicita aos nossos servidores a remoção da foto, dos avatares gerados, da conta anônima e dos registros relacionados. Se não for possível acessar o servidor, os dados locais serão apagados na hora e o app pedirá que você tente novamente a etapa do servidor mais tarde.",
        childrenTitle: "Crianças",
        childrenBody:
          "O Mongchi não é destinado a crianças menores de 13 anos. Se você acredita que uma criança forneceu informações por foto ou conversa, fale com o suporte e nós as excluiremos."
      },
      policyLink: "Link da política",
      policyFallback: "Um link seguro para a política de privacidade aparecerá aqui quando estiver disponível.",
      openPolicy: "Abrir política",
      aiTitle: "Aviso sobre IA",
      aiBody: "Esta conversa é gerada por IA com base no perfil do seu bichinho. Ela não é a consciência real dele."
    },
    support: {
      accessibilityLabel: "Ajuda e relatos sobre geração",
      eyebrow: "Ajuda",
      title: "Ajuda e relatos",
      updated: "Última atualização em 7 de julho de 2026 · v1.0",
      contact: "Contato de ajuda",
      contactFallback: "Use as opções de relato abaixo. O suporte por e-mail será aberto quando houver um endereço disponível.",
      email: "Enviar e-mail ao suporte",
      faqTitle: "Perguntas frequentes",
      faq: {
        photoQuestion: "A foto do meu bichinho está segura?",
        photoAnswer:
          "Sua foto é usada apenas para uma verificação de segurança e para gerar o avatar. Ela é excluída automaticamente dos nossos servidores quando a geração termina.",
        deleteQuestion: "Como excluo meus dados?",
        deleteAnswer:
          "Exclua a foto original separadamente durante o fluxo da foto ou use Excluir dados do bichinho nos Ajustes para solicitar a exclusão completa local e no servidor.",
        creditQuestion: "O que acontece com meus créditos se a geração falhar?",
        creditAnswer:
          "Uma falha de sistema, segurança ou qualidade não deve consumir um crédito pago. Relate abaixo se um crédito parecer ter sido usado indevidamente."
      },
      reportTitle: "Relatar problema na geração",
      reportDetail: "Os relatos usam uma categoria segura e não enviam fotos originais para análise.",
      options: {
        wrong: {
          label: "Visual diferente",
          description: "A espécie, as marcas ou o rosto não parecem certos."
        },
        unsafe: {
          label: "Visual desconfortável",
          description: "Algo parece desconfortável ou assustador."
        },
        quality: {
          label: "Resultado borrado",
          description: "Está difícil reconhecer o bichinho."
        }
      },
      report: "Relatar",
      saved: "Salvo",
      lastReport: "Último relato: {{label}}",
      savedTitle: "Relato salvo",
      savedMessage: "Apenas a categoria do problema foi salva. Nenhuma foto original ou texto de conversa foi anexado."
    },
    terms: {
      accessibilityLabel: "Termos e valor pago",
      eyebrow: "Termos",
      title: "Uso justo e valor pago",
      updated: "Última atualização em 7 de julho de 2026 · v1.0",
      items: {
        first:
          "Mongchi é entretenimento gerado por IA — seu companheiro e a conversa não são a consciência, a memória ou uma orientação médica do seu bichinho real.",
        second: "No primeiro fluxo do bichinho, a foto selecionada fica sob seu controle e pode ser excluída separadamente.",
        third: "Gerações ruins, falhas do sistema e reprovações de qualidade não devem consumir valores pagos.",
        fourth: "Os cuidados básicos continuam gratuitos. Itens pagos acrescentam expressividade, não aceleram a recuperação dos medidores de cuidado.",
        fifth: "Créditos e itens pagos não têm valor em dinheiro; reembolsos seguem a política da loja usada na compra.",
        sixth: "Conversas geradas do bichinho nunca devem alegar ser a consciência do bichinho real."
      },
      sections: {
        useTitle: "Uso aceitável",
        useBody:
          "Não envie fotos com pessoas, conteúdo explícito ou violento nem qualquer conteúdo ilegal. Não burle os limites de geração ou as verificações de segurança e não tente contornar as proteções da conversa.",
        portabilityTitle: "Sem portabilidade de conta",
        portabilityBody:
          "Mongchi não usa contas tradicionais. Os dados da sessão e do jogo ficam no seu dispositivo. Por isso, desinstalar o app ou trocar de dispositivo sem uma cópia de segurança pode apagar para sempre o progresso local, as lembranças e os créditos.",
        disclaimerTitle: "Isenção de responsabilidade",
        disclaimerBody:
          "Mongchi é fornecido no estado em que se encontra. O conteúdo gerado por IA pode ocasionalmente ser impreciso ou falhar, mesmo com verificações de segurança e qualidade. Consulte os termos completos para conhecer todos os limites."
      },
      linkTitle: "Link dos termos",
      linkFallback: "Um link seguro para os termos aparecerá aqui quando estiver disponível.",
      openTerms: "Abrir termos"
    }
  }
} satisfies DeepStringShape<typeof enUS>;
