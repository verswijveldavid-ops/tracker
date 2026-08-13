// ============================================================
// Tracker — daily productivity + habits PWA
// ============================================================

import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, setDoc, onSnapshot, collection, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

// ---------- Setup check (run before anything else) ----------
if (firebaseConfig.apiKey === 'REPLACE_ME') {
  document.getElementById('loading-overlay').innerHTML = `
    <div style="max-width:340px;padding:24px;text-align:center;">
      <div style="font-size:48px;color:#8b7cff;margin-bottom:12px;">◆</div>
      <h1 style="margin:0 0 8px;color:#eae7f5;">Setup needed</h1>
      <p style="color:#8b84a8;">Open <code style="color:#8b7cff;">firebase-config.js</code> and follow the instructions at the top of that file to connect your Firebase project.</p>
    </div>
  `;
  throw new Error('Firebase not configured — see firebase-config.js');
}

// ---------- Firebase ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const googleProvider = new GoogleAuthProvider();

// ---------- State ----------
const state = {
  user: null,
  habits: [],
  days: {},
  currentTab: 'today',
  calendarMonth: monthAnchor(new Date()),
  selectedDate: dateStr(addDays(new Date(), -1)), // default yesterday
  editingHabits: false,
  editingSelected: false,
  unsubHabits: null,
  unsubDays: null,
  chartWeek: null,
  chartMonth: null,
  diaryTimer: null,
  selectedDiaryTimer: null
};

const DEFAULT_HABITS = [
  { id: uid(), name: 'Sweat',      emoji: '💦', order: 0, archived: false },
  { id: uid(), name: 'Meditation', emoji: '🧘', order: 1, archived: false },
  { id: uid(), name: 'Stretch',    emoji: '🤸', order: 2, archived: false }
];

// ---------- Utilities ----------
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return dateStr(new Date()); }
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function monthAnchor(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

function formatHM(slots) {
  const h = Math.floor(slots / 4);
  const m = (slots % 4) * 15;
  return `${h}h ${pad(m)}m`;
}
function formatHMshort(slots) {
  const h = Math.floor(slots / 4);
  const m = (slots % 4) * 15;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}
function formatDec(hours) {
  if (hours === 0) return '0h';
  const slots = Math.round(hours * 4);
  return formatHMshort(slots);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatFullDate(d) { return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }

function selectedLabel(dateS) {
  if (dateS === todayStr()) return 'Today';
  if (dateS === dateStr(addDays(new Date(), -1))) return 'Yesterday';
  const d = parseDate(dateS);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function heatLevel(slots) {
  if (!slots) return 0;
  if (slots <= 8) return 1;
  if (slots <= 20) return 2;
  if (slots <= 32) return 3;
  return 4;
}

function activeHabits() {
  return state.habits.filter(h => !h.archived).sort((a, b) => a.order - b.order);
}
function habitById(id) { return state.habits.find(h => h.id === id); }
function dayData(dateS) { return state.days[dateS] || { hours: 0, diary: '', habits: {} }; }
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ---------- Auth ----------
$('#signin-btn').addEventListener('click', async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, googleProvider);
    } else {
      alert('Sign-in failed: ' + err.message);
    }
  }
});
$('#signout-btn').addEventListener('click', () => signOut(auth));
getRedirectResult(auth).catch(() => {});

onAuthStateChanged(auth, async (user) => {
  state.user = user;
  if (user) {
    $('#signin-overlay').classList.add('hidden');
    $('#loading-overlay').classList.remove('hidden');
    await subscribeToUserData();
    renderAccount();
    $('#loading-overlay').classList.add('hidden');
    $('#app').classList.remove('hidden');
    renderAll();
  } else {
    if (state.unsubHabits) state.unsubHabits();
    if (state.unsubDays) state.unsubDays();
    state.habits = []; state.days = {};
    $('#loading-overlay').classList.add('hidden');
    $('#app').classList.add('hidden');
    $('#signin-overlay').classList.remove('hidden');
  }
});

