/* ---------- date helpers (local, no timezone drift) ---------- */
const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return toISO(d); };
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
const TODAY = toISO(new Date());

const weekOf = s => Math.floor(daysBetween(PROGRAM_START, s) / 7) + 1;
const clampWeek = w => Math.min(Math.max(w, 1), 19);
const dowOf = s => toDate(s).getDay();
const mondayOf = s => addDays(s, dowOf(s) === 0 ? -6 : 1 - dowOf(s));
const fmt = s => toDate(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = s => toDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const kg = n => n >= 10000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString('en-IN');

/* ---------- program lookups ---------- */
function sessionFor(profile, date) {
  const w = weekOf(date);
  if (w < 1 || w > 19) return { id: 'REST', def: SESSIONS.REST };
  const id = sessionIdFor(profile, w, dowOf(date));
  return { id, def: SESSIONS[id] };
}
const plannedType = def => ({ strength: 'gym', swim: 'swim' })[def.kind] || null;

/* A day only breaks the streak if it was required: not rest, not optional. */
const required = def => def.kind !== 'rest' && !def.optional;

/* ---------- activity records ---------- */
/* state.profiles[who].days[date] = { acts: [activity] }
   gym activity:   { id, type:'gym', mode:'plan'|'custom', sessionId, exercises:[{ name, sets:[{ w, r, s, done }] }], done }
   other activity: { id, type, duration, intensity, distanceKm, unbroken, distanceM, label, note, checks, done } */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const newSet = () => ({ w: '', r: '', s: '', done: false });
const planExercises = sid => SESSIONS[sid].items.map(it => ({
  name: it.name, sets: Array.from({ length: it.sets || 3 }, newSet),
}));

const KEY = 'wedprep_v1';
const blank = () => ({ days: {}, metrics: {}, checkins: {} });

/* The first version stored one ticked session per day; carry those over as activities. */
function upgrade(p, prof) {
  prof = Object.assign(blank(), prof);
  if (prof.sessions) {
    for (const [d, rec] of Object.entries(prof.sessions)) {
      const notes = Object.values(rec.logs || {}).filter(Boolean);
      if (!rec.done && !notes.length) continue;
      const sid = rec.override || sessionFor(p, d).id;
      const def = SESSIONS[sid] || SESSIONS.REST;
      const type = def.kind === 'swim' ? 'swim' : def.kind === 'strength' ? 'gym' : 'other';
      const act = { id: uid(), type, done: !!rec.done, note: notes.join(' · ') };
      if (type === 'gym') Object.assign(act, { mode: 'plan', sessionId: sid, exercises: planExercises(sid) });
      (prof.days[d] = prof.days[d] || { acts: [] }).acts.push(act);
    }
    delete prof.sessions;
  }
  return prof;
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.profiles) {
      for (const p of Object.keys(PROFILES)) raw.profiles[p] = upgrade(p, raw.profiles[p]);
      return raw;
    }
  } catch (e) { /* fall through to a fresh store */ }
  return { profiles: { mahak: blank(), vaibhav: blank() } };
}
/* Wrapped: browsers block localStorage when a page is opened directly as a file:// URL */
const store = () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Could not save — serve this over http rather than opening the file directly.'); }
};
const save = () => { store(); schedulePush(); };

/* Records carry u = last-edited time so two devices can be merged; deleted activities stay as tombstones. */
function mergeState(base, other) {
  let changed = false;
  for (const p of Object.keys(PROFILES)) {
    if (!other.profiles || !other.profiles[p]) continue;
    const a = base.profiles[p], b = upgrade(p, other.profiles[p]);
    for (const [d, day] of Object.entries(b.days)) {
      const tgt = a.days[d] || (a.days[d] = { acts: [] });
      for (const x of day.acts) {
        const i = tgt.acts.findIndex(y => y.id === x.id);
        if (i < 0) { tgt.acts.push(x); changed = true; }
        else if ((x.u || 0) > (tgt.acts[i].u || 0)) { tgt.acts[i] = x; changed = true; }
      }
    }
    for (const k of ['metrics', 'checkins']) {
      for (const [d, v] of Object.entries(b[k])) {
        if (!a[k][d] || (v.u || 0) > (a[k][d].u || 0)) { a[k][d] = v; changed = true; }
      }
    }
  }
  return changed;
}

let state = load();
let who = localStorage.getItem(KEY + '_who') || 'mahak';
const VIEWS = ['today', 'progress', 'body', 'checkin', 'plan'];
let view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';
let cur = TODAY;       // the day shown on Today
let openId = null;     // expanded activity; null = pick automatically, '' = all collapsed
let progEx = null;     // exercise selected on Progress

const me = () => state.profiles[who];
const acts = (p, d) => ((state.profiles[p].days[d] || {}).acts || []).filter(a => !a.deleted);
const dayDone = (p, d) => acts(p, d).some(a => a.done);
const findAct = id => acts(who, cur).find(a => a.id === id);

function addAct(act) {
  const day = me().days[cur] || (me().days[cur] = { acts: [] });
  day.acts.push(act);
}
function removeAct(id) {
  const a = findAct(id); if (!a) return;
  for (const k of Object.keys(a)) if (k !== 'id') delete a[k];
  Object.assign(a, { deleted: true, u: Date.now() });
}

/* When nothing strength is scheduled, suggest the session gone longest without. */
function suggestSession(p, d) {
  const planned = sessionFor(p, d);
  if (planned.def.kind === 'strength') return planned.id;
  const blk = blockForWeek(clampWeek(weekOf(d))).n;
  const pool = SESSION_CHOICES[p][blk === 2 || blk === 4 ? 'home' : 'gym'];
  const since = sid => {
    for (let i = 1; i <= 21; i++) {
      if (acts(p, addDays(d, -i)).some(a => a.type === 'gym' && a.sessionId === sid && a.done)) return i;
    }
    return 99;
  };
  return pool.slice().sort((a, b) => since(b) - since(a))[0];
}

function newAct(type) {
  const a = { id: uid(), type, done: false, u: Date.now() };
  if (type === 'gym') {
    a.mode = 'plan';
    a.sessionId = suggestSession(who, cur);
    a.exercises = planExercises(a.sessionId);
  }
  if (type === 'swim') a.checks = {};
  return a;
}

/* Swap in a plan while keeping anything already logged */
function applyPlan(a, sid) {
  const logged = a.exercises.filter(e => e.sets.some(s => hasValue(e.name, s)));
  const fresh = planExercises(sid).map(e => logged.find(l => l.name === e.name) || e);
  const extras = logged.filter(l => !fresh.includes(l));
  a.sessionId = sid;
  a.exercises = fresh.concat(extras);
}

