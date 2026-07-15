export const esMX = {
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
      contact: "Contacto de ayuda",
      contactFallback: "Usa las opciones para reportar que aparecen abajo. La ayuda por correo electrónico se abrirá cuando haya una dirección disponible.",
      email: "Enviar correo a soporte",
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
      savedMessage: "Solo se guardó la categoría del problema. No se adjuntaron la foto original ni el texto del chat."
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
};
