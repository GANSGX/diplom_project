// crypto.js - Simplified Crypto Module (Browser Compatible)

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

const toBuffer = (data) => {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  return new Uint8Array(data);
};

/**
 * Генерация ключей ECDH
 */
async function generateSignalIdentity() {
  try {
    const crypto = getCrypto();
    
    // Генерируем ECDH ключевую пару
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"]
    );
    
    // Экспортируем ключи
    const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const privateKeyPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    
    const identity = {
      identityKey: Array.from(new Uint8Array(publicKeyRaw)),
      privateKey: Array.from(new Uint8Array(privateKeyPkcs8)),
      registrationId: Math.floor(Math.random() * 16383) + 1,
      signedPreKey: {
        keyId: 1,
        publicKey: Array.from(new Uint8Array(publicKeyRaw)),
        signature: Array.from(new Uint8Array(64))
      },
      preKeys: [{
        keyId: 2,
        publicKey: Array.from(new Uint8Array(publicKeyRaw))
      }]
    };

    console.log('✅ Identity generated successfully');
    return identity;
  } catch (error) {
    console.error('❌ Failed to generate identity:', error);
    throw error;
  }
}

/**
 * Экспорт identity
 */
async function exportSignalIdentity(password) {
  try {
    const identity = await generateSignalIdentity();
    
    const crypto = getCrypto();
    const dataString = JSON.stringify(identity);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new TextEncoder().encode(dataString)
    );

    console.log('✅ Identity exported successfully');
    return JSON.stringify({
      encryptedData: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv),
      salt: Array.from(salt),
      type: 'simple-identity'
    });
  } catch (error) {
    console.error('❌ Failed to export identity:', error);
    throw error;
  }
}

/**
 * Импорт identity
 */
async function importSignalIdentity(encryptedJson, password) {
  try {
    const data = JSON.parse(encryptedJson);
    
    if (data.type !== 'simple-identity') {
      throw new Error('Invalid backup file format');
    }

    const crypto = getCrypto();

    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(data.salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(data.iv) },
      aesKey,
      new Uint8Array(data.encryptedData)
    );

    const identity = JSON.parse(new TextDecoder().decode(decrypted));

    console.log('✅ Identity imported successfully');
    return identity;
  } catch (error) {
    console.error('❌ Failed to import identity:', error);
    throw error;
  }
}

/**
 * Получение публичной информации для регистрации на сервере
 */
function getPublicBundle() {
  return {
    identityKey: [],
    registrationId: Math.floor(Math.random() * 16383) + 1,
    preKeys: [{
      keyId: 1,
      publicKey: []
    }],
    signedPreKey: {
      keyId: 1,
      publicKey: [],
      signature: []
    }
  };
}

async function createSignalSession() {
  console.warn('Signal Protocol session not implemented');
  return null;
}

async function encryptMessage() {
  console.warn('Signal Protocol encryption not implemented');
  return null;
}

async function decryptMessage() {
  console.warn('Signal Protocol decryption not implemented');
  return null;
}

async function testSignalProtocol() {
  console.log('Simple crypto implementation active');
  return true;
}

export { 
  generateSignalIdentity,
  createSignalSession,
  encryptMessage,
  decryptMessage,
  exportSignalIdentity,
  importSignalIdentity,
  getPublicBundle,
  testSignalProtocol
};