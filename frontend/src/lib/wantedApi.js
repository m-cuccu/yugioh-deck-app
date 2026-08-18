import { supabase } from './supabaseClient';

// Annunci "AAA Cercasi". L'autore si legge esplicitamente dal vincolo perche' piu' tabelle
// collegate (offerte, messaggi) puntano a profiles, il che renderebbe l'embed ambiguo.
const POST_AUTHOR = 'profiles:profiles!wanted_posts_author_id_fkey(username)';
const OFFERS = 'wanted_offers(user_id, created_at, profiles(username))';

function withCounts(post, userId) {
  const offers = post.wanted_offers || [];
  return {
    ...post,
    offers,
    offerCount: offers.length,
    iHaveIt: offers.some((o) => o.user_id === userId),
    isMine: post.author_id === userId,
  };
}

// status: 'open' | 'closed' | 'all'
export async function listWantedPosts(userId, { status = 'open', mineOnly = false } = {}) {
  let request = supabase
    .from('wanted_posts')
    .select(`*, ${POST_AUTHOR}, ${OFFERS}`)
    .order('created_at', { ascending: false });

  if (status !== 'all') request = request.eq('status', status);
  if (mineOnly) request = request.eq('author_id', userId);

  const { data, error } = await request;
  if (error) throw error;
  return data.map((p) => withCounts(p, userId));
}

export async function createWantedPost(userId, payload) {
  const { data, error } = await supabase
    .from('wanted_posts')
    .insert({
      author_id: userId,
      card_id: payload.cardId,
      card_name: payload.cardName,
      card_image: payload.cardImage || null,
      quantity: payload.quantity || 1,
      note: payload.note?.trim() || null,
      rarity_label: payload.rarityLabel || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWantedPost(postId, changes) {
  const { error } = await supabase.from('wanted_posts').update(changes).eq('id', postId);
  if (error) throw error;
}

export async function deleteWantedPost(postId) {
  const { error } = await supabase.from('wanted_posts').delete().eq('id', postId);
  if (error) throw error;
}

// "Ce l'ho": una sola dichiarazione per persona, quindi si aggiunge o si toglie
export async function setWantedOffer(postId, userId, offering) {
  if (offering) {
    const { error } = await supabase
      .from('wanted_offers')
      .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id' });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('wanted_offers')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

export async function listWantedMessages(postId) {
  const { data, error } = await supabase
    .from('wanted_messages')
    .select('*, profiles(username)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function postWantedMessage(postId, authorId, body) {
  const text = body.trim();
  if (!text) return;
  const { error } = await supabase
    .from('wanted_messages')
    .insert({ post_id: postId, author_id: authorId, body: text });
  if (error) throw error;
}

export async function deleteWantedMessage(messageId) {
  const { error } = await supabase.from('wanted_messages').delete().eq('id', messageId);
  if (error) throw error;
}
