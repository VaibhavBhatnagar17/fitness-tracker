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
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
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

/* A day only breaks the streak if it was required: not a rest day, not optional. */
const required = def => def.kind !== 'rest' && !def.optional;

function streakFor(profile) {
  let n = 0, cur = TODAY;
  for (let i = 0; i < 250; i++) {
    const { def } = sessionFor(profile, cur);
    if (!required(def)) {
      if (isDone(profile, cur)) n++;
      cur = addDays(cur, -1); continue;
    }
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
    if (required(def)) {
      planned++;
      if (isDone(profile, d)) done++;
    } else if (isDone(profile, d)) {
      bonus++;
    }
  }
  return { done, planned, bonus, mon };
}

/* ---------- header ---------- */
function renderHeader() {
  const left = daysBetween(TODAY, WEDDING_DATE);
  document.getElementById('days').textContent = left > 0 ? left : 0;
  document.getElementById('dayslabel').textContent =
    left > 1 ? 'days to 2 February' : left === 1 ? 'day to go' : left === 0 ? 'today' : 'married';

  const w = Math.min(Math.max(weekOf(TODAY), 1), 19);
  const block = blockForWeek(w);
  document.getElementById('weeklabel').textContent = `Week ${w} of 19`;
  document.getElementById('blocklabel').textContent = `Block ${block.n} — ${block.name} · ${block.where}`;

  document.getElementById('blockbar').innerHTML = BLOCKS.map(b => {
    if (w > b.weeks[1]) return '<div class="done"></div>';
    if (w < b.weeks[0]) return '<div></div>';
    const span = b.weeks[1] - b.weeks[0] + 1;
    const pct = Math.round(((w - b.weeks[0] + 1) / span) * 100);
    return `<div class="now" style="--pct:${pct}%"></div>`;
  }).join('');
}

