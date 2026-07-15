export const enUS = {
  legal: {
    back: "Back to settings",
    privacy: {
      accessibilityLabel: "Privacy policy and AI disclosure",
      eyebrow: "Privacy",
      title: "Photo and chat safety",
      updated: "Last updated July 8, 2026 · v1.1",
      items: {
        first: "No account, no email — the app opens with an anonymous session, not a signup.",
        second:
          "Your pet's original photo is sent to OpenAI only to run a safety check and generate the avatar, then it is automatically deleted from our servers the moment generation finishes.",
        third:
          "Unlocking more expression states later reuses your already-generated avatar art, not your original photo — it no longer exists on our servers by then.",
        fourth: "Generated avatars live in a private storage bucket and are only ever shown through short-lived signed links, never a public URL.",
        fifth: "Care stats, memories, and garden progress are stored locally on your device, so uninstalling the app removes them permanently.",
        sixth: "If you allow it, your approximate location is rounded and sent once to look up real local weather for the garden. It's never stored, and if the lookup ever fails, your device creates a similar weather feel on its own.",
        seventh: "Premium chat is labeled as AI-generated and moderated before messages appear.",
        eighth: "No ad or tracking SDKs, and analytics avoid raw photos, raw chat text, and payment details."
      },
      sections: {
        sharingTitle: "Third parties we share data with",
        sharingBody:
          "OpenAI processes your pet's source photo for safety checks and avatar generation and, for premium chat, your pet's profile and recent conversation context. Supabase hosts our database, private storage, and anonymous auth. Apple or Google handles in-app payments directly; we receive a receipt, never your card details.",
        rightsTitle: "Your rights",
        rightsBody:
          "You can delete the original photo separately. For full deletion, choose Delete pet data in Settings. This clears local data and asks our servers to remove the photo, generated avatars, anonymous account, and associated records. If the server cannot be reached, local data clears immediately and the app asks you to retry the server step later.",
        childrenTitle: "Children",
        childrenBody:
          "Mongchi is not directed at children under 13. If you believe a child provided information through a photo or chat, contact support and we will delete it."
      },
      policyLink: "Policy link",
      policyFallback: "A secure privacy policy link will appear here when available.",
      openPolicy: "Open policy",
      aiTitle: "AI disclosure",
      aiBody: "This is an AI-generated conversation shaped by your pet's profile. It is not your real pet's consciousness."
    },
    support: {
      accessibilityLabel: "Support and generation reports",
      eyebrow: "Support",
      title: "Help and reports",
      updated: "Last updated July 7, 2026 · v1.0",
      contact: "Support contact",
      contactFallback: "Use the report controls below. Email support opens when an address is available.",
      email: "Email support",
      faqTitle: "Frequently asked",
      faq: {
        photoQuestion: "Is my pet's photo safe?",
        photoAnswer: "Your photo is used only for a safety check and avatar generation. It is automatically deleted from our servers when generation finishes.",
        deleteQuestion: "How do I delete my data?",
        deleteAnswer:
          "Delete the original photo separately during the photo flow, or use Delete pet data in Settings for a full local and server deletion request.",
        creditQuestion: "What happens to my credits if generation fails?",
        creditAnswer: "A system, safety, or quality-check failure should not cost a paid credit. Report it below if a credit seems to have been used unfairly."
      },
      reportTitle: "Report generation issue",
      reportDetail: "Issue reports use a safe category and avoid sending raw photos through analytics.",
      options: {
        wrong: {
          label: "Looks wrong",
          description: "Species, markings, or face feels off."
        },
        unsafe: {
          label: "Unsafe look",
          description: "Something feels uncomfortable or scary."
        },
        quality: {
          label: "Blurry result",
          description: "The pet is hard to recognize."
        }
      },
      report: "Report",
      saved: "Saved",
      lastReport: "Last report: {{label}}",
      savedTitle: "Report saved",
      savedMessage: "Only the issue category was saved. No raw photo or chat text was attached."
    },
    terms: {
      accessibilityLabel: "Terms and paid value",
      eyebrow: "Terms",
      title: "Fair use and paid value",
      updated: "Last updated July 7, 2026 · v1.0",
      items: {
        first: "Mongchi is AI-generated entertainment — your companion and chat are not your real pet's consciousness, memory, or medical advice.",
        second: "The first pet flow keeps your selected photo under your control and lets you delete it separately.",
        third: "Bad generations, system failures, and quality checks should not consume paid value.",
        fourth: "Basic care remains free. Paid items add expression, not recovery from neglect.",
        fifth: "Credits and paid items have no cash value; refunds follow the store policy used for purchase.",
        sixth: "Generated pet conversations must never claim to be the real pet's consciousness."
      },
      sections: {
        useTitle: "Acceptable use",
        useBody:
          "Do not upload photos containing people, explicit or graphic content, or anything illegal. Do not bypass generation limits or safety checks or attempt to jailbreak chat.",
        portabilityTitle: "No account portability",
        portabilityBody:
          "Mongchi does not use traditional accounts. Session and local game data live on your device, so uninstalling or switching devices without a backup may permanently lose local progress, memories, and credits.",
        disclaimerTitle: "Disclaimer",
        disclaimerBody:
          "Mongchi is provided as-is. AI-generated content may occasionally be inaccurate or fail despite safety and quality checks. See the full terms for complete limits."
      },
      linkTitle: "Terms link",
      linkFallback: "A secure terms link will appear here when available.",
      openTerms: "Open terms"
    }
  }
};
