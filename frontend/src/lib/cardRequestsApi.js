import { supabase } from './supabaseClient';

export async function listReceivedRequests(userId) {
  const { data, error } = await supabase
    .from('card_requests')
    .select('*, requester:profiles!card_requests_requester_id_fkey(username)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listSentRequests(userId) {
  const { data, error } = await supabase
    .from('card_requests')
    .select('*, owner:profiles!card_requests_owner_id_fkey(username)')
    .eq('requester_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Richieste gia' inviate a UN owner specifico: serve nella pagina Amici per disabilitare
// "Richiedi carta" sulle carte gia' richieste.
export async function listSentRequestsTo(requesterId, ownerId) {
  const { data, error } = await supabase
    .from('card_requests')
    .select('card_id, status')
    .eq('requester_id', requesterId)
    .eq('owner_id', ownerId);
  if (error) throw error;
  return data;
}

export async function createCardRequest(requesterId, ownerId, card) {
  const { error } = await supabase.from('card_requests').insert({
    requester_id: requesterId,
    owner_id: ownerId,
    card_id: card.id,
    card_name: card.name,
    card_image: card.image || null,
  });
  if (error) throw error;
}

export async function respondToCardRequest(requestId, status) {
  const { error } = await supabase
    .from('card_requests')
    .update({ status, seen_by_owner: true })
    .eq('id', requestId);
  if (error) throw error;
}

export async function markRequestsSeen(requestIds) {
  if (!requestIds?.length) return;
  const { error } = await supabase.from('card_requests').update({ seen_by_owner: true }).in('id', requestIds);
  if (error) throw error;
}

export async function deleteCardRequest(requestId) {
  const { error } = await supabase.from('card_requests').delete().eq('id', requestId);
  if (error) throw error;
}

export async function countUnreadRequests(userId) {
  const { count, error } = await supabase
    .from('card_requests')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .eq('status', 'pending')
    .eq('seen_by_owner', false);
  if (error) throw error;
  return count || 0;
}
