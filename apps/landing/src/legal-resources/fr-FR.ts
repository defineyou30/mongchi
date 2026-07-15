export const frFR = {
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
      contact: "Contacter l’assistance",
      contactFallback: "Utilisez les options de signalement ci-dessous. L’assistance par e-mail s’ouvrira lorsqu’une adresse sera disponible.",
      email: "Écrire à l’assistance",
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
      savedMessage: "Seule la catégorie du problème a été enregistrée. Aucune photo brute ni aucun texte de discussion n’a été joint."
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
};
