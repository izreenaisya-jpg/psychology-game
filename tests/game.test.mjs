import test from 'node:test';
import assert from 'node:assert/strict';
import {deck,rounds} from '../dist/deck.mjs';
import {bank} from '../dist/bank.mjs';
import {scoreResponse,newClass,teamTotal,maxScore,newSolo,soloScore,rankTeams,escapeHtml,csvCell} from '../dist/engine.mjs';

test('all challenge and solo questions have unambiguous scoring data',()=>{
 assert.equal(deck.length,13);assert.equal(bank.length,90);
 assert.equal(new Set(bank.map(q=>q.id)).size,90);
 for(const q of [...deck,...bank]){
  if(q.options){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.correct>=0&&q.correct<4);assert.ok(q.explanation.length>20);}
  else{assert.ok(q.rubric.length>=4);assert.ok(q.model.length>20);}
 }
 assert.equal(maxScore(deck),54);
 assert.deepEqual(rounds.map((_,i)=>deck.filter(q=>q.round===i).length),[6,4,2,1]);
});
test('answers do not earn points before reveal; repeated reveal is idempotent',()=>{
 const c=newClass(['A','B']);c.responses[0]={0:{choice:deck[0].correct,bonus:2,checks:[]}};
 assert.equal(teamTotal(c,0,deck),0);
 c.revealed[0]=true;assert.equal(teamTotal(c,0,deck),4);
 c.revealed[0]=true;assert.equal(teamTotal(c,0,deck),4);
 c.responses[0][0].bonus=1;assert.equal(teamTotal(c,0,deck),3);
 c.responses[0][0].bonus=0;assert.equal(teamTotal(c,0,deck),2);
});
test('rubric scores can be corrected and never exceed the number of criteria',()=>{
 const q=deck.at(-1),r={checks:Array(10).fill(true)};
 assert.equal(scoreResponse(q,r,true),6);r.checks[0]=false;
 assert.equal(scoreResponse(q,r,true),5);assert.equal(scoreResponse(q,r,false),0);
});
test('team totals and ranking are independent',()=>{
 const c=newClass(['Alpha','Beta']);c.revealed[0]=true;c.responses[0]={0:{choice:deck[0].correct,bonus:0},1:{choice:deck[0].correct,bonus:2}};
 assert.equal(rankTeams(c,deck)[0].name,'Beta');assert.equal(teamTotal(c,0,deck),2);assert.equal(teamTotal(c,1,deck),4);
});
test('solo quests select unique questions, score the choice only, and preserve state',()=>{
 const s=newSolo(bank,10);assert.equal(s.ids.length,10);assert.equal(new Set(s.ids).size,10);assert.equal(soloScore(s,bank),0);
 for(const id of s.ids)s.answers[id]={choice:bank.find(q=>q.id===id).correct,reason:'My explanation'};
 assert.equal(soloScore(s,bank),20);assert.equal(soloScore(JSON.parse(JSON.stringify(s)),bank),20);
});
test('team names are escaped and spreadsheet formulas are neutralized',()=>{
 assert.equal(escapeHtml('<img src=x onerror="x">'),'&lt;img src=x onerror=&quot;x&quot;&gt;');
 assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('Team "A"'),'"Team ""A"""');
});

test('classroom and solo UI actions complete their flows in a DOM harness',async()=>{
 const listeners={},windowListeners={},elements=new Map(),memory=new Map();
 const element=(selector)=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',value:'',dataset:{},classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},showModal(){},close(){}});return elements.get(selector);};
 globalThis.document={querySelector:element,querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners[name]=fn,documentElement:{requestFullscreen:async()=>{}},createElement:()=>({click(){}})};
 globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 let hash='#home';globalThis.location={get hash(){return hash},set hash(v){hash=v.startsWith('#')?v:'#'+v;windowListeners.hashchange?.();}};
 globalThis.window={addEventListener:(name,fn)=>windowListeners[name]=fn,scrollTo(){},print(){}};
 const click=async(action,extra={})=>listeners.click({target:{closest:()=>({dataset:{action,...extra},disabled:false,setAttribute(){}})}});
 const state=()=>JSON.parse(memory.get('jom-philosophy-v1'));
 await import('../dist/app.js');
 assert.match(element('#main').innerHTML,/Jom/);
 await click('class-start');assert.match(element('#main').innerHTML,/Quickfire/);
 for(let i=0;i<deck.length;i++){
  const q=deck[i];if(q.options)await click('team-vote',{team:'0',choice:String(q.correct)});
  await click('reveal');
  if(q.options)await click('bonus',{team:'0',value:'2'});
  else for(let point=0;point<q.rubric.length;point++)listeners.change({target:{dataset:{rubric:String(point),team:'0'},checked:true}});
  await click('class-next');
 }
 assert.match(element('#main').innerHTML,/Final leaderboard/);assert.equal(state().classroom.ended,true);assert.equal(teamTotal(state().classroom,0,deck),54);
 await click('solo-start');assert.match(element('#main').innerHTML,/Solo Quest/);
 await click('solo-check');assert.match(element('#solo-error').innerHTML,/Choose an option/);
 for(let i=0;i<10;i++){
  const current=state().solo;const q=bank.find(q=>q.id===current.ids[i]);
  await click('solo-choice',{choice:String(q.correct)});
  listeners.input({target:{id:'solo-reason',dataset:{},value:'This choice fits the course concept.'}});
  await click('solo-check');assert.match(element('#main').innerHTML,/Correct choice/);
  await click('solo-next');
 }
 assert.equal(state().solo.finished,true);assert.equal(soloScore(state().solo,bank),20);
 assert.match(element('#main').innerHTML,/Understanding, unlocked/);
 location.hash='#lesson';assert.match(element('#main').innerHTML,/AI Detective/);
 location.hash='#resources';assert.match(element('#main').innerHTML,/practice-a.pdf/);
});
