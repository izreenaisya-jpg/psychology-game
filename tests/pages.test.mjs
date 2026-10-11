import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const hostUrl='https://izreenaisya-jpg.github.io/psychology-game/host.html';
const shells=[
 {name:'root publishing',html:readFileSync(new URL('../host.html',import.meta.url),'utf8'),url:hostUrl,assets:'docs/'},
 {name:'docs publishing',html:readFileSync(new URL('../docs/host.html',import.meta.url),'utf8'),url:hostUrl,assets:''},
 {name:'docs subdirectory',html:readFileSync(new URL('../docs/host.html',import.meta.url),'utf8'),url:hostUrl.replace('/host.html','/docs/host.html'),assets:''}
];
const documentBase=shell=>new URL(shell.html.match(/<base\s+href="([^"]+)"/)?.[1]||shell.url,shell.url);
const links=html=>[...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(match=>match[1]);

test('published host navigation and saved sessions stay in the host document',async()=>{
 const keys=['document','location','JOM_CONFIG','fetch','localStorage'];
 const previous=new Map(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const elements=new Map(),requests=[];
 const element=selector=>{
  if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',hidden:false,classList:{add(){},remove(){},toggle(){}}});
  return elements.get(selector);
 };
 const main=element('#main');main.contains=()=>false;main.querySelector=()=>null;
 globalThis.document={querySelector:element,querySelectorAll:()=>[],activeElement:null,addEventListener(){},removeEventListener(){},body:{classList:{add(){},remove(){}}}};
 globalThis.JOM_CONFIG={audience:'lecturer'};
 globalThis.location={origin:new URL(hostUrl).origin,href:hostUrl};
 globalThis.localStorage={getItem:()=>null};
 const session={code:'123456',title:'Phone-created session',state:'lobby',player_count:1,created_at:'2026-10-11T00:00:00Z'};
 globalThis.fetch=async url=>{
  requests.push(url);
  return Response.json(url.endsWith('/whoami')?{authenticated:true,authorized:true}:url.endsWith('/sessions')?{sessions:[session]}:{...session,playerCount:1,maxPlayers:60,players:[{nickname:'Test player'}],total:10,seconds:45,speedBonus:false,version:0,now:Date.now()});
 };
 const {mountLive,unmountLive}=await import('../public/live.mjs');
 try{
  mountLive('live-host',main);
  await new Promise(setImmediate);
  const sessionHref=links(main.innerHTML).find(href=>href==='#live-host/123456');
  assert.ok(sessionHref,'the existing session is rendered');
  for(const shell of shells){
   const base=documentBase(shell);
   const hostLinks=[...links(shell.html),...links(main.innerHTML)].filter(href=>href.startsWith('#live-host'));
   assert.ok(hostLinks.length>=3);
   for(const href of hostLinks)assert.equal(new URL(href,base).pathname,new URL(shell.url).pathname,`${shell.name}: ${href} must keep the lecturer document`);
   const resume=new URL(sessionHref,base);
   assert.equal(resume.href,shell.url+'#live-host/123456');
  }
  mountLive(new URL(sessionHref,documentBase(shells[0])).hash.slice(1),main);
  await new Promise(setImmediate);
  assert.ok(requests.some(url=>url.endsWith('/rooms/123456/host')),'resuming requests the protected host snapshot');
  assert.match(main.innerHTML,/Live classroom · host screen/);
  assert.match(main.innerHTML,/data-live-action="fullscreen"/);
  assert.doesNotMatch(main.innerHTML,/id="live-join"/);
 }finally{
  unmountLive();
  for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
 }
});

test('both Pages publishing sources load the host assets from their public directory',()=>{
 for(const shell of shells){
  const assets=[...shell.html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match=>match[1]).filter(value=>/\.(?:svg|css|mjs|js)(?:\?|$)/.test(value));
  assert.equal(assets.length,4);
  const expected=new Set(['icon.svg','style.css','host-config.js','host.mjs'].map(name=>new URL(shell.assets+name,shell.url).pathname));
  assert.deepEqual(new Set(assets.map(value=>new URL(value,documentBase(shell)).pathname)),expected,shell.name);
 }
});