/* ---------- performance ---------- */
const hasValue = (name, s) => TIMED.has(name) ? s.s !== '' && s.s != null : s.r !== '' && s.r != null;

/* Comparable number for "best set": estimated 1-rep max when weighted, reps when bodyweight, seconds when timed */
function score(name, s) {
  if (TIMED.has(name)) return +s.s || 0;
  const w = +s.w || 0, r = +s.r || 0;
  return w > 0 ? w * (1 + r / 30) : r;
}
const fmtSet = (name, s) => TIMED.has(name) ? `${s.s}s` : (+s.w ? `${+s.w}×${s.r}` : `${s.r} reps`);

function exerciseHistory(p, name) {
  const out = [];
  for (const d of Object.keys(state.profiles[p].days).sort()) {
    const sets = [];
    for (const a of acts(p, d)) {
      if (a.type !== 'gym') continue;
      for (const e of a.exercises) if (e.name === name) sets.push(...e.sets.filter(s => hasValue(name, s)));
    }
    if (sets.length) out.push({ date: d, sets });
  }
  return out;
}
const lastBefore = (p, name, d) => exerciseHistory(p, name).filter(x => x.date < d).pop() || null;
function bestBefore(p, name, d) {
  let best = null;
  for (const x of exerciseHistory(p, name)) {
    if (x.date >= d) break;
    for (const s of x.sets) if (!best || score(name, s) > score(name, best)) best = s;
  }
  return best;
}

/* What a set should default to: last session's matching set, else the plan target */
function defaultsFor(a, e, j) {
  const last = lastBefore(who, e.name, cur);
  const ls = last && (last.sets[j] || last.sets[last.sets.length - 1]);
  if (ls) return { w: ls.w, r: ls.r, s: ls.s };
  const info = planItem(a, e.name);
  const n = info && (info.reps.match(/\d+/) || [])[0];
  return TIMED.has(e.name) ? { s: n || '' } : { w: '', r: n || '' };
}
const planItem = (a, name) =>
  a.mode === 'plan' && SESSIONS[a.sessionId] ? SESSIONS[a.sessionId].items.find(it => it.name === name) : null;

function prCount(a) {
  if (a.type !== 'gym') return 0;
  return a.exercises.filter(e => {
    const best = bestBefore(who, e.name, cur);
    return best && e.sets.some(s => hasValue(e.name, s) && score(e.name, s) > score(e.name, best));
  }).length;
}

function actSummary(a) {
  if (a.type === 'gym') {
    let sets = 0, vol = 0;
    for (const e of a.exercises) for (const s of e.sets) {
      if (hasValue(e.name, s)) { sets++; vol += (+s.w || 0) * (+s.r || 0); }
    }
    const title = a.mode === 'plan' && SESSIONS[a.sessionId] ? SESSIONS[a.sessionId].title : 'Own workout';
    return [title, `${a.exercises.length} exercise${a.exercises.length === 1 ? '' : 's'}`, `${sets} sets`, vol ? `${kg(vol)} kg lifted` : ''].filter(Boolean).join(' · ');
  }
  const bits = [];
  if (a.duration) bits.push(`${a.duration} min`);
  if (a.unbroken) bits.push(`${a.unbroken} m unbroken`);
  if (a.distanceM) bits.push(`${a.distanceM} m total`);
  if (a.distanceKm) bits.push(`${a.distanceKm} km`);
  if (a.intensity) bits.push(a.intensity);
  return bits.join(' · ') || (a.done ? 'Done' : 'Nothing logged yet');
}

const bestUnbroken = p => {
  let b = 0;
  for (const d of Object.keys(state.profiles[p].days)) {
    for (const a of acts(p, d)) if (a.type === 'swim') b = Math.max(b, +a.unbroken || 0);
  }
  return b;
};

/* ---------- streak & week ---------- */
function streakFor(profile) {
  let n = 0, d = TODAY;
  for (let i = 0; i < 250; i++) {
    const { def } = sessionFor(profile, d);
    if (dayDone(profile, d)) { n++; d = addDays(d, -1); continue; }
    if (!required(def) || d === TODAY) { d = addDays(d, -1); continue; }
    break;
  }
  return n;
}

function weekStats(profile, date) {
  const mon = mondayOf(date);
  let done = 0, planned = 0, bonus = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const def = sessionFor(profile, d).def;
    if (required(def)) { planned++; if (dayDone(profile, d)) done++; }
    else if (dayDone(profile, d)) bonus++;
  }
  return { done, planned, bonus, mon };
}

/* ---------- theme ---------- */
function applyTheme() {
  const p = PROFILES[who];
  document.documentElement.style.setProperty('--a1', p.accent);
  document.documentElement.style.setProperty('--a2', p.accent2);
  document.getElementById('segPill').dataset.i = Object.keys(PROFILES).indexOf(who);
}

/* ---------- header ---------- */
const RING_C = 2 * Math.PI * 46;

function renderHeader() {
  const total = daysBetween(PROGRAM_START, WEDDING_DATE);
  const left = daysBetween(TODAY, WEDDING_DATE);
  const elapsed = Math.min(Math.max(total - left, 0), total);

  document.getElementById('days').textContent = left > 0 ? left : 0;
  document.getElementById('daysUnit').textContent = left === 1 ? 'day' : left <= 0 ? '—' : 'days';

  const ring = document.getElementById('ringFg');
  ring.style.strokeDasharray = RING_C;
  ring.style.strokeDashoffset = RING_C * (1 - elapsed / total);

  const w = clampWeek(weekOf(TODAY));
  const block = blockForWeek(w);
  document.getElementById('weekChip').textContent = `WEEK ${w} / 19`;
  document.getElementById('blockLabel').textContent = `Block ${block.n} · ${block.name}`;
  document.getElementById('whereLabel').textContent = block.where;

  document.getElementById('blockbar').innerHTML = BLOCKS.map(b => {
    if (w > b.weeks[1]) return '<i class="done"></i>';
    if (w < b.weeks[0]) return '<i></i>';
    const pct = Math.round(((w - b.weeks[0] + 1) / (b.weeks[1] - b.weeks[0] + 1)) * 100);
    return `<i class="now" style="--pct:${pct}%"></i>`;
  }).join('');
}

/* ---------- today ---------- */
const CHECK = '<svg viewBox="0 0 24 24"><polyline points="4,12 10,18 20,6"/></svg>';
const SWIM_ALONE = `<div class="banner alert"><b>Never swim alone.</b> Vaibhav in the water or watching from the poolside — not in the gym, not on his phone. If he can't be there, do a land session instead.</div>`;
const list = items => `<ul>${items.map(l => `<li>${l}</li>`).join('')}</ul>`;

