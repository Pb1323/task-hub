// task-hub main process. Local only: no network, no servers. Opens links in the default browser on request.
const { nativeTheme, app, BrowserWindow, ipcMain, shell, screen, Tray, Menu, nativeImage, powerMonitor, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// TASKHUB_DATA_DIR = throwaway profile for tests (separate data, no single-instance lock, no autostart).
const TEST = !!process.env.TASKHUB_DATA_DIR;
if (TEST) app.setPath('userData', process.env.TASKHUB_DATA_DIR);
else if (!app.requestSingleInstanceLock()) app.quit();

// Experiment (TASKHUB_ACRYLIC=1): real Windows 11 blur behind the panel, at the cost of the large rounded corners.
const ACRYLIC = !!process.env.TASKHUB_ACRYLIC;
const MARGIN = 14;
const EXPANDED_W = 392;
const COLLAPSED_W = 64;
const SNOOZE_MS = 5 * 60 * 1000;
const IDLE_PAUSE_S = 5 * 60;

const KINDS = {
  water: { icon: '\u{1F4A7}', title: 'Time for water', body: 'Drink a glass, then back to it.' },
  walk: { icon: '\u{1F6B6}', title: 'Get up and walk', body: 'Two minutes away from the screen.' },
  stretch: { icon: '\u{1F9D8}', title: 'Stretch', body: 'Neck, shoulders and wrists.' },
};

const DEFAULTS = () => ({
  tasks: [],
  links: [
    { name: 'Claude', url: 'https://claude.ai', color: '#d97757', glyph: '✦' },
    { name: 'Gmail', url: 'https://mail.google.com', color: '#ea4335', glyph: '✉' },
    { name: 'GitHub', url: 'https://github.com/Pb1323', color: '#57606a', glyph: '⌥' },
    { name: 'WhatsApp', url: 'https://web.whatsapp.com', color: '#25d366', glyph: '\u{1F4AC}' },
  ],
  focus: { goal: '', minutes: 25, taskId: null, endsAt: null, pausedLeft: null },
  habits: { date: today(), water: 0, walk: 0, stretch: 0 },
  settings: {
    pinned: false,
    nudgesOn: true,
    nudges: { water: 30, walk: 50, stretch: 75 },
    goals: { water: 8, walk: 6, stretch: 4 },
    autoLaunchInit: false,
  },
});

function today() { // local calendar date, so the habit rings reset at local midnight (not UTC)
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let state;
let win, tray, bannerWin;
let collapsed = true;
let saveTimer;
const dataFile = () => path.join(app.getPath('userData'), 'data.json');

function loadState() {
  const d = DEFAULTS();
  let raw = null;
  try { raw = fs.readFileSync(dataFile(), 'utf8').replace(/^﻿/, ''); } catch { /* first run */ }
  try {
    if (raw === null) throw new Error('none');
    const saved = JSON.parse(raw);
    state = {
      ...d, ...saved,
      focus: { ...d.focus, ...saved.focus },
      habits: { ...d.habits, ...saved.habits },
      settings: { ...d.settings, ...saved.settings, nudges: { ...d.settings.nudges, ...(saved.settings || {}).nudges }, goals: { ...d.settings.goals, ...(saved.settings || {}).goals } },
    };
  } catch (e) {
    state = d;
    if (raw !== null) { // unreadable file: keep a copy so a later save can't destroy it
      try { fs.copyFileSync(dataFile(), dataFile() + '.bad-' + Date.now()); } catch { /* ignore */ }
    }
  }
  state.links.forEach((l) => { if (l.color === '#24292f') l.color = '#57606a'; }); // old GitHub tile was invisible in dark mode
  if (state.habits.date !== today()) state.habits = { date: today(), water: 0, walk: 0, stretch: 0 };
}

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
      fs.writeFileSync(dataFile() + '.tmp', JSON.stringify(state, null, 2));
      fs.renameSync(dataFile() + '.tmp', dataFile());
    } catch (e) { console.error('save failed', e.message); }
  }, 300);
}

function view() {
  return { ...state, autoLaunch: app.getLoginItemSettings(loginOpts()).openAtLogin };
}
function push() { if (win && !win.isDestroyed()) win.webContents.send('state:push', view()); }

function loginOpts() { return { path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] }; }
function setAutoLaunch(on) { app.setLoginItemSettings({ openAtLogin: !!on, ...loginOpts() }); rebuildTray(); }

// The window is always full height and expanded width; the panel inside collapses/expands with CSS and
// the renderer makes the empty (transparent) part click-through (see ui:ignore).
function bounds() {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - EXPANDED_W - MARGIN, y: wa.y + MARGIN, width: EXPANDED_W, height: wa.height - 2 * MARGIN };
}

