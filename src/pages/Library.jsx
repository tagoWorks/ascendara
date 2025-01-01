import React, { useState, useEffect } from 'react';
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
  Gift
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

const Library = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddGameOpen, setIsAddGameOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [launchingGame, setLaunchingGame] = useState(null);
  const { t } = useLanguage();

  const loadGames = async () => {
    try {
      // Get games from main process
      const installedGames = await window.electron.getGames();
      const customGames = await window.electron.getCustomGames();

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
          isCustom: true
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

  // Load games on component mount
  useEffect(() => {
    loadGames();
  }, []);

  // Filter games based on search query
  const filteredGames = games.filter(game => {
    const searchTerm = searchQuery.toLowerCase();
    const gameName = (game.game || game.name || '').toLowerCase();
    return gameName.includes(searchTerm);
  });

  const handlePlayGame = async (game) => {
    const gameName = game.game || game.name;
    setLaunchingGame(gameName);
    
    try {
      // First check if game is already running
      const isRunning = await window.electron.isGameRunning(gameName);
      if (isRunning) {
        return; // Game is already running, no need to launch
      }

      // Launch the game
      await window.electron.playGame(gameName, game.isCustom);
      
      // Wait a second and check if the game process started
      await new Promise(resolve => setTimeout(resolve, 1000));
      const launchSuccessful = await window.electron.isGameRunning(gameName);
      
      if (!launchSuccessful) {
        throw new Error('Game failed to launch');
      }
      
      // Get and cache the game image before saving to recently played
      const imageBase64 = await window.electron.getGameImage(gameName);
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
      setSelectedGame({
        ...game,
        showErrorDialog: true,
        errorMessage: t('library.launchErrorMessage', { game: gameName })
      });
    } finally {
      setLaunchingGame(null);
    }
  };

  const handleDeleteGame = async (game) => {
    try {
      if (game.isCustom) {
        await window.electron.removeCustomGame(game.game || game.name);
      } else {
        setIsUninstalling(true);
        await window.electron.deleteGame(game.game || game.name);
      }
      setGames(games.filter(g => (g.game || g.name) !== (game.game || game.name)));
      setGameToDelete(null);
      setIsUninstalling(false);
    } catch (error) {
      console.error('Error deleting game:', error);
      setError('Failed to delete game');
      setIsUninstalling(false);
    }
  };

  const handleOpenDirectory = async (game) => {
    try {
      await window.electron.openGameDirectory(game.game || game.name, game.isCustom);
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
                  {t('library.addGameDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AddGameForm onSuccess={() => {
                setIsAddGameOpen(false);
                loadGames();
              }} />
            </AlertDialogContent>
          </AlertDialog>

          {filteredGames.map((game) => (
            <InstalledGameCard 
              key={game.game || game.name}
              game={game}
              onPlay={() => handlePlayGame(game)}
              onDelete={() => setGameToDelete(game)}
              onSelect={() => setSelectedGame(game)}
              isSelected={isGameSelected(game, selectedGame)}
              onOpenDirectory={() => handleOpenDirectory(game)}
              isLaunching={launchingGame === (game.game || game.name)}
            />
          ))}
        </div>

        {selectedGame?.showErrorDialog && (
          <AlertDialog open={true}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-bold text-foreground">{t('library.launchError')}</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  {selectedGame.errorMessage}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const result = await window.electron.showOpenDialog({
                        title: t('library.selectExecutable'),
                        filters: [{ name: t('library.executableFiles'), extensions: ['exe'] }],
                        properties: ['openFile']
                      });
                      
                      if (result?.filePaths?.[0]) {
                        await window.electron.updateGameExecutable(selectedGame.game || selectedGame.name, result.filePaths[0]);
                        setSelectedGame(null);
                        handlePlayGame(selectedGame);
                      }
                    } catch (err) {
                      console.error('Error updating executable:', err);
                    }
                  }}
                >
                  {t('library.chooseExecutable')}
                </Button>
                <Button variant="default" onClick={() => setSelectedGame(null)}>
                  {t('common.ok')}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <AlertDialog 
          key="delete-game-dialog" 
          open={!!gameToDelete} 
          onOpenChange={(open) => !open && setGameToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-foreground">{t('library.uninstallGame')}</AlertDialogTitle>
              <AlertDialogDescription>
                {gameToDelete?.isCustom 
                  ? t('library.removeGameFromLibrary')
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
                    variant="destructive"
                    onClick={() => handleDeleteGame(gameToDelete)}
                    className="text-muted-foreground hover:text-foreground"
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
          {t('library.addGameDescription')}
        </p>
      </CardContent>
    </Card>
  );
});

AddGameCard.displayName = "AddGameCard";

const InstalledGameCard = ({ game, onPlay, onDelete, onSelect, isSelected, onOpenDirectory, isLaunching }) => {
  const { t } = useLanguage();
  const [isRunning, setIsRunning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [imageData, setImageData] = useState(null);

  // Check game running status periodically
  useEffect(() => {
    let isMounted = true;

    const checkGameStatus = async () => {
      try {
        if (!isMounted) return;
        const running = await window.electron.isGameRunning(game.game || game.name);
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
        const imageBase64 = await window.electron.getGameImage(game.game || game.name);
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
            src={imageData || '/game-placeholder.png'} 
            alt={game.game || game.name}
            className="w-full h-full object-cover"
          />
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "flex flex-col justify-end p-4 text-secondary"
          )}>
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
                      <Progress className="w-4 h-4" value={undefined} />
                      {t('library.launching')}
                    </ >
                  ) : isRunning ? (
                    < >
                      <Play className="w-4 h-4" />
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
            {!game.isCustom && (
              <DropdownMenuItem onClick={async () => {
                const exePath = await window.electron.invoke('open-file-dialog');
                if (exePath) {
                  await window.electron.modifyGameExecutable(game.game || game.name, exePath);
                }
              }}>
                <Pencil className="w-4 h-4 mr-2" />
                {t('library.changeExecutable')}
              </DropdownMenuItem>
            )}
            {!game.isCustom && game.downloadingData && (
              <DropdownMenuItem onClick={() => window.electron.openReqPath(game.game)}>
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

  const handleChooseExecutable = async () => {
    const file = await window.electron.invoke('open-file-dialog');
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
    await window.electron.addGame(
      formData.name,
      formData.isOnline,
      formData.hasDLC,
      formData.version,
      formData.executable
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
            className="w-full justify-start text-left text-primary font-normal bg-background hover:bg-accent"
            onClick={handleChooseExecutable}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            {formData.executable || t('library.chooseExecutableFile')}

          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground">{t('library.gameName')}</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}

            className="bg-background border-input"
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
              className="bg-background border-input"
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
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {t('library.addGame')}
        </Button>
      </AlertDialogFooter>
    </div>
  );
};

export default Library; 