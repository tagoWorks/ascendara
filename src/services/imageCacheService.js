class ImageCacheService {
  constructor() {
    this.cache = new Map();
    this.inProgress = new Map();
    this.maxCacheSize = 400; // Maximum number of items in cache
    this.maxImageSize = 1024 * 1024; // 1MB max per image
    this.loadCacheFromStorage();
  }

  // Load cached images from localStorage on initialization
  loadCacheFromStorage() {
    try {
      const storedCache = localStorage.getItem('imageCache');
      if (storedCache) {
        const parsedCache = JSON.parse(storedCache);
        // Only load images that aren't too large
        Object.entries(parsedCache).forEach(([key, value]) => {
          if (this.getBase64Size(value) <= this.maxImageSize) {
            this.cache.set(key, value);
          }
        });
        this.pruneCache();
      }
    } catch (error) {
      console.error('Error loading cache from storage:', error);
    }
  }

  // Save cache to localStorage with debouncing
  saveCacheToStorage = (() => {
    let timeoutId;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          const cacheObject = Object.fromEntries(this.cache);
          localStorage.setItem('imageCache', JSON.stringify(cacheObject));
        } catch (error) {
          console.error('Error saving cache to storage:', error);
          // If localStorage is full, clear half of the cache
          if (error.name === 'QuotaExceededError') {
            this.pruneCache(Math.floor(this.cache.size / 2));
          }
        }
      }, 1000); // Wait 1 second after last change before saving
    };
  })();

  getBase64Size(base64String) {
    const padding = (base64String.endsWith('==') ? 2 : (base64String.endsWith('=') ? 1 : 0));
    return (base64String.length * 3 / 4) - padding;
  }

  async getImage(imgID) {
    if (!imgID) return null;

    if (this.cache.has(imgID)) {
      // Move accessed item to end of Map to implement LRU
      const value = this.cache.get(imgID);
      this.cache.delete(imgID);
      this.cache.set(imgID, value);
      return value;
    }

    if (this.inProgress.has(imgID)) {
      return this.inProgress.get(imgID);
    }

    const promise = this.fetchAndCacheImage(imgID);
    this.inProgress.set(imgID, promise);

    try {
      const result = await promise;
      if (result && this.getBase64Size(result) <= this.maxImageSize) {
        this.cache.set(imgID, result);
        if (this.cache.size > this.maxCacheSize) {
          this.pruneCache();
        }
        this.saveCacheToStorage();
      }
      return result;
    } finally {
      this.inProgress.delete(imgID);
    }
  }

  async fetchAndCacheImage(imgID) {
    try {
      const response = await fetch(`https://api.ascendara.app/image/${imgID}`);
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

  pruneCache(maxSize = this.maxCacheSize) {
    // Remove oldest entries (beginning of Map) until we're under maxSize
    const entriesToRemove = this.cache.size - maxSize;
    if (entriesToRemove <= 0) return;
    
    const keys = Array.from(this.cache.keys());
    for (let i = 0; i < entriesToRemove; i++) {
      this.cache.delete(keys[i]);
    }
    this.saveCacheToStorage();
  }
}

export default new ImageCacheService();