import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { useLanguage } from '../contexts/LanguageContext';
import GameCard from '../components/GameCard';
import CategoryFilter from '../components/CategoryFilter';
import { 
  Search as SearchIcon, 
  SlidersHorizontal,
  Gamepad2,
  Gift,
  InfoIcon,
  RefreshCw,
} from 'lucide-react';
import gameService from '../services/gameService';
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { useNavigate } from 'react-router-dom';
import imageCacheService from '../services/imageCacheService';

// Module-level cache with timestamp
let gamesCache = {
  data: null,
  timestamp: null,
  expiryTime: 5 * 60 * 1000 // 5 minutes
};

const Search = memo(() => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [sortBy, setSortBy] = useState('weight');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showDLC, setShowDLC] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const gamesPerPage = useWindowSize();
  const [size, setSize] = useState(() => {
    const savedSize = localStorage.getItem('navSize');
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
    return gamesCache.data && 
           gamesCache.timestamp && 
           (Date.now() - gamesCache.timestamp) < gamesCache.expiryTime;
  }, []);

  const refreshGames = useCallback(async (forceRefresh = false) => {
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
        metadata: response.metadata
      };
      
      // Update cache with timestamp
      gamesCache = {
        data: gameData,
        timestamp: Date.now(),
        expiryTime: 5 * 60 * 1000
      };
      
      setGames(gameData.games);
      setApiMetadata(gameData.metadata);
    } catch (error) {
      console.error('Error refreshing games:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isCacheValid]);

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
      const newSize = localStorage.getItem('navSize');
      if (newSize) {
        setSize(parseFloat(newSize));
      }
    };

    window.addEventListener('navResize', handleResize);
    return () => window.removeEventListener('navResize', handleResize);
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

  const filteredGames = useMemo(() => {
    let result = games;
    
    if (!settings.seeInappropriateContent) {
      result = result.filter(game => !game.category?.includes('Nudity'));
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(game => 
        game.game?.toLowerCase().includes(query) ||
        game.description?.toLowerCase().includes(query)
      );
    }

    if (selectedCategories.length > 0) {
      result = result.filter(game =>
        selectedCategories.every(category =>
          game.category?.includes(category)
        )
      );
    }

    if (showDLC) {
      result = result.filter(game => game.dlc);
    }

    if (showOnline) {
      result = result.filter(game => game.online);
    }

    // Only sort if we have a valid sort criteria
    if (sortBy && sortOrder) {
      const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        if (sortBy === 'weight') {
          return sortMultiplier * (parseInt(a.weight) - parseInt(b.weight));
        }
        if (sortBy === 'name') {
          return sortMultiplier * a.game.localeCompare(b.game);
        }
        return 0;
      });
    }

    return result;
  }, [games, searchQuery, selectedCategories, sortBy, sortOrder, showDLC, showOnline, settings.seeInappropriateContent]);

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

  const handleDownload = async (game) => {
    try {
      // Get the cached image first
      const cachedImage = await imageCacheService.getImage(game.imgID);
      
      // Navigate to download page with both game data and cached image
      navigate('/download', {
        state: {
          gameData: {
            ...game,
            cachedHeaderImage: cachedImage // Include the cached header image
          }
        }
      });
    } catch (error) {
      console.error('Error preparing download:', error);
      // Still navigate but without cached image
      navigate('/download', {
        state: {
          gameData: game
        }
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
      console.error('Error checking for updates:', error);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  return (
    <div className="flex flex-col bg-background">
      <div className="flex-1 p-8 pb-24">
        <div className="max-w-[1400px] mx-auto">
          {apiMetadata && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <span>{apiMetadata.games.toLocaleString()} {t('search.gamesIndexed')}</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <InfoIcon className="w-4 h-4 cursor-pointer hover:text-foreground transition-colors" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-bold text-foreground">{t('search.indexedInformation')}</AlertDialogTitle>
                    <div className="space-y-2 mt-4 text-sm text-muted-foreground">
                      <p>
                        {t('search.indexedInformationDescription')}{" "}

                        <a
                          onClick={() => window.electron.openURL('https://ascendara.app/dmca')}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          {t('common.learnMore')}
                        </a>
                      </p>

                      <Separator className="bg-border/50" />
                      <p>{t('search.totalGames')}: {apiMetadata.games.toLocaleString()}</p>
                      <p>{t('search.source')}: {apiMetadata.source}</p>
                      <p>{t('search.lastUpdated')}: {apiMetadata.getDate}</p>
                      <Separator className="bg-border/50" />
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          onClick={handleRefreshIndex}
                          disabled={isRefreshing}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                          {isRefreshing ? t('search.refreshingIndex') : t('search.refreshIndex')}
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
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder={t('search.placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="secondary"
                    className="flex items-center gap-2 hover:bg-accent border-0"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {t('search.filters')}
                    {(showDLC || showOnline || selectedCategories.length > 0) && (
                      <span className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="border-0 bg-background p-6">
                  <SheetHeader>
                    <SheetTitle className="text-foreground">{t('search.filterOptions')}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <div className="flex items-center">
                      <div 
                        className="flex items-center gap-2 w-full"
                      >
                        <Gift className="w-4 h-4 text-primary" />
                        <Label 
                          className={`text-foreground cursor-pointer ${showDLC ? 'font-bold' : ''}`}
                          onClick={() => setShowDLC(prev => !prev)}
                        >
                          {t('search.showDLC')}
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div 
                        className="flex items-center gap-2 w-full"
                      >
                        <Gamepad2 className="w-4 h-4 text-primary" />
                        <Label 
                          className={`text-foreground cursor-pointer ${showOnline ? 'font-bold' : ''}`}
                          onClick={() => setShowOnline(prev => !prev)}
                        >
                          {t('search.showOnline')}
                        </Label>
                      </div>
                    </div>
                    <Separator className="bg-border/50" />
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-foreground">{t('search.sortBy')}</h4>
                      <RadioGroup 
                        defaultValue={`${sortBy}-${sortOrder}`}
                        onValueChange={(value) => {
                          const [newSortBy, newSortOrder] = value.split('-');
                          setSortBy(newSortBy);
                          setSortOrder(newSortOrder);
                        }}
                        className="gap-4"
                      >
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="weight-desc" id="weight-desc" />
                          <Label htmlFor="weight-desc" className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                            {t('search.mostPopular')}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="weight-asc" id="weight-asc" />
                          <Label htmlFor="weight-asc" className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                            {t('search.leastPopular')}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="name-asc" id="name-asc" />
                          <Label htmlFor="name-asc" className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                            {t('search.alphabeticalAZ')}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="name-desc" id="name-desc" />
                          <Label htmlFor="name-desc" className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                            {t('search.alphabeticalZA')}
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <Separator className="bg-border/50" />
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-foreground">{t('search.categories')}</h4>
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
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="h-[300px] animate-pulse" />
                ))}
              </div>
            ) : displayedGames.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">{t('search.noResults')}</p>
              </div>
            ) : (
              <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {displayedGames.map((game) => (
                    <GameCard 
                      key={game.imgID || game.id || `${game.game}-${game.version}`} 
                      game={game}
                      onDownload={() => handleDownload(game)}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div ref={loaderRef} className="flex justify-center py-8">
                    <div className="space-x-2 flex items-center">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

function useWindowSize() {
  const [gamesPerPage, setGamesPerPage] = useState(getInitialGamesPerPage());

  useEffect(() => {
    function handleResize() {
      setGamesPerPage(getInitialGamesPerPage());
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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