function renderToday() {
  const w = weekOf(cur);
  const planned = sessionFor(who, cur);
  const day = acts(who, cur);
  const pType = plannedType(planned.def);

  document.getElementById('dayTitle').textContent =
    cur === TODAY ? 'Today' : cur === addDays(TODAY, -1) ? 'Yesterday' : fmt(cur).split(' ')[0];
  document.getElementById('dayDate').textContent = fmt(cur);
  document.getElementById('nextDay').disabled = cur >= TODAY;
  document.getElementById('backToday').hidden = cur === TODAY;

  const planText = planned.def.kind === 'rest' ? 'Rest day'
    : planned.def.kind === 'active' ? 'Optional — badminton, cycling, a walk'
    : planned.def.kind === 'swim' ? `Swim · ${planned.def.focus}`
    : `${planned.def.title} · ${planned.def.focus}`;
  document.getElementById('dayPlan').innerHTML = `<span>On the plan</span>${esc(planText)}`;

  /* banners */
  const alerts = [];
  if (who === 'mahak' && (planned.def.kind !== 'rest' || day.length)) {
    alerts.push(`<div class="banner alert">Eat before you train — never fasted. Medication at its usual time, regardless of what the schedule says.</div>`);
  }
  if (!sync) {
    alerts.push(`<div class="banner note"><span class="tag">This device only</span>Your logs aren't syncing, so other phones won't see them. <button class="link" data-goto-sync>Set up sync</button></div>`);
  }
  if (cur === TODAY && MILESTONES[w]) {
    alerts.push(`<div class="banner note"><span class="tag">Week ${w}</span>${MILESTONES[w]}</div>`);
  }
  document.getElementById('alerts').innerHTML = alerts.join('');

  /* activity picker */
  document.getElementById('actChips').innerHTML = Object.entries(ACTIVITIES).map(([id, A]) => {
    const logged = day.some(a => a.type === id);
    return `<button class="pick" data-type="${id}" data-planned="${id === pType}" data-logged="${logged}">
      <span class="g">${A.glyph}</span><span class="l">${A.label}</span>
      ${id === pType ? '<span class="flag">planned</span>' : ''}${logged ? `<span class="ok">${CHECK}</span>` : ''}
    </button>`;
  }).join('');
  document.getElementById('pickHint').textContent = day.length
    ? 'Doing something else as well? Tap it too.'
    : planned.def.kind === 'rest' ? 'Rest day — nothing needed. If you do move, tap what it was.'
    : `Tap what you're doing. ${pType ? ACTIVITIES[pType].label : 'Anything'} is on the plan, but anything counts.`;

  /* activities */
  if (openId === null) openId = (day.find(a => !a.done) || {}).id || '';
  document.getElementById('actList').innerHTML = day.map(renderAct).join('');

  /* week */
  const { done, planned: plannedN, mon } = weekStats(who, TODAY);
  document.getElementById('weekdots').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i);
    const L = 'MTWTFSS'[i];
    const sel = d === cur ? ' sel' : '';
    if (dayDone(who, d)) return `<button data-day="${d}" class="done${sel}">${L}</button>`;
    if (d < TODAY && required(sessionFor(who, d).def)) return `<button data-day="${d}" class="miss${sel}">${L}</button>`;
    return `<button data-day="${d}" class="${d === TODAY ? 'today' : ''}${sel}" ${d > TODAY ? 'disabled' : ''}>${L}</button>`;
  }).join('');

  document.getElementById('statStreak').textContent = streakFor(who);
  document.getElementById('statWeek').textContent = `${done}/${plannedN}`;
  document.getElementById('statTotal').textContent = Object.keys(me().days).filter(d => dayDone(who, d)).length;
}

function renderAct(a) {
  const A = ACTIVITIES[a.type];
  const open = a.id === openId;
  const name = a.type === 'other' && a.label ? a.label : A.label;
  const head = `<div class="act-head" data-action="toggle">
    <span class="act-glyph">${A.glyph}</span>
    <div class="act-t"><b>${esc(name)}</b><div class="act-sum">${esc(actSummary(a))}</div></div>
    <span class="pill ${a.done ? 'done' : ''}">${a.done ? 'Done' : 'Open'}</span>
  </div>`;
  if (!open) return `<div class="card act" data-act="${a.id}">${head}</div>`;

  const body = a.type === 'gym' ? gymBody(a) : a.type === 'swim' ? swimBody(a) : otherBody(a);
  const label = a.done ? 'Done — tap to reopen' : a.type === 'gym' ? 'Finish workout' : 'Save activity';
  return `<div class="card act open" data-act="${a.id}">${head}${body}
    <div class="row"><button class="btn ${a.done ? 'done-state' : 'primary'}" data-action="finish">${label}</button></div>
    <div class="row"><button class="btn ghost" data-action="remove">Remove this activity</button></div>
  </div>`;
}

function gymBody(a) {
  const planned = sessionFor(who, cur);
  const choices = SESSION_CHOICES[who];
  const opt = sid => `<option value="${sid}" ${sid === a.sessionId ? 'selected' : ''}>${SESSIONS[sid].title} — ${SESSIONS[sid].focus}</option>`;

  let top = `<div class="seg-sm">
    <button data-action="mode" data-mode="plan" data-active="${a.mode === 'plan'}">Suggested plan</button>
    <button data-action="mode" data-mode="custom" data-active="${a.mode === 'custom'}">Build my own</button>
  </div>`;
  if (a.mode === 'plan') {
    const why = a.sessionId === 'MVS' ? 'Twenty minutes. Better than zero, every time.'
      : a.sessionId === planned.id ? "Today's scheduled session."
      : planned.def.kind === 'strength' ? `Swapped from ${planned.def.title}.`
      : "Nothing's scheduled in the gym today, so this is the session you've gone longest without.";
    top += `<label class="f"><span>Session</span><select class="f" data-action="session">
      <optgroup label="Gym">${choices.gym.map(opt).join('')}</optgroup>
      <optgroup label="Home / travel">${choices.home.map(opt).join('')}</optgroup>
      <optgroup label="Short on time">${opt('MVS')}</optgroup>
    </select></label><p class="sub why">${why}</p>`;
  } else {
    top += `<p class="sub why">Add each exercise as you do it. Your last numbers show up as you go.</p>`;
  }

  const exs = a.exercises.map((e, i) => exBlock(a, e, i)).join('')
    || `<p class="empty">No exercises yet — pick the first one below.</p>`;
  const add = `<select class="f add-ex" data-action="addex">
    <option value="">+ Add an exercise</option>
    ${Object.entries(LIBRARY).map(([g, names]) => `<optgroup label="${g}">${names.map(n => `<option>${n}</option>`).join('')}</optgroup>`).join('')}
    <optgroup label="Not listed"><option value="__custom">Something else…</option></optgroup>
  </select>`;

  return top
    + `<details class="fold"><summary>Warm-up · 8 min</summary>${list(WARMUP.strength)}</details>`
    + `<div class="exs">${exs}</div>${add}`
    + `<details class="fold"><summary>Cool-down · 5 min</summary>${list(COOLDOWN)}</details>`;
}

