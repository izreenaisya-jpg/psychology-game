-- Future games sample enabled revision questions uniformly, without replacement.
-- Existing decks and student records remain immutable; removal is recoverable.
alter table jom_private.questions
  add column enabled boolean not null default true,
  add column chapter smallint check (chapter in (4,5,6)),
  add column version integer not null default 0 check (version >= 0);
-- Retain the former fixed core for lecturer review; activate the 90 scoped revisions.
update jom_private.questions set enabled=false where core_order is not null;
alter table jom_private.rooms add column removed_at bigint;

-- Private helper: no direct browser execution or new exposed privileged function.
create function jom_private.question_bank_api(p_path text,p_method text,p_body jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid:=auth.uid(); q jom_private.questions; item jsonb; result jsonb;
  question_id text; chapter_q smallint; option_count integer;
begin
  if not exists(select 1 from jom_private.lecturers l where l.user_id=uid and l.enabled) then
    return jsonb_build_object('status',case when uid is null then 401 else 403 end,'body',jsonb_build_object('error','Only an approved lecturer can manage the question bank.'));
  end if;
  if p_path='questions' and p_method='GET' then
    select coalesce(jsonb_agg(jsonb_build_object('id',bank.id,'payload',bank.payload,'enabled',bank.enabled,'chapter',bank.chapter,'version',bank.version) order by bank.id),'[]')
      into result from jom_private.questions bank;
    return jsonb_build_object('status',200,'body',jsonb_build_object('questions',result));
  end if;
  if p_path<>'questions/save' or p_method<>'POST' then
    return jsonb_build_object('status',404,'body',jsonb_build_object('error','Not found.'));
  end if;
  item:=p_body->'payload';
  if jsonb_typeof(item) is distinct from 'object'
    or jsonb_typeof(item->'stem') is distinct from 'string' or coalesce(char_length(trim(item->>'stem')),0) not between 1 and 1000
    or jsonb_typeof(item->'explanation') is distinct from 'string' or coalesce(char_length(trim(item->>'explanation')),0) not between 1 and 1500
    or jsonb_typeof(item->'correct') is distinct from 'number' or coalesce(item->>'correct','') !~ '^[0-3]$'
    or jsonb_typeof(item->'options') is distinct from 'array'
    or jsonb_typeof(p_body->'enabled') is distinct from 'boolean' then
    raise exception using errcode='P0001',message='Enter a question, four choices, one correct answer and an explanation.';
  end if;
  if jsonb_array_length(item->'options')<>4 or exists(
    select 1 from jsonb_array_elements(item->'options') opt
    where jsonb_typeof(opt) is distinct from 'string' or char_length(trim(opt#>>'{}')) not between 1 and 500
  ) then raise exception using errcode='P0001',message='Enter four choices of 1–500 characters each.'; end if;
  select count(distinct lower(trim(opt))) into option_count from jsonb_array_elements_text(item->'options') opt;
  if option_count<>4 then raise exception using errcode='P0001',message='The four choices must be different.'; end if;
  if p_body->'chapter' is not null and p_body->'chapter'<>'null'::jsonb then
    if jsonb_typeof(p_body->'chapter') is distinct from 'number' or coalesce(p_body->>'chapter','') not in ('4','5','6') then
      raise exception using errcode='P0001',message='Choose Chapter 4, 5, 6 or mixed Chapters 4–6.';
    end if;
    chapter_q:=(p_body->>'chapter')::smallint;
  end if;
  if exists(select 1 from jsonb_each(item) field where field.key in ('tag','follow','claim') and
    (jsonb_typeof(field.value) is distinct from 'string' or char_length(field.value#>>'{}')>case when field.key='tag' then 60 else 500 end)) then
    raise exception using errcode='P0001',message='Keep the topic under 60 characters and discussion or AI claim under 500.';
  end if;
  question_id:=nullif(trim(p_body->>'id'),'');
  if question_id is not null then
    select * into q from jom_private.questions bank where bank.id=question_id for update;
    if not found then return jsonb_build_object('status',404,'body',jsonb_build_object('error','This question was not found. Reload the bank.')); end if;
    if p_body->'version' is distinct from to_jsonb(q.version) then
      return jsonb_build_object('status',409,'body',jsonb_build_object('error','This question changed in another tab. Reload before editing.'));
    end if;
  else question_id:='custom-'||gen_random_uuid()::text; end if;
  -- Whitelist educational fields. Client IDs, role hints and unknown fields are discarded.
  item:=jsonb_build_object('id',question_id,'stem',trim(item->>'stem'),'options',
    (select jsonb_agg(trim(opt) order by ord) from jsonb_array_elements_text(item->'options') with ordinality choices(opt,ord)),
    'correct',(item->>'correct')::integer,'explanation',trim(item->>'explanation'),
    'tag',coalesce(nullif(trim(item->>'tag'),''),'Revision challenge'),
    'follow',coalesce(nullif(trim(item->>'follow'),''),'Explain why the correct option fits, and why one other option does not.'))
    ||case when nullif(trim(item->>'claim'),'') is not null then jsonb_build_object('claim',trim(item->>'claim')) else '{}'::jsonb end;
  if q.id is null then
    insert into jom_private.questions(id,payload,enabled,chapter) values(question_id,item,(p_body->>'enabled')::boolean,chapter_q) returning * into q;
  else
    update jom_private.questions bank set payload=item,enabled=(p_body->>'enabled')::boolean,chapter=chapter_q,version=bank.version+1 where bank.id=question_id returning * into q;
  end if;
  return jsonb_build_object('status',200,'body',jsonb_build_object('question',jsonb_build_object('id',q.id,'payload',q.payload,'enabled',q.enabled,'chapter',q.chapter,'version',q.version)));
end;
$$;
revoke execute on function jom_private.question_bank_api(text,text,jsonb) from public,anon,authenticated;

-- Fail closed if the deployed RPC differs from the reviewed version. These narrow
-- replacements retain all token, deadline, scoring, approval and owner checks.
do $migration$
declare
  definition text:=pg_get_functiondef('jom_private.live_api(text,text,jsonb,text)'::regprocedure);
  old_part text; new_part text;
begin
  old_part:=$old0$if (p_path in ('sessions','create') or parts[3] in ('host','control','results')) and not approved then$old0$;
  new_part:=$new0$if (p_path in ('sessions','create','questions','questions/save') or parts[3] in ('host','control','results','remove','restore')) and not approved then$new0$;
  if strpos(definition,old_part)=0 or strpos(definition,new_part)>0 then
    raise exception 'Unexpected live_api definition at change 0; inspect before applying.';
  end if;
  definition:=replace(definition,old_part,new_part);
  old_part:=$old1$  if p_path='sessions' and p_method='GET' then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc),'[]') into result from (
      select session_room.code,session_room.title,session_room.state,session_room.question_index,session_room.created_at,(select count(*) from jom_private.players p where p.room_id=session_room.id) as player_count
      from jom_private.rooms session_room where session_room.owner_id=uid order by session_room.created_at desc limit 30
    ) s;
    return jsonb_build_object('status',200,'body',jsonb_build_object('sessions',result));
  end if;
$old1$;
  new_part:=$new1$  if p_path in ('questions','questions/save') then
    return jom_private.question_bank_api(p_path,p_method,p_body);
  end if;
  if p_path='sessions' and p_method='GET' then
    select jsonb_build_object('sessions',
      (select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc),'[]') from (
        select session_room.code,session_room.title,session_room.state,session_room.question_index,session_room.created_at,session_room.version,
          (select count(*) from jom_private.players p where p.room_id=session_room.id) as player_count
        from jom_private.rooms session_room where session_room.owner_id=uid and session_room.removed_at is null order by session_room.created_at desc limit 30
      ) s), 'removedSessions',
      (select coalesce(jsonb_agg(to_jsonb(s) order by s.removed_at desc),'[]') from (
        select session_room.code,session_room.title,session_room.state,session_room.created_at,session_room.version,session_room.removed_at,
          (select count(*) from jom_private.players p where p.room_id=session_room.id) as player_count
        from jom_private.rooms session_room where session_room.owner_id=uid and session_room.removed_at is not null order by session_room.removed_at desc limit 30
      ) s)) into result;
    return jsonb_build_object('status',200,'body',result);
  end if;
$new1$;
  if strpos(definition,old_part)=0 or strpos(definition,new_part)>0 then
    raise exception 'Unexpected live_api definition at change 1; inspect before applying.';
  end if;
  definition:=replace(definition,old_part,new_part);
  old_part:=$old2$    select jsonb_agg(payload order by ord,random_order) into qs from (
      select payload,0 as ord,core_order::double precision as random_order from jom_private.questions where core_order is not null
      union all
      select payload,1 as ord,random() as random_order from jom_private.questions where core_order is null
    ) q;
    select jsonb_agg(v order by ord) into qs from jsonb_array_elements(qs) with ordinality x(v,ord) where ord<=count_q;
    if jsonb_array_length(qs) is distinct from count_q then raise exception 'Revision questions are not loaded.'; end if;
$old2$;
  new_part:=$new2$    select jsonb_agg(chosen.payload order by chosen.draw) into qs from (
      select bank.payload,random() as draw from jom_private.questions bank where bank.enabled order by draw limit count_q
    ) chosen;
    if jsonb_array_length(qs) is distinct from count_q then
      raise exception using errcode='P0001',message='Not enough active questions for this game. Enable more questions in the bank or choose a shorter game.';
    end if;
$new2$;
  if strpos(definition,old_part)=0 or strpos(definition,new_part)>0 then
    raise exception 'Unexpected live_api definition at change 2; inspect before applying.';
  end if;
  definition:=replace(definition,old_part,new_part);
  old_part:=$old3$if action in ('host','control','results') and r.owner_id is distinct from uid then$old3$;
  new_part:=$new3$if action in ('host','control','results','remove','restore') and r.owner_id is distinct from uid then$new3$;
  if strpos(definition,old_part)=0 or strpos(definition,new_part)>0 then
    raise exception 'Unexpected live_api definition at change 3; inspect before applying.';
  end if;
  definition:=replace(definition,old_part,new_part);
  old_part:=$old4$  if p_path='join' then
$old4$;
  new_part:=$new4$  if p_method='POST' and action in ('remove','restore') then
    if p_body->'version' is distinct from to_jsonb(r.version) then
      return jsonb_build_object('status',409,'body',jsonb_build_object('error','The session has changed. Refresh and try again.'));
    end if;
    if (action='remove' and r.removed_at is not null) or (action='restore' and r.removed_at is null) then
      return jsonb_build_object('status',409,'body',jsonb_build_object('error','The session has already changed. Refresh your sessions.'));
    end if;
    update jom_private.rooms set removed_at=case when action='remove' then t else null end,updated_at=t,version=version+1 where id=r.id;
    return jsonb_build_object('status',200,'body',jsonb_build_object('code',r.code,'removed',action='remove'));
  end if;
  if r.removed_at is not null then
    return jsonb_build_object('status',404,'body',jsonb_build_object('error','This session has been removed. Ask your lecturer for a new PIN.'));
  end if;
  if p_path='join' then
$new4$;
  if strpos(definition,old_part)=0 or strpos(definition,new_part)>0 then
    raise exception 'Unexpected live_api definition at change 4; inspect before applying.';
  end if;
  definition:=replace(definition,old_part,new_part);
  execute definition;
end;
$migration$;
