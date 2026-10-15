// Fix the Queues: runs on Netlify's servers, never in the student's browser.
// Every page is sent as plain HTML + CSS, so it works on networks that block JavaScript.

// ---- Settings ----
// The publishable key is safe to keep here. You can also set SUPABASE_URL and
// SUPABASE_KEY in Netlify (Project configuration → Environment variables) to override.
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://mymrazunfljebxtbfzlt.supabase.co').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_mlhgB6ddni2RaOO070uPuQ_iHf9NTm2';
const SCHOOL_NAME = process.env.SCHOOL_NAME || 'your school';

const START_POINTS = 100;
const YEARS = [7, 8, 9, 10, 11, 12, 13];
const DAYS = [
  { short: 'Mon', long: 'Monday' }, { short: 'Tue', long: 'Tuesday' },
  { short: 'Wed', long: 'Wednesday' }, { short: 'Thu', long: 'Thursday' },
  { short: 'Fri', long: 'Friday' }
];
const STUDENT_COOKIE = 'ftq_student';
const LAST_COOKIE = 'ftq_last';

// ---- Small helpers ----
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const yearLabel = (n) => `Year ${n}`;
const fullName = (s) => `${s.first_name} ${s.surname}`;
const dayList = (days, long) => DAYS
  .filter((d) => days.includes(d.short))
  .map((d) => (long ? d.long : d.short))
  .join(', ');

function ukNow() {
  // Today's date parts in UK time.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric'
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { weekday: get('weekday'), day: +get('day'), month: +get('month'), year: +get('year') };
}
function todayShort() {
  const w = ukNow().weekday;
  return DAYS.some((d) => d.short === w) ? w : null;
}
function weekOf() {
  const n = ukNow();
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const d = new Date(Date.UTC(n.year, n.month - 1, n.day));
  d.setUTCDate(d.getUTCDate() - order.indexOf(n.weekday));
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// ---- Cookies ----
function readCookies(req) {
  const out = {};
  (req.headers.get('cookie') || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}
const encodeJson = (v) => Buffer.from(JSON.stringify(v), 'utf8').toString('base64url');
function decodeJson(v) {
  try { return JSON.parse(Buffer.from(v, 'base64url').toString('utf8')); } catch { return null; }
}
function cookie(name, value, maxAge, req) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}
function getStudent(req) {
  const s = decodeJson(readCookies(req)[STUDENT_COOKIE] || '');
  if (s && typeof s.first_name === 'string' && s.first_name && typeof s.surname === 'string' && s.surname
      && YEARS.includes(s.year_group)) return s;
  return null;
}

// ---- Supabase ----
class DbError extends Error {
  constructor(message, friendly) { super(message); this.friendly = friendly; }
}
async function rpc(name, args = {}) {
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Accept: 'application/json' };
  if (SUPABASE_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_KEY}`; // legacy anon keys
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
  } catch (e) {
    throw new DbError(String(e), 'Could not reach the database. Please try again in a moment.');
  }
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) {
    const msg = (body && body.message) || text || `HTTP ${res.status}`;
    if (body && body.code === 'P0001') throw new DbError(msg, msg); // messages written in schema.sql
    if (res.status === 404 || (body && body.code === 'PGRST202')) {
      throw new DbError(msg, 'The database isn\u2019t set up yet. Run supabase/schema.sql in Supabase (see README).');
    }
    if (res.status === 401 || res.status === 403) {
      throw new DbError(msg, 'The Supabase key isn\u2019t right. Check SUPABASE_URL and SUPABASE_KEY (see README).');
    }
    throw new DbError(msg, 'Something went wrong talking to the database. Please try again.');
  }
  return body;
}

// ---- Page pieces ----
const ICON_LOGO = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="8" r="2.2"/><circle cx="12" cy="8" r="2.2"/><circle cx="19" cy="8" r="2.2"/><path d="M2 17v-1.5a3 3 0 0 1 6 0V17"/><path d="M9 17v-1.5a3 3 0 0 1 6 0V17"/><path d="M16 17v-1.5a3 3 0 0 1 6 0V17"/><path d="M2 20.5h20"/></svg>';
const ICON_LOGO_SM = ICON_LOGO.replace('width="28" height="28"', 'width="22" height="22"');
const ICON_ARROW = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
const ICON_CROWN = (attrs) => `<svg ${attrs} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7z"/><path d="M5 21h14" fill="none" stroke-linecap="round"/></svg>`;
const ICON_TICK = (size, sw) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>`;
const ICON_PLUS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
const ICON_BACK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg>';

function page(title, body, { refresh } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${refresh ? `<meta http-equiv="refresh" content="${refresh}">` : ''}
<title>${esc(title)}</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%8D%BD%EF%B8%8F%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<div class="app">
${body}
</div>
</body>
</html>`;
}

