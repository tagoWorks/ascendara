// Cache to store fetched versions
const versionCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const API_URL = "https://api.ascendara.app"; // Production API

/**
 * Fetches a specific historical version of the games list
 * @param {number} version - The version number to fetch
 * @returns {Promise<{games: Array, metadata: Object}>} The historical games data
 */
export const fetchHistoricalGames = async version => {
  console.log("fetchHistoricalGames called with:", version);

  const cacheKey = `games_${version}`;
  const cachedData = versionCache.get(cacheKey);

  // Return cached data if it's still valid
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    console.log("Returning cached data for:", version);
    return cachedData.data;
  }

  try {
    const url = `${API_URL}/json/timemachine/games/${version}`;
    console.log("Fetching from URL:", url);

    const response = await fetch(url);
    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(`Failed to fetch version ${version}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Received data:", data);

    // Cache the new data
    versionCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  } catch (error) {
    console.error(`Error fetching historical version ${version}:`, error);
    throw error;
  }
};

/**
 * Finds a specific game in a historical version
 * @param {number} version - The version number to fetch
 * @param {string} gameId - The ID or name of the game to find
 * @returns {Promise<Object|null>} The historical game data or null if not found
 */
export const fetchHistoricalGame = async (version, gameId) => {
  console.log("fetchHistoricalGame called with:", version, gameId);

  const data = await fetchHistoricalGames(version);
  const game = data.games.find(game => game.id === gameId || game.name === gameId);
  console.log("Found game:", game);

  return game || null;
};

/**
 * Fetches all historical versions of a specific game
 * @param {string} gameName - The name of the game to fetch versions for
 * @returns {Promise<Array<{version: number, game: Object}>>} List of versions with game data
 */
export const fetchGameVersions = async gameName => {
  console.log("fetchGameVersions called with:", gameName);

  const cacheKey = `versions_${gameName}`;
  const cachedData = versionCache.get(cacheKey);

  // Return cached data if it's still valid
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
    console.log("Returning cached data for:", gameName);
    return cachedData.data;
  }

  try {
    // Use the raw game name from gameData.game without sanitization
    const encodedName = encodeURIComponent(gameName);
    const url = `${API_URL}/json/timemachine/game/${encodedName}`;
    console.log("Fetching from URL:", url);

    const response = await fetch(url);
    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(`Failed to fetch versions for ${gameName}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Received data:", data);

    // Cache the new data
    versionCache.set(cacheKey, {
      data: data.versions,
      timestamp: Date.now(),
    });

    return data.versions;
  } catch (error) {
    console.error(`Error fetching versions for ${gameName}:`, error);
    throw error;
  }
};

/**
 * Clears the version cache
 */
export const clearVersionCache = () => {
  console.log("Clearing version cache");

  versionCache.clear();
};