function exBlock(a, e, i) {
  const info = planItem(a, e.name);
  const last = lastBefore(who, e.name, cur);
  const best = bestBefore(who, e.name, cur);
  const timed = TIMED.has(e.name);

  const rows = e.sets.map((s, j) => {
    const ph = defaultsFor(a, e, j);
    const pr = best && hasValue(e.name, s) && score(e.name, s) > score(e.name, best);
    const inputs = timed
      ? `<input class="num" data-f="s" type="number" inputmode="numeric" placeholder="${esc(ph.s || 'sec')}" value="${esc(s.s)}"><span class="x">sec</span>`
      : `<input class="num" data-f="w" type="number" step="any" inputmode="decimal" placeholder="${esc(+ph.w ? ph.w : 'kg')}" value="${esc(s.w)}">
         <span class="x">×</span>
         <input class="num" data-f="r" type="number" inputmode="numeric" placeholder="${esc(ph.r || 'reps')}" value="${esc(s.r)}">`;
    return `<div class="setrow" data-set="${j}">
      <span class="setn">${j + 1}</span>${inputs}
      ${pr ? '<span class="prtag">PR</span>' : ''}
      <button class="tick" data-action="tickset" data-on="${!!s.done}" aria-label="Set done">${CHECK}</button>
    </div>`;
  }).join('');

  const meta = [
    info ? `<span class="ex-scheme">${esc(scheme(info))}</span>` : '',
    last ? `<span class="mchip">Last ${fmtShort(last.date)} · ${last.sets.map(s => fmtSet(e.name, s)).join('  ')}</span>`
      : '<span class="mchip">First time logging this</span>',
    best ? `<span class="mchip best">Best ${fmtSet(e.name, best)}</span>` : '',
  ].join('');

  return `<div class="exb" data-ex="${i}">
    <div class="exb-head">
      <span class="ex-name">${esc(e.name)}</span>
      ${info && info.flag === 'new' ? '<span class="badge">NEW</span>' : ''}
      <button class="icon-btn" data-action="rmex" aria-label="Remove exercise">✕</button>
    </div>
    <div class="exb-meta">${meta}</div>
    ${info && info.note ? `<div class="ex-note">${esc(info.note)}</div>` : ''}
    <div class="sets">${rows}</div>
    <div class="exb-actions">
      <button data-action="addset">+ Set</button>
      ${e.sets.length > 1 ? '<button data-action="rmset">− Set</button>' : ''}
      ${last ? '<button data-action="copylast">Copy last time</button>' : ''}
    </div>
  </div>`;
}

function swimBody(a) {
  const def = SESSIONS[swimFor(clampWeek(weekOf(cur)))];
  const best = bestUnbroken(who);
  const pct = Math.min(100, Math.round((best / SWIM_GOAL) * 100));
  const drills = def.items.map((it, i) => `<div class="drill">
    <button class="tick" data-action="drill" data-i="${i}" data-on="${!!(a.checks && a.checks[i])}" aria-label="Done">${CHECK}</button>
    <div class="ex-main">
      <div class="ex-name">${esc(it.name)}</div>
      <div class="ex-scheme">${esc(it.reps)}</div>
      ${it.note ? `<div class="ex-note">${esc(it.note)}</div>` : ''}
    </div>
  </div>`).join('');

  return (who === 'mahak' ? SWIM_ALONE : '')
    + `<div class="goal"><div class="goal-top"><span>Longest unbroken swim</span><b>${best} / ${SWIM_GOAL} m</b></div>
       <div class="goalbar"><i style="width:${pct}%"></i></div></div>`
    + `<details class="fold"><summary>Warm-up · 5 min</summary>${list(WARMUP.swim)}</details>`
    + `<h3>This week's drills · ${esc(def.focus)}</h3>${drills}`
    + `<h3>Log it</h3>${fieldsHTML(a, ACTIVITIES.swim.fields)}`;
}

function otherBody(a) {
  const A = ACTIVITIES[a.type];
  return `<div class="guide"><div class="guide-t">${esc(A.guide.target)}</div>${list(A.guide.points)}</div>`
    + `<h3>Log it</h3>${fieldsHTML(a, A.fields)}`;
}

function fieldsHTML(a, fields) {
  const input = f => {
    const F = FIELD_DEFS[f];
    const num = F.type === 'number';
    return `<label class="f"><span>${F.label}</span><input class="f" data-af="${f}" type="${num ? 'number' : 'text'}"
      ${num ? `step="any" inputmode="${F.mode}"` : ''} value="${esc(a[f])}" placeholder="—"></label>`;
  };
  const nums = fields.filter(f => FIELD_DEFS[f] && FIELD_DEFS[f].type === 'number');
  let html = fields.includes('label') ? input('label') : '';
  if (nums.length) html += `<div class="grid2">${nums.map(input).join('')}</div>`;
  if (fields.includes('intensity')) {
    html += `<label class="f"><span>How hard</span></label><div class="seg-sm">${['Easy', 'Moderate', 'Hard'].map(v =>
      `<button data-action="intensity" data-v="${v}" data-active="${a.intensity === v}">${v}</button>`).join('')}</div>`;
  }
  if (fields.includes('note')) html += input('note');
  return html;
}

