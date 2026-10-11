import {handleLive} from './live-service.mjs';
import {studentOrigin as STUDENT_ORIGIN} from './live-origins.mjs';
function studentRoute(path,method){
 return method==='GET'&&/^rooms\/\d{6}$/.test(path)||method==='POST'&&(path==='join'||/^rooms\/\d{6}\/answer$/.test(path));
}
/** @param {Request} request @param {{db?:any,user?:{userId:string,displayName?:string}|null,now?:number,signInPath?:string}} context */
export async function handleLiveHttp(request,context={}){
 const url=new URL(request.url),origin=request.headers.get('origin'),path=url.pathname.replace(/^\/api\/live\/?/,'');
 const crossOrigin=!!origin&&origin!==url.origin;
 if(crossOrigin){
  const method=request.method==='OPTIONS'?request.headers.get('access-control-request-method'):request.method;
  if(origin!==STUDENT_ORIGIN||!studentRoute(path,method))return Response.json({error:'This origin cannot access that route.'},{status:403,headers:{'Cache-Control':'no-store'}});
  const headers={'Access-Control-Allow-Origin':STUDENT_ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600','Vary':'Origin','Cache-Control':'no-store'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const response=await handleLive(request,context);
  const result=new Response(response.body,{status:response.status,headers:response.headers});
  for(const [name,value] of Object.entries(headers))result.headers.set(name,value);
  return result;
 }
 return handleLive(request,context);
}
