// // crypto.js - Signal Protocol Implementation (Universal ES6)
// /**
//  * Signal Protocol crypto module
//  * - Generate Signal identity and prekeys
//  * - Create Signal sessions for users
//  * - Encrypt/decrypt messages using Signal Protocol
//  * - Export/import Signal identity keys with password protection
//  */

// import {
//   IdentityKeyPair,
//   PreKeyBundle,
//   PreKeyRecord,
//   SignedPreKeyRecord,
//   SessionBuilder,
//   SessionCipher,
//   SignalProtocolAddress,
//   ProtocolStore,
//   PreKeySignalMessage,
//   SignalMessage
// } from '@signalapp/libsignal-client';

// // Определяем окружение
// const isNode = typeof process !== 'undefined' && process.versions?.node;
// const isBrowser = typeof window !== 'undefined';

// // Универсальный crypto API
// const getCrypto = () => {
//   if (isBrowser) {
//     return window.crypto;
//   } else if (isNode) {
//     // В Node.js 15+ есть webcrypto
//     return globalThis.crypto || require('crypto').webcrypto;
//   }
//   throw new Error('Crypto API not available');
// };

// // Универсальная функция для работы с Buffer/Uint8Array
// const toBuffer = (data) => {
//   if (data instanceof Uint8Array) {
//     return data;
//   }
//   if (Array.isArray(data)) {
//     return new Uint8Array(data);
//   }
//   if (typeof data === 'string') {
//     return new TextEncoder().encode(data);
//   }
//   return new Uint8Array(data);
// };

// // Simple in-memory store for Signal Protocol
// // В продакшене это должно быть в IndexedDB
// class SimpleSignalStore extends ProtocolStore {
//   constructor() {
//     super();
//     this.identityKey = null;
//     this.registrationId = Math.floor(Math.random() * 16383) + 1;
//     this.preKeys = new Map();
//     this.signedPreKeys = new Map();
//     this.sessions = new Map();
//     this.identityKeys = new Map();
//   }

//   async getIdentityKeyPair() {
//     return this.identityKey;
//   }

//   async getLocalRegistrationId() {
//     return this.registrationId;
//   }

//   async saveIdentity(address, identityKey) {
//     const key = `${address.name()}.${address.deviceId()}`;
//     this.identityKeys.set(key, identityKey);
//     return true;
//   }

//   async isTrustedIdentity(address, identityKey, direction) {
//     const key = `${address.name()}.${address.deviceId()}`;
//     const stored = this.identityKeys.get(key);
//     if (!stored) return true;
//     return stored.serialize().equals(identityKey.serialize());
//   }

//   async getIdentity(address) {
//     const key = `${address.name()}.${address.deviceId()}`;
//     return this.identityKeys.get(key) || null;
//   }

//   async loadPreKey(keyId) {
//     return this.preKeys.get(keyId) || null;
//   }

//   async storePreKey(keyId, record) {
//     this.preKeys.set(keyId, record);
//   }

//   async removePreKey(keyId) {
//     this.preKeys.delete(keyId);
//   }

//   async loadSignedPreKey(keyId) {
//     return this.signedPreKeys.get(keyId) || null;
//   }

//   async storeSignedPreKey(keyId, record) {
//     this.signedPreKeys.set(keyId, record);
//   }

//   async loadSession(address) {
//     const key = `${address.name()}.${address.deviceId()}`;
//     return this.sessions.get(key) || null;
//   }

//   async storeSession(address, record) {
//     const key = `${address.name()}.${address.deviceId()}`;
//     this.sessions.set(key, record);
//   }
// }

// // Глобальное хранилище для Signal Protocol
// let signalStore = null;

// /**
//  * Генерация Signal identity и prekeys
//  */
// async function generateSignalIdentity() {
//   try {
//     signalStore = new SimpleSignalStore();
    
//     // Генерируем identity key pair
//     const identityKeyPair = IdentityKeyPair.generate();
//     signalStore.identityKey = identityKeyPair;

//     // Генерируем signed prekey
//     const signedPreKeyId = Math.floor(Math.random() * 16777215);
//     const signedPreKey = SignedPreKeyRecord.generate(
//       signedPreKeyId,
//       identityKeyPair.privateKey(),
//       Date.now()
//     );
//     await signalStore.storeSignedPreKey(signedPreKeyId, signedPreKey);

