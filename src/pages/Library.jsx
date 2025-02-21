import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Play,
  Plus,
  FolderOpen,
  ExternalLink,
  Pencil,
  Trash2,
  Search,
  User,
  HardDrive,
  Gamepad2,
  Monitor,
  Gift,
  Search as SearchIcon,
  Loader,
  StopCircle,
  AlertTriangle,
  Heart,
  SquareLibrary,
  Tag,
  PackageOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import recentGamesService from "@/services/recentGamesService";
import GameRate from "@/components/GameRate";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import imageCacheService from "@/services/imageCacheService";
import gameService from "@/services/gameService";
import fs from "fs";
import { toast } from "sonner";
import UserSettingsDialog from "@/components/UserSettingsDialog";

const Library = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddGameOpen, setIsAddGameOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingGame, setRatingGame] = useState(null);
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [showVrWarning, setShowVrWarning] = useState(false);
  const [uninstallingGame, setUninstallingGame] = useState(null);
  const [launchingGame, setLaunchingGame] = useState(null);
  const [lastLaunchedGame, setLastLaunchedGame] = useState(null);
  const lastLaunchedGameRef = useRef(null);
  const [isOnWindows, setIsOnWindows] = useState(true);
  const [coverSearchQuery, setCoverSearchQuery] = useState("");
  const [coverSearchResults, setCoverSearchResults] = useState([]);
  const [isCoverSearchLoading, setIsCoverSearchLoading] = useState(false);
  const [selectedGameImage, setSelectedGameImage] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [username, setUsername] = useState(null);
  const [errorGame, setErrorGame] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    const savedFavorites = localStorage.getItem("game-favorites");
    return savedFavorites ? JSON.parse(savedFavorites) : [];
  });
  const [totalGamesSize, setTotalGamesSize] = useState(0);
  const [isCalculatingSize, setIsCalculatingSize] = useState(false);
  const errorTimeoutRef = useRef(null);
  const { t } = useLanguage();

  useEffect(() => {
    localStorage.setItem("game-favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const checkWindows = async () => {
      const isWindows = await window.electron.isOnWindows();
      setIsOnWindows(isWindows);
    };
    checkWindows();
  }, []);

  useEffect(() => {
    const handleUsernameUpdate = () => {
      fetchUsername();
    };

    window.addEventListener('usernameUpdated', handleUsernameUpdate);
    return () => window.removeEventListener('usernameUpdated', handleUsernameUpdate);
  }, []);

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

  useEffect(() => {
    lastLaunchedGameRef.current = lastLaunchedGame;
  }, [lastLaunchedGame]);

  const toggleFavorite = gameName => {
    setFavorites(prev => {
      const newFavorites = prev.includes(gameName)
        ? prev.filter(name => name !== gameName)
        : [...prev, gameName];
      return newFavorites;
    });
  };

  const fetchUsername = async () => {
    try {
      const username = await window.electron.getLocalCrackUsername();
      console.log("Fetched username: ", username);
      setUsername(username);
      return username;
    } catch (error) {
      console.error("Error fetching username:", error);
      return null;
    }
  };

  const formatBytes = bytes => {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Byte";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  const fetchStorageInfo = async () => {
    try {
      const installPath = await window.electron.getDownloadDirectory();
      if (installPath) {
        // Get cached drive space and directory size
        const [driveSpace, gamesSize] = await Promise.all([
          window.electron.getDriveSpace(installPath),
          window.electron.getInstalledGamesSize()
        ]);

        setStorageInfo(driveSpace);
        
        if (gamesSize.success) {
          if (gamesSize.calculating) {
            setIsCalculatingSize(true);
          } else {
            setTotalGamesSize(gamesSize.totalSize);
            setIsCalculatingSize(false);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching storage info:", error);
    }
  };

  useEffect(() => {
    const fetchStorageInfo = async () => {
      try {
        const installPath = await window.electron.getDownloadDirectory();
        if (installPath) {
          // Get cached drive space and directory size
          const [driveSpace, gamesSize] = await Promise.all([
            window.electron.getDriveSpace(installPath),
            window.electron.getInstalledGamesSize()
          ]);

          setStorageInfo(driveSpace);
          
          if (gamesSize.success) {
            if (gamesSize.calculating) {
              setIsCalculatingSize(true);
            } else {
              setTotalGamesSize(gamesSize.totalSize);
              setIsCalculatingSize(false);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching storage info:", error);
      }
    };

    // Set up directory size status listener
    const cleanup = window.electron.onDirectorySizeStatus((status) => {
      setIsCalculatingSize(status.calculating);
      if (!status.calculating) {
        fetchStorageInfo();
      }
    });

    // Initial fetch
    fetchStorageInfo();

    return cleanup;
  }, []); // Only run once on mount, cleanup on unmount

  useEffect(() => {
    fetchUsername();
  }, []);

  // Keep track of whether we've initialized
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Initialize once on mount
  useEffect(() => {
    const init = async () => {
      await loadGames();
      setIsInitialized(true);
    };
    init();
  }, []); // Empty deps - only run once on mount

  // Set up event listeners
  useEffect(() => {
    if (!isInitialized) return; // Don't set up listeners until initialized

    const handleGameClosed = async () => {
      const lastGame = lastLaunchedGameRef.current;
      console.log("Game closed - last launched game:", lastGame);
      
      if (lastGame) {
        // Get fresh game data
        const freshGames = await window.electron.getGames();
        const gameData = freshGames.find(g => (g.game || g.name) === (lastGame.game || lastGame.name));
        
        if (gameData && gameData.launchCount === 1) {
          setRatingGame(lastGame);
          setShowRateDialog(true);
        }
        setLastLaunchedGame(null);
      }
    };

    window.electron.ipcRenderer.on("game-launch-error", handleGameLaunchError);
    window.electron.ipcRenderer.on("game-launch-success", handleGameLaunchSuccess);
    window.electron.ipcRenderer.on("game-closed", handleGameClosed);

    return () => {
      window.electron.ipcRenderer.removeListener("game-launch-error", handleGameLaunchError);
      window.electron.ipcRenderer.removeListener("game-launch-success", handleGameLaunchSuccess);
      window.electron.ipcRenderer.removeListener("game-closed", handleGameClosed);
    };
  }, [isInitialized, setRatingGame, setShowRateDialog]); // Add required dependencies

  const loadGames = async () => {
    try {
      // Get games from main process
      const installedGames = await window.electron.getGames();
      const customGames = await window.electron.getCustomGames();

      // Filter out games that are currently downloading
      const filteredInstalledGames = installedGames.filter(game => {
        const { downloadingData } = game;
        return (
          !downloadingData ||
          !(
            downloadingData.downloading ||
            downloadingData.extracting ||
            downloadingData.updating ||
            downloadingData.error
          )
        );
      });

      // Combine both types of games
      const allGames = [
        ...(filteredInstalledGames || []).map(game => ({
          ...game,
          isCustom: false,
        })),
        ...(customGames || []).map(game => ({
          name: game.game,
          game: game.game, // Keep original property for compatibility
          version: game.version,
          online: game.online,
          dlc: game.dlc,
          isVr: game.isVr,
          executable: game.executable,
          playTime: game.playTime,
          isCustom: true,
          custom: true,
        })),
      ];

      setGames(allGames);
      setLoading(false);
    } catch (error) {
      console.error("Error loading games:", error);
      setError("Failed to load games");
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
    // Keep lastLaunchedGame set so we can use it when the game closes
  };

  const handlePlayGame = async (game, forcePlay = false) => {
    const gameName = game.game || game.name;

    // Check if window.electron.isDev is true. Cannot run in developer mode
    if (await window.electron.isDev()) {
      toast.error(t("library.cannotRunDev"));
      return;
    }

    try {
      // First check if game is already running
      const isRunning = await window.electron.isGameRunning(gameName);
      if (isRunning) {
        toast.error(t("library.alreadyRunning", { game: gameName }));
        return;
      }

      // Check if game is VR and show warning
      if (game.isVr && !forcePlay) {
        setSelectedGame(game); // Set the selected game before showing warning
        setShowVrWarning(true);
        return;
      }

      // Set launching state here after all checks pass
      setLaunchingGame(gameName);
      setLastLaunchedGame(game);

      console.log("Launching game: ", gameName);
      // Launch the game
      await window.electron.playGame(gameName, game.isCustom);

      // Get and cache the game image before saving to recently played
      const imageBase64 = await window.electron.getGameImage(
        gameName
      );
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
        dlc: game.dlc,
      });
    } catch (error) {
      console.error("Error launching game:", error);
      setLaunchingGame(null);
    }
  };

  const handleDeleteGame = async game => {
    try {
      if (game.isCustom) {
        await window.electron.removeGame(game.game || game.name);
      } else {
        setIsUninstalling(true);
        setUninstallingGame(game.game || game.name);
        await window.electron.deleteGame(game.game || game.name);
      }
      setGames(games.filter(g => (g.game || g.name) !== (game.game || game.name)));
      setGameToDelete(null);
      setIsUninstalling(false);
      setUninstallingGame(null);
    } catch (error) {
      console.error("Error deleting game:", error);
      setError("Failed to delete game");
      setIsUninstalling(false);
      setUninstallingGame(null);
    }
  };

  const handleOpenDirectory = async game => {
    try {
      await window.electron.openGameDirectory(
        game.game || game.name,
        game.isCustom
      );
    } catch (error) {
      console.error("Error opening directory:", error);
      setError("Failed to open game directory");
    }
  };

  const isGameSelected = (game, selectedGame) => {
    if (!selectedGame) return false;
    const gameId = game.game || game.name;
    const selectedId = selectedGame.game || selectedGame.name;
    return gameId === selectedId;
  };

  const searchGameCovers = async query => {
    if (!query.trim()) {
      setCoverSearchResults([]);
      return;
    }

    setIsCoverSearchLoading(true);
    try {
      const results = await gameService.searchGameCovers(query);
      setCoverSearchResults(results);
    } catch (error) {
      console.error("Error searching game covers:", error);
      setCoverSearchResults([]);
    } finally {
      setIsCoverSearchLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchGameCovers(coverSearchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [coverSearchQuery, searchGameCovers]); // Add searchGameCovers dependency

  const handleCloseErrorDialog = () => {
    setShowErrorDialog(false);
    setErrorGame(null);
    setErrorMessage("");
  };

  const ErrorDialog = () => (
    <AlertDialog open={showErrorDialog} onOpenChange={handleCloseErrorDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-bold text-foreground">
            {t("library.launchError")}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-muted-foreground">
            <p>
              {t("library.launchErrorMessage", { game: errorGame })}&nbsp;
              <span
                onClick={() => {
                  window.electron.openURL(
                    "https://ascendara.app/docs/troubleshooting/common-issues#executable-not-found-launch-error"
                  );
                }}
                className="cursor-pointer hover:underline"
              >
                {t("common.learnMore")}{" "}
                <ExternalLink className="mb-1 inline-block h-3 w-3" />
              </span>
            </p>
            <p>{errorMessage}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-2">
          <Button
            variant="outline"
            className="text-primary"
            onClick={handleCloseErrorDialog}
          >
            {t("common.cancel")}
          </Button>
          <Button
            className="bg-primary text-secondary"
            onClick={async () => {
              const exePath =
                await window.electron.ipcRenderer.openFileDialog();
              if (exePath) {
                await window.electron.modifyGameExecutable(
                  errorGame,
                  exePath
                );
              }
              handleCloseErrorDialog();
            }}
          >
            {t("library.changeExecutable")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl p-4 md:p-8">
        {error && (
          <div className="bg-destructive/10 text-destructive mb-4 rounded-lg p-4">
            {error}
          </div>
        )}
        <div className="mb-8 flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-row items-start justify-between">
              {/* Left side: Title and Search */}
              <div className="flex-1">
                <div className="mb-4 flex items-center">
                  <h1 className="text-3xl font-bold tracking-tight text-primary">
                    {t("library.pageTitle")}
                  </h1>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="mb-2 ml-2 flex h-6 w-6 cursor-help items-center justify-center rounded-full bg-muted hover:bg-muted/80">
                          <span className="text-sm font-medium">?</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className="space-y-2 p-4 text-secondary"
                      >
                        <div className="flex items-center gap-2">
                          <Gamepad2 className="h-4 w-4" />{" "}
                          <span>{t("library.iconLegend.onlineFix")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Gift className="h-4 w-4" />{" "}
                          <span>{t("library.iconLegend.allDlcs")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 text-secondary"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M2 10C2 8.89543 2.89543 8 4 8H20C21.1046 8 22 8.89543 22 10V17C22 18.1046 21.1046 19 20 19H16.1324C15.4299 19 14.7788 18.6314 14.4174 18.029L12.8575 15.4292C12.4691 14.7818 11.5309 14.7818 11.1425 15.4292L9.58261 18.029C9.22116 18.6314 8.57014 19 7.86762 19H4C2.89543 19 2 18.1046 2 17V10Z"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M3.81253 6.7812C4.5544 5.6684 5.80332 5 7.14074 5H16.8593C18.1967 5 19.4456 5.6684 20.1875 6.7812L21 8H3L3.81253 6.7812Z"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>{" "}
                          <span>{t("library.iconLegend.vrGame")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <PackageOpen className="h-4 w-4" />{" "}
                          <span>{t("library.iconLegend.size")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />{" "}
                          <span>{t("library.iconLegend.version")}</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="relative w-72">
                  <Input
                    type="text"
                    placeholder={t("library.searchLibrary")}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pr-8"
                  />
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              {/* Right side: Storage Info and Settings */}
              <div className="flex items-start gap-4">
                
                {storageInfo && (
                  <div className="min-w-[250px] rounded-lg bg-secondary/10 p-3">
                    <div className="space-y-3">
                      {/* Username section */}
                      <div className="flex items-center justify-between border-b border-secondary/20 pb-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">
                            {username || "Guest"}
                          </span>
                        </div>
                        {isOnWindows ? (
                          <UserSettingsDialog />
                        ) : (
                          <Button
                            variant="ghost"
                            disabled
                            size="icon"
                            className="h-9 w-9"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <SquareLibrary className="h-4 w-4 text-primary" />
                            <span className="text-sm text-muted-foreground">
                              {t("library.gamesInLibrary")}
                            </span>
                          </div>
                          <span className="text-sm font-medium">{games.length}</span>
                        </div>
                        
                      {/* Storage section */}
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <HardDrive className="h-4 w-4 text-primary" />
                            <span className="text-sm text-muted-foreground">
                              {t("library.availableSpace")}
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {formatBytes(storageInfo.freeSpace)}
                          </span>
                        </div>
                        <div className="relative mb-2">
                          {/* Ascendara Games Space */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div 
                                  className="absolute left-0 top-0 h-2 rounded-l-full bg-primary cursor-help" 
                                  style={{ 
                                    width: `${(totalGamesSize / storageInfo.totalSpace) * 100}%`,
                                    zIndex: 2 
                                  }} 
                                />
                              </TooltipTrigger>
                              <TooltipContent className="text-secondary">
                                {t("library.spaceTooltip.games", { 
                                  size: formatBytes(totalGamesSize) 
                                })}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Other Used Space */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div 
                                  className="absolute left-0 top-0 h-2 rounded-r-full bg-muted cursor-help" 
                                  style={{ 
                                    width: `${((storageInfo.totalSpace - storageInfo.freeSpace) / storageInfo.totalSpace) * 100}%`,
                                    zIndex: 1 
                                  }} 
                                />
                              </TooltipTrigger>
                              <TooltipContent className="text-secondary">
                                {t("library.spaceTooltip.other", { 
                                  size: formatBytes(storageInfo.totalSpace - storageInfo.freeSpace - totalGamesSize) 
                                })}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Background */}
                          <div className="h-2 w-full rounded-full bg-muted/30" />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {t("library.gamesSpace")}: {
                              isCalculatingSize ? 
                              t("library.calculatingSize") : 
                              formatBytes(totalGamesSize)
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AlertDialog
              key="add-game-dialog"
              open={isAddGameOpen}
              onOpenChange={setIsAddGameOpen}
            >
              <AlertDialogTrigger asChild>
                <AddGameCard />
              </AlertDialogTrigger>
              <AlertDialogContent className="border-border bg-background sm:max-w-[425px]">
                <AlertDialogHeader className="space-y-2">
                  <AlertDialogTitle className="text-2xl font-bold text-foreground">
                    {t("library.addGame")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    {t("library.addGameDescription2")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="max-h-[60vh] overflow-y-auto py-4">
                  <AddGameForm
                    onSuccess={() => {
                      setIsAddGameOpen(false);
                      setSelectedGameImage(null);
                      loadGames();
                    }}
                  />
                </div>
              </AlertDialogContent>
            </AlertDialog>

            {filteredGames.map(game => (
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
                  onToggleFavorite={() => toggleFavorite(game.game || game.name)}
                />
              </div>
            ))}
          </div>

          <ErrorDialog />

          {ratingGame && (
            <GameRate
              game={ratingGame}
              isOpen={showRateDialog}
              onClose={() => {
                setShowRateDialog(false);
                setRatingGame(null);
              }}
            />
          )}

          {/* VR Warning Dialog */}
          <AlertDialog
            open={showVrWarning}
            onOpenChange={open => {
              setShowVrWarning(open);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-bold text-foreground">
                  {t("library.vrWarning.title")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  {t("library.vrWarning.description")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button
                  variant="outline"
                  className="text-xs text-primary"
                  onClick={() => {
                    setShowVrWarning(false);
                    window.electron.openURL(
                      "https://ascendara.app/docs/troubleshooting/vr-games"
                    );
                  }}
                >
                  {t("library.vrWarning.learnMore")}
                </Button>
                <Button
                  className="text-secondary"
                  onClick={() => {
                    setShowVrWarning(false);
                    if (selectedGame) {
                      handlePlayGame(selectedGame, true);
                    }
                  }}
                >
                  {t("library.vrWarning.confirm")}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            key="delete-game-dialog"
            open={!!gameToDelete}
            onOpenChange={open => !open && setGameToDelete(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-bold text-foreground">
                  {gameToDelete?.isCustom
                    ? t("library.removeGameFromLibrary")
                    : t("library.uninstallGame")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  {gameToDelete?.isCustom
                    ? t("library.removeGameFromLibraryWarning")
                    : t("library.uninstallGameWarning")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex justify-end gap-2">
                {isUninstalling ? (
                  <div className="w-full">
                    <div className="relative overflow-hidden">
                      <Progress value={undefined} className="bg-muted/30" />
                        <div
                          className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-primary/20 to-transparent"
                          style={{
                            animation: "shimmer 3s infinite ease-in-out",
                            backgroundSize: "200% 100%",
                            WebkitAnimation: "shimmer 3s infinite ease-in-out",
                            WebkitBackgroundSize: "200% 100%",
                          }}
                        />
                    </div>
                    <p className="mt-2 text-center text-sm text-muted-foreground">
                      {t("library.uninstallingGame")}{" "}
                      {gameToDelete?.game || gameToDelete?.name}...
                    </p>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setGameToDelete(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      onClick={() => handleDeleteGame(gameToDelete)}
                      className="hover:text-secondary-foreground text-secondary"
                    >
                      {gameToDelete?.isCustom
                        ? t("library.removeGame")
                        : t("library.uninstallGame")}
                    </Button>
                  </>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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
        "cursor-pointer border-2 border-dashed border-muted hover:border-primary"
      )}
      {...props}
    >
      <CardContent className="flex h-full min-h-[240px] flex-col items-center justify-center p-6 text-muted-foreground group-hover:text-primary">
        <div className="rounded-full bg-muted p-6 group-hover:bg-primary/10">
          <Plus className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">{t("library.addGame")}</h3>
        <p className="mt-2 text-center text-sm">{t("library.addGameDescription1")}</p>
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
  onToggleFavorite,
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
          const exists = await window.electron.checkFileExists(execPath);
          setExecutableExists(exists);
        } catch (error) {
          console.error("Error checking executable:", error);
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
        const running = await window.electron.isGameRunning(
          game.game || game.name
        );
        if (isMounted) {
          setIsRunning(running);
        }
      } catch (error) {
        console.error("Error checking game status:", error);
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
        const imageBase64 = await window.electron.getGameImage(
          game.game || game.name
        );
        if (imageBase64 && isMounted) {
          setImageData(`data:image/jpeg;base64,${imageBase64}`);
        }
      } catch (error) {
        console.error("Error loading game image:", error);
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
        "hover:-translate-y-1 hover:shadow-lg",
        isSelected && "ring-2 ring-primary",
        "cursor-pointer"
      )}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-0">
        <div className="relative aspect-[4/3]">
          <img src={imageData} alt={game.game} className="h-full w-full object-cover" />
          {isUninstalling && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-[200px] space-y-2 px-4">
                <div className="relative overflow-hidden">
                  <Progress value={undefined} className="bg-muted/30" />
                    <div
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-primary/20 to-transparent"
                      style={{
                        animation: "shimmer 3s infinite ease-in-out",
                        backgroundSize: "200% 100%",
                        WebkitAnimation: "shimmer 3s infinite ease-in-out",
                        WebkitBackgroundSize: "200% 100%",
                      }}
                    />
                </div>
                <div className="text-center text-sm font-medium text-white">
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="h-4 w-4 animate-spin" />
                    {t("library.uninstallingGame")}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent",
              "opacity-0 transition-opacity group-hover:opacity-100",
              "flex flex-col justify-end p-4 text-secondary"
            )}
          >
            <div className="absolute right-4 top-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 hover:text-primary"
                onClick={e => {
                  e.stopPropagation();
                  onToggleFavorite(game.game || game.name);
                }}
              >
                <Heart
                  className={cn(
                    "h-6 w-6",
                    isFavorite ? "fill-primary text-primary" : "fill-none text-white"
                  )}
                />
              </Button>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full gap-2"
                  onClick={e => {
                    e.stopPropagation();
                    if (!isRunning && !isLaunching) {
                      onPlay();
                    }
                  }}
                  disabled={isLaunching || isRunning}
                >
                  {isLaunching ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      {t("library.launching")}
                    </>
                  ) : isRunning ? (
                    <>
                      <StopCircle className="h-4 w-4" />
                      {t("library.running")}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      {t("library.play")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-foreground">{game.game}</h3>
            {game.online && <Gamepad2 className="h-4 w-4 text-muted-foreground" />}
            {game.dlc && <Gift className="h-4 w-4 text-muted-foreground" />}
            {game.isVr && (
              <svg
                className="p-0.5 text-foreground"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 10C2 8.89543 2.89543 8 4 8H20C21.1046 8 22 8.89543 22 10V17C22 18.1046 21.1046 19 20 19H16.1324C15.4299 19 14.7788 18.6314 14.4174 18.029L12.8575 15.4292C12.4691 14.7818 11.5309 14.7818 11.1425 15.4292L9.58261 18.029C9.22116 18.6314 8.57014 19 7.86762 19H4C2.89543 19 2 18.1046 2 17V10Z"
                  stroke="currentColor"
                  strokeWidth={1.3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3.81253 6.7812C4.5544 5.6684 5.80332 5 7.14074 5H16.8593C18.1967 5 19.4456 5.6684 20.1875 6.7812L21 8H3L3.81253 6.7812Z"
                  stroke="currentColor"
                  strokeWidth={1.3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {executableExists === true && (
              <AlertTriangle
                className="h-4 w-4 text-yellow-500"
                title={t("library.executableNotFound")}
              />
            )}
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {game.playTime !== undefined ? (
              <span className="font-medium md:text-xs">
                {game.playTime < 60
                  ? t("library.lessThanMinute")
                  : game.playTime < 120
                  ? `1 ${t("library.minute")} ${t("library.ofPlaytime")}`
                  : game.playTime < 3600
                  ? `${Math.floor(game.playTime / 60)} ${t("library.minutes")} ${t("library.ofPlaytime")}`
                  : game.playTime < 7200
                  ? `1 ${t("library.hour")} ${t("library.ofPlaytime")}`
                  : `${Math.floor(game.playTime / 3600)} ${t("library.hours")} ${t("library.ofPlaytime")}`}
              </span>
            ) : (
              <span className="font-medium md:text-xs">{t("library.neverPlayed")}</span>
            )}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={e => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {game.size && (
            <DropdownMenuItem disabled>
              <PackageOpen className="mr-2 h-4 w-4" />
              {game.size}
            </DropdownMenuItem>
            )}
            {game.version && (
              <DropdownMenuItem disabled>
                <Tag className="mr-2 h-4 w-4" />
                {game.version}
              </DropdownMenuItem>
            )}
            {(game.size || game.version) && (
              <Separator className="my-2 bg-muted" />
            )}
            <DropdownMenuItem onClick={onOpenDirectory}>
              <FolderOpen className="mr-2 h-4 w-4" />
              {t("library.openGameDirectory")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const success = await window.electron.createGameShortcut(
                  game
                );
                if (success) {
                  toast.success(t("library.shortcutCreated"));
                } else {
                  toast.error(t("library.shortcutError"));
                }
              }}
            >
              <Monitor className="mr-2 h-4 w-4" />
              {t("library.createShortcut")}
            </DropdownMenuItem>
            {!game.isCustom && (
              <DropdownMenuItem
                onClick={async () => {
                  const exePath =
                    await window.electron.openFileDialog();
                  if (exePath) {
                    await window.electron.modifyGameExecutable(
                      game.game || game.name,
                      exePath
                    );
                  }
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t("library.changeExecutable")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={e => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {game.isCustom
                ? t("library.removeGameFromLibrary")
                : t("library.uninstallGame")}
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
    executable: "",
    name: "",
    hasVersion: false,
    version: "",
    isOnline: false,
    hasDLC: false,
  });
  const [coverSearch, setCoverSearch] = useState({
    query: "",
    isLoading: false,
    results: [],
    selectedCover: null,
  });

  // Add debounce timer ref
  const searchDebounceRef = useRef(null);
  const minSearchLength = 2;

  const handleCoverSearch = async query => {
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
          isLoading: false,
        }));
      } catch (error) {
        console.error("Error searching covers:", error);
        setCoverSearch(prev => ({ ...prev, isLoading: false }));
        toast.error(t("library.coverSearchError"));
      }
    }, 300); // 300ms debounce
  };

  const handleChooseExecutable = async () => {
    const file = await window.electron.openFileDialog();
    if (file) {
      setFormData(prev => ({
        ...prev,
        executable: file,
        name: file.split("\\").pop().replace(".exe", ""),
      }));
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    await window.electron.saveCustomGame(
      formData.name,
      formData.isOnline,
      formData.hasDLC,
      formData.version,
      formData.executable,
      coverSearch.selectedCover?.imgID
    );
    onSuccess();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">
            {t("library.gameExecutable")}
          </h4>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start truncate bg-background text-left font-normal text-primary hover:bg-accent"
            onClick={handleChooseExecutable}
          >
            <FolderOpen className="mr-2 h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {formData.executable || t("library.chooseExecutableFile")}
            </span>
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground">
            {t("library.gameName")}
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="border-input bg-background text-foreground"
          />
        </div>

        <Separator className="bg-border" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="hasVersion" className="flex-1 text-foreground">
              {t("library.version")}
            </Label>
            <Switch
              id="hasVersion"
              checked={formData.hasVersion}
              onCheckedChange={checked =>
                setFormData(prev => ({
                  ...prev,
                  hasVersion: checked,
                  version: !checked ? "" : prev.version,
                }))
              }
            />
          </div>

          {formData.hasVersion && (
            <Input
              id="version"
              value={formData.version}
              onChange={e => setFormData(prev => ({ ...prev, version: e.target.value }))}
              placeholder={t("library.versionPlaceholder")}
              className="border-input bg-background text-foreground"
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="isOnline" className="flex-1 text-foreground">
            {t("library.hasOnlineFix")}
          </Label>
          <Switch
            id="isOnline"
            checked={formData.isOnline}
            onCheckedChange={checked =>
              setFormData(prev => ({ ...prev, isOnline: checked }))
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="hasDLC" className="flex-1 text-foreground">
            {t("library.includesAllDLCs")}
          </Label>
          <Switch
            id="hasDLC"
            checked={formData.hasDLC}
            onCheckedChange={checked =>
              setFormData(prev => ({ ...prev, hasDLC: checked }))
            }
          />
        </div>

        {/* Game Cover Search Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                id="coverSearch"
                value={coverSearch.query}
                onChange={e => handleCoverSearch(e.target.value)}
                className="border-input bg-background pl-8 text-foreground"
                placeholder={t("library.searchGameCover")}
                minLength={minSearchLength}
              />
            </div>
          </div>

          {/* Cover Search Results */}
          {coverSearch.query.length < minSearchLength ? (
            <div className="py-2 text-center text-sm text-muted-foreground">
              {t("library.enterMoreChars", { count: minSearchLength })}
            </div>
          ) : coverSearch.isLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
          ) : coverSearch.results.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {coverSearch.results.map((cover, index) => (
                <div
                  key={index}
                  onClick={() =>
                    setCoverSearch(prev => ({ ...prev, selectedCover: cover }))
                  }
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
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity hover:opacity-100">
                    <p className="px-2 text-center text-sm text-white">{cover.title}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-2 text-center text-sm text-muted-foreground">
              {t("library.noResultsFound")}
            </div>
          )}

          {/* Selected Cover Preview */}
          {coverSearch.selectedCover && (
            <div className="mt-4 flex justify-center">
              <div className="relative aspect-video w-64 overflow-hidden rounded-lg border-2 border-primary">
                <img
                  src={gameService.getImageUrl(coverSearch.selectedCover.imgID)}
                  alt={coverSearch.selectedCover.title}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertDialogFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onSuccess()} className="text-primary">
          {t("common.cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!formData.executable || !formData.name}
          className="bg-primary text-secondary"
        >
          {t("library.addGame")}
        </Button>
      </AlertDialogFooter>
    </div>
  );
};

export default Library;
