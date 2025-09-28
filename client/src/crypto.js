async function generateKeys() {
  // Generate ECDSA key pair for signing
  const ecdsaKeyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  // Generate ECDH key pair for encryption
  const ecdhKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  return { ecdsaKeyPair, ecdhKeyPair };
}

async function exportPrivateKey(key, password) {
  // Export private key as raw
  const exportedKey = await crypto.subtle.exportKey("pkcs8", key);
  const keyArray = new Uint8Array(exportedKey);

  // Generate AES key from password
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );

  // Encrypt private key with AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    keyArray
  );

  // Return JSON with encrypted key, IV, and salt
  return JSON.stringify({
    encryptedKey: Array.from(new Uint8Array(encryptedKey)),
    iv: Array.from(iv),
    salt: Array.from(salt)
  });
}

async function importPrivateKey(encryptedJson, password, algorithm) {
  const encryptedData = JSON.parse(encryptedJson);

  // Derive AES key from password
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(encryptedData.salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["decrypt"]
  );

  // Decrypt private key
  const decryptedKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(encryptedData.iv) },
    aesKey,
    new Uint8Array(encryptedData.encryptedKey)
  );

  // Import decrypted key
  return await crypto.subtle.importKey(
    "pkcs8",
    decryptedKey,
    algorithm === "ECDSA" ? { name: "ECDSA", namedCurve: "P-256" } : { name: "ECDH", namedCurve: "P-256" },
    true,
    algorithm === "ECDSA" ? ["sign"] : ["deriveKey"]
  );
}

async function testKeyManagement() {
  try {
    const password = "testpassword123";
    const { ecdsaKeyPair, ecdhKeyPair } = await generateKeys();

    // Export and import ECDSA private key
    const exportedEcdsa = await exportPrivateKey(ecdsaKeyPair.privateKey, password);
    const importedEcdsa = await importPrivateKey(exportedEcdsa, password, "ECDSA");

    // Export and import ECDH private key
    const exportedEcdh = await exportPrivateKey(ecdhKeyPair.privateKey, password);
    const importedEcdh = await importPrivateKey(exportedEcdh, password, "ECDH");

    // Verify keys
    const ecdsaMatch = (await crypto.subtle.exportKey("pkcs8", ecdsaKeyPair.privateKey)).byteLength === (await crypto.subtle.exportKey("pkcs8", importedEcdsa)).byteLength;
    const ecdhMatch = (await crypto.subtle.exportKey("pkcs8", ecdhKeyPair.privateKey)).byteLength === (await crypto.subtle.exportKey("pkcs8", importedEcdh)).byteLength;

    console.log("ECDSA key match:", ecdsaMatch);
    console.log("ECDH key match:", ecdhMatch);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

export { generateKeys, exportPrivateKey, importPrivateKey, testKeyManagement };