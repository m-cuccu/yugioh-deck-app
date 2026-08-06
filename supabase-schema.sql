-- Yu-Gi-Oh Deck Builder — schema Supabase (Postgres)
-- Esegui questo script nel SQL Editor del progetto Supabase (Project > SQL Editor > New query)

-- 1. Profili pubblici (username per la ricerca amici)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "I profili sono leggibili da chiunque sia autenticato"
  on profiles for select
  to authenticated
  using (true);

create policy "Un utente crea solo il proprio profilo"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Un utente modifica solo il proprio profilo"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- Crea automaticamente il profilo (con username scelto in fase di registrazione)
-- non appena un nuovo utente viene creato in auth.users
create or replace function handle_new_user()
returns trigger as
$body$
declare
  base_username text;
  candidate text;
  suffix int := 0;
begin
  base_username := coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1));
  candidate := base_username;

  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username)
  values (new.id, candidate)
  on conflict (id) do nothing;

  return new;
end;
$body$
language plpgsql security definer set search_path = public;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- 2. Deck
create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table decks enable row level security;

create policy "Un utente vede i propri deck o quelli pubblici altrui"
  on decks for select
  to authenticated
  using (user_id = auth.uid() or is_public = true);

create policy "Un utente crea solo i propri deck"
  on decks for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Un utente modifica solo i propri deck"
  on decks for update
  to authenticated
  using (user_id = auth.uid());

create policy "Un utente elimina solo i propri deck"
  on decks for delete
  to authenticated
  using (user_id = auth.uid());

-- 3. Carte nel deck (main / extra / side)
create table if not exists deck_cards (
  id bigint generated always as identity primary key,
  deck_id uuid not null references decks(id) on delete cascade,
  card_id integer not null,
  card_name text not null,
  card_image text,
  section text not null check (section in ('main', 'extra', 'side')),
  quantity integer not null default 1 check (quantity > 0),
  rarity_label text
);

create index if not exists idx_deck_cards_deck_id on deck_cards(deck_id);

alter table deck_cards enable row level security;

create policy "Le carte sono visibili se il deck e proprio o pubblico"
  on deck_cards for select
  to authenticated
  using (
    exists (
      select 1 from decks
      where decks.id = deck_cards.deck_id
        and (decks.user_id = auth.uid() or decks.is_public = true)
    )
  );

create policy "Le carte si modificano solo sui propri deck"
  on deck_cards for all
  to authenticated
  using (
    exists (
      select 1 from decks
      where decks.id = deck_cards.deck_id
        and decks.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from decks
      where decks.id = deck_cards.deck_id
        and decks.user_id = auth.uid()
    )
  );

-- 4. Mantiene aggiornato updated_at sui deck
create or replace function set_updated_at()
returns trigger as
$body$
begin
  new.updated_at = now();
  return new;
end;
$body$
language plpgsql;

drop trigger if exists trg_decks_updated_at on decks;
create trigger trg_decks_updated_at
  before update on decks
  for each row
  execute function set_updated_at();

-- 5. Suggerimenti di carte sui deck pubblici altrui
-- kind = 'replace' (sostituisci target con suggested), 'add' (aggiungi suggested nella
-- sezione target_section) oppure 'remove' (togli target). I campi non pertinenti al tipo
-- di suggerimento restano NULL, per questo target_* e suggested_* sono nullable.
create table if not exists card_suggestions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'replace' check (kind in ('replace', 'add', 'remove')),
  target_card_id integer,
  target_card_name text,
  target_section text check (target_section in ('main', 'extra', 'side')),
  suggested_card_id integer,
  suggested_card_name text,
  suggested_card_image text,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_card_suggestions_deck_id on card_suggestions(deck_id);

alter table card_suggestions enable row level security;

create policy "Suggerimenti visibili se il deck e pubblico o proprio"
  on card_suggestions for select
  to authenticated
  using (
    exists (
      select 1 from decks
      where decks.id = card_suggestions.deck_id
        and (decks.is_public = true or decks.user_id = auth.uid())
    )
  );

create policy "Si puo suggerire solo su deck pubblici altrui"
  on card_suggestions for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from decks
      where decks.id = card_suggestions.deck_id
        and decks.is_public = true
        and decks.user_id <> auth.uid()
    )
  );

create policy "Autore o proprietario del deck eliminano il suggerimento"
  on card_suggestions for delete
  to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from decks
      where decks.id = card_suggestions.deck_id
        and decks.user_id = auth.uid()
    )
  );

-- 6. Rarita' scelta per ogni carta del deck (es. "Ultra Rare - Battle of Chaos")
alter table deck_cards add column if not exists rarity_label text;

-- 7. Suggerimenti anche di aggiunta/rimozione, non solo sostituzione
alter table card_suggestions add column if not exists kind text not null default 'replace';

alter table card_suggestions drop constraint if exists card_suggestions_kind_check;
alter table card_suggestions add constraint card_suggestions_kind_check
  check (kind in ('replace', 'add', 'remove'));

alter table card_suggestions alter column target_card_id drop not null;
alter table card_suggestions alter column target_card_name drop not null;
alter table card_suggestions alter column target_section drop not null;
alter table card_suggestions alter column suggested_card_id drop not null;
alter table card_suggestions alter column suggested_card_name drop not null;