/* ---------- today ---------- */
function renderToday() {
  const { id, def } = sessionFor(who, TODAY);
  const w = weekOf(TODAY);
  const rec = record(who, TODAY) || {};
  const shown = rec.override ? SESSIONS[rec.override] : def;

  document.getElementById('sessionTitle').textContent = shown.title;
  document.getElementById('sessionDate').textContent =
    `${fmt(TODAY)} · Week ${w} · Block ${blockForWeek(w).n} ${blockForWeek(w).name}`;

  /* alerts */
  const alerts = [];
  if (who === 'mahak' && shown.kind === 'swim') {
    alerts.push(`<div class="safety"><b>Never swim alone.</b> Vaibhav in the water or watching from the poolside — not in the gym, not on his phone. If he can't be there, do a land session instead.</div>`);
  }
  if (who === 'mahak' && shown.kind !== 'rest') {
    alerts.push(`<div class="safety">Eat before you train. Lamitor at its usual time regardless of the schedule.</div>`);
  }
  if (MILESTONES[w]) {
    alerts.push(`<div class="milestone"><b>Week ${w}</b>${MILESTONES[w]}</div>`);
  }
  document.getElementById('alerts').innerHTML = alerts.join('');

  /* exercises */
  const host = document.getElementById('exercises');
  if (!shown.items.length) {
    host.innerHTML = `<p class="empty">Rest day. Walk if you feel like it — nothing structured.</p>`;
  } else {
    host.innerHTML = shown.items.map((it, i) => {
      const on = !!(rec.ticks && rec.ticks[i]);
      const logged = (rec.logs && rec.logs[i]) || '';
      return `<div class="ex">
        <div class="tick" data-i="${i}" data-on="${on}">✓</div>
        <div class="ex-main">
          <div class="ex-name ${on ? 'done' : ''}">${it.name}</div>
          <div class="ex-scheme">${it.scheme}</div>
          ${it.note ? `<div class="ex-note">${it.note}</div>` : ''}
          ${shown.kind === 'strength' ? `<input class="ex-log" data-i="${i}" value="${logged.replace(/"/g, '&quot;')}" placeholder="weight × reps — e.g. 40 × 8, 8, 7">` : ''}
        </div>
      </div>`;
    }).join('');
  }

  const btn = document.getElementById('completeBtn');
  btn.textContent = rec.done ? '✓ Completed — tap to undo' : 'Mark session complete';
  btn.classList.toggle('primary', !rec.done);
  document.getElementById('mvsBtn').style.display = shown.kind === 'rest' ? 'none' : '';

  /* week dots */
  const { done, planned, mon } = weekStats(who, TODAY);
  document.getElementById('weekdots').innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i);
    const s = sessionFor(who, d);
    const L = 'MTWTFSS'[i];
    if (isDone(who, d)) return `<div class="done">${L}</div>`;
    if (!required(s.def)) return `<div${d === TODAY ? ' class="today"' : ''}>${L}</div>`;
    if (d < TODAY) return `<div class="miss">${L}</div>`;
    return `<div class="${d === TODAY ? 'today' : ''}">${L}</div>`;
  }).join('');

  document.getElementById('statStreak').textContent = streakFor(who);
  document.getElementById('statWeek').textContent = `${done}/${planned}`;
  document.getElementById('statTotal').textContent =
    Object.values(me().sessions).filter(s => s.done).length;
}

/* ---------- body ---------- */
function tapeFields() { return TAPE_SITES.filter(t => !t.only || t.only === who); }

function renderBody() {
  const m = me().metrics[TODAY] || {};
  document.getElementById('mWeight').value = m.weight ?? '';
  document.getElementById('tapeInputs').innerHTML = tapeFields().map(t =>
    `<label class="f"><span>${t.label}</span><input class="f" type="number" step="0.1" inputmode="decimal" data-tape="${t.key}" value="${m[t.key] ?? ''}"></label>`
  ).join('');

  const entries = Object.entries(me().metrics).sort(([a], [b]) => a < b ? -1 : 1);
  const weights = entries.filter(([, v]) => v.weight != null).map(([d, v]) => ({ x: d, y: +v.weight }));

  const sub = document.getElementById('weightSub');
  if (weights.length >= 2) {
    const delta = weights[weights.length - 1].y - weights[0].y;
    sub.textContent = `${weights[0].y} kg → ${weights[weights.length - 1].y} kg · ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} kg since ${fmtShort(weights[0].x)}`;
  } else {
    sub.textContent = 'Weigh most mornings. Only the weekly average means anything.';
  }

  drawChart('weightChart', [{ colour: PROFILES[who].colour, points: weights }]);
  drawChart('tapeChart', [
    { colour: '#d4a574', points: entries.filter(([, v]) => v.waistNavel != null).map(([d, v]) => ({ x: d, y: +v.waistNavel })) },
    { colour: '#7fb069', points: entries.filter(([, v]) => v.hips != null).map(([d, v]) => ({ x: d, y: +v.hips })) },
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

  const beds = Object.entries(me().checkins)
    .filter(([, v]) => v.bedtime)
    .sort(([a], [b]) => a < b ? -1 : 1)
    .map(([d, v]) => {
      const [h, mi] = v.bedtime.split(':').map(Number);
      return { x: d, y: (h < 12 ? h + 24 : h) * 60 + mi };
    });
  drawChart('bedChart', [{ colour: '#e8896b', points: beds }], v => {
    const h = Math.floor(v / 60) % 24, mi = Math.round(v % 60);
    return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  });

  const hist = Object.entries(me().checkins).sort(([a], [b]) => a < b ? -1 : 1).reverse();
  document.getElementById('checkinHistory').innerHTML = hist.length
    ? hist.map(([d, v]) => `<div style="padding:11px 0;border-top:1px solid var(--line)">
        <div style="font-size:12px;color:var(--muted)">Week ${weekOf(d)} · ${fmtShort(d)} · ${v.sessions ?? '—'} sessions · bed ${v.bedtime || '—'} · ${v.sleep ?? '—'} h</div>
        ${v.note ? `<div style="margin-top:3px">${v.note}</div>` : ''}
      </div>`).join('')
    : `<p class="empty">No check-ins yet.</p>`;
}

/* ---------- plan ---------- */
function renderPlan() {
  const w = weekOf(TODAY);
  document.getElementById('blockList').innerHTML = BLOCKS.map(b => {
    const active = w >= b.weeks[0] && w <= b.weeks[1];
    return `<div style="padding:13px 0;border-top:1px solid var(--line)">
      <div style="font-weight:650;color:${active ? 'var(--accent)' : 'inherit'}">
        ${b.n}. ${b.name} — weeks ${b.weeks[0]}–${b.weeks[1]}${active ? ' · now' : ''}</div>
      <div style="font-size:12.5px;color:var(--muted);margin:1px 0 3px">${b.where}</div>
      <div style="font-size:14px">${b.mission}</div>
    </div>`;
  }).join('');

  document.getElementById('milestoneList').innerHTML = Object.entries(MILESTONES).map(([wk, text]) => {
    const n = +wk, past = w > n, now = w === n;
    return `<div style="padding:11px 0;border-top:1px solid var(--line);opacity:${past ? .45 : 1}">
      <div style="font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:${now ? 'var(--accent)' : 'var(--muted)'}">
        Week ${wk}${n === FITTING_WEEK ? ' · the real deadline' : ''}</div>
      <div style="font-size:14px;margin-top:2px">${text}</div>
    </div>`;
  }).join('');
}

/* ---------- chart ---------- */
function drawChart(id, series, fmtY) {
  const host = document.getElementById(id);
  const all = series.flatMap(s => s.points);
  if (all.length < 2) { host.innerHTML = `<p class="empty">Two entries needed before this draws.</p>`; return; }

  const W = 300, H = 150, P = { t: 12, r: 8, b: 20, l: 34 };
  const xs = all.map(p => daysBetween(PROGRAM_START, p.x));
  const ys = all.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.18 || 1;
  y0 -= pad; y1 += pad;

  const px = v => P.l + ((v - x0) / (x1 - x0 || 1)) * (W - P.l - P.r);
  const py = v => P.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - P.t - P.b);
  const label = fmtY || (v => v.toFixed(1));

  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  for (let i = 0; i <= 2; i++) {
    const v = y0 + (i / 2) * (y1 - y0), y = py(v);
    svg += `<line class="grid" x1="${P.l}" y1="${y}" x2="${W - P.r}" y2="${y}"/>`;
    svg += `<text x="2" y="${y + 3}">${label(v)}</text>`;
  }
  for (const s of series) {
    if (s.points.length < 2) continue;
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${px(daysBetween(PROGRAM_START, p.x)).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
    svg += `<path class="ln" d="${d}" stroke="${s.colour}"/>`;
    svg += s.points.map(p => `<circle class="dot" cx="${px(daysBetween(PROGRAM_START, p.x)).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="3" fill="${s.colour}"/>`).join('');
  }
  svg += `<text x="${P.l}" y="${H - 5}">${fmtShort(all[0].x)}</text>`;
  svg += `<text x="${W - P.r}" y="${H - 5}" text-anchor="end">${fmtShort(all[all.length - 1].x)}</text>`;
  host.innerHTML = svg + '</svg>';
}

