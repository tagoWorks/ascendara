import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  CardContent,
  CardFooter 
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { useLanguage } from '../contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { 
  MoreVertical, 
  Play, 
  Plus,
  FolderOpen,
  Pencil,
  Trash2,
  Shield,
  Gamepad2,
  Monitor,
  Gift,
  Search as SearchIcon,
  Loader,
  StopCircle,
  AlertTriangle,
  Heart
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Separator } from "../components/ui/separator";
import { Progress } from "../components/ui/progress";
import recentGamesService from '../services/recentGamesService';
import imageCacheService from '../services/imageCacheService';
import gameService from '../services/gameService';
import fs from 'fs';
import { toast } from 'sonner';

const Library = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddGameOpen, setIsAddGameOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [uninstallingGame, setUninstallingGame] = useState(null);
  const [launchingGame, setLaunchingGame] = useState(null);
  const [coverSearchQuery, setCoverSearchQuery] = useState("");
  const [coverSearchResults, setCoverSearchResults] = useState([]);
  const [isCoverSearchLoading, setIsCoverSearchLoading] = useState(false);
  const [selectedGameImage, setSelectedGameImage] = useState(null);
  const [errorGame, setErrorGame] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    const savedFavorites = localStorage.getItem('game-favorites');
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  });
  const errorTimeoutRef = useRef(null);
  const { t } = useLanguage();

  useEffect(() => {
    localStorage.setItem('game-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    // Add keyframes to document
    const styleSheet = document.styleSheets[0];
    const keyframes = `
      @keyframes shimmer {
        0% { transform: translateX(-100%) }
        100% { transform: translateX(100%) }
      }
    `;
    styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
  }, []);

  const toggleFavorite = (gameName) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(gameName)
        ? prev.filter(name => name !== gameName)
        : [...prev, gameName];
      return newFavorites;
    });
  };

  const loadGames = async () => {
    try {
      // Get games from main process
      const installedGames = await window.electron.ipcRenderer.invoke('get-games');
      const customGames = await window.electron.ipcRenderer.invoke('get-custom-games');

      // Filter out games that are currently downloading
      const filteredInstalledGames = installedGames.filter(game => {
        const { downloadingData } = game;
        return !downloadingData || !(
          downloadingData.downloading ||
          downloadingData.extracting ||
          downloadingData.updating ||
          downloadingData.error
        );
      });

      // Combine both types of games
      const allGames = [
        ...(filteredInstalledGames || []).map(game => ({
          ...game,
          isCustom: false
        })),
        ...(customGames || []).map(game => ({
          name: game.game,
          game: game.game, // Keep original property for compatibility
          version: game.version,
          online: game.online,
          dlc: game.dlc,
          executable: game.executable,
          isCustom: true,
          custom: true
        }))
      ];

      setGames(allGames);
      setLoading(false);
    } catch (error) {
      console.error('Error loading games:', error);
      setError('Failed to load games');
      setLoading(false);
    }
  };

  const handleGameLaunchError = (_, { game, error }) => {
    // Clear any existing error timeout
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }

    // Set a timeout to show the error dialog to debounce multiple events
    errorTimeoutRef.current = setTimeout(() => {
      setErrorGame(game);
      setErrorMessage(error);
      setShowErrorDialog(true);
      setLaunchingGame(null);
    }, 100);
  };

  const handleGameLaunchSuccess = (_, { game }) => {
    setLaunchingGame(null);
  };

  useEffect(() => {
    loadGames();

    // Set up event listeners
    window.electron.ipcRenderer.on('game-launch-error', handleGameLaunchError);
    window.electron.ipcRenderer.on('game-launch-success', handleGameLaunchSuccess);

    return () => {
      // Clean up event listeners
      window.electron.ipcRenderer.removeListener('game-launch-error', handleGameLaunchError);
      window.electron.ipcRenderer.removeListener('game-launch-success', handleGameLaunchSuccess);
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // Load games on component mount
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchGameCovers(coverSearchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [coverSearchQuery]);

  // Filter games based on search query
  const filteredGames = games
    .slice()
    .sort((a, b) => {
      const aName = a.game || a.name;
      const bName = b.game || b.name;
      const aFavorite = favorites.includes(aName);
      const bFavorite = favorites.includes(bName);
      
      // If both are favorites or both are not favorites, sort alphabetically
      if (aFavorite === bFavorite) {
        return aName.localeCompare(bName);
      }
      // If a is favorite and b is not, a comes first
      return aFavorite ? -1 : 1;
    })
    .filter(game => {
      const searchLower = searchQuery.toLowerCase();
      return (game.game || game.name).toLowerCase().includes(searchLower);
    });

  const handlePlayGame = async (game) => {
    const gameName = game.game || game.name;
    setLaunchingGame(gameName);
    // Check if window.electron.isDev is true. Cannot run in developer mode
    if (await window.electron.ipcRenderer.invoke('is-dev')) {
      toast.error(t('library.cannotRunDev'))
      setLaunchingGame(null);
      return;
    }



    try {
      // First check if game is already running
      const isRunning = await window.electron.ipcRenderer.invoke('is-game-running', gameName);
      if (isRunning) {
        toast.error(t('library.alreadyRunning', { game: gameName }));
        setLaunchingGame(null);
        return;
      }

      // Launch the game
      await window.electron.ipcRenderer.invoke('play-game', gameName, game.isCustom);
      
      // Get and cache the game image before saving to recently played
      const imageBase64 = await window.electron.ipcRenderer.invoke('get-game-image', gameName);
      if (imageBase64) {
        await imageCacheService.getImage(game.imgID);
      }
      
      // Save to recently played games
      recentGamesService.addRecentGame({
        game: gameName,
        name: game.name,
        imgID: game.imgID,
        version: game.version,
        isCustom: game.isCustom,
        online: game.online,
        dlc: game.dlc
      });
    } catch (error) {
      console.error('Error launching game:', error);
      setLaunchingGame(null);
    }
  };

  const handleDeleteGame = async (game) => {
    try {
      if (game.isCustom) {
        await window.electron.ipcRenderer.invoke('remove-game', game.game || game.name);
      } else {
        setIsUninstalling(true);
        setUninstallingGame(game.game || game.name);
        await window.electron.ipcRenderer.invoke('delete-game', game.game || game.name);
      }
      setGames(games.filter(g => (g.game || g.name) !== (game.game || game.name)));
      setGameToDelete(null);
      setIsUninstalling(false);
      setUninstallingGame(null);
    } catch (error) {
      console.error('Error deleting game:', error);
      setError('Failed to delete game');
      setIsUninstalling(false);
      setUninstallingGame(null);
    }
  };

  const handleOpenDirectory = async (game) => {
    try {
      await window.electron.ipcRenderer.invoke('open-game-directory', game.game || game.name, game.isCustom);
    } catch (error) {
      console.error('Error opening directory:', error);
      setError('Failed to open game directory');
    }
  };

  const isGameSelected = (game, selectedGame) => {
    if (!selectedGame) return false;
    const gameId = game.game || game.name;
    const selectedId = selectedGame.game || selectedGame.name;
    return gameId === selectedId;
  };

  const searchGameCovers = async (query) => {
    if (!query.trim()) {
      setCoverSearchResults([]);
      return;
    }
    
    setIsCoverSearchLoading(true);
    try {
      const results = await gameService.searchGameCovers(query);
      setCoverSearchResults(results);
    } catch (error) {
      console.error('Error searching game covers:', error);
      setCoverSearchResults([]);
    } finally {
      setIsCoverSearchLoading(false);
    }
  };

  const handleCloseErrorDialog = () => {
    setShowErrorDialog(false);
    setErrorGame(null);
    setErrorMessage('');
  };

  const ErrorDialog = () => (
    <AlertDialog open={showErrorDialog} onOpenChange={handleCloseErrorDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-bold text-foreground">{t('library.launchError')}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-muted-foreground">
            <p>{t('library.launchErrorMessage', { game: errorGame })}</p>
            <p>{errorMessage}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2">
          <Button variant="secondary" onClick={handleCloseErrorDialog}>
            {t('common.cancel')}
          </Button>
          <Button className="text-secondary" onClick={async () => {
                const exePath = await window.electron.ipcRenderer.invoke('open-file-dialog');
                if (exePath) {
                  await window.electron.ipcRenderer.invoke('modify-game-executable', errorGame, exePath);
                }
                handleCloseErrorDialog();
              }}>
            {t('library.changeExecutable')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">{t('library.loadingGames')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-4 md:p-8">
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}
        
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-primary">{t('library.installedGames')}</h1>
            <Separator orientation="vertical" className="h-8" />
            <p className="text-muted-foreground">
              {games.length === 0 
                ? t('library.noGamesMessage')
                : `${games.length} ${t('library.game')}${games.length === 1 ? '' : 's'} ${t('library.inYourLibrary')}`}
            </p>
          </div>

          <Input
            placeholder={t('library.searchLibrary')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AlertDialog key="add-game-dialog" open={isAddGameOpen} onOpenChange={setIsAddGameOpen}>
            <AlertDialogTrigger asChild>
              <AddGameCard />
            </AlertDialogTrigger>
            <AlertDialogContent className="sm:max-w-[425px] bg-background border-border">
              <AlertDialogHeader className="space-y-2">
                <AlertDialogTitle className="text-2xl font-bold text-foreground">
                  {t('library.addGame')}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  {t('library.addGameDescription2')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4 max-h-[60vh] overflow-y-auto">
                <AddGameForm onSuccess={() => {
                  setIsAddGameOpen(false);
                  setSelectedGameImage(null);
                  loadGames();
                }} />
              </div>
            </AlertDialogContent>
          </AlertDialog>

          {filteredGames.map((game) => (
            <div key={game.game || game.name}>
              <InstalledGameCard
                game={game}
                onPlay={() => handlePlayGame(game)}
                onDelete={() => setGameToDelete(game)}
                onSelect={() => setSelectedGame(game)}
                isSelected={isGameSelected(game, selectedGame)}
                onOpenDirectory={() => handleOpenDirectory(game)}
                isLaunching={launchingGame === (game.game || game.name)}
                isUninstalling={uninstallingGame === (game.game || game.name)}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          ))}
        </div>

        <ErrorDialog />

        <AlertDialog 
          key="delete-game-dialog" 
          open={!!gameToDelete} 
          onOpenChange={(open) => !open && setGameToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-foreground">
                {gameToDelete?.isCustom 
                  ? t('library.removeGameFromLibrary')
                  : t('library.uninstallGame')}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                {gameToDelete?.isCustom 
                  ? t('library.removeGameFromLibraryWarning')
                  : t('library.uninstallGameWarning')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex justify-end gap-2">
              {isUninstalling ? (
                <div className="w-full">
                  <Progress className="w-full" value={undefined} />
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    {t('library.uninstallingGame')} {gameToDelete?.game || gameToDelete?.name}...
                  </p>
                </div>
              ) : (
                < >
                  <Button
                    variant="outline"
                    onClick={() => setGameToDelete(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={() => handleDeleteGame(gameToDelete)}
                    className="text-secondary hover:text-secondary-foreground"
                  >
                    {gameToDelete?.isCustom ? t('library.removeGame') : t('library.uninstallGame')}
                  </Button>
                </ >
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const AddGameCard = React.forwardRef((props, ref) => {
  const { t } = useLanguage();
  return (
    <Card 
      ref={ref}
      className={cn(
        "group relative overflow-hidden transition-colors",
        "border-2 border-dashed border-muted hover:border-primary cursor-pointer"
      )}
      {...props}
    >
      <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[280px] text-muted-foreground group-hover:text-primary">
        <div className="rounded-full bg-muted p-6 group-hover:bg-primary/10">
          <Plus className="w-8 h-8" />
        </div>
        <h3 className="mt-4 font-semibold text-lg">{t('library.addGame')}</h3>
        <p className="text-sm text-center mt-2">
          {t('library.addGameDescription1')}
        </p>
      </CardContent>
    </Card>
  );
});

AddGameCard.displayName = "AddGameCard";

const InstalledGameCard = ({ 
  game, 
  onPlay, 
  onDelete, 
  onSelect, 
  isSelected, 
  onOpenDirectory, 
  isLaunching,
  isUninstalling,
  favorites,
  onToggleFavorite 
}) => {
  const { t } = useLanguage();
  const [isRunning, setIsRunning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [executableExists, setExecutableExists] = useState(null);
  const isFavorite = favorites.includes(game.game || game.name);

  useEffect(() => {
    const checkExecutable = async () => {
      if (game.executable && !game.isCustom) {  
        try {
          const execPath = `${game.game}/${game.executable}`;
          const exists = await window.electron.ipcRenderer.invoke('check-file-exists', execPath);
          setExecutableExists(exists);
        } catch (error) {
          console.error('Error checking executable:', error);
          setExecutableExists(false);
        }
      }
    };
    
    checkExecutable();
  }, [game.executable, game.isCustom, game.game]);

  // Check game running status periodically
  useEffect(() => {
    let isMounted = true;

    const checkGameStatus = async () => {
      try {
        if (!isMounted) return;
        const running = await window.electron.ipcRenderer.invoke('is-game-running', game.game || game.name);
        if (isMounted) {
          setIsRunning(running);
        }
      } catch (error) {
        console.error('Error checking game status:', error);
      }
    };

    // Initial check
    checkGameStatus();

    // Set up interval for periodic checks
    const interval = setInterval(checkGameStatus, 1000);

    // Cleanup function
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [game]);

  // Load game image
  useEffect(() => {
    let isMounted = true;

    const loadGameImage = async () => {
      try {
        const imageBase64 = await window.electron.ipcRenderer.invoke('get-game-image', game.game || game.name);
        if (imageBase64 && isMounted) {
          setImageData(`data:image/jpeg;base64,${imageBase64}`);
        }
      } catch (error) {
        console.error('Error loading game image:', error);
      }
    };

    loadGameImage();

    return () => {
      isMounted = false;
    };
  }, [game]);

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-1",
        isSelected && "ring-2 ring-primary",
        "cursor-pointer"
      )}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-0">
        <div className="aspect-[4/3] relative">
          <img 
            src={imageData} 
            alt={game.game}
            className="w-full h-full object-cover"
          />
          {isUninstalling && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-full max-w-[200px] space-y-2 px-4">
                <div className="relative overflow-hidden">
                  <Progress value={undefined} />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent" 
                       style={{ 
                         animation: 'shimmer 2s linear infinite',
                         transform: 'translateX(-100%)',
                         maskImage: 'linear-gradient(to right, transparent 20%, black 50%, transparent 80%)',
                         WebkitMaskImage: 'linear-gradient(to right, transparent 20%, black 50%, transparent 80%)'
                       }} 
                  />
                </div>
                <div className="text-center text-sm font-medium text-white">
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="h-4 w-4 animate-spin" />
                    {t('library.uninstalling')}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "flex flex-col justify-end p-4 text-secondary"
          )}>
            <div className="absolute top-4 right-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:text-primary hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(game.game || game.name);
                }}
              >
                <Heart className={cn(
                  "w-6 h-6",
                  isFavorite ? "fill-primary text-primary" : "fill-none text-white"
                )} />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <Button 
                  className="w-full gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isRunning && !isLaunching) {
                      onPlay();
                    }
                  }}
                  disabled={isLaunching || isRunning}
                >
                  {isLaunching ? (
                    < >
                      <Loader className="w-4 h-4 animate-spin" />
                      {t('library.launching')}
                    </ >
                  ) : isRunning ? (
                    < >
                      <StopCircle className="w-4 h-4" />
                      {t('library.running')}
                    </ >
                  ) : (
                    < >
                      <Play className="w-4 h-4" />
                      {t('library.play')}
                    </ >
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">{game.game}</h3>
            {game.online && <Gamepad2 className="w-4 h-4 text-muted-foreground" />}
            {game.dlc && <Gift className="w-4 h-4 text-muted-foreground" />}
            {executableExists === true && <AlertTriangle className="w-4 h-4 text-yellow-500" title={t('library.executableNotFound')} />}
          </div>
          <p className="text-sm text-muted-foreground">{game.version || t('library.noVersion')}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpenDirectory}>
              <FolderOpen className="w-4 h-4 mr-2" />
              {t('library.openGameDirectory')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
              const success = await window.electron.ipcRenderer.invoke('create-game-shortcut', game);
              if (success) {
                toast.success(t('library.shortcutCreated'));
              } else {
                toast.error(t('library.shortcutError'));
              }
            }}>
              <Monitor className="w-4 h-4 mr-2" />
              {t('library.createShortcut')}
            </DropdownMenuItem>
            {!game.isCustom && (
              <DropdownMenuItem onClick={async () => {
                const exePath = await window.electron.ipcRenderer.invoke('open-file-dialog');
                if (exePath) {
                  await window.electron.ipcRenderer.invoke('modify-game-executable', game.game || game.name, exePath);
                }
              }}>
                <Pencil className="w-4 h-4 mr-2" />
                {t('library.changeExecutable')}
              </DropdownMenuItem>
            )}
            {!game.isCustom && game.downloadingData && (
              <DropdownMenuItem onClick={() => window.electron.ipcRenderer.invoke('open-req-path', game.game)}>
                <Shield className="w-4 h-4 mr-2" />
                {t('library.requiredLibraries')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {game.isCustom ? t('library.removeGameFromLibrary') : t('library.uninstallGame')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
};

const AddGameForm = ({ onSuccess }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    executable: '',
    name: '',
    hasVersion: false,
    version: '',
    isOnline: false,
    hasDLC: false
  });
  const [coverSearch, setCoverSearch] = useState({
    query: '',
    isLoading: false,
    results: [],
    selectedCover: null
  });
  
  // Add debounce timer ref
  const searchDebounceRef = useRef(null);
  const minSearchLength = 2;

  const handleCoverSearch = async (query) => {
    // Update query immediately for UI responsiveness
    setCoverSearch(prev => ({ ...prev, query }));
    
    // Clear previous timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // Don't search if query is too short
    if (!query.trim() || query.length < minSearchLength) {
      setCoverSearch(prev => ({ ...prev, results: [], isLoading: false }));
      return;
    }

    // Set up new debounce timer
    searchDebounceRef.current = setTimeout(async () => {
      setCoverSearch(prev => ({ ...prev, isLoading: true }));
      try {
        const results = await gameService.searchGameCovers(query);
        setCoverSearch(prev => ({ 
          ...prev, 
          results: results.slice(0, 9),
          isLoading: false 
        }));
      } catch (error) {
        console.error('Error searching covers:', error);
        setCoverSearch(prev => ({ ...prev, isLoading: false }));
        toast.error(t('library.coverSearchError'));
      }
    }, 300); // 300ms debounce
  };

  const handleChooseExecutable = async () => {
    const file = await window.electron.ipcRenderer.invoke('open-file-dialog');
    if (file) {
      setFormData(prev => ({
        ...prev,
        executable: file,
        name: file.split('\\').pop().replace('.exe', '')
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await window.electron.ipcRenderer.invoke('save-custom-game', 
      formData.name,
      formData.isOnline,
      formData.hasDLC,
      formData.version,
      formData.executable,
      coverSearch.selectedCover?.imgID // Pass the selected cover's imgID
    );
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">{t('library.gameExecutable')}</h4>
          <Button 
            type="button" 
            variant="outline" 
            className="w-full justify-start text-left text-primary font-normal bg-background hover:bg-accent truncate"
            onClick={handleChooseExecutable}
          >
            <FolderOpen className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">
              {formData.executable || t('library.chooseExecutableFile')}
            </span>
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground">{t('library.gameName')}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}

            className="bg-background border-input text-foreground"
          />
        </div>

        <Separator className="bg-border" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="hasVersion" className="flex-1 text-foreground">{t('library.version')}</Label>
            <Switch
              id="hasVersion"
              checked={formData.hasVersion}
              onCheckedChange={(checked) => setFormData(prev => ({ 
                ...prev, 
                hasVersion: checked,
                version: !checked ? '' : prev.version 
              }))}

            />
          </div>

          {formData.hasVersion && (
            <Input
              id="version"
              value={formData.version}
              onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}

              placeholder={t('library.versionPlaceholder')}
              className="bg-background border-input text-foreground"
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="isOnline" className="flex-1 text-foreground">{t('library.hasOnlineFix')}</Label>
          <Switch
            id="isOnline"
            checked={formData.isOnline}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isOnline: checked }))}

          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="hasDLC" className="flex-1 text-foreground">{t('library.includesAllDLCs')}</Label>
          <Switch
            id="hasDLC"
            checked={formData.hasDLC}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, hasDLC: checked }))}

          />
        </div>

        
        {/* Game Cover Search Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="coverSearch"
                value={coverSearch.query}
                onChange={(e) => handleCoverSearch(e.target.value)}
                className="pl-8 bg-background border-input text-foreground"
                placeholder={t('library.searchGameCover')}
                minLength={minSearchLength}
              />
            </div>
          </div>

          {/* Cover Search Results */}
          {coverSearch.query.length < minSearchLength ? (
            <div className="text-center text-sm text-muted-foreground py-2">
              {t('library.enterMoreChars', { count: minSearchLength })}
            </div>
          ) : coverSearch.isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : coverSearch.results.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {coverSearch.results.map((cover, index) => (
                <div 
                  key={index}
                  onClick={() => setCoverSearch(prev => ({ ...prev, selectedCover: cover }))}
                  className={cn(
                    "relative aspect-video cursor-pointer overflow-hidden rounded-lg border-2 transition-all",
                    coverSearch.selectedCover === cover 
                      ? "border-primary shadow-lg" 
                      : "border-transparent hover:border-primary/50"
                  )}
                >
                  <img
                    src={gameService.getImageUrl(cover.imgID)}
                    alt={cover.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-sm text-center px-2">{cover.title}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-2">
              {t('library.noResultsFound')}
            </div>
          )}

          {/* Selected Cover Preview */}
          {coverSearch.selectedCover && (
            <div className="mt-4 flex justify-center">
              <div className="relative aspect-video w-64 rounded-lg overflow-hidden border-2 border-primary">
                <img
                  src={gameService.getImageUrl(coverSearch.selectedCover.imgID)}
                  alt={coverSearch.selectedCover.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>

      </div>

      <AlertDialogFooter className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => onSuccess()}
          className="bg-background text-primary hover:bg-accent"
        >
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!formData.executable || !formData.name}
          className="bg-primary text-secondary hover:bg-primary/90"
        >
          {t('library.addGame')}
        </Button>
      </AlertDialogFooter>
    </div>
  );
};

export default Library; 