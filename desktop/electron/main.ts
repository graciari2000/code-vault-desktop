import { app, BrowserWindow } from 'electron';
import * as path from 'path';

const isDev = !app.isPackaged;

// Your Vercel frontend URL
const FRONTEND_URL = 'https://code-vault-desktop.vercel.app';

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true // Important for loading external URLs
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Load from your deployed Vercel frontend
    mainWindow.loadURL(FRONTEND_URL);
    
    // Optional: Prevent navigation to other URLs
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      if (!navigationUrl.startsWith(FRONTEND_URL)) {
        event.preventDefault();
      }
    });
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});