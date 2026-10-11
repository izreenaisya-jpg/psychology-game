-- GitHub Pages live backend. No table is directly accessible by browser roles.
create schema if not exists jom_private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
revoke all on schema jom_private from public, anon, authenticated;

create table jom_private.lecturers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Teacher Reen',
  enabled boolean not null default true
);
-- Only project administrators can add an approved email. Clients cannot write this list.
create table jom_private.approved_emails (
  email text primary key check(email=lower(email)),
  display_name text not null default 'Teacher Reen'
);
create table jom_private.questions (
  id text primary key, payload jsonb not null,
  core_order integer unique
);
create table jom_private.rooms (
  id uuid primary key default gen_random_uuid(), code text not null unique check (code ~ '^[0-9]{6}$'),
  owner_id uuid not null references jom_private.lecturers(user_id), title text not null,
  state text not null check (state in ('lobby','question','reveal','finished')),
  question_index integer not null default -1, deck jsonb not null,
  seconds integer not null check (seconds in (30,45,60,75)), speed_bonus boolean not null,
  created_at bigint not null, updated_at bigint not null,
  opened_at bigint, closes_at bigint, version integer not null default 0
);
create index rooms_owner_created on jom_private.rooms(owner_id, created_at desc);
create table jom_private.players (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references jom_private.rooms(id),
  nickname text not null check (char_length(nickname) between 1 and 24),
  name_key text not null, token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  joined_at bigint not null, unique(room_id,name_key), unique(room_id,token_hash), unique(id,room_id)
);
create table jom_private.answers (
  room_id uuid not null references jom_private.rooms(id), player_id uuid not null,
  question_index integer not null check (question_index between 0 and 19),
  choice integer not null check (choice between 0 and 3), answered_at bigint not null,
  elapsed_ms bigint not null, correct boolean not null, points integer not null check(points between 0 and 1200),
  primary key(room_id,player_id,question_index),
  foreign key(player_id,room_id) references jom_private.players(id,room_id)
);
alter table jom_private.lecturers enable row level security;
alter table jom_private.approved_emails enable row level security;
alter table jom_private.questions enable row level security;
alter table jom_private.rooms enable row level security;
alter table jom_private.players enable row level security;
alter table jom_private.answers enable row level security;
revoke all on all tables in schema jom_private from public, anon, authenticated;

