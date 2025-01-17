import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import Welcome from './pages/Welcome';
import DownloadPage from './pages/Download';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from './contexts/ThemeContext';
import './Index.css';
import { Toaster, toast } from 'sonner';
import { Loader } from 'lucide-react';
import UpdateOverlay from './components/UpdateOverlay';
import { analytics } from './services/analyticsService'
import ContextMenu from './components/ContextMenu';
import './components/ContextMenu.css';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import enTranslations from './translations/en-original.json';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
    analytics.trackPageView(pathname);
  }, [pathname]);
  
  return null;
};

const AppRoutes = () => {
  const { t, i18n } = useTranslation();
  const [shouldShowWelcome, setShouldShowWelcome] = useState(null);
  const [isNewInstall, setIsNewInstall] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [iconData, setIconData] = useState('');
  const location = useLocation();
  const hasChecked = useRef(false);
  const navigate = useNavigate();
  const loadStartTime = useRef(Date.now());
  const hasShownUpdateNotification = useRef(false);
  const hasShownUpdateReadyNotification = useRef(false);

  useEffect(() => {
    const loadIconPath = async () => {
      try {
        const data = await window.electron.getAssetPath('icon.png');
        if (data) {
          setIconData(data);
        }
      } catch (error) {
        console.error('Failed to load icon:', error);
      }
    };
    loadIconPath();
  }, []);

  const ensureMinLoadingTime = () => {
    const currentTime = Date.now();
    const elapsedTime = currentTime - loadStartTime.current;
    const minLoadingTime = 1000;
    
    if (elapsedTime < minLoadingTime) {
      return new Promise(resolve => 
        setTimeout(resolve, minLoadingTime - elapsedTime)
      );
    }
    return Promise.resolve();
  };

  const checkWelcomeStatus = async () => {
    try {
      console.log('Checking welcome status...');
      const isNew = await window.electron.isNew();
      console.log('Is new install:', isNew);
      const isV7 = await window.electron.isV7();
      console.log('Is V7:', isV7);
      
      setIsNewInstall(isNew);
      setShouldShowWelcome(isNew || !isV7);
      
      console.log('Welcome check:', { isNew, isV7, shouldShow: isNew || !isV7 });
      return { isNew, isV7 };
    } catch (error) {
      console.error('Error checking welcome status:', error);
      setShouldShowWelcome(false);
      return null;
    } finally {
      await ensureMinLoadingTime();
      setIsLoading(false);
    }
  };

  const [welcomeData, setWelcomeData] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      if (hasChecked.current) return;
      hasChecked.current = true;

      console.log('Starting app initialization...');

      try {
        // Check if we're forcing a loading screen from settings
        const forceLoading = localStorage.getItem('forceLoading');
        if (forceLoading) {
          localStorage.removeItem('forceLoading');
          await ensureMinLoadingTime();
          setIsLoading(false);
          return;
        }

        // Check if we're forcing the installing screen from settings
        const forceInstalling = localStorage.getItem('forceInstalling');
        if (forceInstalling) {
          localStorage.removeItem('forceInstalling');
          setIsInstalling(true);
          setTimeout(() => {
            setIsInstalling(false);
            window.location.reload();
          }, 2000);
          return;
        }

        // Check if we're finishing up from settings
        const finishingUp = localStorage.getItem('finishingUp');
        if (finishingUp) {
          localStorage.removeItem('finishingUp');
          setTimeout(async () => {
            await window.electron.setTimestampValue('isUpdating', false);
            await window.electron.deleteInstaller();
            setIsUpdating(false);
            window.location.reload();
          }, 2000);
          return;
        }

        // Check if we're finishing up an update
        const isUpdatingValue = await window.electron.getTimestampValue('isUpdating');
        setIsUpdating(isUpdatingValue);

        if (isUpdatingValue) {
          // Clear the updating flag after a delay
          setTimeout(async () => {
            await window.electron.setTimestampValue('isUpdating', false);
            setIsUpdating(false);
            setIsLoading(false);
            const hasLaunched = await window.electron.hasLaunched();
            if (!hasLaunched) {
              const data = await checkWelcomeStatus();
              setWelcomeData(data);
            } else {
              const isV7 = await window.electron.isV7();
              setShouldShowWelcome(!isV7);
              setWelcomeData({ isNew: false, isV7 });
            }
            const version = await window.electron.getVersion();
            toast(t('app.toasts.justUpdated'), {
              description: t('app.toasts.justUpdatedDesc', { version }),
              action: {
                label: t('app.toasts.viewChangelog'),
                onClick: () => window.electron.openURL('https://ascendara.app/changelog')
              },
              duration: 10000,
              id: 'update-completed'
            });
          }, 2000);
          return;
        }

        const hasLaunched = await window.electron.hasLaunched();
        console.log('Has launched check:', hasLaunched);

        if (!hasLaunched) {
          console.log('First launch - checking welcome status...');
          const data = await checkWelcomeStatus();
          console.log('Welcome status data:', data);
          setWelcomeData(data);
        } else {
          console.log('Not first launch - checking v7 status...');
          const isV7 = await window.electron.isV7();
          console.log('Is V7:', isV7);
          setShouldShowWelcome(!isV7);
          setWelcomeData({ isNew: false, isV7 });
          await ensureMinLoadingTime();
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error in app initialization:', error);
        await ensureMinLoadingTime();
        setIsLoading(false);
        setShouldShowWelcome(false);
      }
    };

    initializeApp();

    // Cleanup function to ensure loading states are reset if component unmounts
    return () => {
      setIsLoading(false);
      setIsUpdating(false);
      setIsInstalling(false);
    };
  }, []);

  const handleWelcomeComplete = async (withTour = false) => {
    setWelcomeData({ isNew: false, isV7: true });
    setShouldShowWelcome(false);
    
    if (withTour) {
      navigate('/?tour=true', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleInstallAndRestart = async () => {
    setIsInstalling(true);
    // Set isUpdating timestamp first
    await window.electron.setTimestampValue('isUpdating', true);
    setTimeout(() => {
      setIsUpdating(true);
      window.electron.updateAscendara();
    }, 1000);
  };

  useEffect(() => {
    console.log('State update:', {
      isLoading,
      shouldShowWelcome,
      isNewInstall,
      welcomeData
    });
  }, [isLoading, shouldShowWelcome, isNewInstall, welcomeData]);
  console.log('AppRoutes render - Current state:', {
    shouldShowWelcome,
    location: location?.pathname,
    isLoading
  });

  // Version check effect
  useEffect(() => {
    if (shouldShowWelcome) return;
    let isSubscribed = true;

    const checkVersionAndSetupUpdates = async () => {
      try {
        const settings = await window.electron.getSettings();
        const isLatest = await window.electron.isLatest();
        
        if (!isLatest && !settings.autoUpdate && !hasShownUpdateNotification.current) {
          hasShownUpdateNotification.current = true;
          toast(t('app.toasts.outOfDate'), {
            description: t('app.toasts.outOfDateDesc'),
            action: {
              label: t('app.toasts.updateNow'),
              onClick: () => window.electron.openURL('https://ascendara.app/')
            },
            duration: 10000,
            id: 'update-available'
          });
        }
      } catch (error) {
        console.error('Error checking version:', error);
      }
    };

    const updateReadyHandler = () => {
      if (!isSubscribed || hasShownUpdateReadyNotification.current) return;
      
      hasShownUpdateReadyNotification.current = true;
      toast(t('app.toasts.updateReady'), {
        description: t('app.toasts.updateReadyDesc'),
        action: {
          label: t('app.toasts.installAndRestart'),
          onClick: handleInstallAndRestart
        },
        duration: Infinity,
        id: 'update-ready'
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
  }, [shouldShowWelcome]);

  if (isLoading || isUpdating || isInstalling) {
    console.log('Rendering loading screen...');
    return (
      <motion.div 
        className="loading-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {iconData && (
          <motion.img 
            src={iconData}
            alt="Loading"
            className="loading-icon"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ 
              duration: 0.5,
              ease: "easeOut"
            }}
          />
        )}
        {isInstalling && <UpdateOverlay />}
        {isUpdating && (
          <><motion.div 
            className="loading-text"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {t('app.loading.finishingUpdate')}
          </motion.div>
          <br />
          <Loader className="animate-spin" /></>
        )}
      </motion.div>
    );
  }

  if (shouldShowWelcome === null) {
    console.log('Rendering null - shouldShowWelcome is null');
    return null;
  }

  if (location.pathname === '/welcome' && !shouldShowWelcome) {
    console.log('Redirecting from welcome to home');
    return <Navigate to="/" replace />;
  }

  if (location.pathname === '/' && shouldShowWelcome) {
    console.log('Redirecting from home to welcome');
    return <Navigate to="/welcome" replace />;
  }

  console.log('Rendering main routes with location:', location.pathname);
  
  return (
    <motion.div className="app-container">
      <ScrollToTop />
      <Routes>
        <Route 
          path="/welcome" 
          element={
            <AnimatePresence mode="wait">
              <Welcome 
                welcomeData={welcomeData} 
                onComplete={handleWelcomeComplete}
              />
            </AnimatePresence>
          } 
        />
        <Route path="/" element={<Layout />}>
          <Route index element={
            <AnimatePresence mode="wait">
              <Home />
            </AnimatePresence>
          } />
          <Route path="search" element={<Search />} />
          <Route path="library" element={<Library />} />
          <Route path="downloads" element={<Downloads />} />
          <Route path="settings" element={<Settings />} />
          <Route path="download" element={<DownloadPage />} />
        </Route>
      </Routes>
    </motion.div>
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
      severity: 'fatal',
      componentName: this.constructor.name,
      previousRoute: this.props.location?.state?.from,
      userFlow: this.props.location?.state?.flow,
      props: JSON.stringify(this.props, (key, value) => {
        // Avoid circular references and sensitive data
        if (key === 'children' || typeof value === 'function') return '[Redacted]';
        return value;
      }),
      state: JSON.stringify(this.state),
      customData: {
        renderPhase: 'componentDidCatch',
        reactVersion: React.version,
        lastRender: Date.now()
      }
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4 text-center">
            <h2 className="text-2xl font-bold text-primary">{i18n.t('app.crashScreen.title')}</h2>
            <p className="text-muted-foreground">
              {i18n.t('app.crashScreen.description')}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 text-secondary-foreground"
            >
              {i18n.t('app.crashScreen.reload')}
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
      className="!bg-card !text-card-foreground !border-border"
      toastOptions={{
        style: {
          background: 'rgb(var(--color-card))',
          color: 'rgb(var(--color-card-foreground))',
          border: '1px solid rgb(var(--color-border))',
          padding: '16px',
        },
        descriptionStyle: {
          color: 'rgb(var(--color-muted-foreground))'
        },
        actionButtonStyle: {
          background: 'rgb(var(--color-primary))',
          color: 'rgb(var(--color-primary-foreground))',
          border: 'none',
        },
        actionButtonHoverStyle: {
          background: 'rgb(var(--color-primary))',
          opacity: 0.8,
        },
        cancelButtonStyle: {
          background: 'rgb(var(--color-muted))',
          color: 'rgb(var(--color-muted-foreground))',
          border: 'none',
        },
        cancelButtonHoverStyle: {
          background: 'rgb(var(--color-muted))',
          opacity: 0.8,
        }
      }}
    />
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <Router>
            <ToasterWithTheme />
            <ContextMenu />
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