function html(body, { status = 200, cookies = [] } = {}) {
  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  cookies.forEach((c) => headers.append('Set-Cookie', c));
  return new Response(body, { status, headers });
}
function redirect(to, cookies = []) {
  const headers = new Headers({ Location: to, 'Cache-Control': 'no-store' });
  cookies.forEach((c) => headers.append('Set-Cookie', c));
  return new Response(null, { status: 303, headers });
}
const err = (msg) => (msg ? `<span class="error" role="alert">${esc(msg)}</span>` : '');
const yearOptions = (selected) => '<option value="">Choose a year group</option>' +
  YEARS.map((y) => `<option value="${y}"${y === selected ? ' selected' : ''}>${yearLabel(y)}</option>`).join('');

// ---- 1. Welcome ----
function welcomePage(values = {}, errors = {}) {
  return page('Fix the Queues', `
<section class="screen" id="screen-welcome" aria-labelledby="welcome-title">
  <header class="hero">
    <div class="brand">
      <div class="logo" aria-hidden="true">${ICON_LOGO}</div>
      <span class="brand-name">Fix the Queues</span>
    </div>
    <h1 id="welcome-title">Fairer lunch queues, together.</h1>
    <p>Report problems in the lunch queue and help your year group earn first lunch.</p>
  </header>

  <form class="card signin" method="post" action="/signin" novalidate>
    <h2>Sign in</h2>
    <div class="stack">
      <label class="field-label" for="signin-first">First name</label>
      <input class="input" id="signin-first" name="first_name" type="text" autocomplete="given-name" maxlength="30" value="${esc(values.first_name)}">
      ${err(errors.first_name)}
    </div>
    <div class="stack">
      <label class="field-label" for="signin-last">Surname</label>
      <input class="input" id="signin-last" name="surname" type="text" autocomplete="family-name" maxlength="30" value="${esc(values.surname)}">
      ${err(errors.surname)}
    </div>
    <div class="stack">
      <label class="field-label" for="signin-year">Year group</label>
      <select class="select" id="signin-year" name="year_group">${yearOptions(values.year_group)}</select>
      ${err(errors.year_group)}
    </div>
    <span class="helper">You can still choose to report anonymously.</span>
    <button class="btn btn-primary" type="submit">Continue ${ICON_ARROW}</button>
  </form>

  <div class="features">
    <div class="feature">
      <div class="feature-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></div>
      Report queue issues
    </div>
    <div class="feature">
      <div class="feature-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg></div>
      Track your year group
    </div>
    <div class="feature">
      <div class="feature-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/></svg></div>
      Win first lunch
    </div>
  </div>

  <div class="welcome-foot">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
    <span>For students at ${esc(SCHOOL_NAME)}</span>
  </div>
</section>`);
}

async function handleSignin(req) {
  const form = await req.formData();
  const values = {
    first_name: String(form.get('first_name') || '').trim().slice(0, 30),
    surname: String(form.get('surname') || '').trim().slice(0, 30),
    year_group: Number(form.get('year_group'))
  };
  const errors = {};
  if (!values.first_name) errors.first_name = 'Enter your first name.';
  if (!values.surname) errors.surname = 'Enter your surname.';
  if (!YEARS.includes(values.year_group)) errors.year_group = 'Choose your year group.';
  if (Object.keys(errors).length) return html(welcomePage(values, errors), { status: 422 });
  return redirect('/board', [cookie(STUDENT_COOKIE, encodeJson(values), 60 * 60 * 24 * 365, req)]);
}

