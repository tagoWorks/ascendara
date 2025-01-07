import React, { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Skeleton } from "../components/ui/skeleton";
import HomeGameCard from '../components/HomeGameCard';
import RecentGameCard from '../components/RecentGameCard';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
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

// Module-level caches that persist during runtime
let gamesCache = null;
let carouselGamesCache = null;

const Home = memo(() => {
  const navigate = useNavigate();
  const [apiGames, setApiGames] = useState([]);
  const [installedGames, setInstalledGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carouselGames, setCarouselGames] = useState([]);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTour, setShowTour] = useState(false);
  const [carouselImages, setCarouselImages] = useState({});
  const [recentGames, setRecentGames] = useState([]);

  useEffect(() => {
    const loadGames = async () => {
      try {
        setLoading(true);

        // Use cache if available
        if (gamesCache && carouselGamesCache) {
          setApiGames(gamesCache);
          setCarouselGames(carouselGamesCache);
          
          // Still need to get installed games as they might have changed
          const installedGames = await window.electron.getGames();
          const customGames = await window.electron.getCustomGames();
          
          const actuallyInstalledGames = [
            ...(installedGames || []).map(game => ({
              ...game,
              isCustom: false
            })),
            ...(customGames || []).map(game => ({
              ...game,
              isCustom: true
            }))
          ];

          setInstalledGames(actuallyInstalledGames);
          setLoading(false);
          return;
        }

        // Fetch fresh data if no cache
        const [gamesData, carouselGames] = await Promise.all([
          gameService.getAllGames(),
          gameService.getRandomTopGames()
        ]);
        const games = gamesData.games || [];
        
        // Update caches
        gamesCache = games;
        carouselGamesCache = carouselGames;
        
        // Get actually installed games from electron
        const installedGames = await window.electron.getGames();
        const customGames = await window.electron.getCustomGames();
        
        // Combine installed and custom games
        const actuallyInstalledGames = [
          ...(installedGames || []).map(game => ({
            ...game,
            isCustom: false
          })),
          ...(customGames || []).map(game => ({
            ...game,
            isCustom: true
          }))
        ];

        setApiGames(games);
        setInstalledGames(actuallyInstalledGames);
        setCarouselGames(carouselGames);
        
      } catch (error) {
        console.error('Error loading games:', error);
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
        prev === carouselGames.length - 1 ? 0 : prev + 1
      );
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPlay, carouselGames]);

  useEffect(() => {
    const updateRecentGames = async () => {
      const recent = await getRecentGames([...installedGames, ...apiGames]);
      setRecentGames(recent);
    };
    updateRecentGames();
  }, [installedGames, apiGames]);

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

  const getRecentGames = async (games) => {
    const recentlyPlayed = recentGamesService.getRecentGames();
    
    try {
      // Get actually installed games from electron
      const installedGames = await window.electron.getGames();
      const customGames = await window.electron.getCustomGames();
      
      // Combine installed and custom games
      const actuallyInstalledGames = [
        ...(installedGames || []).map(game => ({
          ...game,
          isCustom: false
        })),
        ...(customGames || []).map(game => ({
          name: game.game,
          game: game.game,
          version: game.version,
          online: game.online,
          dlc: game.dlc,
          executable: game.executable,
          isCustom: true
        }))
      ];
      
      // Filter out games that are no longer installed and merge with full game details
      return recentlyPlayed
        .filter(recentGame => actuallyInstalledGames.some(g => g.game === recentGame.game))
        .map(recentGame => {
          const gameDetails = games.find(g => g.game === recentGame.game) || actuallyInstalledGames.find(g => g.game === recentGame.game);
          return {
            ...gameDetails,
            lastPlayed: recentGame.lastPlayed
          };
        });
    } catch (error) {
      console.error('Error getting installed games:', error);
      return [];
    }
  };

  const getTopGames = (games) => {
    if (!Array.isArray(games)) return [];
    return games
      .filter(game => parseInt(game.weight || 0) > 30)
      .sort((a, b) => parseInt(b.weight || 0) - parseInt(a.weight || 0))
      .slice(0, 8);
  };

  const getOnlineGames = (games) => {
    if (!Array.isArray(games)) return [];
    return games
      .filter(game => game.online)
      .sort((a, b) => parseInt(b.weight || 0) - parseInt(a.weight || 0))
      .slice(0, 8);
  };

  const getActionGames = (games) => {
    if (!Array.isArray(games)) return [];
    return games
      .filter(game => 
        Array.isArray(game.category) && game.category.some(cat => 
          ['Action', 'Adventure', 'Fighting', 'Shooter'].includes(cat)
        )
      )
      .sort((a, b) => parseInt(b.weight || 0) - parseInt(a.weight || 0))
      .slice(0, 8);
  };

  const getPopularCategories = (games) => {
    if (!Array.isArray(games) || games.length === 0) {
      console.log('No games available');
      return [];
    }
    
    const categories = new Map();
    const gamesInCategory = new Map();
    
    // First, collect all categories and calculate total weight per category
    games.forEach(game => {
      if (!game || !Array.isArray(game.category)) {
        return;
      }
      
      const gameWeight = parseInt(game.weight || 0);
      game.category.forEach(cat => {
        if (!cat) return; // Skip empty categories
        
        if (!gamesInCategory.has(cat)) {
          gamesInCategory.set(cat, []);
          categories.set(cat, 0);
        }
        gamesInCategory.get(cat).push(game);
        categories.set(cat, categories.get(cat) + gameWeight);
      });
    });
    
    // Get top categories based on total weight
    const topCategories = Array.from(categories.entries())
      .filter(([cat]) => {
        const categoryGames = gamesInCategory.get(cat);
        const uniqueGames = new Set(categoryGames.map(g => g.id || g.game));
        return uniqueGames.size >= 2;
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category]) => ({
        category,
        games: gamesInCategory.get(category)
          .filter((game, index, self) => 
            // Remove duplicates based on game ID or name
            index === self.findIndex(g => (g.id || g.game) === (game.id || game.game))
          )
          .sort((a, b) => parseInt(b.weight || 0) - parseInt(a.weight || 0))
          .slice(0, 4)
      }));
    
    return topCategories;
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
    setCurrentSlide((prev) => (prev === 0 ? carouselGames.length - 1 : prev - 1));
    setAutoPlay(false);
  }, [carouselGames]);

  const handleNextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === carouselGames.length - 1 ? 0 : prev + 1));
    setAutoPlay(false);
  }, [carouselGames]);

  const handleCloseTour = useCallback(() => {
    setShowTour(false);
    setSearchParams({});
  }, [setSearchParams]);

  const handleCarouselGameClick = useCallback((game) => {
    const container = document.querySelector('.page-container');
    if (container) {
      container.classList.add('fade-out');
    }
    
    setTimeout(() => {
      navigate('/download', { 
        state: { 
          gameData: game
        }
      });
    }, 300);
  }, [navigate]);

  const topGames = useMemo(() => getTopGames(apiGames), [apiGames]);
  const onlineGames = useMemo(() => getOnlineGames(apiGames), [apiGames]);
  const actionGames = useMemo(() => getActionGames(apiGames), [apiGames]);
  const popularCategories = useMemo(() => getPopularCategories(apiGames), [apiGames]);

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
                {carouselGames.map((game, index) => (
                  <div 
                    key={index} 
                    className="min-w-full cursor-pointer" 
                    onClick={() => handleCarouselGameClick(game)}
                  >
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                        <div className="absolute bottom-0 left-0 right-0 p-6">
                          <div className="flex items-center gap-2 text-white/80 mb-2">
                            {game.category?.slice(0, 3).map((cat, idx) => (
                              <span
                                key={cat + idx}
                                className="px-2 py-1 text-xs rounded-full bg-white/10"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                          <h2 className="text-2xl font-bold text-white mb-2">{game.game}</h2>
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
              {carouselGames.map((_, index) => (
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
            <section className="space-y-8">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Clock className="w-6 h-6 text-primary" />
                {t('home.recentGames')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {recentGames.map((game, index) => (
                  <RecentGameCard 
                    key={`recent-${game.game}-${index}`} 
                    game={game}
                    onPlay={handlePlayGame}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="space-y-8">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sword className="w-6 h-6 text-primary" />
              {t('home.topGames')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <Globe className="w-6 h-6 text-primary" />
              {t('home.onlineGames')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {onlineGames.map((game, index) => (
                <HomeGameCard 
                  key={`online-${game.id || index}`} 
                  game={game}
                />
              ))}
            </div>
          </section>

          <section className="space-y-8">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Flame className="w-6 h-6 text-primary" />
              {t('home.popularCategories')}
            </h2>
            <div className="space-y-8">
              {popularCategories.map(({ category, games }) => (
                <div key={category} className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
                    {games.map((game, index) => (
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

          <section className="space-y-8">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sword className="w-6 h-6 text-primary" />
              {t('home.actionGames')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {actionGames.map((game, index) => (
                <HomeGameCard 
                  key={`action-${game.id || index}`} 
                  game={game}
                />
              ))}
            </div>
          </section>

          <div className="text-center text-muted-foreground/50 py-8">
            <p className="text-sm">
              {t('home.footerNote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default Home;