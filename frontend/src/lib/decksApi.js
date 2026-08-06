import { supabase } from './supabaseClient';

const SECTIONS = ['main', 'extra', 'side'];

function countBySection(cards) {
  const counts = { main: 0, extra: 0, side: 0 };
  for (const c of cards || []) counts[c.section] += c.quantity;
  return counts;
}

export async function listMyDecks(userId) {
  const { data, error } = await supabase
    .from('decks')
    .select('*, deck_cards(section, quantity)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map((d) => ({ ...d, counts: countBySection(d.deck_cards) }));
}

export async function getDeck(deckId) {
  const { data: deck, error } = await supabase.from('decks').select('*').eq('id', deckId).single();
  if (error) throw error;

  const { data: cards, error: cardsError } = await supabase
    .from('deck_cards')
    .select('*')
    .eq('deck_id', deckId)
    .order('id');
  if (cardsError) throw cardsError;

  const grouped = { main: [], extra: [], side: [] };
  for (const c of cards) grouped[c.section].push(c);

  return { ...deck, cards: grouped };
}

export async function createDeck(userId, name) {
  const { data, error } = await supabase
    .from('decks')
    .insert({ user_id: userId, name: name || 'Nuovo Deck' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameDeck(deckId, name) {
  const { error } = await supabase.from('decks').update({ name }).eq('id', deckId);
  if (error) throw error;
}

export async function setDeckVisibility(deckId, isPublic) {
  const { error } = await supabase.from('decks').update({ is_public: isPublic }).eq('id', deckId);
  if (error) throw error;
}

export async function deleteDeck(deckId) {
  const { error } = await supabase.from('decks').delete().eq('id', deckId);
  if (error) throw error;
}

export async function duplicateDeck(userId, deckId) {
  const source = await getDeck(deckId);
  const newDeck = await createDeck(userId, `${source.name} (copia)`);

  const rows = SECTIONS.flatMap((section) =>
    source.cards[section].map((c) => ({
      deck_id: newDeck.id,
      card_id: c.card_id,
      card_name: c.card_name,
      card_image: c.card_image,
      section,
      quantity: c.quantity,
      rarity_label: c.rarity_label,
    }))
  );

  if (rows.length > 0) {
    const { error } = await supabase.from('deck_cards').insert(rows);
    if (error) throw error;
  }

  return newDeck;
}

// cardsBySection: { main: [...], extra: [...], side: [...] }
export async function saveDeckCards(deckId, cardsBySection) {
  const { error: deleteError } = await supabase.from('deck_cards').delete().eq('deck_id', deckId);
  if (deleteError) throw deleteError;

  const rows = SECTIONS.flatMap((section) =>
    (cardsBySection[section] || []).map((c) => ({
      deck_id: deckId,
      card_id: c.card_id,
      card_name: c.card_name,
      card_image: c.card_image,
      section,
      quantity: c.quantity,
      rarity_label: c.rarity_label || null,
    }))
  );

  if (rows.length > 0) {
    const { error } = await supabase.from('deck_cards').insert(rows);
    if (error) throw error;
  }

  await supabase.from('decks').update({ updated_at: new Date().toISOString() }).eq('id', deckId);
}

export async function searchProfilesByUsername(query, excludeUserId) {
  const q = query.trim();
  if (!q) return [];
  let request = supabase.from('profiles').select('id, username').ilike('username', `%${q}%`).limit(20);
  if (excludeUserId) request = request.neq('id', excludeUserId);
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

// Utenti iscritti di recente, mostrati nella pagina Amici prima di cercare
export async function listRecentProfiles(excludeUserId, limit = 30) {
  let request = supabase
    .from('profiles')
    .select('id, username')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (excludeUserId) request = request.neq('id', excludeUserId);
  const { data, error } = await request;
  if (error) throw error;
  return data;
}

export async function listPublicDecksByUser(userId) {
  const { data, error } = await supabase
    .from('decks')
    .select('*, deck_cards(section, quantity)')
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map((d) => ({ ...d, counts: countBySection(d.deck_cards) }));
}

export async function listSuggestions(deckId) {
  const { data, error } = await supabase
    .from('card_suggestions')
    .select('*, profiles(username)')
    .eq('deck_id', deckId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// payload.kind: 'replace' | 'add' | 'remove'
export async function createSuggestion(deckId, authorId, payload) {
  const { error } = await supabase.from('card_suggestions').insert({
    deck_id: deckId,
    author_id: authorId,
    kind: payload.kind || 'replace',
    target_card_id: payload.targetCardId ?? null,
    target_card_name: payload.targetCardName ?? null,
    target_section: payload.targetSection ?? null,
    suggested_card_id: payload.suggestedCardId ?? null,
    suggested_card_name: payload.suggestedCardName ?? null,
    suggested_card_image: payload.suggestedCardImage || null,
    comment: payload.comment || null,
  });
  if (error) throw error;
}

export async function deleteSuggestion(suggestionId) {
  const { error } = await supabase.from('card_suggestions').delete().eq('id', suggestionId);
  if (error) throw error;
}