// ---- 2. Leaderboard ----
async function boardPage(student) {
  let table = [], counts = [], recent = [], problem = '';
  try {
    [table, counts, recent] = await Promise.all([
      rpc('get_leaderboard'), rpc('get_issue_counts'), rpc('get_recent_reports', { max_rows: 5 })
    ]);
  } catch (e) {
    problem = e.friendly || 'Could not load the latest results.';
  }
  const top = table[0];

  const rows = table.map((row, i) => `
      <li class="row${i === 0 ? ' first' : ''}">
        <span class="rank" aria-hidden="true">${i + 1}</span>
        <div class="row-main">
          <div class="row-top"><span class="year-name">${yearLabel(row.year_group)}${i === 0 ? ICON_CROWN('class="crown" width="20" height="20" role="img" aria-label="Crown: top of the leaderboard"') : ''}</span><span>${row.points} pts</span></div>
          <div class="track" aria-hidden="true"><div class="fill" style="width:${Math.max(0, Math.min(100, (row.points / START_POINTS) * 100))}%"></div></div>
        </div>
      </li>`).join('');

  const tiles = counts.filter((c) => c.label !== 'Other' || c.total > 0)
    .map((c) => `<div class="card issue-tile"><strong>${c.total}</strong><span>${esc(c.label)}</span></div>`).join('');

  const feed = recent.length ? recent.map((r) => `
      <article class="card report-card">
        <div class="tags">${(r.issues || []).map((l) => `<span class="tag tag-issue">${esc(l)}</span>`).join('')}<span class="tag tag-year">${yearLabel(r.year_group)}</span><span class="tag-day">${esc(dayList(r.days || []))}</span></div>
        ${r.details ? `<p>${esc(r.details)}</p>` : ''}
        <span class="by">${r.reporter_name ? `<span class="named-dot">${ICON_TICK(14, 2.6)}</span>Reported by ${esc(r.reporter_name)}` : 'Anonymous'}</span>
      </article>`).join('')
    : '<div class="card empty">No reports yet this week. Seen a problem in the queue? Report it.</div>';

  return page('Leaderboard – Fix the Queues', `
<section class="screen pad" id="screen-board" aria-labelledby="board-title">
  <div class="topbar">
    <div class="brand">
      <div class="logo logo-sm" aria-hidden="true">${ICON_LOGO_SM}</div>
      <div class="who"><strong>${esc(fullName(student))}</strong><span>${yearLabel(student.year_group)}</span></div>
    </div>
    <form class="inline-form" method="post" action="/logout"><button class="logout-btn" type="submit">Log out</button></form>
  </div>

  ${problem ? `<p class="error" role="alert">${esc(problem)}</p>` : ''}

  <div class="banner">
    <div class="banner-label">${ICON_CROWN('width="20" height="20" aria-hidden="true"')} First lunch this week</div>
    <h1 class="banner-year" id="board-title">${top ? yearLabel(top.year_group) : '\u2013'}</h1>
    <span class="banner-sub">${top ? `${top.points} points this week. Week of ${esc(weekOf())}. New winner every Monday.` : 'Results will appear here.'}</span>
  </div>

  <a class="btn btn-salmon" href="/report">${ICON_PLUS} Report a problem</a>

  <div class="section">
    <div class="section-head"><h2>Leaderboard</h2><span>Fewer issues, more points</span></div>
    <ol class="card board">${rows}</ol>
  </div>

  <div class="section">
    <h2>This week's issues</h2>
    <div class="issue-grid">${tiles}</div>
  </div>

  <div class="section">
    <h2>Recent reports</h2>
    <div class="feed">${feed}</div>
  </div>

  <p class="refresh-note">This page refreshes every minute.</p>
</section>`, { refresh: 60 });
}

