// task-hub main process. Local only: no network, no servers. Opens links in the default browser on request.
const { app, BrowserWindow, ipcMain, shell, screen, Tray, Menu, nativeImage, powerMonitor, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

if (!app.requestSingleInstanceLock()) app.quit();

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
    { name: 'GitHub', url: 'https://github.com/Pb1323', color: '#24292f', glyph: '⌥' },
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

function today() { return new Date().toISOString().slice(0, 10); }

let state;
let win, tray, bannerWin;
let collapsed = true;
let saveTimer;
const dataFile = () => path.join(app.getPath('userData'), 'data.json');

function loadState() {
  const d = DEFAULTS();
  try {
    const saved = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    state = {
      ...d, ...saved,
      focus: { ...d.focus, ...saved.focus },
      habits: { ...d.habits, ...saved.habits },
      settings: { ...d.settings, ...saved.settings, nudges: { ...d.settings.nudges, ...(saved.settings || {}).nudges }, goals: { ...d.settings.goals, ...(saved.settings || {}).goals } },
    };
  } catch { state = d; }
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
function setAutoLaunch(on) { app.setLoginItemSettings({ openAtLogin: !!on, ...loginOpts() }); }

function bounds(isCollapsed) {
  const wa = screen.getPrimaryDisplay().workArea;
  if (isCollapsed) {
    const h = Math.min(300, wa.height - 2 * MARGIN);
    return { x: wa.x + wa.width - COLLAPSED_W - MARGIN, y: wa.y + Math.round((wa.height - h) / 2), width: COLLAPSED_W, height: h };
  }
  return { x: wa.x + wa.width - EXPANDED_W - MARGIN, y: wa.y + MARGIN, width: EXPANDED_W, height: wa.height - 2 * MARGIN };
}

function setCollapsed(c) {
  collapsed = c;
  if (!win) return;
  win.setBounds(bounds(c));
  win.webContents.send('ui:collapsed', c);
}

function createWindow() {
  win = new BrowserWindow({
    ...bounds(true),
    frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false,
    skipTaskbar: true, alwaysOnTop: true, hasShadow: false, show: false, focusable: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces?.(true);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    win.showInactive();
    setCollapsed(!state.settings.pinned);
  });
}

function toggleVisible() {
  if (!win) return;
  if (win.isVisible()) win.hide(); else win.showInactive();
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('task-hub');
  const rebuild = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / hide  (Ctrl+Alt+H)', click: toggleVisible },
    { label: 'Expand', click: () => { win.showInactive(); setCollapsed(false); } },
    { label: 'Launch at startup', type: 'checkbox', checked: app.getLoginItemSettings(loginOpts()).openAtLogin, click: (m) => { setAutoLaunch(m.checked); push(); } },
    { type: 'separator' },
    { label: 'Quit task-hub', click: () => app.quit() },
  ]));
  rebuild();
  tray.on('click', toggleVisible);
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
function resetNext(kind) { next[kind] = Date.now() + state.settings.nudges[kind] * 60000; }
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
ipcMain.on('state:set', (_e, s) => {
  if (!s || typeof s !== 'object') return;
  const { autoLaunch, ...rest } = s;
  const prevN = JSON.stringify(state.settings.nudges);
  state = { ...state, ...rest };
  if (JSON.stringify(state.settings.nudges) !== prevN) initNudges();
  saveSoon();
});
ipcMain.on('ui:collapsed', (_e, c) => setCollapsed(!!c));
ipcMain.on('open:link', (_e, url) => {
  try { const u = new URL(url); if (URL_OK.has(u.protocol)) shell.openExternal(u.toString()); } catch { /* ignore bad url */ }
});
ipcMain.on('open:claudeCode', () => {
  try {
    spawn('powershell.exe', ['-NoExit', '-Command', 'claude'], { cwd: path.join(os.homedir(), 'Downloads'), detached: true, stdio: 'ignore' }).unref();
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
  loadState();
  if (!state.settings.autoLaunchInit) { setAutoLaunch(true); state.settings.autoLaunchInit = true; saveSoon(); }
  initNudges();
  createWindow();
  createTray();
  if (process.env.TASKHUB_TEST_BANNER) setTimeout(() => { pending = 'water'; showBanner({ kind: 'water', ...KINDS.water, actions: true }); }, 3000);
  globalShortcut.register('Control+Alt+H', toggleVisible);
  screen.on('display-metrics-changed', () => win && win.setBounds(bounds(collapsed)));
});
app.on('second-instance', () => { if (win) { win.showInactive(); setCollapsed(false); } });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => e.preventDefault());
