const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false  // Отключаем веб-безопасность для тестов
    }
  });
  
  win.loadURL('http://localhost:3000');
  
  // Открываем DevTools автоматически
  win.webContents.openDevTools();
  
  // Включаем логи в консоль Electron
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[${level}] ${message}`);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});