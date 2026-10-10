import {deck} from '../public/deck.mjs';
import {bank} from '../public/bank.mjs';

const MAX_PLAYERS=60, ROOM_LIFETIME=8*60*60*1000;
class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new HttpError(status,message);};
const query=(db,sql,...args)=>db.prepare(sql).bind(...args);
const hash=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
function token(){const bytes=crypto.getRandomValues(new Uint8Array(32));return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
function pin(){let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=4294800000);return String(n%900000+100000);}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function makeDeck(count){const first=deck.filter(q=>q.options).map(q=>({...q}));const extra=shuffle([...bank]).slice(0,Math.max(0,count-first.length)).map(q=>({...q,tag:'Revision challenge',follow:'Explain why the correct option fits, and why one other option does not.'}));return [...first,...extra].slice(0,count);}
export function calculatePoints(correct,elapsed,seconds,speed){return correct?1000+(speed?Math.max(0,Math.round(200*(1-Math.min(seconds*1000,Math.max(0,elapsed))/(seconds*1000)))):0):0;}
function needOwner(user,room){if(!user?.userId)fail(401,'Sign in with ChatGPT to host a session.');if(room&&room.owner_id!==user.userId)fail(403,'Only the session host can open these records or control this game.');}
async function roomByCode(db,code){if(!/^\d{6}$/.test(code))fail(400,'Enter the six-digit game PIN.');const room=await query(db,'SELECT * FROM live_rooms WHERE code = ?',code).first();if(!room)fail(404,'That PIN was not found. Check it with your lecturer.');return room;}
async function playerFromRequest(db,request,room){const bearer=request.headers.get('authorization')||'';if(!/^Bearer [a-f0-9]{64}$/.test(bearer))return null;return query(db,'SELECT * FROM live_players WHERE room_id = ? AND token_hash = ?',room.id,await hash(bearer.slice(7))).first();}
async function payload(request){if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Send JSON.');const text=await request.text();if(text.length>8192)fail(413,'Request too large.');try{return JSON.parse(text);}catch{fail(400,'Invalid request.');}}
function validIndex(v){if(!Number.isInteger(v)||v<0||v>30)fail(400,'Invalid question.');return v;}
async function snapshot(db,room,now,player=null,host=false){
 const qs=JSON.parse(room.deck_json),q=qs[room.question_index],revealed=['reveal','finished'].includes(room.state),cutoff=room.state==='question'?room.question_index:room.question_index+1;
 const ranks=(await query(db,`SELECT p.id,p.nickname,COALESCE(SUM(CASE WHEN a.question_index < ? THEN a.points ELSE 0 END),0) AS score,COALESCE(SUM(CASE WHEN a.question_index < ? THEN a.correct ELSE 0 END),0) AS correct_count FROM live_players p LEFT JOIN live_answers a ON a.player_id=p.id AND a.room_id=p.room_id WHERE p.room_id=? GROUP BY p.id ORDER BY score DESC,correct_count DESC,p.joined_at ASC`,cutoff,cutoff,room.id).all()).results;
 let prevScore=null,prevCorrect=null,rank=0;ranks.forEach((p,i)=>{if(p.score!==prevScore||p.correct_count!==prevCorrect)rank=i+1;p.rank=rank;prevScore=p.score;prevCorrect=p.correct_count;});
 const counts=(await query(db,'SELECT choice,COUNT(*) AS count FROM live_answers WHERE room_id=? AND question_index=? GROUP BY choice',room.id,room.question_index).all()).results;
 const out={code:room.code,title:room.title,state:room.state,questionIndex:room.question_index,total:qs.length,seconds:room.seconds,speedBonus:!!room.speed_bonus,now,closesAt:room.closes_at,openedAt:room.opened_at,version:room.version,acceptingAnswers:room.state==='question'&&now<room.closes_at,players:ranks,playerCount:ranks.length,answeredCount:counts.reduce((n,c)=>n+c.count,0),maxPlayers:MAX_PLAYERS};
 if(q&&room.state!=='lobby'){out.question={id:q.id,tag:q.tag||'Revision',stem:q.stem,claim:q.claim,options:q.options};if(revealed)Object.assign(out.question,{correct:q.correct,explanation:q.explanation,follow:q.follow||'Explain why the answer fits, using a concept from our course.'});}
 if(revealed&&q)out.distribution=q.options.map((_,i)=>counts.find(c=>c.choice===i)?.count||0);
 if(player){const answer=await query(db,'SELECT choice,points,correct FROM live_answers WHERE room_id=? AND player_id=? AND question_index=?',room.id,player.id,room.question_index).first();out.me={id:player.id,nickname:player.nickname,...ranks.find(p=>p.id===player.id),answer:answer?{choice:answer.choice,...(revealed?{points:answer.points,correct:!!answer.correct}:{})}:null};}
 if(host)out.isHost=true;
 return out;
}
/** @param {Request} request @param {{db?:any,user?:{userId:string,displayName?:string}|null,now?:number,signInPath?:string}} options */
export async function handleLive(request,{db,user=null,now=Date.now(),signInPath='/signin-with-chatgpt?return_to=%2F%23live-host'}={}){
 try{
  const url=new URL(request.url),path=url.pathname.replace(/^\/api\/live\/?/,'').split('/').filter(Boolean),method=request.method;
  if(method==='POST'){const origin=request.headers.get('origin');if(origin&&origin!==url.origin)fail(403,'Use this site to submit your answer.');}
  if(path[0]==='whoami'&&method==='GET')return json({authenticated:!!user,displayName:user?.displayName||'',signInPath});
  if(!db)fail(503,'The live game is temporarily unavailable. Please retry.');
  if(path[0]==='sessions'&&method==='GET'){needOwner(user);const rooms=(await query(db,`SELECT r.code,r.title,r.state,r.question_index,r.created_at,(SELECT COUNT(*) FROM live_players p WHERE p.room_id=r.id) AS player_count FROM live_rooms r WHERE owner_id=? ORDER BY created_at DESC LIMIT 30`,user.userId).all()).results;return json({sessions:rooms});}
  if(path[0]==='create'&&method==='POST'){
   needOwner(user);const data=await payload(request),count=Number(data.count||15),seconds=Number(data.seconds||45);
   if(![10,15,20].includes(count)||![30,45,60,75].includes(seconds))fail(400,'Choose the available question and timer settings.');
   const recent=await query(db,'SELECT COUNT(*) AS n FROM live_rooms WHERE owner_id=? AND created_at>?',user.userId,now-86400000).first();if(recent.n>=20)fail(429,'Daily session limit reached. Reopen an existing session or try tomorrow.');
   const title=String(data.title||'Jom Philosophy · Live').trim().slice(0,80)||'Jom Philosophy · Live';
   const id=crypto.randomUUID(),qs=JSON.stringify(makeDeck(count));let code;
   for(let i=0;i<5;i++){code=pin();try{await query(db,'INSERT INTO live_rooms (id,code,owner_id,title,state,question_index,deck_json,seconds,speed_bonus,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',id,code,user.userId,title,'lobby',-1,qs,seconds,data.speedBonus===true?1:0,now,now,0).run();break;}catch(e){if(!String(e).includes('UNIQUE'))throw e;if(i===4)fail(503,'Please try creating the session again.');}}
   return json({code},201);
  }
  if(path[0]==='join'&&method==='POST'){
   const data=await payload(request),room=await roomByCode(db,String(data.code||'')),nickname=String(data.nickname||'').normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu,'').replace(/\s+/g,' ').trim();
   if(nickname.length<1||nickname.length>24)fail(400,'Choose a display name of 1–24 characters.');
   if(room.state!=='lobby'||now-room.created_at>ROOM_LIFETIME)fail(409,'Joining is closed. Ask your lecturer to open a new game.');
   const id=crypto.randomUUID(),secret=token();
   try{const inserted=await query(db,`INSERT INTO live_players (id,room_id,nickname,name_key,token_hash,joined_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM live_rooms WHERE id=? AND state='lobby' AND created_at>?) AND (SELECT COUNT(*) FROM live_players WHERE room_id=?)<?`,id,room.id,nickname,nickname.toLocaleLowerCase('en'),await hash(secret),now,room.id,now-ROOM_LIFETIME,room.id,MAX_PLAYERS).run();if(!inserted.meta.changes)fail(409,'This lobby is full or the game has already started.');}catch(e){if(String(e).includes('UNIQUE'))fail(409,'That name is taken. Add an initial or a number.');throw e;}
   return json({code:room.code,playerId:id,token:secret,nickname},201);
  }
  if(path[0]!=='rooms'||!path[1])fail(404,'Not found.');
  const room=await roomByCode(db,path[1]),action=path[2];
  if(action==='host'||action==='control'||action==='results')needOwner(user,room);
  if(!action&&now-room.created_at>ROOM_LIFETIME)fail(410,'This session link has expired. Your lecturer can still open the results.');
  if(method==='GET'&&(!action||action==='host')){const player=await playerFromRequest(db,request,room);return json(await snapshot(db,room,now,player,action==='host'));}
  if(action==='results'&&method==='GET'){
   const qs=JSON.parse(room.deck_json),rows=(await query(db,'SELECT p.nickname,a.question_index,a.choice,a.correct,a.points,a.answered_at,a.elapsed_ms FROM live_answers a JOIN live_players p ON p.id=a.player_id WHERE a.room_id=? ORDER BY p.nickname,a.question_index',room.id).all()).results;
   return json({session:await snapshot(db,room,now,null,true),questions:qs,answers:rows});
  }
  if(action==='control'&&method==='POST'){
   const data=await payload(request);if(data.version!==room.version)fail(409,'The session has changed. Refresh and try again.');
   if(now-room.created_at>ROOM_LIFETIME&&data.action!=='finish')fail(410,'This session expired. Finish it and create a new game.');
   const qs=JSON.parse(room.deck_json);let state=room.state,index=room.question_index,opened=room.opened_at,closes=room.closes_at;
   if(data.action==='start'&&state==='lobby'){const players=await query(db,'SELECT COUNT(*) AS n FROM live_players WHERE room_id=?',room.id).first();if(!players.n)fail(409,'Wait for at least one player to join.');state='question';index=0;opened=now;closes=now+room.seconds*1000;}
   else if(data.action==='reveal'&&state==='question')state='reveal';
   else if(data.action==='next'&&state==='reveal'){if(index>=qs.length-1)state='finished';else{state='question';index++;opened=now;closes=now+room.seconds*1000;}}
   else if(data.action==='finish'&&state!=='finished')state='finished';
   else fail(409,'That action is not available in this round.');
   const result=await query(db,'UPDATE live_rooms SET state=?,question_index=?,opened_at=?,closes_at=?,updated_at=?,version=version+1 WHERE id=? AND version=?',state,index,opened,closes,now,room.id,room.version).run();if(!result.meta.changes)fail(409,'Another host tab changed the game. Refresh.');
   return json(await snapshot(db,await roomByCode(db,room.code),now,null,true));
  }
  if(action==='answer'&&method==='POST'){
   const player=await playerFromRequest(db,request,room);if(!player)fail(401,'Rejoin with your saved player link.');const data=await payload(request),idx=validIndex(data.questionIndex),choice=data.choice;
   if(!Number.isInteger(choice)||choice<0||choice>3)fail(400,'Choose A, B, C or D.');
   const existing=await query(db,'SELECT choice FROM live_answers WHERE room_id=? AND player_id=? AND question_index=?',room.id,player.id,idx).first();if(existing){if(existing.choice!==choice)fail(409,'Your answer is already locked.');return json({accepted:true,choice});}
   if(room.state!=='question'||room.question_index!==idx||now>=room.closes_at)fail(409,'Answers are closed for this question.');
   const q=JSON.parse(room.deck_json)[idx],elapsed=Math.max(0,now-room.opened_at),correct=choice===q.correct,points=calculatePoints(correct,elapsed,room.seconds,!!room.speed_bonus);
   try{const inserted=await query(db,`INSERT INTO live_answers (room_id,player_id,question_index,choice,answered_at,elapsed_ms,correct,points) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM live_rooms WHERE id=? AND state='question' AND question_index=? AND closes_at>?)`,room.id,player.id,idx,choice,now,elapsed,correct?1:0,points,room.id,idx,now).run();if(!inserted.meta.changes)fail(409,'Answers just closed. Wait for the next question.');}catch(e){if(String(e).includes('UNIQUE')){const a=await query(db,'SELECT choice FROM live_answers WHERE room_id=? AND player_id=? AND question_index=?',room.id,player.id,idx).first();if(a?.choice!==choice)fail(409,'Your answer is already locked.');}else throw e;}
   return json({accepted:true,choice});
  }
  fail(404,'Not found.');
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);console.error('Live API failure',e);return json({error:'The live game could not save this request. Please retry.'},500);}
}
function json(value,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
