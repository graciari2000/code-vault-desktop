import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const isDev = !app.isPackaged;

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Load from the correct path
    const rendererDistPath = path.join(__dirname, '../../renderer/dist');
    
    if (fs.existsSync(path.join(rendererDistPath, 'index.html'))) {
      mainWindow.loadFile(path.join(rendererDistPath, 'index.html'));
    } else {
      // Fallback: Try to find the files
      const possiblePaths = [
        path.join(process.resourcesPath, 'renderer/dist/index.html'),
        path.join(__dirname, '../renderer/dist/index.html'),
        path.join(__dirname, './renderer/dist/index.html')
      ];

      let loaded = false;
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          console.log('Loading from:', filePath);
          mainWindow.loadFile(filePath);
          loaded = true;
          break;
        }
      }

      if (!loaded) {
        mainWindow.loadURL(`data:text/html;charset=utf-8,
          <html>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
              <h1>Code Vault</h1>
              <p style="color: red;">Error: Frontend files not found</p>
              <p>Files looked for in:</p>
              <ul style="text-align: left; display: inline-block;">
                ${possiblePaths.map(p => `<li>${p}</li>`).join('')}
              </ul>
            </body>
          </html>
        `);
      }
    }
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