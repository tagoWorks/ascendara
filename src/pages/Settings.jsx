import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ShieldAlert, Languages, Zap, Loader, Hand, RefreshCw, CircleAlert, CircleCheck, AlertCircle } from "lucide-react";
import gameService from '../services/gameService';
import { useNavigate } from 'react-router-dom';

const themes = [
  // Light themes
  { id: 'light', name: 'Arctic Sky', group: 'light' },
  { id: 'blue', name: 'Ocean Blue', group: 'light' },
  { id: 'purple', name: 'Ascendara Purple', group: 'light' },
  { id: 'emerald', name: 'Emerald', group: 'light' },
  { id: 'rose', name: 'Rose', group: 'light' },
  { id: 'amber', name: 'Amber Sand', group: 'light' },
  
  // Dark themes
  { id: 'dark', name: 'Dark Blue', group: 'dark' },
  { id: 'midnight', name: 'Midnight', group: 'dark' },
  { id: 'cyberpunk', name: 'Cyberpunk', group: 'dark' },
  { id: 'sunset', name: 'Sunset', group: 'dark' },
  { id: 'forest', name: 'Forest', group: 'dark' },
  { id: 'ocean', name: 'Deep Ocean', group: 'dark' },
];

const languages = [
    { id: 'en', name: 'English', icon: '🇺🇸' },
    { id: 'es', name: 'Español', icon: '🇪🇸' },
    { id: 'zh-CN', name: '中文', icon: '🇨🇳' },
    { id: 'ar', name: 'العربية', icon: '🇸🇦' },
    { id: 'hi', name: 'हिन्दी', icon: '🇮🇳' },
    { id: 'bn', name: 'বাংলা', icon: '🇧🇩' },
    { id: 'pt', name: 'Português', icon: '🇵🇹' },
    { id: 'ru', name: 'Русский', icon: '🇷🇺' },
    { id: 'ja', name: '日本語', icon: '🇯🇵' },
  ];


