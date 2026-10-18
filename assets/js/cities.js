/* City copy for the London, Brussels and Zurich pages.
   One source for three uses: tools/build-cities.mjs writes it into each city page,
   the page script applies it, and the homepage uses the hero lines when the visitor's
   time zone matches a city. Edit the text here, then run: node tools/build-cities.mjs */
window.CITIES = {
  london: {
    tz: ["Europe/London"],
    name: { en: "London", fr: "Londres", es: "Londres" },
    lang: "en",
    en: {
      pageTitle: "Violinist & Singer for Events in London | Sofia Gallego",
      pageDescription: "Violin and lyric singing for weddings, corporate evenings and private events in London. Based in Paris and travelling to London regularly. Classical repertoire, French songs and international pop.",
      heroEyebrow: "Weddings · Receptions · Corporate events",
      tagline: "Singer & Violinist · Paris & London",
      heroIntro: "I move between Paris and London all the time, so live voice and violin for your ceremony, cocktail or reception in London is easy to arrange. From Bach and Piaf to Coldplay and Taylor Swift, shaped around your day."
    },
    fr: {
      pageTitle: "Violoniste et chanteuse lyrique pour événements à Londres | Sofia Gallego",
      pageDescription: "Chant lyrique et violon pour mariages, soirées d’entreprise et événements privés à Londres. Basée à Paris, je me rends régulièrement à Londres. Répertoire classique, chansons françaises et pop internationale.",
      heroEyebrow: "Mariages · Réceptions · Événements d’entreprise",
      tagline: "Chanteuse & Violoniste · Paris & Londres",
      heroIntro: "Je voyage sans cesse entre Paris et Londres, il est donc simple d’organiser chant et violon en live pour votre cérémonie, cocktail ou réception à Londres. De Bach et Piaf à Coldplay et Taylor Swift, pensés pour votre journée."
    },
    es: {
      pageTitle: "Violinista y cantante para eventos en Londres | Sofia Gallego",
      pageDescription: "Voz lírica y violín para bodas, eventos de empresa y celebraciones privadas en Londres. Con base en París y viajes frecuentes a Londres. Repertorio clásico, chanson francesa y pop internacional.",
      heroEyebrow: "Bodas · Recepciones · Eventos de empresa",
      tagline: "Cantante y violinista · París y Londres",
      heroIntro: "Viajo con frecuencia entre París y Londres, así que organizar voz y violín en vivo para su ceremonia, cóctel o recepción en Londres es sencillo. De Bach y Piaf a Coldplay y Taylor Swift, a la medida de su día."
    }
  },
  brussels: {
    tz: ["Europe/Brussels"],
    name: { en: "Brussels", fr: "Bruxelles", es: "Bruselas" },
    lang: "fr",
    en: {
      pageTitle: "Violinist & Singer for Events in Brussels | Sofia Gallego",
      pageDescription: "Violin and lyric singing for weddings, corporate evenings and private events in Brussels. Based in Paris and travelling to Brussels regularly. Classical repertoire, French songs and international pop.",
      heroEyebrow: "Weddings · Receptions · Corporate events",
      tagline: "Singer & Violinist · Paris & Brussels",
      heroIntro: "I move between Paris and Brussels all the time, so live voice and violin for your ceremony, cocktail or reception in Brussels is easy to arrange. From Bach and Piaf to Coldplay and Taylor Swift, shaped around your day."
    },
    fr: {
      pageTitle: "Violoniste et chanteuse lyrique pour événements à Bruxelles | Sofia Gallego",
      pageDescription: "Chant lyrique et violon pour mariages, soirées d’entreprise et événements privés à Bruxelles. Basée à Paris, je me rends régulièrement à Bruxelles. Répertoire classique, chansons françaises et pop internationale.",
      heroEyebrow: "Mariages · Réceptions · Événements d’entreprise",
      tagline: "Chanteuse & Violoniste · Paris & Bruxelles",
      heroIntro: "Je voyage sans cesse entre Paris et Bruxelles, il est donc simple d’organiser chant et violon en live pour votre cérémonie, cocktail ou réception à Bruxelles. De Bach et Piaf à Coldplay et Taylor Swift, pensés pour votre journée."
    },
    es: {
      pageTitle: "Violinista y cantante para eventos en Bruselas | Sofia Gallego",
      pageDescription: "Voz lírica y violín para bodas, eventos de empresa y celebraciones privadas en Bruselas. Con base en París y viajes frecuentes a Bruselas. Repertorio clásico, chanson francesa y pop internacional.",
      heroEyebrow: "Bodas · Recepciones · Eventos de empresa",
      tagline: "Cantante y violinista · París y Bruselas",
      heroIntro: "Viajo con frecuencia entre París y Bruselas, así que organizar voz y violín en vivo para su ceremonia, cóctel o recepción en Bruselas es sencillo. De Bach y Piaf a Coldplay y Taylor Swift, a la medida de su día."
    }
  },
  zurich: {
    tz: ["Europe/Zurich"],
    name: { en: "Zurich", fr: "Zurich", es: "Zúrich" },
    lang: "en",
    en: {
      pageTitle: "Violinist & Singer for Events in Zurich | Sofia Gallego",
      pageDescription: "Violin and lyric singing for weddings, corporate evenings and private events in Zurich. Based in Paris and travelling to Zurich regularly. Classical repertoire, French songs and international pop.",
      heroEyebrow: "Weddings · Receptions · Corporate events",
      tagline: "Singer & Violinist · Paris & Zurich",
      heroIntro: "I move between Paris and Zurich all the time, so live voice and violin for your ceremony, cocktail or reception in Zurich is easy to arrange. From Bach and Piaf to Coldplay and Taylor Swift, shaped around your day."
    },
    fr: {
      pageTitle: "Violoniste et chanteuse lyrique pour événements à Zurich | Sofia Gallego",
      pageDescription: "Chant lyrique et violon pour mariages, soirées d’entreprise et événements privés à Zurich. Basée à Paris, je me rends régulièrement à Zurich. Répertoire classique, chansons françaises et pop internationale.",
      heroEyebrow: "Mariages · Réceptions · Événements d’entreprise",
      tagline: "Chanteuse & Violoniste · Paris & Zurich",
      heroIntro: "Je voyage sans cesse entre Paris et Zurich, il est donc simple d’organiser chant et violon en live pour votre cérémonie, cocktail ou réception à Zurich. De Bach et Piaf à Coldplay et Taylor Swift, pensés pour votre journée."
    },
    es: {
      pageTitle: "Violinista y cantante para eventos en Zúrich | Sofia Gallego",
      pageDescription: "Voz lírica y violín para bodas, eventos de empresa y celebraciones privadas en Zúrich. Con base en París y viajes frecuentes a Zúrich. Repertorio clásico, chanson francesa y pop internacional.",
      heroEyebrow: "Bodas · Recepciones · Eventos de empresa",
      tagline: "Cantante y violinista · París y Zúrich",
      heroIntro: "Viajo con frecuencia entre París y Zúrich, así que organizar voz y violín en vivo para su ceremonia, cóctel o recepción en Zúrich es sencillo. De Bach y Piaf a Coldplay y Taylor Swift, a la medida de su día."
    }
  }
};
