// auth-manager.js - Universal ES6
import { ParanoidStorage } from './storage.js';
import { 
  generateSignalIdentity, 
  exportSignalIdentity, 
  importSignalIdentity,
  getPublicBundle 
} from './crypto.js';

// Определяем окружение
const isBrowser = typeof window !== 'undefined';
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

class AuthManager {
  constructor() {
    this.storage = null;
    this.currentUser = null;
    this.serverUrl = 'http://localhost:3001';
  }

  /**
   * Регистрация с сохранением ключа в файл
   */
  async register(username, masterPassword) {
    try {
      // Генерируем Signal identity
      const signalIdentity = await generateSignalIdentity();
      
      // Инициализируем storage (только для браузера)
      if (isBrowser) {
        this.storage = new ParanoidStorage();
        await this.storage.init(masterPassword);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const identityData = { username, signalIdentity };
        await this.storage.storeUserIdentity(identityData);
      }
      
      // Получаем публичный bundle для сервера
      const publicBundle = getPublicBundle();
      
      // Регистрируем на сервере
      const response = await fetch(`${this.serverUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, publicBundle })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }
      
      // Экспортируем ключ в зашифрованный файл
      const encryptedKey = await exportSignalIdentity(masterPassword);
      
      this.currentUser = username;
      console.log(`Пользователь ${username} зарегистрирован`);
      
      return { 
        success: true, 
        username,
        encryptedKey // Возвращаем для сохранения в файл
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Логин с загрузкой ключа из файла
   */
  async login(username, masterPassword, encryptedKeyContent) {
    try {
      // Импортируем identity из файла
      await importSignalIdentity(encryptedKeyContent, masterPassword);
      
      // Инициализируем storage (только для браузера)
      if (isBrowser) {
        this.storage = new ParanoidStorage();
        await this.storage.init(masterPassword);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Проверяем identity в storage
        const identityData = await this.storage.getUserIdentity();
        
        if (!identityData) {
          console.warn('Identity не найден в storage, но ключ из файла загружен');
        } else if (identityData.username !== username) {
          throw new Error(`Неверный username`);
        }
      }
      
      this.currentUser = username;
      console.log(`Пользователь ${username} вошел`);
      
      return { success: true, username };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async searchUser(username) {
    try {
      const response = await fetch(`${this.serverUrl}/bundle/${username}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return { found: false };
        }
        throw new Error('Search failed');
      }
      
      const publicBundle = await response.json();
      
      if (this.storage) {
        await this.storage.storeContact(username, publicBundle);
      }
      
      console.log(`Пользователь ${username} найден`);
      
      return { found: true, publicBundle };
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async sendMessage(recipient, plaintext) {
    try {
      if (!this.storage) {
        throw new Error('Не авторизован');
      }

      let contact = await this.storage.getContact(recipient);
      
      if (!contact) {
        const searchResult = await this.searchUser(recipient);
        if (!searchResult.found) {
          throw new Error('Получатель не найден');
        }
        contact = searchResult.publicBundle;
      }

      const encrypted = await this._encryptMessage(plaintext, contact);

      const response = await fetch(`${this.serverUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient,
          message: {
            type: encrypted.type,
            body: encrypted.body,
            timestamp: Date.now(),
            ephemeralKey: encrypted.ephemeralKey,
            iv: encrypted.iv
          }
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Не удалось отправить');
      }

      await this.storage.storeMessage(recipient, encrypted, true);

      console.log(`Сообщение отправлено ${recipient}`);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      console.error('Send error:', error);
      throw error;
    }
  }

  async fetchMessages() {
    try {
      if (!this.currentUser || !this.storage) {
        throw new Error('Не авторизован');
      }

      const response = await fetch(`${this.serverUrl}/fetch/${this.currentUser}`);

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        throw new Error('Не удалось получить сообщения');
      }

      const messages = await response.json();
      const decrypted = [];

      for (const msg of messages) {
        try {
          const plaintext = await this._decryptMessage(msg.message);
          
          await this.storage.storeMessage('unknown', msg.message, false);

          decrypted.push({
            messageId: msg.messageId,
            text: plaintext,
            timestamp: msg.message.timestamp
          });

          await this._ackMessage(msg.messageId);

        } catch (err) {
          console.error('Не удалось расшифровать сообщение:', err);
        }
      }

      console.log(`Получено ${decrypted.length} сообщений`);
      return decrypted;

    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }

  async _ackMessage(messageId) {
    await fetch(`${this.serverUrl}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId })
    });
  }

  async _encryptMessage(plaintext, recipientPublicBundle) {
    const crypto = getCrypto();
    
    const ephemeralKey = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );

    const recipientKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(recipientPublicBundle.identityKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    const sharedSecret = await crypto.subtle.deriveKey(
      { name: "ECDH", public: recipientKey },
      ephemeralKey.privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      sharedSecret,
      new TextEncoder().encode(plaintext)
    );

    const ephemeralPublic = await crypto.subtle.exportKey("raw", ephemeralKey.publicKey);

    return {
      type: 1,
      body: Array.from(new Uint8Array(encrypted)),
      ephemeralKey: Array.from(new Uint8Array(ephemeralPublic)),
      iv: Array.from(iv)
    };
  }

  async _decryptMessage(encryptedMsg) {
    const crypto = getCrypto();
    const identity = await this.storage.getUserIdentity();
    
    const ourPrivateKey = await crypto.subtle.importKey(
      "pkcs8",
      new Uint8Array(identity.signalIdentity.privateKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey"]
    );

    const senderEphemeral = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(encryptedMsg.ephemeralKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    const sharedSecret = await crypto.subtle.deriveKey(
      { name: "ECDH", public: senderEphemeral },
      ourPrivateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(encryptedMsg.iv) },
      sharedSecret,
      new Uint8Array(encryptedMsg.body)
    );

    return new TextDecoder().decode(decrypted);
  }

  logout() {
    if (this.storage) this.storage.destroy();
    this.currentUser = null;
    console.log('Вышли');
  }
}

export { AuthManager };
export default AuthManager;