function setCollapsed(c) {
  collapsed = c;
  if (win && !win.isDestroyed()) win.webContents.send('ui:collapsed', c);
}

function createWindow() {
  win = new BrowserWindow({
    ...bounds(),
    frame: false, resizable: false, maximizable: false, minimizable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: false, show: false, focusable: true,
    ...(ACRYLIC ? { backgroundMaterial: 'acrylic', roundedCorners: true } : { transparent: true }),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces?.(true);
  if (!ACRYLIC) win.setIgnoreMouseEvents(true, { forward: true }); // transparent area must not block clicks on other apps
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: ACRYLIC ? { acrylic: '1' } : {} });
  win.once('ready-to-show', () => {
    win.showInactive();
    setCollapsed(!state.settings.pinned);
  });
}

function toggleVisible() {
  if (!win) return;
  if (win.isVisible()) win.hide(); else win.showInactive();
}

let rebuildTray = () => {};
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('task-hub');
  rebuildTray = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / hide  (Ctrl+Alt+H)', click: toggleVisible },
    { label: 'Expand', click: () => { win.showInactive(); setCollapsed(false); } },
    { label: 'Launch at startup', type: 'checkbox', checked: app.getLoginItemSettings(loginOpts()).openAtLogin, click: (m) => { setAutoLaunch(m.checked); push(); } },
    { type: 'separator' },
    { label: 'Quit task-hub', click: () => app.quit() },
  ]));
  rebuildTray();
  tray.on('click', toggleVisible);
  tray.on('right-click', rebuildTray);
}