create function jom_private.snapshot(r jom_private.rooms, t bigint, player uuid default null, host boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q jsonb := r.deck->r.question_index;
  revealed boolean := r.state in ('reveal','finished');
  cutoff integer := r.question_index + case when r.state='question' then 0 else 1 end;
  ranks jsonb; counts jsonb; result jsonb; me jsonb; answer jsonb; answered integer;
begin
  select coalesce(jsonb_agg(to_jsonb(s) order by s.score desc,s.correct_count desc,s.joined_at,s.id),'[]') into ranks from (
    select a.id,a.nickname,a.score,a.correct_count,rank() over(order by a.score desc,a.correct_count desc)::integer as rank,a.joined_at from (
      select p.id,p.nickname,p.joined_at,
        coalesce(sum(a.points) filter(where a.question_index<cutoff),0)::integer as score,
        count(*) filter(where a.question_index<cutoff and a.correct)::integer as correct_count
      from jom_private.players p left join jom_private.answers a on a.player_id=p.id and a.room_id=p.room_id
      where p.room_id=r.id group by p.id
    ) a
  ) s;
  -- joined_at is useful for stable display order but is not part of the public snapshot.
  select coalesce(jsonb_agg(v-'joined_at'),'[]') into ranks from jsonb_array_elements(ranks) v;
  select count(*)::integer into answered from jom_private.answers where room_id=r.id and question_index=r.question_index;
  result:=jsonb_build_object('code',r.code,'title',r.title,'state',r.state,'questionIndex',r.question_index,
    'total',jsonb_array_length(r.deck),'seconds',r.seconds,'speedBonus',r.speed_bonus,'now',t,
    'closesAt',r.closes_at,'openedAt',r.opened_at,'version',r.version,
    'acceptingAnswers',r.state='question' and t<r.closes_at,'players',ranks,
    'playerCount',jsonb_array_length(ranks),'answeredCount',answered,'maxPlayers',60);
  if q is not null and r.state<>'lobby' then
    result:=result||jsonb_build_object('question',q-'correct'-'explanation'-'follow');
    if revealed then result:=jsonb_set(result,'{question}',q); end if;
  end if;
  if revealed and q is not null then
    select jsonb_agg((select count(*) from jom_private.answers a where a.room_id=r.id and a.question_index=r.question_index and a.choice=i) order by i)
      into counts from generate_series(0,jsonb_array_length(q->'options')-1) i;
    result:=result||jsonb_build_object('distribution',counts);
  end if;
  if player is not null then
    select v into me from jsonb_array_elements(ranks) v where v->>'id'=player::text;
    select jsonb_build_object('choice',a.choice)||case when revealed then jsonb_build_object('points',a.points,'correct',a.correct) else '{}'::jsonb end
      into answer from jom_private.answers a where a.room_id=r.id and a.player_id=player and a.question_index=r.question_index;
    result:=result||jsonb_build_object('me',me||jsonb_build_object('answer',answer));
  end if;
  if host then result:=result||jsonb_build_object('isHost',true); end if;
  return result;
end;
$$;
revoke execute on function jom_private.snapshot(jom_private.rooms,bigint,uuid,boolean) from public,anon,authenticated;

-- The only browser-facing entry point. auth.uid() comes from a verified Supabase JWT.
-- Student bearer tokens are separate opaque values, never treated as lecturer identities.
create function public.jom_live(p_path text,p_method text default 'GET',p_body jsonb default '{}',p_player_token text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); approved boolean; teacher text;
  r jom_private.rooms; parts text[]:=string_to_array(p_path,'/'); action text;
  t bigint; result jsonb; status integer:=200; count_q integer; seconds_q integer;
  qs jsonb; code_new text; bytes bytea; n integer; nickname text; secret text; player uuid;
  idx integer; choice_q integer; old_choice integer; correct_q boolean; elapsed bigint; points_q integer;
  state_new text; index_new integer; opened bigint; closes bigint;
begin
  t:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  -- Bind an approved email to its verified Auth account. Never trust user_metadata roles.
  insert into jom_private.lecturers(user_id,display_name)
    select u.id,e.display_name from auth.users u join jom_private.approved_emails e on e.email=lower(u.email)
    where u.id=uid and u.email_confirmed_at is not null
    on conflict(user_id) do nothing;
  select l.enabled,l.display_name into approved,teacher from jom_private.lecturers l where l.user_id=uid;
  approved:=coalesce(approved,false);
  if p_method is null or p_method not in ('GET','POST') or p_path is null or jsonb_typeof(p_body) is distinct from 'object' or octet_length(p_body::text)>8192 then
    return jsonb_build_object('status',400,'body',jsonb_build_object('error','Invalid request.'));
  end if;
  if p_path='whoami' and p_method='GET' then
    return jsonb_build_object('status',200,'body',jsonb_build_object('authenticated',uid is not null,'authorized',approved,'displayName',coalesce(teacher,'')));
  end if;
  if (p_path in ('sessions','create') or parts[3] in ('host','control','results')) and not approved then
    return jsonb_build_object('status',case when uid is null then 401 else 403 end,'body',jsonb_build_object('error','Only an approved lecturer can host or view answer records.'));
  end if;
  if p_path='sessions' and p_method='GET' then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc),'[]') into result from (
      select r.code,r.title,r.state,r.question_index,r.created_at,(select count(*) from jom_private.players p where p.room_id=r.id) as player_count
      from jom_private.rooms r where r.owner_id=uid order by r.created_at desc limit 30
    ) s;
    return jsonb_build_object('status',200,'body',jsonb_build_object('sessions',result));
  end if;
  if p_path='create' and p_method='POST' then
    if coalesce(p_body->>'count','15') not in ('10','15','20') or coalesce(p_body->>'seconds','45') not in ('30','45','60','75') then
      raise exception using errcode='P0001',message='Choose the available question and timer settings.';
    end if;
    count_q:=coalesce(p_body->>'count','15')::integer; seconds_q:=coalesce(p_body->>'seconds','45')::integer;
    -- Serialize this lecturer's daily quota check and insert.
    perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
    if (select count(*) from jom_private.rooms where owner_id=uid and created_at>t-86400000)>=20 then
      return jsonb_build_object('status',429,'body',jsonb_build_object('error','Daily session limit reached.'));
    end if;
    select jsonb_agg(payload order by ord,random_order) into qs from (
      select payload,0 as ord,core_order::double precision as random_order from jom_private.questions where core_order is not null
      union all
      select payload,1 as ord,random() as random_order from jom_private.questions where core_order is null
    ) q;
    select jsonb_agg(v order by ord) into qs from jsonb_array_elements(qs) with ordinality x(v,ord) where ord<=count_q;
    if jsonb_array_length(qs) is distinct from count_q then raise exception 'Revision questions are not loaded.'; end if;
    for attempt in 1..8 loop
      loop
        bytes:=extensions.gen_random_bytes(3); n:=get_byte(bytes,0)*65536+get_byte(bytes,1)*256+get_byte(bytes,2);
        exit when n<16200000;
      end loop;
      code_new:=(100000+n%900000)::text;
      begin
        insert into jom_private.rooms(code,owner_id,title,state,deck,seconds,speed_bonus,created_at,updated_at)
          values(code_new,uid,coalesce(nullif(left(trim(p_body->>'title'),80),''),'Jom Philosophy · Live'),'lobby',qs,seconds_q,coalesce(p_body->'speedBonus'='true'::jsonb,false),t,t);
        return jsonb_build_object('status',201,'body',jsonb_build_object('code',code_new));
      exception when unique_violation then null;
      end;
    end loop;
    raise exception 'Please try creating the session again.';
  end if;
  if p_path='join' and p_method='POST' then code_new:=p_body->>'code';
  elsif array_length(parts,1) in (2,3) and parts[1]='rooms' then code_new:=parts[2]; action:=parts[3];
  else return jsonb_build_object('status',404,'body',jsonb_build_object('error','Not found.')); end if;
  if code_new is null or code_new !~ '^[0-9]{6}$' then raise exception using errcode='P0001',message='Enter the six-digit game PIN.'; end if;
  -- Every mutation locks the room, serializing joins, answers and host transitions.
  if p_method='POST' then select * into r from jom_private.rooms where code=code_new for update;
  else select * into r from jom_private.rooms where code=code_new for share; end if;
  if not found then return jsonb_build_object('status',404,'body',jsonb_build_object('error','That PIN was not found. Check it with your lecturer.')); end if;
  -- Use the time after the lock: waiting for another request cannot extend the deadline.
  t:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  if action in ('host','control','results') and r.owner_id is distinct from uid then
    return jsonb_build_object('status',403,'body',jsonb_build_object('error','Only the session host can open these records or control this game.'));
  end if;
  if p_path='join' then
    nickname:=trim(regexp_replace(regexp_replace(normalize(coalesce(p_body->>'nickname',''),NFKC),'[[:cntrl:]]','','g'),'\s+',' ','g'));
    if char_length(nickname) not between 1 and 24 then raise exception using errcode='P0001',message='Choose a display name of 1–24 characters.'; end if;
    if r.state<>'lobby' or t-r.created_at>28800000 then
      return jsonb_build_object('status',409,'body',jsonb_build_object('error','Joining is closed. Ask your lecturer to open a new game.'));
    end if;
    if (select count(*) from jom_private.players where room_id=r.id)>=60 then
      return jsonb_build_object('status',409,'body',jsonb_build_object('error','This lobby is full.'));
    end if;
    secret:=encode(extensions.gen_random_bytes(32),'hex');
    begin
      insert into jom_private.players(room_id,nickname,name_key,token_hash,joined_at)
        values(r.id,nickname,lower(nickname),encode(sha256(convert_to(secret,'UTF8')),'hex'),t) returning id into player;
    exception when unique_violation then
      return jsonb_build_object('status',409,'body',jsonb_build_object('error','That name is taken. Add an initial or a number.'));
    end;
    return jsonb_build_object('status',201,'body',jsonb_build_object('code',r.code,'playerId',player,'token',secret,'nickname',nickname));
  end if;
  if p_player_token ~ '^[a-f0-9]{64}$' then
    select id into player from jom_private.players where room_id=r.id and token_hash=encode(sha256(convert_to(p_player_token,'UTF8')),'hex');
  end if;
  if action is null and t-r.created_at>28800000 then
    return jsonb_build_object('status',410,'body',jsonb_build_object('error','This session link has expired. Your lecturer can still open the results.'));
  end if;
  if p_method='GET' and (action is null or action='host') then
    result:=jom_private.snapshot(r,t,player,action='host');
  elsif p_method='GET' and action='results' then
    select coalesce(jsonb_agg(jsonb_build_object('nickname',p.nickname,'question_index',a.question_index,'choice',a.choice,'correct',a.correct,'points',a.points,'answered_at',a.answered_at,'elapsed_ms',a.elapsed_ms) order by p.nickname,a.question_index),'[]')
      into result from jom_private.answers a join jom_private.players p on p.id=a.player_id and p.room_id=a.room_id where a.room_id=r.id;
    result:=jsonb_build_object('session',jom_private.snapshot(r,t,null,true),'questions',r.deck,'answers',result);
  elsif p_method='POST' and action='control' then
    if p_body->'version' is distinct from to_jsonb(r.version) then
      return jsonb_build_object('status',409,'body',jsonb_build_object('error','The session has changed. Refresh and try again.'));
    end if;
    if t-r.created_at>28800000 and p_body->>'action'<>'finish' then
      return jsonb_build_object('status',410,'body',jsonb_build_object('error','This session expired. Finish it and create a new game.'));
    end if;
    state_new:=r.state; index_new:=r.question_index; opened:=r.opened_at; closes:=r.closes_at;
    if p_body->>'action'='start' and r.state='lobby' then
      if not exists(select 1 from jom_private.players where room_id=r.id) then
        return jsonb_build_object('status',409,'body',jsonb_build_object('error','Wait for at least one player to join.'));
      end if;
      state_new:='question'; index_new:=0; opened:=t; closes:=t+r.seconds*1000;
    elsif p_body->>'action'='reveal' and r.state='question' then state_new:='reveal';
    elsif p_body->>'action'='next' and r.state='reveal' then
      if index_new>=jsonb_array_length(r.deck)-1 then state_new:='finished';
      else state_new:='question'; index_new:=index_new+1; opened:=t; closes:=t+r.seconds*1000; end if;
    elsif p_body->>'action'='finish' and r.state<>'finished' then state_new:='finished';
    else return jsonb_build_object('status',409,'body',jsonb_build_object('error','That action is not available in this round.')); end if;
    update jom_private.rooms set state=state_new,question_index=index_new,opened_at=opened,closes_at=closes,updated_at=t,version=version+1 where id=r.id returning * into r;
    result:=jom_private.snapshot(r,t,null,true);
  elsif p_method='POST' and action='answer' then
    if player is null then return jsonb_build_object('status',401,'body',jsonb_build_object('error','Rejoin with your saved player link.')); end if;
    if jsonb_typeof(p_body->'questionIndex') is distinct from 'number' or coalesce(p_body->>'questionIndex','') !~ '^(0|[1-9]|1[0-9])$'
      or jsonb_typeof(p_body->'choice') is distinct from 'number' or coalesce(p_body->>'choice','') !~ '^[0-3]$' then
      raise exception using errcode='P0001',message='Choose A, B, C or D for the current question.';
    end if;
    idx:=(p_body->>'questionIndex')::integer; choice_q:=(p_body->>'choice')::integer;
    select choice into old_choice from jom_private.answers where room_id=r.id and player_id=player and question_index=idx;
    if found then
      if old_choice<>choice_q then return jsonb_build_object('status',409,'body',jsonb_build_object('error','Your answer is already locked.')); end if;
    else
      if r.state<>'question' or r.question_index<>idx or t>=r.closes_at then
        return jsonb_build_object('status',409,'body',jsonb_build_object('error','Answers are closed for this question.'));
      end if;
      correct_q:=choice_q=(r.deck->idx->>'correct')::integer; elapsed:=greatest(0,t-r.opened_at);
      points_q:=case when correct_q then 1000+case when r.speed_bonus then greatest(0,round(200*(1-least(r.seconds*1000,elapsed)::numeric/(r.seconds*1000)))::integer) else 0 end else 0 end;
      insert into jom_private.answers values(r.id,player,idx,choice_q,t,elapsed,correct_q,points_q);
    end if;
    result:=jsonb_build_object('accepted',true,'choice',choice_q);
  else return jsonb_build_object('status',404,'body',jsonb_build_object('error','Not found.')); end if;
  return jsonb_build_object('status',status,'body',result);
exception
  when sqlstate 'P0001' then return jsonb_build_object('status',400,'body',jsonb_build_object('error',sqlerrm));
  when others then
    raise warning 'Jom live failure: %',sqlstate;
    return jsonb_build_object('status',500,'body',jsonb_build_object('error','The live game could not save this request. Please retry.'));
end;
$$;
revoke execute on function public.jom_live(text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.jom_live(text,text,jsonb,text) to anon,authenticated;
