import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { useLanguage } from '../contexts/LanguageContext';
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
  const [errorDetails, setErrorDetails] = useState({}); // Add state for error details
  const { t } = useLanguage();

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

        // Update error details for games with errors
        const newErrorDetails = {};
        downloading.forEach(game => {
          if (game.downloadingData?.error) {
            newErrorDetails[game.name] = {
              message: game.downloadingData.errorMessage || 'Unknown error occurred',
              code: game.downloadingData.errorCode || 'UNKNOWN',
              timestamp: game.downloadingData.errorTimestamp || new Date().toISOString()
            };
          }
        });
        setErrorDetails(newErrorDetails);

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

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-8 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t('downloads.activeDownloads')}</h1>
          <p className="text-muted-foreground">
            {activeDownloads > 0
              ? `${activeDownloads} ${t('downloads.activeDownload')}${activeDownloads === 1 ? '' : 's'} • ${totalSpeed}`
              : t('downloads.noDownloads')}
          </p>
        </div>
      </div>

      {showFirstTimeAlert && (
        <Card className="mb-8 bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <div className="space-y-2">
                <h3 className="font-medium">{t('downloads.firstTimeDownload.title')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('downloads.firstTimeDownload.message')}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFirstTimeAlert(false)}
                >
                  {t('downloads.firstTimeDownload.understand')}

                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {downloadingGames.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Download className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">{t('downloads.noDownloads')}</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {t('downloads.noDownloadsMessage')}
              </p>
            </CardContent>
          </Card>
        ) : (
          downloadingGames.map((game) => (
            <DownloadCard
              key={game.game}
              game={game}
              onStop={() => handleStopDownload(game)}
              onRetry={() => handleRetryDownload(game)}
              onOpenFolder={() => handleOpenFolder(game)}
              isStopping={stoppingDownloads.has(game.game)}
            />
          ))
        )}
      </div>

      <AlertDialog open={retryModalOpen} onOpenChange={setRetryModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('downloads.retryDownload')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('downloads.retryDownloadDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Input
              value={retryLink}
              onChange={(e) => setRetryLink(e.target.value)}
              placeholder={t('downloads.enterDownloadLink')}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetryConfirm}>
              {t('common.retry')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const DownloadCard = ({ game, onStop, onRetry, onOpenFolder, isStopping }) => {
  const { downloadingData } = game;
  const isDownloading = downloadingData?.downloading;
  const isExtracting = downloadingData?.extracting;
  const isUpdating = downloadingData?.updating;
  const hasError = downloadingData?.error;
  const errorInfo = errorDetails[game.name];

  return (
    <Card className="w-full mb-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-semibold">{game.name}</h4>
          {isDownloading && <Badge variant="outline" className="bg-blue-500/10">Downloading</Badge>}
          {isExtracting && <Badge variant="outline" className="bg-yellow-500/10">Extracting</Badge>}
          {isUpdating && <Badge variant="outline" className="bg-green-500/10">Updating</Badge>}
          {hasError && <Badge variant="destructive">Error</Badge>}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              {isStopping ? 
                <Loader2 className="h-4 w-4 animate-spin" /> :
                <MoreVertical className="h-4 w-4" />
              }
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hasError ? (
              <>
                <DropdownMenuItem onClick={() => onRetry(game)}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Retry Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStop(game)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Cancel & Delete
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => onStop(game)}>
                <StopCircle className="mr-2 h-4 w-4" />
                Stop Download
              </DropdownMenuItem>
            )}
            {!isDownloading && <DropdownMenuItem onClick={() => onOpenFolder(game)}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Open Folder
            </DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        {hasError ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {errorInfo?.message || 'An error occurred during download'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {errorInfo?.code && (
                <div className="flex items-center space-x-2">
                  <span>Error Code:</span>
                  <code>{errorInfo.code}</code>
                </div>
              )}
              {errorInfo?.timestamp && (
                <div className="flex items-center space-x-2">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(errorInfo.timestamp).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {isDownloading && (
              <div className="space-y-2">
                <Progress value={downloadingData.progressCompleted} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Download className="h-3 w-3" />
                    <span>{downloadingData.progressDownloadSpeeds}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-3 w-3" />
                    <span>ETA: {downloadingData.timeUntilComplete}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <HardDrive className="h-3 w-3" />
                    <span>{downloadingData.progressCompleted}%</span>
                  </div>
                </div>
              </div>
            )}
            {(isExtracting || isUpdating) && (
              <Progress value={undefined} className="mt-2" />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default Downloads;