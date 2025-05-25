/**
 * authMutex.js
 * Mutex to prevent race conditions in authentication processes
 */

class AuthMutex {
  constructor() {
    this.locked = false;
    this.queue = [];
    this.lastAuthTime = 0;
    this.authCooldown = 2000; // 2 seconds between auth attempts
    this.maxQueueSize = 5;
  }

  /**
   * Acquire the mutex lock
   * @returns {Promise<void>}
   */
  async acquire() {
    return new Promise((resolve, reject) => {
      // Check queue size to prevent memory issues
      if (this.queue.length >= this.maxQueueSize) {
        reject(new Error('Authentication queue is full'));
        return;
      }

      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push({ resolve, reject, timestamp: Date.now() });
      }
    });
  }

  /**
   * Release the mutex lock
   */
  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      
      // Check if queued request is still valid (not too old)
      const age = Date.now() - next.timestamp;
      if (age > 10000) { // 10 seconds timeout
        console.warn('[AUTH] Discarding old authentication request');
        next.reject(new Error('Authentication request timeout'));
        this.release(); // Try next in queue
        return;
      }
      
      next.resolve();
    } else {
      this.locked = false;
    }
  }

  /**
   * Execute an async function with mutex protection
   * @param {Function} asyncFn - Async function to execute
   * @returns {Promise<any>} - Result of the async function
   */
  async execute(asyncFn) {
    try {
      await this.acquire();
      return await asyncFn();
    } finally {
      this.release();
    }
  }

  /**
   * Execute authentication with cooldown protection
   * @param {Function} authFn - Authentication function
   * @returns {Promise<any>} - Result of authentication
   */
  async executeAuth(authFn) {
    return this.execute(async () => {
      const now = Date.now();
      const timeSinceLastAuth = now - this.lastAuthTime;
      
      if (timeSinceLastAuth < this.authCooldown) {
        const remainingCooldown = this.authCooldown - timeSinceLastAuth;
        console.log(`[AUTH] Cooldown active, waiting ${remainingCooldown}ms`);
        await new Promise(resolve => setTimeout(resolve, remainingCooldown));
      }
      
      this.lastAuthTime = Date.now();
      return await authFn();
    });
  }

  /**
   * Check if authentication is currently locked
   * @returns {boolean}
   */
  isLocked() {
    return this.locked;
  }

  /**
   * Get queue information
   * @returns {Object}
   */
  getQueueInfo() {
    return {
      locked: this.locked,
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      lastAuthTime: this.lastAuthTime,
      cooldownRemaining: Math.max(0, this.authCooldown - (Date.now() - this.lastAuthTime))
    };
  }

  /**
   * Clear the authentication queue (emergency cleanup)
   */
  clearQueue() {
    const queueSize = this.queue.length;
    
    // Reject all queued promises
    for (const item of this.queue) {
      item.reject(new Error('Authentication queue cleared'));
    }
    
    this.queue = [];
    this.locked = false;
    
    if (queueSize > 0) {
      console.log(`[AUTH] Cleared ${queueSize} queued authentication requests`);
    }
  }

  /**
   * Reset the mutex state (for testing or emergency situations)
   */
  reset() {
    this.clearQueue();
    this.lastAuthTime = 0;
    console.log('[AUTH] Mutex state reset');
  }
}

// Export singleton instance
const authMutex = new AuthMutex();

export default authMutex;