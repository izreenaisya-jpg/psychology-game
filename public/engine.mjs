export const VERSION=1;
export function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function blankResponse(){return {choice:null,bonus:0,checks:[]};}
export function scoreResponse(question,response,revealed){
  if(!revealed||!response)return 0;
  if(question.type==='quiz'||question.type==='claim')return (response.choice===question.correct?2:0)+Math.max(0,Math.min(2,Number(response.bonus)||0));
  return question.rubric.reduce((sum,_,i)=>sum+(response.checks?.[i]===true?1:0),0);
}
export function teamTotal(session,team,deck){return deck.reduce((sum,q,i)=>sum+scoreResponse(q,session.responses[i]?.[team],session.revealed[i]),0);}
export function maxScore(deck){return deck.reduce((n,q)=>n+((q.type==='quiz'||q.type==='claim')?4:q.rubric.length),0);}
export function newClass(names){return {version:VERSION,teams:names.map(n=>n.trim()).filter(Boolean).slice(0,8),index:0,responses:{},revealed:{},ended:false};}
export function newSolo(bank,count=10){return {version:VERSION,ids:shuffle(bank).slice(0,count).map(q=>q.id),index:0,answers:{},drafts:{},selfChecks:{},finished:false};}
export function soloScore(solo,bank){return solo.ids.reduce((sum,id)=>sum+(solo.answers[id]?.choice===bank.find(q=>q.id===id)?.correct?2:0),0);}
export function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function csvCell(value){let s=String(value);if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function rankTeams(session,deck){return session.teams.map((name,index)=>({name,index,score:teamTotal(session,index,deck)})).sort((a,b)=>b.score-a.score||a.index-b.index);}
