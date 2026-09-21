/* ---------- date helpers (local, no timezone drift) ---------- */
const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return toISO(d); };
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
const TODAY = toISO(new Date());

const weekOf = s => Math.floor(daysBetween(PROGRAM_START, s) / 7) + 1;
const dowOf = s => toDate(s).getDay();
const mondayOf = s => addDays(s, dowOf(s) === 0 ? -6 : 1 - dowOf(s));
const fmt = s => toDate(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = s => toDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/* ---------- state ---------- */
const KEY = 'wedprep_v1';
const blank = () => ({ sessions: {}, metrics: {}, checkins: {} });
let state = load();
let who = localStorage.getItem(KEY + '_who') || 'mahak';
const VIEWS = ['today', 'body', 'checkin', 'plan'];
let view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'today';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.profiles) {
      for (const p of Object.keys(PROFILES)) raw.profiles[p] = Object.assign(blank(), raw.profiles[p]);
      return raw;
    }
  } catch (e) { /* fall through to a fresh store */ }
  return { profiles: { mahak: blank(), vaibhav: blank() } };
}
/* Wrapped: browsers block localStorage when a page is opened directly as a file:// URL */
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Could not save — serve this over http rather than opening the file directly.'); }
};
const me = () => state.profiles[who];

/* ---------- program lookups ---------- */
function sessionFor(profile, date) {
  const w = weekOf(date);
  if (w < 1 || w > 19) return { id: 'REST', def: SESSIONS.REST };
  const id = sessionIdFor(profile, w, dowOf(date));
  return { id, def: SESSIONS[id] };
}
const record = (profile, date) => state.profiles[profile].sessions[date];
const isDone = (profile, date) => !!(record(profile, date) && record(profile, date).done);
const shownDef = (profile, date) => {
  const rec = record(profile, date);
  return rec && rec.override ? SESSIONS[rec.override] : sessionFor(profile, date).def;
};

/* A day only breaks the streak if it was required: not rest, not optional. */
const required = def => def.kind !== 'rest' && !def.optional;

function streakFor(profile) {
  let n = 0, cur = TODAY;
  for (let i = 0; i < 250; i++) {
    const { def } = sessionFor(profile, cur);
    if (!required(def)) { if (isDone(profile, cur)) n++; cur = addDays(cur, -1); continue; }
    if (isDone(profile, cur)) { n++; cur = addDays(cur, -1); continue; }
    if (cur === TODAY) { cur = addDays(cur, -1); continue; }
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
    if (required(def)) { planned++; if (isDone(profile, d)) done++; }
    else if (isDone(profile, d)) bonus++;
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

  const w = Math.min(Math.max(weekOf(TODAY), 1), 19);
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

function renderToday() {
  const w = weekOf(TODAY);
  const rec = record(who, TODAY) || {};
  const def = shownDef(who, TODAY);

  document.getElementById('sessionTitle').textContent = def.title;
  const focus = document.getElementById('sessionFocus');
  focus.textContent = def.focus || '';
  focus.hidden = !def.focus;
  document.getElementById('sessionDate').textContent =
    `${fmt(TODAY)} · Block ${blockForWeek(w).n} ${blockForWeek(w).name}`;

  /* banners */
  const alerts = [];
  if (who === 'mahak' && def.kind === 'swim') {
    alerts.push(`<div class="banner alert"><b>Never swim alone.</b> Vaibhav in the water or watching from the poolside — not in the gym, not on his phone. If he can't be there, do a land session instead.</div>`);
  }
  if (who === 'mahak' && def.kind !== 'rest') {
    alerts.push(`<div class="banner alert">Eat before you train — never fasted. Medication at its usual time, regardless of what the schedule says.</div>`);
  }
  if (MILESTONES[w]) {
    alerts.push(`<div class="banner note"><span class="tag">Week ${w}</span>${MILESTONES[w]}</div>`);
  }
  document.getElementById('alerts').innerHTML = alerts.join('');

  /* warm-up & cool-down */
  const wu = WARMUP[def.kind];
  document.getElementById('warmup').innerHTML = wu
    ? `<details class="fold"><summary>Warm-up · 8 min</summary><ul>${wu.map(l => `<li>${l}</li>`).join('')}</ul></details>` : '';
  document.getElementById('cooldown').innerHTML = def.kind === 'rest' ? ''
    : `<details class="fold"><summary>Cool-down · 5 min</summary><ul>${COOLDOWN.map(l => `<li>${l}</li>`).join('')}</ul></details>`;

  /* exercises */
  const host = document.getElementById('exercises');
  if (!def.items.length) {
    host.innerHTML = `<p class="empty">Rest day. Walk if you feel like it — nothing structured.</p>`;
  } else {
    host.innerHTML = def.items.map((it, i) => {
      const on = !!(rec.ticks && rec.ticks[i]);
      const logged = (rec.logs && rec.logs[i]) || '';
      return `<div class="ex">
        <button class="tick" data-i="${i}" data-on="${on}" aria-label="Done">${CHECK}</button>
        <div class="ex-main">
          <div class="ex-head">
            <span class="ex-name ${on ? 'done' : ''}">${esc(it.name)}</span>
            ${it.flag === 'new' ? '<span class="badge">NEW</span>' : ''}
          </div>
          <div class="ex-scheme">${esc(it.scheme)}</div>
          ${it.note ? `<div class="ex-note">${esc(it.note)}</div>` : ''}
          ${def.kind === 'strength' ? `<input class="ex-log" data-i="${i}" value="${esc(logged)}" placeholder="weight × reps">` : ''}
        </div>
      </div>`;
    }).join('');
  }

  const btn = document.getElementById('completeBtn');
  btn.textContent = rec.done ? 'Completed — tap to undo' : 'Mark session complete';
  btn.classList.toggle('primary', !rec.done);
  btn.classList.toggle('done-state', !!rec.done);
  document.getElementById('mvsBtn').textContent =
    rec.override ? 'Back to the full session' : 'Bad day? Swap in the 20-minute version';
  document.getElementById('mvsBtn').style.display = sessionFor(who, TODAY).def.kind === 'rest' ? 'none' : '';

  /* week dots */
  const { done, planned, mon } = weekStats(who, TODAY);
  document.getElementById('weekdots').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i);
    const L = 'MTWTFSS'[i];
    if (isDone(who, d)) return `<div class="done">${L}</div>`;
    if (!required(sessionFor(who, d).def)) return `<div class="${d === TODAY ? 'today' : ''}">${L}</div>`;
    if (d < TODAY) return `<div class="miss">${L}</div>`;
    return `<div class="${d === TODAY ? 'today' : ''}">${L}</div>`;
  }).join('');

  document.getElementById('statStreak').textContent = streakFor(who);
  document.getElementById('statWeek').textContent = `${done}/${planned}`;
  document.getElementById('statTotal').textContent = Object.values(me().sessions).filter(s => s.done).length;
}

