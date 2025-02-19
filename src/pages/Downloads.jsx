import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Coffee,
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
} from "@/components/ui/alert-dialog";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const Downloads = () => {
  const [downloadingGames, setDownloadingGames] = useState([]);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryLink, setRetryLink] = useState("");
  const [selectedGame, setSelectedGame] = useState(null);
  const [totalSpeed, setTotalSpeed] = useState("0.00 MB/s");
  const [activeDownloads, setActiveDownloads] = useState(0);
  const [stoppingDownloads, setStoppingDownloads] = useState(new Set());
  const [showFirstTimeAlert, setShowFirstTimeAlert] = useState(false);
  const MAX_HISTORY_POINTS = 20;
  const [speedHistory, setSpeedHistory] = useState(() => {
    const savedHistory = localStorage.getItem('speedHistory');
    return savedHistory ? JSON.parse(savedHistory) : Array(MAX_HISTORY_POINTS).fill({ index: 0, speed: 0 }).map((_, i) => ({ 
      index: i, 
      speed: 0 
    }));
  });
  const { t } = useLanguage();

  const normalizeSpeed = (speed) => {
    const [value, unit] = speed.split(" ");
    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    
    // Convert everything to MB/s
    switch (unit) {
      case "KB/s":
        return num / 1024;
      case "MB/s":
        return num;
      case "GB/s":
        return num * 1024;
      default:
        return 0;
    }
  };

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

        if (downloading.length > 0 && !localStorage.getItem("hasDownloadedBefore")) {
          setShowFirstTimeAlert(true);
          localStorage.setItem("hasDownloadedBefore", "true");
        }

        if (JSON.stringify(downloading) !== JSON.stringify(downloadingGames)) {
          setDownloadingGames(downloading);

          let totalSpeedNum = 0;
          let activeCount = 0;

          downloading.forEach(game => {
            if (game.downloadingData?.downloading) {
              activeCount++;
              const speed = game.downloadingData.progressDownloadSpeeds;
              if (speed) {
                totalSpeedNum += normalizeSpeed(speed);
              }
            }
          });

          setActiveDownloads(activeCount);
          const formattedSpeed = `${totalSpeedNum.toFixed(2)} MB/s`;
          setTotalSpeed(formattedSpeed);

          // Update speed history
          setSpeedHistory(prevHistory => {
            const newHistory = [...prevHistory.slice(1), { 
              index: prevHistory[prevHistory.length - 1].index + 1, 
              speed: totalSpeedNum
            }];
            localStorage.setItem('speedHistory', JSON.stringify(newHistory));
            return newHistory;
          });
        }
      } catch (error) {
        console.error("Error fetching downloading games:", error);
      }
    };

    fetchDownloadingGames();
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

  const handleStopDownload = async (game) => {
    setStoppingDownloads(prev => new Set([...prev, game.id]));
    try {
      await window.electron.stopDownload(game.game);
    } finally {
      setStoppingDownloads(prev => {
        const newSet = new Set(prev);
        newSet.delete(game.id);
        return newSet;
      });
    }
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
    <div className="container mx-auto p-4 space-y-6">
      {/* Page Title */}
      <div className="flex items-center gap-4 mt-4">
        <h1 className="text-3xl font-bold text-primary tracking-tight">
          {t("downloads.activeDownloads")}
        </h1>
      </div>

      {downloadingGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center">
          <div className="space-y-6">
            <div className="p-6 rounded-full bg-primary/5 w-fit mx-auto">
              <Coffee className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight">{t("downloads.noDownloads")}</h3>
              <p className="text-muted-foreground text-base leading-relaxed">{t("downloads.noDownloadsMessage")}</p>
            </div>
          </div>
        </div>
      ) : (
        /* Main Content Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Downloads Section - Takes up 2 columns on large screens */}
          <div className="lg:col-span-2 space-y-4">
            {downloadingGames.map((game) => (
              <DownloadCard
                key={game.id}
                game={game}
                onStop={() => handleStopDownload(game)}
                onRetry={() => handleRetryDownload(game)}
                onOpenFolder={() => handleOpenFolder(game)}
                isStopping={stoppingDownloads.has(game.id)}
              />
            ))}
          </div>

          {/* Charts Section - Takes up 1 column on large screens */}
          <div className="space-y-4">
            {/* Speed History Chart */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">{t("downloads.speedHistory")}</h3>
              </CardHeader>
              <CardContent className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={speedHistory}
                    margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="index" 
                      hide 
                    />
                    <YAxis 
                      domain={[0, 'auto']}
                      tickFormatter={(value) => `${value.toFixed(1)}`}
                    />
                    <Tooltip 
                      formatter={(value) => [
                        `${value.toFixed(2)} MB/s`,
                        'Speed'
                      ]}
                      labelFormatter={() => ''}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        padding: '8px',
                        color: 'hsl(var(--popover-foreground))',
                        fontSize: '0.875rem'
                      }}
                      labelStyle={{
                        color: 'hsl(var(--popover-foreground))'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="speed"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Download Statistics */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">{t("downloads.statistics")}</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>{t("downloads.activeDownloads")}</span>
                    <span className="font-medium">{activeDownloads}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t("downloads.currentTotalSpeed")}</span>
                    <span className="font-medium">{totalSpeed}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Alert Dialogs */}
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

      <AlertDialog open={retryModalOpen} onOpenChange={setRetryModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("downloads.retryDownload.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("downloads.retryDownload.message")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={retryLink}
              onChange={(e) => setRetryLink(e.target.value)}
              placeholder={t("downloads.retryDownload.placeholder")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("downloads.retryDownload.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetryConfirm}>
              {t("downloads.retryDownload.confirm")}
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
  const isWaiting = downloadingData?.waiting;
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
          • Progress: ${downloadingData.progressCompleted || "0"}%
          • Download Speed: ${downloadingData.progressDownloadSpeeds || "N/A"}
          • Current File: ${downloadingData.progressCurrentFile || "N/A"}
          • Total Files: ${downloadingData.progressTotalFiles || "N/A"}

          System Info:
          • Timestamp: ${new Date().toISOString()}
          • Platform: ${window.electron.getPlatform() || "Unknown"}
          • App Version: ${__APP_VERSION__ || "Unknown"}

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
      toast.error(t("common.reportDialog.couldNotReport"), {
        description: t("common.reportDialog.couldNotReportDesc"),
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
    <Card className="mb-4 w-full transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <h3 className="font-semibold leading-none tracking-tight">{game.game}</h3>
          <p className="text-sm text-muted-foreground font-medium">{game.size}</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 transition-colors duration-200 hover:bg-muted/80">
              {isStopping ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {hasError ? (
              <>
                <DropdownMenuItem onClick={() => onRetry(game)} className="gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  {t("downloads.actions.retryDownload")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleRemoveDownload(game)} className="gap-2 text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  {t("downloads.actions.cancelAndDelete")}
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => onStop(game)} className="gap-2">
                <StopCircle className="h-4 w-4" />
                {t("downloads.actions.stopDownload")}
              </DropdownMenuItem>
            )}
            {!isDownloading && (
              <DropdownMenuItem onClick={() => onOpenFolder(game)} className="gap-2">
                <FolderOpen className="h-4 w-4" />
                {t("downloads.actions.openFolder")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        {hasError ? (
          <div className="bg-destructive/5 border-destructive/20 space-y-4 rounded-lg border p-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-start space-x-3">
              <AlertCircle className="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="text-destructive font-medium">
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
                      className="cursor-pointer text-primary hover:underline"
                    >
                      {t("common.learnMore")}{" "}
                      <ExternalLink className="mb-1 inline-block h-3 w-3" />
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
                        className="cursor-pointer text-primary hover:underline"
                      >
                        {t("common.learnMore")}{" "}
                        <ExternalLink className="mb-1 inline-block h-3 w-3" />
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
                        className="border-destructive/30 hover:bg-destructive/10 transition-colors duration-200"
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
                    className="border-destructive/30 hover:bg-destructive/10 transition-colors duration-200"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {t("common.retry")}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground/80">
                  {t("downloads.errorHelp")}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {isDownloading && !isWaiting && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-muted-foreground min-w-[45px]">
                    {downloadingData.progressCompleted}%
                  </span>
                  <div className="flex-1">
                    <Progress 
                      value={parseFloat(downloadingData.progressCompleted)} 
                      className="h-2 transition-all duration-300"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2 bg-muted/40 px-3 py-1 rounded-md">
                    <Download className="h-4 w-4" />
                    <span className="font-medium">{downloadingData.progressDownloadSpeeds}</span>
                  </div>
                  <div className="flex items-center space-x-2 bg-muted/40 px-3 py-1 rounded-md">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">ETA: {downloadingData.timeUntilComplete}</span>
                  </div>
                </div>
              </div>
            )}
            {(isExtracting || isUpdating) && (
              <div className="mt-2 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="relative overflow-hidden rounded-full">
                  <Progress value={undefined} className="bg-muted/30 h-2" />
                  <div
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                    style={{
                      animation: "shimmer 2s infinite ease-in-out",
                      backgroundSize: "200% 100%",
                      WebkitAnimation: "shimmer 2s infinite ease-in-out",
                      WebkitBackgroundSize: "200% 100%",
                    }}
                  />
                </div>
                <div className="flex flex-col items-center justify-center py-2 bg-muted/40 rounded-lg">
                  <span className="flex items-center gap-2 text-lg font-semibold">
                    <Loader className="h-4 w-4 animate-spin" />
                    {isExtracting ? t("downloads.extracting") : t("downloads.updating")}
                  </span>
                  <span className="text-sm text-muted-foreground mt-1">
                    {isExtracting
                      ? t("downloads.extractingDescription")
                      : t("downloads.updatingDescription")}
                  </span>
                </div>
              </div>
            )}
            {isWaiting && (
              <div className="mt-2 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="relative overflow-hidden rounded-full">
                  <Progress value={undefined} className="bg-muted/30 h-2" />
                </div>
                <div className="flex flex-col items-center justify-center py-2 bg-muted/40 rounded-lg">
                  <span className="flex items-center gap-2 text-lg font-semibold">
                    <Loader className="h-4 w-4 animate-spin" />
                    {t("downloads.waiting")}
                  </span>
                  <span className="text-sm text-muted-foreground mt-1 text-center max-w-[70%]">
                    {t("downloads.waitingDescription")}
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
