-- Futsal app online storage. Paste this whole file once in
-- Supabase > SQL Editor > New query > Run. Running it again is safe.
--
-- How access works: the tables are closed to the public. The app only talks
-- to the functions below, and each function needs the player's secret token
-- (the one inside their personal link). Marwan sees everything from the
-- dashboard (Table Editor), which is not limited by these rules.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  auth_uid   uuid unique,                      -- set for players who signed in by email
  token      uuid unique not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

create table if not exists matches (
  player_id  uuid not null references players on delete cascade,
  id         text not null,                    -- match start time in ms (same id as the app)
  track      jsonb not null,                   -- the parsed GPX (points, time, speed, heart rate)
  settings   jsonb,                            -- goal side, breaks, goalkeeper spells...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, id)
);

create table if not exists player_meta (
  player_id  uuid not null references players on delete cascade,
  key        text not null,                    -- 'profile' or 'thresholds'
  value      jsonb,
  updated_at timestamptz not null default now(),
  primary key (player_id, key)
);

alter table players     enable row level security;
alter table matches     enable row level security;
alter table player_meta enable row level security;
revoke all on players, matches, player_meta from anon, authenticated;

-- ---------- Easy view for Marwan (Table Editor > matches_overview) ----------

create or replace view matches_overview with (security_invoker = true) as
select p.name                                                        as player,
       p.email,
       m.settings ->> 'label'                                        as match,
       to_timestamp((m.track ->> 'startTime')::bigint / 1000.0)      as played_at,
       round(((m.track -> 'points' -> -1 ->> 't')::numeric) / 60)    as minutes,
       m.created_at                                                  as uploaded_at
from matches m join players p on p.id = m.player_id
order by m.created_at desc;
revoke all on matches_overview from anon, authenticated;

-- ---------- Functions the app calls ----------

-- Token -> player id, or an error if the token is unknown.
create or replace function _player(p_token uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  update players set last_seen = now() where token = p_token returning id into v;
  if v is null then raise exception 'unknown player'; end if;
  return v;
end $$;
revoke all on function _player(uuid) from public, anon, authenticated;

-- Sign up by name only. Returns the secret token for the personal link.
create or replace function create_player(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if coalesce(length(trim(p_name)), 0) not between 1 and 60 then raise exception 'bad name'; end if;
  insert into players (name) values (trim(p_name)) returning token into v;
  return v;
end $$;

-- Sign in by email (after the email code was verified). Finds or creates the
-- player linked to this email login and returns their token and name.
create or replace function email_player(p_name text) returns table (token uuid, name text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare uid uuid := auth.uid(); mail text := auth.jwt() ->> 'email';
begin
  if uid is null then raise exception 'not signed in'; end if;
  insert into players (name, email, auth_uid)
  values (coalesce(nullif(trim(p_name), ''), split_part(mail, '@', 1)), mail, uid)
  on conflict (auth_uid) do update set last_seen = now();
  return query select p.token, p.name from players p where p.auth_uid = uid;
end $$;

-- Everything saved for this player.
create or replace function pull(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid := _player(p_token);
begin
  return jsonb_build_object(
    'name',    (select name from players where id = pid),
    'email',   (select email from players where id = pid),
    'matches', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'track', track, 'settings', settings))
                         from matches where player_id = pid), '[]'::jsonb),
    'meta',    coalesce((select jsonb_object_agg(key, value) from player_meta where player_id = pid), '{}'::jsonb));
end $$;

-- Save a match. p_track may be null to update only the settings.
create or replace function save_match(p_token uuid, p_id text, p_track jsonb, p_settings jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid := _player(p_token);
begin
  if p_track is null then
    update matches set settings = p_settings, updated_at = now() where player_id = pid and id = p_id;
  else
    insert into matches (player_id, id, track, settings) values (pid, p_id, p_track, p_settings)
    on conflict (player_id, id) do update
      set track = excluded.track, settings = coalesce(excluded.settings, matches.settings), updated_at = now();
  end if;
end $$;

create or replace function delete_match(p_token uuid, p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from matches where player_id = _player(p_token) and id = p_id;
end $$;

create or replace function save_meta(p_token uuid, p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid := _player(p_token);
begin
  if p_key not in ('profile', 'thresholds') then raise exception 'bad key'; end if;
  insert into player_meta (player_id, key, value) values (pid, p_key, p_value)
  on conflict (player_id, key) do update set value = excluded.value, updated_at = now();
end $$;

grant execute on function create_player(text), email_player(text), pull(uuid),
  save_match(uuid, text, jsonb, jsonb), delete_match(uuid, text), save_meta(uuid, text, jsonb)
  to anon, authenticated;