/* ---------- progress ---------- */
function renderProgress() {
  const b = blockForWeek(clampWeek(weekOf(TODAY)));
  const from = addDays(PROGRAM_START, (b.weeks[0] - 1) * 7), to = addDays(PROGRAM_START, b.weeks[1] * 7 - 1);
  let gym = 0, swim = 0, mins = 0, sets = 0, vol = 0, active = 0;
  for (const d of Object.keys(me().days)) {
    if (d < from || d > to) continue;
    if (dayDone(who, d)) active++;
    for (const a of acts(who, d)) {
      if (!a.done) continue;
      if (a.type === 'gym') {
        gym++;
        for (const e of a.exercises) for (const s of e.sets) {
          if (hasValue(e.name, s)) { sets++; vol += (+s.w || 0) * (+s.r || 0); }
        }
      } else if (a.type === 'swim') swim++;
      else mins += +a.duration || 0;
    }
  }
  document.getElementById('progBlock').textContent = `Block ${b.n} · ${b.name} · ${fmtShort(from)} – ${fmtShort(to)}`;
  document.getElementById('progStats').innerHTML = [
    [gym, 'Gym'], [swim, 'Swims'], [mins, 'Active min'], [active, 'Days active'], [sets, 'Sets'], [kg(vol), 'kg lifted'],
  ].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');

  /* exercise picker — most recently trained first */
  const lastSeen = {};
  for (const d of Object.keys(me().days).sort()) {
    for (const a of acts(who, d)) {
      if (a.type !== 'gym') continue;
      for (const e of a.exercises) if (e.sets.some(s => hasValue(e.name, s))) lastSeen[e.name] = d;
    }
  }
  const names = Object.keys(lastSeen).sort((x, y) => lastSeen[y].localeCompare(lastSeen[x]) || x.localeCompare(y));
  const sel = document.getElementById('progEx');
  if (!names.length) {
    sel.hidden = true;
    document.getElementById('progExSub').textContent = 'Log a few sets in the gym and each exercise gets its own chart here.';
    document.getElementById('progChart').innerHTML = '';
    document.getElementById('progTable').innerHTML = '';
  } else {
    if (!names.includes(progEx)) progEx = names[0];
    sel.hidden = false;
    sel.innerHTML = names.map(n => `<option ${n === progEx ? 'selected' : ''}>${esc(n)}</option>`).join('');

    const hist = exerciseHistory(who, progEx);
    const timed = TIMED.has(progEx);
    const weighted = !timed && hist.some(x => x.sets.some(s => +s.w > 0));
    const bestOf = x => x.sets.reduce((m, s) => score(progEx, s) > score(progEx, m) ? s : m);
    document.getElementById('progExSub').textContent = timed ? 'Longest hold each session, in seconds.'
      : weighted ? 'Estimated one-rep max from your best set each session. It climbs whether you add weight or add reps.'
      : 'Most reps in a set, each session.';
    drawChart('progChart', [{
      colour: PROFILES[who].accent, fill: true,
      points: hist.map(x => ({ x: x.date, y: Math.round(score(progEx, bestOf(x)) * 10) / 10 })),
    }]);
    document.getElementById('progTable').innerHTML = `<table class="hist"><tr><th>Date</th><th>Sets</th><th>Best</th></tr>`
      + hist.slice().reverse().slice(0, 10).map(x => `<tr><td>${fmtShort(x.date)}</td>
        <td class="wrap">${x.sets.map(s => fmtSet(progEx, s)).join('  ')}</td><td>${fmtSet(progEx, bestOf(x))}</td></tr>`).join('')
      + `</table>`;
  }

  /* swim */
  const swims = Object.keys(me().days).sort().map(d => {
    const u = Math.max(0, ...acts(who, d).filter(a => a.type === 'swim').map(a => +a.unbroken || 0));
    return u ? { x: d, y: u } : null;
  }).filter(Boolean);
  document.getElementById('swimSub').textContent = `Goal: ${SWIM_GOAL} m without stopping. Best so far: ${bestUnbroken(who)} m.`;
  drawChart('swimChart', [{ colour: '#5CC8FF', fill: true, points: swims }], v => `${Math.round(v)} m`);

  /* feed */
  const feed = [];
  for (const d of Object.keys(me().days).sort().reverse()) {
    for (const a of acts(who, d)) feed.push([d, a]);
    if (feed.length >= 14) break;
  }
  document.getElementById('feed').innerHTML = feed.length
    ? feed.map(([d, a]) => {
      const A = ACTIVITIES[a.type];
      const prs = a.done ? prCountOn(a, d) : 0;
      return `<button class="entry feed" data-day="${d}">
        <div class="meta">${fmtShort(d).toUpperCase()} · ${A.glyph} ${esc(a.type === 'other' && a.label ? a.label : A.label)}${a.done ? '' : ' · open'}${prs ? ` · ${prs} PR` : ''}</div>
        <div class="body">${esc(actSummary(a))}</div>
      </button>`;
    }).join('')
    : `<p class="empty">Nothing logged yet.</p>`;
}

function prCountOn(a, d) {
  const saved = cur; cur = d;
  const n = prCount(a);
  cur = saved;
  return n;
}

/* ---------- body ---------- */
const tapeFields = () => TAPE_SITES.filter(t => !t.only || t.only === who);

function renderBody() {
  const m = me().metrics[TODAY] || {};
  document.getElementById('mWeight').value = m.weight ?? '';
  document.getElementById('tapeInputs').innerHTML = tapeFields().map(t =>
    `<label class="f"><span>${t.label}</span><input class="f" type="number" step="0.1" inputmode="decimal" data-tape="${t.key}" value="${m[t.key] ?? ''}" placeholder="—"></label>`
  ).join('');

  const entries = Object.entries(me().metrics).filter(([, v]) => Object.keys(v).some(k => k !== 'u'))
    .sort(([a], [b]) => a < b ? -1 : 1);
  const weights = entries.filter(([, v]) => v.weight != null).map(([d, v]) => ({ x: d, y: +v.weight }));

  const sub = document.getElementById('weightSub');
  if (weights.length >= 2) {
    const delta = weights[weights.length - 1].y - weights[0].y;
    sub.textContent = `${weights[0].y} → ${weights[weights.length - 1].y} kg · ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} kg since ${fmtShort(weights[0].x)}`;
  } else {
    sub.textContent = 'Weigh most mornings. Only the weekly average means anything.';
  }

  const p = PROFILES[who];
  drawChart('weightChart', [{ colour: p.accent, fill: true, points: weights }]);
  drawChart('tapeChart', [
    { colour: p.accent, points: entries.filter(([, v]) => v.waistNavel != null).map(([d, v]) => ({ x: d, y: +v.waistNavel })) },
    { colour: '#3ddc97', points: entries.filter(([, v]) => v.hips != null).map(([d, v]) => ({ x: d, y: +v.hips })) },
  ]);

  const rows = entries.slice().reverse().slice(0, 12);
  document.getElementById('metricHistory').innerHTML = rows.length
    ? `<table class="hist"><tr><th>Date</th><th>Weight</th><th>Waist</th><th>Hips</th></tr>` +
      rows.map(([d, v]) => `<tr><td>${fmtShort(d)}</td><td>${v.weight ?? '—'}</td><td>${v.waistNavel ?? '—'}</td><td>${v.hips ?? '—'}</td></tr>`).join('') +
      `</table>`
    : `<p class="empty">Nothing logged yet.</p>`;
}

