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

  async _generateSignalKeys() {
    const keyPair = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
    
    const publicKey = await window.crypto.subtle.exportKey("raw", keyPair.publicKey);
    
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
      }]
    };
  }

  logout() {
    if (this.storage) this.storage.destroy();
    this.currentUser = null;
    console.log('Вышли');
  }
}

module.exports = { AuthManager };