import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import checkQbittorrentStatus from "@/services/qbittorrentCheckService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert,
  Languages,
  Loader,
  Hand,
  RefreshCw,
  CircleAlert,
  ExternalLink,
  History,
  ChartNoAxesCombined,
  ArrowRight,
  Download,
  Scale,
  ClockAlert,
  FlaskConical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import gameService from "@/services/gameService";
import { useNavigate } from "react-router-dom";
import { getAvailableLanguages, handleLanguageChange } from "@/services/languageService";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSettings } from "@/context/SettingsContext";

const themes = [
  // Light themes
  { id: "light", name: "Arctic Sky", group: "light" },
  { id: "blue", name: "Ocean Blue", group: "light" },
  { id: "purple", name: "Ascendara Purple", group: "light" },
  { id: "emerald", name: "Emerald", group: "light" },
  { id: "rose", name: "Rose", group: "light" },
  { id: "amber", name: "Amber Sand", group: "light" },

  // Dark themes
  { id: "dark", name: "Dark Blue", group: "dark" },
  { id: "midnight", name: "Midnight", group: "dark" },
  { id: "cyberpunk", name: "Cyberpunk", group: "dark" },
  { id: "sunset", name: "Sunset", group: "dark" },
  { id: "forest", name: "Forest", group: "dark" },
  { id: "ocean", name: "Deep Ocean", group: "dark" },
];

const getThemeColors = themeId => {
  const themeMap = {
    light: {
      bg: "bg-white",
      primary: "bg-blue-500",
      secondary: "bg-slate-100",
      text: "text-slate-900",
    },
    dark: {
      bg: "bg-slate-900",
      primary: "bg-blue-500",
      secondary: "bg-slate-800",
      text: "text-slate-100",
    },
    blue: {
      bg: "bg-blue-50",
      primary: "bg-blue-600",
      secondary: "bg-blue-100",
      text: "text-blue-900",
    },
    purple: {
      bg: "bg-purple-50",
      primary: "bg-purple-500",
      secondary: "bg-purple-100",
      text: "text-purple-900",
    },
    emerald: {
      bg: "bg-emerald-50",
      primary: "bg-emerald-500",
      secondary: "bg-emerald-100",
      text: "text-emerald-900",
    },
    rose: {
      bg: "bg-rose-50",
      primary: "bg-rose-500",
      secondary: "bg-rose-100",
      text: "text-rose-900",
    },
    cyberpunk: {
      bg: "bg-gray-900",
      primary: "bg-pink-500",
      secondary: "bg-gray-800",
      text: "text-pink-500",
    },
    sunset: {
      bg: "bg-slate-800",
      primary: "bg-orange-500",
      secondary: "bg-slate-700",
      text: "text-orange-400",
    },
    forest: {
      bg: "bg-[#141E1B]",
      primary: "bg-green-500",
      secondary: "bg-[#1C2623]",
      text: "text-green-300",
    },
    midnight: {
      bg: "bg-[#020617]",
      primary: "bg-indigo-400",
      secondary: "bg-slate-800",
      text: "text-indigo-200",
    },
    amber: {
      bg: "bg-amber-50",
      primary: "bg-amber-600",
      secondary: "bg-amber-100",
      text: "text-amber-900",
    },
    ocean: {
      bg: "bg-slate-900",
      primary: "bg-cyan-400",
      secondary: "bg-slate-800",
      text: "text-cyan-100",
    },
  };

  return themeMap[themeId] || themeMap.light;
};

// Move debounce helper function up
function createDebouncedFunction(func, wait) {
  let timeoutId;

  const debouncedFn = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };

  debouncedFn.cancel = () => {
    clearTimeout(timeoutId);
  };

  return debouncedFn;
}

