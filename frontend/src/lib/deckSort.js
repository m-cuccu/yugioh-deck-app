// Ordinamenti disponibili per le carte di un deck.
// I dati usati (tipo, livello, attacco) arrivano da fetchCardsByIds, non da deck_cards.

export const SORT_OPTIONS = [
  { key: 'manual', label: 'Ordine di inserimento' },
  { key: 'type', label: 'Tipo (mostri, magie, trappole)' },
  { key: 'name', label: 'Nome (A-Z)' },
  { key: 'level', label: 'Livello / Rank' },
  { key: 'atk', label: 'Attacco' },
];

// Nel gioco un deck si ordina per categoria: prima i mostri, poi le magie, poi le trappole.
function categoryRank(card) {
  const frame = card?.frameType || '';
  if (frame === 'spell') return 1;
  if (frame === 'trap') return 2;
  if (frame === 'skill' || frame === 'token') return 3;
  return 0; // qualunque tipo di mostro
}

// I mostri Link non hanno livello ma un valore Link, che qui vale come equivalente.
function levelOf(card) {
  if (!card) return -1;
  if (card.linkval != null) return card.linkval;
  return card.level ?? -1;
}

function nameOf(deckCard, info) {
  return info?.name || deckCard.card_name || '';
}

// cardInfo: Map<card_id, cardApiObject>. Se manca (dati non ancora arrivati) si
// ripiega sul nome salvato, cosi' l'ordinamento resta comunque stabile.
export function sortDeckCards(list, sortKey, cardInfo) {
  if (!sortKey || sortKey === 'manual') return list;

  const info = (c) => cardInfo?.get(c.card_id);
  const byName = (a, b) => nameOf(a, info(a)).localeCompare(nameOf(b, info(b)));

  const sorted = [...list];

  if (sortKey === 'name') {
    sorted.sort(byName);
  } else if (sortKey === 'level') {
    sorted.sort((a, b) => levelOf(info(b)) - levelOf(info(a)) || byName(a, b));
  } else if (sortKey === 'atk') {
    sorted.sort((a, b) => (info(b)?.atk ?? -1) - (info(a)?.atk ?? -1) || byName(a, b));
  } else if (sortKey === 'type') {
    sorted.sort(
      (a, b) =>
        categoryRank(info(a)) - categoryRank(info(b)) ||
        levelOf(info(b)) - levelOf(info(a)) ||
        byName(a, b)
    );
  }

  return sorted;
}
