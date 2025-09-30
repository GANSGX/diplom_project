// auth-manager.js
const { ParanoidStorage } = require('./storage.js');

class AuthManager {
  constructor() {
    this.storage = null;
    this.currentUser = null;
    this.serverUrl = 'http://localhost:3001';
  }

  async register(username, masterPassword) {
    try {
      const signalIdentity = await this._generateSignalKeys();
      
      this.storage = new ParanoidStorage();
      await this.storage.init(masterPassword);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const identityData = { username, signalIdentity };
      await this.storage.storeUserIdentity(identityData);
      
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
      
      this.currentUser = username;
      console.log(`Пользователь ${username} зарегистрирован`);
      
      return { success: true, username };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async login(username, masterPassword) {
    try {
      this.storage = new ParanoidStorage();
      await this.storage.init(masterPassword);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const identityData = await this.storage.getUserIdentity();
      
      if (!identityData) {
        throw new Error('Identity не найден');
      }
      
      if (identityData.username !== username) {
        throw new Error(`Неверный username`);
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
      await this.storage.storeContact(username, publicBundle);
      
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
    const ephemeralKey = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );

    const recipientKey = await window.crypto.subtle.importKey(
      "raw",
      new Uint8Array(recipientPublicBundle.identityKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    const sharedSecret = await window.crypto.subtle.deriveKey(
      { name: "ECDH", public: recipientKey },
      ephemeralKey.privateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      sharedSecret,
      new TextEncoder().encode(plaintext)
    );

    const ephemeralPublic = await window.crypto.subtle.exportKey("raw", ephemeralKey.publicKey);

    return {
      type: 1,
      body: Array.from(new Uint8Array(encrypted)),
      ephemeralKey: Array.from(new Uint8Array(ephemeralPublic)),
      iv: Array.from(iv)
    };
  }

  async _decryptMessage(encryptedMsg) {
    const identity = await this.storage.getUserIdentity();
    
    const ourPrivateKey = await window.crypto.subtle.importKey(
      "pkcs8",
      new Uint8Array(identity.signalIdentity.privateKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey"]
    );

    const senderEphemeral = await window.crypto.subtle.importKey(
      "raw",
      new Uint8Array(encryptedMsg.ephemeralKey),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    const sharedSecret = await window.crypto.subtle.deriveKey(
      { name: "ECDH", public: senderEphemeral },
      ourPrivateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(encryptedMsg.iv) },
      sharedSecret,
      new Uint8Array(encryptedMsg.body)
    );

    return new TextDecoder().decode(decrypted);
  }

  async _generateSignalKeys() {
    const keyPair = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
    
    const publicKey = await window.crypto.subtle.exportKey("raw", keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    
    return {
      identityKey: Array.from(new Uint8Array(publicKey)),
      registrationId: Math.floor(Math.random() * 16383) + 1,
      signedPreKey: {
        keyId: 1,
        publicKey: Array.from(new Uint8Array(publicKey).slice(0, 33)),
        signature: Array.from(new Uint8Array(64))
      },
      preKeys: [{
        keyId: 2,
        publicKey: Array.from(new Uint8Array(publicKey).slice(0, 33))
      }],
      privateKey: Array.from(new Uint8Array(privateKey))
    };
  }

  logout() {
    if (this.storage) this.storage.destroy();
    this.currentUser = null;
    console.log('Вышли');
  }
}

module.exports = { AuthManager };