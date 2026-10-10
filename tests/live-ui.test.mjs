import test from 'node:test';
import assert from 'node:assert/strict';
import {mountLive,unmountLive} from '../public/live.mjs';

test('host and student views render synchronized states and lock/reveal choices',async()=>{
 const listeners={},els=new Map(),memory=new Map();
 const element=selector=>{if(!els.has(selector))els.set(selector,{innerHTML:'',textContent:'',hidden:false,dataset:{},classList:{add(){},remove(){},toggle(){}},focus(){}});return els.get(selector);};
 const main=element('#main');main.contains=()=>false;main.querySelector=()=>null;
 globalThis.document={querySelector:element,querySelectorAll:()=>[],activeElement:null,addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:()=>{},body:{classList:{add(){},remove(){}}}};
 globalThis.localStorage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 globalThis.location={origin:'https://game.test',host:'game.test'};
 const p={id:'p1',nickname:'<script>bad()</script>',rank:1,score:0,correct_count:0};
 let state={code:'123456',title:'Class test',state:'lobby',questionIndex:-1,total:10,seconds:45,speedBonus:false,now:Date.now(),closesAt:null,version:0,players:[p],playerCount:1,maxPlayers:60,answeredCount:0};
 globalThis.fetch=async url=>Response.json(url.endsWith('whoami')?{authenticated:true}:url.endsWith('sessions')?{sessions:[]}:state);
 const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
 mountLive('live-host/123456',main);await wait();assert.match(main.innerHTML,/Start 10 questions/);assert.match(main.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(main.innerHTML,/<script>bad/);assert.match(main.innerHTML,/123456/);unmountLive();
 memory.set('jom-live-players-v1',JSON.stringify({'123456':{token:'a'.repeat(64),nickname:p.nickname}}));
 state={...state,state:'question',questionIndex:0,version:1,closesAt:Date.now()+45000,acceptingAnswers:true,question:{stem:'A test question?',tag:'Test',options:['Alpha','Beta','Gamma','Delta']},me:{...p,answer:null}};
 mountLive('live-play/123456',main);await wait();assert.match(main.innerHTML,/data-live-action="answer"/);assert.match(main.innerHTML,/Choose one answer/);assert.doesNotMatch(main.innerHTML,/✓ Correct/);unmountLive();
 state={...state,me:{...p,answer:{choice:1}}};mountLive('live-play/123456',main);await wait();assert.match(main.innerHTML,/Answer B locked/);assert.match(main.innerHTML,/data-choice="0" disabled/);unmountLive();
 state={...state,state:'reveal',version:2,acceptingAnswers:false,question:{...state.question,correct:1,explanation:'Beta follows the evidence.',follow:'Explain the evidence.'},me:{...p,score:1000,correct_count:1,answer:{choice:1,correct:true,points:1000}}};mountLive('live-play/123456',main);await wait();assert.match(main.innerHTML,/Beta follows the evidence/);assert.match(main.innerHTML,/\+1000 points/);unmountLive();
 state={...state,state:'finished'};mountLive('live-play/123456',main);await wait();assert.match(main.innerHTML,/Game complete/);assert.match(main.innerHTML,/Final leaderboard/);unmountLive();
});
