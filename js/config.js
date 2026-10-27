// Standard-Variante von FinanzGame. Im Lehrpersonen-Editor anpassbar.
// Effekte: Zahlen pro Wert-ID (ungefähr: + = 5, ++ = 10). "geld" ist Franken.

export const DEFAULT_CONFIG = {
  name: "Standard",
  pinHash: "", // leer = Standard-PIN 1234
  scriptUrl: "", // URL der Google-Apps-Script-Web-App für die Bestenliste
  days: 28,
  startMoney: 150,
  moneyTarget: 300, // so viele Franken entsprechen dem Geld-Wert 100
  pocketMoney: 20, // Taschengeld jeden Montag
  interestPercent: 1, // Spiel-Zins pro Woche auf dem Sparkonto
  lowEnergyLimit: 20, // darunter wirken positive Effekte nur halb
  values: [
    { id: "geld", name: "Geld", icon: "💰", color: "#2e9d5b", money: true },
    { id: "zufriedenheit", name: "Zufriedenheit", icon: "😊", color: "#e6a118", start: 50 },
    { id: "wertstiftung", name: "Wertstiftung", icon: "🤝", color: "#8a4fd8", start: 40 },
    { id: "energie", name: "Energie", icon: "⚡", color: "#e2554f", start: 60, energy: true },
    { id: "beziehungen", name: "Beziehungen", icon: "❤️", color: "#2aa3c4", start: 50 }
  ],
  // Was jeden Tag ohnehin passiert
  drift: {
    everyDay: { zufriedenheit: -3, wertstiftung: -3, beziehungen: -3, energie: 8 },
    schoolDay: { energie: -11, beziehungen: 2 }
  },
  costs: [
    { name: "Handy-Abo (Anteil)", amount: 10, interval: "monat" },
    { name: "Znüni und Snacks", amount: 8, interval: "woche" }
  ],
  activities: [
    { id: "zeitungen", name: "Zeitungen austragen", icon: "🗞️", when: ["werktag-nachmittag", "wochenende-morgen"], money: 15,
      effects: { zufriedenheit: -3, wertstiftung: 3, energie: -8 } },
    { id: "nachhilfe", name: "Nachhilfe geben", icon: "📚", when: ["werktag-nachmittag", "werktag-abend", "wochenende-nachmittag"], money: 20,
      effects: { zufriedenheit: 2, wertstiftung: 7, energie: -7, beziehungen: 2 } },
    { id: "garten", name: "Gartenhilfe in der Nachbarschaft", icon: "🌱", when: ["wochenende-morgen", "wochenende-nachmittag"], money: 20,
      effects: { wertstiftung: 5, energie: -7, beziehungen: 3 } },
    { id: "babysitterkurs", name: "Babysitter-Kurs", icon: "🩹", when: ["wochenende-morgen", "wochenende-nachmittag"], money: -40,
      effects: { wertstiftung: 3, energie: -4 }, grants: { flag: "babysitter", delay: "nextWeek" }, once: true,
      info: "Ab nächster Woche kannst du babysitten." },
    { id: "babysitten", name: "Babysitten", icon: "👶", when: ["werktag-abend", "wochenende-abend"], money: 30,
      effects: { zufriedenheit: 2, wertstiftung: 6, energie: -6 }, requires: "babysitter", lockedInfo: "Braucht den Babysitter-Kurs" },
    { id: "kuchen", name: "Kuchenverkauf", icon: "🧁", when: ["wochenende-morgen", "wochenende-nachmittag"], money: 25,
      effects: { zufriedenheit: 4, wertstiftung: 5, energie: -6, beziehungen: 2 }, info: "Zutaten kosten Fr. 10, Verkauf bringt Fr. 35." },
    { id: "tierheim", name: "Freiwillig im Tierheim", icon: "🐶", when: ["werktag-nachmittag", "wochenende-morgen", "wochenende-nachmittag"], money: 0,
      effects: { zufriedenheit: 4, wertstiftung: 10, energie: -6, beziehungen: 2 } },
    { id: "familie", name: "Der Familie helfen", icon: "🍽️", when: ["werktag-nachmittag", "werktag-abend", "wochenende-morgen", "wochenende-nachmittag", "wochenende-abend"], money: 0,
      effects: { wertstiftung: 4, energie: -3, beziehungen: 8 } },
    { id: "lernen", name: "Für die Schule lernen", icon: "📖", when: ["werktag-nachmittag", "werktag-abend", "wochenende-nachmittag"], money: 0,
      effects: { zufriedenheit: 3, energie: -4 }, grants: { flag: "vorbereitet", delay: "now", duration: 4 },
      info: "Du bist ein paar Tage gut vorbereitet." },
    { id: "freunde", name: "Freundeskreis treffen", icon: "🍕", when: ["werktag-nachmittag", "werktag-abend", "wochenende-nachmittag", "wochenende-abend"], money: -10,
      effects: { zufriedenheit: 6, beziehungen: 8 } },
    { id: "sport", name: "Sport im Verein", icon: "⚽", when: ["werktag-nachmittag", "werktag-abend", "wochenende-morgen"], money: 0,
      effects: { zufriedenheit: 4, energie: 3, beziehungen: 3 } },
    { id: "gamen", name: "Gamen / Social Media", icon: "🎮", when: ["werktag-nachmittag", "werktag-abend", "wochenende-morgen", "wochenende-nachmittag", "wochenende-abend"], money: 0,
      effects: { zufriedenheit: 5, energie: -2, beziehungen: -2 } },
    { id: "ausruhen", name: "Ausruhen", icon: "🛋️", when: ["werktag-nachmittag", "werktag-abend", "wochenende-morgen", "wochenende-nachmittag", "wochenende-abend"], money: 0,
      effects: { zufriedenheit: 2, energie: 10 } },
    { id: "shoppen", name: "Shoppen", icon: "🛍️", when: ["werktag-nachmittag", "wochenende-nachmittag"], money: -30,
      effects: { zufriedenheit: 8 } },
    { id: "kino", name: "Kino mit dem Freundeskreis", icon: "🎬", when: ["werktag-abend", "wochenende-nachmittag", "wochenende-abend"], money: -18,
      effects: { zufriedenheit: 6, beziehungen: 5 } }
  ],
  events: [
    { id: "display", icon: "📱", text: "Dein Handy fällt runter. Das Display ist gesprungen.", options: [
      { label: "Reparieren lassen (Fr. 120)", money: -120 },
      { label: "Mit dem Sprung leben", effects: { zufriedenheit: -8 } } ] },
    { id: "hund", icon: "🐕", text: "Die Nachbarin fragt, ob du heute ihren Hund ausführst.", options: [
      { label: "Klar, mache ich (Fr. 15)", money: 15, effects: { wertstiftung: 5, energie: -4 } },
      { label: "Heute passt es nicht", effects: {} } ] },
    { id: "geburtstag", icon: "🎁", text: "Jemand aus deinem Freundeskreis hat Geburtstag.", options: [
      { label: "Geschenk kaufen (Fr. 20)", money: -20, effects: { beziehungen: 6 } },
      { label: "Selbst etwas basteln", effects: { beziehungen: 5, energie: -3, wertstiftung: 2 } } ] },
    { id: "sneaker", icon: "👟", text: "Sale! Die Sneaker, die du schon lange willst, kosten nur Fr. 80.", options: [
      { label: "Sofort kaufen", money: -80, effects: { zufriedenheit: 10 } },
      { label: "Nein, ich spare", effects: { zufriedenheit: -2 } } ] },
    { id: "pruefung_ok", group: "pruefung", icon: "📝", text: "Überraschungstest in Mathe! Zum Glück hast du gelernt.", condition: { flag: "vorbereitet" }, options: [
      { label: "Ruhig schreiben", effects: { zufriedenheit: 8 } } ] },
    { id: "pruefung", group: "pruefung", icon: "📝", text: "Morgen ist ein Mathetest und du hast noch nicht gelernt.", condition: { flag: "vorbereitet", not: true }, options: [
      { label: "Bis spät in die Nacht lernen", effects: { energie: -12, zufriedenheit: 2 } },
      { label: "Wird schon gut gehen", effects: { zufriedenheit: -8 } } ] },
    { id: "grosi", icon: "💌", text: "Dein Grosi schickt dir Fr. 50.", options: [
      { label: "Aufs Sparkonto legen", savings: 50 },
      { label: "Behalten und ausgeben", money: 50, effects: { zufriedenheit: 3 } } ] },
    { id: "mathe", icon: "🧮", text: "Jemand aus deiner Klasse versteht die Mathe-Aufgaben nicht.", options: [
      { label: "Gratis helfen", effects: { wertstiftung: 6, beziehungen: 4, energie: -4 } },
      { label: "Helfen für Fr. 10", money: 10, effects: { wertstiftung: 3, beziehungen: -2, energie: -4 } } ] },
    { id: "erkaeltung", icon: "🤧", text: "Du bist erkältet.", options: [
      { label: "Zu Hause auskurieren", effects: { energie: 6, zufriedenheit: -4 } },
      { label: "Trotzdem alles machen", effects: { energie: -10, zufriedenheit: 2 } } ] },
    { id: "spende", icon: "❤️", text: "Die Schule sammelt Geld für ein Hilfsprojekt.", options: [
      { label: "Fr. 10 spenden", money: -10, effects: { wertstiftung: 6, zufriedenheit: 2 } },
      { label: "Beim Organisieren helfen", effects: { wertstiftung: 7, beziehungen: 3, energie: -4 } },
      { label: "Nicht mitmachen", effects: {} } ] },
    { id: "streaming", icon: "📺", text: "Ein Streaming-Dienst bietet ein Abo für Fr. 12 pro Monat an.", options: [
      { label: "Abonnieren", effects: { zufriedenheit: 6 }, addCost: { name: "Streaming-Abo", amount: 12, interval: "monat" } },
      { label: "Brauche ich nicht", effects: {} } ] },
    { id: "streit", icon: "😤", text: "Zu Hause gibt es Streit, weil dein Zimmer unordentlich ist.", options: [
      { label: "Aussprechen und aufräumen", effects: { beziehungen: 6, energie: -3 } },
      { label: "Kopfhörer rein", effects: { beziehungen: -7, zufriedenheit: 1 } } ] },
    { id: "turnier", icon: "🏆", text: "Dein Verein sucht Helfende für das Turnier am Wochenende.", options: [
      { label: "Ich helfe mit", effects: { wertstiftung: 8, beziehungen: 4, energie: -6 } },
      { label: "Absagen", effects: { beziehungen: -2 } } ] },
    { id: "velo", icon: "🚲", text: "Dein Velo hat einen Platten.", options: [
      { label: "Selbst flicken (Fr. 5)", money: -5, effects: { energie: -3, zufriedenheit: 3 } },
      { label: "In die Werkstatt (Fr. 25)", money: -25 } ] }
  ],
  questions: [
    "Welche Entscheidung hat dir diese Woche am meisten gebracht? Warum?",
    "Welcher Wert war am schwierigsten im Gleichgewicht zu halten?",
    "Wo hast du für andere Wert geschaffen? Hat es dir auch etwas gebracht?",
    "Was würdest du nächsten Monat anders machen?"
  ]
};
