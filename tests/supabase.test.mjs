import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

test('Postgres RPC enforces lecturer approval, ownership, private storage, locked answers and reveal timing',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    insert into auth.users values('11111111-1111-4111-8111-111111111111','reen@example.test',now()),('22222222-2222-4222-8222-222222222222','other@example.test',now()),('33333333-3333-4333-8333-333333333333','student@example.test',now()),('44444444-4444-4444-8444-444444444444','pending@example.test',null);`);
  for(const file of readdirSync(new URL('../supabase/migrations/',import.meta.url)).sort())await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`insert into jom_private.approved_emails(email) values('reen@example.test'),('other@example.test'),('pending@example.test');`);
  const uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
  async function rpc(path,{user=null,body,token}={}){
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);
   return (await db.query('select public.jom_live($1,$2,$3::jsonb,$4) as result',[path,body?'POST':'GET',JSON.stringify(body||{}),token||null])).rows[0].result;
  }
  assert.equal((await rpc('create',{body:{}})).status,401);
  assert.equal((await rpc('create',{user:'33333333-3333-4333-8333-333333333333',body:{}})).status,403);
  assert.equal((await rpc('create',{user:'44444444-4444-4444-8444-444444444444',body:{}})).status,403,'email approval alone cannot bypass confirmation');
  assert.equal((await rpc('whoami',{user:uid})).body.authorized,true);
  await db.exec('set role anon');
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  const anonymous=(await db.query("select public.jom_live('whoami') as result")).rows[0].result;
  assert.equal(anonymous.body.authenticated,false,'the public invoker wrapper can serve an anonymous player');
  const denied=(await db.query("select public.jom_live('create','POST','{}') as result")).rows[0].result;
  assert.equal(denied.status,401,'schema usage and RPC execution do not grant host access');
  await assert.rejects(db.query('select * from jom_private.answers'),/permission denied/);
  await assert.rejects(db.query('select * from jom_private.approved_emails'),/permission denied/);
  await assert.rejects(db.query('select jom_private.snapshot(null::jom_private.rooms,0,null,true)'),/permission denied/);
  await db.exec('reset role');
  const created=await rpc('create',{user:uid,body:{count:10,seconds:30,speedBonus:true}});
  assert.equal(created.status,201);const code=created.body.code,room='rooms/'+code;
  assert.equal((await rpc(room+'/host',{user:other})).status,403);
  assert.equal((await rpc(room+'/control',{user:other,body:{action:'start',version:0}})).status,403);
  assert.equal((await rpc(room+'/results')).status,401);
  const players=await Promise.all(Array.from({length:30},(_,i)=>rpc('join',{body:{code,nickname:'Player '+i}})));
  assert.ok(players.every(p=>p.status===201));const player=players[0].body;
  assert.equal((await rpc('join',{body:{code,nickname:'player 0'}})).status,409);
  const stored=(await db.query('select token_hash from jom_private.players where id=$1',[player.playerId])).rows[0].token_hash;
  assert.notEqual(stored,player.token);assert.match(stored,/^[a-f0-9]{64}$/);
  let s=(await rpc(room+'/control',{user:uid,body:{action:'start',version:0}})).body;
  assert.equal(s.state,'question');assert.equal(s.playerCount,30);
  assert.equal(s.question.correct,undefined);
  assert.equal((await rpc(room+'/control',{user:uid,body:{action:'reveal',version:0}})).status,409);
  assert.equal((await rpc(room+'/answer',{token:'0'.repeat(64),body:{questionIndex:0,choice:0}})).status,401);
  const q=(await db.query('select deck->0 as q from jom_private.rooms where code=$1',[code])).rows[0].q;
  assert.equal((await rpc(room+'/answer',{token:player.token,body:{questionIndex:0,choice:q.correct}})).status,200);
  assert.equal((await rpc(room+'/answer',{token:player.token,body:{questionIndex:0,choice:q.correct}})).status,200);
  assert.equal((await rpc(room+'/answer',{token:player.token,body:{questionIndex:0,choice:(q.correct+1)%4}})).status,409);
  assert.equal((await rpc(room+'/answer',{token:players[1].body.token,body:{questionIndex:1,choice:0}})).status,409);
  const hidden=(await rpc(room,{token:player.token})).body;
  assert.equal(hidden.answeredCount,1);assert.equal(hidden.me.score,0);assert.equal(hidden.me.answer.points,undefined);assert.equal(hidden.question.correct,undefined);assert.equal(hidden.distribution,undefined);
  await db.query('update jom_private.rooms set closes_at=0 where code=$1',[code]);
  assert.equal((await rpc(room+'/answer',{token:players[1].body.token,body:{questionIndex:0,choice:0}})).status,409);
  s=(await rpc(room+'/control',{user:uid,body:{action:'reveal',version:s.version}})).body;
  assert.equal(s.question.correct,q.correct);assert.ok(s.players[0].score>=1000);assert.ok(s.players[0].score<=1200);assert.equal(s.distribution[q.correct],1);
  const mine=(await rpc(room,{token:player.token})).body;assert.equal(mine.me.answer.correct,true);assert.ok(mine.me.answer.points>=1000);
  for(let i=1;i<10;i++){
   s=(await rpc(room+'/control',{user:uid,body:{action:'next',version:s.version}})).body;assert.equal(s.questionIndex,i);
   s=(await rpc(room+'/control',{user:uid,body:{action:'reveal',version:s.version}})).body;
  }
  s=(await rpc(room+'/control',{user:uid,body:{action:'next',version:s.version}})).body;assert.equal(s.state,'finished');
  assert.equal((await rpc('join',{body:{code,nickname:'Late'}})).status,409);
  assert.equal((await rpc(room+'/results',{user:other})).status,403);
  const results=(await rpc(room+'/results',{user:uid})).body;assert.equal(results.questions.length,10);assert.equal(results.answers.length,1);
  await db.query('update jom_private.rooms set created_at=0 where code=$1',[code]);
  assert.equal((await rpc(room)).status,410);assert.equal((await rpc(room+'/results',{user:uid})).status,200);
  assert.equal((await rpc('create',{user:uid,body:{count:11}})).status,400);
  const full=(await rpc('create',{user:uid,body:{count:15}})).body.code;
  for(let i=0;i<60;i++)assert.equal((await rpc('join',{body:{code:full,nickname:'Full '+i}})).status,201);
  assert.equal((await rpc('join',{body:{code:full,nickname:'Extra'}})).status,409);
 }finally{await db.close();}
});