/* ---------- check-in ---------- */
function renderCheckin() {
  const mon = mondayOf(TODAY);
  const { done, planned, bonus } = weekStats(who, TODAY);
  document.getElementById('checkinWeek').textContent = `Week ${weekOf(TODAY)} · from ${fmtShort(mon)}`;
  document.getElementById('checkinSessions').textContent =
    `${done} of ${planned} planned days done so far this week${bonus ? `, plus ${bonus} extra` : ''}.`;

  const c = me().checkins[mon] || {};
  document.getElementById('cBedtime').value = c.bedtime || '';
  document.getElementById('cSleep').value = c.sleep ?? '';
  document.getElementById('cNote').value = c.note || '';

  const beds = Object.entries(me().checkins).filter(([, v]) => v.bedtime)
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([d, v]) => {
      const [h, mi] = v.bedtime.split(':').map(Number);
      return { x: d, y: (h < 12 ? h + 24 : h) * 60 + mi };
    });
  drawChart('bedChart', [{ colour: PROFILES[who].accent, fill: true, points: beds }], v => {
    const h = Math.floor(v / 60) % 24, mi = Math.round(v % 60);
    return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  });

  const hist = Object.entries(me().checkins).sort(([a], [b]) => a < b ? -1 : 1).reverse();
  document.getElementById('checkinHistory').innerHTML = hist.length
    ? hist.map(([d, v]) => `<div class="entry">
        <div class="meta">WEEK ${weekOf(d)} · ${v.sessions ?? '—'} sessions · bed ${v.bedtime || '—'} · ${v.sleep ?? '—'} h</div>
        ${v.note ? `<div class="body">${esc(v.note)}</div>` : ''}
      </div>`).join('')
    : `<p class="empty">No check-ins yet.</p>`;
}

/* ---------- plan ---------- */
function renderPlan() {
  const w = weekOf(TODAY);
  document.getElementById('blockList').innerHTML = BLOCKS.map(b => {
    const on = w >= b.weeks[0] && w <= b.weeks[1];
    return `<div class="blk">
      <div class="name ${on ? 'on' : ''}">${b.n}. ${b.name} — weeks ${b.weeks[0]}–${b.weeks[1]}${on ? ' · now' : ''}</div>
      <div class="where">${b.where}</div>
      <div class="mission">${b.mission}</div>
    </div>`;
  }).join('');

  document.getElementById('milestoneList').innerHTML = Object.entries(MILESTONES).map(([wk, text]) => {
    const n = +wk, past = w > n, now = w === n;
    return `<div class="blk" style="opacity:${past ? .4 : 1}">
      <div class="where" style="color:${now ? 'var(--a1)' : ''}">Week ${wk}${n === FITTING_WEEK ? ' · the real deadline' : ''}</div>
      <div class="mission" style="color:var(--text)">${text}</div>
    </div>`;
  }).join('');
}

