export const MAX_COPIES = 3;
export const SECTIONS = ['main', 'extra', 'side'];

export function sectionLabel(section) {
  if (section === 'main') return 'Main Deck';
  if (section === 'extra') return 'Extra Deck';
  return 'Side Deck';
}

export function suggestionKindLabel(kind) {
  if (kind === 'add') return '+ Aggiunta';
  if (kind === 'remove') return '− Rimozione';
  return '⇄ Sostituzione';
}

export function suggestionStatusLabel(status) {
  if (status === 'accepted') return 'Accettato';
  if (status === 'rejected') return 'Rifiutato';
  return 'In attesa';
}

function totalCopiesOf(cards, cardId) {
  let total = 0;
  for (const section of SECTIONS) {
    for (const c of cards[section] || []) {
      if (c.card_id === cardId) total += c.quantity;
    }
  }
  return total;
}

// Applica un suggerimento a una composizione di deck.
// Non muta l'input: restituisce { nextCards } oppure { error } con un messaggio leggibile.
// maxCopiesForCard permette di applicare i limiti della banlist; senza, vale il limite standard di 3.
export function applySuggestionToCards(cards, suggestion, maxCopiesForCard) {
  const limitOf = maxCopiesForCard || (() => MAX_COPIES);
  const kind = suggestion.kind || 'replace';
  const section = suggestion.target_section;
  const list = cards[section] || [];

  if (kind === 'remove') {
    if (!list.some((c) => c.card_id === suggestion.target_card_id)) {
      return { error: 'La carta da rimuovere non è più nel deck.' };
    }
    const nextList = list
      .map((c) => (c.card_id === suggestion.target_card_id ? { ...c, quantity: c.quantity - 1 } : c))
      .filter((c) => c.quantity > 0);
    return { nextCards: { ...cards, [section]: nextList } };
  }

  const limit = limitOf(suggestion.suggested_card_id);
  if (totalCopiesOf(cards, suggestion.suggested_card_id) >= limit) {
    return {
      error:
        limit === 0
          ? `"${suggestion.suggested_card_name}" è vietata dalla banlist, impossibile applicare.`
          : `"${suggestion.suggested_card_name}" ha già il massimo di ${limit} copie consentite, impossibile applicare.`,
    };
  }

  let baseList = list;
  if (kind === 'replace') {
    if (!list.some((c) => c.card_id === suggestion.target_card_id)) {
      return { error: 'La carta da sostituire non è più nel deck.' };
    }
    baseList = list
      .map((c) => (c.card_id === suggestion.target_card_id ? { ...c, quantity: c.quantity - 1 } : c))
      .filter((c) => c.quantity > 0);
  }

  const existing = baseList.find((c) => c.card_id === suggestion.suggested_card_id);
  const nextList = existing
    ? baseList.map((c) =>
        c.card_id === suggestion.suggested_card_id ? { ...c, quantity: c.quantity + 1 } : c
      )
    : [
        ...baseList,
        {
          card_id: suggestion.suggested_card_id,
          card_name: suggestion.suggested_card_name,
          card_image: suggestion.suggested_card_image,
          quantity: 1,
          rarity_label: null,
        },
      ];

  return { nextCards: { ...cards, [section]: nextList } };
}
