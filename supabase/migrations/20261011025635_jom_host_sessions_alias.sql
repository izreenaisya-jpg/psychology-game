-- The sessions query reused the PL/pgSQL room variable `r` as a table alias,
-- so opening an approved lecturer's dashboard raised SQLSTATE 42702.
-- Change only that query's alias. Keep authorization, ownership, grants,
-- the security-definer boundary and all gameplay behavior unchanged.
do $migration$
declare
  definition text := pg_get_functiondef('jom_private.live_api(text,text,jsonb,text)'::regprocedure);
  old_query constant text := $old$      select r.code,r.title,r.state,r.question_index,r.created_at,(select count(*) from jom_private.players p where p.room_id=r.id) as player_count
      from jom_private.rooms r where r.owner_id=uid order by r.created_at desc limit 30$old$;
  new_query constant text := $new$      select session_room.code,session_room.title,session_room.state,session_room.question_index,session_room.created_at,(select count(*) from jom_private.players p where p.room_id=session_room.id) as player_count
      from jom_private.rooms session_room where session_room.owner_id=uid order by session_room.created_at desc limit 30$new$;
begin
  if strpos(definition,new_query)>0 and strpos(definition,old_query)=0 then
    return;
  end if;
  if strpos(definition,old_query)=0 or strpos(definition,new_query)>0 then
    raise exception 'Unexpected live_api sessions query; inspect before applying this migration.';
  end if;
  execute replace(definition,old_query,new_query);
end;
$migration$;
