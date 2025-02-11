import ContextMenu from "@/components/ContextMenu";
import Layout from "@/components/Layout";
import MenuBar from "@/components/MenuBar";
import SupportDialog from "@/components/SupportDialog";
import PlatformWarningDialog from "@/components/PlatformWarningDialog";
import UpdateOverlay from "@/components/UpdateOverlay";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { analytics } from "@/services/analyticsService";
import gameService from "@/services/gameService";
import { checkForUpdates } from "@/services/updateCheckingService";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Toaster, toast } from "sonner";
import Dependencies from "./pages/Dependencies";
import DownloadPage from "./pages/Download";
import Downloads from "./pages/Downloads";
import ExtraLanguages from "./pages/ExtraLanguages";
import Home from "./pages/Home";
import Library from "./pages/Library";
import Search from "./pages/Search";
import Settings from "./pages/Settings";
import Welcome from "./pages/Welcome";
import i18n from "./i18n";
import "./index.css";
import "./styles/scrollbar.css";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    analytics.trackPageView(pathname);
  }, [pathname]);

  return null;
};

const AppRoutes = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(null);
  const [isNewInstall, setIsNewInstall] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [iconData, setIconData] = useState("");
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [showPlatformWarning, setShowPlatformWarning] = useState(false);
  const location = useLocation();
  const hasChecked = useRef(false);
  const loadStartTime = useRef(Date.now());
  const hasShownUpdateNotification = useRef(false);
  const hasShownUpdateReadyNotification = useRef(false);
  const protocolHandlerRef = useRef(null);

  useEffect(() => {
    const loadIconPath = async () => {
      try {
        const data = await window.electron.getAssetPath("icon.png");
        if (data) {
          setIconData(data);
        }
      } catch (error) {
        console.error("Failed to load icon:", error);
      }
    };
    loadIconPath();
  }, []);

  const ensureMinLoadingTime = () => {
    const currentTime = Date.now();
    const elapsedTime = currentTime - loadStartTime.current;
    const minLoadingTime = 1000;

    if (elapsedTime < minLoadingTime) {
      return new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
    }
    return Promise.resolve();
  };

  const checkWelcomeStatus = async () => {
    try {
      console.log("Checking welcome status...");
      const isNew = await window.electron.isNew();
      console.log("Is new install:", isNew);
      const isV7 = await window.electron.isV7();
      console.log("Is V7:", isV7);

      setIsNewInstall(isNew);
      setShowWelcome(isNew || !isV7);

      console.log("Welcome check:", { isNew, isV7, shouldShow: isNew || !isV7 });
      return { isNew, isV7 };
    } catch (error) {
      console.error("Error checking welcome status:", error);
      setShowWelcome(false);
      return null;
    } finally {
      await ensureMinLoadingTime();
      setIsLoading(false);
    }
  };

  const checkAndSetWelcomeStatus = async () => {
    const hasLaunched = await window.electron.hasLaunched();
    if (!hasLaunched) {
      const data = await checkWelcomeStatus();
      setWelcomeData(data);
      // Update launch count since this is the first launch
      const launchCount = await window.electron.updateLaunchCount();
      if (launchCount === 5) {
        setTimeout(() => {
          setShowSupportDialog(true);
        }, 4000);
      }
    } else {
      const isV7 = await window.electron.isV7();
      setShowWelcome(!isV7);
      setWelcomeData({ isNew: false, isV7 });
    }
    return hasLaunched;
  };

  const [welcomeData, setWelcomeData] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      if (hasChecked.current) return;
      hasChecked.current = true;

      console.log("Starting app initialization...");

      try {
        // Set up game protocol URL listener
        const handleGameProtocol = async (event, { imageId }) => {
          console.log("Received game protocol URL with imageId:", imageId);
          if (!imageId) {
            console.error("No imageId received in game protocol URL");
            return;
          }

          try {
            // Clean the imageId by removing any query parameters or slashes
            const cleanImageId = imageId.replace(/[?/]/g, "");
            console.log("Looking up game with cleaned imageId:", cleanImageId);

            // Find the game using the efficient lookup service
            const game = await gameService.findGameByImageId(cleanImageId);
            console.log("Found game:", game);

            if (!game) {
              toast.error("Game not found", {
                description: "The requested game could not be found.",
              });
              return;
            }

            console.log("Navigating to download page with game:", game.game);
            // Navigate to the download page with the game data in the expected format
            navigate("/download", {
              replace: true, // Use replace to avoid browser back button issues
              state: {
                gameData: {
                  ...game, // Pass all game data directly
                  download_links: game.download_links || {}, // Ensure download_links exists
                },
              },
            });
          } catch (error) {
            console.error("Error handling game protocol:", error);
            toast.error("Error", {
              description: "Failed to load game information.",
            });
          }
        };

        // Store the handler in the ref so we can access it in cleanup
        protocolHandlerRef.current = handleGameProtocol;

        // Register the protocol listener using the ipcRenderer from preload
        window.electron.ipcRenderer.on("protocol-game-url", protocolHandlerRef.current);

        // Check if we're forcing a loading screen from settings
        const forceLoading = localStorage.getItem("forceLoading");
        if (forceLoading) {
          localStorage.removeItem("forceLoading");
          await ensureMinLoadingTime();
          setIsLoading(false);
          return;
        }

        // Check if we're forcing the installing screen from settings
        const forceInstalling = localStorage.getItem("forceInstalling");
        if (forceInstalling) {
          localStorage.removeItem("forceInstalling");
          setIsInstalling(true);
          setTimeout(() => {
            setIsInstalling(false);
            window.location.reload();
          }, 2000);
          return;
        }

        // Check if we're finishing up from settings
        const finishingUp = localStorage.getItem("finishingUp");
        if (finishingUp) {
          localStorage.removeItem("finishingUp");
          setTimeout(async () => {
            await window.electron.setTimestampValue("isUpdating", false);
            await window.electron.deleteInstaller();
            setIsUpdating(false);
            window.location.reload();
          }, 2000);
          return;
        }

        // Check if we're finishing up an update
        const isUpdatingValue = await window.electron.getTimestampValue("isUpdating");
        setIsUpdating(isUpdatingValue);

        if (isUpdatingValue) {
          // Clear the updating flag after a delay
          setTimeout(async () => {
            await window.electron.setTimestampValue("isUpdating", false);
            setIsUpdating(false);
            setIsLoading(false);
            await checkAndSetWelcomeStatus();
            const version = await window.electron.getVersion();
            toast(t("app.toasts.justUpdated"), {
              description: t("app.toasts.justUpdatedDesc", { version }),
              action: {
                label: t("app.toasts.viewChangelog"),
                onClick: () => window.electron.openURL("https://ascendara.app/changelog"),
              },
              duration: 10000,
              id: "update-completed",
            });
          }, 2000);
          return;
        }

        const hasLaunched = await checkAndSetWelcomeStatus();

        if (hasLaunched) {
          await ensureMinLoadingTime();
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error in app initialization:", error);
        await ensureMinLoadingTime();
        setIsLoading(false);
        setShowWelcome(false);
      }
    };

    initializeApp();

    // Cleanup function to ensure loading states are reset and listeners are removed
    return () => {
      setIsLoading(false);
      setIsUpdating(false);
      setIsInstalling(false);
      if (protocolHandlerRef.current) {
        window.electron.ipcRenderer.removeListener(
          "protocol-game-url",
          protocolHandlerRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    // Remove the initial loader once React is ready
    if (!isLoading && !isUpdating && !isInstalling) {
      const loader = document.getElementById("initial-loader");
      if (loader) {
        loader.style.transition = "opacity 0.3s";
        loader.style.opacity = "0";
        setTimeout(() => {
          loader.style.display = "none";
        }, 300);
      }
    }
  }, [isLoading, isUpdating, isInstalling]);

  const handleWelcomeComplete = async (withTour = false) => {
    setWelcomeData({ isNew: false, isV7: true });
    setShowWelcome(false);

    if (withTour) {
      navigate("/?tour=true", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  useEffect(() => {
    const checkPlatform = async () => {
      const hasLaunched = await window.electron.hasLaunched();
      console.log("Has launched:", hasLaunched);
      if (!hasLaunched) {
        const isWindows = await window.electron.isOnWindows();
        if (!isWindows) {
          setShowPlatformWarning(true);
        }
      }
    };
    checkPlatform();
  }, []);

  const handleInstallAndRestart = async () => {
    setIsInstalling(true);
    // Set isUpdating timestamp first
    await window.electron.setTimestampValue("isUpdating", true);
    setTimeout(() => {
      setIsUpdating(true);
      window.electron.updateAscendara();
    }, 1000);
  };

  useEffect(() => {
    console.log("State update:", {
      isLoading,
      showWelcome,
      isNewInstall,
      welcomeData,
    });
  }, [isLoading, showWelcome, isNewInstall, welcomeData]);
  console.log("AppRoutes render - Current state:", {
    showWelcome,
    location: location?.pathname,
    isLoading,
  });

  // Version check effect
  useEffect(() => {
    if (showWelcome) return;
    let isSubscribed = true;

    const checkVersionAndSetupUpdates = async () => {
      try {
        const settings = await window.electron.getSettings();
        const isLatestVersion = await checkForUpdates();

        if (
          !isLatestVersion &&
          !hasShownUpdateNotification.current &&
          !settings.autoUpdate
        ) {
          hasShownUpdateNotification.current = true;
          toast(t("app.toasts.outOfDate"), {
            description: t("app.toasts.outOfDateDesc"),
            action: {
              label: t("app.toasts.updateNow"),
              onClick: () => window.electron.openURL("https://ascendara.app/"),
            },
            duration: 10000,
            id: "update-available",
          });
        }
      } catch (error) {
        console.error("Error checking version:", error);
      }
    };

    const updateReadyHandler = () => {
      if (!isSubscribed || hasShownUpdateReadyNotification.current) return;

      hasShownUpdateReadyNotification.current = true;
      toast(t("app.toasts.updateReady"), {
        description: t("app.toasts.updateReadyDesc"),
        action: {
          label: t("app.toasts.installAndRestart"),
          onClick: handleInstallAndRestart,
        },
        duration: Infinity,
        id: "update-ready",
      });
    };

    checkVersionAndSetupUpdates();

    // Check if update is already downloaded
    window.electron.isUpdateDownloaded().then(isDownloaded => {
      if (isDownloaded) {
        updateReadyHandler();
      }
    });

    window.electron.onUpdateReady(updateReadyHandler);

    return () => {
      isSubscribed = false;
      window.electron.removeUpdateReadyListener(updateReadyHandler);
    };
  }, [showWelcome]);

  if (isInstalling) {
    return <UpdateOverlay />;
  }

  if (isLoading || isUpdating) {
    console.log("Rendering loading screen...");
    return (
      <motion.div
        className="loading-container"
        initial={{ opacity: 1 }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #fff0f3 0%, #ffffff 100%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
        }}
      >
        <motion.img
          src={iconData}
          alt="Loading"
          style={{ width: "128px", height: "128px" }}
          animate={{
            scale: [0.95, 1, 0.95],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </motion.div>
    );
  }

  if (showWelcome === null) {
    console.log("Rendering null - showWelcome is null");
    return null;
  }

  if (location.pathname === "/welcome" && !showWelcome) {
    console.log("Redirecting from welcome to home");
    return <Navigate to="/" replace />;
  }

  if (location.pathname === "/" && showWelcome) {
    console.log("Redirecting from home to welcome");
    return <Navigate to="/welcome" replace />;
  }

  console.log("Rendering main routes with location:", location.pathname);

  return (
    <>
      <MenuBar />
      {showWelcome ? (
        <Routes>
          <Route path="/extralanguages" element={<ExtraLanguages />} />
          <Route
            path="*"
            element={
              <Welcome
                isNewInstall={isNewInstall}
                welcomeData={welcomeData}
                onComplete={handleWelcomeComplete}
              />
            }
          />
        </Routes>
      ) : (
        <Routes location={location}>
          <Route path="/" element={<Layout />}>
            <Route
              index
              element={
                <AnimatePresence mode="wait">
                  <Home key="home" />
                </AnimatePresence>
              }
            />
            <Route
              path="search"
              element={
                <AnimatePresence mode="wait">
                  <Search key="search" />
                </AnimatePresence>
              }
            />
            <Route
              path="library"
              element={
                <AnimatePresence mode="wait">
                  <Library key="library" />
                </AnimatePresence>
              }
            />
            <Route
              path="downloads"
              element={
                <AnimatePresence mode="wait">
                  <Downloads key="downloads" />
                </AnimatePresence>
              }
            />
            <Route
              path="settings"
              element={
                <AnimatePresence mode="wait">
                  <Settings key="settings" />
                </AnimatePresence>
              }
            />
            <Route
              path="dependencies"
              element={
                <AnimatePresence mode="wait">
                  <Dependencies key="dependencies" />
                </AnimatePresence>
              }
            />
            <Route
              path="download"
              element={
                <AnimatePresence mode="wait">
                  <DownloadPage key="download" />
                </AnimatePresence>
              }
            />
            <Route
              path="extralanguages"
              element={
                <AnimatePresence mode="wait">
                  <ExtraLanguages key="extralanguages" />
                </AnimatePresence>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
      {showSupportDialog && <SupportDialog onClose={() => setShowSupportDialog(false)} />}
      {showPlatformWarning && (
        <PlatformWarningDialog onClose={() => setShowPlatformWarning(false)} />
      )}
    </>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Track error with analytics
    analytics.trackError(error, {
      componentStack: errorInfo.componentStack,
      severity: "fatal",
      componentName: this.constructor.name,
      previousRoute: this.props.location?.state?.from,
      userFlow: this.props.location?.state?.flow,
      props: JSON.stringify(this.props, (key, value) => {
        // Avoid circular references and sensitive data
        if (key === "children" || typeof value === "function") return "[Redacted]";
        return value;
      }),
      state: JSON.stringify(this.state),
      customData: {
        renderPhase: "componentDidCatch",
        reactVersion: React.version,
        lastRender: Date.now(),
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md space-y-4 text-center">
            <h2 className="text-2xl font-bold text-primary">
              {i18n.t("app.crashScreen.title")}
            </h2>
            <p className="text-muted-foreground">
              {i18n.t("app.crashScreen.description")}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-primary-foreground text-secondary-foreground inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              {i18n.t("app.crashScreen.reload")}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function ToasterWithTheme() {
  const { theme } = useTheme();

  return (
    <Toaster
      position="top-right"
      className="!border-border !bg-card !text-card-foreground"
      toastOptions={{
        style: {
          background: "rgb(var(--color-card))",
          color: "rgb(var(--color-card-foreground))",
          border: "1px solid rgb(var(--color-border))",
          padding: "16px",
        },
        descriptionStyle: {
          color: "rgb(var(--color-muted-foreground))",
        },
        actionButtonStyle: {
          background: "rgb(var(--color-primary))",
          color: "rgb(var(--color-primary-foreground))",
          border: "none",
        },
        actionButtonHoverStyle: {
          background: "rgb(var(--color-primary))",
          opacity: 0.8,
        },
        cancelButtonStyle: {
          background: "rgb(var(--color-muted))",
          color: "rgb(var(--color-muted-foreground))",
          border: "none",
        },
        cancelButtonHoverStyle: {
          background: "rgb(var(--color-muted))",
          opacity: 0.8,
        },
      }}
    />
  );
}

function App() {
  useEffect(() => {
    const checkUpdates = async () => {
      const hasUpdate = await checkForUpdates();
    };

    checkUpdates();
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      * {
        -webkit-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      
      input, textarea {
        -webkit-user-select: text;
        -ms-user-select: text;
        user-select: text;
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    const updateScrollbarStyle = () => {
      const sideScrollBar = localStorage.getItem("sideScrollBar") === "true";
      if (sideScrollBar) {
        document.documentElement.classList.add("custom-scrollbar");
      } else {
        document.documentElement.classList.remove("custom-scrollbar");
      }
    };

    // Initial setup
    updateScrollbarStyle();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <Router>
            <ToasterWithTheme />
            <ContextMenu />
            <ScrollToTop />
            <AnimatePresence mode="wait">
              <AppRoutes />
            </AnimatePresence>
          </Router>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
