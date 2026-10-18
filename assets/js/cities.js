/* City copy for the London, Brussels and Zurich pages.
   One source for three uses: tools/build-cities.mjs writes it into each city page,
   the page script applies it, and the homepage uses the hero lines when the visitor's
   time zone matches a city. Edit the text here, then run: node tools/build-cities.mjs */
window.CITIES = {
  london: {
    tz: ["Europe/London"],
    name: { en: "London", fr: "Londres", es: "Londres", de: "London" },
    lang: "en",
    en: {
      pageTitle: "Violinist & Singer for Events in London | Sofia Gallego",
      pageDescription: "Violin and lyric singing for weddings, corporate evenings and private events in London. Classical repertoire, French songs and international pop.",
      heroEyebrow: "Weddings · Receptions · Corporate events",
      tagline: "Singer & Violinist · Paris & London",
      heroIntro: "Live voice and violin for your ceremony, cocktail or reception in London. From Bach and Piaf to Coldplay and Taylor Swift, shaped around your day."
    },
    fr: {
      pageTitle: "Violoniste et chanteuse lyrique pour événements à Londres | Sofia Gallego",
      pageDescription: "Chant lyrique et violon pour mariages, soirées d’entreprise et événements privés à Londres. Répertoire classique, chansons françaises et pop internationale.",
      heroEyebrow: "Mariages · Réceptions · Événements d’entreprise",
      tagline: "Chanteuse & Violoniste · Paris & Londres",
      heroIntro: "Chant et violon en live pour votre cérémonie, cocktail ou réception à Londres. De Bach et Piaf à Coldplay et Taylor Swift, pensés pour votre journée."
    },
    es: {
      pageTitle: "Violinista y cantante para eventos en Londres | Sofia Gallego",
      pageDescription: "Voz lírica y violín para bodas, eventos de empresa y celebraciones privadas en Londres. Repertorio clásico, chanson francesa y pop internacional.",
      heroEyebrow: "Bodas · Recepciones · Eventos de empresa",
      tagline: "Cantante y violinista · París y Londres",
      heroIntro: "Voz y violín en vivo para su ceremonia, cóctel o recepción en Londres. De Bach y Piaf a Coldplay y Taylor Swift, a la medida de su día."
    },
    de: {
      pageTitle: "Geigerin und Sängerin für Events in London | Sofia Gallego",
      pageDescription: "Gesang und Geige für Hochzeiten, Firmenabende und private Feiern in London. Klassisches Repertoire, französische Chansons und internationaler Pop.",
      heroEyebrow: "Hochzeiten · Empfänge · Firmenveranstaltungen",
      tagline: "Sängerin & Geigerin · Paris & London",
      heroIntro: "Gesang und Geige live für Ihre Trauung, Ihren Cocktail oder Ihren Empfang in London. Von Bach und Piaf bis Coldplay und Taylor Swift, auf Ihren Tag zugeschnitten."
    }
  },
  brussels: {
    tz: ["Europe/Brussels"],
    name: { en: "Brussels", fr: "Bruxelles", es: "Bruselas", de: "Brüssel" },
    lang: "fr",
    en: {
      pageTitle: "Violinist & Singer for Events in Brussels | Sofia Gallego",
      pageDescription: "Violin and lyric singing for weddings, corporate evenings and private events in Brussels. Classical repertoire, French songs and international pop.",
      heroEyebrow: "Weddings · Receptions · Corporate events",
      tagline: "Singer & Violinist · Paris & Brussels",
      heroIntro: "Live voice and violin for your ceremony, cocktail or reception in Brussels. From Bach and Piaf to Coldplay and Taylor Swift, shaped around your day."
    },
    fr: {
      pageTitle: "Violoniste et chanteuse lyrique pour événements à Bruxelles | Sofia Gallego",
      pageDescription: "Chant lyrique et violon pour mariages, soirées d’entreprise et événements privés à Bruxelles. Répertoire classique, chansons françaises et pop internationale.",
      heroEyebrow: "Mariages · Réceptions · Événements d’entreprise",
      tagline: "Chanteuse & Violoniste · Paris & Bruxelles",
      heroIntro: "Chant et violon en live pour votre cérémonie, cocktail ou réception à Bruxelles. De Bach et Piaf à Coldplay et Taylor Swift, pensés pour votre journée."
    },
    es: {
      pageTitle: "Violinista y cantante para eventos en Bruselas | Sofia Gallego",
      pageDescription: "Voz lírica y violín para bodas, eventos de empresa y celebraciones privadas en Bruselas. Repertorio clásico, chanson francesa y pop internacional.",
      heroEyebrow: "Bodas · Recepciones · Eventos de empresa",
      tagline: "Cantante y violinista · París y Bruselas",
      heroIntro: "Voz y violín en vivo para su ceremonia, cóctel o recepción en Bruselas. De Bach y Piaf a Coldplay y Taylor Swift, a la medida de su día."
    },
    de: {
      pageTitle: "Geigerin und Sängerin für Events in Brüssel | Sofia Gallego",
      pageDescription: "Gesang und Geige für Hochzeiten, Firmenabende und private Feiern in Brüssel. Klassisches Repertoire, französische Chansons und internationaler Pop.",
      heroEyebrow: "Hochzeiten · Empfänge · Firmenveranstaltungen",
      tagline: "Sängerin & Geigerin · Paris & Brüssel",
      heroIntro: "Gesang und Geige live für Ihre Trauung, Ihren Cocktail oder Ihren Empfang in Brüssel. Von Bach und Piaf bis Coldplay und Taylor Swift, auf Ihren Tag zugeschnitten."
    }
  },
  zurich: {
    tz: ["Europe/Zurich"],
    name: { en: "Zurich", fr: "Zurich", es: "Zúrich", de: "Zürich" },
    lang: "de",
    en: {
      pageTitle: "Violinist & Singer for Events in Zurich | Sofia Gallego",
      pageDescription: "Violin and lyric singing for weddings, corporate evenings and private events in Zurich. Classical repertoire, French songs and international pop.",
      heroEyebrow: "Weddings · Receptions · Corporate events",
      tagline: "Singer & Violinist · Paris & Zurich",
      heroIntro: "Live voice and violin for your ceremony, cocktail or reception in Zurich. From Bach and Piaf to Coldplay and Taylor Swift, shaped around your day."
    },
    fr: {
      pageTitle: "Violoniste et chanteuse lyrique pour événements à Zurich | Sofia Gallego",
      pageDescription: "Chant lyrique et violon pour mariages, soirées d’entreprise et événements privés à Zurich. Répertoire classique, chansons françaises et pop internationale.",
      heroEyebrow: "Mariages · Réceptions · Événements d’entreprise",
      tagline: "Chanteuse & Violoniste · Paris & Zurich",
      heroIntro: "Chant et violon en live pour votre cérémonie, cocktail ou réception à Zurich. De Bach et Piaf à Coldplay et Taylor Swift, pensés pour votre journée."
    },
    es: {
      pageTitle: "Violinista y cantante para eventos en Zúrich | Sofia Gallego",
      pageDescription: "Voz lírica y violín para bodas, eventos de empresa y celebraciones privadas en Zúrich. Repertorio clásico, chanson francesa y pop internacional.",
      heroEyebrow: "Bodas · Recepciones · Eventos de empresa",
      tagline: "Cantante y violinista · París y Zúrich",
      heroIntro: "Voz y violín en vivo para su ceremonia, cóctel o recepción en Zúrich. De Bach y Piaf a Coldplay y Taylor Swift, a la medida de su día."
    },
    de: {
      pageTitle: "Geigerin und Sängerin für Events in Zürich | Sofia Gallego",
      pageDescription: "Gesang und Geige für Hochzeiten, Firmenabende und private Feiern in Zürich. Klassisches Repertoire, französische Chansons und internationaler Pop.",
      heroEyebrow: "Hochzeiten · Empfänge · Firmenveranstaltungen",
      tagline: "Sängerin & Geigerin · Paris & Zürich",
      heroIntro: "Gesang und Geige live für Ihre Trauung, Ihren Cocktail oder Ihren Empfang in Zürich. Von Bach und Piaf bis Coldplay und Taylor Swift, auf Ihren Tag zugeschnitten."
    }
  }
};