// ---- 3. Report ----
async function reportPage(student, values = {}, errors = {}, status = 200) {
  let issueTypes = [];
  let loadProblem = '';
  try { issueTypes = await rpc('get_issue_types'); } catch (e) { loadProblem = e.friendly; }

  const days = values.days || (todayShort() ? [todayShort()] : []);
  const issues = values.issues || [];

  const dayInputs = DAYS.map((d, i) => `
        <span><input class="opt-input visually-hidden" type="checkbox" id="day-${i}" name="days" value="${d.short}"${days.includes(d.short) ? ' checked' : ''}><label class="opt" for="day-${i}"><span aria-hidden="true">${d.short}</span><span class="visually-hidden">${d.long}</span></label></span>`).join('');

  const issueInputs = issueTypes.map((t, i) => `
        <span><input class="opt-input visually-hidden" type="checkbox" id="issue-${i}" name="issues" value="${esc(t.label)}"${issues.includes(t.label) ? ' checked' : ''}><label class="opt" for="issue-${i}">${esc(t.label)}</label></span>`).join('');

  return html(page('Report a problem – Fix the Queues', `
<section class="screen pad" id="screen-report" aria-labelledby="report-title">
  <div class="back-row">
    <a class="icon-btn" href="/board" aria-label="Back to leaderboard">${ICON_BACK}</a>
    Leaderboard
  </div>

  <div class="report-head">
    <h1 id="report-title">Report a problem</h1>
    <p>Tell us what happened in the lunch queue. Reports affect a year group's points, not a person.</p>
  </div>

  <form class="pad" style="padding:0" method="post" action="/report" novalidate>
    <div class="card anon-card">
      <input class="switch-input visually-hidden" type="checkbox" id="anon" name="anonymous" value="1" role="switch"${values.anonymous ? ' checked' : ''}>
      <div class="anon-row">
        <div><strong id="anon-label">Report anonymously</strong><span class="hint-off">Your name will be shown on this report</span><span class="hint-on">Your name will be hidden on this report</span></div>
        <label class="switch" for="anon"><span></span><b class="visually-hidden">Report anonymously</b></label>
      </div>
      <div class="name-block">
        <label class="field-label" for="report-name">Your name</label>
        <input class="input" id="report-name" type="text" value="${esc(fullName(student))}" readonly>
        <span class="badge">${ICON_TICK(14, 2.6)} Shown as a named report</span>
      </div>
    </div>

    <div class="stack">
      <label class="field-label" for="my-year">Your year group</label>
      <input class="input" id="my-year" type="text" value="${yearLabel(student.year_group)}" readonly>
      <span class="helper">Taken from your sign-in details.</span>
    </div>

    <fieldset>
      <legend class="field-label">Which day did it happen?</legend>
      <span class="helper">Choose all that apply.</span>
      <div class="day-grid">${dayInputs}
      </div>
      ${err(errors.days)}
    </fieldset>

    <fieldset class="stack">
      <legend class="field-label">What happened?</legend>
      <span class="helper">Choose all that apply.</span>
      <div class="chips">${issueInputs}
      </div>
      ${err(errors.issues || loadProblem)}
      <label for="details" class="helper" style="font-weight:500;color:var(--ink-2);margin-top:6px">Add details (optional)</label>
      <textarea class="textarea" id="details" name="details" rows="4" maxlength="280" placeholder="What did you see? Please don't name other students.">${esc(values.details)}</textarea>
    </fieldset>

    <div class="stack">
      <label class="field-label" for="year">Which year group was involved?</label>
      <select class="select" id="year" name="year_group">${yearOptions(values.year_group)}</select>
      <span class="helper">Reports about your own year group don't change its points.</span>
      ${err(errors.year_group)}
    </div>

    <div class="actions">
      ${errors.form ? `<p class="error" role="alert">${esc(errors.form)}</p>` : ''}
      <button class="btn btn-primary" type="submit">Submit report</button>
      <a class="btn btn-plain" href="/board">Cancel</a>
    </div>
  </form>
</section>`), { status });
}

