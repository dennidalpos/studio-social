'use strict';
// Optional separate window for the simple view: Studio Social on the left menu, the socials one click away.
// Sign-ins are made by the person, on the social's own pages; Electron keeps the cookies in .data/browser
// (this user's folder, Git-ignored) so the login lasts. Studio Social never reads or automates them.
const { app, BrowserWindow, Menu, session, shell } = require('electron');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..', '.data');
const port = Number(process.env.PORT || 3000);
const local = `http://localhost:${port}`;
const socials = [
  ['LinkedIn', 'https://www.linkedin.com/feed/'], ['Facebook', 'https://www.facebook.com/'],
  ['Instagram', 'https://www.instagram.com/'], ['TikTok', 'https://www.tiktok.com/upload'],
];

app.setPath('userData', join(root, 'browser'));

function localAddress() {
  try { return `${local}/?key=${encodeURIComponent(readFileSync(join(root, 'access.key'), 'utf8').trim())}`; }
  catch { return local; }
}

const allowed = (address) => {
  try {
    const url = new URL(address);
    return url.origin === local || url.protocol === 'https:';
  } catch { return false; }
};

app.whenReady().then(() => {
  // No camera, microphone, location or notification prompts: the window is for writing and publishing posts.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, done) => done(false));
  const window = new BrowserWindow({
    width: 1280, height: 860, title: 'Studio Social',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const open = (address) => { void window.loadURL(address); };
  window.webContents.on('will-navigate', (event, address) => { if (!allowed(address)) event.preventDefault(); });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (allowed(url)) open(url);
    else if (/^mailto:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Studio Social', submenu: [{ label: 'Studio Social', click: () => open(localAddress()) }, { role: 'reload' }, { role: 'quit' }] },
    { label: 'Socials', submenu: socials.map(([label, address]) => ({ label, click: () => open(address) })) },
    { label: 'Navigate', submenu: [{ label: 'Back', accelerator: 'Alt+Left', click: () => window.webContents.navigationHistory.goBack() }, { label: 'Forward', accelerator: 'Alt+Right', click: () => window.webContents.navigationHistory.goForward() }] },
  ]));
  open(localAddress());
});

app.on('window-all-closed', () => app.quit());
