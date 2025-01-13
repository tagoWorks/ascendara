class ImageCacheService {
  constructor() {
    this.memoryCache = new Map();
    this.inProgress = new Map();
    this.maxMemoryCacheSize = 50;
    this.cacheLifetime = 30 * 60 * 1000; // 30 minutes
    this.dbName = 'imageCache';
    this.storeName = 'images';
    this.blobUrls = new Map(); // Track active blob URLs
    this.dbInitialized = false;
    this.dbInitPromise = null;  
    this.initializationInProgress = false;  
    
    // Add rate limiting
    this.maxConcurrentRequests = 6;
    this.requestQueue = [];
    this.activeRequests = 0;

    // Start initialization
    this.ensureInitialized();
  }

  async ensureInitialized() {
    if (this.dbInitialized) return Promise.resolve();
    if (this.initializationInProgress) return this.dbInitPromise;
    
    this.initializationInProgress = true;
    this.dbInitPromise = this.initializeDB();
    return this.dbInitPromise;
  }

  async initializeDB() {
    if (this.dbInitialized) return;

    try {
      await new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        
        request.onerror = (event) => {
          console.error('IndexedDB error:', event.target.error);
          reject(event.target.error);
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
          this.dbInitialized = true;
          resolve();
        };
      });

      await this.cleanupOldCache();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      this.dbInitialized = false;
    }
  }

  async cleanupOldCache() {
    if (!this.dbInitialized) return;

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
    if (!this.dbInitialized) return null;

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
    if (!this.dbInitialized) return;

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

  async fetchAndCacheImage(imgID) {
    const maxRetries = 3;
    const timeout = 15000; // 15 seconds timeout
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[ImageCache] Fetching image ${imgID} (attempt ${attempt + 1}/${maxRetries})`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.warn(`[ImageCache] Request timeout for image ${imgID}`);
        }, timeout);

        try {
          // Use HTTP/1.1 for more reliable image fetching
          const response = await fetch(`https://api.ascendara.app/image/${imgID}`, {
            signal: controller.signal,
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
              'Connection': 'keep-alive',
              'Accept': 'image/*'
            },
            // Force HTTP/1.1
            cache: 'no-store',
            mode: 'cors',
            keepalive: true
          });
          
          if (!response.ok) {
            console.error(`[ImageCache] Failed to fetch image ${imgID}: HTTP ${response.status} - ${response.statusText}`);
            if (attempt < maxRetries - 1) {
              const backoffTime = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff
              console.log(`[ImageCache] Retrying image ${imgID} in ${backoffTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, backoffTime));
              continue;
            }
            return null;
          }
          
          const blob = await response.blob();
          if (!blob || blob.size === 0) {
            console.error(`[ImageCache] Received empty blob for image ${imgID} (size: ${blob?.size ?? 0} bytes)`);
            if (attempt < maxRetries - 1) continue;
            return null;
          }

          // Validate blob type
          if (!blob.type.startsWith('image/')) {
            console.error(`[ImageCache] Invalid blob type for image ${imgID}: ${blob.type}`);
            return null;
          }

          console.log(`[ImageCache] Successfully fetched image ${imgID} (size: ${blob.size} bytes)`);
          return blob;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.error(`[ImageCache] Request aborted for image ${imgID} due to timeout`);
        } else {
          console.error(`[ImageCache] Error fetching image ${imgID}:`, error.message);
        }
        
        // Clean up any existing blob URLs
        this.cleanupBlobUrl(imgID);
        
        if (attempt < maxRetries - 1 && error.name !== 'AbortError') {
          const backoffTime = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff
          console.log(`[ImageCache] Retrying image ${imgID} in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          continue;
        }
        return null;
      }
    }
    console.error(`[ImageCache] All retry attempts failed for image ${imgID}`);
    return null;
  }

  cleanupBlobUrl(imgID) {
    if (this.blobUrls.has(imgID)) {
      try {
        URL.revokeObjectURL(this.blobUrls.get(imgID));
      } catch (error) {
        console.warn(`[ImageCache] Error revoking blob URL for ${imgID}:`, error);
      }
      this.blobUrls.delete(imgID);
    }
  }

  createBlobUrl(imgID, blob) {
    this.cleanupBlobUrl(imgID);
    try {
      const url = URL.createObjectURL(blob);
      this.blobUrls.set(imgID, url);
      return url;
    } catch (error) {
      console.error(`[ImageCache] Error creating blob URL for ${imgID}:`, error);
      return null;
    }
  }

  async getImage(imgID) {
    try {
      if (!imgID) {
        console.warn('[ImageCache] Attempted to get image with null or undefined imgID');
        return null;
      }

      console.log(`[ImageCache] Getting image ${imgID}`);

      // Ensure DB is initialized
      if (!this.dbInitialized) {
        console.log(`[ImageCache] DB not initialized for ${imgID}, waiting for initialization...`);
        try {
          await this.ensureInitialized();
        } catch (error) {
          console.error(`[ImageCache] Failed to initialize DB:`, error);
          // Continue without DB if initialization fails
        }
      }

      // Check memory cache first
      if (this.memoryCache.has(imgID)) {
        const cached = this.memoryCache.get(imgID);
        if (Date.now() - cached.timestamp < this.cacheLifetime) {
          console.log(`[ImageCache] Found ${imgID} in memory cache`);
          return this.createBlobUrl(imgID, cached.blob);
        }
        console.log(`[ImageCache] Memory cache expired for ${imgID}, cleaning up`);
        this.memoryCache.delete(imgID);
        this.cleanupBlobUrl(imgID);
      }

      // Check IndexedDB cache if available
      if (this.dbInitialized) {
        console.log(`[ImageCache] Checking IndexedDB for ${imgID}`);
        try {
          const cachedBlob = await this.getFromIndexedDB(imgID);
          if (cachedBlob) {
            console.log(`[ImageCache] Found ${imgID} in IndexedDB`);
            const url = this.createBlobUrl(imgID, cachedBlob);
            if (url) {
              this.memoryCache.set(imgID, {
                blob: cachedBlob,
                timestamp: Date.now()
              });
              this.pruneMemoryCache();
              return url;
            }
          }
        } catch (error) {
          console.error(`[ImageCache] Error reading from IndexedDB:`, error);
          // Continue if IndexedDB fails
        }
      }

      // Return in-progress request if exists
      if (this.inProgress.has(imgID)) {
        console.log(`[ImageCache] Request already in progress for ${imgID}`);
        return this.inProgress.get(imgID);
      }

      // Queue the request if we're at max concurrent requests
      if (this.activeRequests >= this.maxConcurrentRequests) {
        console.log(`[ImageCache] Queueing request for ${imgID} (active: ${this.activeRequests})`);
        await new Promise(resolve => this.requestQueue.push(resolve));
      }

      // Create new request
      console.log(`[ImageCache] Starting new request for ${imgID} (active: ${this.activeRequests + 1})`);
      this.activeRequests++;
      const promise = this.fetchAndCacheImage(imgID);
      this.inProgress.set(imgID, promise);

      try {
        const result = await promise;
        if (result) {
          console.log(`[ImageCache] Successfully fetched and cached ${imgID}`);
          const url = this.createBlobUrl(imgID, result);
          if (url) {
            this.memoryCache.set(imgID, {
              blob: result,
              timestamp: Date.now()
            });
            this.pruneMemoryCache();
            if (this.dbInitialized) {
              await this.saveToIndexedDB(imgID, result).catch(error => {
                console.error(`[ImageCache] Error saving to IndexedDB:`, error);
              });
            }
            return url;
          }
        }
        console.warn(`[ImageCache] Failed to fetch ${imgID}`);
        return null;
      } finally {
        this.inProgress.delete(imgID);
        this.activeRequests = Math.max(0, this.activeRequests - 1);
        console.log(`[ImageCache] Request complete for ${imgID} (active: ${this.activeRequests})`);
        
        // Process next queued request if any
        if (this.requestQueue.length > 0) {
          const next = this.requestQueue.shift();
          next();
        }
      }
    } catch (error) {
      console.error(`[ImageCache] Error in getImage for ${imgID}:`, error);
      this.inProgress.delete(imgID);
      this.activeRequests = Math.max(0, this.activeRequests - 1);
      
      // Process next queued request if any
      if (this.requestQueue.length > 0) {
        const next = this.requestQueue.shift();
        next();
      }
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