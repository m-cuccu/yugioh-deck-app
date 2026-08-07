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
    .select('*, deck_cards(section, quantity), card_suggestions(id, status)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map((d) => ({
    ...d,
    counts: countBySection(d.deck_cards),
    pendingSuggestions: (d.card_suggestions || []).filter((s) => (s.status || 'pending') === 'pending')
      .length,
  }));
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

export async function listSuggestions(deckId, userId) {
  const { data, error } = await supabase
    .from('card_suggestions')
    .select(`*, ${SUGGESTION_AUTHOR}, ${THREAD_FIELDS}`)
    .eq('deck_id', deckId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return userId ? data.map((s) => withThreadInfo(s, userId)) : data;
}

export async function listSuggestionMessages(suggestionId) {
  const { data, error } = await supabase
    .from('suggestion_messages')
    .select('*, profiles(username)')
    .eq('suggestion_id', suggestionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function postSuggestionMessage(suggestionId, authorId, body) {
  const text = body.trim();
  if (!text) return;
  const { error } = await supabase
    .from('suggestion_messages')
    .insert({ suggestion_id: suggestionId, author_id: authorId, body: text });
  if (error) throw error;
}

export async function deleteSuggestionMessage(messageId) {
  const { error } = await supabase.from('suggestion_messages').delete().eq('id', messageId);
  if (error) throw error;
}

// Segna la discussione come letta fino a ora
export async function markThreadRead(suggestionId, userId) {
  const { error } = await supabase
    .from('suggestion_reads')
    .upsert(
      { suggestion_id: suggestionId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: 'suggestion_id,user_id' }
    );
  if (error) throw error;
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

// Il proprietario risponde: il suggerimento resta in archivio con l'esito,
// cosi' chi l'ha inviato capisce com'e' andata.
export async function respondToSuggestion(suggestionId, status, responseComment) {
  const { error } = await supabase
    .from('card_suggestions')
    .update({
      status,
      response_comment: responseComment?.trim() || null,
      responded_at: new Date().toISOString(),
      seen_by_owner: true,
    })
    .eq('id', suggestionId);
  if (error) throw error;
}

// Campi della discussione: messaggi (solo i metadati, il testo si carica aprendo il thread)
// e il mio segnaposto di lettura, per capire quali risposte sono nuove.
const THREAD_FIELDS = 'suggestion_messages(id, created_at, author_id), suggestion_reads(user_id, last_read_at)';

// suggestion_reads collega card_suggestions a profiles anche per un'altra via, quindi
// senza indicare il vincolo PostgREST non sa quale relazione usare e risponde 300.
// L'alias esplicito garantisce che la chiave nella risposta resti `profiles`.
const SUGGESTION_AUTHOR = 'profiles:profiles!card_suggestions_author_id_fkey(username)';

// Tutti i suggerimenti ricevuti sui deck dell'utente (per la pagina dedicata)
export async function listIncomingSuggestions(userId) {
  const { data, error } = await supabase
    .from('card_suggestions')
    .select(`*, ${SUGGESTION_AUTHOR}, decks!inner(id, name, user_id), ${THREAD_FIELDS}`)
    .eq('decks.user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((s) => withThreadInfo(s, userId));
}

// Suggerimenti inviati dall'utente ad altri, con il relativo esito
export async function listSentSuggestions(userId) {
  const { data, error } = await supabase
    .from('card_suggestions')
    .select(`*, ${SUGGESTION_AUTHOR}, decks(id, name), ${THREAD_FIELDS}`)
    .eq('author_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((s) => withThreadInfo(s, userId));
}

// Conteggio dei messaggi altrui successivi alla mia ultima lettura.
// Si calcola qui invece che nel database per non introdurre una funzione SQL dedicata.
function withThreadInfo(suggestion, userId) {
  const messages = suggestion.suggestion_messages || [];
  const myRead = (suggestion.suggestion_reads || []).find((r) => r.user_id === userId);
  const since = myRead ? new Date(myRead.last_read_at).getTime() : 0;

  const unreadMessages = messages.filter(
    (m) => m.author_id !== userId && new Date(m.created_at).getTime() > since
  ).length;

  return { ...suggestion, messageCount: messages.length, unreadMessages };
}

// Il badge somma due cose: i suggerimenti nuovi sui miei deck e le risposte non lette
// nelle discussioni a cui partecipo (sia come proprietario che come autore).
export async function countUnreadSuggestions(userId) {
  const { count, error } = await supabase
    .from('card_suggestions')
    .select('id, decks!inner(user_id)', { count: 'exact', head: true })
    .eq('decks.user_id', userId)
    .eq('status', 'pending')
    .eq('seen_by_owner', false);
  if (error) throw error;

  const [incoming, sent] = await Promise.all([
    listIncomingSuggestions(userId).catch(() => []),
    listSentSuggestions(userId).catch(() => []),
  ]);

  const threads = new Map();
  for (const s of [...incoming, ...sent]) threads.set(s.id, s.unreadMessages || 0);
  const unreadReplies = [...threads.values()].reduce((sum, n) => sum + (n > 0 ? 1 : 0), 0);

  return (count || 0) + unreadReplies;
}

export async function markSuggestionsSeen(suggestionIds) {
  if (!suggestionIds || suggestionIds.length === 0) return;
  const { error } = await supabase
    .from('card_suggestions')
    .update({ seen_by_owner: true })
    .in('id', suggestionIds);
  if (error) throw error;
}

const MAX_VERSIONS_PER_DECK = 20;

// Snapshot della composizione del deck. Ne teniamo solo gli ultimi MAX_VERSIONS_PER_DECK
// per deck, altrimenti lo storico crescerebbe all'infinito.
export async function createDeckVersion(deckId, cardsBySection, label) {
  const snapshot = {};
  for (const section of SECTIONS) {
    snapshot[section] = (cardsBySection[section] || []).map((c) => ({
      card_id: c.card_id,
      card_name: c.card_name,
      card_image: c.card_image ?? null,
      quantity: c.quantity,
      rarity_label: c.rarity_label ?? null,
    }));
  }

  const { error } = await supabase
    .from('deck_versions')
    .insert({ deck_id: deckId, label: label || null, cards: snapshot });
  if (error) throw error;

  const { data: older } = await supabase
    .from('deck_versions')
    .select('created_at')
    .eq('deck_id', deckId)
    .order('created_at', { ascending: false })
    .range(MAX_VERSIONS_PER_DECK, MAX_VERSIONS_PER_DECK);

  if (older && older.length > 0) {
    await supabase.from('deck_versions').delete().eq('deck_id', deckId).lte('created_at', older[0].created_at);
  }
}

export async function listDeckVersions(deckId) {
  const { data, error } = await supabase
    .from('deck_versions')
    .select('*')
    .eq('deck_id', deckId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
