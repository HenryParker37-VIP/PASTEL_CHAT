const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.png'),
    title: 'PastelChat',
    backgroundColor: '#f8f0ff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Auto-updater events
autoUpdater.on('update-available', () => {
  if (mainWindow) mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('update-downloaded');
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// Content Security Policy — file:// needs 'self' to cover local bundle resources
app.on('web-contents-created', (_, contents) => {
  contents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' file: https://pastel-chat.onrender.com wss://pastel-chat.onrender.com; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' file: https://accounts.google.com; " +
          "style-src 'self' 'unsafe-inline' file: https://fonts.googleapis.com; " +
          "font-src 'self' file: data: https://fonts.gstatic.com; " +
          "img-src 'self' file: data: blob: https:; " +
          "media-src 'self' file: blob:; " +
          "connect-src 'self' file: https://pastel-chat.onrender.com wss://pastel-chat.onrender.com " +
          "https://accounts.google.com https://api.giphy.com https://media.giphy.com;"
        ],
      },
    });
  });
});
