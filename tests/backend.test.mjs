import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {liveRequest,signInLecturer,signOutLecturer,googleSignInUrl,finishGoogleSignIn} from '../public/backend.mjs';

test('Supabase transport separates student tokens from lecturer JWTs and expires revoked login',async()=>{
 const calls=[],storage=new Map();
 globalThis.JOM_CONFIG={audience:'lecturer',backend:'supabase',supabase:{url:'https://example.supabase.co',publishableKey:'sb_publishable_test'}};
 globalThis.sessionStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 globalThis.fetch=async(url,opts)=>{
  calls.push({url,opts});
  if(url.includes('/auth/v1/token'))return Response.json({access_token:'verified-user-jwt',refresh_token:'refresh-secret',expires_in:3600});
  if(url.includes('/auth/v1/logout'))return new Response(null,{status:204});
  return Response.json({status:200,body:{accepted:true}});
 };
 await liveRequest('rooms/123456/answer',{body:{questionIndex:0,choice:2},token:'a'.repeat(64)});
 const student=calls.at(-1);assert.equal(student.opts.headers.apikey,'sb_publishable_test');assert.equal(student.opts.headers.Authorization,undefined);assert.equal(JSON.parse(student.opts.body).p_player_token,'a'.repeat(64));assert.equal(student.opts.credentials,'omit');
 await signInLecturer('reen@example.test','not-a-real-password');
 await liveRequest('create',{body:{count:10}});
 const host=calls.at(-1);assert.equal(host.opts.headers.Authorization,'Bearer verified-user-jwt');assert.equal(JSON.parse(host.opts.body).p_player_token,null);
 await liveRequest('rooms/123456',{token:'a'.repeat(64)});assert.equal(calls.at(-1).opts.headers.Authorization,undefined,'public player requests do not inherit host identity');
 globalThis.fetch=async()=>Response.json({message:'JWT expired'},{status:401});
 await assert.rejects(liveRequest('sessions'),e=>e.status===401);assert.equal(storage.size,0);
 await signOutLecturer();delete globalThis.JOM_CONFIG;
});

test('Google PKCE exchanges only a bound callback and removes credentials from the URL',async()=>{
 const calls=[],storage=new Map(),host='https://izreenaisya-jpg.github.io/psychology-game/host.html';
 globalThis.JOM_CONFIG={audience:'lecturer',backend:'supabase',supabase:{url:'https://example.supabase.co',publishableKey:'sb_publishable_test'}};
 globalThis.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 globalThis.location={href:host+'#live-host/123456'};
 globalThis.history={replaceState(_state,_title,url){location.href=url;}};
 let googleEnabled=true;
 globalThis.fetch=async(url,opts)=>{
  calls.push({url,opts,atUrl:location.href});
  if(url.endsWith('/settings'))return Response.json({external:{google:googleEnabled}});
  if(url.includes('grant_type=pkce'))return Response.json({access_token:'google-user-jwt',refresh_token:'test-refresh',expires_in:3600});
  if(url.includes('/logout'))return new Response(null,{status:204});
  return Response.json({status:200,body:{accepted:true}});
 };
 try{
  const url=new URL(await googleSignInUrl()),flowKey=[...storage.keys()][0],pending=JSON.parse(storage.get(flowKey));
  assert.equal(url.origin,'https://example.supabase.co');assert.equal(url.pathname,'/auth/v1/authorize');
  assert.equal(url.searchParams.get('provider'),'google');assert.equal(url.searchParams.get('redirect_to'),host);
  assert.equal(url.searchParams.get('code_challenge_method'),'s256');assert.equal(url.searchParams.get('prompt'),'select_account');
  assert.equal(url.searchParams.get('code_challenge'),createHash('sha256').update(pending.verifier).digest('base64url'));
  assert.equal(url.href.includes(pending.verifier),false,'verifier never leaves storage before the code exchange');
  assert.equal(url.searchParams.has('client_secret'),false);
  location.href=host+'?code=test-auth-code';assert.equal(await finishGoogleSignIn(),true);
  const exchange=calls.find(x=>x.url.includes('grant_type=pkce'));
  assert.deepEqual(JSON.parse(exchange.opts.body),{auth_code:'test-auth-code',code_verifier:pending.verifier});
  assert.equal(exchange.opts.headers.Authorization,undefined);assert.equal(exchange.atUrl,host+'#live-host/123456');
  assert.equal(storage.has(flowKey),false);
  await liveRequest('sessions');assert.equal(calls.at(-1).opts.headers.Authorization,'Bearer google-user-jwt');
  await liveRequest('rooms/123456',{token:'a'.repeat(64)});assert.equal(calls.at(-1).opts.headers.Authorization,undefined);
  await signOutLecturer();assert.equal(storage.size,0);

  location.href=host+'?code=unsolicited';const before=calls.length;
  await assert.rejects(finishGoogleSignIn(),/expired/);assert.equal(calls.length,before);assert.equal(location.href,host+'#live-host');
  location.href=host+'#access_token=forged-jwt&refresh_token=forged-refresh';
  await assert.rejects(finishGoogleSignIn(),/Sign in again/);assert.equal(calls.length,before);assert.equal(storage.size,0);assert.equal(location.href,host+'#live-host');
  await liveRequest('sessions');assert.equal(calls.at(-1).opts.headers.Authorization,undefined,'URL tokens cannot create a lecturer session');

  location.href=host;await googleSignInUrl();const expired=JSON.parse(storage.get(flowKey));expired.createdAt=Date.now()-660000;storage.set(flowKey,JSON.stringify(expired));
  location.href=host+'?code=expired';const beforeExpired=calls.length;
  await assert.rejects(finishGoogleSignIn(),/expired/);assert.equal(calls.length,beforeExpired);assert.equal(storage.has(flowKey),false);
  location.href=host;await googleSignInUrl();location.href=host+'?error=access_denied&error_description=untrusted-message';
  await assert.rejects(finishGoogleSignIn(),/cancelled/);assert.equal(location.href,host+'#live-host');assert.equal(storage.size,0);

  location.href=host;googleEnabled=false;await assert.rejects(googleSignInUrl(),/not available/);assert.equal(storage.size,0);
  googleEnabled=true;globalThis.sessionStorage={getItem:()=>null,setItem(){throw new Error('blocked');},removeItem(){}};
  await assert.rejects(googleSignInUrl(),/Allow browser storage/);
  globalThis.JOM_CONFIG.audience='student';const beforeStudent=calls.length;
  await assert.rejects(googleSignInUrl(),/lecturer dashboard/);await assert.rejects(finishGoogleSignIn(),/lecturer dashboard/);assert.equal(calls.length,beforeStudent);
 }finally{await signOutLecturer();delete globalThis.JOM_CONFIG;delete globalThis.location;delete globalThis.history;}
});
