/**
 * Credit Security Module
 * Handles device fingerprinting, encryption, and security validation
 */

export class CreditSecurity {
  constructor() {
    this.cryptoKey = null;
    this.deviceFingerprint = null;
  }

  /**
   * Generate a unique device fingerprint for basic security
   */
  async generateDeviceFingerprint() {
    if (this.deviceFingerprint) return this.deviceFingerprint;

    const components = [];
    
    // Screen resolution
    components.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}`);
    
    // Timezone
    components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    
    // Language
    components.push(`lang:${navigator.language}`);
    
    // Platform
    components.push(`platform:${navigator.platform}`);
    
    // User agent (simplified)
    const ua = navigator.userAgent;
    const uaHash = await this.simpleHash(ua);
    components.push(`ua:${uaHash.substring(0, 8)}`);
    
    // Canvas fingerprint (basic)
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint test', 2, 2);
      const canvasData = canvas.toDataURL();
      const canvasHash = await this.simpleHash(canvasData);
      components.push(`canvas:${canvasHash.substring(0, 8)}`);
    } catch (e) {
      components.push('canvas:unavailable');
    }
    
    this.deviceFingerprint = await this.simpleHash(components.join('|'));
    return this.deviceFingerprint;
  }

  /**
   * Simple hash function using Web Crypto API
   */
  async simpleHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Initialize or retrieve encryption key
   */
  async initializeCryptoKey() {
    if (this.cryptoKey) return this.cryptoKey;

    const fingerprint = await this.generateDeviceFingerprint();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(fingerprint.substring(0, 32)),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    this.cryptoKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('VoiceNotes-Credits-Salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return this.cryptoKey;
  }

  /**
   * Encrypt data using device-specific key
   */
  async encryptData(data) {
    const key = await this.initializeCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(JSON.stringify(data));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedData
    );

    return {
      encrypted: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv)
    };
  }

  /**
   * Decrypt data using device-specific key
   */
  async decryptData(encryptedData) {
    const key = await this.initializeCryptoKey();
    const iv = new Uint8Array(encryptedData.iv);
    const encrypted = new Uint8Array(encryptedData.encrypted);
    
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
      
      const decryptedText = new TextDecoder().decode(decrypted);
      return JSON.parse(decryptedText);
    } catch (error) {
      console.error('Failed to decrypt credit data:', error);
      return null;
    }
  }

  /**
   * Generate backup codes for credit recovery
   */
  generateBackupCodes(count = 5) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.getRandomValues(new Uint32Array(3))
        .reduce((acc, val) => acc + val.toString(16).padStart(8, '0'), '');
      codes.push(code.substring(0, 16).toUpperCase());
    }
    return codes;
  }

  /**
   * Validate backup code format
   */
  isValidBackupCode(code) {
    return /^[A-F0-9]{16}$/.test(code.toUpperCase());
  }

  /**
   * Create integrity hash for credit data
   */
  async createIntegrityHash(creditData) {
    const dataString = JSON.stringify({
      balance: creditData.balance,
      deviceFingerprint: await this.generateDeviceFingerprint(),
      timestamp: creditData.timestamp
    });
    return await this.simpleHash(dataString);
  }

  /**
   * Verify credit data integrity
   */
  async verifyIntegrity(creditData, expectedHash) {
    const currentHash = await this.createIntegrityHash(creditData);
    return currentHash === expectedHash;
  }
}