/**
 * Credit Storage Module
 * Handles IndexedDB operations for credit system
 */

import { CreditSecurity } from './creditSecurity.js';

export class CreditStorage {
  constructor() {
    this.db = null;
    this.dbName = 'VoiceNotesCreditsDB';
    this.dbVersion = 1;
    this.security = new CreditSecurity();
  }

  /**
   * Initialize the credit database
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(new Error('Failed to open credits database'));
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Credits store
        if (!db.objectStoreNames.contains('credits')) {
          const creditsStore = db.createObjectStore('credits', { keyPath: 'id' });
          creditsStore.createIndex('deviceFingerprint', 'deviceFingerprint', { unique: false });
        }
        
        // Transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionsStore = db.createObjectStore('transactions', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          transactionsStore.createIndex('timestamp', 'timestamp', { unique: false });
          transactionsStore.createIndex('type', 'type', { unique: false });
        }
        
        // Settings store
        if (!db.objectStoreNames.contains('creditSettings')) {
          db.createObjectStore('creditSettings', { keyPath: 'key' });
        }
        
        // Backup codes store
        if (!db.objectStoreNames.contains('backupCodes')) {
          const backupStore = db.createObjectStore('backupCodes', { keyPath: 'code' });
          backupStore.createIndex('used', 'used', { unique: false });
        }
      };
    });
  }

  /**
   * Get object store for transactions
   */
  getStore(storeName, mode = 'readonly') {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  /**
   * Save encrypted credit balance
   */
  async saveCreditBalance(balance, deviceFingerprint) {
    const timestamp = Date.now();
    const creditData = {
      id: 'main',
      balance: balance,
      deviceFingerprint: deviceFingerprint,
      timestamp: timestamp,
      lastModified: timestamp
    };

    // Create integrity hash
    const integrityHash = await this.security.createIntegrityHash(creditData);
    creditData.integrityHash = integrityHash;

    // Encrypt the credit data
    const encryptedData = await this.security.encryptData(creditData);
    
    const encryptedCreditRecord = {
      id: 'main',
      data: encryptedData,
      deviceFingerprint: deviceFingerprint,
      timestamp: timestamp
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore('credits', 'readwrite');
      const request = store.put(encryptedCreditRecord);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save credit balance'));
    });
  }

  /**
   * Get encrypted credit balance
   */
  async getCreditBalance() {
    return new Promise(async (resolve, reject) => {
      const store = this.getStore('credits', 'readonly');
      const request = store.get('main');
      
      request.onsuccess = async () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        try {
          // Decrypt the credit data
          const decryptedData = await this.security.decryptData(result.data);
          if (!decryptedData) {
            reject(new Error('Failed to decrypt credit data'));
            return;
          }

          // Verify integrity
          const isValid = await this.security.verifyIntegrity(
            decryptedData, 
            decryptedData.integrityHash
          );
          
          if (!isValid) {
            reject(new Error('Credit data integrity check failed'));
            return;
          }

          resolve(decryptedData);
        } catch (error) {
          reject(new Error('Failed to decrypt credit balance: ' + error.message));
        }
      };
      
      request.onerror = () => reject(new Error('Failed to fetch credit balance'));
    });
  }

  /**
   * Log a credit transaction
   */
  async logTransaction(type, amount, operation, metadata = {}) {
    const transaction = {
      type: type, // 'purchase', 'deduction', 'refund'
      amount: amount,
      operation: operation, // 'polish', 'translate', 'complete', 'purchase'
      metadata: metadata,
      timestamp: Date.now(),
      deviceFingerprint: await this.security.generateDeviceFingerprint()
    };

    return new Promise((resolve, reject) => {
      const store = this.getStore('transactions', 'readwrite');
      const request = store.add(transaction);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to log transaction'));
    });
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(limit = 100) {
    return new Promise((resolve, reject) => {
      const store = this.getStore('transactions', 'readonly');
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // Most recent first
      
      const transactions = [];
      let count = 0;
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && count < limit) {
          transactions.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(transactions);
        }
      };
      
      request.onerror = () => reject(new Error('Failed to fetch transaction history'));
    });
  }

  /**
   * Save backup codes
   */
  async saveBackupCodes(codes) {
    const store = this.getStore('backupCodes', 'readwrite');
    const promises = codes.map(code => {
      const record = {
        code: code,
        created: Date.now(),
        used: false
      };
      return new Promise((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject();
      });
    });

    await Promise.all(promises);
  }

  /**
   * Verify and use backup code
   */
  async useBackupCode(code) {
    return new Promise((resolve, reject) => {
      const store = this.getStore('backupCodes', 'readwrite');
      const request = store.get(code.toUpperCase());
      
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(false); // Code doesn't exist
          return;
        }
        
        if (result.used) {
          resolve(false); // Code already used
          return;
        }
        
        // Mark code as used
        result.used = true;
        result.usedAt = Date.now();
        
        const updateRequest = store.put(result);
        updateRequest.onsuccess = () => resolve(true);
        updateRequest.onerror = () => reject(new Error('Failed to mark backup code as used'));
      };
      
      request.onerror = () => reject(new Error('Failed to verify backup code'));
    });
  }

  /**
   * Save credit settings
   */
  async saveSetting(key, value) {
    return new Promise((resolve, reject) => {
      const store = this.getStore('creditSettings', 'readwrite');
      const request = store.put({ key: key, value: value });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save setting'));
    });
  }

  /**
   * Get credit settings
   */
  async getSetting(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      const store = this.getStore('creditSettings', 'readonly');
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };
      
      request.onerror = () => resolve(defaultValue);
    });
  }

  /**
   * Export all credit data for backup
   */
  async exportCreditData() {
    const [balance, transactions, settings] = await Promise.all([
      this.getCreditBalance().catch(() => null),
      this.getTransactionHistory(1000).catch(() => []),
      this.getAllSettings().catch(() => {})
    ]);

    return {
      balance: balance,
      transactions: transactions,
      settings: settings,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  }

  /**
   * Get all settings
   */
  async getAllSettings() {
    return new Promise((resolve, reject) => {
      const store = this.getStore('creditSettings', 'readonly');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const settings = {};
        request.result.forEach(item => {
          settings[item.key] = item.value;
        });
        resolve(settings);
      };
      
      request.onerror = () => reject(new Error('Failed to fetch settings'));
    });
  }

  /**
   * Clear all credit data (for testing/reset)
   */
  async clearAllData() {
    const storeNames = ['credits', 'transactions', 'creditSettings', 'backupCodes'];
    const promises = storeNames.map(storeName => {
      return new Promise((resolve, reject) => {
        const store = this.getStore(storeName, 'readwrite');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
      });
    });

    await Promise.all(promises);
  }

  /**
   * Request persistent storage
   */
  async requestPersistentStorage() {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const isPersistent = await navigator.storage.persist();
        return isPersistent;
      } catch (error) {
        console.warn('Failed to request persistent storage:', error);
        return false;
      }
    }
    return false;
  }
}