import {mountLive} from './live.mjs?v=80849631c7cf';
import {signOutLecturer,supabaseReady} from './backend.mjs?v=80849631c7cf';
const main=document.querySelector('#main');
function render(){
 if(!supabaseReady()){main.innerHTML='<div class="eyebrow">Lecturer’s dashboard</div><h1 class="page-title">Lecturer setup in progress.</h1><section class="panel"><p>This GitHub dashboard is ready for activation. Live sessions will be available here once the database and lecturer account are connected.</p></section>';return;}
 const route=location.hash.slice(1);
 mountLive(/^live-host(\/\d{6})?$/.test(route)?route:'live-host',main);
}
document.querySelector('#host-signout').addEventListener('click',async()=>{await signOutLecturer();location.hash='live-host';render();});
window.addEventListener('hashchange',render);
if(!supabaseReady())document.querySelector('#host-signout').hidden=true;
render();