async function subscribeToUserData() {
  const uidS = state.user.uid;
  const habitsRef = doc(db, 'users', uidS, 'meta', 'habits');
  const daysRef = collection(db, 'users', uidS, 'days');
  return new Promise((resolve) => {
    let initial = 0;
    const settle = () => { initial++; if (initial === 2) resolve(); };
    state.unsubHabits = onSnapshot(habitsRef, async (snap) => {
      if (snap.exists()) {
        state.habits = snap.data().list || [];
      } else {
        state.habits = DEFAULT_HABITS;
        await setDoc(habitsRef, { list: DEFAULT_HABITS });
      }
      renderAll();
      settle();
    });
    state.unsubDays = onSnapshot(daysRef, (snap) => {
      state.days = {};
      snap.forEach(d => { state.days[d.id] = d.data(); });
      renderAll();
      settle();
    });
  });
}

function renderAccount() {
  const u = state.user;
  const initial = (u.displayName || u.email || '?').charAt(0).toUpperCase();
  $('#account-info').innerHTML = `
    <div class="account-avatar" style="display:flex;align-items:center;justify-content:center;font-weight:600;">${initial}</div>
    <div>
      <div class="account-name">${escapeHtml(u.displayName || 'You')}</div>
      <div class="account-email">${escapeHtml(u.email || '')}</div>
    </div>
  `;
}

// ---------- Data writes ----------
async function saveDay(dateS, patch) {
  if (!state.user) return;
  const merged = { ...dayData(dateS), ...patch };
  state.days[dateS] = merged;
  await setDoc(doc(db, 'users', state.user.uid, 'days', dateS), merged, { merge: true });
}
async function saveHabits() {
  if (!state.user) return;
  await setDoc(doc(db, 'users', state.user.uid, 'meta', 'habits'), { list: state.habits });
}

// ---------- Tab routing ----------
$$('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
function switchTab(name) {
  state.currentTab = name;
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== name));
  renderAll();
}

// ---------- Settings modal ----------
$('#settings-open').addEventListener('click', () => $('#settings-modal').classList.remove('hidden'));
$$('#settings-modal [data-close]').forEach(el => el.addEventListener('click', () => $('#settings-modal').classList.add('hidden')));

// ---------- TODAY VIEW ----------
$('#hours-slider').addEventListener('input', (e) => {
  $('#hours-value').textContent = formatHM(parseInt(e.target.value, 10));
});
$('#hours-slider').addEventListener('change', (e) => {
  saveDay(todayStr(), { hours: parseInt(e.target.value, 10) });
  flashSave();
});
$('#diary').addEventListener('input', (e) => {
  clearTimeout(state.diaryTimer);
  const val = e.target.value;
  state.diaryTimer = setTimeout(() => { saveDay(todayStr(), { diary: val }); flashSave(); }, 600);
});
$('#edit-tasks-btn').addEventListener('click', () => {
  state.editingHabits = !state.editingHabits;
  renderTodayTasks();
});
$('#add-task-btn').addEventListener('click', () => {
  const emojis = ['✨','🔥','⭐','💪','📚','🎯','🌱','☀️','🧠','💧'];
  const maxOrder = state.habits.reduce((m, h) => Math.max(m, h.order || 0), -1);
  state.habits.push({
    id: uid(), name: 'New task',
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    order: maxOrder + 1, archived: false
  });
  saveHabits();
});

function flashSave() {
  const el = $('#save-indicator');
  el.classList.add('visible');
  clearTimeout(flashSave.t);
  flashSave.t = setTimeout(() => el.classList.remove('visible'), 900);
}

function renderToday() {
  const today = todayStr();
  const d = parseDate(today);
  $('#today-weekday').textContent = WEEKDAYS[d.getDay()];
  $('#today-date').textContent = formatFullDate(d);

  const data = dayData(today);
  $('#hours-slider').value = data.hours || 0;
  $('#hours-value').textContent = formatHM(data.hours || 0);
  if (document.activeElement !== $('#diary')) $('#diary').value = data.diary || '';

  renderTodayTasks();
}

