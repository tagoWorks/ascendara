const RECENT_GAMES_KEY = 'recentGames';
const MAX_RECENT_GAMES = 4;

class RecentGamesService {
  getRecentGames() {
    try {
      const recentGames = localStorage.getItem(RECENT_GAMES_KEY);
      return recentGames ? JSON.parse(recentGames) : [];
    } catch (error) {
      console.error('Error loading recent games:', error);
      return [];
    }
  }

  addRecentGame(game) {
    try {
      const recentGames = this.getRecentGames();
      
      // Remove the game if it already exists to avoid duplicates
      const filteredGames = recentGames.filter(g => g.game !== game.game);
      const updatedGames = [
        {
          ...game,
          lastPlayed: new Date().toISOString()
        },
        ...filteredGames
      ].slice(0, MAX_RECENT_GAMES); // Keep only the most recent games
      
      localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(updatedGames));
      return updatedGames;
    } catch (error) {
      console.error('Error saving recent game:', error);
      return [];
    }
  }

  // Clean up uninstalled games from the recent games list
  cleanupUninstalledGames(installedGames) {
    try {
      const recentGames = this.getRecentGames();
      const cleanedGames = recentGames.filter(recentGame => 
        installedGames.some(g => g.game === recentGame.game)
      );
      
      if (cleanedGames.length !== recentGames.length) {
        localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(cleanedGames));
      }
      
      return cleanedGames;
    } catch (error) {
      console.error('Error cleaning up uninstalled games:', error);
      return [];
    }
  }
}

export default new RecentGamesService();