/* ---------- body ---------- */
const tapeFields = () => TAPE_SITES.filter(t => !t.only || t.only === who);

function renderBody() {
  const m = me().metrics[TODAY] || {};
  document.getElementById('mWeight').value = m.weight ?? '';
  document.getElementById('tapeInputs').innerHTML = tapeFields().map(t =>
    `<label class="f"><span>${t.label}</span><input class="f" type="number" step="0.1" inputmode="decimal" data-tape="${t.key}" value="${m[t.key] ?? ''}" placeholder="—"></label>`
  ).join('');

  const entries = Object.entries(me().metrics).sort(([a], [b]) => a < b ? -1 : 1);
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
  const { done, planned } = weekStats(who, TODAY);
  document.getElementById('checkinWeek').textContent = `Week ${weekOf(TODAY)} · from ${fmtShort(mon)}`;
  document.getElementById('checkinSessions').textContent = `${done} of ${planned} completed so far this week.`;

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
  ({ today: renderToday, body: renderBody, checkin: renderCheckin, plan: renderPlan })[view]();
}

/* ---------- events ---------- */
document.getElementById('who').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  who = b.dataset.who; localStorage.setItem(KEY + '_who', who); render();
});

document.getElementById('nav').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  view = b.dataset.nav;
  history.replaceState(null, '', '#' + view);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  render();
});

const rec4today = () => me().sessions[TODAY] || (me().sessions[TODAY] = { ticks: {}, logs: {} });

document.getElementById('exercises').addEventListener('click', e => {
  const t = e.target.closest('.tick'); if (!t) return;
  const rec = rec4today();
  rec.ticks = rec.ticks || {};
  rec.ticks[t.dataset.i] = !rec.ticks[t.dataset.i];
  if (shownDef(who, TODAY).items.every((_, j) => rec.ticks[j])) rec.done = true;
  save(); renderToday();
});

document.getElementById('exercises').addEventListener('input', e => {
  if (!e.target.classList.contains('ex-log')) return;
  const rec = rec4today();
  rec.logs = rec.logs || {};
  rec.logs[e.target.dataset.i] = e.target.value;
  save();
});

document.getElementById('completeBtn').addEventListener('click', () => {
  const rec = rec4today(); rec.done = !rec.done; save(); renderToday();
});

document.getElementById('mvsBtn').addEventListener('click', () => {
  const rec = rec4today();
  rec.override = rec.override ? null : 'MVS';
  rec.ticks = {};
  save(); renderToday();
});

document.getElementById('saveMetrics').addEventListener('click', () => {
  const entry = me().metrics[TODAY] || (me().metrics[TODAY] = {});
  const w = document.getElementById('mWeight').value;
  if (w !== '') entry.weight = +w; else delete entry.weight;
  document.querySelectorAll('[data-tape]').forEach(i => {
    if (i.value !== '') entry[i.dataset.tape] = +i.value; else delete entry[i.dataset.tape];
  });
  if (!Object.keys(entry).length) delete me().metrics[TODAY];
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
  };
  save(); renderCheckin(); flash('saveCheckin', 'Saved', 'Save check-in');
});

function flash(id, on, off) {
  const b = document.getElementById(id);
  b.textContent = on; setTimeout(() => (b.textContent = off), 1400);
}

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
      for (const p of Object.keys(PROFILES)) {
        const src = incoming.profiles[p] || blank(), dst = state.profiles[p];
        Object.assign(dst.sessions, src.sessions);
        Object.assign(dst.metrics, src.metrics);
        Object.assign(dst.checkins, src.checkins);
      }
      save(); render();
      alert('Merged. Nothing was overwritten except entries with the same date.');
    } catch (err) {
      alert("Couldn't read that file — it doesn't look like an export from here.");
    }
  };
  r.readAsText(file);
  e.target.value = '';
});

render();
