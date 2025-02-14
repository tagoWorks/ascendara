import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import GameCard from "@/components/GameCard";
import CategoryFilter from "@/components/CategoryFilter";
import {
  Search as SearchIcon,
  SlidersHorizontal,
  Gamepad2,
  Gift,
  InfoIcon,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  X,
} from "lucide-react";
import gameService from "@/services/gameService";
import {
  subscribeToStatus,
  getCurrentStatus,
  startStatusCheck,
} from "@/services/serverStatus";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogCancel,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import imageCacheService from "@/services/imageCacheService";

// Module-level cache with timestamp
let gamesCache = {
  data: null,
  timestamp: null,
  expiryTime: 5 * 60 * 1000, // 5 minutes
};

const Search = memo(() => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState(() => {
    const saved = window.localStorage.getItem('selectedCategories');
    return saved ? JSON.parse(saved) : [];
  });
  const [onlineFilter, setOnlineFilter] = useState(() => {
    const saved = window.localStorage.getItem('onlineFilter');
    return saved || "all";
  });
  const [selectedSort, setSelectedSort] = useState(() => {
    const saved = window.localStorage.getItem('selectedSort');
    return saved || "weight";
  });
  const [showDLC, setShowDLC] = useState(() => {
    const saved = window.localStorage.getItem('showDLC');
    return saved === 'true';
  });
  const [showOnline, setShowOnline] = useState(() => {
    const saved = window.localStorage.getItem('showOnline');
    return saved === 'true';
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isIndexUpdating, setIsIndexUpdating] = useState(false);
  const gamesPerPage = useWindowSize();
  const [size, setSize] = useState(() => {
    const savedSize = localStorage.getItem("navSize");
    return savedSize ? parseFloat(savedSize) : 100;
  });
  const [settings, setSettings] = useState({ seeInappropriateContent: false });
  const [displayedGames, setDisplayedGames] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef(null);
  const gamesPerLoad = useWindowSize();
  const [apiMetadata, setApiMetadata] = useState(null);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const isCacheValid = useCallback(() => {
    return (
      gamesCache.data &&
      gamesCache.timestamp &&
      Date.now() - gamesCache.timestamp < gamesCache.expiryTime
    );
  }, []);

  const fuzzyMatch = (text, query) => {
    if (!text || !query) return false;
    text = text.toLowerCase();
    query = query.toLowerCase();

    // Split query into words and check if each word matches
    const queryWords = query.split(/\s+/).filter(word => word.length > 0);
    if (queryWords.length === 0) return false;

    return queryWords.every(queryWord => {
      const words = text.split(/\s+/);
      return words.some(word => {
        if (word.includes(queryWord)) return true;
        let matches = 0;
        const uniqueChars = [...new Set(queryWord)];
        uniqueChars.forEach(char => {
          if (word.includes(char)) matches++;
        });

        return matches >= queryWord.length * 0.8;
      });
    });
  };

  const refreshGames = useCallback(
    async (forceRefresh = false) => {
      if (!forceRefresh && isCacheValid()) {
        setGames(gamesCache.data.games);
        setApiMetadata(gamesCache.data.metadata);
        return;
      }

      setIsRefreshing(true);
      try {
        const response = await gameService.getAllGames();
        const gameData = {
          games: response.games,
          metadata: response.metadata,
        };

        // Update cache with timestamp
        gamesCache = {
          data: gameData,
          timestamp: Date.now(),
          expiryTime: 5 * 60 * 1000,
        };

        setGames(gameData.games);
        setApiMetadata(gameData.metadata);
      } catch (error) {
        console.error("Error refreshing games:", error);
      } finally {
        setIsRefreshing(false);
      }
    },
    [isCacheValid]
  );

  useEffect(() => {
    setLoading(true);
    refreshGames().finally(() => setLoading(false));
  }, [refreshGames]);

  useEffect(() => {
    setLoading(true);
    refreshGames(true).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const newSize = localStorage.getItem("navSize");
      if (newSize) {
        setSize(parseFloat(newSize));
      }
    };

    window.addEventListener("navResize", handleResize);
    return () => window.removeEventListener("navResize", handleResize);
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      const savedSettings = await window.electron.getSettings();
      if (savedSettings) {
        setSettings(savedSettings);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const checkIndexStatus = async () => {
      try {
        const status = getCurrentStatus();
        if (status?.api?.data?.status === "updatingIndex") {
          setIsIndexUpdating(true);
        } else {
          setIsIndexUpdating(false);
        }
      } catch (error) {
        console.error("Error checking index status:", error);
        setIsIndexUpdating(false);
      }
    };

    // Subscribe to status updates
    const unsubscribe = subscribeToStatus(status => {
      if (status?.api?.data?.status === "updatingIndex") {
        setIsIndexUpdating(true);
      } else {
        setIsIndexUpdating(false);
      }
    });

    // Initial check
    checkIndexStatus();

    return () => unsubscribe();
  }, []);

  // Start status check interval when component mounts
  useEffect(() => {
    const stopStatusCheck = startStatusCheck();
    return () => stopStatusCheck();
  }, []);

  useEffect(() => {
    window.localStorage.setItem('selectedCategories', JSON.stringify(selectedCategories));
  }, [selectedCategories]);

  useEffect(() => {
    window.localStorage.setItem('onlineFilter', onlineFilter);
  }, [onlineFilter]);

  useEffect(() => {
    window.localStorage.setItem('selectedSort', selectedSort);
  }, [selectedSort]);

  useEffect(() => {
    window.localStorage.setItem('showDLC', showDLC);
  }, [showDLC]);

  useEffect(() => {
    window.localStorage.setItem('showOnline', showOnline);
  }, [showOnline]);

  const filteredGames = useMemo(() => {
    if (!games) return [];

    let filtered = [...games];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(game => {
        const gameTitle = game.game.toLowerCase();
        const gameDesc = (game.desc || "").toLowerCase();
        return fuzzyMatch(gameTitle + " " + gameDesc, searchQuery);
      });
    }

    // Apply category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(game =>
        selectedCategories.every(category => 
          game.category?.includes(category)
        )
      );
    }

    // Apply online filter
    if (onlineFilter !== "all") {
      filtered = filtered.filter(game => {
        if (onlineFilter === "online") return game.online;
        if (onlineFilter === "offline") return !game.online;
        return true;
      });
    }

    // Apply source filter
    const source = settings?.gameSource || 'steamrip';
    if (source === 'fitgirl') {
      // For fitgirl, show all games without additional filtering
      return filtered;
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (selectedSort) {
        case "weight":
          return parseInt(b.weight || 0) - parseInt(a.weight || 0);
        case "weight-asc":
          return parseInt(a.weight || 0) - parseInt(b.weight || 0);
        case "name":
          return a.game.localeCompare(b.game);
        case "name-desc":
          return b.game.localeCompare(a.game);
        default:
          return 0;
      }
    });

    return filtered;
  }, [games, searchQuery, selectedCategories, onlineFilter, selectedSort, settings?.gameSource]);

  useEffect(() => {
    setDisplayedGames(filteredGames.slice(0, gamesPerLoad));
    setHasMore(filteredGames.length > gamesPerLoad);
  }, [filteredGames, gamesPerLoad]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    const currentLength = displayedGames.length;
    const nextGames = filteredGames.slice(currentLength, currentLength + gamesPerLoad);

    setTimeout(() => {
      setDisplayedGames(prev => [...prev, ...nextGames]);
      setHasMore(currentLength + gamesPerLoad < filteredGames.length);
      setIsLoadingMore(false);
    }, 500);
  }, [displayedGames.length, filteredGames, gamesPerLoad, hasMore, isLoadingMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore]);

  const handleDownload = async game => {
    try {
      // Get the cached image first
      const cachedImage = await imageCacheService.getImage(game.imgID);

      // Navigate to download page with both game data and cached image
      navigate("/download", {
        state: {
          gameData: {
            ...game,
            cachedHeaderImage: cachedImage, // Include the cached header image
          },
        },
      });
    } catch (error) {
      console.error("Error preparing download:", error);
      // Still navigate but without cached image
      navigate("/download", {
        state: {
          gameData: game,
        },
      });
    }
  };

  const handleRefreshIndex = async () => {
    setIsRefreshing(true);

    try {
      // Quick check of just the Last-Modified header
      const lastModified = await gameService.checkMetadataUpdate();

      if (lastModified) {
        // If we got a Last-Modified header, fetch fresh data
        const freshData = await gameService.getAllGames();
        setGames(freshData.games);
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  return (
    <div className="flex flex-col bg-background">
      <div className="flex-1 p-8 pb-24">
        <div className="mx-auto max-w-[1400px]">
          {apiMetadata && (
            <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {apiMetadata.games.toLocaleString()} {t("search.gamesIndexed")}
              </span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <InfoIcon className="h-4 w-4 cursor-pointer transition-colors hover:text-foreground" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogCancel className="absolute right-2 top-2 cursor-pointer text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </AlertDialogCancel>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-bold text-foreground">
                      {t("search.indexedInformation")}
                    </AlertDialogTitle>
                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <p>
                        {t("search.indexedInformationDescription")}{" "}
                        <a
                          onClick={() =>
                            window.electron.openURL("https://ascendara.app/dmca")
                          }
                          className="cursor-pointer text-primary hover:underline"
                        >
                          {t("common.learnMore")}{" "}
                          <ExternalLink className="mb-1 inline-block h-3 w-3" />
                        </a>
                      </p>

                      <Separator className="bg-border/50" />
                      <p>
                        {t("search.totalGames")}: {apiMetadata.games.toLocaleString()}
                      </p>
                      <p>
                        {t("search.source")}: {apiMetadata.source}
                      </p>
                      <p>
                        {t("search.lastUpdated")}: {apiMetadata.getDate}
                      </p>
                      <Separator className="bg-border/50" />
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          onClick={handleRefreshIndex}
                          disabled={isRefreshing}
                          className="flex w-full items-center justify-center gap-2"
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                          />
                          {isRefreshing
                            ? t("search.refreshingIndex")
                            : t("search.refreshIndex")}
                        </Button>
                      </div>
                    </div>
                  </AlertDialogHeader>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("search.placeholder")}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {isIndexUpdating && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 transform text-yellow-500">
                    <AlertTriangle size={20} />
                  </div>
                )}
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="secondary"
                    className="flex items-center gap-2 border-0 hover:bg-accent"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    {t("search.filters")}
                    {(showDLC || showOnline || selectedCategories.length > 0) && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="border-0 bg-background p-6">
                  <SheetHeader>
                    <SheetTitle className="text-foreground">
                      {t("search.filterOptions")}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center">
                      <div className="flex w-full items-center gap-2">
                        <Gift className="h-4 w-4 text-primary" />
                        <Label
                          className={`cursor-pointer text-foreground ${showDLC ? "font-bold" : ""}`}
                          onClick={() => setShowDLC(prev => !prev)}
                        >
                          {t("search.showDLC")}
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="flex w-full items-center gap-2">
                        <Gamepad2 className="h-4 w-4 text-primary" />
                        <Label
                          className={`cursor-pointer text-foreground ${showOnline ? "font-bold" : ""}`}
                          onClick={() => setShowOnline(prev => !prev)}
                        >
                          {t("search.showOnline")}
                        </Label>
                      </div>
                    </div>
                    <Separator className="bg-border/50" />
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-foreground">
                        {t("search.sortBy")}
                      </h4>
                      <RadioGroup
                        value={selectedSort}
                        onValueChange={setSelectedSort}
                        className="grid grid-cols-1 gap-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="weight" id="weight" />
                          <Label className="text-foreground" htmlFor="weight">{t("search.mostPopular")}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="weight-asc" id="weight-asc" />
                          <Label className="text-foreground" htmlFor="weight-asc">{t("search.leastPopular")}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="name" id="name" />
                          <Label className="text-foreground" htmlFor="name">{t("search.alphabeticalAZ")}</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="name-desc" id="name-desc" />
                          <Label className="text-foreground" htmlFor="name-desc">{t("search.alphabeticalAZ")}</Label>
                        </div>alphabeticalAZ
                      </RadioGroup>
                    </div>
                    <Separator className="bg-border/50" />
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-foreground">
                        {t("search.categories")}
                      </h4>
                      <CategoryFilter
                        selectedCategories={selectedCategories}
                        setSelectedCategories={setSelectedCategories}
                        games={games}
                        showMatureCategories={settings.seeInappropriateContent}
                      />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              {isRefreshing && (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                </div>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="h-[300px] animate-pulse" />
                ))}
              </div>
            ) : displayedGames.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-lg text-muted-foreground">{t("search.noResults")}</p>
              </div>
            ) : (
              <div className="relative">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {displayedGames.map(game => (
                    <GameCard
                      key={game.imgID || game.id || `${game.game}-${game.version}`}
                      game={game}
                      onDownload={() => handleDownload(game)}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div ref={loaderRef} className="flex justify-center py-8">
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-primary"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {isIndexUpdating && (
        <AlertDialog defaultOpen>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-2xl font-bold text-foreground">
                <AlertTriangle className="text-yellow-500" />
                Index Update in Progress
              </AlertDialogTitle>
            </AlertDialogHeader>
            <p className="text-muted-foreground">
              The search index is currently being updated. Search results may be
              incomplete or inconsistent during this time. Please try again later.
            </p>
            <div className="mt-4 flex justify-end">
              <AlertDialogCancel className="text-muted-foreground">
                Dismiss
              </AlertDialogCancel>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
});

function useWindowSize() {
  const [gamesPerPage, setGamesPerPage] = useState(getInitialGamesPerPage());

  useEffect(() => {
    function handleResize() {
      setGamesPerPage(getInitialGamesPerPage());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function getInitialGamesPerPage() {
    const width = window.innerWidth;
    if (width >= 1400) return 16;
    if (width >= 1024) return 12;
    if (width >= 768) return 8;
    return 4;
  }

  return gamesPerPage;
}

export default Search;
