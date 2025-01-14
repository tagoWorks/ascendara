/**
 * ImageCacheService - A simplified and robust image caching service
 */
class ImageCacheService {
  constructor() {
    // Core caching
    this.memoryCache = new Map();
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
    this.initRetries = 0;
    this.maxInitRetries = 3;
    
    // Request management
    this.activeRequests = new Map(); 
    this.maxConcurrentRequests = 4;
    this.retryDelay = 2000;
    this.maxRetries = 2;
    
    // Initialize
    this.initPromise = this.initializeDB();
  }

  async initializeDB() {
    if (this.initRetries >= this.maxInitRetries) {
      console.warn('[ImageCache] Max init retries reached, continuing with memory-only cache');
      this.isInitialized = true;
      return;
    }

    try {
      // Check if IndexedDB is available
      if (!window.indexedDB) {
        console.warn('[ImageCache] IndexedDB not available, continuing with memory-only cache');
        this.isInitialized = true;
        return;
      }

      const request = indexedDB.open('ImageCache', 1);
      
      return new Promise((resolve, reject) => {
        let hasErrored = false;

        request.onupgradeneeded = (event) => {
          try {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('images')) {
              db.createObjectStore('images', { keyPath: 'id' });
            }
          } catch (error) {
            console.error('[ImageCache] Error during database upgrade:', error);
            hasErrored = true;
          }
        };

        request.onsuccess = (event) => {
          if (hasErrored) {
            this.retryInitialization(resolve);
            return;
          }

          try {
            this.db = event.target.result;
            this.isInitialized = true;
            console.log('[ImageCache] Ascendara Image Cache service initialized, IndexedDB ready');
            resolve();
          } catch (error) {
            this.retryInitialization(resolve);
          }
        };

        request.onerror = () => {
          this.retryInitialization(resolve);
        };
      });
    } catch (error) {
      console.warn('[ImageCache] IndexedDB initialization failed:', error);
      this.retryInitialization();
    }
  }

  async retryInitialization(resolve) {
    this.initRetries++;
    console.warn(`[ImageCache] Retrying initialization (attempt ${this.initRetries}/${this.maxInitRetries})`);
    
    if (this.initRetries < this.maxInitRetries) {
      setTimeout(() => {
        this.initPromise = this.initializeDB();
        if (resolve) this.initPromise.then(resolve);
      }, 1000);
    } else {
      console.warn('[ImageCache] Max init retries reached, continuing with memory-only cache');
      this.isInitialized = true;
      if (resolve) resolve();
    }
  }

  async getImage(imgID) {
    if (!imgID) return null;

    // Wait for initialization
    await this.initPromise;

    // Check memory cache first
    if (this.memoryCache.has(imgID)) {
      console.log(`[ImageCache] Hit memory cache for ${imgID}`);
      return this.memoryCache.get(imgID);
    }

    // Try IndexedDB cache if available
    if (this.db) {
      try {
        const cachedImage = await this.getFromIndexedDB(imgID);
        if (cachedImage) {
          console.log(`[ImageCache] Hit IndexedDB cache for ${imgID}`);
          const url = URL.createObjectURL(cachedImage);
          this.memoryCache.set(imgID, url);
          return url;
        }
      } catch (error) {
        console.warn(`[ImageCache] Failed to read from IndexedDB for ${imgID}:`, error);
      }
    }

    // If already being loaded, return the existing promise
    if (this.activeRequests.has(imgID)) {
      console.log(`[ImageCache] Already loading ${imgID}`);
      return this.activeRequests.get(imgID);
    }

    // Start loading
    console.log(`[ImageCache] Fetching ${imgID} from network`);
    const loadPromise = this.loadImage(imgID);
    this.activeRequests.set(imgID, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } catch (error) {
      console.error(`[ImageCache] Error loading image ${imgID}:`, error);
      return null;
    } finally {
      this.activeRequests.delete(imgID);
    }
  }

  async loadImage(imgID, retryCount = 0) {
    if (!imgID) return null;

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await this.generateSignature(timestamp);
      
      const response = await fetch(`https://api.ascendara.app/v2/image/${imgID}`, {
        headers: {
          'X-Timestamp': timestamp.toString(),
          'X-Signature': signature,
          'Cache-Control': 'no-store'
        }
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Cache the result
      this.memoryCache.set(imgID, url);

      // Save to IndexedDB in the background if available
      if (this.db) {
        this.saveToIndexedDB(imgID, blob).catch(error => {
          console.warn(`[ImageCache] Failed to save image ${imgID} to IndexedDB:`, error);
        });
      }

      return url;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.loadImage(imgID, retryCount + 1);
      }
      throw error;
    }
  }

  async getFromIndexedDB(imgID) {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['images'], 'readonly');
        const store = transaction.objectStore('images');
        const request = store.get(imgID);

        request.onsuccess = () => {
          const data = request.result;
          if (data && data.blob) {
            resolve(data.blob);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateSignature(timestamp) {
    try {
      // Try to get secret from electron
      const secret = await window.electron?.imageSecret() || 'default_secret';
      
      const encoder = new TextEncoder();
      const data = encoder.encode(timestamp.toString());
      const keyData = encoder.encode(secret);
      
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', key, data);
      const hashArray = Array.from(new Uint8Array(signature));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('[ImageCache] Error generating signature:', error);
      throw error;
    }
  }

  async saveToIndexedDB(imgID, blob) {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['images'], 'readwrite');
        const store = transaction.objectStore('images');
        const request = store.put({ id: imgID, blob, timestamp: Date.now() });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async clearCache() {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear IndexedDB if available
    if (this.db) {
      try {
        const transaction = this.db.transaction(['images'], 'readwrite');
        const store = transaction.objectStore('images');
        await store.clear();
        console.log('[ImageCache] Cache cleared successfully');
      } catch (error) {
        console.error('[ImageCache] Error clearing cache:', error);
      }
    }
  }
}

export default new ImageCacheService();
