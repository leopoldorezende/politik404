/**
 * storageService.js
 * Unified storage abstraction to standardize localStorage vs sessionStorage usage
 */

class StorageService {
  static STORAGE_TYPES = {
    SESSION: 'session',     // Clears when tab/browser closes
    PERSISTENT: 'persistent' // Persists across browser sessions
  };

  // Centralized key definitions with their storage preferences
  static KEYS = {
    // Authentication & Session (should clear on browser close)
    USERNAME: { key: 'username', type: this.STORAGE_TYPES.SESSION },
    PENDING_ROOM: { key: 'pendingRoom', type: this.STORAGE_TYPES.SESSION },
    MY_COUNTRY: { key: 'myCountry', type: this.STORAGE_TYPES.SESSION },
    
    // Client Identity (should persist across sessions)
    CLIENT_SESSION_ID: { key: 'clientSessionId', type: this.STORAGE_TYPES.PERSISTENT },
    
    // Recovery Data (should persist for recovery purposes)
    COUNTRY_STATES: { key: 'countryStates_v1', type: this.STORAGE_TYPES.PERSISTENT },
    LAST_SYNC: { key: 'lastSync_v1', type: this.STORAGE_TYPES.PERSISTENT },
    
    // Temporary UI State (should clear on browser close)
    CHAT_INPUT_FOCUSED: { key: 'chatInputFocused', type: this.STORAGE_TYPES.SESSION },
    SIDEBAR_STATE: { key: 'sidebarState', type: this.STORAGE_TYPES.SESSION }
  };

  /**
   * Get the appropriate storage object based on type
   * @param {string} storageType - SESSION or PERSISTENT
   * @returns {Storage} - localStorage or sessionStorage
   */
  static getStorage(storageType) {
    return storageType === this.STORAGE_TYPES.SESSION ? sessionStorage : localStorage;
  }

  /**
   * Set a value in storage
   * @param {Object} keyConfig - Key configuration object
   * @param {any} value - Value to store (will be JSON stringified if object)
   * @param {Object} options - Additional options
   */
  static set(keyConfig, value, options = {}) {
    try {
      const storage = this.getStorage(keyConfig.type);
      const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      storage.setItem(keyConfig.key, serializedValue);
      
      // Optional: Add timestamp for tracking
      if (options.withTimestamp) {
        storage.setItem(`${keyConfig.key}_timestamp`, Date.now().toString());
      }
      
      return true;
    } catch (error) {
      console.error(`[STORAGE] Failed to set ${keyConfig.key}:`, error);
      return false;
    }
  }

