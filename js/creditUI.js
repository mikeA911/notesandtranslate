/**
 * Credit UI Components
 * Handles all user interface elements for the credit system
 */

import { CREDIT_PACKAGES, CREDIT_COSTS } from './creditManager.js';

export class CreditUI {
  constructor(creditManager) {
    this.creditManager = creditManager;
    this.elements = {};
    this.modals = {};
    
    // Bind methods to preserve context
    this.updateBalanceDisplay = this.updateBalanceDisplay.bind(this);
  }

  /**
   * Initialize UI components
   */
  async initialize() {
    this.createUIElements();
    this.setupEventListeners();
    
    // Listen for balance changes
    this.creditManager.onBalanceChange(this.updateBalanceDisplay);
    
    // Initial balance display update
    this.updateBalanceDisplay(this.creditManager.getBalance());
  }

  /**
   * Create UI elements for credit system
   */
  createUIElements() {
    this.createBalanceDisplay();
    this.createPurchaseModal();
    this.createHistoryModal();
    this.createCostPreviewElements();
    this.createLowBalanceWarning();
  }

  /**
   * Create balance display in header
   */
  createBalanceDisplay() {
    const headerControls = document.querySelector('.header-controls');
    if (!headerControls) return;

    // Create credit balance container
    const balanceContainer = document.createElement('div');
    balanceContainer.className = 'credit-balance-container';
    balanceContainer.innerHTML = `
      <div class="credit-balance-display">
        <i class="fas fa-coins credit-icon"></i>
        <span id="creditBalanceText">0</span>
        <span class="credit-label">credits</span>
      </div>
      <button id="buyCreditsButton" class="action-button buy-credits-btn" title="Buy Credits">
        <i class="fas fa-plus"></i>
      </button>
    `;

    // Insert before settings button
    const settingsButton = headerControls.querySelector('#settingsButton');
    headerControls.insertBefore(balanceContainer, settingsButton);

    this.elements.balanceText = document.getElementById('creditBalanceText');
    this.elements.buyCreditsButton = document.getElementById('buyCreditsButton');
    this.elements.balanceContainer = balanceContainer;
  }

  /**
   * Create purchase modal
   */
  createPurchaseModal() {
    const modalHTML = `
      <div id="creditPurchaseModal" class="modal-overlay hidden">
        <div class="modal-content credit-purchase-modal">
          <div class="modal-header">
            <h2>Buy Credits</h2>
            <button id="purchaseModalClose" class="modal-close-button">&times;</button>
          </div>
          <div class="modal-body">
            <div class="credit-packages-grid">
              ${this.generatePackageHTML()}
            </div>
            <div class="payment-info">
              <p><strong>What are credits used for?</strong></p>
              <ul class="credit-usage-list">
                <li><strong>Note-taking:</strong> ${CREDIT_COSTS.POLISH_TEXT} credits (voice → polished text)</li>
                <li><strong>Translation:</strong> ${CREDIT_COSTS.TRANSLATE} credits (text → translated text)</li>
                <li><strong>Complete workflow:</strong> ${CREDIT_COSTS.COMPLETE} credits (voice → polish → translate)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modals.purchase = document.getElementById('creditPurchaseModal');
  }

  /**
   * Generate HTML for credit packages
   */
  generatePackageHTML() {
    return Object.entries(CREDIT_PACKAGES).map(([key, package_]) => {
      const value = (package_.credits / package_.price).toFixed(0);
      return `
        <div class="credit-package" data-package="${key}">
          <div class="package-credits">${package_.credits}</div>
          <div class="package-label">Credits</div>
          <div class="package-price">$${package_.price.toFixed(2)}</div>
          <div class="package-value">${value} credits per dollar</div>
          <button class="package-buy-btn" data-package="${key}">
            Select Package
          </button>
        </div>
      `;
    }).join('');
  }

  /**
   * Create history modal
   */
  createHistoryModal() {
    const modalHTML = `
      <div id="creditHistoryModal" class="modal-overlay hidden">
        <div class="modal-content credit-history-modal">
          <div class="modal-header">
            <h2>Credit History</h2>
            <button id="historyModalClose" class="modal-close-button">&times;</button>
          </div>
          <div class="modal-body">
            <div class="history-controls">
              <button id="exportHistoryBtn" class="translation-button">
                <i class="fas fa-download"></i> Export Data
              </button>
              <button id="generateBackupCodesBtn" class="translation-button">
                <i class="fas fa-key"></i> Backup Codes
              </button>
            </div>
            <div class="history-stats">
              <div class="stat-item">
                <span class="stat-label">Current Balance:</span>
                <span id="historyCurrentBalance" class="stat-value">0 credits</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Total Purchased:</span>
                <span id="historyTotalPurchased" class="stat-value">0 credits</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Total Used:</span>
                <span id="historyTotalUsed" class="stat-value">0 credits</span>
              </div>
            </div>
            <div class="history-list-container">
              <div id="historyList" class="history-list">
                <div class="loading-message">Loading history...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modals.history = document.getElementById('creditHistoryModal');
  }