/* ---------- chart ---------- */
let gradId = 0;
function drawChart(id, series, fmtY) {
  const host = document.getElementById(id);
  const all = series.flatMap(s => s.points);
  if (all.length < 2) { host.innerHTML = `<p class="empty">Two entries needed before this draws.</p>`; return; }

  const W = 320, H = 160, P = { t: 14, r: 10, b: 22, l: 40 };
  const xs = all.map(p => daysBetween(PROGRAM_START, p.x));
  const ys = all.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.2 || 1;
  y0 -= pad; y1 += pad;

  const px = v => P.l + ((v - x0) / (x1 - x0 || 1)) * (W - P.l - P.r);
  const py = v => P.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - P.t - P.b);
  const label = fmtY || (v => v.toFixed(1));

  let defs = '', body = '';
  for (let i = 0; i <= 2; i++) {
    const v = y0 + (i / 2) * (y1 - y0), y = py(v);
    body += `<line class="grid" x1="${P.l}" y1="${y}" x2="${W - P.r}" y2="${y}"/>`;
    body += `<text x="2" y="${y + 3.5}">${label(v)}</text>`;
  }
  for (const s of series) {
    if (s.points.length < 2) continue;
    const pts = s.points.map(p => [px(daysBetween(PROGRAM_START, p.x)), py(p.y)]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    if (s.fill) {
      const g = `g${++gradId}`;
      defs += `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${s.colour}" stop-opacity=".28"/>
        <stop offset="100%" stop-color="${s.colour}" stop-opacity="0"/></linearGradient>`;
      body += `<path class="ar" d="${line} L${pts[pts.length - 1][0].toFixed(1)},${H - P.b} L${pts[0][0].toFixed(1)},${H - P.b} Z" fill="url(#${g})"/>`;
    }
    body += `<path class="ln" d="${line}" stroke="${s.colour}"/>`;
    body += pts.map(([x, y]) => `<circle class="dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${s.colour}"/>`).join('');
  }
  body += `<text x="${P.l}" y="${H - 5}">${fmtShort(all[0].x)}</text>`;
  body += `<text x="${W - P.r}" y="${H - 5}" text-anchor="end">${fmtShort(all[all.length - 1].x)}</text>`;
  host.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs>${defs}</defs>${body}</svg>`;
}

/* ---------- render ---------- */
function render() {
  applyTheme();
  renderHeader();
  document.querySelectorAll('#who button').forEach(b => b.dataset.active = (b.dataset.who === who));
  document.querySelectorAll('nav button').forEach(b => b.dataset.active = (b.dataset.nav === view));
  document.querySelectorAll('.view').forEach(v => v.dataset.active = (v.dataset.view === view));
  ({ today: renderToday, progress: renderProgress, body: renderBody, checkin: renderCheckin, plan: renderPlan })[view]();
  renderSync();
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.dataset.on = 'true';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.dataset.on = 'false'), 2800);
}

function goTo(v) {
  view = v;
  history.replaceState(null, '', '#' + view);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  render();
}

/* ---------- events: switching ---------- */
document.getElementById('who').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  who = b.dataset.who; localStorage.setItem(KEY + '_who', who);
  openId = null; progEx = null;
  render();
});

document.getElementById('nav').addEventListener('click', e => {
  const b = e.target.closest('button'); if (b) goTo(b.dataset.nav);
});

const showDay = d => { cur = d > TODAY ? TODAY : d; openId = null; renderToday(); };
document.getElementById('prevDay').addEventListener('click', () => showDay(addDays(cur, -1)));
document.getElementById('nextDay').addEventListener('click', () => showDay(addDays(cur, 1)));
document.getElementById('backToday').addEventListener('click', () => showDay(TODAY));
document.getElementById('weekdots').addEventListener('click', e => {
  const b = e.target.closest('button[data-day]'); if (b && !b.disabled) showDay(b.dataset.day);
});
document.getElementById('feed').addEventListener('click', e => {
  const b = e.target.closest('[data-day]'); if (!b) return;
  cur = b.dataset.day; openId = null; goTo('today');
});
document.getElementById('progEx').addEventListener('change', e => { progEx = e.target.value; renderProgress(); });

/* ---------- events: activity picker ---------- */
document.getElementById('actChips').addEventListener('click', e => {
  const b = e.target.closest('.pick'); if (!b) return;
  const type = b.dataset.type;
  const day = acts(who, cur);
  let a = day.find(x => x.type === type && !x.done) || day.find(x => x.type === type);
  if (!a) { a = newAct(type); addAct(a); save(); }
  openId = a.id;
  renderToday();
  const card = document.querySelector(`[data-act="${a.id}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ---------- events: inside an activity card ---------- */
const host = document.getElementById('actList');
const ctx = el => {
  const card = el.closest('[data-act]');
  const a = card && findAct(card.dataset.act);
  const exEl = el.closest('[data-ex]');
  const e = a && exEl && a.exercises[+exEl.dataset.ex];
  const setEl = el.closest('[data-set]');
  return { a, e, j: setEl ? +setEl.dataset.set : -1 };
};

host.addEventListener('click', ev => {
  const el = ev.target.closest('[data-action]'); if (!el) return;
  const { a, e, j } = ctx(el); if (!a) return;
  const act = el.dataset.action;
  if (el.tagName === 'SELECT') return;

  if (act === 'toggle') { openId = openId === a.id ? '' : a.id; renderToday(); return; }

  if (act === 'mode') {
    const mode = el.dataset.mode;
    if (mode === a.mode) return;
    if (mode === 'custom') {
      a.exercises = a.exercises.filter(x => x.sets.some(s => hasValue(x.name, s)));
    } else {
      applyPlan(a, a.sessionId || suggestSession(who, cur));
    }
    a.mode = mode;
  }
  else if (act === 'tickset') {
    const s = e.sets[j];
    s.done = !s.done;
    if (s.done && !hasValue(e.name, s)) Object.assign(s, defaultsFor(a, e, j));
  }
  else if (act === 'addset') {
    const prev = e.sets[e.sets.length - 1];
    e.sets.push(Object.assign(newSet(), prev && hasValue(e.name, prev) ? { w: prev.w, r: prev.r, s: prev.s } : {}));
  }
  else if (act === 'rmset') { if (e.sets.length > 1) e.sets.pop(); }
  else if (act === 'copylast') {
    const last = lastBefore(who, e.name, cur);
    if (!last) return;
    e.sets = last.sets.map(s => ({ w: s.w, r: s.r, s: s.s, done: false }));
  }
  else if (act === 'rmex') {
    if (e.sets.some(s => hasValue(e.name, s)) && !confirm(`Remove ${e.name} and its logged sets?`)) return;
    a.exercises.splice(a.exercises.indexOf(e), 1);
  }
  else if (act === 'drill') {
    a.checks = a.checks || {};
    a.checks[el.dataset.i] = !a.checks[el.dataset.i];
  }
  else if (act === 'intensity') { a.intensity = a.intensity === el.dataset.v ? '' : el.dataset.v; }
  else if (act === 'finish') {
    a.done = !a.done;
    if (a.done) {
      const prs = prCount(a);
      openId = '';
      toast(`Logged — ${actSummary(a)}${prs ? ` · ${prs} new best${prs > 1 ? 's' : ''}` : ''}`);
    }
  }
  else if (act === 'remove') {
    if (!confirm('Remove this activity?')) return;
    removeAct(a.id);
    openId = '';
  }
  a.u = Date.now();
  save(); renderToday();
});

host.addEventListener('change', ev => {
  const el = ev.target;
  const { a } = ctx(el); if (!a) return;
  if (el.dataset.action === 'session') {
    applyPlan(a, el.value);
  } else if (el.dataset.action === 'addex') {
    let name = el.value;
    if (!name) return;
    if (name === '__custom') {
      name = (prompt('Exercise name') || '').trim();
      if (!name) { el.value = ''; return; }
    }
    a.exercises.push({ name, sets: [newSet(), newSet(), newSet()] });
  } else return;
  a.u = Date.now();
  save(); renderToday();
});

host.addEventListener('input', ev => {
  const el = ev.target;
  const { a, e, j } = ctx(el); if (!a) return;
  if (el.dataset.f && e) e.sets[j][el.dataset.f] = el.value;
  else if (el.dataset.af) a[el.dataset.af] = el.value;
  else return;
  a.u = Date.now();
  save();
});

/* ---------- events: body & check-in ---------- */
document.getElementById('saveMetrics').addEventListener('click', () => {
  const entry = me().metrics[TODAY] || (me().metrics[TODAY] = {});
  const w = document.getElementById('mWeight').value;
  if (w !== '') entry.weight = +w; else delete entry.weight;
  document.querySelectorAll('[data-tape]').forEach(i => {
    if (i.value !== '') entry[i.dataset.tape] = +i.value; else delete entry[i.dataset.tape];
  });
  entry.u = Date.now();
  save(); renderBody(); flash('saveMetrics', 'Saved', 'Save');
});

document.getElementById('saveCheckin').addEventListener('click', () => {
  const mon = mondayOf(TODAY);
  const sleep = document.getElementById('cSleep').value;
  me().checkins[mon] = {
    bedtime: document.getElementById('cBedtime').value,
    sleep: sleep === '' ? null : +sleep,
    note: document.getElementById('cNote').value,
    sessions: weekStats(who, TODAY).done,
    u: Date.now(),
  };
  save(); renderCheckin(); flash('saveCheckin', 'Saved', 'Save check-in');
});

function flash(id, on, off) {
  const b = document.getElementById(id);
  b.textContent = on; setTimeout(() => (b.textContent = off), 1400);
}

/* ---------- sync: a secret gist on your GitHub account ---------- */
const SYNC_KEY = KEY + '_sync';
const GIST_FILE = 'wedprep-data.json';
let sync = null;
try { sync = JSON.parse(localStorage.getItem(SYNC_KEY)); } catch (e) { /* not connected */ }
let syncStatus = sync ? 'idle' : 'off';   // off | idle | busy | error
let syncError = '';
let syncing = false, syncAgain = false, pushTimer = null;

async function gh(path, opts = {}) {
  const res = await fetch('https://api.github.com' + path, {
    ...opts,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${sync.token}`,
      Accept: 'application/vnd.github+json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) throw new Error('GitHub rejected the token — it may have expired or been deleted.');
  if (res.status === 404) throw new Error('The sync gist was not found — it may have been deleted.');
  if (!res.ok) throw new Error(`GitHub returned an error (${res.status}). Try again in a minute.`);
  return res.json();
}

async function readRemote() {
  const g = await gh(`/gists/${sync.gistId}`);
  const f = g.files[GIST_FILE];
  if (!f) return null;
  const text = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
  return { text, data: JSON.parse(text) };
}

/* Pull, merge, and push back only if the merged result differs from what is stored */
async function syncNow() {
  if (!sync) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  setSync('busy');
  try {
    const remote = await readRemote();
    const changed = remote ? mergeState(state, remote.data) : false;
    const out = JSON.stringify(state);
    if (!remote || remote.text !== out) {
      await gh(`/gists/${sync.gistId}`, { method: 'PATCH', body: JSON.stringify({ files: { [GIST_FILE]: { content: out } } }) });
    }
    store();
    sync.last = Date.now();
    localStorage.setItem(SYNC_KEY, JSON.stringify(sync));
    syncError = '';
    setSync('idle');
    if (changed) safeRender();
  } catch (e) {
    syncError = e.message || 'No connection.';
    setSync('error');
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; syncNow(); }
  }
}

function schedulePush() {
  if (!sync) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, 1200);
}

/* Don't redraw under someone mid-typing; the next render picks the merge up */
function safeRender() {
  const f = document.activeElement;
  if (f && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName)) return;
  render();
}

async function connect(token) {
  sync = { token: token.trim(), gistId: null };
  syncError = '';
  setSync('busy');
  try {
    const list = await gh('/gists?per_page=100');
    const found = list.find(g => g.files && g.files[GIST_FILE]);
    if (found) sync.gistId = found.id;
    else {
      const g = await gh('/gists', { method: 'POST', body: JSON.stringify({
        description: 'Wedding prep tracker — data', public: false,
        files: { [GIST_FILE]: { content: JSON.stringify(state) } },
      }) });
      sync.gistId = g.id;
    }
    localStorage.setItem(SYNC_KEY, JSON.stringify(sync));
    await syncNow();
    toast(found ? 'Connected — pulled in your data from the other devices.' : 'Connected — this device is now the sync source.');
  } catch (e) {
    sync = null;
    localStorage.removeItem(SYNC_KEY);
    syncError = e.message || 'Could not reach GitHub.';
    setSync('off');
  }
  render();
}

function disconnect() {
  if (!confirm('Stop syncing on this device? Your data stays here, and on the other devices.')) return;
  sync = null;
  localStorage.removeItem(SYNC_KEY);
  setSync('off');
  render();
}

const shareLink = () => `${location.origin}${location.pathname}#sync=${encodeURIComponent(sync.token)}`;

function setSync(s) { syncStatus = s; renderSync(); }

function renderSync() {
  const dot = document.getElementById('syncDot');
  const label = { off: 'Not synced', idle: 'Synced', busy: 'Syncing', error: 'Sync paused' }[syncStatus];
  dot.dataset.s = syncStatus;
  dot.innerHTML = `<i></i>${label}`;

  const body = document.getElementById('syncBody');
  if (!body || view !== 'plan') return;
  const err = syncError ? `<div class="banner alert">${esc(syncError)}</div>` : '';
  if (!sync) {
    if (body.dataset.mode === 'off' && !syncError) return;   // keep a half-typed token
    body.dataset.mode = 'off';
    body.innerHTML = `<p class="sub">Right now your logs live only on this device. Connect once and every phone and laptop shows the same data, updating on its own.</p>
      <ol class="steps">
        <li>On a device signed in to GitHub, <a href="https://github.com/settings/tokens/new?scopes=gist&description=Wedding%20prep%20tracker" target="_blank" rel="noopener">open this page</a>.</li>
        <li>Set <b>Expiration</b> to a custom date after the wedding — say 28 Feb 2027. Leave only <b>gist</b> ticked. Press <b>Generate token</b>.</li>
        <li>Copy the token (it starts with <code>ghp_</code>) and paste it here.</li>
      </ol>
      ${err}
      <label class="f"><span>GitHub token</span><input class="f" id="syncToken" type="password" autocomplete="off" spellcheck="false" placeholder="ghp_…"></label>
      <button class="btn primary full" data-sync="connect">Connect</button>
      <p class="sub small">Do this once, on one device. It then gives you a link that connects the others in one tap.</p>`;
    return;
  }
  body.dataset.mode = 'on';
  const when = sync.last ? new Date(sync.last).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
  body.innerHTML = `<div class="sync-state" data-s="${syncStatus}"><i></i>${syncStatus === 'busy' ? 'Syncing…' : syncStatus === 'error' ? 'Sync paused — will retry' : `Synced · last at ${when}`}</div>
    ${err}
    <p class="sub">Your data is kept in a secret gist on your GitHub account. Changes on any connected device show up on the others within a few seconds of opening the page.</p>
    <h3>Connect another phone or laptop</h3>
    <p class="sub">Copy this link and open it on the other device. It connects that device straight away.</p>
    <div class="row"><button class="btn primary" data-sync="link">Copy link</button><button class="btn" data-sync="now">Sync now</button></div>
    <p class="sub small">Anyone with the link can read and change the tracker. Send it only to yourselves, then delete the message.</p>
    <div class="row"><button class="btn ghost" data-sync="off">Disconnect this device</button></div>`;
}

document.getElementById('syncBody').addEventListener('click', async e => {
  const b = e.target.closest('[data-sync]'); if (!b) return;
  const act = b.dataset.sync;
  if (act === 'connect') {
    const t = document.getElementById('syncToken').value.trim();
    if (!t) { document.getElementById('syncToken').focus(); return; }
    b.textContent = 'Connecting…'; b.disabled = true;
    await connect(t);
  } else if (act === 'now') syncNow();
  else if (act === 'off') disconnect();
  else if (act === 'link') {
    const link = shareLink();
    try { await navigator.clipboard.writeText(link); toast('Link copied. Open it on the other device.'); }
    catch (err) { prompt('Copy this link and open it on the other device:', link); }
  }
});

document.getElementById('alerts').addEventListener('click', e => {
  if (!e.target.closest('[data-goto-sync]')) return;
  goTo('plan');
  setTimeout(() => document.getElementById('syncCard').scrollIntoView({ behavior: 'smooth' }), 60);
});
document.getElementById('syncDot').addEventListener('click', () => {
  goTo('plan');
  setTimeout(() => document.getElementById('syncCard').scrollIntoView({ behavior: 'smooth' }), 60);
});

function startSync() {
  const m = location.hash.match(/^#sync=(.+)$/);
  if (m) {
    history.replaceState(null, '', location.pathname + '#today');
    connect(decodeURIComponent(m[1]));
  } else if (sync) syncNow();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  window.addEventListener('online', () => syncNow());
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
}

/* ---------- events: export / import ---------- */
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `wedprep-${TODAY}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const incoming = JSON.parse(r.result);
      if (!incoming.profiles) throw new Error('not a backup file');
      mergeState(state, incoming);
      save(); render();
      alert('Merged. Where both have the same entry, the more recently edited one is kept.');
    } catch (err) {
      alert("Couldn't read that file — it doesn't look like an export from here.");
    }
  };
  r.readAsText(file);
  e.target.value = '';
});

render();
startSync();
