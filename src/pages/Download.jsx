import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { sanitizeText } from "@/lib/utils";
import imageCacheService from "@/services/imageCacheService";
import {
  BadgeCheckIcon,
  CheckIcon,
  CircleSlash,
  CopyIcon,
  ExternalLink,
  InfoIcon,
  Loader,
  MessageSquareWarning,
  TriangleAlert,
  History,
  Zap,
  AlertTriangle,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import checkQbittorrentStatus from "@/services/qbittorrentCheckService";
import { toast } from "sonner";
import TimemachineDialog from "@/components/TimemachineDialog";

const isValidURL = (url, provider) => {
  const trimmedUrl = url.trim();
  if (trimmedUrl === "") {
    return true;
  }

  let pattern;

  switch (provider.toLowerCase()) {
    case "megadb":
      pattern =
        /^(https?:\/\/)([^\/?#]+)(?::(\d+))?(\/[^?#]*\/[^?#]*\/)([^?#]+)\.(?:zip|rar|7z)$/i;
      break;
    case "datanodes":
      pattern =
        /^https:\/\/node\d+\.datanodes\.to(?::\d+)?\/d\/[a-z0-9]+\/.*\.(?:zip|rar|7z)$/i;
      break;
    case "qiwi":
      pattern = /^https:\/\/(spyderrock\.com\/[a-zA-Z0-9]+-[\w\s.-]+\.rar)$/i;
      break;
    case "buzzheavier":
      pattern = /^https:\/\/buzzheavier\.com\/dl\/[A-Za-z0-9_-]+(?:\?.*)?$/i;
      break;
    case "gofile":
      pattern =
        /^https:\/\/store\d*\.gofile\.io\/download\/web\/[a-f0-9-]+\/[\w\s\.-]+\.(?:zip|rar|7z)$/i;
      break;
    default:
      return false;
  }

  const match = pattern.test(trimmedUrl);
  if (!match) {
    return false;
  }

  const domainRegex = new RegExp(provider, "i");
  const containsProviderName = domainRegex.test(trimmedUrl);

  return containsProviderName;
};

const VERIFIED_PROVIDERS = ["megadb", "gofile", "datanodes", "buzzheavier", "qiwi"];

const sanitizeGameName = name => {
  return sanitizeText(name);
};

export default function DownloadPage() {
  const { state } = useLocation();
  const location = useLocation();
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(state?.gameData);
  const { t } = useLanguage();
  const { settings, updateSettings } = useSettings();

  // Clear data when leaving the page
  useEffect(() => {
    return () => {
      // Only clear if we're actually navigating away from the download page
      if (!location.pathname.includes("download")) {
        // Clear all state
        setSelectedProvider("");
        setInputLink("");
        setIsStartingDownload(false);
        setShowNoDownloadPath(false);
        setCachedImage(null);
        setIsValidLink(true);
        setShowCopySuccess(false);
        setShowShareCopySuccess(false);
        setIsReporting(false);
        setReportReason("");
        setReportDetails("");
        setShowNewUserGuide(false);
        setGuideStep(0);
        setGuideImages({});

        // Remove the state from history
        window.history.replaceState({}, document.title, location.pathname);
      }
    };
  }, [location]);

  // Log and validate game data
  useEffect(() => {
    if (!gameData) {
      console.error("No game data available");
      return;
    }
    console.log("Received game data:", gameData);
  }, [gameData, navigate]);

  // State declarations
  const [selectedProvider, setSelectedProvider] = useState("");
  const [inputLink, setInputLink] = useState("");
  const [isStartingDownload, setIsStartingDownload] = useState(false);
  const [useAscendara, setUseAscendara] = useState(false);
  const [showNoDownloadPath, setShowNoDownloadPath] = useState(false);
  const [cachedImage, setCachedImage] = useState(null);
  const [isValidLink, setIsValidLink] = useState(true);
  const [torrentRunning, setIsTorrentRunning] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [showShareCopySuccess, setShowShareCopySuccess] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [timemachineSetting, setTimemachineSetting] = useState(false);
  const [showTimemachineSelection, setShowTimemachineSelection] = useState(false);
  const [showNewUserGuide, setShowNewUserGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [guideImages, setGuideImages] = useState({});
  const [lastProcessedUrl, setLastProcessedUrl] = useState(null);
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);

  // Use a ref to track the event handler and active status
  const urlHandlerRef = useRef(null);
  const isActive = useRef(false);

  // Simple download handler function
  async function handleDownload(directUrl = null) {
    const sanitizedGameName = sanitizeText(gameData.game);
    if (showNoDownloadPath) {
      return;
    }

    if (!gameData) {
      console.error("No game data available");
      toast.error(t("download.toast.noGameData"));
      return;
    }

    // Handle torrent links if Fitgirl is the source
    if (settings.gameSource === "fitgirl") {
      const torrentLink = gameData.torrentLink;
      if (torrentLink) {
        if (isStartingDownload) {
          console.log("Download already in progress, skipping");
          return;
        }

        setIsStartingDownload(true);

        try {
          await window.electron.downloadFile(
            torrentLink,
            sanitizedGameName,
            gameData.online || false,
            gameData.dlc || false,
            false,
            gameData.version || "",
            gameData.imgID,
            gameData.size || ""
          );

          // Keep isStarting true until download actually begins
          const removeDownloadListener = window.electron.onDownloadProgress(downloadInfo => {
            if (downloadInfo.game === sanitizedGameName) {
              setIsStartingDownload(false);
              removeDownloadListener();
            }
          });

          setTimeout(() => {
            toast.success(t("download.toast.torrentSent"));
            navigate("/downloads");
          }, 2500);
        } catch (error) {
          console.error("Download failed:", error);
          toast.error(t("download.toast.downloadFailed"));
          setIsStartingDownload(false);
        }
        return;
      }
    }

    // Special handling for GoFile when no direct URL is provided
    if (!directUrl && selectedProvider === "gofile") {
      const goFileLinks = gameData.download_links?.["gofile"] || [];
      const validGoFileLink = goFileLinks.find(link => link && typeof link === "string");

      if (!validGoFileLink) {
        toast.error(t("download.toast.invalidLink"));
        return;
      }

      // Properly format the GoFile link
      directUrl = validGoFileLink.replace(/^(?:https?:)?\/\//, "https://");
    }
    // For manual downloads with other providers, check if we have a valid link
    else if (!directUrl) {
      if (!selectedProvider) {
        console.log("No provider selected");
        return;
      }
      if (!inputLink || !isValidLink) {
        console.log("Invalid link for manual download");
        return;
      }
    }

    if (isStartingDownload) {
      console.log("Download already in progress, skipping");
      return;
    }

    const urlToUse = directUrl || inputLink;
    console.log("Starting download with URL:", urlToUse);

    setIsStartingDownload(true);

    try {
      const isVrGame = gameData.category?.includes("Virtual Reality");

      await window.electron.downloadFile(
        urlToUse,
        sanitizedGameName,
        gameData.online || false,
        gameData.dlc || false,
        isVrGame || false,
        gameData.version || "",
        gameData.imgID,
        gameData.size || ""
      );
      // Keep isStarting true until download actually begins
      const removeDownloadListener = window.electron.onDownloadProgress(downloadInfo => {
        if (downloadInfo.game === sanitizedGameName) {
          setIsStartingDownload(false);
          removeDownloadListener();
        }
      });

      setTimeout(() => {
        toast.success(t("download.toast.downloadStarted"));
        navigate("/downloads");
      }, 2500);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error(t("download.toast.downloadFailed"));
      setIsStartingDownload(false);
    }
  }

  useEffect(() => {
    const checkQbittorrent = async () => {
      if (settings.torrentEnabled) {
        const status = await checkQbittorrentStatus();
        setIsTorrentRunning(status.active);
      }
    };
    checkQbittorrent();
  }, [t, settings.torrentEnabled]);

  // Protocol URL listener effect
  useEffect(() => {
    if (!useAscendara) return;

    // Mark component as active
    isActive.current = true;

    // Remove any existing listener first
    if (urlHandlerRef.current) {
      window.electron.ipcRenderer.removeListener(
        "protocol-download-url",
        urlHandlerRef.current
      );
      urlHandlerRef.current = null;
    }

    // Create new handler and store in ref
    urlHandlerRef.current = (event, url) => {
      if (!url?.startsWith("ascendara://") || !isActive.current) {
        return;
      }

      try {
        const encodedUrl = url.replace("ascendara://", "");
        const decodedUrl = decodeURIComponent(encodedUrl);
        // Remove trailing slash if it exists
        const cleanUrl = decodedUrl.endsWith("/") ? decodedUrl.slice(0, -1) : decodedUrl;

        // Don't process if it's the same URL we just handled
        if (cleanUrl === lastProcessedUrl) {
          console.log("Ignoring duplicate URL:", cleanUrl);
          return;
        }

        console.log("Handling protocol URL:", cleanUrl);
        handleDownload(cleanUrl);
      } catch (error) {
        console.error("Error handling protocol URL:", error);
        toast.error(t("download.toast.invalidProtocolUrl"));
      }
    };

    // Add the new listener
    window.electron.ipcRenderer.on("protocol-download-url", urlHandlerRef.current);

    // Cleanup function
    return () => {
      // Mark component as inactive
      isActive.current = false;

      if (urlHandlerRef.current) {
        window.electron.ipcRenderer.removeListener(
          "protocol-download-url",
          urlHandlerRef.current
        );
        urlHandlerRef.current = null;
      }
      // Clear URL tracking on unmount
      setLastProcessedUrl(null);
      setIsProcessingUrl(false);
    };
  }, [useAscendara]); // Remove lastProcessedUrl from dependencies

  useEffect(() => {
    const loadFileFromPath = async path => {
      try {
        const data = await window.electron.getAssetPath(path);
        if (data) {
          setGuideImages(prev => ({
            ...prev,
            [path]: data,
          }));
        }
      } catch (error) {
        console.error("Failed to load:", error);
      }
    };

    const guideImagePaths = [
      "/guide/guide-off.png",
      "/guide/guide-on.png",
      "/guide/guide-start.png",
      "/guide/guide-alwaysopen.png",
      "/guide/guide-open.png",
      "/guide/guide-downloads.png",
    ];

    guideImagePaths.forEach(path => loadFileFromPath(path));
  }, []);

  useEffect(() => {
    setTimemachineSetting(settings.showOldDownloadLinks);
  }, [settings.showOldDownloadLinks]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const loadCachedImage = async () => {
      const image = await imageCacheService.getImage(gameData.imgID);
      setCachedImage(image);
    };
    loadCachedImage();
    checkDownloadPath();
  }, [gameData, navigate]);

  useEffect(() => {
    const savedPreference = localStorage.getItem("useAscendara");
    if (savedPreference !== null) {
      setUseAscendara(JSON.parse(savedPreference));
    }
  }, []);

  const checkDownloadPath = async () => {
    try {
      if (!settings.downloadDirectory) {
        setShowNoDownloadPath(true);
      }
    } catch (error) {
      console.error("Error getting settings:", error);
    }
  };
  const handleInputChange = e => {
    const newLink = e.target.value;
    setInputLink(newLink);

    if (newLink.trim() === "") {
      setIsValidLink(true);
      return;
    }

    // Try to detect provider from URL if none selected
    if (!selectedProvider) {
      for (const provider of VERIFIED_PROVIDERS) {
        if (isValidURL(newLink, provider)) {
          setSelectedProvider(provider);
          setIsValidLink(true);
          return;
        }
      }
    }

    setIsValidLink(isValidURL(newLink, selectedProvider));
  };

  useEffect(() => {
    // Disable scrolling on the body
    document.body.style.overflow = "hidden";

    return () => {
      // Re-enable scrolling when the component unmounts
      document.body.style.overflow = "auto";
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === "Escape") {
        navigate("/search");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const guideSteps = [
    {
      title: t("download.newUserGuide.steps.0.title"),
      description: (
        <div>
          <p>{t("download.newUserGuide.steps.0.description")}</p>
        </div>
      ),
    },
    {
      title: t("download.newUserGuide.steps.1.title"),
      description: t("download.newUserGuide.steps.1.description"),
      image: guideImages["/guide/guide-off.png"],
    },
    {
      title: t("download.newUserGuide.steps.2.title"),
      description: t("download.newUserGuide.steps.2.description"),
      image: guideImages["/guide/guide-on.png"],
    },
    {
      title: t("download.newUserGuide.steps.3.title"),
      description: t("download.newUserGuide.steps.3.description"),
      image: guideImages["/guide/guide-start.png"],
    },
    {
      title: t("download.newUserGuide.steps.4.title"),
      description: t("download.newUserGuide.steps.4.description"),
      image: guideImages["/guide/guide-alwaysopen.png"],
    },
    {
      title: t("download.newUserGuide.steps.5.title"),
      description: t("download.newUserGuide.steps.5.description"),
      image: guideImages["/guide/guide-open.png"],
    },
    {
      title: t("download.newUserGuide.steps.6.title"),
      description: t("download.newUserGuide.steps.6.description"),
      image: guideImages["/guide/guide-downloads.png"],
    },
  ];

  const handleStartGuide = () => {
    setGuideStep(1);
  };

  const handleNextStep = () => {
    if (guideStep < guideSteps.length - 1) {
      setGuideStep(guideStep + 1);
    } else {
      updateSettings({ downloadHandler: true })
        .then(() => {
          setShowNewUserGuide(false);
          setGuideStep(0);
        })
        .catch(error => {
          console.error("Failed to save settings:", error);
        });
    }
  };

  const handleCloseGuide = () => {
    setShowNewUserGuide(false);
    setGuideStep(0);
  };

  const checkIfNewUser = async () => {
    if (!settings.downloadDirectory) {
      return true;
    }
    const games = await window.electron.getGames();
    return games.length === 0;
  };

  const handleCopyLink = async () => {
    let link = downloadLinks[selectedProvider][0].startsWith("//")
      ? `https:${downloadLinks[selectedProvider][0]}`
      : downloadLinks[selectedProvider][0];
    await navigator.clipboard.writeText(link);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 1000);

    const isNewUser = await checkIfNewUser();
    if (isNewUser) {
      setShowNewUserGuide(true);
    }
  };

  const handleOpenInBrowser = async () => {
    let link = downloadLinks[selectedProvider][0].startsWith("//")
      ? `https:${downloadLinks[selectedProvider][0]}`
      : downloadLinks[selectedProvider][0];
    window.electron.openURL(link);

    const isNewUser = await checkIfNewUser();
    if (isNewUser) {
      setShowNewUserGuide(true);
    }
  };

  const handleShareLink = async () => {
    const shareLink = `https://ascendara.app/game/${gameData.imgID}`;
    await navigator.clipboard.writeText(shareLink);
    setShowShareCopySuccess(true);
    setTimeout(() => setShowShareCopySuccess(false), 2000);
  };

  const handleSubmitReport = async () => {
    if (!reportReason || !reportDetails.trim()) {
      toast.error(t("download.reportError"));
      return;
    }

    setIsReporting(true);
    try {
      const token = await window.electron.getAPIKey();
      const response = await fetch("https://api.ascendara.app/auth/token", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to obtain token");
      }

      const { token: authToken } = await response.json();

      const reportResponse = await fetch("https://api.ascendara.app/app/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          reportType: "GameBrowsing",
          reason: reportReason,
          details: reportDetails,
          gameName: gameData.game,
        }),
      });

      if (!reportResponse.ok) {
        // If token is expired or invalid, try once more with a new token
        if (reportResponse.status === 401) {
          const newTokenResponse = await fetch("https://api.ascendara.app/auth/token", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!newTokenResponse.ok) {
            throw new Error("Failed to obtain new token");
          }

          const { token: newAuthToken } = await newTokenResponse.json();

          const retryResponse = await fetch("https://api.ascendara.app/app/report", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${newAuthToken}`,
            },
            body: JSON.stringify({
              reportType: "GameBrowsing",
              reason: reportReason,
              details: reportDetails,
              gameName: gameData.game,
            }),
          });

          if (retryResponse.ok) {
            toast.success(t("download.toast.reportSubmitted"));
            setReportReason("");
            setReportDetails("");
            return;
          }
        }
        throw new Error("Failed to submit report");
      }

      toast.success(t("download.toast.reportSubmitted"));
      setReportReason("");
      setReportDetails("");
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error(t("download.toast.reportFailed"));
    } finally {
      setIsReporting(false);
    }
  };

  if (!gameData) {
    return (
      <div className="container mx-auto max-w-7xl p-6">
        <AlertDialog variant="destructive">
          <AlertDialogDescription>
            {t("download.toast.noGameData")}
          </AlertDialogDescription>
        </AlertDialog>
      </div>
    );
  }

  const downloadLinks = gameData?.download_links || {};
  const hasProviders = Object.keys(downloadLinks).length > 0;
  const providers = hasProviders
    ? Object.entries(downloadLinks)
        .filter(([_, links]) => {
          if (!Array.isArray(links)) return false;
          if (links.length === 0) return false;
          return links.some(link => typeof link === "string" && link.length > 0);
        })
        .map(([provider]) => provider)
    : [];

  console.log("Final Available Providers:", providers);

  if (gameData && gameData.game) {
    gameData.game = sanitizeGameName(gameData.game);
  }

  return (
    <div
      className="container mx-auto flex min-h-screen max-w-7xl flex-col items-center fade-in"
      style={{ transform: `scale(0.95)`, transformOrigin: "top center" }}
    >
      <div className="w-full max-w-6xl">
        <div
          className="text-center font-bold text-muted-foreground"
          style={{
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        >
          {t("download.pressEscToGoBack")}
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {/* Game Header Section */}
          <div className="flex items-start gap-4">
            <img
              src={cachedImage || `https://api.ascendara.app/v2/image/${gameData.imgID}`}
              alt={gameData.game}
              className="h-36 w-64 rounded-lg object-cover"
            />
            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{gameData.game}</h1>
                {settings.gameSource == "fitigrl" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="fixed right-8" variant="outline" size="sm">
                        {t("download.reportBroken")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <form
                        onSubmit={e => {
                          e.preventDefault();
                          handleSubmitReport();
                        }}
                      >
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-2xl font-bold text-foreground">
                            {t("download.reportBroken")}: {gameData.game} 
                          </AlertDialogTitle>
                          <AlertDialogDescription className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                {t("download.reportReason")}
                              </label>
                              <Select value={reportReason} onValueChange={setReportReason}>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={t("download.reportReasons.placeholder")}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="gamedetails">
                                    {t("download.reportReasons.gameDetails")}
                                  </SelectItem>
                                  <SelectItem value="filesnotdownloading">
                                    {t("download.reportReasons.filesNotDownloading")}
                                  </SelectItem>
                                  <SelectItem value="notagame">
                                    {t("download.reportReasons.notAGame")}
                                  </SelectItem>
                                  <SelectItem value="linksnotworking">
                                    {t("download.reportReasons.linksNotWorking")}
                                  </SelectItem>
                                  <SelectItem value="image-error">
                                    {t("download.reportReasons.imageError")}
                                  </SelectItem>
                                  <SelectItem value="image-bad">
                                    {t("download.reportReasons.imageBad")}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                {t("download.reportDescription")}
                              </label>
                              <Textarea
                                placeholder={t("download.reportDescription")}
                                value={reportDetails}
                                onChange={e => setReportDetails(e.target.value)}
                                className="min-h-[100px]"
                              />
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter className="mt-4 gap-2">
                          <AlertDialogCancel
                            onClick={() => {
                              setReportReason("");
                              setReportDetails("");
                            }}
                          >
                            {t("common.cancel")}
                          </AlertDialogCancel>
                          <Button
                            type="submit"
                            className="text-secondary"
                            disabled={isReporting}
                          >
                            {isReporting ? (
                              <>
                                <Loader className="mr-2 h-4 w-4 animate-spin" />
                                {t("download.submitting")}
                              </>
                            ) : (
                              t("download.submitReport")
                            )}
                          </Button>
                        </AlertDialogFooter>
                      </form>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              <div className="mb-2 flex items-center gap-2">
                {gameData.version && (
                  <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-sm text-primary">
                    {gameData.version}
                    {timemachineSetting && (
                      <History
                        onClick={() => setShowTimemachineSelection(true)}
                        className="h-4 w-4 cursor-pointer"
                      />
                    )}
                  </span>
                )}
                {gameData.online && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-sm text-green-500">
                          {t("download.online")}
                          <InfoIcon className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-secondary">{t("download.onlineTooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {gameData.dlc && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-sm text-blue-500">
                          {t("download.allDlc")}
                          <InfoIcon className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-secondary">{t("download.allDlcTooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("download.size")}: {gameData.size}
              </p>
            </div>
          </div>

          {/* DMCA Notice Banner */}
          <div
            className="w-full cursor-pointer rounded-lg border border-primary/20 bg-primary/10 p-3 transition-colors hover:bg-primary/15"
            onClick={() => window.electron.openURL("https://ascendara.app/dmca")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{t("download.dmcaNotice")}</span>
              </div>
              <span className="flex items-center gap-1 text-sm text-primary hover:underline">
                {t("common.learnMore")} <ExternalLink size={16} />
              </span>
            </div>
          </div>

          <Separator className="my-1" />

          {/* Download Options Section */}
          {settings.gameSource === "fitgirl" && gameData.torrentLink ? (
            <div className="mx-auto max-w-xl">
              <div className="flex flex-col items-center space-y-8 py-2">
                <div className="flex w-full items-center justify-between">
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <span className="flex items-center gap-1">
                      Fitgirl Repacks
                    </span>
                  </h2>
                </div>

                <div className="w-full max-w-md space-y-4 text-center">
                  <h3 className="text-2xl font-semibold">
                    {t("download.downloadOptions.torrentInstructions.title")}
                  </h3>
                  <p className="text-muted-foreground">
                    {t("download.downloadOptions.torrentInstructions.description")}
                  </p>
                </div>

                {!torrentRunning && (
                  <p className="text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 inline-block mr-2" />
                    {t("download.downloadOptions.torrentInstructions.noTorrent")}
                  </p>
                )}

                <div className="w-full max-w-md">
                  <Button
                    onClick={() => handleDownload()}
                    disabled={isStartingDownload || !gameData || !torrentRunning}
                    className="h-12 w-full text-lg text-secondary"
                  >
                    {isStartingDownload ? (
                      <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        {t("download.sendingTorrent")}
                      </>
                    ) : (
                      t("download.downloadOptions.downloadTorrent")
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : selectedProvider === "gofile" ? (
            <div className="mx-auto max-w-xl">
              <div className="flex flex-col items-center space-y-8 py-2">
                <div className="flex w-full items-center justify-between">
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <span className="flex items-center gap-1">
                      Seamless <Zap className="h-5 w-5 text-primary" />
                    </span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      (GoFile <BadgeCheckIcon className="h-4 w-4" />)
                    </span>
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedProvider(providers.find(p => p !== "gofile") || "")
                    }
                  >
                    {t("download.switchProvider")}
                  </Button>
                </div>

                <div className="w-full max-w-md space-y-4 text-center">
                  <h3 className="text-2xl font-semibold">
                    {t("download.downloadOptions.gofileInstructions.thanks")}
                  </h3>
                  <p className="text-muted-foreground">
                    {t("download.downloadOptions.gofileInstructions.description")}
                  </p>
                </div>

                <div className="w-full max-w-md">
                  <Button
                    onClick={() => handleDownload()}
                    disabled={isStartingDownload || !gameData}
                    className="h-12 w-full text-lg text-secondary"
                  >
                    {isStartingDownload ? (
                      <>
                        <Loader className="mr-2 h-5 w-5 animate-spin" />
                        {t("download.downloadOptions.downloading")}
                      </>
                    ) : (
                      t("download.downloadOptions.downloadNow")
                    )}
                  </Button>
                </div>

                <p className="text-muted-foreground">
                  {t("download.downloadOptions.gofileInstructions.action")}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Left Column - Download Options */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold">
                    {t("download.downloadOptions.downloadOptions")}
                  </h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("download.downloadOptions.downloadSource")}</Label>
                      {providers.length > 0 ? (
                        <Select
                          value={selectedProvider}
                          onValueChange={setSelectedProvider}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t("download.downloadOptions.selectProvider")}
                            />
                          </SelectTrigger>
                          <SelectContent className="border-border bg-background">
                            {providers.map(provider => {
                              let displayName;
                              switch (provider.toLowerCase()) {
                                case "gofile":
                                  displayName = "Seamless (GoFile)";
                                  break;
                                case "megadb":
                                  displayName = "MegaDB";
                                  break;
                                case "buzzheavier":
                                  displayName = "Default (BuzzHeavier)";
                                  break;
                                case "qiwi":
                                  displayName = "QIWI";
                                  break;
                                case "datanodes":
                                  displayName = "DataNodes";
                                  break;
                                default:
                                  displayName =
                                    provider.charAt(0).toUpperCase() + provider.slice(1);
                              }
                              const isVerified = VERIFIED_PROVIDERS.includes(
                                provider.toLowerCase()
                              );
                              return (
                                <SelectItem
                                  key={provider}
                                  value={provider}
                                  className="hover:bg-muted focus:bg-muted"
                                >
                                  <div className="flex items-center gap-2">
                                    {displayName}
                                    {isVerified && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <BadgeCheckIcon className="h-4 w-4 text-primary" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Verified Provider</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p>{t("download.downloadOptions.noProviders")}</p>
                      )}
                    </div>

                    {selectedProvider && (
                      <div className="space-y-3">
                        <div>
                          <Label>{t("download.downloadOptions.downloadLink")}</Label>
                          <div className="mt-1 flex items-center gap-2">
                            <div
                              className="group flex flex-1 cursor-pointer items-center justify-between rounded-md bg-muted p-2 text-sm transition-colors hover:bg-muted/80"
                              onClick={handleCopyLink}
                            >
                              <span>
                                {downloadLinks[selectedProvider][0].startsWith("//")
                                  ? `https:${downloadLinks[selectedProvider][0]}`
                                  : downloadLinks[selectedProvider][0]}
                              </span>
                              {showCopySuccess ? (
                                <CheckIcon className="h-4 w-4 text-green-500" />
                              ) : (
                                <CopyIcon className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={handleOpenInBrowser}
                              variant="outline"
                            >
                              {t("download.downloadOptions.openInBrowser")}
                            </Button>
                          </div>
                        </div>

                        {!useAscendara && (
                          <div>
                            <Input
                              placeholder={t("download.downloadOptions.pasteLink")}
                              value={inputLink}
                              onChange={handleInputChange}
                              className={!isValidLink ? "border-red-500" : ""}
                            />
                            {!isValidLink && (
                              <p className="mt-1 text-sm text-red-500">
                                {t("download.downloadOptions.invalidLink")}{" "}
                                {selectedProvider}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedProvider && (
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="ascendara-handler"
                            checked={useAscendara}
                            onCheckedChange={checked => {
                              setUseAscendara(checked);
                              localStorage.setItem(
                                "useAscendara",
                                JSON.stringify(checked)
                              );
                            }}
                          />
                          <Label htmlFor="ascendara-handler" className="text-sm">
                            {t("download.downloadOptions.ascendaraHandler")}
                          </Label>
                        </div>
                        {!useAscendara && (
                          <p
                            className="cursor-pointer text-xs text-muted-foreground hover:underline"
                            onClick={() =>
                              window.electron.openURL("https://ascendara.app/extension")
                            }
                          >
                            {t("download.downloadOptions.getExtension")}
                          </p>
                        )}
                      </div>
                    )}

                    {selectedProvider && useAscendara && (
                      <div className="flex items-center justify-center space-x-2 py-2 text-muted-foreground">
                        <Loader className="h-4 w-4 animate-spin" />
                        <span className="text-sm">
                          {isStartingDownload
                            ? t("download.downloadOptions.startingDownload")
                            : t("download.downloadOptions.waitingForBrowser")}
                        </span>
                      </div>
                    )}

                    {!useAscendara && (
                      <Button
                        onClick={() => handleDownload()}
                        disabled={
                          isStartingDownload ||
                          !selectedProvider ||
                          !inputLink ||
                          !isValidLink ||
                          !gameData
                        }
                        className="w-full text-secondary"
                      >
                        {isStartingDownload ? (
                          <>
                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                            {t("download.downloadOptions.downloading")}
                          </>
                        ) : (
                          t("download.downloadOptions.downloadNow")
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Instructions */}
              <div className="space-y-3">
                {selectedProvider && selectedProvider !== "gofile" && (
                  <>
                    <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
                      <div className="flex">
                        <div className="ml-3">
                          <p className="inline-flex items-center gap-2 text-lg font-bold text-red-700">
                            <TriangleAlert strokeWidth={2.3} className="text-red-400" />
                            {t("download.protectYourself.warningTitle")}
                          </p>
                          <p className="mt-2 text-sm text-red-700">
                            {t("download.protectYourself.warning")}
                          </p>
                          <a
                            onClick={() =>
                              window.electron.openURL(
                                "https://ascendara.app/protect-yourself"
                              )
                            }
                            className="mt-2 flex cursor-pointer items-center gap-1 text-sm text-red-700 hover:text-red-900 hover:underline"
                          >
                            {t("download.protectYourself.learnHow")}{" "}
                            <ExternalLink size={16} />
                          </a>
                        </div>
                      </div>
                    </div>
                    <h2 className="text-xl font-semibold">
                      {t("download.downloadInstructions")}
                    </h2>
                  </>
                )}
                {selectedProvider ? (
                  <div>
                    {selectedProvider === "gofile" ? (
                      <div className="mt-8 flex flex-col items-center justify-center space-y-6">
                        <div className="max-w-md space-y-2 text-center">
                          <h2 className="text-2xl font-semibold">
                            {t("download.downloadOptions.gofileInstructions.thanks")}
                          </h2>
                          <p className="text-muted-foreground">
                            {t("download.downloadOptions.gofileInstructions.description")}
                          </p>
                        </div>

                        <div className="w-full max-w-sm">
                          <Button
                            onClick={() => handleDownload()}
                            disabled={isStartingDownload || !gameData}
                            className="h-12 w-full text-lg text-secondary"
                          >
                            {isStartingDownload ? (
                              <>
                                <Loader className="mr-2 h-5 w-5 animate-spin" />
                                {t("download.downloadOptions.downloading")}
                              </>
                            ) : (
                              <>{t("download.downloadOptions.downloadNow")}</>
                            )}
                          </Button>
                        </div>

                        <div className="text-center text-muted-foreground">
                          <p>{t("download.downloadOptions.gofileInstructions.action")}</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {useAscendara ? (
                          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
                            <li>
                              {t("download.downloadOptions.handlerInstructions.step1")}
                            </li>
                            <li>
                              {t("download.downloadOptions.handlerInstructions.step2")}
                            </li>
                            <li>
                              {t("download.downloadOptions.handlerInstructions.step3")}
                            </li>
                          </ol>
                        ) : (
                          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
                            <li>
                              {t("download.downloadOptions.manualInstructions.step1")}
                            </li>
                            <li>
                              {t("download.downloadOptions.manualInstructions.step2")}
                            </li>
                            <li>
                              {t("download.downloadOptions.manualInstructions.step3")}
                            </li>
                            <li>
                              {t("download.downloadOptions.manualInstructions.step4")}
                            </li>
                            <li>
                              {t("download.downloadOptions.manualInstructions.step5")}
                            </li>
                            <li>
                              {t("download.downloadOptions.manualInstructions.step6")}
                            </li>
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("download.downloadOptions.selectProviderPrompt")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {settings.gameSource !== "fitgirl" && (
        <TooltipProvider>
          <Tooltip open={showShareCopySuccess}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={handleShareLink}
                className="fixed bottom-20 right-4 z-50 flex items-center gap-2"
              >
                {showShareCopySuccess ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
                {t("download.shareGame")}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-secondary" side="left">
              <p>{t("download.linkCopied")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {gameData && (
        <TimemachineDialog
          gameData={gameData}
          onVersionSelect={version => setGameData(version)}
          open={showTimemachineSelection}
          onOpenChange={setShowTimemachineSelection}
        />
      )}

      {/* New User Guide Alert Dialog */}
      <AlertDialog open={showNewUserGuide} onOpenChange={handleCloseGuide}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            {guideStep === 0 ? (
              <>
                <AlertDialogTitle className="text-2xl font-bold text-foreground">
                  {t("download.newUserGuide.title")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("download.newUserGuide.description")}
                </AlertDialogDescription>
              </>
            ) : (
              <>
                <AlertDialogTitle className="text-2xl font-bold text-foreground md:text-xl">
                  {t(`download.newUserGuide.steps.${guideStep - 1}.title`)}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t(`download.newUserGuide.steps.${guideStep - 1}.description`)}
                </AlertDialogDescription>
                <div className="mt-4 space-y-4">
                  {guideSteps[guideStep - 1].image && (
                    <img
                      src={guideSteps[guideStep - 1].image}
                      alt={t(`download.newUserGuide.steps.${guideStep - 1}.title`)}
                      className="w-full rounded-lg border border-border"
                    />
                  )}
                  {guideSteps[guideStep - 1].action && (
                    <Button
                      className="w-full"
                      onClick={guideSteps[guideStep - 1].action.onClick}
                    >
                      {guideSteps[guideStep - 1].action.label}
                    </Button>
                  )}
                </div>
              </>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-primary" onClick={handleCloseGuide}>
              {guideStep === 0
                ? t("download.newUserGuide.noThanks")
                : t("download.newUserGuide.close")}
            </AlertDialogCancel>
            <Button
              className="text-secondary"
              onClick={guideStep === 0 ? handleStartGuide : handleNextStep}
            >
              {guideStep === 0
                ? t("download.newUserGuide.startGuide")
                : guideStep === guideSteps.length
                  ? t("download.newUserGuide.finish")
                  : guideStep === 1
                    ? t("download.newUserGuide.installed")
                    : guideStep === 2
                      ? t("download.newUserGuide.handlerEnabled")
                      : t("download.newUserGuide.nextStep")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

<style jsx>{`
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
`}</style>;