  /**
   * Create cost preview elements
   */
  createCostPreviewElements() {
    // Cost preview will be created dynamically when needed
    const previewHTML = `
      <div id="costPreview" class="cost-preview-modal hidden">
        <div class="cost-preview-content">
          <div class="cost-preview-header">
            <h3 id="costPreviewTitle">Operation Cost</h3>
          </div>
          <div class="cost-preview-body">
            <div class="cost-details">
              <div class="cost-line">
                <span class="cost-label">Operation:</span>
                <span id="costPreviewOperation" class="cost-value">-</span>
              </div>
              <div class="cost-line">
                <span class="cost-label">Cost:</span>
                <span id="costPreviewCost" class="cost-value">-</span>
              </div>
              <div class="cost-line">
                <span class="cost-label">Current Balance:</span>
                <span id="costPreviewBalance" class="cost-value">-</span>
              </div>
              <div class="cost-line balance-after">
                <span class="cost-label">Balance After:</span>
                <span id="costPreviewBalanceAfter" class="cost-value">-</span>
              </div>
            </div>
            <div class="cost-preview-buttons">
              <button id="costPreviewCancel" class="translation-button">Cancel</button>
              <button id="costPreviewConfirm" class="button-primary">Proceed</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', previewHTML);
    this.modals.costPreview = document.getElementById('costPreview');
  }

  /**
   * Create low balance warning
   */
  createLowBalanceWarning() {
    const warningHTML = `
      <div id="lowBalanceWarning" class="low-balance-warning hidden">
        <div class="warning-content">
          <i class="fas fa-exclamation-triangle warning-icon"></i>
          <span class="warning-text">Running low on credits!</span>
          <button id="warningBuyBtn" class="warning-buy-btn">Buy More</button>
          <button id="warningDismissBtn" class="warning-dismiss-btn">&times;</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', warningHTML);
    this.elements.lowBalanceWarning = document.getElementById('lowBalanceWarning');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Buy credits button
    if (this.elements.buyCreditsButton) {
      this.elements.buyCreditsButton.addEventListener('click', () => {
        this.showPurchaseModal();
      });
    }

    // Purchase modal events
    this.setupPurchaseModalEvents();
    
    // History modal events
    this.setupHistoryModalEvents();
    
    // Cost preview events
    this.setupCostPreviewEvents();
    
    // Low balance warning events
    this.setupLowBalanceWarningEvents();

    // Add history button to existing controls
    this.addHistoryButton();
  }

  /**
   * Add credit history button to existing controls
   */
  addHistoryButton() {
    const myNotesButton = document.getElementById('myNotesButton');
    if (myNotesButton) {
      const historyButton = document.createElement('button');
      historyButton.className = 'action-button';
      historyButton.id = 'creditHistoryButton';
      historyButton.title = 'Credit History';
      historyButton.innerHTML = '<i class="fas fa-history"></i>';
      
      myNotesButton.parentNode.insertBefore(historyButton, myNotesButton.nextSibling);
      
      historyButton.addEventListener('click', () => {
        this.showHistoryModal();
      });
    }
  }

