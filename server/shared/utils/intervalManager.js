/**
 * intervalManager.js
 * Centralized management of all intervals to prevent memory leaks
 */

class IntervalManager {
  constructor() {
    this.intervals = new Map(); // id -> { intervalId, type, metadata }
    this.timeouts = new Map(); // id -> { timeoutId, type, metadata }
    this.nextId = 1;
    this.stats = {
      created: 0,
      cleared: 0,
      active: 0
    };
  }

  /**
   * Register a new interval
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @param {string} type - Type identifier for grouping
   * @param {Object} metadata - Additional metadata
   * @returns {string} - Unique ID for the interval
   */
  register(callback, delay, type, metadata = {}) {
    const id = `${type}_${this.nextId++}`;
    const intervalId = setInterval(callback, delay);
    
    this.intervals.set(id, { 
      intervalId, 
      type, 
      metadata,
      createdAt: Date.now(),
      delay
    });
    
    this.stats.created++;
    this.stats.active++;
    
    console.log(`[INTERVAL] Registered ${type} interval with ID: ${id}`);
    return id;
  }

  /**
   * Register a new timeout
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @param {string} type - Type identifier for grouping
   * @param {Object} metadata - Additional metadata
   * @returns {string} - Unique ID for the timeout
   */
  registerTimeout(callback, delay, type, metadata = {}) {
    const id = `${type}_timeout_${this.nextId++}`;
    const timeoutId = setTimeout(() => {
      callback();
      this.timeouts.delete(id); // Auto-cleanup completed timeouts
    }, delay);
    
    this.timeouts.set(id, { 
      timeoutId, 
      type, 
      metadata,
      createdAt: Date.now(),
      delay
    });
    
    this.stats.created++;
    this.stats.active++;
    
    console.log(`[TIMEOUT] Registered ${type} timeout with ID: ${id}`);
    return id;
  }

  /**
   * Clear a specific interval or timeout
   * @param {string} id - ID of the interval/timeout to clear
   * @returns {boolean} - True if cleared successfully
   */
  clear(id) {
    // Try intervals first
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval.intervalId);
      this.intervals.delete(id);
      this.stats.cleared++;
      this.stats.active--;
      console.log(`[INTERVAL] Cleared interval: ${id}`);
      return true;
    }
    
    // Try timeouts
    const timeout = this.timeouts.get(id);
    if (timeout) {
      clearTimeout(timeout.timeoutId);
      this.timeouts.delete(id);
      this.stats.cleared++;
      this.stats.active--;
      console.log(`[TIMEOUT] Cleared timeout: ${id}`);
      return true;
    }
    
    console.warn(`[INTERVAL] ID not found: ${id}`);
    return false;
  }

  /**
   * Clear all intervals/timeouts of a specific type
   * @param {string} type - Type to clear
   * @returns {number} - Number of intervals/timeouts cleared
   */
  clearByType(type) {
    let cleared = 0;
    
    // Clear intervals by type
    for (const [id, interval] of this.intervals.entries()) {
      if (interval.type === type) {
        clearInterval(interval.intervalId);
        this.intervals.delete(id);
        cleared++;
        this.stats.cleared++;
        this.stats.active--;
      }
    }
    
    // Clear timeouts by type
    for (const [id, timeout] of this.timeouts.entries()) {
      if (timeout.type === type) {
        clearTimeout(timeout.timeoutId);
        this.timeouts.delete(id);
        cleared++;
        this.stats.cleared++;
        this.stats.active--;
      }
    }
    
    if (cleared > 0) {
      console.log(`[INTERVAL] Cleared ${cleared} intervals/timeouts of type: ${type}`);
    }
    
    return cleared;
  }

  /**
   * Clear all intervals and timeouts
   */
  cleanup() {
    let totalCleared = 0;
    
    // Clear all intervals
    for (const [id, interval] of this.intervals.entries()) {
      clearInterval(interval.intervalId);
      totalCleared++;
    }
    this.intervals.clear();
    
    // Clear all timeouts
    for (const [id, timeout] of this.timeouts.entries()) {
      clearTimeout(timeout.timeoutId);
      totalCleared++;
    }
    this.timeouts.clear();
    
    this.stats.cleared += totalCleared;
    this.stats.active = 0;
    
    console.log(`[INTERVAL] Cleanup completed: ${totalCleared} intervals/timeouts cleared`);
  }

  /**
   * Get statistics about intervals and timeouts
   * @returns {Object} - Statistics object
   */
  getStats() {
    const intervalsByType = {};
    const timeoutsByType = {};
    
    // Count intervals by type
    for (const [id, interval] of this.intervals.entries()) {
      intervalsByType[interval.type] = (intervalsByType[interval.type] || 0) + 1;
    }
    
    // Count timeouts by type
    for (const [id, timeout] of this.timeouts.entries()) {
      timeoutsByType[timeout.type] = (timeoutsByType[timeout.type] || 0) + 1;
    }
    
    return {
      ...this.stats,
      activeIntervals: this.intervals.size,
      activeTimeouts: this.timeouts.size,
      intervalsByType,
      timeoutsByType
    };
  }

  /**
   * Get detailed information about all active intervals and timeouts
   * @returns {Object} - Detailed information
   */
  getDetails() {
    const intervals = Array.from(this.intervals.entries()).map(([id, data]) => ({
      id,
      type: data.type,
      metadata: data.metadata,
      createdAt: data.createdAt,
      delay: data.delay,
      age: Date.now() - data.createdAt
    }));
    
    const timeouts = Array.from(this.timeouts.entries()).map(([id, data]) => ({
      id,
      type: data.type,
      metadata: data.metadata,
      createdAt: data.createdAt,
      delay: data.delay,
      age: Date.now() - data.createdAt
    }));
    
    return { intervals, timeouts };
  }
}

// Export singleton instance
const intervalManager = new IntervalManager();

// Register cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('SIGINT', () => {
    console.log('Process SIGINT: Cleaning up intervals...');
    intervalManager.cleanup();
  });
  
  process.on('SIGTERM', () => {
    console.log('Process SIGTERM: Cleaning up intervals...');
    intervalManager.cleanup();
  });
}

export default intervalManager;