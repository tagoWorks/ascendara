import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Skeleton } from "../components/ui/skeleton";
import HomeGameCard from '../components/HomeGameCard';
import RecentGameCard from '../components/RecentGameCard';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Sword,
  Flame,
  Globe,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react';
import gameService from '../services/gameService';
import Tour from '../components/Tour';
import imageCacheService from '../services/imageCacheService';
import recentGamesService from '../services/recentGamesService';

const Home = memo(() => {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTour, setShowTour] = useState(false);
  const [carouselImages, setCarouselImages] = useState({});

  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoading(true);
        const response = await gameService.getAllGames();
        const gamesData = response.games || [];
        setGames(Array.isArray(gamesData) ? gamesData : []);
      } catch (error) {
        console.error('Error loading games:', error);
        setGames([]);
      } finally {
        setLoading(false);
      }
    };

    loadGames();
  }, []);

  useEffect(() => {
    if (searchParams.get('tour') === 'true') {
      setShowTour(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => 
        prev === getFeaturedGames(games).length - 1 ? 0 : prev + 1
      );
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPlay, games]);

  const handleImageIntersect = useCallback(async (imgID) => {
    if (!imgID || carouselImages[imgID]) return;
    
    try {
      const src = await imageCacheService.getImage(imgID);
      if (src) {
        setCarouselImages(prev => ({
          ...prev,
          [imgID]: src
        }));
      }
    } catch (error) {
      console.error('Error loading carousel image:', error);
    }
  }, [carouselImages]);

  const getFeaturedGames = (games) => {
    if (!Array.isArray(games)) return [];
    return games.filter(game => parseInt(game.weight) > 60).slice(0, 8);
  };

  const getRecentGames = (games) => {
    const recentlyPlayed = recentGamesService.getRecentGames();
    
    // If games array is not available yet, return just the cached data
    if (!Array.isArray(games) || games.length === 0) {
      return recentlyPlayed;
    }
    
    // Once games are loaded, merge with full game details
    return recentlyPlayed.map(recentGame => {
      const gameDetails = games.find(g => g.game === recentGame.game) || recentGame;
      return {
        ...gameDetails,
        lastPlayed: recentGame.lastPlayed
      };
    });
  };

  const getTopGames = (games) => {
    if (!Array.isArray(games)) return [];
    return [...games]
      .sort((a, b) => parseInt(b.weight) - parseInt(a.weight))
      .slice(0, 8);
  };

  const getOnlineGames = (games) => {
    if (!Array.isArray(games)) return [];
    return games
      .filter(game => game.online)
      .slice(0, 12);
  };

  const getActionGames = (games) => {
    if (!Array.isArray(games)) return [];
    return games
      .filter(game => 
        game.category.some(cat => 
          ['Action', 'Adventure', 'Fighting', 'Shooter'].includes(cat)
        )
      )
      .slice(0, 8);
  };

  const getPopularCategories = (games) => {
    if (!Array.isArray(games)) return [];
    const categoryWeights = games.reduce((acc, game) => {
      if (!Array.isArray(game.category)) return acc;
      game.category.forEach(cat => {
        if (!acc[cat]) {
          acc[cat] = {
            weight: 0,
            games: []
          };
        }
        acc[cat].weight += parseInt(game.weight) || 0;
        acc[cat].games.push(game);
      });
      return acc;
    }, {});

    return Object.entries(categoryWeights)
      .sort(([, a], [, b]) => b.weight - a.weight)
      .slice(0, 4)
      .map(([category, data]) => ({
        category,
        games: data.games
          .sort((a, b) => parseInt(b.weight) - parseInt(a.weight))
          .slice(0, 4)
      }));
  };

  const handlePlayGame = async (game) => {
    try {
      await window.electron.playGame(game.game || game.name, game.isCustom);
      
      // Get and cache the game image
      const imageBase64 = await window.electron.getGameImage(game.game || game.name);
      if (imageBase64) {
        await imageCacheService.getImage(game.imgID);
      }
      
      // Update recently played
      recentGamesService.addRecentGame({
        game: game.game || game.name,
        name: game.name,
        imgID: game.imgID,
        version: game.version,
        isCustom: game.isCustom,
        online: game.online,
        dlc: game.dlc
      });
    } catch (error) {
      console.error('Error playing game:', error);
    }
  };

  const handlePrevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === 0 ? getFeaturedGames(games).length - 1 : prev - 1));
    setAutoPlay(false);
  }, [games]);

  const handleNextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === getFeaturedGames(games).length - 1 ? 0 : prev + 1));
    setAutoPlay(false);
  }, [games]);

  const handleCloseTour = useCallback(() => {
    setShowTour(false);
    setSearchParams({});
  }, [setSearchParams]);

  const featuredGames = useMemo(() => getFeaturedGames(games), [games]);
  const recentGames = useMemo(() => getRecentGames(games), [games]);
  const topGames = useMemo(() => getTopGames(games), [games]);
  const onlineGames = useMemo(() => getOnlineGames(games), [games]);
  const actionGames = useMemo(() => getActionGames(games), [games]);
  const popularCategories = useMemo(() => getPopularCategories(games), [games]);

  return loading ? (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-4 md:p-8">
        <div className="space-y-12">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  ) : (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-4 md:p-8">
        {showTour && <Tour onClose={handleCloseTour} />}
        
        <div className="space-y-12">
          <div className="relative group">
            <div className="overflow-hidden rounded-2xl shadow-lg">
              <div 
                className="flex transition-transform duration-500" 
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {featuredGames.map((game, index) => (
                  <div key={index} className="min-w-full">
                    <div 
                      className="relative aspect-[21/9]"
                      ref={node => {
                        if (node && !carouselImages[game.imgID]) {
                          handleImageIntersect(game.imgID);
                        }
                      }}
                    >
                      {!carouselImages[game.imgID] && (
                        <Skeleton className="absolute inset-0 w-full h-full bg-muted" />
                      )}
                      {carouselImages[game.imgID] && (
                        <img 
                          src={carouselImages[game.imgID]}
                          alt={game.game}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{game.game}</h2>
                        <div className="flex gap-2 mt-4">
                          {game.category.slice(0, 3).map((cat, idx) => (
                            <span key={idx} className="px-3 py-1 rounded-full bg-white/10 text-white text-sm backdrop-blur-sm">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button 
              onClick={handlePrevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={handleNextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {featuredGames.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    currentSlide === index ? 'bg-white' : 'bg-white/50'
                  }`}
                  onClick={() => {
                    setCurrentSlide(index);
                    setAutoPlay(false);
                  }}
                />
              ))}
            </div>
          </div>

          {recentGames.length > 0 && (
            <section className="space-y-4" data-section="recent-games">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Clock className="w-6 h-6 text-primary" />
                Recently Played
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recentGames.slice(0, 4).map((game, index) => (
                  <RecentGameCard 
                    key={`recent-${game.game}-${index}`} 
                    game={game}
                    onPlay={handlePlayGame}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Flame className="w-6 h-6 text-primary" />
              Top Games
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {topGames.map((game, index) => (
                <div key={`top-${game.id || index}`} className="relative h-full">
                  <div className="absolute -top-2 -left-2 w-10 h-10 bg-primary rounded-lg shadow-lg flex items-center justify-center z-10 transform -rotate-12">
                    <span className="text-primary-foreground font-bold text-lg">
                      #{index + 1}
                    </span>
                  </div>
                  <HomeGameCard game={game} />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-8">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Flame className="w-6 h-6 text-primary" />
              Popular Categories
            </h2>
            <div className="space-y-8">
              {popularCategories.map(({ category, games: categoryGames }) => (
                <div key={category} className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
                    {categoryGames.map((game, index) => (
                      <HomeGameCard 
                        key={`${category}-${game.id || index}`} 
                        game={game}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Globe className="w-6 h-6 text-primary" />
              Online Multiplayer
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {onlineGames.map((game, index) => (
                <div key={`online-${game.id || index}`} className="aspect-[3/4]">
                  <HomeGameCard 
                    game={game} 
                    variant="compact" 
                    className="h-full"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sword className="w-6 h-6 text-primary" />
              Action Games
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {actionGames.map((game, index) => (
                <div key={`action-${game.id || index}`} className="h-full">
                  <HomeGameCard game={game} />
                </div>
              ))}
            </div>
          </section>

          <div className="text-center text-muted-foreground/50 py-8">
            That's it... go find some games
          </div>
        </div>
      </div>
    </div>
  );
});

export default Home;