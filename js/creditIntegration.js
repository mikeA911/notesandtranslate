/**
 * Credit Integration Module
 * Integrates the credit system with existing app functions
 */

export class CreditIntegration {
  constructor(creditManager, creditUI) {
    this.creditManager = creditManager;
    this.creditUI = creditUI;
    this.originalFunctions = {};
  }

  /**
   * Initialize credit integration
   */
  async initialize() {
    console.log('Initializing credit integration...');
    
    // Initialize credit system
    await this.creditManager.initialize();
    await this.creditUI.initialize();
    
    console.log('Credit integration initialized successfully');
  }

  /**
   * Wrap an existing function to include credit validation and deduction
   */
  wrapFunction(object, functionName, operation, metadata = {}) {
    // Store original function if not already stored
    if (!this.originalFunctions[`${object.constructor.name}.${functionName}`]) {
      this.originalFunctions[`${object.constructor.name}.${functionName}`] = object[functionName].bind(object);
    }

    const originalFunction = this.originalFunctions[`${object.constructor.name}.${functionName}`];

    object[functionName] = async (...args) => {
      try {
        // Check if user has sufficient credits
        const cost = this.creditManager.getCost(operation);
        const hasCredits = this.creditManager.hasSufficientCredits(cost);
        
        if (!hasCredits) {
          // Show purchase modal instead of cost preview for insufficient credits
          this.creditUI.showPurchaseModal();
          throw new Error(`Insufficient credits for ${operation}. Need ${cost} credits, have ${this.creditManager.getBalance()}.`);
        }

        // Show cost preview and get user confirmation
        const confirmed = await this.creditUI.getCostPreview(operation);
        
        if (!confirmed) {
          console.log(`User cancelled ${operation} operation`);
          return null;
        }

        // Execute the original function
        console.log(`Executing ${operation} operation...`);
        const result = await originalFunction(...args);
        
        // Only deduct credits if the operation was successful
        if (result !== null && result !== undefined) {
          await this.creditManager.deductCredits(cost, operation, {
            ...metadata,
            timestamp: Date.now(),
            args: args.length, // Don't store actual args for privacy
            success: true
          });
          
          console.log(`Successfully completed ${operation} operation and deducted ${cost} credits`);
        } else {
          console.log(`Operation ${operation} returned null/undefined, no credits deducted`);
        }
        
        return result;
      } catch (error) {
        console.error(`Error in credit-wrapped ${operation} operation:`, error);
        
        // If it's a credit-related error, don't execute the original function
        if (error.message.includes('credits') || error.message.includes('Credits')) {
          throw error;
        }
        
        // For other errors, still try to execute the original function
        // but don't deduct credits if it fails
        try {
          return await originalFunction(...args);
        } catch (originalError) {
          console.error(`Original function ${functionName} also failed:`, originalError);
          throw originalError;
        }
      }
    };
  }

  /**
   * Wrap translation function specifically
   */
  wrapTranslationFunction(app, functionName) {
    this.wrapFunction(app, functionName, 'translate', {
      type: 'translation',
      source: 'user_text'
    });
  }

  /**
   * Wrap polishing function specifically  
   */
  wrapPolishingFunction(app, functionName) {
    this.wrapFunction(app, functionName, 'polish', {
      type: 'polishing', 
      source: 'voice_input'
    });
  }

  /**
   * Wrap complete workflow function (polish + translate)
   */
  wrapCompleteWorkflowFunction(app, functionName) {
    // Store original function if not already stored
    if (!this.originalFunctions[`${app.constructor.name}.${functionName}`]) {
      this.originalFunctions[`${app.constructor.name}.${functionName}`] = app[functionName].bind(app);
    }

    const originalFunction = this.originalFunctions[`${app.constructor.name}.${functionName}`];

    app[functionName] = async (...args) => {
      try {
        // For complete workflow, we charge the complete cost upfront
        const cost = this.creditManager.getCost('complete');
        const hasCredits = this.creditManager.hasSufficientCredits(cost);
        
        if (!hasCredits) {
          this.creditUI.showPurchaseModal();
          throw new Error(`Insufficient credits for complete workflow. Need ${cost} credits, have ${this.creditManager.getBalance()}.`);
        }

        // Show cost preview and get user confirmation
        const confirmed = await this.creditUI.getCostPreview('complete');
        
        if (!confirmed) {
          console.log('User cancelled complete workflow operation');
          return null;
        }

        // Execute the original function
        console.log('Executing complete workflow operation...');
        const result = await originalFunction(...args);
        
        // Only deduct credits if the operation was successful
        if (result !== null && result !== undefined) {
          await this.creditManager.deductCredits(cost, 'complete', {
            type: 'complete_workflow',
            source: 'voice_to_translation',
            timestamp: Date.now(),
            args: args.length,
            success: true
          });
          
          console.log(`Successfully completed workflow operation and deducted ${cost} credits`);
        }
        
        return result;
      } catch (error) {
        console.error('Error in credit-wrapped complete workflow operation:', error);
        
        if (error.message.includes('credits') || error.message.includes('Credits')) {
          throw error;
        }
        
        try {
          return await originalFunction(...args);
        } catch (originalError) {
          console.error(`Original workflow function also failed:`, originalError);
          throw originalError;
        }
      }
    };
  }

