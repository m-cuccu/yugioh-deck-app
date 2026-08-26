import { supabase } from './supabaseClient';
import { cardThumbnail } from './ygoApi';

// Id delle carte possedute, come Set per lookup O(1) nella griglia.
export async function listOwnedCardIds(userId) {
  const { data, error } = await supabase.from('owned_cards').select('card_id').eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((r) => r.card_id));
}

export async function setCardOwned(userId, card, owned) {
  if (owned) {
    const { error } = await supabase
      .from('owned_cards')
      .upsert(
        { user_id: userId, card_id: card.id, card_name: card.name, card_image: cardThumbnail(card) || null },
        { onConflict: 'user_id,card_id' }
      );
    if (error) throw error;
  } else {
    const { error } = await supabase.from('owned_cards').delete().eq('user_id', userId).eq('card_id', card.id);
    if (error) throw error;
  }
}

export async function setCollectionVisibility(userId, isPublic) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ collection_public: isPublic })
    .eq('id', userId)
    .select('collection_public');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Aggiornamento non riuscito: permessi insufficienti sul profilo.');
  }
}

// Collezione di un altro utente: gia' denormalizzata (card_name/card_image), niente
// chiamata a YGOPRODeck per mostrarla.
export async function listOwnedCardsForUser(userId) {
  const { data, error } = await supabase
    .from('owned_cards')
    .select('card_id, card_name, card_image')
    .eq('user_id', userId)
    .order('card_name');
  if (error) throw error;
  return data;
}
