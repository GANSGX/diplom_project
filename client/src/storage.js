// storage.js - Paranoid Security Local Storage (Universal ES6)

// Определяем окружение
const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions?.node;

// Универсальный crypto API
const getCrypto = () => {
  if (isBrowser) {
    return window.crypto;
  } else if (isNode) {
    return globalThis.crypto || require('crypto').webcrypto;
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

  async storeContact(username, publicKeyBundle) {
    const contactData = {
      username,
      publicKey: publicKeyBundle,
      addedAt: Date.now()
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

  destroy() {
    this.masterKey = null;
    console.log('Мастер-ключ стерт из памяти');
  }
}

export { ParanoidStorage };
export default ParanoidStorage;