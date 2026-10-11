const config=()=>globalThis.JOM_CONFIG||{};
export const usesSupabase=()=>config().backend==='supabase';
export const supabaseReady=()=>!!(config().supabase?.url&&config().supabase?.publishableKey);
const sessionKey=()=>`jom-lecturer-${config().supabase?.url||'unconfigured'}`;
const googleFlowKey=()=>sessionKey()+'-google-pkce';
let authMemory=null,refreshing=null;
function storedSession(){try{return authMemory||JSON.parse(sessionStorage.getItem(sessionKey())||'null');}catch{return authMemory;}}
function saveSession(data){authMemory=data;try{if(data)sessionStorage.setItem(sessionKey(),JSON.stringify(data));else sessionStorage.removeItem(sessionKey());}catch{/* This tab can still host without persistent storage. */}}
async function authRequest(path,body,bearer){
 if(!supabaseReady())throw new Error('Lecturer setup is in progress. Please return after activation.');
 const response=await fetch(config().supabase.url+'/auth/v1/'+path,{method:'POST',credentials:'omit',cache:'no-store',headers:{apikey:config().supabase.publishableKey,'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.msg||data.error_description||data.message||'Sign in failed. Please retry.'),{status:response.status});return data;
}
function normalizeSession(data){return {access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+data.expires_in*1000};}
export async function googleProviderEnabled(){
 if(!supabaseReady())return false;
 const response=await fetch(config().supabase.url+'/auth/v1/settings',{credentials:'omit',cache:'no-store',headers:{apikey:config().supabase.publishableKey}});
 if(!response.ok)throw new Error('Could not check Google sign-in. Please reload and try again.');
 return (await response.json()).external?.google===true;
}
function lecturerOnly(){if(config().audience!=='lecturer'||!usesSupabase())throw new Error('Open the lecturer dashboard to sign in.');}
const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function googleSignInUrl(){
 lecturerOnly();
 if(!await googleProviderEnabled())throw new Error('Google sign-in is not available yet.');
 const here=new URL(location.href),redirect=here.origin+here.pathname;
 if(here.protocol!=='https:'||!here.pathname.endsWith('/host.html'))throw new Error('Open the secure lecturer dashboard to sign in.');
 const verifier=base64url(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 const route=/^#live-host(\/\d{6})?$/.test(here.hash)?here.hash:'#live-host';
 const pending=JSON.stringify({verifier,redirect,route,createdAt:Date.now()});
 try{sessionStorage.setItem(googleFlowKey(),pending);if(sessionStorage.getItem(googleFlowKey())!==pending)throw new Error();}catch{throw new Error('Allow browser storage in this tab to sign in with Google.');}
 const url=new URL(config().supabase.url+'/auth/v1/authorize');
 url.search=new URLSearchParams({provider:'google',redirect_to:redirect,code_challenge:challenge,code_challenge_method:'s256',prompt:'select_account'}).toString();
 return url.href;
}
export async function finishGoogleSignIn(){
 lecturerOnly();
 const here=new URL(location.href),fragment=new URLSearchParams(here.hash.slice(1));
 const code=here.searchParams.get('code'),failure=here.searchParams.get('error')||fragment.get('error');
 const implicit=fragment.has('access_token')||fragment.has('refresh_token');
 if(!code&&!failure&&!implicit)return false;
 let pending;try{pending=JSON.parse(sessionStorage.getItem(googleFlowKey())||'null');sessionStorage.removeItem(googleFlowKey());}catch{/* Missing storage never authorizes a callback. */}
 // Remove callback credentials before network requests or rendering. Never accept fragment tokens.
 for(const name of ['code','error','error_code','error_description','sb_flow_id'])here.searchParams.delete(name);
 here.hash=/^#live-host(\/\d{6})?$/.test(pending?.route||'')?pending.route:'#live-host';
 history.replaceState(null,'',here.href);
 if(failure)throw new Error(failure==='access_denied'?'Google sign-in was cancelled. You can try again.':'Google sign-in could not finish. Please try again.');
 if(implicit)throw new Error('Your email may now be confirmed. Sign in again to open your dashboard.');
 if(!pending||pending.redirect!==here.origin+here.pathname||!Number.isFinite(pending.createdAt)||Date.now()-pending.createdAt<0||Date.now()-pending.createdAt>600000||!/^[A-Za-z0-9_-]{43}$/.test(pending.verifier||''))throw new Error('This sign-in has expired. Please try Google again in this tab.');
 const data=await authRequest('token?grant_type=pkce',{auth_code:code,code_verifier:pending.verifier});
 if(!data.access_token||!data.refresh_token||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw new Error('Google sign-in did not return a valid session. Please try again.');
 saveSession(normalizeSession(data));return true;
}
export async function signInLecturer(email,password){const data=await authRequest('token?grant_type=password',{email,password});saveSession(normalizeSession(data));}
export async function registerLecturer(email,password){const data=await authRequest('signup',{email,password});if(data.access_token){saveSession(normalizeSession(data));return true;}return false;}
export async function signOutLecturer(){const old=storedSession();saveSession(null);if(old?.access_token)await authRequest('logout?scope=local',{},old.access_token).catch(()=>{});}
async function lecturerToken(){
 const session=storedSession();if(!session?.access_token)return null;
 if(session.expires_at>Date.now()+60000)return session.access_token;
 if(!refreshing)refreshing=authRequest('token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(data=>{saveSession(normalizeSession(data));return data.access_token;}).catch(error=>{if([400,401,403].includes(error.status))saveSession(null);throw error;}).finally(()=>{refreshing=null;});
 return refreshing;
}
export async function liveRequest(path,{body,token,signal}={}){
 const method=body?'POST':'GET';let url,headers,payload;
 if(usesSupabase()){
  if(!supabaseReady())throw new Error('The live classroom is being activated. Solo practice and revision papers are available.');
  const hostPath=['whoami','sessions','create'].includes(path)||/^rooms\/\d{6}\/(host|control|results)$/.test(path);
  const jwt=hostPath?await lecturerToken():null;
  url=config().supabase.url+'/rest/v1/rpc/jom_live';
  headers={apikey:config().supabase.publishableKey,'Content-Type':'application/json',...(jwt?{Authorization:'Bearer '+jwt}:{})};
  payload=JSON.stringify({p_path:path,p_method:method,p_body:body||{},p_player_token:token||null});
 }else{
  url=(config().apiBase||'')+'/api/live/'+path;
  headers={...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})};payload=body?JSON.stringify(body):undefined;
 }
 const response=await fetch(url,{credentials:usesSupabase()||config().apiBase?'omit':'same-origin',method:usesSupabase()?'POST':method,headers,body:payload,signal,cache:'no-store'});
 let data;try{data=await response.json();}catch{throw new Error('The live game is unavailable. Please retry.');}
 if(!response.ok){if(usesSupabase()&&response.status===401&&headers.Authorization)saveSession(null);throw Object.assign(new Error(data.error||data.message||'Please retry.'),{status:response.status});}
 if(usesSupabase()){if(data.status>=400)throw Object.assign(new Error(data.body?.error||'Please retry.'),{status:data.status});return data.body;}
 return data;
}