const getThemeColors = (themeId) => {
  const themeMap = {
    light: {
      bg: 'bg-white',
      primary: 'bg-blue-500',
      secondary: 'bg-slate-100',
      text: 'text-slate-900'
    },
    dark: {
      bg: 'bg-slate-900',
      primary: 'bg-blue-500',
      secondary: 'bg-slate-800',
      text: 'text-slate-100'
    },
    blue: {
      bg: 'bg-blue-50',
      primary: 'bg-blue-600',
      secondary: 'bg-blue-100',
      text: 'text-blue-900'
    },
    purple: {
      bg: 'bg-purple-50',
      primary: 'bg-purple-500',
      secondary: 'bg-purple-100',
      text: 'text-purple-900'
    },
    emerald: {
      bg: 'bg-emerald-50',
      primary: 'bg-emerald-500',
      secondary: 'bg-emerald-100',
      text: 'text-emerald-900'
    },
    rose: {
      bg: 'bg-rose-50',
      primary: 'bg-rose-500',
      secondary: 'bg-rose-100',
      text: 'text-rose-900'
    },
    cyberpunk: {
      bg: 'bg-gray-900',
      primary: 'bg-pink-500',
      secondary: 'bg-gray-800',
      text: 'text-pink-500'
    },
    sunset: {
      bg: 'bg-slate-800',
      primary: 'bg-orange-500',
      secondary: 'bg-slate-700',
      text: 'text-orange-400'
    },
    forest: {
      bg: 'bg-[#141E1B]',
      primary: 'bg-green-500',
      secondary: 'bg-[#1C2623]',
      text: 'text-green-300'
    },
    midnight: {
      bg: 'bg-[#020617]',
      primary: 'bg-indigo-400',
      secondary: 'bg-slate-800',
      text: 'text-indigo-200'
    },
    amber: {
      bg: 'bg-amber-50',
      primary: 'bg-amber-600',
      secondary: 'bg-amber-100',
      text: 'text-amber-900'
    },
    ocean: {
      bg: 'bg-slate-900',
      primary: 'bg-cyan-400',
      secondary: 'bg-slate-800',
      text: 'text-cyan-100'
    }
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
  const navigate = useNavigate();
  const [downloadPath, setDownloadPath] = useState('');
  const [canCreateFiles, setCanCreateFiles] = useState(true);
  const [version, setVersion] = useState('');
  const [isDownloaderRunning, setIsDownloaderRunning] = useState(false);
  const [settings, setSettings] = useState({
    downloadDirectory: '',
    viewOldDownloadLinks: false,
    seeInappropriateContent: false,
    autoCreateShortcuts: true,
    sendAnalytics: true,
    autoUpdate: true,
    language: 'en',
    theme: 'purple',
    threadCount: 4,
  });
  
  // Track if settings have been initialized
  const [isInitialized, setIsInitialized] = useState(false);
  const initialSettingsRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use a ref to track if this is the first mount
  const isFirstMount = useRef(true);

  // Create a debounced save function to prevent too frequent saves
  const debouncedSave = useMemo(
    () => createDebouncedFunction((newSettings) => {
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
          return downloadingData && (
            downloadingData.downloading ||
            downloadingData.extracting ||
            downloadingData.updating ||
            downloadingData.error
          );
        });
        setIsDownloaderRunning(hasDownloadingGames);
      } catch (error) {
        console.error('Error checking downloading games:', error);
      }
    };

    // Check immediately
    checkDownloaderStatus();

    // Then check every second
    const interval = setInterval(checkDownloaderStatus, 1000);

    // Cleanup interval on unmount
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

        // Get version
        const ver = await window.electron.getVersion();
        if (ver) {
          setVersion(ver);
        }

        setIsInitialized(true);
        isFirstMount.current = false;
      } catch (error) {
        console.error('Error initializing settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, []); // Run only once on mount

  const handleSettingChange = useCallback((setting) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        ...setting
      };
      return newSettings;
    });
  }, []);

  const handleDirectorySelect = useCallback(async () => {
    try {
      const directory = await window.electron.openDirectoryDialog();
      if (directory) {
        const canCreateFiles = await window.electron.canCreateFiles(directory);
        setCanCreateFiles(canCreateFiles);
        if (!canCreateFiles) {
          return;
        } else {
          if (canCreateFiles) {
            setCanCreateFiles(true);
          }
        }
        setDownloadPath(directory);
        // Update settings with new directory and trigger immediate save
        const newSettings = {
          ...settings,
          downloadDirectory: directory
        };
        setSettings(newSettings);
        // Immediately save the settings using the correct method name
        await window.electron.saveSettings(newSettings, directory);
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  }, [settings]);

  const handleLanguageChange = useCallback((value) => {
    // Ensure value is a string
    const languageValue = String(value);
    setSettings(prev => {
      const newSettings = {
        ...prev,
        language: languageValue
      };
      return newSettings;
    });
    // Use changeLanguage from the context
    changeLanguage(languageValue);
  }, [changeLanguage]);

  // Theme handling
  const handleThemeChange = useCallback((newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('ascendara-theme', newTheme);
  }, [setTheme]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('ascendara-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, [setTheme]);

  useEffect(() => {
    if (theme && isInitialized) {
      handleSettingChange({ theme });
    }
  }, [theme, isInitialized]);

  const groupedThemes = {
    light: themes.filter(t => t.group === 'light'),
    dark: themes.filter(t => t.group === 'dark')
  };

  const [isDev, setIsDev] = useState(false);

  // Check if in development mode
  useEffect(() => {
    const checkDevMode = async () => {
      const isDevMode = await window.electron.isDev();
      setIsDev(isDevMode);
    };
    checkDevMode();
  }, []);

  const [currentScreen, setCurrentScreen] = useState('none');
  const [isTriggering, setIsTriggering] = useState(false);

  // Function to trigger selected screen
  const triggerScreen = async () => {
    setIsTriggering(true);
    try {
      switch (currentScreen) {
        case 'updating':
          // Set installing flag to show UpdateOverlay
          localStorage.setItem('forceInstalling', 'true');
          window.location.reload();
          break;
          
        case 'loading':
          // Set loading state and reload
          localStorage.setItem('forceLoading', 'true');
          window.location.reload();
          break;
          
        case 'crashscreen':
          // Simulate a crash by throwing an error
          throw new Error('Intentional crash for testing');
          
        case 'finishingup':
          // Set the updating timestamp to show finishing up screen
          await window.electron.setTimestampValue('isUpdating', true);
          window.location.reload();
          break;
      }
    } catch (error) {
      console.error('Error triggering screen:', error);
      if (currentScreen === 'crashscreen') {
        // For crash screen, we want to propagate the error
        throw error;
      }
    } finally {
      setIsTriggering(false);
    }
  };

  const [apiMetadata, setApiMetadata] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const data = await gameService.getAllGames();
        setApiMetadata(data.metadata);
      } catch (error) {
        console.error('Error fetching metadata:', error);
      }
    };
    fetchMetadata();
  }, []);

  const handleRefreshIndex = async () => {
    setIsRefreshing(true);
    try {
      const lastModified = await gameService.checkMetadataUpdate();
      if (lastModified) {
        const freshData = await gameService.getAllGames();
        setApiMetadata(freshData.metadata);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };

  const [dependencyStatus, setDependencyStatus] = useState(null);
  
  // Check dependency status on mount and after reinstall
  const checkDependencies = useCallback(async () => {
    try {
      const status = await window.electron.checkGameDependencies();
      setDependencyStatus(status);
    } catch (error) {
      console.error('Failed to check dependencies:', error);
    }
  }, []);

  useEffect(() => {
    checkDependencies();
  }, [checkDependencies]);

  // Get dependency status indicator
  const getDependencyStatusInfo = useMemo(() => {
    if (!dependencyStatus) {
      return {
        icon: <CircleAlert className="w-5 h-5 text-muted-foreground" />,
        text: t('settings.checkingDependencies'),
        color: 'text-muted-foreground'
      };
    }

    const installedCount = dependencyStatus.filter(dep => dep.installed).length;
    const totalCount = dependencyStatus.length;

    if (installedCount === totalCount) {
      return {
        icon: <CircleCheck className="w-5 h-5 text-green-500" />,
        text: t('settings.allDependenciesInstalled'),
        color: 'text-green-500'
      };
    } else if (installedCount === 0) {
      return {
        icon: <AlertCircle className="w-5 h-5 text-red-500" />,
        text: t('settings.noDependenciesInstalled'),
        color: 'text-red-500'
      };
    } else {
      return {
        icon: <AlertCircle className="w-5 h-5 text-yellow-500" />,
        text: t('settings.someDependenciesMissing', { installed: installedCount, total: totalCount }),
        color: 'text-yellow-500'
      };
    }
  }, [dependencyStatus, t]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold text-primary">{t('settings.title')}</h1>
          <Separator orientation="vertical" className="h-8" />
          <p className="text-muted-foreground">{t('settings.configure')}</p>
          <div onClick={() => window.electron.openURL('https://ascendara.app/changelog')} className="ml-auto flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <span>Version {version}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Core Settings */}
          <div className="lg:col-span-8 space-y-6">
            {/* General Settings Card */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-primary">{t('settings.general')}</h2>
              <div className="space-y-6">
                <div className="space-y-4">

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('settings.autoCreateShortcuts')}</Label>
                      <p className="text-sm text-muted-foreground">{t('settings.autoCreateShortcutsDescription')}</p>
                    </div>
                    <Switch
                      checked={settings.autoCreateShortcuts}
                      onCheckedChange={() => handleSettingChange({ autoCreateShortcuts: !settings.autoCreateShortcuts })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('settings.ascendaraUpdates')}</Label>
                      <p className="text-sm text-muted-foreground">{t('settings.ascendaraUpdatesDescription')}</p>
                    </div>
                    <Switch
                      checked={settings.autoUpdate}
                      onCheckedChange={() => handleSettingChange({ autoUpdate: !settings.autoUpdate })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('settings.matureContent')}</Label>
                      <p className="text-sm text-muted-foreground">{t('settings.matureContentDescription')}</p>
                    </div>
                    <Switch
                      checked={settings.seeInappropriateContent}
                      onCheckedChange={() => handleSettingChange({ seeInappropriateContent: !settings.seeInappropriateContent })}
                    />
                  </div>
                  
                  <div>
                    {isDownloaderRunning && (
                      <div className="mt-2 mb-4 flex items-center gap-2 text-red-600 dark:text-red-500 p-2 rounded-md border border-red-400 bg-red-50">
                        <CircleAlert size={14} />
                        <p className="text-sm">
                          {t('settings.downloaderRunningWarning')}
                        </p>
                      </div>
                    )}
                    <Label
                      htmlFor="downloadPath"
                      className={isDownloaderRunning ? 'opacity-50' : ''}
                    >
                      {t('settings.downloadLocation')}
                    </Label>
                    {!canCreateFiles && (
                      <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                        <ShieldAlert size={18} />
                        <p className="text-sm font-medium">
                          {t('settings.downloadLocationWarning')}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Input 
                        id="downloadPath"
                        disabled={isDownloaderRunning}
                        value={downloadPath}
                        readOnly
                        className="flex-1"
                      />
                      <Button disabled={isDownloaderRunning} className="text-secondary" onClick={handleDirectorySelect}>
                        {t('settings.selectDirectory')}
                      </Button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <Label
                      htmlFor="downloadThreads"
                      className={isDownloaderRunning ? 'opacity-50' : ''}
                    >
                      {t('settings.downloadThreads')}
                    </Label>
                    <Select
                      disabled={isDownloaderRunning}
                      value={settings.threadCount === 0 ? 'custom' : (settings.threadCount || 4).toString()}
                      onValueChange={(value) => {
                        const threadCount = value === 'custom' ? 0 : parseInt(value);
                        setSettings(prev => ({
                          ...prev,
                          threadCount: threadCount
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">{t('settings.downloadThreadsPresets.low')}</SelectItem>
                        <SelectItem value="4">{t('settings.downloadThreadsPresets.normal')}</SelectItem>
                        <SelectItem value="8">{t('settings.downloadThreadsPresets.high')}</SelectItem>
                        <SelectItem value="12">{t('settings.downloadThreadsPresets.veryHigh')}</SelectItem>
                        <SelectItem value="16">{t('settings.downloadThreadsPresets.extreme')}</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Custom thread count input */}
                    {settings.threadCount === 0 && (
                      <div className="mt-4">
                        <Label>{t('settings.customThreadCount')}</Label>
                        <Input
                          type="number"
                          min="1"
                          max="32"
                          value={4}
                          onChange={(e) => {
                            const value = Math.max(1, Math.min(32, parseInt(e.target.value) || 1));
                            setSettings(prev => ({
                              ...prev,
                              threadCount: value
                            }));
                          }}
                          className="mt-1"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          {t('settings.customThreadCountDesc')}
                        </p>
                      </div>
                    )}
                    {settings.threadCount > 8 && (
                      <div className="mt-2 flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                        <CircleAlert size={14} />
                        <p className="text-sm">
                          {t('settings.highThreadWarning', 'High thread counts may cause download issues. Use with caution.')}
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </Card>

            {/* Game Sources Card */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-primary">{t('settings.gameSources')}</h2>
              <p className="text-sm text-muted-foreground mb-6">{t('settings.gameSourcesDescription')}</p>
              
              <div className="space-y-6">
                {/* Source Status Section */}
                <div>
                  <h3 className="text-sm font-medium mb-3">{t('settings.sourceStatus')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{t('settings.sourceStatusDescription')}</p>
                  
                  <div className="space-y-4">
                    {/* SteamRip Status */}
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label className="font-medium">SteamRip</Label>
                          <Badge variant="success" className="text-xs">{t('settings.sourceActive')}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{t('settings.steamripDescription')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          className="whitespace-nowrap"
                          size="sm"
                          onClick={() => window.electron.openURL('https://ascendara.app/sources/steamrip')}
                        >
                          {t('common.learnMore')}
                        </Button>
                      </div>
                    </div>

                  </div>
                </div>

                <Separator />

                {/* Source Information */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium">{t('settings.sourceInfo')}</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshIndex}
                      disabled={isRefreshing}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      {isRefreshing ? t('search.refreshingIndex') : t('search.refreshIndex')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t('settings.lastUpdated')}</Label>
                      <p className="text-sm font-medium">{apiMetadata?.getDate || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t('settings.totalGames')}</Label>
                      <p className="text-sm font-medium">{apiMetadata?.games?.toLocaleString() || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Theme Settings Card */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-primary">{t('settings.theme')}</h2>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">{t('settings.lightThemes')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {groupedThemes.light.map((t) => (
                      <ThemeButton key={t.id} theme={t} currentTheme={theme} onSelect={handleThemeChange} />
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">{t('settings.darkThemes')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {groupedThemes.dark.map((t) => (
                      <ThemeButton key={t.id} theme={t} currentTheme={theme} onSelect={handleThemeChange} />
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Additional Settings */}
          <div className="lg:col-span-4 space-y-6">
            {/* Analytics Card */}
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-primary">{t('settings.ascendaraAnalytics')}</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>{t('settings.ascendaraToggleAnalytics')}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t('settings.ascendaraAnalyticsDescription')} {" "}
                          <a 
                            className="text-primary cursor-pointer hover:underline" 
                            onClick={() => window.electron.openURL('https://ascendara.app/analytics')} 
                          >
                            {t('common.learnMore')}
                          </a>
                        </p>
                      </div>
                      <Switch
                        checked={settings.sendAnalytics}
                        onCheckedChange={() => handleSettingChange({ sendAnalytics: !settings.sendAnalytics })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Language Settings Card */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-primary">{t('settings.languageSettings')}</h2>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Languages className="w-5 h-5 text-primary" />
                    <p className="text-sm text-muted-foreground">{t('settings.languageSettingsDescription')}</p>
                  </div>
                  <Select
                    value={settings.language}
                    onValueChange={handleLanguageChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <span>{languages.find(l => l.id === settings.language)?.icon}</span>
                          <span>{languages.find(l => l.id === settings.language)?.name}</span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.id} value={lang.id}>
                          <div className="flex items-center gap-2">
                            <span>{lang.icon}</span>
                            <span>{lang.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.languageSetNote')}
                  </p>
                </div>
              </div>
            </Card>

            {/* Install Game Dependencies Card */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-primary">{t('settings.installGameDependencies')}</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                    {getDependencyStatusInfo.icon}
                    <span className={`text-sm ${getDependencyStatusInfo.color}`}>
                      {getDependencyStatusInfo.text}
                    </span>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {t('settings.reinstallDependenciesDesc')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={() => navigate('/dependencies')}
                      className="text-secondary w-full flex items-center gap-2"
                    >
                      {t('settings.manageDependencies')}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Developer Settings Card - Only shown in development mode */}
            {isDev && (
              <Card className="p-6">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold mb-4 text-primary flex items-center gap-2">
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
                        onClick={() => window.electron.openGameDirectory('local')}
                      >
                        Open Local Directory
                      </Button>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label>Screen Trigger</Label>
                      <div className="flex gap-2">
                        <Select 
                          value={currentScreen} 
                          onValueChange={(value) => setCurrentScreen(value)}
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
                          disabled={currentScreen === 'none' || isTriggering}
                          variant="secondary"
                        >
                          {isTriggering ? (
                            <div className="flex items-center gap-2">
                              <Loader className="h-4 w-4 animate-spin" />
                              Triggering...
                            </div>
                          ) : (
                            'Trigger Screen'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Notice Card */}
            <Card className="p-6 border-yellow-500/50 bg-yellow-500/5">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-yellow-500">
                  <Hand className="w-5 h-5 scale-x-[-1]" />
                  <h2 className="text-lg font-semibold mb-0">{t('settings.warningTitle')}</h2>
                </div>
                
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('settings.warningDescription')}
                </p>
                
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('settings.warningSupportDevelopers')}
                </p>

                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                  <span>{t('settings.warningSupportDevelopersCallToAction')}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeButton({ theme, currentTheme, onSelect }) {
  const colors = getThemeColors(theme.id);
  
  return (
    <button
      onClick={() => onSelect(theme.id)}
      className={`group relative overflow-hidden rounded-xl transition-all ${
        currentTheme === theme.id 
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' 
          : 'hover:ring-1 hover:ring-primary/50'
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
      
      <div className={`absolute bottom-0 left-0 right-0 p-3 
        ${colors.bg} bg-opacity-80 backdrop-blur-sm`}>
        <div className="flex items-center justify-between">
          <span className={`font-medium ${colors.text}`}>{theme.name}</span>
          <div className={`w-3 h-3 rounded-full ${colors.primary}`} />
        </div>
      </div>
    </button>
  );
}

export default Settings;