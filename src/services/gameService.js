import { getCurrentStatus } from "./serverStatus";
import { sanitizeText } from "@/lib/utils";

const API_URL = "https://api.ascendara.app";
const CACHE_KEY = "ascendara_games_cache";
const CACHE_TIMESTAMP_KEY = "local_ascendara_games_timestamp";
const METADATA_CACHE_KEY = "local_ascendara_metadata_cache";
const LAST_UPDATED_KEY = "local_ascendara_last_updated";
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Memory cache to avoid localStorage reads
let memoryCache = {
  games: null,
  metadata: null,
  timestamp: null,
  lastUpdated: null,
  imageIdMap: null, // New cache for image ID lookups
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
          metadata: memoryCache.metadata,
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
          lastUpdated: parsedMetadata.getDate,
        };

        return {
          games: parsedGames,
          metadata: parsedMetadata,
        };
      }
    }

    try {
      const status = getCurrentStatus();
      if (!status?.ok) {
        if (cachedGames && cachedMetadata) {
          const parsedGames = JSON.parse(cachedGames);
          const parsedMetadata = JSON.parse(cachedMetadata);
          return { games: parsedGames, metadata: parsedMetadata };
        }
        throw new Error("Server is not available");
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
      console.error("Error fetching data:", error);
      return { games: [], metadata: null };
    }
  },

  async fetchDataFromAPI() {
    // Get settings from electron
    const settings = await window.electron.getSettings();
    const source = settings?.gameSource || 'steamrip';
    
    let endpoint = `${API_URL}/json/games`;
    if (source === 'fitgirl') {
      endpoint = `${API_URL}/json/sources/fitgirl/games`;
    }

    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Sanitize game titles
    if (data.games) {
      data.games = data.games.map(game => ({
        ...game,
        name: sanitizeText(game.name),
        game: sanitizeText(game.game),
      }));
    }

    return {
      games: data.games,
      metadata: {
        apiversion: data.metadata?.apiversion,
        games: data.games?.length,
        getDate: data.metadata?.getDate,
        source: data.metadata?.source || source,
      },
    };
  },

  async updateCache(data) {
    try {
      const now = Date.now();

      // Create image ID map for efficient lookups
      const imageIdMap = new Map();
      data.games.forEach(game => {
        if (game.imgID) {
          imageIdMap.set(game.imgID, game);
        }
      });

      // Update memory cache
      memoryCache = {
        games: data.games,
        metadata: data.metadata,
        timestamp: now,
        lastUpdated: data.metadata?.getDate,
        imageIdMap, // Store the map in memory cache
      };

      // Update localStorage cache
      localStorage.setItem(CACHE_KEY, JSON.stringify(data.games));
      localStorage.setItem(METADATA_CACHE_KEY, JSON.stringify(data.metadata));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
      if (data.metadata?.getDate) {
        localStorage.setItem(LAST_UPDATED_KEY, data.metadata.getDate);
      }
    } catch (error) {
      console.error("Error updating cache:", error);
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
    const validGames = games
      .filter(game => game.weight >= 7 && game.imgID)
      .map(game => ({
        ...game,
        name: sanitizeText(game.name),
        game: sanitizeText(game.game),
      }));

    // Shuffle and return requested number of games
    const shuffled = validGames.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  },

  async searchGames(query) {
    const { games } = await this.getCachedData();
    const searchTerm = query.toLowerCase();
    return games.filter(
      game =>
        game.title?.toLowerCase().includes(searchTerm) ||
        game.game?.toLowerCase().includes(searchTerm) ||
        game.description?.toLowerCase().includes(searchTerm)
    );
  },

  async getGamesByCategory(category) {
    const { games } = await this.getCachedData();
    return games.filter(
      game =>
        game.category && Array.isArray(game.category) && game.category.includes(category)
    );
  },

  getImageUrl(imgID) {
    return `${API_URL}/v2/image/${imgID}`;
  },

  async searchGameCovers(query) {
    if (!query.trim()) {
      return [];
    }

    const searchTerm = query.toLowerCase();

    // First try memory cache
    if (memoryCache.games) {
      return memoryCache.games
        .filter(game => game.game?.toLowerCase().includes(searchTerm))
        .slice(0, 20)
        .map(game => ({
          id: game.game,
          title: game.game,
          imgID: game.imgID,
        }));
    }

    // Then try localStorage cache
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { games } = JSON.parse(cachedData);
        if (games?.length) {
          // Update memory cache for future searches
          memoryCache.games = games;
          memoryCache.timestamp = Date.now();

          return games
            .filter(game => game.game?.toLowerCase().includes(searchTerm))
            .slice(0, 20)
            .map(game => ({
              id: game.game,
              title: game.game,
              imgID: game.imgID,
            }));
        }
      }
    } catch (cacheError) {
      console.error("Error using cached data:", cacheError);
    }

    // Only if no cache is available, make an API request
    try {
      const response = await fetch(`${API_URL}/json/games`);
      const data = await response.json();

      if (data?.games?.length) {
        // Update caches in background
        setTimeout(() => {
          memoryCache.games = data.games;
          memoryCache.timestamp = Date.now();
          this.updateCache({ games: data.games, metadata: data.metadata });
        }, 0);

        return data.games
          .filter(game => game.game?.toLowerCase().includes(searchTerm))
          .slice(0, 20)
          .map(game => ({
            id: game.game,
            title: game.game,
            imgID: game.imgID,
          }));
      }
    } catch (error) {
      console.error("Error searching game covers:", error);
    }

    return [];
  },

  async checkMetadataUpdate() {
    try {
      const response = await fetch(`${API_URL}/json/games`, {
        method: "HEAD", // Only get headers to check Last-Modified
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const lastModified = response.headers.get("Last-Modified");
      return lastModified || null;
    } catch (error) {
      console.error("Error checking metadata:", error);
      return null;
    }
  },

  async findGameByImageId(imageId) {
    try {
      // Ensure we have the latest data
      if (!memoryCache.imageIdMap) {
        const data = await this.getCachedData();
        if (!memoryCache.imageIdMap) {
          // Create image ID map if it doesn't exist
          const imageIdMap = new Map();
          data.games.forEach(game => {
            if (game.imgID) {
              // Store the game with its download links directly from the API
              imageIdMap.set(game.imgID, {
                ...game,
                // Ensure download_links exists, even if empty
                download_links: game.download_links || {},
              });
            }
          });
          memoryCache.imageIdMap = imageIdMap;
        }
      }

      // O(1) lookup from the map
      const game = memoryCache.imageIdMap.get(imageId);
      if (!game) {
        console.warn(`No game found with image ID: ${imageId}`);
        return null;
      }

      console.log("Found game with download links:", game.download_links);
      return game;
    } catch (error) {
      console.error("Error finding game by image ID:", error);
      return null;
    }
  },
};

export default gameService;
