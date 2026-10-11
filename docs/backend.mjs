const config=()=>globalThis.JOM_CONFIG||{};
export const usesSupabase=()=>config().backend==='supabase';
export const supabaseReady=()=>!!(config().supabase?.url&&config().supabase?.publishableKey);
const sessionKey=()=>`jom-lecturer-${config().supabase?.url||'unconfigured'}`;
let authMemory=null,refreshing=null;
function storedSession(){try{return authMemory||JSON.parse(sessionStorage.getItem(sessionKey())||'null');}catch{return authMemory;}}
function saveSession(data){authMemory=data;try{if(data)sessionStorage.setItem(sessionKey(),JSON.stringify(data));else sessionStorage.removeItem(sessionKey());}catch{/* This tab can still host without persistent storage. */}}
async function authRequest(path,body,bearer){
 if(!supabaseReady())throw new Error('Lecturer setup is in progress. Please return after activation.');
 const response=await fetch(config().supabase.url+'/auth/v1/'+path,{method:'POST',credentials:'omit',cache:'no-store',headers:{apikey:config().supabase.publishableKey,'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{})},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.msg||data.error_description||data.message||'Sign in failed. Please retry.'),{status:response.status});return data;
}
function normalizeSession(data){return {access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+data.expires_in*1000};}
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
