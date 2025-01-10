const API_URL = 'https://api.ascendara.app';
const CACHE_KEY = 'ascendara_games_cache';
const CACHE_TIMESTAMP_KEY = 'local_ascendara_games_timestamp';
const METADATA_CACHE_KEY = 'local_ascendara_metadata_cache';
const LAST_UPDATED_KEY = 'local_ascendara_last_updated';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

import { checkServerStatus } from './serverStatus';
import imageCacheService from './imageCacheService';
import { sanitizeText } from '../lib/utils';

// Memory cache to avoid localStorage reads
let memoryCache = {
  games: null,
  metadata: null,
  timestamp: null,
  lastUpdated: null
};

const gameService = {
  parseDateString(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr).getTime();
  },

  async getCachedData() {
    // Check memory cache first
    const now = Date.now();
    if (memoryCache.games && memoryCache.metadata && memoryCache.timestamp) {
      const age = now - memoryCache.timestamp;
      if (age < CACHE_DURATION) {
        return {
          games: memoryCache.games,
          metadata: memoryCache.metadata
        };
      }
    }

    // Check localStorage cache
    const cachedGames = localStorage.getItem(CACHE_KEY);
    const cachedMetadata = localStorage.getItem(METADATA_CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    
    if (cachedGames && cachedMetadata && timestamp) {
      const age = now - parseInt(timestamp);
      if (age < CACHE_DURATION) {
        const parsedGames = JSON.parse(cachedGames);
        const parsedMetadata = JSON.parse(cachedMetadata);
        
        // Update memory cache
        memoryCache = {
          games: parsedGames,
          metadata: parsedMetadata,
          timestamp: parseInt(timestamp),
          lastUpdated: localStorage.getItem(LAST_UPDATED_KEY)
        };

        return {
          games: parsedGames,
          metadata: parsedMetadata
        };
      }
    }

    try {
      const status = await checkServerStatus();
      
      if (!status.isHealthy) {
        if (cachedGames && cachedMetadata) {
          const parsedGames = JSON.parse(cachedGames);
          const parsedMetadata = JSON.parse(cachedMetadata);
          return { games: parsedGames, metadata: parsedMetadata };
        }
        throw new Error('Server is down and no cache available');
      }

      const data = await this.fetchDataFromAPI();
      await this.updateCache(data);
      return data;
    } catch (error) {
      if (cachedGames && cachedMetadata) {
        const parsedGames = JSON.parse(cachedGames);
        const parsedMetadata = JSON.parse(cachedMetadata);
        return { games: parsedGames, metadata: parsedMetadata };
      }
      console.error('Error fetching data:', error);
      return { games: [], metadata: null };
    }
  },

  async fetchDataFromAPI() {
    const response = await fetch(`${API_URL}/json/games`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    // Sanitize game titles
    if (data.games) {
      data.games = data.games.map(game => ({
        ...game,
        name: sanitizeText(game.name),
        game: sanitizeText(game.game)
      }));
    }

    // Start preloading images immediately
    setTimeout(() => {
      if (data.games) {
        // Prioritize first 20 games
        data.games.slice(0, 20).forEach(game => {
          if (game.imgID) {
            imageCacheService.getImage(game.imgID).catch(err => {
              console.warn(`Failed to preload image ${game.imgID}:`, err);
            });
          }
        });
        
        // Load the rest in background
        if (data.games.length > 20) {
          setTimeout(() => {
            data.games.slice(20).forEach(game => {
              if (game.imgID) {
                imageCacheService.getImage(game.imgID).catch(err => {
                  console.warn(`Failed to preload image ${game.imgID}:`, err);
                });
              }
            });
          }, 1000);
        }
      }
    }, 0);

    return {
      games: data.games,
      metadata: {
        apiversion: data.metadata?.apiversion,
        games: data.games?.length,
        getDate: data.metadata?.getDate,
        source: data.metadata?.source
      }
    };
  },

  async updateCache(data) {
    try {
      const now = Date.now();
      
      // Update localStorage
      localStorage.setItem(CACHE_KEY, JSON.stringify(data.games));
      localStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(data.metadata));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
      if (data.metadata?.getDate) {
        localStorage.setItem(LAST_UPDATED_KEY, data.metadata.getDate);
      }

      // Update memory cache
      memoryCache = {
        games: data.games,
        metadata: data.metadata,
        timestamp: now,
        lastUpdated: data.metadata?.getDate
      };
    } catch (error) {
      console.error('Error updating cache:', error);
    }
  },

  async getAllGames() {
    const data = await this.getCachedData();
    return data;
  },

  async getRandomTopGames(count = 8) {
    const { games } = await this.getCachedData();
    if (!games || !games.length) return [];

    // Filter games with high weights and images
    const validGames = games.filter(game => game.weight >= 7 && game.imgID)
      .map(game => ({
        ...game,
        name: sanitizeText(game.name),
        game: sanitizeText(game.game)
      }));
    
    // Immediately start preloading images for potential carousel games
    validGames.slice(0, count * 2).forEach(game => {
      if (game.imgID) {
        imageCacheService.getImage(game.imgID).catch(err => {
          console.warn(`Failed to preload carousel image ${game.imgID}:`, err);
        });
      }
    });

    // Shuffle and return requested number of games
    const shuffled = validGames.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  },

  async searchGames(query) {
    const { games } = await this.getCachedData();
    const searchTerm = query.toLowerCase();
    return games.filter(game => 
      game.title?.toLowerCase().includes(searchTerm) || 
      game.game?.toLowerCase().includes(searchTerm) ||
      game.description?.toLowerCase().includes(searchTerm)
    );
  },

  async getGamesByCategory(category) {
    const { games } = await this.getCachedData();
    return games.filter(game => 
      game.category && 
      Array.isArray(game.category) && 
      game.category.includes(category)
    );
  },
  
  getImageUrl(imgID) {
    return `${API_URL}/image/${imgID}`;
  },
  
  async searchGameCovers(query) {
    if (!query.trim()) {
      return [];
    }

    try {
      // Make a direct API request for instant results
      const response = await fetch(`${API_URL}/json/games`);
      const data = await response.json();
      
      // Only cache if we have valid data
      if (data?.games) {
        // Cache in background without waiting
        setTimeout(() => {
          this.updateCache({ games: data.games, metadata: data.metadata });
        }, 0);

        const searchTerm = query.toLowerCase();
        return data.games
          .filter(game => 
            game.game?.toLowerCase().includes(searchTerm)
          )
          .slice(0, 20)
          .map(game => ({
            id: game.game,
            title: game.game,
            imgID: game.imgID
          }));
      }
    } catch (error) {
      console.error('Error searching game covers:', error);
    }

    // Try using cached data as fallback
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { games } = JSON.parse(cachedData);
        if (games) {
          const searchTerm = query.toLowerCase();
          return games
            .filter(game => 
              game.game?.toLowerCase().includes(searchTerm)
            )
            .slice(0, 20)
            .map(game => ({
              id: game.game,
              title: game.game,
              imgID: game.imgID
            }));
        }
      }
    } catch (cacheError) {
      console.error('Error using cached data:', cacheError);
    }

    return [];
  },
};

export default gameService;