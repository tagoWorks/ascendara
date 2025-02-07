import React, { useState, useEffect, memo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import HomeGameCard from "@/components/HomeGameCard";
import RecentGameCard from "@/components/RecentGameCard";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { Sword, Flame, Globe, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import gameService from "@/services/gameService";
import Tour from "@/components/Tour";
import imageCacheService from "@/services/imageCacheService";
import recentGamesService from "@/services/recentGamesService";

// Module-level caches that persist during runtime
let gamesCache = null;
let carouselGamesCache = null;

const Home = memo(() => {
  const navigate = useNavigate();
  const [apiGames, setApiGames] = useState([]);
  const [installedGames, setInstalledGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carouselGames, setCarouselGames] = useState([]);
  const [topGames, setTopGames] = useState([]);
  const [onlineGames, setOnlineGames] = useState([]);
  const [actionGames, setActionGames] = useState([]);
  const [popularCategories, setPopularCategories] = useState({});
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showTour, setShowTour] = useState(false);
  const [carouselImages, setCarouselImages] = useState({});
  const [recentGames, setRecentGames] = useState([]);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);

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
              isCustom: false,
            })),
            ...(customGames || []).map(game => ({
              ...game,
              isCustom: true,
            })),
          ];

          setInstalledGames(actuallyInstalledGames);
          setLoading(false);
          return;
        }

        // Fetch fresh data if no cache
        const [gamesData, carouselGames] = await Promise.all([
          gameService.getAllGames(),
          gameService.getRandomTopGames(),
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
            isCustom: false,
          })),
          ...(customGames || []).map(game => ({
            ...game,
            isCustom: true,
          })),
        ];

        setApiGames(games);
        setInstalledGames(actuallyInstalledGames);
        setCarouselGames(carouselGames);
      } catch (error) {
        console.error("Error loading games:", error);
      } finally {
        setLoading(false);
      }
    };

    loadGames();
  }, []);

  useEffect(() => {
    if (searchParams.get("tour") === "true") {
      setShowTour(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev === carouselGames.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPlay, carouselGames]);

  useEffect(() => {
    if (!carouselGames.length) return;

    // Only load current and next image
    const loadCarouselImages = async () => {
      const totalSlides = carouselGames.length;
      const nextSlide = (currentSlide + 1) % totalSlides;
      const slidesToLoad = [currentSlide, nextSlide];

      for (const slideIndex of slidesToLoad) {
        const game = carouselGames[slideIndex];
        if (!game?.imgID || carouselImages[game.imgID]) continue;

        try {
          const imageUrl = await imageCacheService.getImage(game.imgID);
          if (imageUrl) {
            setCarouselImages(prev => ({
              ...prev,
              [game.imgID]: imageUrl,
            }));
          }
        } catch (error) {
          console.error(`Error loading carousel image for ${game.game}:`, error);
        }
      }
    };

    loadCarouselImages();
  }, [carouselGames, currentSlide]);

  useEffect(() => {
    const updateRecentGames = async () => {
      const recent = await getRecentGames([...installedGames, ...apiGames]);
      setRecentGames(recent);
    };
    updateRecentGames();
  }, [installedGames, apiGames]);

  useEffect(() => {
    // Get game sections first
    const {
      topGames: topSection,
      onlineGames: onlineSection,
      actionGames: actionSection,
      usedGames,
    } = getGameSections(apiGames);

    // Then get popular categories, passing the used games set
    const popularCats = getPopularCategories(apiGames, usedGames);

    // Update state
    setTopGames(topSection);
    setOnlineGames(onlineSection);
    setActionGames(actionSection);
    setPopularCategories(popularCats);
  }, [apiGames]);

  const getGameSections = games => {
    if (!Array.isArray(games)) return { topGames: [], onlineGames: [], actionGames: [] };

    // Create a shared Set to track used games across all sections
    const usedGames = new Set();

    // Get top games first (they get priority)
    const topGamesSection = games
      .filter(game => parseInt(game.weight || 0) > 30)
      .sort((a, b) => parseInt(b.weight || 0) - parseInt(a.weight || 0))
      .slice(0, 6);

    // Add top games to used set
    topGamesSection.forEach(game => usedGames.add(game.game));

    // Get online games, excluding used ones
    const onlineGamesSection = games
      .filter(game => game.online && !usedGames.has(game.game))
      .sort((a, b) => parseInt(b.weight || 0) - parseInt(a.weight || 0))
      .slice(0, 6);

    // Add online games to used set
    onlineGamesSection.forEach(game => usedGames.add(game.game));

    // Get action games, excluding used ones
    const actionGamesSection = games
      .filter(
        game =>
          Array.isArray(game.category) &&
          game.category.some(cat =>
            ["Action", "Adventure", "Fighting", "Shooter"].includes(cat)
          ) &&
          !usedGames.has(game.game)
      )
      .sort((a, b) => parseInt(b.weight || 0) - parseInt(a.weight || 0))
      .slice(0, 6);

    // Add action games to used set
    actionGamesSection.forEach(game => usedGames.add(game.game));

    return {
      topGames: topGamesSection,
      onlineGames: onlineGamesSection,
      actionGames: actionGamesSection,
      usedGames, // Return the set of used games for use in getPopularCategories
    };
  };

  const getPopularCategories = (games, usedGames = new Set()) => {
    if (!Array.isArray(games)) return {};

    const categories = {};

    // Helper function to get unique games for a category
    const getUniqueGamesForCategory = (category, count = 4) => {
      return games
        .filter(
          game =>
            game.category?.includes(category) &&
            !usedGames.has(game.game) &&
            parseInt(game.weight || 0) > 20
        )
        .sort((a, b) => parseInt(b.weight || 0) - parseInt(a.weight || 0))
        .slice(0, count)
        .map(game => {
          usedGames.add(game.game);
          return game;
        });
    };

    // Get games for each category
    const popularCategories = [
      "Action",
      "Adventure",
      "RPG",
      "Simulation",
      "Strategy",
      "Sports",
    ];

    popularCategories.forEach(category => {
      const categoryGames = getUniqueGamesForCategory(category);
      if (categoryGames.length >= 2) {
        categories[category] = categoryGames;
      }
    });

    return categories;
  };

  const handleImageIntersect = useCallback(
    async imgID => {
      if (!imgID || carouselImages[imgID]) return;

      try {
        const src = await imageCacheService.getImage(imgID);
        if (src) {
          setCarouselImages(prev => ({
            ...prev,
            [imgID]: src,
          }));
        }
      } catch (error) {
        console.error("Error loading carousel image:", error);
      }
    },
    [carouselImages]
  );

  const getRecentGames = async games => {
    const recentlyPlayed = recentGamesService.getRecentGames();

    try {
      // Get actually installed games from electron
      const installedGames = await window.electron.getGames();
      const customGames = await window.electron.getCustomGames();

      // Combine installed and custom games
      const actuallyInstalledGames = [
        ...(installedGames || []).map(game => ({
          ...game,
          isCustom: false,
        })),
        ...(customGames || []).map(game => ({
          name: game.game,
          game: game.game,
          version: game.version,
          online: game.online,
          dlc: game.dlc,
          executable: game.executable,
          isCustom: true,
        })),
      ];

      // Filter out games that are no longer installed and merge with full game details
      return recentlyPlayed
        .filter(recentGame =>
          actuallyInstalledGames.some(g => g.game === recentGame.game)
        )
        .map(recentGame => {
          const gameDetails =
            games.find(g => g.game === recentGame.game) ||
            actuallyInstalledGames.find(g => g.game === recentGame.game);
          return {
            ...gameDetails,
            lastPlayed: recentGame.lastPlayed,
          };
        });
    } catch (error) {
      console.error("Error getting installed games:", error);
      return [];
    }
  };

  const handlePlayGame = async game => {
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
        dlc: game.dlc,
      });
    } catch (error) {
      console.error("Error playing game:", error);
    }
  };

  const handlePrevSlide = useCallback(() => {
    setCurrentSlide(prev => (prev === 0 ? carouselGames.length - 1 : prev - 1));
    setAutoPlay(false);
  }, [carouselGames]);

  const handleNextSlide = useCallback(() => {
    setCurrentSlide(prev => (prev === carouselGames.length - 1 ? 0 : prev + 1));
    setAutoPlay(false);
  }, [carouselGames]);

  const handleCloseTour = useCallback(() => {
    setShowTour(false);
    setSearchParams({});
  }, [setSearchParams]);

  const handleCarouselGameClick = useCallback(
    game => {
      const container = document.querySelector(".page-container");
      if (container) {
        container.classList.add("fade-out");
      }

      setTimeout(() => {
        navigate("/download", {
          state: {
            gameData: game,
          },
        });
      }, 300);
    },
    [navigate]
  );

  const handleTouchStart = useCallback(e => {
    setTouchStart(e.touches[0].clientX);
    setTouchEnd(e.touches[0].clientX);
    setIsDragging(true);
    setDragStart(e.touches[0].clientX);
    setAutoPlay(false);
  }, []);

  const handleTouchMove = useCallback(
    e => {
      if (!isDragging) return;
      setTouchEnd(e.touches[0].clientX);
      const offset = e.touches[0].clientX - dragStart;
      setDragOffset(offset);
    },
    [isDragging, dragStart]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    const diff = touchStart - touchEnd;
    const threshold = window.innerWidth * 0.2; // 20% of screen width

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        handleNextSlide();
      } else {
        handlePrevSlide();
      }
    }
    setDragOffset(0);
  }, [touchStart, touchEnd]);

  const handleMouseDown = useCallback(e => {
    setIsDragging(true);
    setDragStart(e.clientX);
    setAutoPlay(false);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback(
    e => {
      if (!isDragging) return;
      const offset = e.clientX - dragStart;
      setDragOffset(offset);
      e.preventDefault();
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(
    e => {
      if (!isDragging) return;
      setIsDragging(false);
      const diff = dragStart - e.clientX;
      const threshold = window.innerWidth * 0.2;

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          handleNextSlide();
        } else {
          handlePrevSlide();
        }
      }
      setDragOffset(0);
      e.preventDefault();
    },
    [isDragging, dragStart]
  );

  const handleMouseLeave = useCallback(
    e => {
      if (isDragging) {
        handleMouseUp(e);
      }
    },
    [isDragging, handleMouseUp]
  );

  return loading ? (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl p-4 md:p-8">
        <div className="space-y-12">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  ) : (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl p-4 md:p-8">
        {showTour && <Tour onClose={handleCloseTour} />}

        <div className="space-y-12">
          <div className="group relative">
            <div className="overflow-hidden rounded-2xl shadow-lg">
              <div
                className={`flex transition-transform duration-500 ${isDragging ? "transition-none" : ""}`}
                style={{
                  transform: `translateX(calc(-${currentSlide * 100}% + ${dragOffset}px))`,
                  cursor: isDragging ? "grabbing" : "grab",
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              >
                {carouselGames.map((game, index) => (
                  <div
                    key={game.game}
                    className="min-w-full select-none"
                    onClick={() => !isDragging && handleCarouselGameClick(game)}
                  >
                    <div className="relative aspect-[21/9]">
                      {!carouselImages[game.imgID] ? (
                        <Skeleton className="absolute inset-0 h-full w-full animate-pulse bg-muted" />
                      ) : (
                        <img
                          src={carouselImages[game.imgID]}
                          alt={game.game}
                          className="h-full w-full object-cover"
                          draggable="false"
                          loading={
                            index === currentSlide ||
                            index === (currentSlide + 1) % carouselGames.length
                              ? "eager"
                              : "lazy"
                          }
                        />
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                        <div className="absolute bottom-0 left-0 right-0 p-6">
                          <div className="mb-2 flex items-center gap-2 text-white/80">
                            {game.category?.slice(0, 3).map((cat, idx) => (
                              <span
                                key={cat + idx}
                                className="rounded-full bg-white/10 px-2 py-1 text-xs"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                          <h2 className="mb-2 text-2xl font-bold text-white">
                            {game.game}
                          </h2>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              {carouselGames.map((_, index) => (
                <button
                  key={index}
                  className={`h-2 w-2 rounded-full transition-all ${
                    index === currentSlide
                      ? "w-4 bg-white"
                      : "bg-white/50 hover:bg-white/70"
                  }`}
                  onClick={() => {
                    setCurrentSlide(index);
                    setAutoPlay(false);
                  }}
                />
              ))}
            </div>

            <button
              onClick={handlePrevSlide}
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={handleNextSlide}
              className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
              aria-label="Next slide"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {recentGames.length > 0 && (
            <section className="space-y-8">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
                <Clock className="h-6 w-6 text-primary" />
                {t("home.recentGames")}
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Sword className="h-6 w-6 text-primary" />
              {t("home.topGames")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loading
                ? Array(4)
                    .fill(0)
                    .map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <AspectRatio ratio={16 / 9}>
                          <Skeleton className="h-full w-full" />
                        </AspectRatio>
                      </div>
                    ))
                : topGames.map(game => <HomeGameCard key={game.game} game={game} />)}
            </div>
          </section>

          <section className="space-y-8">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Globe className="h-6 w-6 text-primary" />
              {t("home.onlineGames")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {onlineGames.map(game => (
                <HomeGameCard key={game.game} game={game} />
              ))}
            </div>
          </section>

          <section className="space-y-8">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Flame className="h-6 w-6 text-primary" />
              {t("home.actionGames")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {actionGames.map(game => (
                <HomeGameCard key={game.game} game={game} />
              ))}
            </div>
          </section>

          <section className="space-y-8">
            <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Flame className="h-6 w-6 text-primary" />
              {t("home.popularCategories")}
            </h2>
            <div className="space-y-8">
              {Object.keys(popularCategories).map((category, index) => (
                <div key={category} className="space-y-4">
                  <h3 className="text-xl font-semibold text-foreground">{category}</h3>
                  <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {popularCategories[category].map((game, index) => (
                      <HomeGameCard key={`${category}-${game.id || index}`} game={game} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="py-8 text-center text-muted-foreground/50">
            <p className="text-sm">{t("home.footerNote")}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default Home;
