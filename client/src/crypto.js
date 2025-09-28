// crypto.js
/**
 * Crypto key management module
 * - Generate ECDSA (signing) and ECDH (encryption) key pairs
 * - Export private keys encrypted with password (AES-GCM)
 * - Import private keys from encrypted JSON
 * - Test key generation/export/import
 */

async function generateKeys() {
  // Generate ECDSA key pair for signing
  const ecdsaKeyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true, // extractable
    ["sign", "verify"]
  );

  // Generate ECDH key pair for encryption
  const ecdhKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, // extractable
    ["deriveKey"]
  );

  return { ecdsaKeyPair, ecdhKeyPair };
}

async function exportPrivateKey(key, password) {
  if (!key || !password) throw new Error("Key and password are required for export.");

  try {
    // Export private key as PKCS8
    const exportedKey = await crypto.subtle.exportKey("pkcs8", key);
    const keyArray = new Uint8Array(exportedKey);

    // Generate AES key from password using PBKDF2
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
  } catch (err) {
    throw new Error("Failed to export private key: " + err.message);
  }
}

async function importPrivateKey(encryptedJson, password, algorithm) {
  if (!encryptedJson || !password || !algorithm) throw new Error("Invalid arguments for import.");

  try {
    const encryptedData = JSON.parse(encryptedJson);

    // Validate JSON structure
    if (!encryptedData.encryptedKey || !encryptedData.iv || !encryptedData.salt) {
      throw new Error("Malformed encrypted key data.");
    }

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

    // Import decrypted key with proper algorithm parameters
    if (algorithm === "ECDSA") {
      return await crypto.subtle.importKey(
        "pkcs8",
        decryptedKey,
        { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" },
        true,
        ["sign"]
      );
    } else {
      return await crypto.subtle.importKey(
        "pkcs8",
        decryptedKey,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
      );
    }
  } catch (err) {
    throw new Error("Failed to import private key: " + err.message);
  }
}

// Helper: Compare two ArrayBuffers
function arrayBufferEquals(buf1, buf2) {
  if (buf1.byteLength !== buf2.byteLength) return false;
  const view1 = new Uint8Array(buf1);
  const view2 = new Uint8Array(buf2);
  return view1.every((v, i) => v === view2[i]);
}

// Test function for key management
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

    // Verify keys by comparing exported buffers
    const ecdsaMatch = arrayBufferEquals(
      await crypto.subtle.exportKey("pkcs8", ecdsaKeyPair.privateKey),
      await crypto.subtle.exportKey("pkcs8", importedEcdsa)
    );

    const ecdhMatch = arrayBufferEquals(
      await crypto.subtle.exportKey("pkcs8", ecdhKeyPair.privateKey),
      await crypto.subtle.exportKey("pkcs8", importedEcdh)
    );

    console.log("ECDSA key match:", ecdsaMatch);
    console.log("ECDH key match:", ecdhMatch);

    // Optional: test wrong password
    try {
      await importPrivateKey(exportedEcdsa, "wrongpassword", "ECDSA");
    } catch (err) {
      console.log("Wrong password test passed:", err.message.includes("Failed to import"));
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

export { generateKeys, exportPrivateKey, importPrivateKey, testKeyManagement };