function Settings() {
  const { theme, setTheme } = useTheme();
  const { language, changeLanguage, t } = useLanguage();
  const { settings, setSettings } = useSettings();
  const navigate = useNavigate();
  const [isInitialized, setIsInitialized] = useState(false);
  const initialSettingsRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState("none");
  const [isTriggering, setIsTriggering] = useState(false);
  const [apiMetadata, setApiMetadata] = useState(null);
  const [fitgirlMetadata, setFitgirlMetadata] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnWindows, setIsOnWindows] = useState(true);
  const [downloadPath, setDownloadPath] = useState("");
  const [canCreateFiles, setCanCreateFiles] = useState(true);
  const [isDownloaderRunning, setIsDownloaderRunning] = useState(false);
  const [showTorrentWarning, setShowTorrentWarning] = useState(false);
  const [showReloadDialog, setShowReloadDialog] = useState(false);
  const [pendingSourceChange, setPendingSourceChange] = useState(null);
  const [dependencyStatus, setDependencyStatus] = useState(null);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [isExperiment, setIsExperiment] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDev, setIsDev] = useState(false);

  // Use a ref to track if this is the first mount
  const isFirstMount = useRef(true);

  useEffect(() => {
    const checkExperiment = async () => {
      const isExperiment = await window.electron.isExperiment();
      setIsExperiment(isExperiment);
    };
    checkExperiment();
  }, []);

  // Check if we're on Windows
  useEffect(() => {
    const checkPlatform = async () => {
      const isWindows = await window.electron.isOnWindows();
      console.log("Is on Windows:", isWindows);
      setIsOnWindows(isWindows);
    };
    checkPlatform();
  }, []);

  // Create a debounced save function to prevent too frequent saves
  const debouncedSave = useMemo(
    () =>
      createDebouncedFunction(newSettings => {
        window.electron.saveSettings(newSettings);
      }, 300),
    []
  );

  useEffect(() => {
    const checkDownloaderStatus = async () => {
      try {
        const games = await window.electron.getGames();
        const hasDownloadingGames = games.some(game => {
          const { downloadingData } = game;
          return (
            downloadingData &&
            (downloadingData.downloading ||
              downloadingData.extracting ||
              downloadingData.updating ||
              downloadingData.error)
          );
        });
        setIsDownloaderRunning(hasDownloadingGames);
      } catch (error) {
        console.error("Error checking downloading games:", error);
      }
    };

    // Check immediately
    checkDownloaderStatus();

    // Then check every second
    const interval = setTimeout(() => {
      checkDownloaderStatus();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-save settings whenever they change
  useEffect(() => {
    if (isInitialized && !isFirstMount.current) {
      debouncedSave(settings);
    }
  }, [settings, isInitialized]);

  // Load initial settings
  useEffect(() => {
    const initializeSettings = async () => {
      if (!isFirstMount.current) return;

      setIsLoading(true);

      try {
        // Load settings first
        const savedSettings = await window.electron.getSettings();

        if (savedSettings) {
          setSettings(savedSettings);
          // Set the download directory from saved settings
          if (savedSettings.downloadDirectory) {
            setDownloadPath(savedSettings.downloadDirectory);
          }
          initialSettingsRef.current = savedSettings;
        }

        isFirstMount.current = false;
      } catch (error) {
        console.error("Error initializing settings:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, []); // Run only once on mount

  const handleSettingChange = async (key, value) => {
    if (key === "gameSource") {
      setPendingSourceChange(value);
      setShowReloadDialog(true);
      return;
    }

    if (key === "sideScrollBar") {
      setSettings(prev => ({
        ...prev,
        [key]: value,
      }));
      // Update scrollbar styles directly
      if (value) {
        document.documentElement.classList.add("custom-scrollbar");
      } else {
        document.documentElement.classList.remove("custom-scrollbar");
      }
      return;
    }

    window.electron.updateSetting(key, value).then(success => {
      if (success) {
        setSettings(prev => ({
          ...prev,
          [key]: value,
        }));
      }
    });
  };

  const handleDirectorySelect = useCallback(async () => {
    try {
      const directory = await window.electron.openDirectoryDialog();
      if (directory) {
        const canCreate = await window.electron.canCreateFiles(directory);
        if (!canCreate) {
          toast.error(t("settings.errors.noPermission"));
          return;
        }
        setDownloadPath(directory);
        handleSettingChange("downloadDirectory", directory);
      }
    } catch (error) {
      console.error("Error selecting directory:", error);
      toast.error(t("settings.errors.directorySelect"));
    }
  }, [handleSettingChange, t]);

  // Theme handling
  const handleThemeChange = useCallback(
    newTheme => {
      setTheme(newTheme);
      localStorage.setItem("ascendara-theme", newTheme);
      handleSettingChange("theme", newTheme);
    },
    [handleSettingChange, setTheme]
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem("ascendara-theme");
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, [setTheme]);

  useEffect(() => {
    if (theme && isInitialized) {
      handleSettingChange("theme", theme);
    }
  }, [theme, isInitialized, handleSettingChange]);

  const groupedThemes = {
    light: themes.filter(t => t.group === "light"),
    dark: themes.filter(t => t.group === "dark"),
  };

  // Check if in development mode
  useEffect(() => {
    const checkDevMode = async () => {
      const isDevMode = await window.electron.isDev();
      setIsDev(isDevMode);
    };
    checkDevMode();
  }, []);

  // Function to trigger selected screen
  const triggerScreen = async () => {
    setIsTriggering(true);
    try {
      switch (currentScreen) {
        case "updating":
          // Set installing flag to show UpdateOverlay
          localStorage.setItem("forceInstalling", "true");
          window.location.reload();
          break;

        case "loading":
          // Set loading state and reload
          localStorage.setItem("forceLoading", "true");
          window.location.reload();
          break;

        case "crashscreen":
          // Simulate a crash by throwing an error
          throw new Error("Intentional crash for testing");

        case "finishingup":
          // Set the updating timestamp to show finishing up screen
          await window.electron.setTimestampValue("isUpdating", true);
          window.location.reload();
          break;
      }
    } catch (error) {
      console.error("Error triggering screen:", error);
      if (currentScreen === "crashscreen") {
        // For crash screen, we want to propagate the error
        throw error;
      }
    } finally {
      setIsTriggering(false);
    }
  };

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const data = await gameService.getAllGames();
        setApiMetadata(data.metadata);
      } catch (error) {
        console.error("Error fetching metadata:", error);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    const loadFitgirlMetadata = async () => {
      if (!settings.torrentEnabled) return;
      try {
        const data = await gameService.getAllGames();
        setApiMetadata(data.metadata);
      } catch (error) {
        console.error("Failed to load Fitgirl metadata:", error);
      }
    };
    loadFitgirlMetadata();
  }, [settings.torrentEnabled]);

  const handleRefreshIndex = async () => {
    setIsRefreshing(true);
    try {
      const lastModified = await gameService.checkMetadataUpdate();
      if (lastModified) {
        const data = await gameService.getAllGames();
        setApiMetadata(data.metadata);
      }
    } catch (error) {
      console.error("Error checking for updates:", error);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  // Check dependency status on mount and after reinstall
  const checkDependencies = useCallback(async () => {
    console.log("Checking dependencies...");
    try {
      if (!isOnWindows) {
        console.log("Not on Windows, skipping dependency check");
        setDependencyStatus(null);
        return;
      } else {
        const status = await window.electron.checkGameDependencies();
        setDependencyStatus(status);
      }
    } catch (error) {
      console.error("Failed to check dependencies:", error);
    }
  }, []);

  useEffect(() => {
    if (!isOnWindows) {
      return; // Don't even set up the timer if not on Windows
    }
    const timer = setTimeout(() => {
      checkDependencies();
    }, 1000);
    return () => clearTimeout(timer);
  }, [checkDependencies, isOnWindows]);

  // Get dependency status indicator
  const getDependencyStatusInfo = useMemo(() => {
    if (!isOnWindows) {
      return {
        text: t("settings.cannotCheckDependencies"),
        color: "text-muted-foreground",
      };
    }

    if (!dependencyStatus) {
      return {
        text: t("settings.checkingDependencies"),
        color: "text-muted-foreground",
      };
    }

    const installedCount = dependencyStatus.filter(dep => dep.installed).length;
    const totalCount = dependencyStatus.length;

    if (installedCount === totalCount) {
      return {
        text: t("settings.allDependenciesInstalled"),
        color: "text-green-500",
      };
    } else if (installedCount === 0) {
      return {
        text: t("settings.noDependenciesInstalled"),
        color: "text-red-500",
      };
    } else {
      return {
        text: t("settings.someDependenciesMissing", {
          installed: installedCount,
          total: totalCount,
        }),
        color: "text-yellow-500",
      };
    }
  }, [dependencyStatus, t]);

  useEffect(() => {
    const loadLanguages = async () => {
      const languages = await getAvailableLanguages();
      setAvailableLanguages(languages);
    };
    loadLanguages();
  }, []);

  // Auto-show advanced section when torrent is enabled
  useEffect(() => {
    if (settings.torrentEnabled) {
      setShowAdvanced(true);
    }
  }, [settings.torrentEnabled]);

  // Switch back to SteamRip if torrent is disabled while using Fitgirl
  useEffect(() => {
    if (!settings.torrentEnabled && settings.gameSource === "fitgirl") {
      handleSettingChange("gameSource", "steamrip");
    }
  }, [settings.torrentEnabled]);

  // Disable Time Machine when using Fitgirl source
  useEffect(() => {
    if (settings.gameSource === "fitgirl" && settings.showOldDownloadLinks) {
      handleSettingChange("showOldDownloadLinks", false);
    }
  }, [settings.gameSource]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  const handleTorrentToggle = () => {
    if (!settings.torrentEnabled) {
      setShowTorrentWarning(true);
    } else {
      handleSettingChange("torrentEnabled", false);
      window.dispatchEvent(new CustomEvent("torrentSettingChanged", { detail: false }));
    }
  };

  const handleEnableTorrent = () => {
    setShowTorrentWarning(false);
    handleSettingChange("torrentEnabled", true);
    window.dispatchEvent(new CustomEvent("torrentSettingChanged", { detail: true }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl p-4 md:p-8">
        <div className="mb-6 flex items-center gap-4">
          <h1 className="text-3xl font-bold text-primary">{t("settings.title")}</h1>
          <Separator orientation="vertical" className="h-8" />
          <p className="text-muted-foreground">{t("settings.configure")}</p>

          {isExperiment ? (
            <div className="group relative ml-auto flex items-center text-sm text-muted-foreground">
              <div className="px-2 font-medium">
                <span>Experiment Build, Subject to Change</span>
              </div>
            </div>
          ) : (
            <div className="group relative ml-auto flex items-center text-sm text-muted-foreground">
              <div
                onClick={() =>
                  window.electron.openURL(
                    `https://github.com/ascendara/ascendara/commit/${__APP_REVISION__}`
                  )
                }
                className="mr-2 -translate-x-8 transform cursor-pointer opacity-0 transition-all duration-300 hover:underline group-hover:translate-x-0 group-hover:opacity-100"
              >
                <span className="text-primary-foreground/60">
                  (rev: {__APP_REVISION__?.substring(0, 7) || "dev"})
                </span>
              </div>
              <div
                onClick={() => window.electron.openURL("https://ascendara.app/changelog?individual")}
                className="cursor-pointer px-2 hover:underline"
              >
                <span>v{__APP_VERSION__}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column - Core Settings */}
          <div className="space-y-6 lg:col-span-8">
            {/* General Settings Card */}
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-primary">
                {t("settings.general")}
              </h2>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("settings.autoCreateShortcuts")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.autoCreateShortcutsDescription")}
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoCreateShortcuts}
                      onCheckedChange={() =>
                        handleSettingChange(
                          "autoCreateShortcuts",
                          !settings.autoCreateShortcuts
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("settings.ascendaraUpdates")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.ascendaraUpdatesDescription")}
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoUpdate}
                      onCheckedChange={() =>
                        handleSettingChange("autoUpdate", !settings.autoUpdate)
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("settings.notifications")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.notificationsDescription")}
                      </p>
                    </div>
                    <Switch
                      checked={settings.notifications}
                      onCheckedChange={() =>
                        handleSettingChange(
                          "notifications",
                          !settings.notifications
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("settings.sideScrollBar")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.sideScrollBarDescription")}
                      </p>
                    </div>
                    <Switch
                      checked={settings.sideScrollBar}
                      onCheckedChange={() =>
                        handleSettingChange("sideScrollBar", !settings.sideScrollBar)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t("settings.matureContent")}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t("settings.matureContentDescription")}
                      </p>
                    </div>
                    <Switch
                      checked={settings.seeInappropriateContent}
                      onCheckedChange={() =>
                        handleSettingChange(
                          "seeInappropriateContent",
                          !settings.seeInappropriateContent
                        )
                      }
                    />
                  </div>

                  <div>
                    {isDownloaderRunning && (
                      <div className="mb-4 mt-2 flex items-center gap-2 rounded-md border border-red-400 bg-red-50 p-2 text-red-600 dark:text-red-500">
                        <CircleAlert size={14} />
                        <p className="text-sm">
                          {t("settings.downloaderRunningWarning")}
                        </p>
                      </div>
                    )}
                    <Label
                      htmlFor="downloadPath"
                      className={isDownloaderRunning ? "opacity-50" : ""}
                    >
                      {t("settings.downloadLocation")}
                    </Label>
                    {!canCreateFiles && (
                      <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                        <ShieldAlert size={18} />
                        <p className="text-sm font-medium">
                          {t("settings.downloadLocationWarning")}
                        </p>
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="downloadPath"
                        disabled={isDownloaderRunning}
                        value={downloadPath}
                        readOnly
                        className="flex-1"
                      />
                      <Button
                        disabled={isDownloaderRunning}
                        className="text-secondary"
                        onClick={handleDirectorySelect}
                      >
                        {t("settings.selectDirectory")}
                      </Button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <Label
                      htmlFor="downloadThreads"
                      className={isDownloaderRunning ? "opacity-50" : ""}
                    >
                      {t("settings.downloadThreads")}
                    </Label>
                    <Select
                      disabled={isDownloaderRunning}
                      value={
                        settings.threadCount === 0
                          ? "custom"
                          : (settings.threadCount || 4).toString()
                      }
                      onValueChange={value => {
                        const threadCount = value === "custom" ? 0 : parseInt(value);
                        handleSettingChange("threadCount", threadCount);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">
                          {t("settings.downloadThreadsPresets.low")}
                        </SelectItem>
                        <SelectItem value="4">
                          {t("settings.downloadThreadsPresets.normal")}
                        </SelectItem>
                        <SelectItem value="8">
                          {t("settings.downloadThreadsPresets.high")}
                        </SelectItem>
                        <SelectItem value="12">
                          {t("settings.downloadThreadsPresets.veryHigh")}
                        </SelectItem>
                        <SelectItem value="16">
                          {t("settings.downloadThreadsPresets.extreme")}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Custom thread count input */}
                    {settings.threadCount === 0 && (
                      <div className="mt-4">
                        <Label>{t("settings.customThreadCount")}</Label>
                        <Input
                          type="number"
                          min="1"
                          max="32"
                          value={4}
                          onChange={e => {
                            const value = Math.max(
                              1,
                              Math.min(32, parseInt(e.target.value) || 1)
                            );
                            handleSettingChange("threadCount", value);
                          }}
                          className="mt-1"
                        />
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("settings.customThreadCountDesc")}
                        </p>
                      </div>
                    )}
                    {settings.threadCount > 8 && (
                      <div className="mt-2 flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                        <CircleAlert size={14} />
                        <p className="text-sm">
                          {t(
                            "settings.highThreadWarning",
                            "High thread counts may cause download issues. Use with caution."
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Game Sources Card */}
            <Card className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-primary">
                    {t("settings.gameSources")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("settings.gameSourcesDescription")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshIndex}
                  disabled={isRefreshing}
                  className="flex items-center gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                  {isRefreshing ? t("search.refreshingIndex") : t("search.refreshIndex")}
                </Button>
              </div>

              <div className="space-y-6">
                {/* Main Source Info */}
                <div className="rounded-lg border bg-card">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">SteamRIP</h3>
                          <Badge
                            variant={
                              settings.gameSource === "steamrip" ? "success" : "secondary"
                            }
                            className="text-xs"
                          >
                            {settings.gameSource === "steamrip"
                              ? t("settings.currentSource")
                              : t("settings.sourceInactive")}
                          </Badge>
                        </div>
                        <p className="max-w-[600px] text-sm text-muted-foreground">
                          {t("settings.steamripDescription")}
                        </p>
                      </div>
                      {settings.gameSource !== "steamrip" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => handleSettingChange("gameSource", "steamrip")}
                        >
                          {t("settings.switchSource")}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() =>
                            window.electron.openURL(
                              "https://ascendara.app/sources/steamrip"
                            )
                          }
                        >
                          {t("common.learnMore")}{" "}
                          <ExternalLink className="ml-1 inline-block h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {settings.gameSource === "steamrip" && (
                      <div className="mt-6 grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            {t("settings.lastUpdated")}
                          </Label>
                          <p className="text-sm font-medium">
                            {apiMetadata?.getDate || "-"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            {t("settings.totalGames")}
                          </Label>
                          <p className="text-sm font-medium">
                            {apiMetadata?.games?.toLocaleString() || "-"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {settings.torrentEnabled && (
                  <div className="mt-6 rounded-lg border bg-card duration-300 animate-in fade-in slide-in-from-top-4">
                    <div className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">Fitgirl Repacks</h3>
                            <Badge
                              variant={
                                settings.gameSource === "fitgirl"
                                  ? "success"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {settings.gameSource === "fitgirl"
                                ? t("settings.currentSource")
                                : t("settings.sourceInactive")}
                            </Badge>
                          </div>
                          <p className="max-w-[600px] text-sm text-muted-foreground">
                            {t("settings.fitgirlRepacksDescription")}
                          </p>
                        </div>
                        {settings.gameSource !== "fitgirl" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => handleSettingChange("gameSource", "fitgirl")}
                          >
                            {t("settings.switchSource")}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() =>
                              window.electron.openURL(
                                "https://ascendara.app/sources/fitgirl"
                              )
                            }
                          >
                            {t("common.learnMore")}{" "}
                            <ExternalLink className="ml-1 inline-block h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {settings.gameSource === "fitgirl" && (
                        <div className="mt-6 grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {t("settings.lastUpdated")}
                            </Label>
                            <p className="text-sm font-medium">
                              {apiMetadata?.getDate || "-"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              {t("settings.totalGames")}
                            </Label>
                            <p className="text-sm font-medium">
                              {apiMetadata?.games?.toLocaleString() || "-"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Advanced Section Toggle */}
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center px-2">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      disabled={settings.torrentEnabled}
                    >
                      {t("settings.advanced")}{" "}
                      {showAdvanced ? (
                        <ChevronUp className="ml-2 h-4 w-4" />
                      ) : (
                        <ChevronDown className="ml-2 h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Advanced Settings */}
                {showAdvanced && (
                  <div className="space-y-6 duration-300 animate-in fade-in slide-in-from-top-4">
                    {/* Torrent Support */}
                    <div className="rounded-lg border bg-card">
                      <div className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">
                                {t("settings.torrentOnAscendara")}
                              </h3>
                              <Badge variant="secondary" className="text-xs">
                                <FlaskConical className="mr-1 h-4 w-4" />
                                {t("settings.experimental")}
                              </Badge>
                            </div>
                            <p className="max-w-[600px] text-sm text-muted-foreground">
                              {t("settings.torrentDescription")}
                            </p>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Switch
                                    checked={settings.torrentEnabled}
                                    onCheckedChange={handleTorrentToggle}
                                    disabled={
                                      settings.gameSource === "fitgirl" || !isOnWindows
                                    }
                                  />
                                </div>
                              </TooltipTrigger>
                              {settings.gameSource === "fitgirl" && (
                                <TooltipContent>
                                  <p className="text-secondary">
                                    {t("settings.cannotDisableTorrent")}
                                  </p>
                                </TooltipContent>
                              )}
                              {!isOnWindows && (
                                <TooltipContent>
                                  <p className="text-secondary">
                                    {t("settings.onlyWindowsSupported")}
                                  </p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </div>

                        {settings.torrentEnabled && (
                          <div className="mt-6">
                            <div className="rounded-lg bg-muted/30 p-4">
                              <div className="flex items-center gap-2 text-sm">
                                <QbittorrentStatus />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Additional Features */}
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <ClockAlert className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">{t("settings.customSources")}</h4>
                      </div>
                      <p className="mb-3 text-sm text-muted-foreground">
                        {t("settings.customSourcesDescription")}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {t("settings.comingSoon")}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Theme Settings Card */}
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-semibold text-primary">
                {t("settings.theme")}
              </h2>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {t("settings.lightThemes")}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {groupedThemes.light.map(t => (
                      <ThemeButton
                        key={t.id}
                        theme={t}
                        currentTheme={theme}
                        onSelect={handleThemeChange}
                      />
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {t("settings.darkThemes")}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {groupedThemes.dark.map(t => (
                      <ThemeButton
                        key={t.id}
                        theme={t}
                        currentTheme={theme}
                        onSelect={handleThemeChange}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Additional Settings */}
          <div className="space-y-6 lg:col-span-4">
            {/* Analytics Card */}
            <Card className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <ChartNoAxesCombined className="mb-2 h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-primary">
                  {t("settings.ascendaraAnalytics")}
                </h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t("settings.ascendaraAnalyticsDescription")}&nbsp;
                    <a
                      className="inline-flex cursor-pointer items-center text-xs text-primary hover:underline"
                      onClick={() =>
                        window.electron.openURL("https://ascendara.app/analytics")
                      }
                    >
                      {t("common.learnMore")}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </p>
                  <div className="flex items-center justify-between space-x-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">
                        {t("settings.ascendaraToggleAnalytics")}
                      </Label>
                    </div>
                    <Switch
                      checked={settings.sendAnalytics}
                      onCheckedChange={() =>
                        handleSettingChange("sendAnalytics", !settings.sendAnalytics)
                      }
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Timemachine Card */}
            <Card className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <History className="mb-2 h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-primary">
                  {t("settings.ascendaraTimechine")}
                </h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t("settings.showOldDownloadLinksDescription")}&nbsp;
                    <a
                      onClick={() =>
                        window.electron.openURL(
                          "https://ascendara.app/docs/features/overview#ascendara-timemachine"
                        )
                      }
                      className="inline-flex cursor-pointer items-center text-xs text-primary hover:underline"
                    >
                      {t("common.learnMore")}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </p>
                  <div className="flex items-center justify-between space-x-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">
                        {t("settings.enableAscendaraTimechine")}
                      </Label>
                    </div>
                    <Switch
                      checked={settings.showOldDownloadLinks}
                      onCheckedChange={() =>
                        handleSettingChange(
                          "showOldDownloadLinks",
                          !settings.showOldDownloadLinks
                        )
                      }
                      disabled={settings.gameSource === "fitgirl"}
                    />
                  </div>
                  {settings.gameSource === "fitgirl" && (
                    <div className="mt-2 flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                      <p className="text-sm">
                        {t("settings.timeMachineDisabledFitgirl")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Language Settings Card */}
            <Card className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <Languages className="mb-2 h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-primary">
                  {t("settings.languageSettings")}
                </h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t("settings.languageSettingsDescription")}
                  </p>
                  <Select
                    value={language}
                    onValueChange={value => {
                      handleLanguageChange(value);
                      changeLanguage(value);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <span>
                            {availableLanguages.find(l => l.id === language)?.icon}
                          </span>
                          <span>
                            {availableLanguages.find(l => l.id === language)?.name}
                          </span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {availableLanguages.map(lang => (
                        <SelectItem key={lang.id} value={lang.id}>
                          <div className="flex items-center gap-2">
                            <span>{lang.icon}</span>
                            <span>{lang.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p
                    className="text-md inline-flex cursor-pointer items-center font-medium text-muted-foreground duration-200 hover:translate-x-1"
                    onClick={() => navigate("/extralanguages")}
                  >
                    {t("settings.selectMoreLanguages")}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.languageSetNote")}
                  </p>
                </div>
              </div>
            </Card>

            {/* Install Game Dependencies Card */}
            <Card className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <ShieldAlert className="mb-2 h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-primary">
                  {t("settings.installGameDependencies")}
                </h2>
              </div>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${getDependencyStatusInfo.color}`}>
                      {getDependencyStatusInfo.text}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.reinstallDependenciesDesc")}.
                  </p>
                  <Button
                    onClick={() => navigate("/dependencies")}
                    disabled={!isOnWindows}
                    className="flex w-full items-center gap-2 text-secondary"
                  >
                    {t("settings.manageDependencies")}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Developer Settings Card - Only shown in development mode */}
            {isDev && (
              <Card className="p-6">
                <div className="space-y-6">
                  <div>
                    <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-primary">
                      <CircleAlert size={20} />
                      Developer Tools
                    </h2>
                    <div className="space-y-4">
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => window.electron.clearCache()}
                      >
                        Clear Cache
                      </Button>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => window.electron.openGameDirectory("local")}
                      >
                        Open Local Directory
                      </Button>
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => window.electron.showTestNotification()}
                      >
                        Show Test Notification
                      </Button>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label>Screen Trigger</Label>
                      <div className="flex gap-2">
                        <Select
                          value={currentScreen}
                          onValueChange={value => setCurrentScreen(value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select Screen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="updating">Updating</SelectItem>
                            <SelectItem value="loading">Loading</SelectItem>
                            <SelectItem value="crashscreen">Crash Screen</SelectItem>
                            <SelectItem value="finishingup">Finishing Up</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={triggerScreen}
                          disabled={currentScreen === "none" || isTriggering}
                          variant="secondary"
                        >
                          {isTriggering ? (
                            <div className="flex items-center gap-2">
                              <Loader className="h-4 w-4 animate-spin" />
                              Triggering...
                            </div>
                          ) : (
                            "Trigger Screen"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Notice Card */}
            <Card className="border-yellow-500/50 bg-yellow-500/5 p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-yellow-500">
                  <Hand className="h-5 w-5 scale-x-[-1]" />
                  <h2 className="mb-0 text-lg font-semibold">
                    {t("settings.warningTitle")}
                  </h2>
                </div>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("settings.warningDescription")}
                </p>

                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("settings.warningSupportDevelopers")}
                </p>

                <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                  <span>{t("settings.warningSupportDevelopersCallToAction")}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Torrent Warning Dialog */}
      <AlertDialog open={showTorrentWarning} onOpenChange={setShowTorrentWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-foreground">
              {t("settings.torrentWarningDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-muted-foreground">
              <p>{t("settings.torrentWarningDialog.description")}</p>
              <div className="mt-4 space-y-3 rounded-lg bg-muted p-4">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-5 w-5 text-red-500" />
                  <p>{t("settings.torrentWarningDialog.vpnWarning")}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Scale className="mt-0.5 h-5 w-5 text-yellow-500" />
                  <p>{t("settings.torrentWarningDialog.legalWarning")}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Download className="mt-0.5 h-5 w-5 text-blue-500" />
                  <p>{t("settings.torrentWarningDialog.qbitWarning")}</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-primary">
              {t("settings.torrentWarningDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEnableTorrent}
              className="bg-red-500 hover:bg-red-600"
            >
              {t("settings.torrentWarningDialog.continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reload Required Dialog */}
      <AlertDialog open={showReloadDialog} onOpenChange={setShowReloadDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-foreground">
              {t("settings.reloadRequired")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t("settings.sourceChangeReload")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="text-primary"
              onClick={() => {
                setShowReloadDialog(false);
                setPendingSourceChange(null);
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90"
              onClick={() => {
                setSettings(prev => ({ ...prev, gameSource: pendingSourceChange }));
                const newSettings = { ...settings, gameSource: pendingSourceChange };
                window.electron.saveSettings(newSettings);
                window.electron.clearCache();
                window.electron.reload();
              }}
            >
              {t("settings.reload")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const QbittorrentStatus = () => {
  const { t } = useLanguage();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState({ checking: true });
  const [showConfigAlert, setShowConfigAlert] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const result = await checkQbittorrentStatus();
      setStatus(result);
    } catch (error) {
      console.error("Error checking qBittorrent status:", error);
      setStatus({ active: false, error: error.message });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">
        {checking ? (
          <>
            <Loader className="h-4 w-4 animate-spin" />
            <span>{t("app.qbittorrent.checking")}</span>
          </>
        ) : status.active ? (
          <>
            <Badge className="h-2 w-2 rounded-full bg-green-500" />
            <span>{t("app.qbittorrent.active", { version: status.version })}</span>
          </>
        ) : (
          <>
            <Badge className="h-2 w-2 rounded-full bg-red-500" />
            <span>
              {status.error ? (
                <>
                  {t("app.qbittorrent.inactiveWithError", { error: status.error })}
                  <button
                    onClick={() => setShowConfigAlert(true)}
                    className="ml-2 underline"
                  >
                    {t("settings.checkConfig")}
                  </button>
                </>
              ) : (
                t("app.qbittorrent.inactive")
              )}
            </span>
          </>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={checkStatus}
        disabled={checking}
        className="h-8 w-8"
      >
        <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
      </Button>
      <AlertDialog open={showConfigAlert} onOpenChange={setShowConfigAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-foreground">
              {t("app.qbittorrent.configRequired")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-muted-foreground">
              {t("app.qbittorrent.configInstructions")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-primary">
              {t("common.ok")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function ThemeButton({ theme, currentTheme, onSelect }) {
  const colors = getThemeColors(theme.id);

  return (
    <button
      onClick={() => onSelect(theme.id)}
      className={`group relative overflow-hidden rounded-xl transition-all ${
        currentTheme === theme.id
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : "hover:ring-1 hover:ring-primary/50"
      }`}
    >
      <div className={`aspect-[4/3] ${colors.bg} border border-border`}>
        <div className="h-full p-4">
          <div className={`h-full rounded-lg ${colors.secondary} p-3 shadow-sm`}>
            <div className="space-y-2">
              <div className={`h-3 w-24 rounded-full ${colors.primary} opacity-80`} />
              <div className={`h-2 w-16 rounded-full ${colors.primary} opacity-40`} />
            </div>
            <div className="mt-4 space-y-2">
              <div className={`h-8 rounded-md ${colors.bg} bg-opacity-50`} />
              <div className={`h-8 rounded-md ${colors.bg} bg-opacity-30`} />
            </div>
          </div>
        </div>
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 p-3 ${colors.bg} bg-opacity-80 backdrop-blur-sm`}
      >
        <div className="flex items-center justify-between">
          <span className={`font-medium ${colors.text}`}>{theme.name}</span>
          <div className={`h-3 w-3 rounded-full ${colors.primary}`} />
        </div>
      </div>
    </button>
  );
}

export default Settings;
