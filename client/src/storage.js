// storage.js - Paranoid Security Local Storage (Universal ES6)

const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions?.node;

const getCrypto = () => {
  if (isBrowser) {
    return window.crypto;
  } else if (isNode) {
    try {
      const nodeCrypto = require('crypto');
      return nodeCrypto.webcrypto || nodeCrypto;
    } catch {
      return null;
    }
  }
  throw new Error('Crypto API not available');
};

class ParanoidStorage {
  constructor() {
    this.db = null;
    this.dbName = 'SecureMessengerDB';
    this.version = 1;
    this.masterKey = null;
  }

  async init(masterPassword) {
    if (!isBrowser) {
      throw new Error('ParanoidStorage requires IndexedDB (browser environment)');
    }

    await this._deriveMasterKey(masterPassword);
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject('IndexedDB недоступен');
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('user_data')) {
          db.createObjectStore('user_data', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('contacts')) {
          db.createObjectStore('contacts', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          messageStore.createIndex('chatId', 'chatId', { unique: false });
        }
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('ParanoidStorage инициализирован');
        resolve(true);
      };
    });
  }

  async _deriveMasterKey(password) {
    const crypto = getCrypto();
    const salt = new TextEncoder().encode('SecureMessenger_Salt_v1');
    
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    this.masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 200000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async _encrypt(data) {
    if (!this.masterKey) throw new Error('Мастер-ключ не инициализирован');
    
    const crypto = getCrypto();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const jsonData = JSON.stringify(data);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.masterKey,
      new TextEncoder().encode(jsonData)
    );

    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
      timestamp: Date.now()
    };
  }

  async _decrypt(encryptedObj) {
    if (!this.masterKey) throw new Error('Мастер-ключ не инициализирован');
    
    const crypto = getCrypto();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encryptedObj.iv) },
      this.masterKey,
      new Uint8Array(encryptedObj.data)
    );

    const jsonString = new TextDecoder().decode(decrypted);
    return JSON.parse(jsonString);
  }

  async storeUserIdentity(identityData) {
    const encrypted = await this._encrypt(identityData);

    const transaction = this.db.transaction(['user_data'], 'readwrite');
    const store = transaction.objectStore('user_data');

    return new Promise((resolve, reject) => {
      const request = store.put({
        id: 'signal_identity',
        encrypted: encrypted
      });
      
      request.onsuccess = () => {
        console.log('Identity сохранен (зашифрован)');
        resolve(true);
      };
      request.onerror = () => reject('Не удалось сохранить identity');
    });
  }

  async getUserIdentity() {
    const transaction = this.db.transaction(['user_data'], 'readonly');
    const store = transaction.objectStore('user_data');

    return new Promise(async (resolve, reject) => {
      const request = store.get('signal_identity');
      
      request.onsuccess = async () => {
        if (!request.result) {
          resolve(null);
          return;
        }

        try {
          const decrypted = await this._decrypt(request.result.encrypted);
          console.log('Identity восстановлен');
          resolve(decrypted);
        } catch (error) {
          reject('Не удалось расшифровать identity');
        }
      };
      
      request.onerror = () => reject('Не удалось получить identity');
    });
  }

  async storeContact(username, publicKeyBundle, isDeleted = false) {
    const contactData = {
      username,
      publicKey: publicKeyBundle,
      addedAt: Date.now(),
      isDeleted: isDeleted  // Флаг удаления
    };

    const encrypted = await this._encrypt(contactData);

    const transaction = this.db.transaction(['contacts'], 'readwrite');
    const store = transaction.objectStore('contacts');

    return new Promise((resolve, reject) => {
      const request = store.put({
        id: username,
        encrypted: encrypted
      });
      
      request.onsuccess = () => {
        console.log(`Контакт ${username} сохранен`);
        resolve(true);
      };
      request.onerror = () => reject('Не удалось сохранить контакт');
    });
  }

  async getContact(username) {
    const transaction = this.db.transaction(['contacts'], 'readonly');
    const store = transaction.objectStore('contacts');

    return new Promise(async (resolve, reject) => {
      const request = store.get(username);
      
      request.onsuccess = async () => {
        if (!request.result) {
          resolve(null);
          return;
        }

        try {
          const decrypted = await this._decrypt(request.result.encrypted);
          resolve(decrypted);
        } catch (error) {
          reject('Не удалось расшифровать контакт');
        }
      };
      
      request.onerror = () => reject('Не удалось получить контакт');
    });
  }

  async getAllContacts() {
    const transaction = this.db.transaction(['contacts'], 'readonly');
    const store = transaction.objectStore('contacts');

    return new Promise(async (resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = async () => {
        try {
          const contacts = [];
          
          for (const encryptedContact of request.result) {
            const decrypted = await this._decrypt(encryptedContact.encrypted);
            
            // Пропускаем удалённые контакты
            if (!decrypted.isDeleted) {
              contacts.push(decrypted);
            }
          }
          
          console.log(`Загружено ${contacts.length} контактов из хранилища`);
          resolve(contacts);
        } catch (error) {
          reject('Не удалось расшифровать контакты');
        }
      };
      
      request.onerror = () => reject('Не удалось получить контакты');
    });
  }

  // Пометить контакт как удалённый (soft delete)
  async markContactAsDeleted(username) {
    const contact = await this.getContact(username);
    if (!contact) {
      console.log(`Контакт ${username} не найден для удаления`);
      return false;
    }
    
    await this.storeContact(username, contact.publicKey, true);
    console.log(`Контакт ${username} помечен как удалённый`);
    return true;
  }

  // Полное удаление контакта из БД (не используется пока)
  async deleteContact(username) {
    const transaction = this.db.transaction(['contacts'], 'readwrite');
    const store = transaction.objectStore('contacts');

    return new Promise((resolve, reject) => {
      const request = store.delete(username);
      
      request.onsuccess = () => {
        console.log(`Контакт ${username} удалён из хранилища`);
        resolve(true);
      };
      request.onerror = () => reject('Не удалось удалить контакт');
    });
  }

  async storeMessage(chatWith, messageData, isOutgoing) {
    const msgData = {
      chatWith,
      message: messageData,
      isOutgoing,
      timestamp: Date.now()
    };

    const encrypted = await this._encrypt(msgData);

    const transaction = this.db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');

    return new Promise((resolve, reject) => {
      const request = store.add({
        chatId: chatWith,
        encrypted: encrypted
      });
      
      request.onsuccess = () => {
        console.log(`Сообщение с ${chatWith} сохранено`);
        resolve(request.result);
      };
      request.onerror = () => reject('Не удалось сохранить сообщение');
    });
  }

  async getChatHistory(username, limit = 50) {
    const transaction = this.db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const index = store.index('chatId');

    return new Promise(async (resolve, reject) => {
      const request = index.getAll(username);
      
      request.onsuccess = async () => {
        try {
          const messages = [];
          
          for (const encryptedMsg of request.result) {
            const decrypted = await this._decrypt(encryptedMsg.encrypted);
            messages.push(decrypted);
          }

          const sorted = messages
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-limit);

          console.log(`История с ${username}: ${sorted.length} сообщений`);
          resolve(sorted);
        } catch (error) {
          reject('Не удалось расшифровать историю');
        }
      };
      
      request.onerror = () => reject('Не удалось получить историю');
    });
  }

  async clearChatHistory(username) {
    const transaction = this.db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');
    const index = store.index('chatId');

    return new Promise((resolve, reject) => {
      const request = index.getAllKeys(username);
      
      request.onsuccess = () => {
        const keys = request.result;
        let deletedCount = 0;
        
        keys.forEach(key => {
          store.delete(key);
          deletedCount++;
        });
        
        console.log(`Удалено ${deletedCount} сообщений с ${username}`);
        resolve(deletedCount);
      };
      
      request.onerror = () => reject('Не удалось очистить историю');
    });
  }

  destroy() {
    this.masterKey = null;
    console.log('Мастер-ключ стерт из памяти');
  }
}

export { ParanoidStorage };
export default ParanoidStorage;