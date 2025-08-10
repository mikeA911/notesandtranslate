/**
 * Credit Manager - Core credit system functionality
 * Handles credit balance, deductions, purchases, and validation
 */

import { CreditStorage } from './creditStorage.js';
import { CreditSecurity } from './creditSecurity.js';

// Credit cost constants
export const CREDIT_COSTS = {
  POLISH_TEXT: 3,      // 3 credits for polishing text
  TRANSLATE: 7,        // 7 credits for translation
  COMPLETE: 10,        // 10 credits for complete workflow (polish + translate)
  
  // Backend configurable conversion rate
  CREDIT_TO_CENT_RATE: 1  // 1 credit = 1 cent (configurable)
};

export const CREDIT_PACKAGES = {
  SMALL: { credits: 100, price: 1.00, label: '$1.00 - 100 Credits' },
  MEDIUM: { credits: 250, price: 2.25, label: '$2.25 - 250 Credits' },
  LARGE: { credits: 500, price: 4.00, label: '$4.00 - 500 Credits' },
  XL: { credits: 1000, price: 7.50, label: '$7.50 - 1000 Credits' }
};

export class CreditManager {
  constructor() {
    this.storage = new CreditStorage();
    this.security = new CreditSecurity();
    this.currentBalance = 0;
    this.deviceFingerprint = null;
    this.isInitialized = false;
    
    // Event listeners for balance changes
    this.balanceChangeListeners = [];
  }

  /**
   * Initialize the credit system
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize storage
      await this.storage.init();
      
      // Generate device fingerprint
      this.deviceFingerprint = await this.security.generateDeviceFingerprint();
      
      // Load current balance
      await this.loadBalance();
      
      // Request persistent storage
      await this.storage.requestPersistentStorage();
      
      this.isInitialized = true;
      console.log('Credit system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize credit system:', error);
      throw error;
    }
  }

  /**
   * Load current credit balance from storage
   */
  async loadBalance() {
    try {
      const balanceData = await this.storage.getCreditBalance();
      if (balanceData) {
        this.currentBalance = balanceData.balance || 0;
      } else {
        // No existing balance, start with 0
        this.currentBalance = 0;
        await this.saveBalance();
      }
    } catch (error) {
      console.error('Failed to load balance, starting with 0:', error);
      this.currentBalance = 0;
      await this.saveBalance();
    }
  }

  /**
   * Save current balance to storage
   */
  async saveBalance() {
    try {
      await this.storage.saveCreditBalance(this.currentBalance, this.deviceFingerprint);
    } catch (error) {
      console.error('Failed to save balance:', error);
      throw error;
    }
  }

  /**
   * Get current credit balance
   */
  getBalance() {
    return this.currentBalance;
  }

  /**
   * Add balance change listener
   */
  onBalanceChange(callback) {
    this.balanceChangeListeners.push(callback);
  }

  /**
   * Remove balance change listener
   */
  removeBalanceChangeListener(callback) {
    const index = this.balanceChangeListeners.indexOf(callback);
    if (index > -1) {
      this.balanceChangeListeners.splice(index, 1);
    }
  }

  /**
   * Notify balance change listeners
   */
  notifyBalanceChange() {
    this.balanceChangeListeners.forEach(callback => {
      try {
        callback(this.currentBalance);
      } catch (error) {
        console.error('Error in balance change listener:', error);
      }
    });
  }

  /**
   * Check if user has sufficient credits for an operation
   */
  hasSufficientCredits(cost) {
    return this.currentBalance >= cost;
  }