function renderTodayTasks() {
  const editing = state.editingHabits;
  $('#edit-tasks-btn').textContent = editing ? 'Done' : 'Edit';
  $('#add-task-btn').classList.toggle('hidden', !editing);

  const habits = activeHabits();
  const list = $('#habits-list');
  if (habits.length === 0 && !editing) {
    list.innerHTML = `<div style="color:var(--text-mute);text-align:center;padding:16px;">No tasks. Tap Edit to add some.</div>`;
    return;
  }

  const data = dayData(todayStr());
  if (editing) {
    list.innerHTML = habits.map((h, i) => `
      <div class="habit-row-edit" data-id="${h.id}">
        <input class="emoji" value="${escapeHtml(h.emoji || '')}" maxlength="4" />
        <input class="name" value="${escapeHtml(h.name)}" />
        <div class="btns">
          <button class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-act="down" ${i === habits.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn danger" data-act="del">✕</button>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.habit-row-edit').forEach(row => {
      const id = row.dataset.id;
      const h = habitById(id);
      row.querySelector('.emoji').addEventListener('change', e => { h.emoji = e.target.value.trim() || '•'; saveHabits(); });
      row.querySelector('.name').addEventListener('change', e => { h.name = e.target.value.trim() || 'Task'; saveHabits(); });
      row.querySelectorAll('.icon-btn').forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'del') {
          if (!confirm(`Delete "${h.name}"? Past records stay.`)) return;
          h.archived = true;
        } else {
          const list2 = activeHabits();
          const idx = list2.findIndex(x => x.id === id);
          const swap = act === 'up' ? idx - 1 : idx + 1;
          if (swap < 0 || swap >= list2.length) return;
          const a = list2[idx], b2 = list2[swap];
          const ao = a.order, bo = b2.order;
          a.order = bo; b2.order = ao;
        }
        saveHabits();
      }));
    });
  } else {
    list.innerHTML = habits.map(h => {
      const done = !!(data.habits && data.habits[h.id]);
      return `
        <button class="habit-btn ${done ? 'done' : ''}" data-id="${h.id}">
          <span class="habit-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg></span>
          <span class="habit-emoji">${escapeHtml(h.emoji || '•')}</span>
          <span class="habit-name">${escapeHtml(h.name)}</span>
        </button>
      `;
    }).join('');
    list.querySelectorAll('.habit-btn').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const cur = dayData(todayStr());
      const habits2 = { ...(cur.habits || {}) };
      if (habits2[id]) delete habits2[id]; else habits2[id] = true;
      saveDay(todayStr(), { habits: habits2 });
      btn.classList.toggle('done');
    }));
  }
}

// ---------- CALENDAR + STATS VIEW ----------
$$('.date-nav').forEach(btn => btn.addEventListener('click', () => {
  const nav = btn.dataset.nav;
  if (nav === 'prev-month') state.calendarMonth = addMonths(state.calendarMonth, -1);
  else if (nav === 'next-month') state.calendarMonth = addMonths(state.calendarMonth, 1);
  renderCalendar();
}));

$('#selected-edit-btn').addEventListener('click', () => {
  state.editingSelected = !state.editingSelected;
  renderSelectedDay();
});

function renderCalendar() {
  const anchor = state.calendarMonth;
  $('#calendar-month').textContent = `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;

  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const gridStart = addDays(first, -startOffset);

  const today = todayStr();
  let html = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const ds = dateStr(d);
    const outside = d.getMonth() !== anchor.getMonth();
    const isToday = ds === today;
    const isSelected = ds === state.selectedDate;
    const data = dayData(ds);
    const lv = heatLevel(data.hours || 0);
    const doneN = Math.min((data.habits ? Object.keys(data.habits).length : 0), 3);
    const dots = Array.from({ length: doneN }).map(() => '<span class="cal-dot"></span>').join('');
    html += `
      <button class="cal-cell ${outside ? 'outside' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}"
              data-date="${ds}" data-level="${lv}">
        <span class="cal-num">${d.getDate()}</span>
        <span class="cal-dots">${dots}</span>
      </button>
    `;
  }
  const grid = $('#calendar-grid');
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-cell').forEach(cell => cell.addEventListener('click', () => {
    const ds = cell.dataset.date;
    if (ds > todayStr()) return;
    state.selectedDate = ds;
    state.editingSelected = false;
    renderCalendar();
    renderSelectedDay();
  }));
}