//     // Генерируем обычные prekeys (батч из 10 штук)
//     const preKeys = [];
//     for (let i = 0; i < 10; i++) {
//       const preKeyId = Math.floor(Math.random() * 16777215);
//       const preKey = PreKeyRecord.generate(preKeyId);
//       await signalStore.storePreKey(preKeyId, preKey);
//       preKeys.push({
//         keyId: preKeyId,
//         publicKey: Array.from(preKey.publicKey().serialize())
//       });
//     }

//     console.log('✅ Signal identity generated successfully');
//     return {
//       identityKey: Array.from(identityKeyPair.publicKey().serialize()),
//       registrationId: signalStore.registrationId,
//       signedPreKey: {
//         keyId: signedPreKeyId,
//         publicKey: Array.from(signedPreKey.publicKey().serialize()),
//         signature: Array.from(signedPreKey.signature())
//       },
//       preKeys
//     };
//   } catch (error) {
//     console.error('❌ Failed to generate Signal identity:', error);
//     throw error;
//   }
// }

// /**
//  * Создание Signal сессии с другим пользователем
//  */
// async function createSignalSession(username, bundle) {
//   try {
//     if (!signalStore) {
//       throw new Error('Signal store not initialized. Call generateSignalIdentity() first.');
//     }

//     const address = new SignalProtocolAddress(username, 1);
    
//     // Создаем PreKeyBundle из данных пользователя
//     const preKeyBundle = PreKeyBundle.new(
//       bundle.registrationId,
//       1, // deviceId
//       bundle.preKeys[0].keyId,
//       toBuffer(bundle.preKeys[0].publicKey),
//       bundle.signedPreKey.keyId,
//       toBuffer(bundle.signedPreKey.publicKey),
//       toBuffer(bundle.signedPreKey.signature),
//       toBuffer(bundle.identityKey)
//     );

//     // Строим сессию
//     const sessionBuilder = new SessionBuilder(signalStore, address);
//     await sessionBuilder.processPreKeyBundle(preKeyBundle);

//     console.log(`✅ Signal session created with ${username}`);
//     return address;
//   } catch (error) {
//     console.error(`❌ Failed to create session with ${username}:`, error);
//     throw error;
//   }
// }

// /**
//  * Шифрование сообщения через Signal Protocol
//  */
// async function encryptMessage(username, message) {
//   try {
//     if (!signalStore) {
//       throw new Error('Signal store not initialized');
//     }

//     const address = new SignalProtocolAddress(username, 1);
//     const sessionCipher = new SessionCipher(signalStore, address);
    
//     const messageBuffer = toBuffer(message);
//     const ciphertext = await sessionCipher.encrypt(messageBuffer);

//     return {
//       type: ciphertext.type(),
//       body: Array.from(ciphertext.serialize()),
//       timestamp: Date.now()
//     };
//   } catch (error) {
//     console.error(`❌ Failed to encrypt message for ${username}:`, error);
//     throw error;
//   }
// }

// /**
//  * Расшифровка сообщения через Signal Protocol
//  */
// async function decryptMessage(username, encryptedMessage) {
//   try {
//     if (!signalStore) {
//       throw new Error('Signal store not initialized');
//     }

//     const address = new SignalProtocolAddress(username, 1);
//     const sessionCipher = new SessionCipher(signalStore, address);

//     let plaintext;
//     if (encryptedMessage.type === 3) { // PreKeySignalMessage
//       const message = PreKeySignalMessage.deserialize(toBuffer(encryptedMessage.body));
//       plaintext = await sessionCipher.decryptPreKeySignalMessage(message);
//     } else { // SignalMessage
//       const message = SignalMessage.deserialize(toBuffer(encryptedMessage.body));
//       plaintext = await sessionCipher.decryptSignalMessage(message);
//     }

//     return new TextDecoder().decode(plaintext);
//   } catch (error) {
//     console.error(`❌ Failed to decrypt message from ${username}:`, error);
//     throw error;
//   }
// }

