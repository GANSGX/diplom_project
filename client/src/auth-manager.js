// auth-manager.js - Universal ES6
import { ParanoidStorage } from './storage.js';
import { 
  generateSignalIdentity, 
  exportSignalIdentity, 
  importSignalIdentity,
  getPublicBundle 
} from './crypto.js';

const isBrowser = typeof window !== 'undefined';
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

class AuthManager {
  constructor() {
    this.storage = null;
    this.currentUser = null;
    this.serverUrl = 'http://localhost:3001';
    this.currentIdentity = null;
  }

  // 🔒 Сохранение сессии (НЕ БЕЗОПАСНО для продакшена!)
  saveSession(username, encryptedKey, masterPassword) {
    if (!isBrowser) return;
    
    // ВНИМАНИЕ: хранение мастер-пароля в localStorage НЕ БЕЗОПАСНО
    // Только для разработки! В продакшене используйте session tokens
    const sessionData = {
      username,
      encryptedKey,
      masterPassword, // ⚠️ НЕБЕЗОПАСНО
      timestamp: Date.now()
    };
    
    localStorage.setItem('securechat_session', JSON.stringify(sessionData));
  }

  getSession() {
    if (!isBrowser) return null;
    
    const sessionData = localStorage.getItem('securechat_session');
    if (!sessionData) return null;
    
    try {
      const parsed = JSON.parse(sessionData);
      
      // Сессия действительна 7 дней
      const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.timestamp > MAX_AGE) {
        this.clearSession();
        return null;
      }
      
      return parsed;
    } catch {
      return null;
    }
  }

  clearSession() {
    if (!isBrowser) return;
    localStorage.removeItem('securechat_session');
  }

  async register(username, masterPassword) {
    try {
      const signalIdentity = await generateSignalIdentity();
      this.currentIdentity = signalIdentity;
      
      if (isBrowser) {
        this.storage = new ParanoidStorage();
        await this.storage.init(masterPassword);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const identityData = { username, signalIdentity };
        await this.storage.storeUserIdentity(identityData);
      }
      
      const publicBundle = {
        identityKey: signalIdentity.identityKey,
        registrationId: signalIdentity.registrationId,
        signedPreKey: signalIdentity.signedPreKey,
        preKeys: signalIdentity.preKeys
      };
      
      const response = await fetch(`${this.serverUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, publicBundle })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }
      
      const encryptedKey = await exportSignalIdentity(masterPassword);
      
      this.currentUser = username;
      
      // Сохраняем сессию
      this.saveSession(username, encryptedKey, masterPassword);
      
      console.log(`Пользователь ${username} зарегистрирован`);
      
      return { 
        success: true, 
        username,
        encryptedKey
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async login(username, masterPassword, encryptedKeyContent) {
    try {
      const signalIdentity = await importSignalIdentity(encryptedKeyContent, masterPassword);
      this.currentIdentity = signalIdentity;
      
      const response = await fetch(`${this.serverUrl}/bundle/${username}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Пользователь не найден на сервере');
        }
        throw new Error('Ошибка связи с сервером');
      }
      
      const serverBundle = await response.json();
      
      const keysMatch = JSON.stringify(signalIdentity.identityKey) === JSON.stringify(serverBundle.identityKey);
      
      if (!keysMatch) {
        throw new Error('Ключи не совпадают! Вы используете неправильный файл ключа для этого аккаунта.');
      }
      
      if (isBrowser) {
        this.storage = new ParanoidStorage();
        await this.storage.init(masterPassword);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const identityToStore = { username, signalIdentity };
        await this.storage.storeUserIdentity(identityToStore);
      }
      
      this.currentUser = username;
      
      // Сохраняем сессию
      this.saveSession(username, encryptedKeyContent, masterPassword);
      
      console.log(`Пользователь ${username} успешно вошел`);
      
      return { success: true, username };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async restoreSession() {
    const session = this.getSession();
    if (!session) return null;
    
    try {
      await this.login(session.username, session.masterPassword, session.encryptedKey);
      console.log('Сессия восстановлена');
      return session.username;
    } catch (error) {
      console.error('Failed to restore session:', error);
      this.clearSession();
      return null;
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
        contact = { publicKey: searchResult.publicBundle };
      }

      let recipientBundle = contact.publicKey;
      
      if (!recipientBundle || !recipientBundle.identityKey || recipientBundle.identityKey.length === 0) {
        console.error('Invalid recipient bundle:', recipientBundle);
        throw new Error('У получателя отсутствует валидный публичный ключ');
      }

      const encrypted = await this._encryptMessage(plaintext, recipientBundle);

      const response = await fetch(`${this.serverUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: this.currentUser,
          recipient,
          message: encrypted
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Не удалось отправить');
      }

      await this.storage.storeMessage(recipient, { body: plaintext }, true);

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
        return [];
      }

      const response = await fetch(`${this.serverUrl}/fetch/${this.currentUser}`);

      if (!response.ok) {
        console.error('Failed to fetch messages:', response.status);
        return [];
      }

      const messages = await response.json();
      
      if (!messages.length) {
        return [];
      }

      const decrypted = [];

      for (const msg of messages) {
        try {
          const plaintext = await this._decryptMessage(msg.message);
          
          await this.storage.storeMessage(msg.sender || 'unknown', { body: plaintext }, false);

          decrypted.push({
            messageId: msg.messageId,
            sender: msg.sender,
            text: plaintext,
            timestamp: msg.message.timestamp
          });

          await this._ackMessage(msg.messageId);

        } catch (err) {
          console.error('Не удалось расшифровать сообщение:', err);
        }
      }

      if (decrypted.length > 0) {
        console.log(`Получено ${decrypted.length} сообщений`);
      }
      
      return decrypted;

    } catch (error) {
      return [];
    }
  }

  async _ackMessage(messageId) {
    try {
      await fetch(`${this.serverUrl}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });
    } catch (error) {
      // Игнорируем ошибки ack
    }
  }

  async _encryptMessage(plaintext, recipientPublicBundle) {
    try {
      if (!recipientPublicBundle.identityKey || recipientPublicBundle.identityKey.length === 0) {
        throw new Error('Recipient has invalid or empty identity key');
      }
      
      const crypto = getCrypto();
      
      const ephemeralKeyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
      );

      const ephemeralPublicRaw = await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey);

      const recipientPublicKey = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(recipientPublicBundle.identityKey),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
      );

      const sharedSecret = await crypto.subtle.deriveKey(
        { name: "ECDH", public: recipientPublicKey },
        ephemeralKeyPair.privateKey,
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

      const ephemeralPublic = await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey);

      return {
        type: 1,
        body: Array.from(new Uint8Array(encrypted)),
        ephemeralKey: Array.from(new Uint8Array(ephemeralPublic)),
        iv: Array.from(iv),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  async _decryptMessage(encryptedMsg) {
    try {
      const crypto = getCrypto();
      
      const identity = this.currentIdentity || await this.storage.getUserIdentity();
      
      if (!identity || !identity.identityKey) {
        const storedIdentity = await this.storage.getUserIdentity();
        if (!storedIdentity || !storedIdentity.signalIdentity) {
          throw new Error('Identity not found');
        }
        this.currentIdentity = storedIdentity.signalIdentity;
      }
      
      const signalIdentity = this.currentIdentity.privateKey ? this.currentIdentity : this.currentIdentity.signalIdentity;
      
      const ourPrivateKey = await crypto.subtle.importKey(
        "pkcs8",
        new Uint8Array(signalIdentity.privateKey),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveKey", "deriveBits"]
      );

      const senderEphemeralPublic = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(encryptedMsg.ephemeralKey),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
      );

      const sharedSecret = await crypto.subtle.deriveKey(
        { name: "ECDH", public: senderEphemeralPublic },
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
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  logout() {
    if (this.storage) this.storage.destroy();
    this.currentUser = null;
    this.currentIdentity = null;
    this.clearSession();
    console.log('Вышли');
  }
}

export { AuthManager };
export default AuthManager;