function renderSelectedDay() {
  const ds = state.selectedDate;
  $('#selected-day-title').textContent = selectedLabel(ds);
  $('#selected-edit-btn').textContent = state.editingSelected ? 'Done' : 'Edit';

  const data = dayData(ds);
  const habits = activeHabits();
  const body = $('#selected-day-body');

  if (state.editingSelected) {
    body.innerHTML = `
      <div class="hours-display" style="margin-bottom:16px;">
        <span id="sel-hours-value">${formatHM(data.hours || 0)}</span>
        <span class="hours-label">productive</span>
      </div>
      <input type="range" id="sel-hours-slider" min="0" max="48" step="1" value="${data.hours || 0}" />
      <div class="hours-scale" style="margin-bottom:16px;">
        <span>0</span><span>3h</span><span>6h</span><span>9h</span><span>12h</span>
      </div>
      <div class="habits-list" id="sel-habits-list" style="margin-bottom:12px;"></div>
      <textarea id="sel-diary" placeholder="Notes for this day..." style="width:100%;min-height:100px;background:var(--bg-elev-2);color:var(--text);border:none;border-radius:10px;padding:12px;font:inherit;font-size:15px;resize:vertical;outline:none;">${escapeHtml(data.diary || '')}</textarea>
    `;
    $('#sel-hours-slider').addEventListener('input', e => {
      $('#sel-hours-value').textContent = formatHM(parseInt(e.target.value, 10));
    });
    $('#sel-hours-slider').addEventListener('change', e => {
      saveDay(ds, { hours: parseInt(e.target.value, 10) });
    });
    $('#sel-diary').addEventListener('input', e => {
      clearTimeout(state.selectedDiaryTimer);
      const val = e.target.value;
      state.selectedDiaryTimer = setTimeout(() => saveDay(ds, { diary: val }), 600);
    });
    const list = $('#sel-habits-list');
    list.innerHTML = habits.map(h => {
      const done = !!(data.habits && data.habits[h.id]);
      return `
        <button class="habit-btn ${done ? 'done' : ''}" data-id="${h.id}">
          <span class="habit-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg></span>
          <span class="habit-emoji">${escapeHtml(h.emoji || '•')}</span>
          <span class="habit-name">${escapeHtml(h.name)}</span>
        </button>
      `;
    }).join('');
    list.querySelectorAll('.habit-btn').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const cur = dayData(ds);
      const h2 = { ...(cur.habits || {}) };
      if (h2[id]) delete h2[id]; else h2[id] = true;
      saveDay(ds, { habits: h2 });
      btn.classList.toggle('done');
    }));
  } else {
    // read-only display
    const hours = data.hours || 0;
    const doneHabits = habits.filter(h => data.habits && data.habits[h.id]);
    const missed = habits.filter(h => !(data.habits && data.habits[h.id]));

    if (hours === 0 && doneHabits.length === 0 && !data.diary) {
      body.innerHTML = `<div class="sel-day-empty">Nothing logged for this day.</div>`;
      return;
    }

    let taskHtml = '';
    if (habits.length > 0) {
      taskHtml = `<div class="sel-day-tasks">
        ${doneHabits.map(h => `<span class="sel-day-task done">${escapeHtml(h.emoji || '•')} ${escapeHtml(h.name)}</span>`).join('')}
        ${missed.map(h => `<span class="sel-day-task">${escapeHtml(h.emoji || '•')} ${escapeHtml(h.name)}</span>`).join('')}
      </div>`;
    }

    body.innerHTML = `
      <div class="sel-day-hours">${formatHM(hours).split(' ')[0]}<span class="unit">${formatHM(hours).split(' ')[1] || ''}</span></div>
      ${taskHtml}
      ${data.diary ? `<div class="sel-day-diary">${escapeHtml(data.diary)}</div>` : ''}
    `;
  }
}

// ---------- Stats ----------
function rangeDates(n) {
  const end = parseDate(todayStr());
  const list = [];
  for (let i = n - 1; i >= 0; i--) list.push(addDays(end, -i));
  return list;
}

function computeSummary(dates) {
  const hoursArr = dates.map(d => (dayData(dateStr(d)).hours || 0) / 4);
  const total = hoursArr.reduce((a, b) => a + b, 0);
  const avg = total / dates.length;
  const best = Math.max(0, ...hoursArr);

  // streak: consecutive most-recent days with hours > 0
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (hoursArr[i] > 0) streak++;
    else break;
  }
  return { hoursArr, total, avg, best, streak };
}

function computeHabitStats(dates) {
  return activeHabits().map(h => {
    const done = dates.filter(d => (dayData(dateStr(d)).habits || {})[h.id]).length;
    const pct = dates.length ? Math.round((done / dates.length) * 100) : 0;
    return { h, done, total: dates.length, pct };
  });
}

