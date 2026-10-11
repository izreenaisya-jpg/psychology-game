import test from 'node:test';
import assert from 'node:assert/strict';
import {bank} from '../public/bank.mjs';
import {unmountLive} from '../public/live.mjs';

test('student navigation and forged teacher actions cannot open host UI; solo practice still works',async()=>{
 const listeners=new Map(),windowListeners={},elements=new Map(),memory=new Map(),requests=[];
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',value:'',dataset:{},hidden:false,classList:{add(){},remove(){},toggle(){}},contains(){return false;},querySelector(){return null;},focus(){},setAttribute(){},showModal(){},close(){}});return elements.get(selector);};
 globalThis.document={querySelector:element,querySelectorAll:()=>[],activeElement:null,body:{classList:{add(){},remove(){}}},addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},removeEventListener(name,fn){listeners.get(name)?.delete(fn);}};
 globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 let hash='#home';globalThis.location={origin:'https://izreenaisya-jpg.github.io',host:'izreenaisya-jpg.github.io',get hash(){return hash;},set hash(v){hash=v.startsWith('#')?v:'#'+v;windowListeners.hashchange?.();}};
 globalThis.window={addEventListener:(name,fn)=>windowListeners[name]=fn,scrollTo(){}};
 globalThis.JOM_CONFIG={audience:'student',defaultRoute:'live-join',apiBase:'https://server.test',hostUrl:'https://server.test/#live-host'};
 globalThis.fetch=async url=>{requests.push(url);return Response.json({error:'Unexpected host request'},{status:403});};
 const click=async(action,extra={})=>{for(const fn of [...(listeners.get('click')||[])])await fn({target:{closest:selector=>selector==='[data-action]'?{dataset:{action,...extra},disabled:false,setAttribute(){}}:null}});};
 const html=()=>element('#main').innerHTML;
 await import('../public/app.js');
 assert.match(html(),/Student space/);assert.doesNotMatch(html(),/live-host|#setup|#lesson/);
 location.hash='#resources';assert.match(html(),/practice-a.pdf/);assert.doesNotMatch(html(),/live-host|Host our live|ChatGPT/);
 for(const route of ['live-host','live-host/123456','setup','arena','lesson']){
  location.hash='#'+route;assert.match(html(),/Ready to think/);assert.doesNotMatch(html(),/host dashboard|Sign in|live-create|data-live-action="start"/);
 }
 assert.equal(requests.length,0);
 await click('class-start');assert.equal(memory.has('jom-philosophy-v1'),false);assert.match(html(),/Ready to think/);
 location.hash='#home';await click('solo-start');assert.match(html(),/Solo Quest/);
 const solo=JSON.parse(memory.get('jom-philosophy-v1')).solo,q=bank.find(q=>q.id===solo.ids[0]);
 await click('solo-choice',{choice:String(q.correct)});
 for(const fn of listeners.get('input'))fn({target:{id:'solo-reason',dataset:{},value:'This answer matches the course concept.'}});
 await click('solo-check');assert.match(html(),/Correct choice/);assert.equal(requests.length,0);
 unmountLive();delete globalThis.JOM_CONFIG;
});
