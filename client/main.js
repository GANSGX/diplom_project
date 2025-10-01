import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== РЕГИСТРИРУЕМ IPC HANDLERS СРАЗУ =====
// Диалог сохранения файла
ipcMain.handle('save-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return await dialog.showSaveDialog(win, options);
});

// Диалог открытия файла
ipcMain.handle('open-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return await dialog.showOpenDialog(win, options);
});

// Запись файла
ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    await fs.writeFile(filePath, data, 'utf8');
    return { success: true, filePath };
  } catch (error) {
    console.error('Write file error:', error);
    throw error;
  }
});

// Чтение файла
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return data;
  } catch (error) {
    console.error('Read file error:', error);
    throw error;
  }
});

// ===== СОЗДАНИЕ ОКНА =====
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });
  
  win.loadURL('http://localhost:3000');
  win.webContents.openDevTools();
  
  win.webContents.on('console-message', (event, level, message) => {
    console.log(`[${level}] ${message}`);
  });

  return win;
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});