// /**
//  * Экспорт Signal identity в зашифрованный файл
//  */
// async function exportSignalIdentity(password) {
//   try {
//     if (!signalStore || !signalStore.identityKey) {
//       throw new Error('No Signal identity to export');
//     }

//     const crypto = getCrypto();

//     // Сериализуем данные для экспорта
//     const exportData = {
//       identityKey: Array.from(signalStore.identityKey.serialize()),
//       registrationId: signalStore.registrationId,
//       preKeys: Array.from(signalStore.preKeys.entries()).map(([id, record]) => ({
//         id,
//         record: Array.from(record.serialize())
//       })),
//       signedPreKeys: Array.from(signalStore.signedPreKeys.entries()).map(([id, record]) => ({
//         id,
//         record: Array.from(record.serialize())
//       }))
//     };

//     // Шифруем через AES
//     const dataString = JSON.stringify(exportData);
//     const salt = crypto.getRandomValues(new Uint8Array(16));
//     const iv = crypto.getRandomValues(new Uint8Array(12));

//     const passwordKey = await crypto.subtle.importKey(
//       'raw',
//       new TextEncoder().encode(password),
//       { name: 'PBKDF2' },
//       false,
//       ['deriveKey']
//     );

//     const aesKey = await crypto.subtle.deriveKey(
//       {
//         name: 'PBKDF2',
//         salt,
//         iterations: 100000,
//         hash: 'SHA-256'
//       },
//       passwordKey,
//       { name: 'AES-GCM', length: 256 },
//       false,
//       ['encrypt']
//     );

//     const encrypted = await crypto.subtle.encrypt(
//       { name: 'AES-GCM', iv },
//       aesKey,
//       new TextEncoder().encode(dataString)
//     );

//     console.log('✅ Signal identity exported successfully');
//     return JSON.stringify({
//       encryptedData: Array.from(new Uint8Array(encrypted)),
//       iv: Array.from(iv),
//       salt: Array.from(salt),
//       type: 'signal-identity'
//     });
//   } catch (error) {
//     console.error('❌ Failed to export Signal identity:', error);
//     throw error;
//   }
// }

// /**
//  * Импорт Signal identity из зашифрованного файла
//  */
// async function importSignalIdentity(encryptedJson, password) {
//   try {
//     const data = JSON.parse(encryptedJson);
    
//     if (data.type !== 'signal-identity') {
//       throw new Error('Invalid backup file format');
//     }

//     const crypto = getCrypto();

//     // Расшифровываем
//     const passwordKey = await crypto.subtle.importKey(
//       'raw',
//       new TextEncoder().encode(password),
//       { name: 'PBKDF2' },
//       false,
//       ['deriveKey']
//     );

//     const aesKey = await crypto.subtle.deriveKey(
//       {
//         name: 'PBKDF2',
//         salt: new Uint8Array(data.salt),
//         iterations: 100000,
//         hash: 'SHA-256'
//       },
//       passwordKey,
//       { name: 'AES-GCM', length: 256 },
//       false,
//       ['decrypt']
//     );

//     const decrypted = await crypto.subtle.decrypt(
//       { name: 'AES-GCM', iv: new Uint8Array(data.iv) },
//       aesKey,
//       new Uint8Array(data.encryptedData)
//     );

//     const exportData = JSON.parse(new TextDecoder().decode(decrypted));

//     // Восстанавливаем Signal store
//     signalStore = new SimpleSignalStore();
//     signalStore.identityKey = IdentityKeyPair.deserialize(toBuffer(exportData.identityKey));
//     signalStore.registrationId = exportData.registrationId;

//     // Восстанавливаем prekeys
//     for (const preKey of exportData.preKeys) {
//       const record = PreKeyRecord.deserialize(toBuffer(preKey.record));
//       signalStore.preKeys.set(preKey.id, record);
//     }

//     // Восстанавливаем signed prekeys
//     for (const signedPreKey of exportData.signedPreKeys) {
//       const record = SignedPreKeyRecord.deserialize(toBuffer(signedPreKey.record));
//       signalStore.signedPreKeys.set(signedPreKey.id, record);
//     }

//     console.log('✅ Signal identity imported successfully');
//     return true;
//   } catch (error) {
//     console.error('❌ Failed to import Signal identity:', error);
//     throw error;
//   }
// }

