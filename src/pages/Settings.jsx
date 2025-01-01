import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { CircleAlert, Languages, Zap } from "lucide-react";

const themes = [
  // Light themes
  { id: 'light', name: 'Arctic Sky', group: 'light' },
  { id: 'blue', name: 'Ocean Blue', group: 'light' },
  { id: 'purple', name: 'Royal Purple', group: 'light' },
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
  const [downloadPath, setDownloadPath] = useState('');
  const [version, setVersion] = useState('');
  const [settings, setSettings] = useState({
    seamlessDownloads: true,
    checkVersionOnLaunch: true,
    viewOldDownloadLinks: false,
    seeInappropriateContent: false,
    sendAnalytics: true,
    autoUpdate: true,
    notifications: true,
    primaryGameSource: 'steamrip',
    language: 'en',
    enabledSources: {
      steamrip: true,
      steamunlocked: false,
      fitgirlrepacks: false,
    }
  });
  
  // Track if settings have been initialized
  const [isInitialized, setIsInitialized] = useState(false);
  const initialSettingsRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use a ref to track if this is the first mount
  const isFirstMount = useRef(true);

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

  // Create debounced save function
  const debouncedSave = useMemo(() => {
    return createDebouncedFunction(async (settingsToSave, pathToSave) => {
      try {
        await window.electron.saveSettings(settingsToSave, pathToSave);
        // Update the reference after successful save
        initialSettingsRef.current = {
          ...settingsToSave,
          downloadDirectory: pathToSave
        };
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    }, 1000);
  }, []); // Empty deps array since this should only be created once

  // Save settings only when they actually change
  useEffect(() => {
    if (!isInitialized || !initialSettingsRef.current) return;

    // Check if settings actually changed
    const settingsWithoutDownloadDir = { ...settings };
    delete settingsWithoutDownloadDir.downloadDirectory;
    
    const initialWithoutDownloadDir = { ...initialSettingsRef.current };
    delete initialWithoutDownloadDir.downloadDirectory;

    const hasSettingsChanged = JSON.stringify(settingsWithoutDownloadDir) !== JSON.stringify(initialWithoutDownloadDir);
    const hasDownloadPathChanged = downloadPath !== initialSettingsRef.current.downloadDirectory;

    if (!hasSettingsChanged && !hasDownloadPathChanged) {
      return;
    }

    // Trigger debounced save with current settings and download path
    debouncedSave({
      ...settings,
      downloadDirectory: downloadPath
    }, downloadPath);

    // Cleanup function
    return () => {
      debouncedSave.cancel();
    };
  }, [settings, downloadPath, isInitialized, debouncedSave]);

  const handleSettingChange = useCallback((setting) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        [setting]: !prev[setting]
      };
      return newSettings;
    });
  }, []);

  const handleDirectorySelect = useCallback(async () => {
    try {
      const directory = await window.electron.openDirectoryDialog();
      if (directory) {
        setDownloadPath(directory);
        // Update settings with new directory
        setSettings(prev => ({
          ...prev,
          downloadDirectory: directory
        }));
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
    }
  }, []);

  const handleSourceToggle = useCallback((source) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        enabledSources: {
          ...prev.enabledSources,
          [source]: !prev.enabledSources[source]
        }
      };
      return newSettings;
    });
  }, []);

  const handleAscendaraSettingChange = useCallback((setting, value) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        ascendaraSettings: {
          ...prev.ascendaraSettings,
          [setting]: value
        }
      };
      return newSettings;
    });
  }, []);

  const handlePrimarySourceChange = useCallback((value) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        primaryGameSource: value
      };
      return newSettings;
    });
  }, []);

  const handleLanguageChange = useCallback((value) => {
    setSettings(prev => {
      const newSettings = {
        ...prev,
        language: value
      };
      return newSettings;
    });
    // Use changeLanguage from the context
    changeLanguage(value);
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

  const groupedThemes = {
    light: themes.filter(t => t.group === 'light'),
    dark: themes.filter(t => t.group === 'dark')
  };

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
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <span>Version {version}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - General Settings */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="p-6 h-fit">
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-primary">{t('settings.general')}</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>{t('settings.ascendaraUpdates')}</Label>
                        <p className="text-sm text-muted-foreground">{t('settings.ascendaraUpdatesDescription')}</p>
                      </div>
                      <Switch
                        checked={settings.autoUpdate}
                        onCheckedChange={() => handleSettingChange('autoUpdate')}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label> 
                          <span className="flex items-center gap-1">
                            {t('settings.seamlessDownloads')} <Zap size={12} />
                          </span>
                        </Label>
                        <p className="text-sm text-muted-foreground">{t('settings.seamlessDownloadsDescription')}</p>
                      </div>
                      <Switch
                        checked={settings.seamlessDownloads}
                        onCheckedChange={() => handleSettingChange('seamlessDownloads')}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>{t('settings.matureContent')}</Label>
                        <p className="text-sm text-muted-foreground">{t('settings.matureContentDescription')}</p>
                      </div>
                      <Switch
                        checked={settings.seeInappropriateContent}
                        onCheckedChange={() => handleSettingChange('seeInappropriateContent')}
                      />
                    </div>
                  </div>
                  
    

                  <div className="mt-4">
                      <Label htmlFor="downloadPath">{t('settings.downloadLocation')}</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="downloadPath"
                          value={downloadPath}
                          readOnly
                          className="flex-1"
                        />
                        <Button className="text-secondary" onClick={handleDirectorySelect}>{t('settings.selectDirectory')}</Button>
                      </div>
                    </div>

                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-4 text-primary">{t('settings.ascendaraAnalytics')}</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>{t('settings.ascendaraToggleAnalytics')}</Label>
                        <p className="text-sm text-muted-foreground">{t('settings.ascendaraAnalyticsDescription')} {" "}
                          <a className="text-primary cursor-pointer hover:underline" onClick={() => window.electron.openURL('https://ascendara.app/analytics')} target="_blank" rel="noopener noreferrer">
                            {t('common.learnMore')}
                          </a>
                        </p>
                      </div>
                      <Switch
                        checked={settings.sendAnalytics}
                        onCheckedChange={() => handleSettingChange('sendAnalytics')}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-4 text-primary">{t('settings.quickLinks')}</h2>
                  <div className="grid gap-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-muted-foreground hover:text-primary hover:bg-secondary"
                      onClick={() => window.electron.openURL('https://ascendara.app/privacy')}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                        {t('settings.privacyPolicy')}
                      </span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-muted-foreground hover:text-primary hover:bg-secondary"
                      onClick={() => window.electron.openURL('https://ascendara.app/terms')}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                        {t('settings.termsOfService')}
                      </span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-muted-foreground hover:text-primary hover:bg-secondary"
                      onClick={() => window.electron.openURL('https://ascendara.app/dmca')}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                        {t('settings.dmca')}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Warning Card */}
            <Card className="p-6 border-yellow-500/50 bg-yellow-500/5">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-yellow-500">
                  <CircleAlert className="w-5 h-5" />
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

          {/* Right Column - Game Sources and Theme */}
          <div className="lg:col-span-8 space-y-6">
            {/* Game Sources Card */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-primary">{t('settings.gameSources')}</h2>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('settings.primarySource')}</Label>
                      <p className="text-sm text-muted-foreground">{t('settings.primarySourceDescription')}</p>
                    </div>
                    <Select 
                      value={settings.primaryGameSource}
                      onValueChange={handlePrimarySourceChange}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t('settings.selectSource')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="steamrip">{t('settings.steamRip')}</SelectItem>
                        <SelectItem disabled value="steamunlocked">{t('settings.steamUnlocked')}</SelectItem>
                        <SelectItem disabled value="fitgirlrepacks">{t('settings.fitgirlRepacks')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">{t('settings.enabledSources')}</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>{t('settings.steamRip')}</Label>
                        <Switch
                          disabled
                          checked={settings.enabledSources.steamrip}
                          onCheckedChange={() => handleSourceToggle('steamrip')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>{t('settings.steamUnlocked')}</Label>
                        <Switch
                          disabled
                          checked={settings.enabledSources.steamunlocked}
                          onCheckedChange={() => handleSourceToggle('steamunlocked')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>{t('settings.fitgirlRepacks')}</Label>
                        <Switch
                          disabled
                          checked={settings.enabledSources.fitgirlrepacks}
                          onCheckedChange={() => handleSourceToggle('fitgirlrepacks')}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">{t('settings.ascendaraSettings')}</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>{t('settings.downloadServer')}</Label>
                          <p className="text-sm text-muted-foreground">{t('settings.downloadServerDescription')}</p>
                        </div>
                        <Select disabled>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={t('settings.usEast')} />
                          </SelectTrigger>
                        </Select>
                      </div>
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
                    <SelectTrigger className="w-full max-w-xs">
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
                </div>
              </div>
            </Card>

            {/* Theme Card */}
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