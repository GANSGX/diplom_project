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
    this.currentIdentity = null; // ДОБАВЛЕНО: хранить текущий identity
  }

  async register(username, masterPassword) {
    try {
      // Генерируем НОВЫЙ identity только при регистрации
      const signalIdentity = await generateSignalIdentity();
      this.currentIdentity = signalIdentity; // Сохраняем в памяти
      
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
      
      // Отправляем на сервер только при регистрации
      const response = await fetch(`${this.serverUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, publicBundle })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }
      
      // Экспортируем для сохранения в файл
      const encryptedKey = await exportSignalIdentity(masterPassword);
      
      this.currentUser = username;
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
      // ИМПОРТИРУЕМ существующий identity из файла
      const signalIdentity = await importSignalIdentity(encryptedKeyContent, masterPassword);
      this.currentIdentity = signalIdentity; // Сохраняем в памяти
      
      console.log('Loaded identity key (first 10):', signalIdentity.identityKey.slice(0, 10));
      
      // ПРОВЕРЯЕМ что пользователь существует на сервере
      const response = await fetch(`${this.serverUrl}/bundle/${username}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Пользователь не найден на сервере');
        }
        throw new Error('Ошибка связи с сервером');
      }
      
      const serverBundle = await response.json();
      console.log('Server identity key (first 10):', serverBundle.identityKey.slice(0, 10));
      
      // ПРОВЕРКА: ключи должны совпадать
      const keysMatch = JSON.stringify(signalIdentity.identityKey) === JSON.stringify(serverBundle.identityKey);
      console.log('Identity keys match:', keysMatch);
      
      if (!keysMatch) {
        throw new Error('Ключи не совпадают! Вы используете неправильный файл ключа для этого аккаунта.');
      }
      
      console.log('Пользователь найден на сервере');
      
      if (isBrowser) {
        this.storage = new ParanoidStorage();
        await this.storage.init(masterPassword);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const identityToStore = { username, signalIdentity };
        await this.storage.storeUserIdentity(identityToStore);
        console.log('Identity сохранен в IndexedDB');
      }
      
      this.currentUser = username;
      console.log(`Пользователь ${username} успешно вошел`);
      
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
      
      console.log('=== ENCRYPT START ===');
      console.log('Recipient identity key (first 10):', recipientPublicBundle.identityKey.slice(0, 10));
      console.log('Recipient identity key length:', recipientPublicBundle.identityKey.length);
      
      const crypto = getCrypto();
      
      const ephemeralKeyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
      );

      const ephemeralPublicRaw = await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey);
      console.log('Ephemeral public key (first 10):', Array.from(new Uint8Array(ephemeralPublicRaw)).slice(0, 10));
      console.log('Ephemeral public key length:', ephemeralPublicRaw.byteLength);

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

      console.log('=== ENCRYPT END ===');

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
      console.log('=== DECRYPT START ===');
      console.log('Encrypted message ephemeral key (first 10):', encryptedMsg.ephemeralKey.slice(0, 10));
      console.log('Encrypted message ephemeral key length:', encryptedMsg.ephemeralKey.length);
      
      const crypto = getCrypto();
      
      // ИСПОЛЬЗУЕМ currentIdentity вместо загрузки из storage
      const identity = this.currentIdentity || await this.storage.getUserIdentity();
      
      if (!identity || !identity.identityKey) {
        // Если currentIdentity нет, пробуем из storage
        const storedIdentity = await this.storage.getUserIdentity();
        if (!storedIdentity || !storedIdentity.signalIdentity) {
          throw new Error('Identity not found');
        }
        this.currentIdentity = storedIdentity.signalIdentity;
      }
      
      const signalIdentity = this.currentIdentity.privateKey ? this.currentIdentity : this.currentIdentity.signalIdentity;
      
      console.log('Our identity key (first 10):', signalIdentity.identityKey.slice(0, 10));
      console.log('Our private key (first 10):', signalIdentity.privateKey.slice(0, 10));
      console.log('Our private key length:', signalIdentity.privateKey.length);
      
      const ourPrivateKey = await crypto.subtle.importKey(
        "pkcs8",
        new Uint8Array(signalIdentity.privateKey),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveKey", "deriveBits"]
      );

      console.log('Our private key imported successfully');

      const senderEphemeralPublic = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(encryptedMsg.ephemeralKey),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
      );

      console.log('Sender ephemeral public key imported successfully');

      const sharedSecret = await crypto.subtle.deriveKey(
        { name: "ECDH", public: senderEphemeralPublic },
        ourPrivateKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      console.log('Shared secret derived');

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(encryptedMsg.iv) },
        sharedSecret,
        new Uint8Array(encryptedMsg.body)
      );

      console.log('=== DECRYPT END ===');

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  logout() {
    if (this.storage) this.storage.destroy();
    this.currentUser = null;
    this.currentIdentity = null; // Очищаем identity
    console.log('Вышли');
  }
}

export { AuthManager };
export default AuthManager;