// ---------- banners (health nudges, focus done) ----------
function showBanner(payload) {
  if (bannerWin && !bannerWin.isDestroyed()) bannerWin.close();
  const wa = screen.getPrimaryDisplay().workArea;
  const w = 400, h = 92;
  bannerWin = new BrowserWindow({
    x: wa.x + Math.round((wa.width - w) / 2), y: wa.y + 14, width: w, height: h,
    frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, show: false, focusable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  bannerWin.setAlwaysOnTop(true, 'screen-saver');
  bannerWin.loadFile(path.join(__dirname, 'banner', 'banner.html'), { query: { d: JSON.stringify(payload) } });
  bannerWin.once('ready-to-show', () => bannerWin.showInactive());
  const mine = bannerWin;
  setTimeout(() => { if (!mine.isDestroyed()) { mine.close(); if (payload.kind) answer(payload.kind, 'snooze'); } }, 25000);
  return mine;
}

// ---------- health nudges ----------
const next = {};
let pending = null;
// TASKHUB_FAST=1 makes one 'minute' last one second, for testing the schedule.
const MIN = process.env.TASKHUB_FAST ? 1000 : 60000;
function resetNext(kind) { next[kind] = Date.now() + state.settings.nudges[kind] * MIN; }
function initNudges() { Object.keys(KINDS).forEach(resetNext); }
function answer(kind, action) {
  if (pending !== kind) return;
  pending = null;
  if (action === 'done') {
    state.habits[kind] += 1;
    resetNext(kind);
    saveSoon(); push();
  } else {
    next[kind] = Date.now() + SNOOZE_MS;
  }
  if (bannerWin && !bannerWin.isDestroyed()) bannerWin.close();
}
setInterval(() => {
  if (!state) return;
  if (state.habits.date !== today()) { state.habits = { date: today(), water: 0, walk: 0, stretch: 0 }; saveSoon(); push(); }
  if (!state.settings.nudgesOn || pending) return;
  // Don't count time while the computer is idle or locked.
  if (powerMonitor.getSystemIdleTime() > IDLE_PAUSE_S) { Object.keys(next).forEach((k) => { next[k] += 5000; }); return; }
  const now = Date.now();
  const due = Object.keys(KINDS).filter((k) => now >= next[k]).sort((a, b) => next[a] - next[b])[0];
  if (due) { pending = due; showBanner({ kind: due, ...KINDS[due], actions: true }); }
}, 5000);

// ---------- IPC ----------
const URL_OK = new Set(['https:', 'http:', 'mailto:']);
ipcMain.handle('state:get', () => view());
// Only known keys, only sane shapes, bounded sizes: the renderer is ours but data on disk should stay clean.
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
function clean(s) {
  const out = {};
  if (Array.isArray(s.tasks)) out.tasks = s.tasks.slice(0, 500).map((t) => ({ id: str(t.id, 24), text: str(t.text, 140), done: !!t.done }));
  if (Array.isArray(s.links)) out.links = s.links.slice(0, 24).map((l) => ({ name: str(l.name, 24), url: str(l.url, 300), color: str(l.color, 9), glyph: str(l.glyph, 4) }));
  if (s.focus && typeof s.focus === 'object') {
    const f = s.focus;
    out.focus = { goal: str(f.goal, 120), minutes: num(f.minutes, 1, 240, 25), taskId: f.taskId ? str(f.taskId, 24) : null,
      endsAt: f.endsAt == null ? null : num(f.endsAt, 0, 8.64e15, null), pausedLeft: f.pausedLeft == null ? null : num(f.pausedLeft, 0, 2.4e7, null) };
  }
  if (s.habits && typeof s.habits === 'object') {
    out.habits = { date: str(s.habits.date, 10), water: num(s.habits.water, 0, 999, 0), walk: num(s.habits.walk, 0, 999, 0), stretch: num(s.habits.stretch, 0, 999, 0) };
  }
  if (s.settings && typeof s.settings === 'object') {
    const t = s.settings, n = t.nudges || {}, g = t.goals || {};
    out.settings = { ...state.settings, pinned: !!t.pinned, nudgesOn: !!t.nudgesOn,
      nudges: { water: num(n.water, 5, 240, 30), walk: num(n.walk, 5, 240, 50), stretch: num(n.stretch, 5, 240, 75) },
      goals: { water: num(g.water, 1, 99, 8), walk: num(g.walk, 1, 99, 6), stretch: num(g.stretch, 1, 99, 4) } };
  }
  return out;
}
ipcMain.on('state:set', (_e, s) => {
  if (!s || typeof s !== 'object') return;
  const prevN = JSON.stringify(state.settings.nudges);
  state = { ...state, ...clean(s) };
  if (JSON.stringify(state.settings.nudges) !== prevN) initNudges();
  saveSoon();
});
ipcMain.on('ui:collapsed', (_e, c) => setCollapsed(!!c));
ipcMain.on('ui:ignore', (_e, ignore) => { if (win && !win.isDestroyed() && !ACRYLIC) win.setIgnoreMouseEvents(!!ignore, { forward: true }); });
ipcMain.on('open:link', (_e, url) => {
  try { const u = new URL(url); if (URL_OK.has(u.protocol)) shell.openExternal(u.toString()); } catch { /* ignore bad url */ }
});
ipcMain.on('open:claudeCode', () => {
  try {
    // `start` gives the shell its own console window; a bare detached spawn with ignored stdio exits at once.
    spawn('cmd.exe', ['/c', 'start', '"task-hub: Claude Code"', 'powershell.exe', '-NoExit', '-Command', 'claude'],
      { cwd: path.join(os.homedir(), 'Downloads'), detached: true, stdio: 'ignore', windowsVerbatimArguments: true, windowsHide: true }).unref();
  } catch (e) { console.error('claude launch failed', e.message); }
});
ipcMain.on('app:autoLaunch', (_e, on) => { setAutoLaunch(on); push(); });
ipcMain.on('app:quit', () => app.quit());
ipcMain.on('notify', (_e, p) => showBanner({ icon: String(p.icon || '✅'), title: String(p.title || ''), body: String(p.body || ''), actions: false }));
ipcMain.on('banner:action', (_e, kind, action) => { if (kind in KINDS) answer(kind, action); else if (bannerWin && !bannerWin.isDestroyed()) bannerWin.close(); });
ipcMain.handle('nudge:status', () => {
  const k = Object.keys(KINDS).sort((a, b) => next[a] - next[b])[0];
  return { kind: k, at: next[k], pending };
});

app.whenReady().then(() => {
  if (process.env.TASKHUB_THEME) nativeTheme.themeSource = process.env.TASKHUB_THEME; // test only: light | dark
  loadState();
  if (!TEST && !state.settings.autoLaunchInit) { setAutoLaunch(true); state.settings.autoLaunchInit = true; saveSoon(); }
  initNudges();
  createWindow();
  createTray();
  if (process.env.TASKHUB_TEST_BANNER) setTimeout(() => { pending = 'water'; showBanner({ kind: 'water', ...KINDS.water, actions: true }); }, 3000);
  globalShortcut.register('Control+Alt+H', toggleVisible);
  powerMonitor.on('resume', () => { initNudges(); pending = null; }); // don't fire a backlog of reminders after sleep
  screen.on('display-metrics-changed', () => win && win.setBounds(bounds()));
});
app.on('second-instance', () => { if (win) { win.showInactive(); setCollapsed(false); } });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => e.preventDefault());