  /**
   * Setup purchase modal events
   */
  setupPurchaseModalEvents() {
    const modal = this.modals.purchase;
    if (!modal) return;

    // Close button
    const closeBtn = modal.querySelector('#purchaseModalClose');
    closeBtn?.addEventListener('click', () => {
      this.hidePurchaseModal();
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hidePurchaseModal();
      }
    });

    // Package selection
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('package-buy-btn')) {
        const packageKey = e.target.dataset.package;
        this.processPurchase(packageKey);
      }
    });
  }

  /**
   * Setup history modal events
   */
  setupHistoryModalEvents() {
    const modal = this.modals.history;
    if (!modal) return;

    // Close button
    const closeBtn = modal.querySelector('#historyModalClose');
    closeBtn?.addEventListener('click', () => {
      this.hideHistoryModal();
    });

    // Export button
    const exportBtn = modal.querySelector('#exportHistoryBtn');
    exportBtn?.addEventListener('click', () => {
      this.exportCreditData();
    });

    // Backup codes button
    const backupBtn = modal.querySelector('#generateBackupCodesBtn');
    backupBtn?.addEventListener('click', () => {
      this.generateBackupCodes();
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideHistoryModal();
      }
    });
  }

  /**
   * Setup cost preview events
   */
  setupCostPreviewEvents() {
    const modal = this.modals.costPreview;
    if (!modal) return;

    const cancelBtn = modal.querySelector('#costPreviewCancel');
    const confirmBtn = modal.querySelector('#costPreviewConfirm');

    cancelBtn?.addEventListener('click', () => {
      this.hideCostPreview();
      if (this.costPreviewCallback) {
        this.costPreviewCallback(false);
      }
    });

    confirmBtn?.addEventListener('click', () => {
      this.hideCostPreview();
      if (this.costPreviewCallback) {
        this.costPreviewCallback(true);
      }
    });
  }

  /**
   * Setup low balance warning events
   */
  setupLowBalanceWarningEvents() {
    const warning = this.elements.lowBalanceWarning;
    if (!warning) return;

    const buyBtn = warning.querySelector('#warningBuyBtn');
    const dismissBtn = warning.querySelector('#warningDismissBtn');

    buyBtn?.addEventListener('click', () => {
      this.hideLowBalanceWarning();
      this.showPurchaseModal();
    });

    dismissBtn?.addEventListener('click', () => {
      this.hideLowBalanceWarning();
    });
  }

  /**
   * Update balance display
   */
  updateBalanceDisplay(balance) {
    if (this.elements.balanceText) {
      this.elements.balanceText.textContent = balance.toString();
    }

    // Update balance in history modal if open
    const historyBalance = document.getElementById('historyCurrentBalance');
    if (historyBalance) {
      historyBalance.textContent = `${balance} credits`;
    }

    // Check for low balance
    if (this.creditManager.isRunningLow(balance)) {
      this.showLowBalanceWarning();
    }

    // Update balance container color based on balance
    if (this.elements.balanceContainer) {
      this.elements.balanceContainer.classList.toggle('low-balance', balance < 10);
      this.elements.balanceContainer.classList.toggle('very-low-balance', balance < 5);
    }
  }

  /**
   * Show purchase modal
   */
  showPurchaseModal() {
    const modal = this.modals.purchase;
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Hide purchase modal
   */
  hidePurchaseModal() {
    const modal = this.modals.purchase;
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  /**
   * Show history modal
   */
  async showHistoryModal() {
    const modal = this.modals.history;
    if (!modal) return;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Load and display history
    await this.loadHistoryData();
  }

  /**
   * Hide history modal
   */
  hideHistoryModal() {
    const modal = this.modals.history;
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  /**
   * Show cost preview
   */
  async showCostPreview(operation, callback) {
    const modal = this.modals.costPreview;
    if (!modal) return;

    this.costPreviewCallback = callback;

    try {
      const preview = this.creditManager.getCostPreview(operation);
      
      // Update preview content
      modal.querySelector('#costPreviewOperation').textContent = operation;
      modal.querySelector('#costPreviewCost').textContent = `${preview.cost} credits`;
      modal.querySelector('#costPreviewBalance').textContent = `${preview.currentBalance} credits`;
      
      const balanceAfterElement = modal.querySelector('#costPreviewBalanceAfter');
      const confirmBtn = modal.querySelector('#costPreviewConfirm');
      
      if (preview.sufficient) {
        balanceAfterElement.textContent = `${preview.balanceAfter} credits`;
        balanceAfterElement.classList.remove('insufficient');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Proceed';
      } else {
        balanceAfterElement.textContent = 'Insufficient credits';
        balanceAfterElement.classList.add('insufficient');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Insufficient Credits';
      }

      modal.classList.remove('hidden');
    } catch (error) {
      console.error('Error showing cost preview:', error);
      if (callback) callback(false);
    }
  }

  /**
   * Hide cost preview
   */
  hideCostPreview() {
    const modal = this.modals.costPreview;
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  /**
   * Show low balance warning
   */
  showLowBalanceWarning() {
    const warning = this.elements.lowBalanceWarning;
    if (warning && warning.classList.contains('hidden')) {
      warning.classList.remove('hidden');
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        this.hideLowBalanceWarning();
      }, 5000);
    }
  }

  /**
   * Hide low balance warning
   */
  hideLowBalanceWarning() {
    const warning = this.elements.lowBalanceWarning;
    if (warning) {
      warning.classList.add('hidden');
    }
  }

  /**
   * Process credit purchase
   */
  async processPurchase(packageKey) {
    try {
      // Disable purchase buttons
      this.disablePurchaseButtons(true);
      
      // Show loading state
      this.showPurchaseLoading(packageKey);
      
      // Process purchase (demo mode)
      const result = await this.creditManager.purchaseCredits(packageKey, 'demo');
      
      // Show success message
      this.showPurchaseSuccess(result);
      
      // Hide modal after delay
      setTimeout(() => {
        this.hidePurchaseModal();
      }, 2000);
      
    } catch (error) {
      this.showPurchaseError(error.message);
    } finally {
      this.disablePurchaseButtons(false);
    }
  }

  /**
   * Disable/enable purchase buttons
   */
  disablePurchaseButtons(disabled) {
    const buttons = this.modals.purchase?.querySelectorAll('.package-buy-btn');
    buttons?.forEach(btn => {
      btn.disabled = disabled;
      btn.textContent = disabled ? 'Processing...' : 'Select Package';
    });
  }

  /**
   * Show purchase loading state
   */
  showPurchaseLoading(packageKey) {
    const button = this.modals.purchase?.querySelector(`[data-package="${packageKey}"]`);
    if (button) {
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }
  }

  /**
   * Show purchase success
   */
  showPurchaseSuccess(result) {
    const modalBody = this.modals.purchase?.querySelector('.modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="purchase-success">
          <i class="fas fa-check-circle success-icon"></i>
          <h3>Purchase Successful!</h3>
          <p>Added ${result.package.credits} credits to your account.</p>
          <p>New balance: ${result.newBalance} credits</p>
        </div>
      `;
    }
  }

  /**
   * Show purchase error
   */
  showPurchaseError(message) {
    const modalBody = this.modals.purchase?.querySelector('.modal-body');
    if (modalBody) {
      modalBody.innerHTML = `
        <div class="purchase-error">
          <i class="fas fa-exclamation-circle error-icon"></i>
          <h3>Purchase Failed</h3>
          <p>${message}</p>
          <button onclick="location.reload()" class="button-primary">Try Again</button>
        </div>
      `;
    }
  }

  /**
   * Load and display history data
   */
  async loadHistoryData() {
    try {
      const historyList = document.getElementById('historyList');
      const transactions = await this.creditManager.getTransactionHistory();
      
      if (transactions.length === 0) {
        historyList.innerHTML = '<div class="no-history-message">No transaction history yet.</div>';
        return;
      }

      // Calculate stats
      const stats = this.calculateHistoryStats(transactions);
      this.updateHistoryStats(stats);
      
      // Render transactions
      historyList.innerHTML = transactions.map(transaction => 
        this.renderTransactionItem(transaction)
      ).join('');
      
    } catch (error) {
      console.error('Failed to load history:', error);
      const historyList = document.getElementById('historyList');
      if (historyList) {
        historyList.innerHTML = '<div class="error-message">Failed to load history.</div>';
      }
    }
  }

  /**
   * Calculate history statistics
   */
  calculateHistoryStats(transactions) {
    return transactions.reduce((stats, transaction) => {
      if (transaction.type === 'purchase') {
        stats.totalPurchased += transaction.amount;
      } else if (transaction.type === 'deduction') {
        stats.totalUsed += transaction.amount;
      }
      return stats;
    }, { totalPurchased: 0, totalUsed: 0 });
  }

  /**
   * Update history statistics display
   */
  updateHistoryStats(stats) {
    const totalPurchased = document.getElementById('historyTotalPurchased');
    const totalUsed = document.getElementById('historyTotalUsed');
    
    if (totalPurchased) totalPurchased.textContent = `${stats.totalPurchased} credits`;
    if (totalUsed) totalUsed.textContent = `${stats.totalUsed} credits`;
  }

  /**
   * Render transaction item
   */
  renderTransactionItem(transaction) {
    const date = new Date(transaction.timestamp).toLocaleDateString();
    const time = new Date(transaction.timestamp).toLocaleTimeString();
    const typeClass = transaction.type === 'purchase' ? 'credit' : 'debit';
    const sign = transaction.type === 'purchase' ? '+' : '-';
    const icon = transaction.type === 'purchase' ? 'fa-plus' : 'fa-minus';
    
    return `
      <div class="history-item ${typeClass}">
        <div class="history-icon">
          <i class="fas ${icon}"></i>
        </div>
        <div class="history-details">
          <div class="history-operation">${transaction.operation}</div>
          <div class="history-date">${date} ${time}</div>
        </div>
        <div class="history-amount ${typeClass}">
          ${sign}${transaction.amount} credits
        </div>
      </div>
    `;
  }

  /**
   * Export credit data
   */
  async exportCreditData() {
    try {
      const data = await this.creditManager.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `credit-history-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      this.showToast('Credit data exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      this.showToast('Failed to export data', 'error');
    }
  }

  /**
   * Generate backup codes
   */
  async generateBackupCodes() {
    try {
      const codes = await this.creditManager.generateBackupCodes();
      this.showBackupCodesModal(codes);
    } catch (error) {
      console.error('Failed to generate backup codes:', error);
      this.showToast('Failed to generate backup codes', 'error');
    }
  }

  /**
   * Show backup codes modal
   */
  showBackupCodesModal(codes) {
    const modalHTML = `
      <div id="backupCodesModal" class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Backup Codes Generated</h2>
            <button onclick="this.closest('.modal-overlay').remove()" class="modal-close-button">&times;</button>
          </div>
          <div class="modal-body">
            <p><strong>Important:</strong> Save these codes in a secure location. Each code can only be used once.</p>
            <div class="backup-codes-list">
              ${codes.map(code => `<div class="backup-code">${code}</div>`).join('')}
            </div>
            <div class="backup-actions">
              <button onclick="this.downloadBackupCodes('${codes.join('\\n')}')" class="button-primary">
                <i class="fas fa-download"></i> Download Codes
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  /**
   * Get cost preview as a promise
   */
  getCostPreview(operation) {
    return new Promise((resolve) => {
      this.showCostPreview(operation, (confirmed) => {
        resolve(confirmed);
      });
    });
  }
}