/* ---------- render ---------- */
function render() {
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
  window.scrollTo(0, 0);
  render();
});

document.getElementById('exercises').addEventListener('click', e => {
  const t = e.target.closest('.tick'); if (!t) return;
  const rec = me().sessions[TODAY] || (me().sessions[TODAY] = { ticks: {}, logs: {} });
  rec.ticks = rec.ticks || {};
  const i = t.dataset.i;
  rec.ticks[i] = !rec.ticks[i];

  const def = rec.override ? SESSIONS[rec.override] : sessionFor(who, TODAY).def;
  if (def.items.every((_, j) => rec.ticks[j])) rec.done = true;
  save(); renderToday();
});

document.getElementById('exercises').addEventListener('input', e => {
  if (!e.target.classList.contains('ex-log')) return;
  const rec = me().sessions[TODAY] || (me().sessions[TODAY] = { ticks: {}, logs: {} });
  rec.logs = rec.logs || {};
  rec.logs[e.target.dataset.i] = e.target.value;
  save();
});

document.getElementById('completeBtn').addEventListener('click', () => {
  const rec = me().sessions[TODAY] || (me().sessions[TODAY] = { ticks: {}, logs: {} });
  rec.done = !rec.done;
  save(); renderToday();
});

document.getElementById('mvsBtn').addEventListener('click', () => {
  const rec = me().sessions[TODAY] || (me().sessions[TODAY] = { ticks: {}, logs: {} });
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
  save(); renderBody();
  const b = document.getElementById('saveMetrics');
  b.textContent = 'Saved ✓'; setTimeout(() => (b.textContent = 'Save'), 1400);
});

document.getElementById('saveCheckin').addEventListener('click', () => {
  const mon = mondayOf(TODAY);
  const { done } = weekStats(who, TODAY);
  me().checkins[mon] = {
    bedtime: document.getElementById('cBedtime').value,
    sleep: document.getElementById('cSleep').value === '' ? null : +document.getElementById('cSleep').value,
    note: document.getElementById('cNote').value,
    sessions: done,
  };
  save(); renderCheckin();
  const b = document.getElementById('saveCheckin');
  b.textContent = 'Saved ✓'; setTimeout(() => (b.textContent = 'Save check-in'), 1400);
});

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
        const src = incoming.profiles[p] || blank();
        const dst = state.profiles[p];
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
