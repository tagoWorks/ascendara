class ImageCacheService {
  constructor() {
    this.cache = new Map();
    this.inProgress = new Map();
    this.loadCacheFromStorage();
  }

  // Load cached images from localStorage on initialization
  loadCacheFromStorage() {
    try {
      const storedCache = localStorage.getItem('imageCache');
      if (storedCache) {
        const parsedCache = JSON.parse(storedCache);
        Object.entries(parsedCache).forEach(([key, value]) => {
          if (typeof value === 'object' && value.data) {
            this.cache.set(key, value);
          } else {
            // Migrate old cache format to new format with timestamp
            this.cache.set(key, {
              data: value,
              timestamp: Date.now()
            });
          }
        });
      }
    } catch (error) {
      console.error('Error loading cache from storage:', error);
    }
  }

  // Save cache to localStorage
  saveCacheToStorage() {
    try {
      const cacheObject = Object.fromEntries(this.cache);
      localStorage.setItem('imageCache', JSON.stringify(cacheObject));
    } catch (error) {
      console.error('Error saving cache to storage:', error);
    }
  }

  async getImage(imgID) {
    // Skip if no imgID provided
    if (!imgID) return null;

    // Check if we have a cached version and if it's still fresh
    if (this.cache.has(imgID)) {
      const cachedImage = this.cache.get(imgID);
      const isFresh = this.isCacheFresh(cachedImage.timestamp);
      
      if (isFresh) {
        return cachedImage.data;
      } else {
        // Clear stale cache
        this.clearCache(imgID);
      }
    }

    // Return in-progress request if exists
    if (this.inProgress.has(imgID)) {
      return (await this.inProgress.get(imgID)).data;
    }

    // Create new request
    const promise = this.fetchAndCacheImage(imgID);
    this.inProgress.set(imgID, promise);

    try {
      const result = await promise;
      if (result) {
        this.cache.set(imgID, {
          data: result,
          timestamp: Date.now()
        });
        this.saveCacheToStorage();
      }
      return result;
    } finally {
      this.inProgress.delete(imgID);
    }
  }

  isCacheFresh(timestamp) {
    const maxAge = 5 * 60 * 1000; // 5 minutes cache lifetime
    return Date.now() - timestamp < maxAge;
  }

  async fetchAndCacheImage(imgID) {
    try {
      const response = await fetch(`https://api.ascendara.app/image/${imgID}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const blob = await response.blob();
      return await this.blobToBase64(blob);
    } catch (error) {
      console.error(`Error fetching image ${imgID}:`, error);
      return null;
    }
  }

  clearCache(imgID) {
    this.cache.delete(imgID);
    this.saveCacheToStorage();
  }

  clearAllCache() {
    this.cache.clear();
    localStorage.removeItem('imageCache');
  }

  getCacheSize() {
    return this.cache.size;
  }

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  pruneCache(maxSize = 400) { 
    if (this.cache.size <= maxSize) return;

    const entries = Array.from(this.cache.entries());
    const entriesToRemove = entries.slice(0, entries.length - maxSize);
    
    entriesToRemove.forEach(([key]) => {
      this.cache.delete(key);
    });

    this.saveCacheToStorage();
  }
}

export default new ImageCacheService();