import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {calculatePoints} from '../lib/live-service.mjs';
import {handleLiveHttp} from '../lib/live-cors.mjs';
const owner={userId:'teacher-1',displayName:'Teacher Reen'},other={userId:'teacher-2'};
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys = ON');
 for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 const db={prepare(text){return {bind(...args){const q=sql.prepare(text);return {
  async first(){return q.get(...args)||null;},
  async all(){return {results:q.all(...args)};},
  async run(){return {meta:{changes:Number(q.run(...args).changes)}};}
 };}};}};
 let now=1800000000000;
 const call=async(path,{body,user=null,token,origin}={})=>{
  const r=await handleLiveHttp(new Request('https://game.test/api/live/'+path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{})},body:body?JSON.stringify(body):undefined}),{db,user,now});return {status:r.status,data:await r.json()};
 };
 return {sql,db,call,advance:ms=>now+=ms};
}
async function newGame(ctx,options={}){const r=await ctx.call('create',{user:owner,body:{count:10,seconds:45,...options}});assert.equal(r.status,201);return r.data.code;}
async function join(ctx,code,nickname){const r=await ctx.call('join',{body:{code,nickname}});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;}
async function control(ctx,code,action){const current=await ctx.call('rooms/'+code+'/host',{user:owner});return ctx.call('rooms/'+code+'/control',{user:owner,body:{action,version:current.data.version}});}

test('30 players answer the same server-controlled question; scores are hidden until reveal',async()=>{
 const c=setup(),code=await newGame(c),players=await Promise.all(Array.from({length:30},(_,i)=>join(c,code,'Student '+(i+1))));
 const lobby=await c.call('rooms/'+code+'/host',{user:owner});assert.equal(lobby.data.playerCount,30);assert.equal(lobby.data.question,undefined);
 const opened=await control(c,code,'start');assert.equal(opened.status,200);assert.equal(opened.data.questionIndex,0);assert.equal(opened.data.question.correct,undefined);
 const correct=JSON.parse(c.sql.prepare('SELECT deck_json FROM live_rooms').get().deck_json)[0].correct;
 const answers=await Promise.all(players.map((p,i)=>c.call('rooms/'+code+'/answer',{token:p.token,body:{questionIndex:0,choice:i<20?correct:(correct+1)%4}})));
 assert.ok(answers.every(a=>a.status===200));const during=await c.call('rooms/'+code,{token:players[0].token});assert.equal(during.data.answeredCount,30);assert.equal(during.data.me.answer.choice,correct);assert.equal(during.data.me.answer.correct,undefined);assert.equal(during.data.me.score,0);assert.equal(during.data.distribution,undefined);
 const revealed=await control(c,code,'reveal');assert.equal(revealed.data.question.correct,correct);assert.equal(revealed.data.distribution[correct],20);assert.equal(revealed.data.players.filter(p=>p.score===1000).length,20);assert.equal(revealed.data.players[0].rank,1);assert.equal(revealed.data.players[19].rank,1);assert.equal(revealed.data.players[20].rank,21);
 const refreshed=await c.call('rooms/'+code,{token:players[0].token});assert.equal(refreshed.data.me.answer.correct,true);assert.equal(refreshed.data.me.score,1000);
 const next=await control(c,code,'next');assert.equal(next.data.questionIndex,1);assert.equal(next.data.state,'question');assert.equal(next.data.players[0].score,1000);
 c.sql.close();
});
test('host controls and full answer records require the owning lecturer',async()=>{
 const c=setup();assert.equal((await c.call('create',{body:{count:10}})).status,401);const code=await newGame(c);await join(c,code,'Learner');
 for(const user of [null,other])for(const endpoint of ['host','results','control']){const r=await c.call('rooms/'+code+'/'+endpoint,{user,...(endpoint==='control'?{body:{action:'start',version:0}}:{})});assert.equal(r.status,user?403:401);}
 assert.equal((await c.call('rooms/'+code+'/control',{user:owner,origin:'https://evil.test',body:{action:'start',version:0}})).status,403);
 assert.equal((await c.call('rooms/'+code+'/results',{user:owner})).status,200);
 assert.equal((await c.call('sessions',{user:other})).data.sessions.length,0);c.sql.close();
});
test('duplicate answers are idempotent; changed, stale and late answers are rejected',async()=>{
 const c=setup(),code=await newGame(c),p=await join(c,code,'A'),p2=await join(c,code,'B');await control(c,code,'start');const path='rooms/'+code+'/answer',body={questionIndex:0,choice:1};
 assert.equal((await c.call(path,{body})).status,401);assert.equal((await c.call(path,{token:p.token,body})).status,200);assert.equal((await c.call(path,{token:p.token,body})).status,200);assert.equal((await c.call(path,{token:p.token,body:{...body,choice:2}})).status,409);
 assert.equal(c.sql.prepare('SELECT COUNT(*) AS n FROM live_answers').get().n,1);
 assert.equal((await c.call(path,{token:p2.token,body:{questionIndex:1,choice:1}})).status,409);
 c.advance(45000);assert.equal((await c.call(path,{token:p2.token,body})).status,409);assert.equal((await c.call('rooms/'+code)).data.acceptingAnswers,false);
 await control(c,code,'reveal');await control(c,code,'next');assert.equal((await c.call(path,{token:p2.token,body})).status,409);
 assert.equal((await c.call('rooms/'+code+'/control',{user:owner,body:{action:'reveal',version:1}})).status,409);c.sql.close();
});
test('nickname uniqueness, capacity and lobby-only joining are enforced',async()=>{
 const c=setup(),code=await newGame(c);await join(c,code,'Student');assert.equal((await c.call('join',{body:{code,nickname:' student '}})).status,409);
 const batch=await Promise.all(Array.from({length:60},(_,i)=>c.call('join',{body:{code,nickname:'Player '+i}})));assert.equal(batch.filter(r=>r.status===201).length,59);assert.equal(batch.filter(r=>r.status===409).length,1);
 await control(c,code,'start');assert.equal((await c.call('join',{body:{code,nickname:'Late'}})).status,409);c.sql.close();
});
test('a full game finishes and saved response records match all rounds',async()=>{
 const c=setup(),code=await newGame(c),p=await join(c,code,'=Formula name');const questions=JSON.parse(c.sql.prepare('SELECT deck_json FROM live_rooms').get().deck_json);await control(c,code,'start');
 for(let i=0;i<questions.length;i++){assert.equal((await c.call('rooms/'+code+'/answer',{token:p.token,body:{questionIndex:i,choice:questions[i].correct}})).status,200);await control(c,code,'reveal');await control(c,code,'next');}
 const results=await c.call('rooms/'+code+'/results',{user:owner});assert.equal(results.data.session.state,'finished');assert.equal(results.data.session.players[0].score,10000);assert.equal(results.data.answers.length,10);
 c.advance(9*60*60*1000);assert.equal((await c.call('rooms/'+code)).status,410);assert.equal((await c.call('rooms/'+code+'/results',{user:owner})).status,200);c.sql.close();
});
test('empty lobby can end safely and speed bonus is bounded',async()=>{
 const c=setup(),code=await newGame(c);assert.equal((await control(c,code,'start')).status,409);assert.equal((await control(c,code,'finish')).status,200);c.sql.close();
 assert.equal(calculatePoints(false,0,45,true),0);assert.equal(calculatePoints(true,0,45,true),1200);assert.equal(calculatePoints(true,22500,45,true),1100);assert.equal(calculatePoints(true,45000,45,true),1000);assert.equal(calculatePoints(true,0,45,false),1000);
});

