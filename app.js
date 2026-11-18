'use strict';

// ---- Storage ---------------------------------------------------------------

const STORAGE_KEY = 'habit-tracker:v1';
let storageOk = true;

function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageOk = false;
    return { habits: [] };
  }
  if (!raw) return { habits: [] };
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.habits)) return { habits: [] };
    return {
      habits: data.habits
        .filter((h) => h && typeof h.id === 'string' && typeof h.name === 'string')
        .map((h) => ({
          id: h.id,
          name: h.name,
          createdAt: typeof h.createdAt === 'string' ? h.createdAt : dateKey(new Date()),
          done: Array.isArray(h.done) ? [...new Set(h.done.filter(isDateKey))].sort() : [],
        })),
    };
  } catch {
    // Corrupt data: start fresh rather than crash. It's overwritten on the next save.
    return { habits: [] };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageOk = true;
  } catch {
    storageOk = false;
  }
}

// ---- Dates (always local time, never UTC) ----------------------------------

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isDateKey(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Parse at noon so DST shifts can never push the date across midnight.
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

// ---- Streaks ---------------------------------------------------------------

// Consecutive days ending today. If today isn't ticked yet, count from
// yesterday so the streak doesn't look broken before the day is over.
function currentStreak(done, today) {
  const set = new Set(done);
  let day = set.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (set.has(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

function longestStreak(done) {
  const days = [...new Set(done)].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
}

// ---- State changes ---------------------------------------------------------

let state = loadState();

function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function addHabit(name) {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return 'Type a habit name first.';
  if (state.habits.some((h) => h.name.toLowerCase() === clean.toLowerCase())) {
    return `"${clean}" is already on your list.`;
  }
  state.habits.push({ id: newId(), name: clean, createdAt: dateKey(new Date()), done: [] });
  saveState();
  return '';
}

function toggleDay(id, day) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return;
  const i = habit.done.indexOf(day);
  if (i === -1) {
    habit.done.push(day);
    habit.done.sort();
  } else {
    habit.done.splice(i, 1);
  }
  saveState();
}

function deleteHabit(id) {
  state.habits = state.habits.filter((h) => h.id !== id);
  saveState();
}

// ---- Rendering -------------------------------------------------------------

const els = {
  list: document.getElementById('habit-list'),
  empty: document.getElementById('empty-state'),
  form: document.getElementById('add-form'),
  input: document.getElementById('habit-name'),
  error: document.getElementById('form-error'),
  warning: document.getElementById('storage-warning'),
  todayLabel: document.getElementById('today-label'),
  template: document.getElementById('habit-template'),
};

const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const longFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

let renderedDay = null;

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function render() {
  const today = dateKey(new Date());
  renderedDay = today;
  els.todayLabel.textContent = longFmt.format(parseKey(today));
  els.warning.hidden = storageOk;
  els.empty.hidden = state.habits.length > 0;

  const week = [];
  for (let i = 6; i >= 0; i--) week.push(addDays(today, -i));

  const items = state.habits.map((habit) => {
    const li = els.template.content.firstElementChild.cloneNode(true);
    const doneSet = new Set(habit.done);
    const doneToday = doneSet.has(today);

    li.dataset.id = habit.id;
    li.classList.toggle('is-done', doneToday);

    const check = li.querySelector('.today-check');
    check.checked = doneToday;
    check.dataset.day = today;
    li.querySelector('.habit-name').textContent = habit.name;

    const streak = currentStreak(habit.done, today);
    const streakEl = li.querySelector('.streak');
    streakEl.textContent = streak > 0 ? `🔥 ${plural(streak, 'day')} streak` : 'No streak yet';
    streakEl.classList.toggle('active', streak > 0);
    li.querySelector('.best').textContent = `Best: ${plural(longestStreak(habit.done), 'day')}`;

    const weekEl = li.querySelector('.week');
    weekEl.setAttribute('aria-label', `Last 7 days for ${habit.name}`);
    for (const day of week) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day';
      btn.dataset.day = day;
      const date = parseKey(day);
      const done = doneSet.has(day);
      btn.classList.toggle('done', done);
      btn.classList.toggle('is-today', day === today);
      btn.setAttribute('aria-pressed', String(done));
      btn.setAttribute('aria-label', `${longFmt.format(date)}: ${done ? 'done' : 'not done'}`);
      btn.append(weekdayFmt.format(date));
      const num = document.createElement('b');
      num.textContent = String(date.getDate());
      btn.append(num);
      weekEl.append(btn);
    }

    li.querySelector('.delete').setAttribute('aria-label', `Delete ${habit.name}`);
    return li;
  });

  els.list.replaceChildren(...items);
}

// ---- Events ----------------------------------------------------------------

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const error = addHabit(els.input.value);
  els.error.textContent = error;
  if (!error) els.input.value = '';
  render();
  els.input.focus();
});

els.input.addEventListener('input', () => { els.error.textContent = ''; });

els.list.addEventListener('change', (e) => {
  const check = e.target.closest('.today-check');
  if (!check) return;
  toggleDay(check.closest('.habit').dataset.id, check.dataset.day);
  render();
});

els.list.addEventListener('click', (e) => {
  const habitEl = e.target.closest('.habit');
  if (!habitEl) return;
  const id = habitEl.dataset.id;

  const dayBtn = e.target.closest('.day');
  if (dayBtn) {
    toggleDay(id, dayBtn.dataset.day);
    render();
    focusDay(id, dayBtn.dataset.day);
    return;
  }

  if (e.target.closest('.delete')) {
    const habit = state.habits.find((h) => h.id === id);
    if (habit && confirm(`Delete "${habit.name}" and all its history?`)) {
      deleteHabit(id);
      render();
    }
  }
});

// Keep keyboard focus on the same day button after a re-render.
function focusDay(id, day) {
  const li = els.list.querySelector(`.habit[data-id="${CSS.escape(id)}"]`);
  const btn = li && li.querySelector(`.day[data-day="${day}"]`);
  if (btn) btn.focus();
}

// Redraw when the date changes (page left open past midnight or reopened).
function refreshIfNewDay() {
  if (dateKey(new Date()) !== renderedDay) render();
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshIfNewDay();
});
setInterval(refreshIfNewDay, 60 * 1000);

// ---- Theme -----------------------------------------------------------------
// No saved choice = follow the system. The button flips to the opposite of
// whatever is showing now and remembers that choice.

const THEME_KEY = 'habit-tracker:theme';
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const themeBtn = document.getElementById('theme-toggle');

function savedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

function effectiveTheme() {
  return savedTheme() || (darkQuery.matches ? 'dark' : 'light');
}

function applyTheme() {
  const saved = savedTheme();
  if (saved) document.documentElement.dataset.theme = saved;
  else delete document.documentElement.dataset.theme;

  const dark = effectiveTheme() === 'dark';
  themeBtn.textContent = dark ? '☀️ Light' : '🌙 Dark';
  themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

themeBtn.addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage blocked: still switch for this visit.
    document.documentElement.dataset.theme = next;
    themeBtn.textContent = next === 'dark' ? '☀️ Light' : '🌙 Dark';
    return;
  }
  applyTheme();
});

darkQuery.addEventListener('change', applyTheme);

// Stay in sync when the app is open in more than one tab.
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    state = loadState();
    render();
  } else if (e.key === THEME_KEY) {
    applyTheme();
  }
});

applyTheme();
render();
