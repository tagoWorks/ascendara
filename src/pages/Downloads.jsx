import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Separator } from "../components/ui/separator";
import { useLanguage } from "../contexts/LanguageContext";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Loader,
  StopCircle,
  FolderOpen,
  MoreVertical,
  RefreshCcw,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Download,
  Clock,
  ExternalLink,
  CircleCheck,
} from "lucide-react";
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

const Downloads = () => {
  const [downloadingGames, setDownloadingGames] = useState([]);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryLink, setRetryLink] = useState("");
  const [selectedGame, setSelectedGame] = useState(null);
  const [totalSpeed, setTotalSpeed] = useState("0.00 MB/s");
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
          return (
            downloadingData &&
            (downloadingData.downloading ||
              downloadingData.extracting ||
              downloadingData.updating ||
              downloadingData.error)
          );
        });

        // Update error details for games with errors
        downloading.forEach(game => {
          if (game.downloadingData?.error) {
            console.log(`Error for game ${game.game}:`, game.downloadingData.message);
          }
        });

        // Check if this is the first download ever
        if (downloading.length > 0 && !localStorage.getItem("hasDownloadedBefore")) {
          setShowFirstTimeAlert(true);
          localStorage.setItem("hasDownloadedBefore", "true");
        }

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
                const [value, unit] = speed.split(" ");
                const num = parseFloat(value);
                if (unit === "KB/s") {
                  totalSpeedNum += num / 1024; // Convert KB/s to MB/s
                } else if (unit === "MB/s") {
                  totalSpeedNum += num;
                }
              }
            }
          });

          setActiveDownloads(activeCount);
          // Format total speed to show KB/s if less than 1 MB/s
          const speedDisplay =
            totalSpeedNum < 1
              ? `${(totalSpeedNum * 1024).toFixed(2)} KB/s`
              : `${totalSpeedNum.toFixed(2)} MB/s`;
          setTotalSpeed(speedDisplay);
        }
      } catch (error) {
        console.error("Error fetching downloading games:", error);
      }
    };

    fetchDownloadingGames();
    // Increase polling interval to reduce frequency of checks
    const intervalId = setInterval(fetchDownloadingGames, 2000);
    return () => clearInterval(intervalId);
  }, [downloadingGames]);

  useEffect(() => {
    if (downloadingGames.length === 0) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [downloadingGames.length]);

  const handleStopDownload = async game => {
    setStoppingDownloads(prev => new Set([...prev, game.game]));
    await window.electron.stopDownload(game);
  };

  const handleRetryDownload = game => {
    setSelectedGame(game);
    setRetryModalOpen(true);
  };

  const handleRetryConfirm = async () => {
    if (selectedGame) {
      await window.electron.retryDownload(retryLink);
      setRetryModalOpen(false);
      setRetryLink("");
      setSelectedGame(null);
    }
  };

  const handleOpenFolder = async game => {
    await window.electron.openGameDirectory(game.game);
  };

  return (
    <div className="container max-w-7xl mx-auto p-4 md:p-8 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-primary">
            {t("downloads.activeDownloads")}
          </h1>
          <Separator orientation="vertical" className="h-8" />
          <p className="text-muted-foreground">
            {activeDownloads > 0
              ? `${activeDownloads} ${t("downloads.activeDownload")}${activeDownloads === 1 ? "" : "s"} • ${totalSpeed}`
              : t("downloads.noDownloads")}
          </p>
        </div>
      </div>

      {showFirstTimeAlert && (
        <AlertDialog open={showFirstTimeAlert} onOpenChange={setShowFirstTimeAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-foreground">
                {t("downloads.firstTimeDownload.title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                {t("downloads.firstTimeDownload.message")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                className="bg-primary text-secondary"
                onClick={() => setShowFirstTimeAlert(false)}
              >
                {t("downloads.firstTimeDownload.understand")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <div className="space-y-4">
        {downloadingGames.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Download className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">{t("downloads.noDownloads")}</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {t("downloads.noDownloadsMessage")}
              </p>
            </CardContent>
          </Card>
        ) : (
          downloadingGames.map(game => (
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
            <AlertDialogTitle className="text-2xl font-bold text-foreground">
              {t("downloads.retryDownload")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("downloads.retryDownloadDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="text-primary"
              onClick={() => setRetryModalOpen(false)}
            >
              {t("common.ok")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const DownloadCard = ({ game, onStop, onRetry, onOpenFolder, isStopping }) => {
  const [isReporting, setIsReporting] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const styleSheet = document.styleSheets[0];
    const keyframes = `
      @keyframes shimmer {
        0% { transform: translateX(-100%) }
        100% { transform: translateX(100%) }
      }
    `;
    styleSheet.insertRule(keyframes, styleSheet.cssRules.length);
  }, []);

  const handleRemoveDownload = async game => {
    await window.electron.deleteGameDirectory(game.game);
  };

  const { downloadingData } = game;
  const isDownloading = downloadingData?.downloading;
  const isExtracting = downloadingData?.extracting;
  const isUpdating = downloadingData?.updating;
  const hasError = downloadingData?.error;

  // Check if this error was already reported
  const [wasReported, setWasReported] = useState(() => {
    try {
      const reportedErrors = JSON.parse(localStorage.getItem("reportedErrors") || "{}");
      const errorKey = `${game.game}-${downloadingData?.message || "unknown"}`;
      return reportedErrors[errorKey] || false;
    } catch (error) {
      console.error("Failed to load reported errors from cache:", error);
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
          Authorization: AUTHORIZATION,
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
          details: `Error Details:
          • Game Name: ${game.game}
          • Game Version: ${game.version || "N/A"}
          • Game Size: ${game.size || "N/A"}
          • Error Message: ${downloadingData.message || "Unknown error"}

          Download State:
          • Progress: ${downloadingData.progressPercent || "0"}%
          • Download Speed: ${downloadingData.progressDownloadSpeeds || "N/A"}
          • Current File: ${downloadingData.progressCurrentFile || "N/A"}
          • Total Files: ${downloadingData.progressTotalFiles || "N/A"}

          System Info:
          • Timestamp: ${new Date().toISOString()}
          • Platform: ${window.electron.platform || "Unknown"}
          • App Version: ${window.electron.version || "Unknown"}

          Technical Details:
          \`\`\`json
          ${JSON.stringify(
            {
              downloadState: downloadingData,
              gameMetadata: {
                id: game.id,
                version: game.version,
                size: game.size,
                downloadUrl: game.downloadUrl,
              },
            },
            null,
            2
          )}
          \`\`\``,
          gameName: game.game,
        }),
      });

      if (!reportResponse.ok) {
        throw new Error("Failed to submit report");
      }

      // Save to cache that this error was reported
      const errorKey = `${game.game}-${downloadingData?.message || "unknown"}`;
      const reportedErrors = JSON.parse(localStorage.getItem("reportedErrors") || "{}");
      reportedErrors[errorKey] = true;
      localStorage.setItem("reportedErrors", JSON.stringify(reportedErrors));
      setWasReported(true);

      toast.success(t("downloads.errorReported"), {
        description: t("downloads.errorReportedDescription"),
      });
    } catch (error) {
      console.error("Failed to report error:", error);
      toast.error(t("downloads.reportFailed"), {
        description: t("downloads.reportFailedDescription"),
      });
    } finally {
      setIsReporting(false);
    }
  };

  useEffect(() => {
    if (
      hasError &&
      !wasReported &&
      downloadingData.message !== "content_type_error" &&
      downloadingData.message !== "no_files_error"
    ) {
      handleReport();
    }
  }, [hasError, wasReported]);

  return (
    <Card className="w-full mb-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <h3 className="font-semibold leading-none">{game.game}</h3>
          <p className="text-sm text-muted-foreground">{game.size}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              {isStopping ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {hasError ? (
              <>
                <DropdownMenuItem onClick={() => onRetry(game)}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  {t("downloads.actions.retryDownload")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleRemoveDownload(game)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("downloads.actions.cancelAndDelete")}
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => onStop(game)}>
                <StopCircle className="mr-2 h-4 w-4" />
                {t("downloads.actions.stopDownload")}
              </DropdownMenuItem>
            )}
            {!isDownloading && (
              <DropdownMenuItem onClick={() => onOpenFolder(game)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                {t("downloads.actions.openFolder")}
              </DropdownMenuItem>
            )}
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
                  {t("downloads.downloadError")}
                </div>
                {(downloadingData.message === "content_type_error" && (
                  <p className="text-sm text-muted-foreground">
                    {t("downloads.contentTypeError")}
                    <br />
                    <a
                      onClick={() =>
                        window.electron.openURL(
                          "https://ascendara.app/docs/troubleshooting/common-issues#download-issues"
                        )
                      }
                      className="text-primary cursor-pointer hover:underline"
                    >
                      {t("common.learnMore")}{" "}
                      <ExternalLink className="inline-block mb-1 h-3 w-3" />
                    </a>
                  </p>
                )) ||
                  (downloadingData.message === "no_files_error" && (
                    <p className="text-sm text-muted-foreground">
                      {t("downloads.noFilesError")}
                      <br />
                      <a
                        onClick={() =>
                          window.electron.openURL(
                            "https://ascendara.app/docs/troubleshooting/common-issues#download-issues"
                          )
                        }
                        className="text-primary cursor-pointer hover:underline"
                      >
                        {t("common.learnMore")}{" "}
                        <ExternalLink className="inline-block mb-1 h-3 w-3" />
                      </a>
                    </p>
                  )) || (
                    <p className="text-sm text-muted-foreground">
                      {downloadingData.message}
                    </p>
                  )}
                <div className="flex items-center space-x-2 pt-1">
                  {downloadingData.message !== "content_type_error" &&
                    downloadingData.message !== "no_files_error" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/30 hover:bg-destructive/10"
                        onClick={handleReport}
                        disabled={isReporting || wasReported}
                      >
                        {isReporting ? (
                          <>
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                            {t("common.reporting")}
                          </>
                        ) : wasReported ? (
                          <>
                            <CircleCheck className="mr-2 h-4 w-4" />
                            {t("downloads.alreadyReported")}
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            {t("common.reportToAscendara")}
                          </>
                        )}
                      </Button>
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="border-destructive/30 hover:bg-destructive/10"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {t("common.retry")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("downloads.errorHelp")}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {isDownloading && (
              <div className="space-y-2 ">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground">
                    {downloadingData.progressCompleted}%
                  </span>
                  <Progress value={parseFloat(downloadingData.progressCompleted)} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Download className="h-3 w-3" />
                    <span>{downloadingData.progressDownloadSpeeds}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-3 w-3" />
                    <span>ETA: {downloadingData.timeUntilComplete}</span>
                  </div>
                </div>
              </div>
            )}
            {(isExtracting || isUpdating) && (
              <div className="space-y-2 mt-2">
                <div className="relative overflow-hidden rounded-full">
                  <Progress value={undefined} className="bg-muted/30" />
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent rounded-full"
                    style={{
                      animation: "shimmer 3s infinite ease-in-out",
                      backgroundSize: "200% 100%",
                      WebkitAnimation: "shimmer 3s infinite ease-in-out",
                      WebkitBackgroundSize: "200% 100%",
                    }}
                  />
                </div>
                <div className="flex flex-col items-center justify-center text-sm text-muted-foreground mt-1">
                  <span className="text-lg font-semibold flex items-center gap-2">
                    <Loader className="h-4 w-4 animate-spin" />
                    {isExtracting ? t("downloads.extracting") : t("downloads.updating")}
                  </span>
                  <span className="text-xs">
                    {isExtracting
                      ? t("downloads.extractingDescription")
                      : t("downloads.updatingDescription")}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default Downloads;
