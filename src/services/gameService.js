const API_URL = 'https://api.ascendara.app';
const CACHE_KEY = 'ascendara_games_cache';
const CACHE_TIMESTAMP_KEY = 'ascendara_games_timestamp';
const METADATA_CACHE_KEY = 'ascendara_metadata_cache';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

import { checkServerStatus } from './serverStatus';

const gameService = {
  async getCachedData() {
    const cachedGames = localStorage.getItem(CACHE_KEY);
    const cachedMetadata = localStorage.getItem(METADATA_CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    const now = Date.now();

    if (cachedGames && cachedMetadata && timestamp) {
      const age = now - parseInt(timestamp);
      if (age < CACHE_DURATION) {
        return {
          games: JSON.parse(cachedGames),
          metadata: JSON.parse(cachedMetadata)
        };
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
        apiversion: data.apiversion,
        games: data.games.length,
        getDate: new Date().toLocaleString(),
        source: data.source || 'API'
      }
    };
  },

  updateCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data.games));
      localStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(data.metadata));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error updating cache:', error);
    }
  },

  async getAllGames() {
    try {
      const data = await this.getCachedData();
      return {
        games: Array.isArray(data.games) ? data.games : [],
        metadata: data.metadata
      };
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
  }
};

export default gameService; 