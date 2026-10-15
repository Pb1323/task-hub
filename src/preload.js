const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hub', {
  getState: () => ipcRenderer.invoke('state:get'),
  setState: (s) => ipcRenderer.send('state:set', s),
  onPush: (fn) => ipcRenderer.on('state:push', (_e, s) => fn(s)),
  onCollapsed: (fn) => ipcRenderer.on('ui:collapsed', (_e, c) => fn(c)),
  setCollapsed: (c) => ipcRenderer.send('ui:collapsed', c),
  setIgnore: (b) => ipcRenderer.send('ui:ignore', b),
  openLink: (url) => ipcRenderer.send('open:link', url),
  openClaudeCode: () => ipcRenderer.send('open:claudeCode'),
  setAutoLaunch: (on) => ipcRenderer.send('app:autoLaunch', on),
  quit: () => ipcRenderer.send('app:quit'),
  notify: (p) => ipcRenderer.send('notify', p),
  nudgeStatus: () => ipcRenderer.invoke('nudge:status'),
  bannerAction: (kind, action) => ipcRenderer.send('banner:action', kind, action),
});
