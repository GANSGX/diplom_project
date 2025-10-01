// file-helper.js - Universal File Operations (Node.js / Electron / Browser)

// Определяем окружение
const isNode = typeof process !== 'undefined' && process.versions?.node && typeof window === 'undefined';
const isElectron = typeof window !== 'undefined' && window.process?.type === 'renderer';
const isBrowser = typeof window !== 'undefined' && !isElectron;

class FileHelper {
  constructor() {
    this.environment = isNode ? 'node' : isElectron ? 'electron' : 'browser';
  }

  /**
   * Сохранить файл ключа
   * @param {string} username - имя пользователя
   * @param {string} encryptedData - зашифрованные данные (JSON string)
   * @returns {Promise<string>} путь к сохранённому файлу
   */
  async saveIdentityFile(username, encryptedData) {
    const filename = `${username}_identity.enc`;

    if (this.environment === 'node') {
      return await this._saveNode(filename, encryptedData);
    } else if (this.environment === 'electron') {
      return await this._saveElectron(filename, encryptedData);
    } else {
      return await this._saveBrowser(filename, encryptedData);
    }
  }

  /**
   * Загрузить файл ключа
   * @returns {Promise<string>} содержимое файла (JSON string)
   */
  async loadIdentityFile() {
    if (this.environment === 'node') {
      throw new Error('В Node.js используйте loadIdentityFileFromPath(filePath)');
    } else if (this.environment === 'electron') {
      return await this._loadElectron();
    } else {
      return await this._loadBrowser();
    }
  }

  /**
   * Загрузить файл по пути (только Node.js)
   */
  async loadIdentityFileFromPath(filePath) {
    if (this.environment !== 'node') {
      throw new Error('Этот метод доступен только в Node.js');
    }
    const fs = await import('fs/promises');
    return await fs.readFile(filePath, 'utf8');
  }

  // === Node.js ===
  async _saveNode(filename, data) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(process.cwd(), filename);
    await fs.writeFile(filePath, data, 'utf8');
    console.log(`Файл сохранён: ${filePath}`);
    return filePath;
  }

  // === Electron ===
  async _saveElectron(filename, data) {
    const { ipcRenderer } = window.require('electron');
    
    // Показываем диалог сохранения
    const result = await ipcRenderer.invoke('save-dialog', {
      title: 'Сохранить файл ключа',
      defaultPath: filename,
      filters: [
        { name: 'Encrypted Key', extensions: ['enc'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      throw new Error('Сохранение отменено');
    }

    // Сохраняем файл
    await ipcRenderer.invoke('write-file', result.filePath, data);
    console.log(`Файл сохранён: ${result.filePath}`);
    return result.filePath;
  }

  async _loadElectron() {
    const { ipcRenderer } = window.require('electron');
    
    // Показываем диалог открытия
    const result = await ipcRenderer.invoke('open-dialog', {
      title: 'Выберите файл ключа',
      filters: [
        { name: 'Encrypted Key', extensions: ['enc'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      throw new Error('Выбор файла отменён');
    }

    // Читаем файл
    const data = await ipcRenderer.invoke('read-file', result.filePaths[0]);
    console.log(`Файл загружен: ${result.filePaths[0]}`);
    return data;
  }

  // === Browser ===
  async _saveBrowser(filename, data) {
    // Создаём Blob и скачиваем через <a>
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`Файл скачан: ${filename}`);
    return filename;
  }

  async _loadBrowser() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.enc';
      
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) {
          reject(new Error('Файл не выбран'));
          return;
        }
        
        try {
          const text = await file.text();
          console.log(`Файл загружен: ${file.name}`);
          resolve(text);
        } catch (error) {
          reject(error);
        }
      };
      
      input.oncancel = () => {
        reject(new Error('Выбор файла отменён'));
      };
      
      input.click();
    });
  }
}

// Экспортируем singleton
const fileHelper = new FileHelper();

export { FileHelper, fileHelper };
export default fileHelper;