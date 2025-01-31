import React, { useState, useEffect } from 'react';
import { checkServerStatus } from '../services/serverStatus';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogFooter,
} from './ui/alert-dialog';
import { AlertTriangle, WifiOff, Hammer, X, Minus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { checkForUpdates } from '../services/updateCheckingService';

const MenuBar = () => {
  const { t } = useLanguage();
  const [serverStatus, setServerStatus] = useState(() => {
    // Try to load cached status from localStorage
    const cached = localStorage.getItem('serverStatus');
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed;
    }
    // Default status if no valid cache exists
    return { 
      isHealthy: true,
      isOffline: false,
      lastChecked: null,
      downServices: []
    };
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [iconData, setIconData] = useState('');
  const [isLatest, setIsLatest] = useState(true);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Check for dev mode
  useEffect(() => {
    const checkDevMode = async () => {
      const isDevMode = await window.electron.isDev();
      setIsDev(isDevMode);
    };
    checkDevMode();
  }, []);

  useEffect(() => {
    const checkLatestVersion = async () => {
      const isLatestVersion = await checkForUpdates();
      setIsLatest(isLatestVersion);
    };
    checkLatestVersion();

    let initialTimeout;
    let interval;

    // Only set up the update checking if the app is outdated
    if (!isLatest) {
      // Check timestamp file for downloading status
      const checkDownloadStatus = async () => {
        try {
          const timestamp = await window.electron.getTimestampValue('downloadingUpdate');
          setIsDownloadingUpdate(timestamp || false);
        } catch (error) {
          console.error('Failed to read timestamp file:', error);
        }
      };
      
      // Initial delay before first check
      initialTimeout = setTimeout(checkDownloadStatus, 1000);
      
      // Set up interval for subsequent checks
      interval = setInterval(checkDownloadStatus, 1000);
    }
    
    return () => {
      if (initialTimeout) clearTimeout(initialTimeout);
      if (interval) clearInterval(interval);
    };
  }, [isLatest]);

  useEffect(() => {
    const handleDownloadProgress = (event, progress) => {
      setDownloadProgress(progress);
    };
    
    window.electron.ipcRenderer.on('update-download-progress', handleDownloadProgress);
    
    return () => {
      window.electron.ipcRenderer.removeListener('update-download-progress', handleDownloadProgress);
    };
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    
    const checkStatus = async () => {
      try {
        const status = await checkServerStatus();
        if (isSubscribed) {
          const newStatus = {
            isHealthy: status.isHealthy,
            isOffline: status.isOffline,
            lastChecked: new Date().toISOString(),
            downServices: status.downServices
          };
          setServerStatus(newStatus);
          localStorage.setItem('serverStatus', JSON.stringify(newStatus));
        }
      } catch (error) {
        console.warn('Failed to check server status:', error);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 300000); // 5 minutes
    
    return () => {
      isSubscribed = false; 
      clearInterval(interval);
    };
  }, []);

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

  const handleStatusClick = () => {
    setIsDialogOpen(true);
  };

  const formatLastChecked = (date) => {
    if (!date) return '';
    const now = new Date();
    const checkDate = typeof date === 'string' ? new Date(date) : date;
    const diff = Math.floor((now - checkDate) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div 
      className="fixed h-10 flex items-center select-none z-50 w-full"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex-1 px-3 flex items-center h-full mt-2 ml-0.5">
        <div className="flex items-center">
          {iconData && (
            <img 
              src={iconData} 
              alt="Ascendara" 
              className="w-6 h-6 mr-2"
            />
          )}
          <span className="text-sm font-medium">Ascendara</span>
        </div>
        
        <div 
          className="ml-1.5 cursor-pointer flex items-center gap-1"
          onClick={handleStatusClick}
          title={t('server-status.title')}
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          {serverStatus.isOffline ? (
            <WifiOff className="w-4 h-4 text-red-500" />
          ) : (
            <div className={`w-1.5 h-1.5 rounded-full ${
              serverStatus.isHealthy 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-red-500 animate-pulse hover:bg-red-600'
            }`} />
          )}
        </div>
        
        {isDev && (
              <span className="text-[14px] ml-2 px-1 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1">
                <Hammer className="w-3 h-3" />
                {t('app.runningInDev')}
              </span>
            )}
            
        {!isLatest && (
          <div className="flex items-center ml-2 gap-2">
            {isDownloadingUpdate ? (
              <>
              <span className="text-[14px] px-1 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1">
                <div className="relative w-4 h-4">
                  {/* Track circle */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle 
                      cx="8" 
                      cy="8" 
                      r="6" 
                      fill="none" 
                      strokeWidth="3"
                      className="stroke-green-500/20" 
                    />
                    {/* Progress circle */}
                    <circle 
                      cx="8" 
                      cy="8" 
                      r="6" 
                      fill="none" 
                      strokeWidth="3"
                      className="stroke-green-500" 
                      strokeDasharray={`${downloadProgress * 0.377} 100`}
                    />
                  </svg>
                </div>
                {t('app.downloading-update')}
              </span>
              </>
            ) : (
              <>
              <span className="text-[14px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {t('app.outdated')}
              </span>
              </>
            )}
          </div>
        )}
        <div className="flex-1" />
      </div>
      <div className="window-controls flex items-center mr-2">
        <button
          onClick={() => window.electron.minimizeWindow()}
          className="p-1 hover:bg-gray-200 rounded"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => window.electron.closeWindow()}
          className="p-1 hover:bg-red-500 hover:text-white rounded ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent className="max-w-md bg-background">
          <AlertDialogHeader>
            <div className="fixed top-2 right-2 cursor-pointer p-2" onClick={() => setIsDialogOpen(false)}>
              <X className="w-4 h-4" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold text-foreground">
              {serverStatus.isOffline ? t('server-status.offline') : t('server-status.title')}
            </AlertDialogTitle>
            
            <AlertDialogDescription className="sr-only">
              {t('server-status.description')}
            </AlertDialogDescription>
            
            <div className="mt-4 space-y-4">
              {/* Status Card */}
              {serverStatus.isOffline ? (
                <div className="p-4 rounded-lg border bg-red-500/5 border-red-500/20">
                  <div className="flex items-center gap-3">
                    <WifiOff className="w-8 h-8 text-red-500" />
                    <div>
                      <h3 className="font-semibold text-foreground">{t('server-status.no-internet')}</h3>
                      <p className="text-sm text-muted-foreground">{t('server-status.check-connection')}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`p-4 rounded-lg border ${
                  serverStatus.isHealthy 
                    ? 'bg-green-500/5 border-green-500/20' 
                    : 'bg-red-500/5 border-red-500/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">
                      {serverStatus.isHealthy ? t('server-status.healthy') : t('server-status.unhealthy')}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t('server-status.last-checked')} {formatLastChecked(serverStatus.lastChecked)}
                    </span>
                  </div>
                  <p className="text-sm mt-2 text-muted-foreground">
                    {serverStatus.isHealthy 
                      ? t('server-status.healthy-description')
                      : (
                        <div>
                          {t('server-status.unhealthy-description')}
                          <ul className="mt-2 space-y-2">
                            {serverStatus.downServices?.map(service => (
                              <li key={service} className="flex items-start">
                                <span className="w-2.5 h-2.5 mt-1.5 rounded-full bg-red-500 mr-2" />
                                <div>
                                  <span className="font-medium">{service === 'lfs' ? service.toUpperCase() : service.charAt(0).toUpperCase() + service.slice(1)} Server</span>
                                  <p className="text-xs text-muted-foreground">
                                    {service === 'api' && t('server-status.api-description')}
                                    {service === 'storage' && t('server-status.storage-description')}
                                    {service === 'lfs' && t('server-status.lfs-description')}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )} 
                  </p>
                </div>
              )}
              {/* Status Page Link */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card/30">
                <span className="text-sm text-muted-foreground">{t('server-status.need-more-details')}</span>
                <button 
                  onClick={() => window.electron.openURL('https://status.ascendara.app')}
                  className="text-sm text-foreground hover:underline flex items-center gap-1" 
                >
                  {t('server-status.visit-status-page')}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MenuBar;