function renderHabitStatsInto(el, stats) {
  if (stats.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = stats.map(s => `
    <div class="habit-stat-row">
      <div class="habit-stat-name">
        <span>${escapeHtml(s.h.emoji || '•')}</span>
        <span>${escapeHtml(s.h.name)}</span>
      </div>
      <div class="habit-stat-bar"><div class="habit-stat-fill" style="width:${s.pct}%;"></div></div>
      <div class="habit-stat-pct">${s.done}/${s.total}</div>
    </div>
  `).join('');
}

async function renderStats() {
  const weekDates = rangeDates(7);
  const wk = computeSummary(weekDates);
  $('#w-total').textContent = formatDec(wk.total);
  $('#w-avg').textContent   = formatDec(wk.avg);
  $('#w-best').textContent  = formatDec(wk.best);
  $('#w-streak').textContent = wk.streak;
  renderHabitStatsInto($('#week-habits'), computeHabitStats(weekDates));

  const monthDates = rangeDates(30);
  const mo = computeSummary(monthDates);
  $('#m-total').textContent = formatDec(mo.total);
  $('#m-avg').textContent   = formatDec(mo.avg);
  $('#m-best').textContent  = formatDec(mo.best);
  $('#m-streak').textContent = mo.streak;
  renderHabitStatsInto($('#month-habits'), computeHabitStats(monthDates));

  // heatmap
  const heat = $('#month-heatmap');
  heat.innerHTML = monthDates.map(d => {
    const slots = dayData(dateStr(d)).hours || 0;
    return `<div class="heat-cell" data-level="${heatLevel(slots)}" title="${dateStr(d)}: ${formatHM(slots)}"></div>`;
  }).join('');

  const Chart = await ensureChart();
  drawChart(Chart, 'week-chart', 'chartWeek', weekDates, wk.hoursArr, 'week');
  drawChart(Chart, 'month-chart', 'chartMonth', monthDates, mo.hoursArr, 'month');
}

function drawChart(Chart, canvasId, storeKey, dates, hoursArr, range) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const labels = dates.map(d => range === 'week' ? WEEKDAYS_SHORT[d.getDay()] : String(d.getDate()));
  const cs = getComputedStyle(document.documentElement);
  const accent = cs.getPropertyValue('--accent').trim();
  const dim = cs.getPropertyValue('--text-mute').trim();
  const border = cs.getPropertyValue('--border').trim();

  if (state[storeKey]) state[storeKey].destroy();
  state[storeKey] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{
      data: hoursArr, backgroundColor: accent, borderRadius: 4,
      maxBarThickness: range === 'week' ? 32 : 12
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: (c) => formatDec(c.parsed.y) }
      }},
      scales: {
        x: { ticks: { color: dim, font: { size: 10 }, autoSkip: true, maxRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: dim, font: { size: 10 }, callback: v => `${v}h` }, grid: { color: border } }
      }
    }
  });
}

let chartLoader;
function ensureChart() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (!chartLoader) {
    chartLoader = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = () => res(window.Chart);
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  return chartLoader;
}

// ---------- Export / Import ----------
$('#export-btn').addEventListener('click', () => {
  const payload = { exportedAt: new Date().toISOString(), habits: state.habits, days: state.days };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `tracker-${todayStr()}.json`; a.click();
  URL.revokeObjectURL(url);
});
$('#import-btn').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.habits || !data.days) throw new Error('Invalid file format');
    if (!confirm('Overwrite current habits and days?')) return;
    const uidS = state.user.uid;
    await setDoc(doc(db, 'users', uidS, 'meta', 'habits'), { list: data.habits });
    let batch = writeBatch(db); let n = 0;
    for (const [k, v] of Object.entries(data.days)) {
      batch.set(doc(db, 'users', uidS, 'days', k), v);
      n++;
      if (n % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
    }
    await batch.commit();
    alert('Import complete.');
  } catch (err) { alert('Import failed: ' + err.message); }
  finally { e.target.value = ''; }
});

// ---------- Master render ----------
function renderAll() {
  renderToday();
  if (state.currentTab === 'calendar') {
    renderCalendar();
    renderSelectedDay();
    renderStats();
  }
}

// ---------- Service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.update();
      // If a new SW takes control while the page is open, reload once so the user sees latest code.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }).catch(() => {});
  });
}