async function handleReport(req, student) {
  const form = await req.formData();
  const values = {
    anonymous: form.get('anonymous') === '1',
    days: form.getAll('days').map(String).filter((d) => DAYS.some((x) => x.short === d)),
    issues: [...new Set(form.getAll('issues').map(String))],
    details: String(form.get('details') || '').trim().slice(0, 280),
    year_group: Number(form.get('year_group'))
  };
  const errors = {};
  if (!values.days.length) errors.days = 'Choose at least one day.';
  if (!values.issues.length) errors.issues = 'Choose at least one thing that happened.';
  if (!YEARS.includes(values.year_group)) errors.year_group = 'Choose the year group involved.';
  if (Object.keys(errors).length) return reportPage(student, values, errors, 422);

  let result;
  try {
    result = await rpc('submit_report', {
      p_reporter_name: fullName(student),
      p_reporter_year: student.year_group,
      p_year_group: values.year_group,
      p_issues: values.issues,
      p_days: values.days,
      p_details: values.details || null,
      p_is_anonymous: values.anonymous
    });
  } catch (e) {
    return reportPage(student, values, { form: e.friendly || 'Something went wrong. Please try again.' }, 422);
  }
  const row = (Array.isArray(result) && result[0]) || { points_lost: 0 };
  const summary = {
    issues: values.issues, days: values.days, year_group: values.year_group,
    reporter_year: student.year_group, anonymous: values.anonymous, points_lost: row.points_lost
  };
  return redirect('/thanks', [cookie(LAST_COOKIE, encodeJson(summary), 600, req)]);
}

// ---- 4. Thanks ----
function thanksPage(student, r) {
  const pts = r.points_lost;
  const rows = [
    ['What happened', r.issues.join(', ')],
    [r.days.length > 1 ? 'Days' : 'Day', dayList(r.days, true)],
    ['Year group involved', yearLabel(r.year_group)],
    ['Your year group', yearLabel(r.reporter_year)],
    ['Shown as', r.anonymous ? 'Anonymous' : `${fullName(student)} (named)`],
    ['Points', pts ? `\u2212${pts} for ${yearLabel(r.year_group)}`
      : (r.reporter_year === r.year_group ? 'None, it\u2019s your own year group' : 'No points taken off')]
  ];
  return page('Report sent – Fix the Queues', `
<section class="screen thanks" id="screen-thanks" aria-labelledby="thanks-title">
  <div class="thanks-top">
    <div class="tick" aria-hidden="true">${ICON_TICK(48, 2.6)}</div>
    <h1 id="thanks-title">Thanks for helping fix the lunch queue!</h1>
    <p>Your report has been added. The leaderboard updates straight away.</p>
  </div>
  <div class="card summary">
    <h2>Your report</h2>
    <dl>${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
  </div>
  <div class="actions">
    <a class="btn btn-primary" href="/board">Back to leaderboard</a>
    <a class="btn btn-secondary" href="/report">Make another report</a>
  </div>
</section>`);
}

// ---- Router ----
export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();
  const student = getStudent(req);

  try {
    if (path === '/' && method === 'GET') {
      return student ? redirect('/board') : html(welcomePage());
    }
    if (path === '/signin' && method === 'POST') return handleSignin(req);
    if (path === '/logout' && method === 'POST') {
      return redirect('/', [cookie(STUDENT_COOKIE, '', 0, req), cookie(LAST_COOKIE, '', 0, req)]);
    }

    // Everything below needs a signed-in student.
    if (!student) return redirect('/');

    if (path === '/board' && method === 'GET') return html(await boardPage(student));
    if (path === '/report' && method === 'GET') return reportPage(student);
    if (path === '/report' && method === 'POST') return handleReport(req, student);
    if (path === '/thanks' && method === 'GET') {
      const last = decodeJson(readCookies(req)[LAST_COOKIE] || '');
      if (!last || !Array.isArray(last.issues) || !Array.isArray(last.days)) return redirect('/board');
      return html(thanksPage(student, last));
    }
    return redirect(student ? '/board' : '/');
  } catch (e) {
    console.error(e);
    return html(page('Something went wrong – Fix the Queues', `
<section class="screen pad">
  <h1>Something went wrong</h1>
  <p>Please go back and try again.</p>
  <a class="btn btn-primary" href="/">Back to the start</a>
</section>`), { status: 500 });
  }
};

// Tell Netlify which web addresses this function answers.
export const config = {
  path: ['/', '/signin', '/logout', '/board', '/report', '/thanks'],
  preferStatic: true
};
