import test from 'node:test';
import assert from 'node:assert/strict';
import {mountQuestionBank,unmountQuestionBank,canLeaveQuestionBank} from '../public/questions.mjs';
import {mountLive,unmountLive} from '../public/live.mjs';

const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
function harness(){
 const names=['JOM_CONFIG','document','window','sessionStorage','localStorage','location','fetch','FormData'],previous=new Map(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),listeners={},els=new Map();
 const el=selector=>{if(!els.has(selector))els.set(selector,{innerHTML:'',textContent:'',hidden:false,value:'',dataset:{},classList:{add(){},remove(){},toggle(){}},focus(){}});return els.get(selector);};
 const main=el('#main');main.contains=obj=>!!obj;main.querySelector=el;
 globalThis.JOM_CONFIG={audience:'lecturer',backend:'supabase',supabase:{url:'https://example.supabase.co',publishableKey:'sb_publishable_test'}};
 globalThis.document={querySelector:el,querySelectorAll:()=>[],activeElement:null,addEventListener:(n,fn)=>listeners[n]=fn,removeEventListener:(n,fn)=>{if(listeners[n]===fn)delete listeners[n];},body:{classList:{add(){},remove(){}}}};
 globalThis.window={confirm:()=>true,addEventListener(){},removeEventListener(){}};
 globalThis.sessionStorage={getItem:()=>null};globalThis.localStorage={getItem:()=>null};globalThis.location={origin:'https://game.test',hash:'#live-bank'};
 return {main,el,listeners,restore(){unmountQuestionBank();unmountLive();for(const[k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}},click(dataset){const b={dataset,disabled:false};return listeners.click({target:{closest:()=>b}});}};
}

test('lecturer question bank supports search, edit, save, disable and student denial',async()=>{
 const h=harness(),calls=[];
 let q={id:'q1',enabled:true,chapter:null,version:0,payload:{stem:'<script>Original?</script>',options:['One','Two','Three','Four'],correct:1,explanation:'Evidence for two.',tag:'Revision'}};
 globalThis.fetch=async(_url,opts)=>{
  const data=JSON.parse(opts.body);calls.push(data);
  if(data.p_path==='whoami')return Response.json({status:200,body:{authenticated:true,authorized:true}});
  if(data.p_path==='questions')return Response.json({status:200,body:{questions:[q]}});
  if(data.p_path==='questions/save'){q={...data.p_body,id:'q1',version:q.version+1};return Response.json({status:200,body:{question:q}});}
 };
 try{
  mountQuestionBank(h.main);await wait();assert.match(h.main.innerHTML,/1 active \/ 1 saved/);assert.match(h.el('#bank-list').innerHTML,/&lt;script&gt;/);assert.doesNotMatch(h.el('#bank-list').innerHTML,/<script>/);assert.match(h.el('#bank-list').innerHTML,/✓ Correct/);
  h.listeners.input({target:{id:'bank-search',value:'absent',closest:()=>null}});assert.match(h.el('#bank-list').innerHTML,/No matching/);
  h.listeners.input({target:{id:'bank-search',value:'Evidence',closest:()=>null}});assert.match(h.el('#bank-list').innerHTML,/Original/);
  await h.click({bankAction:'edit',id:'q1'});assert.match(h.main.innerHTML,/id="question-editor"/);assert.match(h.main.innerHTML,/value="1" selected/);
  h.listeners.input({target:{id:'bank-stem',closest:()=>({})}});window.confirm=()=>false;assert.equal(canLeaveQuestionBank(),false);await h.click({bankAction:'cancel'});assert.match(h.main.innerHTML,/id="question-editor"/);
  window.confirm=()=>true;
  globalThis.FormData=class{constructor(){return new Map(Object.entries({chapter:'5',stem:'Edited question?',option0:'One',option1:'Two',option2:'Three',option3:'Four',correct:'2',explanation:'Evidence for three.',tag:'Revision',follow:'Defend it.',claim:'',enabled:'on'}));}};
  const b={disabled:false};await h.listeners.submit({target:{id:'question-editor',querySelector:()=>b},preventDefault(){}});
  const saved=calls.at(-1).p_body;assert.equal(saved.version,0);assert.equal(saved.chapter,5);assert.equal(saved.payload.correct,2);assert.equal(saved.enabled,true);assert.match(h.el('#bank-status').textContent,/saved/);assert.doesNotMatch(h.main.innerHTML,/id="question-editor"/);
  await h.click({bankAction:'toggle',id:'q1'});assert.equal(calls.at(-1).p_body.version,1);assert.equal(calls.at(-1).p_body.enabled,false);assert.match(h.main.innerHTML,/0 active \/ 1 saved/);assert.match(h.el('#bank-status').textContent,/disabled/);
  h.listeners.change({target:{id:'bank-filter-status',value:'inactive',closest:()=>null}});assert.match(h.el('#bank-list').innerHTML,/Enable/);
  unmountQuestionBank();JOM_CONFIG.audience='student';const before=calls.length;mountQuestionBank(h.main);await wait();assert.equal(calls.length,before);assert.equal(location.hash,'live-join');
 }finally{h.restore();}
});

test('session removal and restore confirm correctly and submit the listed version',async()=>{
 const h=harness(),calls=[];let removed=false;
 const session={code:'123456',title:'Owned session',state:'finished',player_count:2,created_at:Date.now(),version:7};
 globalThis.fetch=async(_url,opts)=>{
  const d=JSON.parse(opts.body);calls.push(d);
  if(d.p_path==='whoami')return Response.json({status:200,body:{authenticated:true,authorized:true}});
  if(d.p_path==='sessions')return Response.json({status:200,body:{sessions:removed?[]:[session],removedSessions:removed?[{...session,version:8}]:[]}});
  removed=d.p_path.endsWith('/remove');return Response.json({status:200,body:{removed}});
 };
 try{
  mountLive('live-host',h.main);await wait();assert.match(h.main.innerHTML,/#live-host\/123456/);assert.match(h.main.innerHTML,/data-version="7"/);assert.match(h.main.innerHTML,/#live-bank/);
  window.confirm=()=>false;await h.click({liveAction:'remove',code:'123456',version:'7'});assert.equal(calls.filter(c=>c.p_path.endsWith('/remove')).length,0);
  window.confirm=()=>true;await h.click({liveAction:'remove',code:'123456',version:'7'});assert.deepEqual(calls.find(c=>c.p_path.endsWith('/remove')).p_body,{version:7});assert.match(h.main.innerHTML,/Removed sessions \(1\)/);assert.match(h.main.innerHTML,/data-live-action="restore"/);assert.match(h.el('#session-status').textContent,/removed/);
  await h.click({liveAction:'restore',code:'123456',version:'8'});assert.deepEqual(calls.find(c=>c.p_path.endsWith('/restore')).p_body,{version:8});assert.match(h.el('#session-status').textContent,/restored/);assert.doesNotMatch(h.main.innerHTML,/Removed sessions/);
  unmountLive();JOM_CONFIG.audience='student';mountLive('live-join',h.main);const before=calls.length;await h.click({liveAction:'remove',code:'123456',version:'7'});assert.equal(calls.length,before,'forged student removal does not make a host request');
 }finally{h.restore();}
});
