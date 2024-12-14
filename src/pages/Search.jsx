import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import GameCard from '../components/GameCard';
import CategoryFilter from '../components/CategoryFilter';
import { 
  Search as SearchIcon, 
  SlidersHorizontal,
  Gamepad2,
  Gift,
  InfoIcon
} from 'lucide-react';
import gameService from '../services/gameService';
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";

const Search = memo(() => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
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

  const refreshGames = async () => {
    setIsRefreshing(true);
    try {
      const response = await gameService.getAllGames();
      setGames(Array.isArray(response.games) ? response.games : []);
      setApiMetadata(response.metadata || null);
    } catch (error) {
      console.error('Error refreshing games:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    refreshGames().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    gameService.getAllGames()
      .then(response => {
        if (response.data) {
          setGames(response.data.games || []);
          setApiMetadata(response.data.metadata);
        } else if (response.games) {
          setGames(response.games);
          setApiMetadata(response.metadata);
        } else {
          setGames(response);
          setApiMetadata(null);
        }
      })
      .finally(() => setLoading(false));
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
    let result = [...games];
    
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

    switch (sortBy) {
      case 'weight':
        return result.sort((a, b) => sortOrder === 'asc' ? parseInt(a.weight) - parseInt(b.weight) : parseInt(b.weight) - parseInt(a.weight));
      case 'name':
        return result.sort((a, b) => sortOrder === 'asc' ? a.game.localeCompare(b.game) : b.game.localeCompare(a.game));
      default:
        return result;
    }
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

  return (
    <div className="flex flex-col bg-background">
      <div className="flex-1 p-8 pb-24">
        <div className="max-w-[1400px] mx-auto">
          {apiMetadata && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <span>{apiMetadata.games.toLocaleString()} Games Indexed</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <InfoIcon className="w-4 h-4 cursor-pointer hover:text-foreground transition-colors" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Indexed Information</AlertDialogTitle>
                    <div className="space-y-2 mt-4 text-sm text-muted-foreground">
                      <p>Ascendara uses a custom developed database to store game links and information. This database is updated monthly.</p>
                      <Separator className="bg-border/50" />
                      <p>Total Games: {apiMetadata.games.toLocaleString()}</p>
                      <p>Source: {apiMetadata.source}</p>
                      <p>Last Updated: {apiMetadata.getDate}</p>
                      <Separator className="bg-border/50" />
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          onClick={refreshGames}
                          disabled={isRefreshing}
                          className="w-full flex items-center justify-center gap-2"
                        >
                          <svg
                            className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          {isRefreshing ? 'Refreshing Index...' : 'Refresh Index'}
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
                  placeholder="Search games..."
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
                    Filters
                    {(showDLC || showOnline || selectedCategories.length > 0) && (
                      <span className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="border-0 bg-background p-6">
                  <SheetHeader>
                    <SheetTitle className="text-foreground">Filters</SheetTitle>
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
                          DLC Games
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
                          Online Multiplayer
                        </Label>
                      </div>
                    </div>
                    <Separator className="bg-border/50" />
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-foreground">Sort By</h4>
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
                            Most Popular
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="weight-asc" id="weight-asc" />
                          <Label htmlFor="weight-asc" className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                            Least Popular
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="name-asc" id="name-asc" />
                          <Label htmlFor="name-asc" className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                            Alphabetical A-Z
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <RadioGroupItem value="name-desc" id="name-desc" />
                          <Label htmlFor="name-desc" className="text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                            Alphabetical Z-A
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                    <Separator className="bg-border/50" />
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-foreground">Categories</h4>
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
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="h-[300px] animate-pulse" />
                ))}
              </div>
            ) : displayedGames.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-lg text-muted-foreground">No games found</p>
              </div>
            ) : (
              <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {displayedGames.map((game) => (
                    <GameCard 
                      key={game.imgID || game.id || `${game.game}-${game.version}`} 
                      game={game} 
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