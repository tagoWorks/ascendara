import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Loader2,
  StopCircle,
  FolderOpen,
  MoreVertical,
  RefreshCcw,
  Trash2,
  AlertCircle,
  Download,
  Clock,
  HardDrive
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Input } from "../components/ui/input";

const Downloads = () => {
  const [downloadingGames, setDownloadingGames] = useState([]);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryLink, setRetryLink] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [totalSpeed, setTotalSpeed] = useState('0.00 MB/s');
  const [activeDownloads, setActiveDownloads] = useState(0);
  const [stoppingDownloads, setStoppingDownloads] = useState(new Set());
  const [showFirstTimeAlert, setShowFirstTimeAlert] = useState(false);

  useEffect(() => {
    const fetchDownloadingGames = async () => {
      try {
        const games = await window.electron.getGames();
        const downloading = games.filter(game => {
          const { downloadingData } = game;
          return downloadingData && (
            downloadingData.downloading ||
            downloadingData.extracting ||
            downloadingData.updating ||
            downloadingData.error
          );
        });
        
        // Show first-time alert if this is the first download
        if (downloading.length === 1 && !localStorage.getItem('hasShownFirstDownloadAlert')) {
          setShowFirstTimeAlert(true);
          localStorage.setItem('hasShownFirstDownloadAlert', 'true');
        }
        
        setDownloadingGames(downloading);
        
        // Calculate total speed and active downloads
        let totalSpeedNum = 0;
        let activeCount = 0;
        
        downloading.forEach(game => {
          if (game.downloadingData?.downloading) {
            activeCount++;
            const speed = game.downloadingData.progressDownloadSpeeds;
            if (speed) {
              const num = parseFloat(speed.split(' ')[0]);
              totalSpeedNum += num;
            }
          }
        });
        
        setActiveDownloads(activeCount);
        setTotalSpeed(`${totalSpeedNum.toFixed(2)} MB/s`);
        
      } catch (error) {
        console.error('Error fetching downloading games:', error);
      }
    };

    fetchDownloadingGames();
    const intervalId = setInterval(fetchDownloadingGames, 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (downloadingGames.length === 0) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [downloadingGames.length]);

  const handleStopDownload = async (game) => {
    setStoppingDownloads(prev => new Set([...prev, game.game]));
    await window.electron.killDownload(game.game);
  };

  const handleRetryDownload = (game) => {
    setSelectedGame(game);
    setRetryModalOpen(true);
  };

  const handleRetryConfirm = async () => {
    if (selectedGame) {
      await window.electron.retryDownload(retryLink);
      setRetryModalOpen(false);
      setRetryLink('');
      setSelectedGame(null);
    }
  };

  const handleOpenFolder = async (game) => {
    await window.electron.openGameDirectory(game.game);
  };

  if (downloadingGames.length === 0) {
    return (
      <div className="h-[calc(100vh-65px)] bg-background overflow-hidden">
        <div className="container max-w-7xl mx-auto p-4 md:p-8 h-full flex flex-col overflow-hidden">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-primary">Downloads</h1>
            <Separator orientation="vertical" className="h-8" />
            <p className="text-muted-foreground">Manage your game downloads</p>
          </div>
          
          <div className="flex-1 flex items-center justify-center select-none">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Download className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">No Active Downloads</h3>
              <p className="text-muted-foreground">
                Your downloads will appear here when you start downloading games
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-65px)] bg-background overflow-hidden">
      <div className="container max-w-7xl mx-auto p-4 md:p-8 h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-primary">Downloads</h1>
          <Separator orientation="vertical" className="h-8" />
          <p className="text-muted-foreground">Manage your game downloads</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Download className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Downloads</p>
                  <p className="text-2xl font-bold">{activeDownloads}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <HardDrive className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Speed</p>
                  <p className="text-2xl font-bold">{totalSpeed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Downloads</p>
                  <p className="text-2xl font-bold">{downloadingGames.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-4">
            {downloadingGames.map((game) => (
              <DownloadCard
                key={game.game}
                game={game}
                onStop={handleStopDownload}
                onRetry={handleRetryDownload}
                onOpenFolder={handleOpenFolder}
                isStopping={stoppingDownloads.has(game.game)}
              />
            ))}
          </div>
        </div>

        <AlertDialog open={retryModalOpen} onOpenChange={setRetryModalOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retry Download</AlertDialogTitle>
              <AlertDialogDescription>
                Enter the new download link to retry downloading {selectedGame?.game}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Input
                value={retryLink}
                onChange={(e) => setRetryLink(e.target.value)}
                placeholder="Enter download link..."
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRetryModalOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleRetryConfirm}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showFirstTimeAlert} onOpenChange={setShowFirstTimeAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-primary">Download Started</AlertDialogTitle>
              <AlertDialogDescription>
                You can safely close Ascendara - in the background the download will continue and will automatically be added to your library when complete.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Got it!</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

const DownloadCard = ({ game, onStop, onRetry, onOpenFolder, isStopping }) => {
  const { downloadingData } = game;
  const isDownloading = downloadingData?.downloading;
  const isExtracting = downloadingData?.extracting;
  const isUpdating = downloadingData?.updating;
  const hasError = downloadingData?.error;

  if (isStopping) {
    return (
      <div className="flex items-center space-x-2 bg-orange-500/10 p-3 rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
        <span className="text-orange-500 font-medium">Stopping download...</span>
      </div>
    );
  }

  return (
    <Card className="w-full transition-all duration-200 hover:shadow-lg hover:border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <h4 className="text-lg font-semibold leading-none">{game.game}</h4>
          <p className="text-sm text-muted-foreground">Version {game.version}</p>
        </div>
        <div className="flex items-center space-x-2">
          {game.online && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
              Online
            </Badge>
          )}
          {game.dlc && (
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
              DLC
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpenFolder(game)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Open Folder
              </DropdownMenuItem>
              {hasError ? (
                <><DropdownMenuItem onClick={() => onRetry(game)}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Retry Download
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onStop(game)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </> ) : (
                <DropdownMenuItem 
                  onClick={() => onStop(game)}
                  className="text-destructive focus:text-destructive"
                >
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop Download
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        {hasError ? (
          <div className="flex items-center space-x-2 text-destructive bg-destructive/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span>Download failed. Please try again.</span>
          </div>
        ) : (
          <><div className="space-y-4">
            {isDownloading && (
              <div className="flex justify-between text-sm">
                <span className="text-primary font-medium">{downloadingData.progressDownloadSpeeds}</span>
                <span className="text-muted-foreground">ETA: {downloadingData.timeUntilComplete}</span>
              </div>
            )}
            <Progress 
              value={parseFloat(downloadingData.progressCompleted)} 
              className="h-2 bg-primary/10"
            />
            <div className="text-right text-sm font-medium text-primary">
              {downloadingData.progressCompleted}%</div>
          </div>
          {isExtracting && (
            <div className="flex items-center space-x-2 bg-primary/5 p-3 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-primary font-medium">Extracting files...</span>
            </div>
          )}
          {isUpdating && (
            <div className="flex items-center space-x-2 bg-primary/5 p-3 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-primary font-medium">Updating game...</span>
            </div>
          )}
        </> )}
      </CardContent>
    </Card>
  );
};

export default Downloads;