  /**
   * Create a credit-aware translation button
   */
  createCreditAwareTranslationButton(language, originalOnClick) {
    return async (event) => {
      try {
        // Check credits before translation
        const cost = this.creditManager.getCost('translate');
        const hasCredits = this.creditManager.hasSufficientCredits(cost);
        
        if (!hasCredits) {
          this.creditUI.showPurchaseModal();
          return;
        }

        // Show cost preview
        const confirmed = await this.creditUI.getCostPreview('translate');
        if (!confirmed) {
          return;
        }

        // Execute original translation logic
        const result = await originalOnClick(event);
        
        // Deduct credits after successful translation
        if (result !== false) { // Assuming false indicates failure
          await this.creditManager.deductCredits(cost, 'translate', {
            language: language,
            type: 'individual_translation',
            timestamp: Date.now()
          });
        }
        
        return result;
      } catch (error) {
        console.error('Error in credit-aware translation:', error);
        throw error;
      }
    };
  }

  /**
   * Add credit validation to existing buttons
   */
  addCreditValidationToButtons() {
    // Find translation buttons and wrap their event handlers
    const translationArea = document.getElementById('translationControls');
    if (translationArea) {
      // We'll need to update this when the buttons are created
      // This is a placeholder for the integration
      console.log('Translation area found, ready for credit integration');
    }
  }

  /**
   * Show insufficient credit warning
   */
  showInsufficientCreditWarning(operation, requiredCredits) {
    const currentBalance = this.creditManager.getBalance();
    const deficit = requiredCredits - currentBalance;
    
    const message = `Need ${deficit} more credits for ${operation}`;
    this.creditUI.showToast(message, 'error');
    
    // Also show the purchase modal after a short delay
    setTimeout(() => {
      this.creditUI.showPurchaseModal();
    }, 1500);
  }

  /**
   * Create a wrapper for voice recording that checks credits before processing
   */
  wrapVoiceRecording(app, processRecordingFunction) {
    const originalProcess = app[processRecordingFunction].bind(app);
    
    app[processRecordingFunction] = async (...args) => {
      try {
        // Determine what type of processing will happen
        // This depends on the app's current state - are we translating or just polishing?
        
        // For now, assume complete workflow (polish + translate)
        // In a real implementation, you'd check the app state
        const operation = 'complete'; // or 'polish' if just taking notes
        const cost = this.creditManager.getCost(operation);
        
        if (!this.creditManager.hasSufficientCredits(cost)) {
          this.showInsufficientCreditWarning(operation, cost);
          return;
        }

        // Show cost preview before processing
        const confirmed = await this.creditUI.getCostPreview(operation);
        if (!confirmed) {
          return;
        }

        // Process the recording
        const result = await originalProcess(...args);
        
        // Deduct credits after successful processing
        if (result) {
          await this.creditManager.deductCredits(cost, operation, {
            type: 'voice_processing',
            timestamp: Date.now(),
            recordingDuration: args[0] ? args[0].duration : 'unknown'
          });
        }
        
        return result;
      } catch (error) {
        console.error('Error in credit-aware voice processing:', error);
        throw error;
      }
    };
  }

  /**
   * Get current credit status for display
   */
  getCreditStatus() {
    return {
      balance: this.creditManager.getBalance(),
      formatted: this.creditManager.getFormattedBalance(),
      isLow: this.creditManager.isRunningLow(),
      costs: {
        polish: this.creditManager.getCost('polish'),
        translate: this.creditManager.getCost('translate'),
        complete: this.creditManager.getCost('complete')
      }
    };
  }

  /**
   * Handle credit purchase completion
   */
  onPurchaseComplete(result) {
    console.log('Credit purchase completed:', result);
    this.creditUI.showToast(`Added ${result.added} credits! New balance: ${result.newBalance}`, 'success');
  }

  /**
   * Handle credit deduction completion
   */
  onCreditDeducted(result) {
    console.log('Credits deducted:', result);
    
    // Show low balance warning if needed
    if (this.creditManager.isRunningLow(result.newBalance)) {
      setTimeout(() => {
        this.creditUI.showLowBalanceWarning();
      }, 1000);
    }
  }

  /**
   * Create demo credits for testing (remove in production)
   */
  async addDemoCredits(amount = 100) {
    try {
      const result = await this.creditManager.addCredits(amount, 'demo', {
        note: 'Demo credits for testing'
      });
      this.creditUI.showToast(`Added ${amount} demo credits!`, 'success');
      return result;
    } catch (error) {
      console.error('Failed to add demo credits:', error);
      this.creditUI.showToast('Failed to add demo credits', 'error');
    }
  }

  /**
   * Reset credit system (for testing)
   */
  async resetCreditSystem() {
    try {
      await this.creditManager.clearAllData();
      this.creditUI.showToast('Credit system reset', 'success');
    } catch (error) {
      console.error('Failed to reset credit system:', error);
      this.creditUI.showToast('Failed to reset credit system', 'error');
    }
  }
}