  /**
   * Get cost for a specific operation
   */
  getCost(operation) {
    switch (operation) {
      case 'polish':
        return CREDIT_COSTS.POLISH_TEXT;
      case 'translate':
        return CREDIT_COSTS.TRANSLATE;
      case 'complete':
        return CREDIT_COSTS.COMPLETE;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Deduct credits for an operation (only after successful API call)
   */
  async deductCredits(cost, operation, metadata = {}) {
    if (!this.hasSufficientCredits(cost)) {
      throw new Error(`Insufficient credits. Required: ${cost}, Available: ${this.currentBalance}`);
    }

    const previousBalance = this.currentBalance;
    this.currentBalance -= cost;

    try {
      // Save new balance
      await this.saveBalance();
      
      // Log transaction
      await this.storage.logTransaction('deduction', cost, operation, {
        ...metadata,
        previousBalance: previousBalance,
        newBalance: this.currentBalance
      });
      
      // Notify listeners
      this.notifyBalanceChange();
      
      console.log(`Deducted ${cost} credits for ${operation}. New balance: ${this.currentBalance}`);
      
      return {
        success: true,
        previousBalance: previousBalance,
        newBalance: this.currentBalance,
        deducted: cost
      };
    } catch (error) {
      // Rollback balance on error
      this.currentBalance = previousBalance;
      throw new Error(`Failed to deduct credits: ${error.message}`);
    }
  }

  /**
   * Add credits (for purchases or testing)
   */
  async addCredits(amount, source = 'purchase', metadata = {}) {
    const previousBalance = this.currentBalance;
    this.currentBalance += amount;

    try {
      // Save new balance
      await this.saveBalance();
      
      // Log transaction
      await this.storage.logTransaction('purchase', amount, source, {
        ...metadata,
        previousBalance: previousBalance,
        newBalance: this.currentBalance
      });
      
      // Notify listeners
      this.notifyBalanceChange();
      
      console.log(`Added ${amount} credits from ${source}. New balance: ${this.currentBalance}`);
      
      return {
        success: true,
        previousBalance: previousBalance,
        newBalance: this.currentBalance,
        added: amount
      };
    } catch (error) {
      // Rollback balance on error
      this.currentBalance = previousBalance;
      throw new Error(`Failed to add credits: ${error.message}`);
    }
  }

  /**
   * Purchase credits (prepare for Stripe integration)
   */
  async purchaseCredits(packageKey, paymentMethod = 'demo') {
    const package_ = CREDIT_PACKAGES[packageKey];
    if (!package_) {
      throw new Error(`Invalid credit package: ${packageKey}`);
    }

    try {
      // In a real implementation, this would integrate with Stripe
      // For now, we'll simulate a successful purchase
      if (paymentMethod === 'demo') {
        await this.simulatePayment(package_);
      } else {
        // Future: Stripe integration
        throw new Error('Payment processing not yet implemented');
      }
      
      // Add credits after successful payment
      const result = await this.addCredits(package_.credits, 'purchase', {
        package: packageKey,
        price: package_.price,
        paymentMethod: paymentMethod
      });
      
      return {
        ...result,
        package: package_,
        receipt: {
          date: new Date().toISOString(),
          package: packageKey,
          credits: package_.credits,
          price: package_.price,
          paymentMethod: paymentMethod
        }
      };
    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    }
  }

  /**
   * Simulate payment for demo purposes
   */
  async simulatePayment(package_) {
    return new Promise((resolve) => {
      // Simulate payment processing delay
      setTimeout(() => {
        console.log(`Demo payment processed for ${package_.credits} credits ($${package_.price})`);
        resolve();
      }, 1000);
    });
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(limit = 50) {
    return await this.storage.getTransactionHistory(limit);
  }

  /**
   * Export credit data
   */
  async exportData() {
    return await this.storage.exportCreditData();
  }

  /**
   * Generate backup codes
   */
  async generateBackupCodes() {
    const codes = this.security.generateBackupCodes(5);
    await this.storage.saveBackupCodes(codes);
    return codes;
  }

  /**
   * Use backup code for recovery
   */
  async useBackupCode(code) {
    if (!this.security.isValidBackupCode(code)) {
      throw new Error('Invalid backup code format');
    }
    
    return await this.storage.useBackupCode(code);
  }

  /**
   * Reset credits (for testing)
   */
  async resetCredits(newBalance = 0) {
    const previousBalance = this.currentBalance;
    this.currentBalance = newBalance;
    
    await this.saveBalance();
    await this.storage.logTransaction('reset', newBalance - previousBalance, 'admin_reset', {
      previousBalance: previousBalance,
      newBalance: newBalance
    });
    
    this.notifyBalanceChange();
    
    return {
      previousBalance: previousBalance,
      newBalance: newBalance
    };
  }

  /**
   * Check if credits are running low
   */
  isRunningLow(threshold = 50) {
    return this.currentBalance < threshold;
  }

  /**
   * Get formatted balance string
   */
  getFormattedBalance() {
    return `${this.currentBalance} credits`;
  }

  /**
   * Get cost preview for operation
   */
  getCostPreview(operation) {
    const cost = this.getCost(operation);
    const sufficient = this.hasSufficientCredits(cost);
    
    return {
      operation: operation,
      cost: cost,
      costInCents: cost * CREDIT_COSTS.CREDIT_TO_CENT_RATE,
      currentBalance: this.currentBalance,
      sufficient: sufficient,
      balanceAfter: sufficient ? this.currentBalance - cost : null
    };
  }

  /**
   * Validate operation before execution
   */
  async validateOperation(operation) {
    const preview = this.getCostPreview(operation);
    
    if (!preview.sufficient) {
      const deficit = preview.cost - preview.currentBalance;
      throw new Error(
        `Insufficient credits for ${operation}. ` +
        `Need ${preview.cost} credits, have ${preview.currentBalance}. ` +
        `Short by ${deficit} credits.`
      );
    }
    
    return preview;
  }

  /**
   * Clear all credit data (for testing/reset)
   */
  async clearAllData() {
    await this.storage.clearAllData();
    this.currentBalance = 0;
    this.notifyBalanceChange();
    console.log('All credit data cleared');
  }
}