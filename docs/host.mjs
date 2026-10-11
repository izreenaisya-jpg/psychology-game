import {mountQuestionBank,unmountQuestionBank,canLeaveQuestionBank} from './questions.mjs?v=446523452e11';
import {mountLive,unmountLive} from './live.mjs?v=446523452e11';
import {signOutLecturer,supabaseReady,finishGoogleSignIn} from './backend.mjs?v=446523452e11';
const main=document.querySelector('#main');
let authError='';
function render(){
 if(!supabaseReady()){main.innerHTML='<div class="eyebrow">Lecturer’s dashboard</div><h1 class="page-title">Lecturer setup in progress.</h1><section class="panel"><p>This GitHub dashboard is ready for activation. Live sessions will be available here once the database and lecturer account are connected.</p></section>';return;}
 const route=location.hash.slice(1),openingError=authError;
 if(route!=='live-bank'&&!canLeaveQuestionBank()){history.replaceState(null,'','#live-bank');return;}
 unmountQuestionBank();
 if(route==='live-bank'){unmountLive();mountQuestionBank(main,{showSignIn:message=>{unmountQuestionBank();mountLive('live-host',main,{authError:message||openingError,onAuthenticated:render});}});authError='';return;}
 mountLive(/^live-host(\/\d{6})?$/.test(route)?route:'live-host',main,{authError});authError='';
}
document.querySelector('#host-signout').addEventListener('click',async()=>{if(!canLeaveQuestionBank())return;unmountQuestionBank();await signOutLecturer();location.hash='live-host';render();});
window.addEventListener('hashchange',render);
if(!supabaseReady())document.querySelector('#host-signout').hidden=true;
try{if(supabaseReady())await finishGoogleSignIn();}catch(e){authError=e.message;}
render();
