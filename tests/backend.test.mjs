import test from 'node:test';
import assert from 'node:assert/strict';
import {liveRequest,signInLecturer,signOutLecturer} from '../public/backend.mjs';

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