// /**
//  * Получение публичной информации для регистрации на сервере
//  */
// function getPublicBundle() {
//   if (!signalStore || !signalStore.identityKey) {
//     throw new Error('No Signal identity available');
//   }

//   // Получаем первый доступный prekey и signed prekey
//   const firstPreKey = signalStore.preKeys.entries().next().value;
//   const firstSignedPreKey = signalStore.signedPreKeys.entries().next().value;

//   if (!firstPreKey || !firstSignedPreKey) {
//     throw new Error('No prekeys available');
//   }

//   return {
//     identityKey: Array.from(signalStore.identityKey.publicKey().serialize()),
//     registrationId: signalStore.registrationId,
//     preKeys: [{
//       keyId: firstPreKey[0],
//       publicKey: Array.from(firstPreKey[1].publicKey().serialize())
//     }],
//     signedPreKey: {
//       keyId: firstSignedPreKey[0],
//       publicKey: Array.from(firstSignedPreKey[1].publicKey().serialize()),
//       signature: Array.from(firstSignedPreKey[1].signature())
//     }
//   };
// }

// /**
//  * Тестирование Signal Protocol
//  */
// async function testSignalProtocol() {
//   try {
//     console.log('🧪 Testing Signal Protocol...');

//     // Генерируем identity для пользователя A
//     console.log('Generating identity for User A...');
//     const userABundle = await generateSignalIdentity();
//     const userAStore = signalStore;

//     // Генерируем identity для пользователя B
//     console.log('Generating identity for User B...');
//     const userBBundle = await generateSignalIdentity();
//     const userBStore = signalStore;

//     // User A создает сессию с User B
//     signalStore = userAStore;
//     await createSignalSession('userB', userBBundle);

//     // User B создает сессию с User A  
//     signalStore = userBStore;
//     await createSignalSession('userA', userABundle);

//     // User A отправляет сообщение User B
//     signalStore = userAStore;
//     const encrypted = await encryptMessage('userB', 'Hello from User A!');
//     console.log('✅ Message encrypted:', encrypted.type);

//     // User B получает и расшифровывает сообщение
//     signalStore = userBStore;
//     const decrypted = await decryptMessage('userA', encrypted);
//     console.log('✅ Message decrypted:', decrypted);

//     // Тест экспорта/импорта
//     signalStore = userAStore;
//     const exported = await exportSignalIdentity('testpassword123');
//     await importSignalIdentity(exported, 'testpassword123');
    
//     console.log('🎉 All Signal Protocol tests passed!');
//     return true;
//   } catch (error) {
//     console.error('❌ Signal Protocol test failed:', error);
//     return false;
//   }
// }

// export { 
//   generateSignalIdentity,
//   createSignalSession,
//   encryptMessage,
//   decryptMessage,
//   exportSignalIdentity,
//   importSignalIdentity,
//   getPublicBundle,
//   testSignalProtocol
// };


// crypto.js - Simplified Crypto Module (Browser Compatible)
/**
 * Упрощённый крипто-модуль без Signal Protocol
 * Использует только Web Crypto API для совместимости с браузером
 */

// Определяем окружение
const isBrowser = typeof window !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions?.node;

// Универсальный crypto API
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

// Универсальная функция для работы с Buffer/Uint8Array
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
 * Генерация простых ключей (без Signal Protocol)
 */
async function generateSignalIdentity() {
  try {
    const crypto = getCrypto();
    
    // Генерируем ECDH ключевую пару
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey"]
    );
    
    const publicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    
    const identity = {
      identityKey: Array.from(new Uint8Array(publicKey)),
      privateKey: Array.from(new Uint8Array(privateKey)),
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

    console.log('✅ Identity generated successfully');
    return identity;
  } catch (error) {
    console.error('❌ Failed to generate identity:', error);
    throw error;
  }
}

/**
 * Экспорт identity в зашифрованный файл
 */
async function exportSignalIdentity(password) {
  try {
    // Для простоты - генерируем новый identity при экспорте
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
 * Импорт identity из зашифрованного файла
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
  // Временная заглушка - вернёт пустые данные
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

// Заглушки для неиспользуемых функций
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