import {mountLive} from './live.mjs?v=95094a9e48d3';
import {signOutLecturer,supabaseReady,finishGoogleSignIn} from './backend.mjs?v=95094a9e48d3';
const main=document.querySelector('#main');
let authError='';
function render(){
 if(!supabaseReady()){main.innerHTML='<div class="eyebrow">Lecturer’s dashboard</div><h1 class="page-title">Lecturer setup in progress.</h1><section class="panel"><p>This GitHub dashboard is ready for activation. Live sessions will be available here once the database and lecturer account are connected.</p></section>';return;}
 const route=location.hash.slice(1);
 mountLive(/^live-host(\/\d{6})?$/.test(route)?route:'live-host',main,{authError});authError='';
}
document.querySelector('#host-signout').addEventListener('click',async()=>{await signOutLecturer();location.hash='live-host';render();});
window.addEventListener('hashchange',render);
if(!supabaseReady())document.querySelector('#host-signout').hidden=true;
try{if(supabaseReady())await finishGoogleSignIn();}catch(e){authError=e.message;}
render();
