import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

test('question database protects edits, randomizes future decks and preserves removed sessions',async()=>{
 const db=new PGlite({extensions:{pgcrypto}}),uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',student='33333333-3333-4333-8333-333333333333';
 try {
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   insert into auth.users values('${uid}','reen@example.test',now()),('${other}','other@example.test',now()),('${student}','student@example.test',now());`);
  for(const file of readdirSync(new URL('../supabase/migrations/',import.meta.url)).sort())await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec("insert into jom_private.approved_emails(email) values('reen@example.test'),('other@example.test')");
  async function rpc(path,{user=uid,body,token}={}){
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);
   return (await db.query('select public.jom_live($1,$2,$3::jsonb,$4) result',[path,body?'POST':'GET',JSON.stringify(body||{}),token||null])).rows[0].result;
  }
  assert.equal((await rpc('questions',{user:null})).status,401);
  assert.equal((await rpc('questions',{user:student})).status,403);
  assert.equal((await rpc('questions/save',{user:student,body:{}})).status,403);
  const original=(await rpc('questions')).body.questions;
  assert.equal(original.length,100);assert.equal(original.filter(q=>q.enabled).length,90);
  const enabled=new Set(original.filter(q=>q.enabled).map(q=>q.id));
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from jom_private.questions'),/permission denied/);
  await assert.rejects(db.query("select jom_private.question_bank_api('questions','GET','{}')"),/permission denied/);
  assert.equal((await rpc('questions')).status,200,'approved RPC works through authenticated role');
  await db.exec('reset role');
  const decks=[],codes=[];
  for(const count of [10,10,10,15,20]){
   const created=await rpc('create',{body:{count,seconds:30}});assert.equal(created.status,201);
   codes.push(created.body.code);
   const deck=(await db.query('select deck from jom_private.rooms where code=$1',[created.body.code])).rows[0].deck;
   assert.equal(deck.length,count);assert.equal(new Set(deck.map(q=>q.id)).size,count);
   assert.ok(deck.every(q=>enabled.has(q.id)),'only enabled revision questions are drawn');decks.push(deck);
  }
  assert.ok(new Set(decks.slice(0,3).flatMap(d=>d.map(q=>q.id))).size>10,'10-question games sample beyond a fixed core');
  assert.notDeepEqual(decks[0].map(q=>q.id),decks[1].map(q=>q.id),'independent random question order');
  const editing=original.find(q=>q.id===decks[0][0].id),changed={...editing,payload:{...editing.payload,stem:'Updated original revision question?'},enabled:false};
  const saved=await rpc('questions/save',{body:changed});assert.equal(saved.status,200);assert.equal(saved.body.question.version,1);
  assert.equal((await rpc('questions/save',{body:changed})).status,409,'stale edits cannot overwrite a newer edit');
  assert.deepEqual((await db.query('select deck from jom_private.rooms where code=$1',[codes[0]])).rows[0].deck,decks[0],'bank edits never mutate existing games');
  const valid={chapter:4,enabled:true,payload:{stem:'Which choice follows the evidence?',options:['Observe','Guess','Ignore','Invent'],correct:0,explanation:'Observation supplies evidence.',follow:'Explain the evidence.',tag:'Reasoning'}};
  for(const invalid of [
   {...valid,chapter:7},{...valid,enabled:'true'},
   {...valid,payload:{...valid.payload,correct:4}},
   {...valid,payload:{...valid.payload,options:['Same',' same ','Other','Fourth']}},
   {...valid,payload:{...valid.payload,options:['Only one']}},
   {...valid,payload:{...valid.payload,stem:''}},
   {...valid,payload:{...valid.payload,options:[false,'B','C','D']}}
  ])assert.equal((await rpc('questions/save',{body:invalid})).status,400);
  assert.equal((await rpc('questions/save',{user:null,body:valid})).status,401);
  const added=(await rpc('questions/save',{body:valid})).body.question;
  assert.match(added.id,/^custom-/);assert.equal(added.chapter,4);assert.equal(added.payload.correct,0);
  await db.query('update jom_private.questions set enabled=false where id<>$1',[added.id]);
  assert.equal((await rpc('create',{body:{count:10}})).status,400,'insufficient bank gives a helpful validation error');
  await db.query('update jom_private.questions set enabled=true where id=any($1::text[])',[original.filter(q=>q.enabled&&q.id!==editing.id).slice(0,9).map(q=>q.id)]);
  const fixed=(await rpc('create',{body:{count:10}})).body.code;
  const future=(await db.query('select deck from jom_private.rooms where code=$1',[fixed])).rows[0].deck;
  assert.ok(future.some(q=>q.id===added.id),'new questions become available to future games');assert.ok(future.every(q=>q.id!==editing.id),'disabled questions stay out');
  const code=codes[0],room='rooms/'+code;
  const player=(await rpc('join',{user:null,body:{code,nickname:'Test learner'}})).body;
  await rpc(room+'/control',{body:{action:'start',version:0}});
  await rpc(room+'/answer',{user:null,token:player.token,body:{questionIndex:0,choice:decks[0][0].correct}});
  const before=(await db.query('select closes_at,deck from jom_private.rooms where code=$1',[code])).rows[0];
  assert.equal((await rpc(room+'/remove',{user:null,body:{version:1}})).status,401);
  assert.equal((await rpc(room+'/remove',{user:other,body:{version:1}})).status,403);
  assert.equal((await rpc(room+'/remove',{body:{version:0}})).status,409);
  assert.equal((await rpc(room+'/remove',{body:{version:1}})).status,200);
  const sessions=(await rpc('sessions')).body;
  assert.ok(!sessions.sessions.some(s=>s.code===code));assert.equal(sessions.removedSessions[0].code,code);assert.equal(sessions.removedSessions[0].version,2);
  assert.deepEqual((await rpc('sessions',{user:other})).body.removedSessions,[]);
  for(const [path,args] of [[room,{user:null}],[room+'/host',{}],[room+'/results',{}],['join',{user:null,body:{code,nickname:'Another'}}],[room+'/answer',{user:null,token:player.token,body:{questionIndex:0,choice:0}}],[room+'/control',{body:{action:'reveal',version:2}}]])assert.equal((await rpc(path,args)).status,404,'removed PIN and controls are unavailable');
  assert.equal((await db.query('select count(*) n from jom_private.answers')).rows[0].n,1,'removal preserves submitted records');
  assert.equal((await rpc(room+'/restore',{user:other,body:{version:2}})).status,403);
  assert.equal((await rpc(room+'/restore',{body:{version:1}})).status,409);
  assert.equal((await rpc(room+'/restore',{body:{version:2}})).status,200);
  const after=(await db.query('select closes_at,deck,version from jom_private.rooms where code=$1',[code])).rows[0];
  assert.deepEqual(after.deck,before.deck);assert.equal(after.closes_at,before.closes_at);assert.equal(after.version,3);
  assert.equal((await rpc(room,{user:null,token:player.token})).status,200);
  assert.ok((await rpc('sessions')).body.sessions.some(s=>s.code===code));assert.deepEqual((await rpc('sessions')).body.removedSessions,[]);
 } finally {await db.close();}
});