test('GitHub Pages students can join and answer; foreign origins and host routes stay blocked',async()=>{
 const c=setup(),code=await newGame(c),origin='https://izreenaisya-jpg.github.io';
 const joined=await c.call('join',{origin,body:{code,nickname:'GitHub student'}});assert.equal(joined.status,201);
 await control(c,code,'start');
 const answer=await c.call('rooms/'+code+'/answer',{origin,token:joined.data.token,body:{questionIndex:0,choice:1}});assert.equal(answer.status,200);
 const snapshot=await c.call('rooms/'+code,{origin,token:joined.data.token});assert.equal(snapshot.data.me.answer.choice,1);
 assert.equal((await c.call('rooms/'+code+'/host',{origin,user:owner})).status,403);
 assert.equal((await c.call('rooms/'+code+'/results',{origin,user:owner})).status,403);
 assert.equal((await c.call('create',{origin,user:owner,body:{count:10}})).status,403);
 assert.equal((await c.call('rooms/'+code+'/control',{origin,user:owner,token:joined.data.token,body:{action:'finish',version:1}})).status,403);
 assert.equal((await c.call('rooms/'+code+'/host',{token:joined.data.token})).status,401);
 assert.equal((await c.call('rooms/'+code+'/control',{token:joined.data.token,body:{action:'finish',version:1}})).status,401);
 assert.equal((await c.call('rooms/'+code,{origin:'https://untrusted.test'})).status,403);
 const preflight=await handleLiveHttp(new Request('https://game.test/api/live/join',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'content-type'}}));
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
 const blocked=await handleLiveHttp(new Request('https://game.test/api/live/create',{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST'}}));assert.equal(blocked.status,403);c.sql.close();
});
