const API_URL = 'https://api.ascendara.app';
const CACHE_KEY = 'ascendara_games_cache';
const CACHE_TIMESTAMP_KEY = 'local_ascendara_games_timestamp';
const METADATA_CACHE_KEY = 'local_ascendara_metadata_cache';
const LAST_UPDATED_KEY = 'local_ascendara_last_updated';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

import { checkServerStatus } from './serverStatus';

const gameService = {
  parseDateString(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr).getTime();
  },

  async getCachedData() {
    const cachedGames = localStorage.getItem(CACHE_KEY);
    const cachedMetadata = localStorage.getItem(METADATA_CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    const lastUpdated = localStorage.getItem(LAST_UPDATED_KEY);
    const now = Date.now();

    if (cachedGames && cachedMetadata && timestamp && lastUpdated) {
      const age = now - parseInt(timestamp);
      if (age < CACHE_DURATION) {
        const shouldRefresh = await this.shouldRefreshData();
        if (!shouldRefresh) {
          return {
            games: JSON.parse(cachedGames),
            metadata: JSON.parse(cachedMetadata)
          };
        }
      }
    }

    try {
      const status = await checkServerStatus();
      
      if (!status.isHealthy) {
        if (cachedGames && cachedMetadata) {
          console.warn('Server is down, using cached data');
          return {
            games: JSON.parse(cachedGames),
            metadata: JSON.parse(cachedMetadata)
          };
        }
        throw new Error('Server is down and no cache available');
      }

      const data = await this.fetchDataFromAPI();
      this.updateCache(data);
      return data;
    } catch (error) {
      if (cachedGames && cachedMetadata) {
        console.warn('Failed to fetch fresh data, using cached data');
        return {
          games: JSON.parse(cachedGames),
          metadata: JSON.parse(cachedMetadata)
        };
      }
      console.error('Error fetching data:', error);
      return { games: [], metadata: null };
    }
  },

  async fetchDataFromAPI() {
    const response = await fetch(`${API_URL}/json/games`);
    const data = await response.json();
    return {
      games: data.games,
      metadata: {
        apiversion: data.metadata.apiversion,
        games: data.games.length,
        getDate: data.metadata.getDate,
        source: data.metadata.source
      }
    };
  },

  updateCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data.games));
      localStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(data.metadata));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      if (data.metadata?.getDate) {
        localStorage.setItem(LAST_UPDATED_KEY, data.metadata.getDate);
      }
    } catch (error) {
      console.error('Error updating cache:', error);
    }
  },

  async shouldRefreshData() {
    const lastUpdated = localStorage.getItem(LAST_UPDATED_KEY);
    if (!lastUpdated) return true;

    try {
      const response = await fetch(`${API_URL}/json/games`);
      const data = await response.json();
      const serverLastUpdated = data.getDate;
      
      return !lastUpdated || lastUpdated !== serverLastUpdated;
    } catch (error) {
      console.error('Error checking last updated:', error);
      return false;
    }
  },

  async getAllGames() {
    try {
      const data = await this.getCachedData();
      return data;
    } catch (error) {
      console.error('Error in getAllGames:', error);
      return { games: [], metadata: null };
    }
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
  }
};

export default gameService;