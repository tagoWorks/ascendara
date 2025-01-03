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
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

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
      lastChecked: null,
      downServices: []
    };
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [iconData, setIconData] = useState('');
  const [isLatest, setIsLatest] = useState(true);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);

  useEffect(() => {
    const checkLatestVersion = async () => {
      const latest = await window.electron.isLatest();
      setIsLatest(latest);
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
    let isSubscribed = true;
    
    const checkStatus = async () => {
      try {
        const status = await checkServerStatus();
        if (isSubscribed) {
          const newStatus = {
            isHealthy: status.isHealthy,
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
      <div className="flex-1 px-3 flex items-center h-full">
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
          <div className={`w-1.5 h-1.5 rounded-full ${
            serverStatus.isHealthy 
              ? 'bg-green-500 hover:bg-green-600' 
              : 'bg-red-500 animate-pulse hover:bg-red-600'
          }`} />
        </div>
          {!isLatest && (
            <div className="flex items-center ml-2">
              
                {isDownloadingUpdate ? (
                  <>
                  <span className="text-[14px] px-1 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
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

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent className="max-w-md bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-foreground">
              <div className={`w-2.5 h-2.5 rounded-full ${
                serverStatus.isHealthy ? 'bg-green-500' : 'bg-red-500 animate-pulse'
              }`} />
              {t('server-status.title')}
            </AlertDialogTitle>
            
            <AlertDialogDescription className="sr-only">
              {t('server-status.description')}
            </AlertDialogDescription>
            
            <div className="mt-4 space-y-4">
              {/* Status Card */}
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
            <AlertDialogCancel className="bg-card/50 hover:bg-card text-foreground border-0">
              {t('common.close')}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MenuBar;