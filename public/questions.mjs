import {escapeHtml as esc} from './engine.mjs';
import {isStudentPage} from './audience.mjs';
import {liveRequest} from './backend.mjs';

let cleanup = () => {}, mayLeave = () => true;
export function unmountQuestionBank() { cleanup(); cleanup = () => {}; mayLeave = () => true; }
export const canLeaveQuestionBank = () => mayLeave();
const scope = chapter => chapter ? `Chapter ${chapter}` : 'Mixed Chapters 4–6';
const blank = () => ({id: '', version: 0, chapter: null, enabled: true, payload: {stem: '', options: ['', '', '', ''], correct: 0, explanation: '', tag: '', follow: '', claim: ''}});

export function mountQuestionBank(main, {showSignIn} = {}) {
  unmountQuestionBank();
  if (isStudentPage()) { location.hash = 'live-join'; return; }
  const abort = new AbortController();
  let stopped = false, busy = false, items = [], editing = null, dirty = false;
  const filters = {search: '', chapter: 'all', status: 'active'};
  const request = (path, opts = {}) => liveRequest(path, {...opts, signal: abort.signal});
  const message = (text, failed = false) => {
    const el = main.querySelector(failed ? '#bank-error' : '#bank-status');
    if (el) { el.textContent = text; el.hidden = !text; }
  };
  function editor() {
    if (!editing) return '<aside class="panel bank-editor"><h2>Your teaching bank</h2><p>Add your own revision questions, or edit a question from the list.</p><p class="notes">Disabling a question keeps it in the database and excludes it from new games.</p><button class="btn primary" type="button" data-bank-action="add">Add question →</button></aside>';
    const q = editing.payload;
    return `<aside class="panel bank-editor"><h2>${editing.id ? 'Edit question' : 'Add question'}</h2><form id="question-editor">
      <div class="field"><label for="bank-chapter">Course scope</label><select id="bank-chapter" name="chapter">${[null,4,5,6].map(c => `<option value="${c || ''}" ${editing.chapter===c?'selected':''}>${scope(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="bank-topic">Topic (optional)</label><input id="bank-topic" name="tag" maxlength="60" value="${esc(q.tag || '')}"></div>
      <div class="field"><label for="bank-stem">Question</label><textarea id="bank-stem" name="stem" maxlength="1000" required>${esc(q.stem)}</textarea></div>
      ${q.options.map((o,i) => `<div class="field"><label for="bank-option-${i}">Choice ${'ABCD'[i]}</label><input id="bank-option-${i}" name="option${i}" maxlength="500" value="${esc(o)}" required></div>`).join('')}
      <div class="field"><label for="bank-correct">Correct answer</label><select id="bank-correct" name="correct">${[0,1,2,3].map(i => `<option value="${i}" ${q.correct===i?'selected':''}>Answer ${'ABCD'[i]}</option>`).join('')}</select></div>
      <div class="field"><label for="bank-explanation">Explanation shown after reveal</label><textarea id="bank-explanation" name="explanation" maxlength="1500" required>${esc(q.explanation)}</textarea></div>
      <details ${q.claim?'open':''}><summary>Discussion prompt / AI Detective (optional)</summary>
        <div class="field"><label for="bank-follow">Discussion prompt</label><textarea id="bank-follow" name="follow" maxlength="500">${esc(q.follow || '')}</textarea></div>
        <div class="field"><label for="bank-claim">Simulated AI claim to evaluate</label><textarea id="bank-claim" name="claim" maxlength="500">${esc(q.claim || '')}</textarea></div>
      </details>
      <label class="live-check"><input type="checkbox" name="enabled" ${editing.enabled?'checked':''}> Active in new live games</label>
      <div class="button-row"><button class="btn primary" type="submit">Save question</button><button class="btn secondary" type="button" data-bank-action="cancel">Cancel</button></div>
    </form></aside>`;
  }
  function renderList() {
    if (stopped) return;
    const search = filters.search.trim().toLowerCase();
    const visible = items.filter(q => (filters.status==='all' || q.enabled===(filters.status==='active')) && (filters.chapter==='all' || String(q.chapter || '')===filters.chapter) && (!search || [q.payload.stem,q.payload.tag,q.payload.explanation,...q.payload.options].join(' ').toLowerCase().includes(search)));
    const list = main.querySelector('#bank-list');
    if (!list) return;
    list.innerHTML = visible.map(q => `<article class="bank-card"><div class="q-top"><span class="pill ${q.enabled?'lime':'purple'}">${q.enabled?'Active':'Inactive'}</span><span>${scope(q.chapter)}</span></div><h3>${esc(q.payload.stem)}</h3>${q.payload.claim?`<p class="claim"><small>Simulated AI claim</small><br>${esc(q.payload.claim)}</p>`:''}<ol class="bank-options" type="A">${q.payload.options.map((o,i) => `<li ${i===q.payload.correct?'class="bank-correct"':''}>${esc(o)}${i===q.payload.correct?' <strong>✓ Correct</strong>':''}</li>`).join('')}</ol><details><summary>Explanation & discussion</summary><p>${esc(q.payload.explanation)}</p><p class="notes">${esc(q.payload.follow || '')}</p></details><div class="button-row"><button class="btn secondary small" type="button" data-bank-action="edit" data-id="${esc(q.id)}">Edit question</button><button class="btn secondary small" type="button" data-bank-action="toggle" data-id="${esc(q.id)}">${q.enabled?'Disable':'Enable'}</button></div></article>`).join('') || '<p class="notes">No matching questions. Try another filter or add a question.</p>';
    main.querySelector('#bank-results').textContent = `${visible.length} questions shown`;
  }
  function draw() {
    if (stopped) return;
    main.innerHTML = `<a class="back" href="#live-host">← My sessions</a><div class="live-header"><div><div class="eyebrow">Lecturer’s dashboard · Chapters 4–6</div><h1 class="page-title">Question bank.</h1><p class="lead">${items.filter(q=>q.enabled).length} active / ${items.length} saved questions. Each new game draws a random set without repeats.</p></div><button class="btn primary" type="button" data-bank-action="add">Add question →</button></div><p class="notes">Changes apply to new games. Existing sessions keep their questions. Add original revision material within the course scope.</p><p id="bank-error" class="alert" role="alert" hidden></p><p id="bank-status" role="status" hidden></p><div class="bank-layout">${editor()}<section class="bank-library"><div class="bank-filters"><div class="field"><label for="bank-search">Search questions</label><input id="bank-search" value="${esc(filters.search)}" type="search" placeholder="Keyword or topic"></div><div class="field"><label for="bank-filter-chapter">Scope</label><select id="bank-filter-chapter">${[['all','All Chapters 4–6'],['','Mixed Chapters 4–6'],['4','Chapter 4'],['5','Chapter 5'],['6','Chapter 6']].map(([value,label])=>`<option value="${value}" ${filters.chapter===value?'selected':''}>${label}</option>`).join('')}</select></div><div class="field"><label for="bank-filter-status">Status</label><select id="bank-filter-status">${[['active','Active'],['inactive','Inactive'],['all','All saved']].map(([value,label])=>`<option value="${value}" ${filters.status===value?'selected':''}>${label}</option>`).join('')}</select></div></div><p id="bank-results" class="notes" role="status"></p><div id="bank-list"></div></section></div>`;
    renderList();
  }
  const discard = () => !dirty || window.confirm('Discard your unsaved question changes?');
  mayLeave = discard;
  function focusEditor() { main.querySelector('#bank-stem')?.focus(); }
  function onInput(event) {
    if (!main.contains(event.target)) return;
    if (event.target.closest('#question-editor')) dirty = true;
    const key = {'bank-search':'search','bank-filter-chapter':'chapter','bank-filter-status':'status'}[event.target.id];
    if (key) { filters[key] = event.target.value; renderList(); }
  }
  async function onClick(event) {
    const b = event.target.closest('[data-bank-action]');
    if (!b || !main.contains(b) || busy || b.disabled) return;
    const action = b.dataset.bankAction;
    if (['add','edit','cancel'].includes(action)) {
      if (!discard()) return;
      editing = action==='add' ? blank() : action==='edit' ? items.find(q=>q.id===b.dataset.id) : null;
      if (action==='edit' && !editing) return;
      dirty=false; draw(); if(editing) focusEditor(); return;
    }
    if (action !== 'toggle') return;
    const q = items.find(q=>q.id===b.dataset.id); if (!q) return;
    if (editing?.id===q.id && !discard()) return;
    busy=true; b.disabled=true; message('',true);
    try {
      const result=await request('questions/save',{body:{...q,enabled:!q.enabled}});
      items=items.map(item=>item.id===q.id?result.question:item);
      if(editing?.id===q.id){editing=result.question;dirty=false;}
      draw(); message(result.question.enabled?'Question enabled for new games.':'Question disabled for new games.');
    } catch(e) { message(e.message,true); }
    finally { busy=false; b.disabled=false; }
  }
  async function onSubmit(event) {
    if (event.target.id!=='question-editor' || !main.contains(event.target)) return;
    event.preventDefault(); if(busy || !editing) return;
    const form=event.target, b=form.querySelector('button[type="submit"]'), data=Object.fromEntries(new FormData(form));
    const payload={stem:data.stem,options:[0,1,2,3].map(i=>data['option'+i]),correct:Number(data.correct),explanation:data.explanation,tag:data.tag,follow:data.follow,claim:data.claim};
    busy=true;b.disabled=true;message('',true);
    try {
      const result=await request('questions/save',{body:{id:editing.id,version:editing.version,chapter:data.chapter?Number(data.chapter):null,enabled:data.enabled==='on',payload}});
      items=items.filter(q=>q.id!==result.question.id).concat(result.question);
      editing=null;dirty=false;draw();message('Question saved. It will apply to new games.');
    } catch(e) { message(e.message,true); }
    finally { busy=false;b.disabled=false; }
  }
  function beforeUnload(event) { if(dirty){event.preventDefault();event.returnValue='';} }
  document.addEventListener('click',onClick);
  document.addEventListener('submit',onSubmit);
  document.addEventListener('input',onInput);
  document.addEventListener('change',onInput);
  window.addEventListener('beforeunload',beforeUnload);
  cleanup=()=>{stopped=true;abort.abort();document.removeEventListener('click',onClick);document.removeEventListener('submit',onSubmit);document.removeEventListener('input',onInput);document.removeEventListener('change',onInput);window.removeEventListener('beforeunload',beforeUnload);};
  main.innerHTML='<p class="lead" role="status">Opening your question bank…</p><p id="bank-error" class="alert" role="alert" hidden></p><p id="bank-status" role="status" hidden></p>';
  (async()=>{
    const who=await request('whoami'); if(stopped)return;
    if(!who.authenticated){showSignIn?.();return;}
    if(!who.authorized){message('Only an approved lecturer can manage the question bank.',true);return;}
    const result=await request('questions'); if(stopped)return;
    items=result.questions;draw();
  })().catch(e=>{if(!stopped){if(e.status===401&&showSignIn)showSignIn(e.message);else message(e.message,true);}});
}
