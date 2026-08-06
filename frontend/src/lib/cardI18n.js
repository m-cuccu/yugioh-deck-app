// L'API restituisce attributo, tipo mostro e tipo carta sempre in inglese, anche
// interrogando in italiano. Sono pero' insiemi chiusi e piccoli, quindi li traduciamo qui
// con i termini ufficiali italiani del gioco.

const ATTRIBUTES = {
  DARK: 'OSCURITÀ',
  LIGHT: 'LUCE',
  EARTH: 'TERRA',
  WATER: 'ACQUA',
  FIRE: 'FUOCO',
  WIND: 'VENTO',
  DIVINE: 'DIVINO',
};

// "race" per i mostri e' il tipo (Drago, Guerriero...), per magie/trappole e' la categoria
const RACES = {
  Aqua: 'Acqua',
  Beast: 'Bestia',
  'Beast-Warrior': 'Bestia Guerriera',
  'Creator-God': 'Divinità Creatrice',
  Cyberse: 'Cyberso',
  Dinosaur: 'Dinosauro',
  'Divine-Beast': 'Divinità Bestia',
  Dragon: 'Drago',
  Fairy: 'Fata',
  Fiend: 'Demone',
  Fish: 'Pesce',
  Illusion: 'Illusione',
  Insect: 'Insetto',
  Machine: 'Macchina',
  Plant: 'Pianta',
  Psychic: 'Psichico',
  Pyro: 'Piro',
  Reptile: 'Rettile',
  Rock: 'Roccia',
  'Sea Serpent': 'Serpente Marino',
  Spellcaster: 'Incantatore',
  Thunder: 'Tuono',
  Warrior: 'Guerriero',
  'Winged Beast': 'Bestia Alata',
  Wyrm: 'Wyrm',
  Zombie: 'Zombie',
  // categorie di magie e trappole
  Normal: 'Normale',
  Continuous: 'Continua',
  Equip: 'Equipaggiamento',
  'Quick-Play': 'Rapida',
  Field: 'Terreno',
  Ritual: 'Rituale',
  Counter: 'Contro',
};

// Pezzi che compongono il tipo carta, es. "Pendulum Tuner Effect Monster"
const TYPE_WORDS = {
  Normal: 'Normale',
  Effect: 'Effetto',
  Ritual: 'Rituale',
  Fusion: 'Fusione',
  Synchro: 'Synchro',
  XYZ: 'Xyz',
  Xyz: 'Xyz',
  Link: 'Link',
  Pendulum: 'Pendulum',
  Tuner: 'Tuner',
  Flip: 'Flip',
  Gemini: 'Gemini',
  Spirit: 'Spirito',
  Toon: 'Toon',
  Union: 'Unione',
  Token: 'Segnalino',
  Spell: 'Magia',
  Trap: 'Trappola',
  Skill: 'Abilità',
  // qualificatori di magie e trappole
  'Quick-Play': 'Rapida',
  Continuous: 'Continua',
  Equip: 'Equipaggiamento',
  Field: 'Terreno',
  Counter: 'Contro',
};

// Sostantivo che in italiano va anteposto ai qualificatori
const TYPE_HEADS = {
  Monster: 'Mostro',
  Card: 'Carta',
  Spell: 'Magia',
  Trap: 'Trappola',
};

function isItalian(lang) {
  return lang === 'it';
}

export function translateAttribute(attribute, lang) {
  if (!attribute || !isItalian(lang)) return attribute;
  return ATTRIBUTES[attribute.toUpperCase()] || attribute;
}

export function translateRace(race, lang) {
  if (!race || !isItalian(lang)) return race;
  return RACES[race] || race;
}

// "Normal Monster" -> "Mostro Normale", "Normal Spell" -> "Magia Normale":
// in italiano il sostantivo va davanti, quindi si stacca l'ultima parola e si girano.
export function translateCardType(type, lang) {
  if (!type || !isItalian(lang)) return type;

  const words = type.trim().split(/\s+/);
  const head = TYPE_HEADS[words[words.length - 1]];
  if (!head) return words.map((w) => TYPE_WORDS[w] || w).join(' ');

  const qualifiers = words.slice(0, -1).map((w) => TYPE_WORDS[w] || w);
  return [head, ...qualifiers].join(' ');
}
