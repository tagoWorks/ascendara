class ImageCacheService {
  constructor() {
    this.memoryCache = new Map();
    this.inProgress = new Map();
    this.maxMemoryCacheSize = 50;
    this.cacheLifetime = 30 * 60 * 1000; // 30 minutes
    this.dbName = 'imageCache';
    this.storeName = 'images';
    this.blobUrls = new Map(); // Track active blob URLs
    this.initializeDB();
  }

  async initializeDB() {
    try {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.cleanupOldCache();
      };
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
    }
  }

  async cleanupOldCache() {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      const cutoffTime = Date.now() - this.cacheLifetime;
      const range = IDBKeyRange.upperBound(cutoffTime);
      
      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    } catch (error) {
      console.error('Error cleaning up old cache:', error);
    }
  }

  async getFromIndexedDB(imgID) {
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(imgID);

        request.onsuccess = () => {
          const result = request.result;
          if (result && Date.now() - result.timestamp < this.cacheLifetime) {
            resolve(result.blob);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error('Error reading from IndexedDB:', request.error);
          resolve(null);
        };
      } catch (error) {
        console.error('Error accessing IndexedDB:', error);
        resolve(null);
      }
    });
  }

  async saveToIndexedDB(imgID, blob) {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      await store.put({
        id: imgID,
        blob,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error saving to IndexedDB:', error);
    }
  }

  pruneMemoryCache() {
    if (this.memoryCache.size > this.maxMemoryCacheSize) {
      const entriesToRemove = this.memoryCache.size - this.maxMemoryCacheSize;
      const entries = Array.from(this.memoryCache.entries());
      entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, entriesToRemove)
        .forEach(([key]) => {
          // Revoke old blob URL if it exists
          if (this.blobUrls.has(key)) {
            URL.revokeObjectURL(this.blobUrls.get(key));
            this.blobUrls.delete(key);
          }
          this.memoryCache.delete(key);
        });
    }
  }

  createBlobUrl(imgID, blob) {
    // Revoke old URL if it exists
    if (this.blobUrls.has(imgID)) {
      URL.revokeObjectURL(this.blobUrls.get(imgID));
    }
    const url = URL.createObjectURL(blob);
    this.blobUrls.set(imgID, url);
    return url;
  }

  async getImage(imgID, retryCount = 0) {
    if (!imgID) return null;
    const maxRetries = 3;

    try {
      // Check memory cache first
      if (this.memoryCache.has(imgID)) {
        const cached = this.memoryCache.get(imgID);
        if (Date.now() - cached.timestamp < this.cacheLifetime) {
          // Create new blob URL if the old one is invalid
          if (!this.blobUrls.has(imgID)) {
            return this.createBlobUrl(imgID, cached.blob);
          }
          return this.blobUrls.get(imgID);
        }
        this.memoryCache.delete(imgID);
        if (this.blobUrls.has(imgID)) {
          URL.revokeObjectURL(this.blobUrls.get(imgID));
          this.blobUrls.delete(imgID);
        }
      }

      // Check IndexedDB cache
      const cachedBlob = await this.getFromIndexedDB(imgID);
      if (cachedBlob) {
        const url = this.createBlobUrl(imgID, cachedBlob);
        this.memoryCache.set(imgID, {
          blob: cachedBlob,
          timestamp: Date.now()
        });
        this.pruneMemoryCache();
        return url;
      }

      // Return in-progress request if exists
      if (this.inProgress.has(imgID)) {
        return this.inProgress.get(imgID);
      }

      // Create new request
      const promise = this.fetchAndCacheImage(imgID);
      this.inProgress.set(imgID, promise);

      try {
        const result = await promise;
        if (result) {
          const url = this.createBlobUrl(imgID, result);
          this.memoryCache.set(imgID, {
            blob: result,
            timestamp: Date.now()
          });
          this.pruneMemoryCache();
          await this.saveToIndexedDB(imgID, result);
          return url;
        }
        return null;
      } finally {
        this.inProgress.delete(imgID);
      }
    } catch (error) {
      console.error(`Error in getImage for ${imgID}:`, error);
      
      // Retry logic for failed requests
      if (retryCount < maxRetries) {
        console.log(`Retrying image ${imgID}, attempt ${retryCount + 1}`);
        return this.getImage(imgID, retryCount + 1);
      }
      
      return null;
    }
  }

  async fetchAndCacheImage(imgID, retryCount = 0) {
    const maxRetries = 3;
    const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff capped at 5 seconds

    try {
      const response = await fetch(`https://api.ascendara.app/image/${imgID}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Retrieved blob is empty or invalid');
      }
      
      return blob;
    } catch (error) {
      console.error(`Error fetching image ${imgID} (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
      
      // For network errors or server errors, retry with backoff
      if (retryCount < maxRetries && 
          (error instanceof TypeError || // Network errors
           (error.message && error.message.includes('HTTP error')))) { // Server errors
        
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return this.fetchAndCacheImage(imgID, retryCount + 1);
      }
      
      // If all retries failed or other error type, return null
      console.error(`All attempts to fetch image ${imgID} failed:`, error);
      return null;
    }
  }

  clearCache() {
    // Revoke all blob URLs
    for (const url of this.blobUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls.clear();
    this.memoryCache.clear();
    
    if (this.db) {
      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        store.clear();
      } catch (error) {
        console.error('Error clearing IndexedDB cache:', error);
      }
    }
  }
}

export default new ImageCacheService();