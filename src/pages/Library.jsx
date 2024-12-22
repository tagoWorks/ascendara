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
  Shield
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
    try {
      await window.electron.playGame(game.game || game.name, game.isCustom);
      
      // Get and cache the game image before saving to recently played
      const imageBase64 = await window.electron.getGameImage(game.game || game.name);
      if (imageBase64) {
        await imageCacheService.getImage(game.imgID);
      }
      
      // Save to recently played games
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
      setError('Failed to launch game');
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
        <div className="text-foreground">Loading games...</div>
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
            <h1 className="text-3xl font-bold text-primary">Games Library</h1>
            <Separator orientation="vertical" className="h-8" />
            <p className="text-muted-foreground">
              {games.length === 0 
                ? "No games in your library yet"
                : `${games.length} game${games.length === 1 ? '' : 's'} in your library`}
            </p>
          </div>

          <Input
            placeholder="Search games..."
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
                  Add Game
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  Add a custom game to your library. Choose the executable file and configure the game settings.
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
            />
          ))}
        </div>

        <AlertDialog 
          key="delete-game-dialog" 
          open={!!gameToDelete} 
          onOpenChange={(open) => !open && setGameToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-foreground">Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                {gameToDelete?.isCustom 
                  ? `This will remove ${gameToDelete?.game || gameToDelete?.name} from your library. The game files will not be deleted.`
                  : `This will uninstall ${gameToDelete?.game || gameToDelete?.name} from your system. This action cannot be undone.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex justify-end gap-2">
              {isUninstalling ? (
                <div className="w-full">
                  <Progress className="w-full" value={undefined} />
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Uninstalling {gameToDelete?.game || gameToDelete?.name}...
                  </p>
                </div>
              ) : (
                < >
                  <Button
                    variant="outline"
                    onClick={() => setGameToDelete(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteGame(gameToDelete)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {gameToDelete?.isCustom ? 'Remove' : 'Uninstall'}
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
        <h3 className="mt-4 font-semibold text-lg">Add Game</h3>
        <p className="text-sm text-center mt-2">
          Add a custom game to your library
        </p>
      </CardContent>
    </Card>
  );
});

AddGameCard.displayName = "AddGameCard";

const InstalledGameCard = ({ game, onPlay, onDelete, onSelect, isSelected, onOpenDirectory }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [imageData, setImageData] = useState(null);

  // Add image loading effect
  useEffect(() => {
    const loadGameImage = async () => {
      try {
        const imageBase64 = await window.electron.getGameImage(game.game || game.name);
        if (imageBase64) {
          setImageData(`data:image/jpeg;base64,${imageBase64}`);
        }
      } catch (error) {
        console.error('Error loading game image:', error);
      }
    };

    loadGameImage();
  }, [game]);

  useEffect(() => {
    const checkGameStatus = setInterval(async () => {
      const running = await window.electron.isGameRunning(game.game || game.name);
      setIsRunning(running);
    }, 1000);

    return () => clearInterval(checkGameStatus);
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
              <div className="flex gap-2">
                {game.online && (
                  <span className="px-2 py-1 rounded-full bg-primary/20 text-primary text-xs">
                    Online Fix
                  </span>
                )}
                {game.dlc && (
                  <span className="px-2 py-1 rounded-full bg-primary/20 text-primary text-xs">
                    All DLCs
                  </span>
                )}
              </div>
              <Button 
                className="w-full gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay();
                }}
              >
                <Play className="w-4 h-4" />
                {isRunning ? 'Running' : 'Play'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center p-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{game.game}</h3>
          <p className="text-sm text-muted-foreground">{game.version || 'No version'}</p>
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
              Open Directory
            </DropdownMenuItem>
            {!game.isCustom && (
              <DropdownMenuItem onClick={() => window.electron.modifyGameExecutable(game.game, game.executable)}>
                <Pencil className="w-4 h-4 mr-2" />
                Change Executable
              </DropdownMenuItem>
            )}
            {!game.isCustom && game.downloadingData && (
              <DropdownMenuItem onClick={() => window.electron.openReqPath(game.game)}>
                <Shield className="w-4 h-4 mr-2" />
                Required Libraries
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
              {game.isCustom ? 'Remove from Library' : 'Uninstall'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
};

const AddGameForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    executable: '',
    name: '',
    hasVersion: false,
    version: '',
    isOnline: false,
    hasDLC: false
  });

  const handleChooseExecutable = async () => {
    const file = await window.electron.openFileDialog();
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
          <h4 className="text-sm font-medium text-foreground mb-2">Game Executable</h4>
          <Button 
            type="button" 
            variant="outline" 
            className="w-full justify-start text-left text-primary font-normal bg-background hover:bg-accent"
            onClick={handleChooseExecutable}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            {formData.executable || 'Choose executable file'}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-foreground">Game Name</Label>
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
            <Label htmlFor="hasVersion" className="flex-1 text-foreground">Version</Label>
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
              placeholder="e.g. 1.0.0"
              className="bg-background border-input"
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="isOnline" className="flex-1 text-foreground">Has Online Fix</Label>
          <Switch
            id="isOnline"
            checked={formData.isOnline}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isOnline: checked }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="hasDLC" className="flex-1 text-foreground">Includes All DLCs</Label>
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
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!formData.executable || !formData.name}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Add Game
        </Button>
      </AlertDialogFooter>
    </div>
  );
};

export default Library; 