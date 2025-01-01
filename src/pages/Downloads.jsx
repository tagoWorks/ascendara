import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
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
  HardDrive,
  CheckCircle2
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
import { analytics } from '../services/analyticsService';
import ReportIssue from '../components/ReportIssue';

const Downloads = () => {
  const [downloadingGames, setDownloadingGames] = useState([]);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryLink, setRetryLink] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [totalSpeed, setTotalSpeed] = useState('0.00 MB/s');
  const [activeDownloads, setActiveDownloads] = useState(0);
  const [stoppingDownloads, setStoppingDownloads] = useState(new Set());
  const [showFirstTimeAlert, setShowFirstTimeAlert] = useState(false);
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
        downloading.forEach(game => {
          if (game.downloadingData?.error) {
            // The error message is now directly in downloadingData.message
            console.log(`Error for game ${game.game}:`, game.downloadingData.message);
          }
        });

        // Only update state if there are actual changes
        if (JSON.stringify(downloading) !== JSON.stringify(downloadingGames)) {
          setDownloadingGames(downloading);

          // Calculate total speed and active downloads
          let totalSpeedNum = 0;
          let activeCount = 0;

          downloading.forEach(game => {
            if (game.downloadingData?.downloading) {
              activeCount++;
              const speed = game.downloadingData.progressDownloadSpeeds;
              if (speed) {
                const [value, unit] = speed.split(' ');
                const num = parseFloat(value);
                if (unit === 'KB/s') {
                  totalSpeedNum += (num / 1024); // Convert KB/s to MB/s
                } else if (unit === 'MB/s') {
                  totalSpeedNum += num;
                }
              }
            }
          });

          setActiveDownloads(activeCount);
          // Format total speed to show KB/s if less than 1 MB/s
          const speedDisplay = totalSpeedNum < 1 
            ? `${(totalSpeedNum * 1024).toFixed(2)} KB/s`
            : `${totalSpeedNum.toFixed(2)} MB/s`;
          setTotalSpeed(speedDisplay);
        }
      } catch (error) {
        console.error('Error fetching downloading games:', error);
      }
    };

    fetchDownloadingGames();
    // Increase polling interval to reduce frequency of checks
    const intervalId = setInterval(fetchDownloadingGames, 2000);
    return () => clearInterval(intervalId);
  }, [downloadingGames]); // Add downloadingGames as dependency to properly track changes

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
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-primary">{t('downloads.activeDownloads')}</h1>
          <Separator orientation="vertical" className="h-8" />
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
  const [isReporting, setIsReporting] = useState(false);
  const { t } = useLanguage();
  
  const { downloadingData } = game;
  const isDownloading = downloadingData?.downloading;
  const isExtracting = downloadingData?.extracting;
  const isUpdating = downloadingData?.updating;
  const hasError = downloadingData?.error;

  // Check if this error was already reported
  const [wasReported, setWasReported] = useState(() => {
    try {
      const reportedErrors = JSON.parse(localStorage.getItem('reportedErrors') || '{}');
      const errorKey = `${game.game}-${downloadingData?.message || 'unknown'}`;
      return reportedErrors[errorKey] || false;
    } catch (error) {
      console.error('Failed to load reported errors from cache:', error);
      return false;
    }
  });

  const handleReport = async () => {
    if (wasReported) return;
    
    setIsReporting(true);
    try {
      // Get auth token
      const AUTHORIZATION = await window.electron.getAPIKey();
      const response = await fetch("https://api.ascendara.app/auth/token", {
        headers: {
          Authorization: `Bearer ${AUTHORIZATION}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to obtain token");
      }

      const { token } = await response.json();

      // Send the report
      const reportResponse = await fetch("https://api.ascendara.app/app/report/feature", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reportType: "GameDownload",
          reason: `Download Error: ${game.game}`,
          details: `Game: ${game.game}
          Version: ${game.version}
          Size: ${game.size}
          Error: ${downloadingData.message}
          Download Data: ${JSON.stringify(downloadingData, null, 2)}`,
        }),
      });

      if (!reportResponse.ok) {
        throw new Error("Failed to submit report");
      }

      // Save to cache that this error was reported
      const errorKey = `${game.game}-${downloadingData?.message || 'unknown'}`;
      const reportedErrors = JSON.parse(localStorage.getItem('reportedErrors') || '{}');
      reportedErrors[errorKey] = true;
      localStorage.setItem('reportedErrors', JSON.stringify(reportedErrors));
      setWasReported(true);
      
      toast.success(t('downloads.errorReported'), {
        description: t('downloads.errorReportedDescription'),
      });
    } catch (error) {
      console.error('Failed to report error:', error);
      toast.error(t('downloads.reportFailed'), {
        description: t('downloads.reportFailedDescription'),
      });
    } finally {
      setIsReporting(false);
    }
  };

  useEffect(() => {
    if (hasError && !wasReported) {
      handleReport();
    }
  }, [hasError, wasReported]);

  return (
    <Card className="w-full mb-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <h3 className="font-semibold leading-none">{game.game}</h3>
          <p className="text-sm text-muted-foreground">
            {game.size}
          </p>
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
              < >
                <DropdownMenuItem onClick={() => onRetry(game)}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Retry Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStop(game)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Cancel & Delete
                </DropdownMenuItem>
              </ >
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
          <div className="space-y-4 p-4 bg-destructive/5 rounded-lg border border-destructive/20">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <div className="font-medium text-destructive">
                  {t('downloads.downloadError')}
                </div>
                <p className="text-sm text-muted-foreground">
                  {downloadingData.message || t('downloads.genericError')}
                </p>
                <div className="flex items-center space-x-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 hover:bg-destructive/10"
                    onClick={handleReport}
                    disabled={isReporting || wasReported}
                  >
                    {isReporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('common.reporting')}
                      </>
                    ) : wasReported ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {t('downloads.alreadyReported')}
                      </>
                    ) : (
                      <>
                        <AlertCircle className="mr-2 h-4 w-4" />
                        {t('common.reportToAscendara')}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="border-destructive/30 hover:bg-destructive/10"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {t('common.retry')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('downloads.errorHelp')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          < >
            {isDownloading && (
              <div className="space-y-2">
                <Progress value={parseFloat(downloadingData.progressCompleted)} />
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
                    <span>{downloadingData.progressCompleted}% of {game.size}</span>
                  </div>
                </div>
              </div>
            )}
            {(isExtracting || isUpdating) && (
              <div className="space-y-2 mt-2">
                <div className="relative overflow-hidden">
                  <Progress value={undefined} />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent" 
                       style={{ 
                         animation: 'shimmer 2s infinite',
                         maskImage: 'linear-gradient(to right, transparent, black, transparent)',
                         WebkitMaskImage: 'linear-gradient(to right, transparent, black, transparent)'
                       }} 
                  />
                </div>
                <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground mt-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isExtracting ? t('downloads.extracting') : t('downloads.updating')}</span>
                </div>
              </div>
            )}
          </ >
        )}
      </CardContent>

    </Card>
  );
};

export default Downloads;