  /**
   * Get a value from storage
   * @param {Object} keyConfig - Key configuration object
   * @param {any} defaultValue - Default value if not found
   * @param {Object} options - Additional options
   * @returns {any} - Retrieved value or default
   */
  static get(keyConfig, defaultValue = null, options = {}) {
    try {
      const storage = this.getStorage(keyConfig.type);
      const value = storage.getItem(keyConfig.key);
      
      if (value === null) {
        return defaultValue;
      }
      
      // Try to parse as JSON, fall back to string
      if (options.parseJSON !== false) {
        try {
          return JSON.parse(value);
        } catch {
          // If JSON parsing fails, return as string
          return value;
        }
      }
      
      return value;
    } catch (error) {
      console.error(`[STORAGE] Failed to get ${keyConfig.key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Remove a value from storage
   * @param {Object} keyConfig - Key configuration object
   */
  static remove(keyConfig) {
    try {
      const storage = this.getStorage(keyConfig.type);
      storage.removeItem(keyConfig.key);
      
      // Also remove timestamp if it exists
      storage.removeItem(`${keyConfig.key}_timestamp`);
      
      return true;
    } catch (error) {
      console.error(`[STORAGE] Failed to remove ${keyConfig.key}:`, error);
      return false;
    }
  }

  /**
   * Check if a key exists in storage
   * @param {Object} keyConfig - Key configuration object
   * @returns {boolean}
   */
  static exists(keyConfig) {
    try {
      const storage = this.getStorage(keyConfig.type);
      return storage.getItem(keyConfig.key) !== null;
    } catch (error) {
      console.error(`[STORAGE] Failed to check existence of ${keyConfig.key}:`, error);
      return false;
    }
  }

  /**
   * Get timestamp of when a value was stored (if withTimestamp was used)
   * @param {Object} keyConfig - Key configuration object
   * @returns {number|null} - Timestamp or null if not found
   */
  static getTimestamp(keyConfig) {
    try {
      const storage = this.getStorage(keyConfig.type);
      const timestamp = storage.getItem(`${keyConfig.key}_timestamp`);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      console.error(`[STORAGE] Failed to get timestamp for ${keyConfig.key}:`, error);
      return null;
    }
  }

  /**
   * Clear all storage of a specific type
   * @param {string} storageType - SESSION or PERSISTENT
   * @param {Array<string>} excludeKeys - Keys to exclude from clearing
   */
  static clearByType(storageType, excludeKeys = []) {
    try {
      const storage = this.getStorage(storageType);
      const keysToRemove = [];
      
      // Collect keys to remove (excluding specified keys)
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && !excludeKeys.includes(key)) {
          keysToRemove.push(key);
        }
      }
      
      // Remove collected keys
      keysToRemove.forEach(key => storage.removeItem(key));
      
      console.log(`[STORAGE] Cleared ${keysToRemove.length} keys from ${storageType} storage`);
      return keysToRemove.length;
    } catch (error) {
      console.error(`[STORAGE] Failed to clear ${storageType} storage:`, error);
      return 0;
    }
  }

  /**
   * Migrate data from old storage patterns to new standardized keys
   * @param {Object} migrationMap - Map of old key -> new keyConfig
   */
  static migrate(migrationMap) {
    let migrated = 0;
    
    Object.entries(migrationMap).forEach(([oldKey, newKeyConfig]) => {
      try {
        // Check both localStorage and sessionStorage for old key
        const localValue = localStorage.getItem(oldKey);
        const sessionValue = sessionStorage.getItem(oldKey);
        
        if (localValue !== null) {
          this.set(newKeyConfig, localValue);
          localStorage.removeItem(oldKey);
          migrated++;
          // console.log(`[STORAGE] Migrated ${oldKey} from localStorage to ${newKeyConfig.type}`);
        }
        
        if (sessionValue !== null) {
          this.set(newKeyConfig, sessionValue);
          sessionStorage.removeItem(oldKey);
          migrated++;
          // console.log(`[STORAGE] Migrated ${oldKey} from sessionStorage to ${newKeyConfig.type}`);
        }
      } catch (error) {
        console.error(`[STORAGE] Failed to migrate ${oldKey}:`, error);
      }
    });
    
    if (migrated > 0) {
      // console.log(`[STORAGE] Migration completed: ${migrated} keys migrated`);
    }
    
    return migrated;
  }

  /**
   * Get storage usage statistics
   * @returns {Object} - Usage statistics
   */
  static getStats() {
    const getStorageSize = (storage) => {
      let size = 0;
      let count = 0;
      
      for (let key in storage) {
        if (storage.hasOwnProperty(key)) {
          size += storage[key].length + key.length;
          count++;
        }
      }
      
      return { size, count };
    };
    
    const localStats = getStorageSize(localStorage);
    const sessionStats = getStorageSize(sessionStorage);
    
    return {
      localStorage: localStats,
      sessionStorage: sessionStats,
      total: {
        size: localStats.size + sessionStats.size,
        count: localStats.count + sessionStats.count
      }
    };
  }

  /**
   * Cleanup old or expired data
   * @param {number} maxAge - Maximum age in milliseconds (default: 7 days)
   */
  static cleanup(maxAge = 7 * 24 * 60 * 60 * 1000) {
    let cleaned = 0;
    const now = Date.now();
    
    // Check both storage types
    [localStorage, sessionStorage].forEach(storage => {
      const keysToRemove = [];
      
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.endsWith('_timestamp')) {
          const timestamp = parseInt(storage.getItem(key), 10);
          if (now - timestamp > maxAge) {
            const dataKey = key.replace('_timestamp', '');
            keysToRemove.push(key, dataKey);
          }
        }
      }
      
      keysToRemove.forEach(key => {
        storage.removeItem(key);
        cleaned++;
      });
    });
    
    if (cleaned > 0) {
      console.log(`[STORAGE] Cleanup completed: ${cleaned} expired items removed`);
    }
    
    return cleaned;
  }
}

export default StorageService;