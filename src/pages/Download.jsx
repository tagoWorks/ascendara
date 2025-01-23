import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from "../components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogCancel } from "../components/ui/alert-dialog";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Loader, InfoIcon, CopyIcon, CheckIcon, BadgeCheckIcon, TriangleAlert, ArrowBigLeft, ExternalLink, MessageSquareWarning, CircleSlash } from "lucide-react";
import imageCacheService from '../services/imageCacheService';
import { toast } from "sonner";
import { useLanguage } from '../contexts/LanguageContext';
import { sanitizeText } from '../lib/utils';

const isValidURL = (url, provider) => {
  const trimmedUrl = url.trim();
  if (trimmedUrl === '') {
    return true;
  }

  let pattern;

  switch (provider.toLowerCase()) {
    case 'megadb':
      pattern = /^(https?:\/\/)([^\/?#]+)(?::(\d+))?(\/[^?#]*\/[^?#]*\/)([^?#]+)\.(?:zip|rar|7z)$/i;
      break;
    case 'datanodes':
      pattern = /^https:\/\/node\d+\.datanodes\.to(?::\d+)?\/d\/[a-z0-9]+\/.*\.(?:zip|rar|7z)$/i;
      break;
    case 'qiwi':
      pattern = /^https:\/\/(spyderrock\.com\/[a-zA-Z0-9]+-[\w\s.-]+\.rar)$/i;
      break;
    case 'buzzheavier':
      pattern = /^https:\/\/buzzheavier\.com\/dl\/[A-Za-z0-9_-]+(?:\?.*)?$/i;
      break;
    case 'gofile':
      pattern = /^https:\/\/store\d*\.gofile\.io\/download\/web\/[a-f0-9-]+\/[\w\s\.-]+\.(?:zip|rar|7z)$/i;
      break;
    default:
      return false;
  }

  const match = pattern.test(trimmedUrl);
  if (!match) {
    return false;
  }

  const domainRegex = new RegExp(provider, 'i');
  const containsProviderName = domainRegex.test(trimmedUrl);

  return containsProviderName;
};

const VERIFIED_PROVIDERS = ['megadb', 'gofile', 'datanodes', 'buzzheavier', 'qiwi']; 

const sanitizeGameName = (name) => {
  return sanitizeText(name); 
};

export default function DownloadPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { gameData } = state || {};
  const { t } = useLanguage();
  
  // State declarations
  const [selectedProvider, setSelectedProvider] = useState("");
  const [inputLink, setInputLink] = useState("");
  const [isStartingDownload, setIsStartingDownload] = useState(false);
  const [useAscendara, setUseAscendara] = useState(false);
  const [showNoDownloadPath, setShowNoDownloadPath] = useState(false);
  const [cachedImage, setCachedImage] = useState(null);
  const [isValidLink, setIsValidLink] = useState(true);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [showNewUserGuide, setShowNewUserGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [guideImages, setGuideImages] = useState({});
  const [settings, setSettings] = useState({ downloadHandler: false });

  // Refs for URL tracking
  const recentUrlsRef = useRef(new Map());
  const isProcessingUrlRef = useRef(false);

  // Define handleDownload first since it's used in handleProtocolUrl
  const handleDownload = useCallback(async (directUrl = null) => {

    if (showNoDownloadPath) {
      return;
    }
  
    if (!gameData) {
      console.error('No game data available');
      toast.error(t('download.toast.noGameData'));
      return;
    }
  
    if (selectedProvider !== 'gofile' && !isValidLink && !directUrl) {
      return;
    }

    if (isStartingDownload) {
      console.log('Download already in progress, skipping');
      return;
    }
    setIsStartingDownload(true);
    try {
      const sanitizedGameName = sanitizeText(gameData.game);
      const urlToUse = directUrl || inputLink;
      
      console.log('Starting download with URL:', urlToUse);
      await window.electron.downloadFile(
        urlToUse,
        sanitizedGameName,
        gameData.online,
        gameData.dlc,
        gameData.version,
        gameData.imgID,
        gameData.size
      );
      
      toast.success(t('download.toast.downloadStarted'));
      
      // Add a delay before navigation to ensure the download has started
      // and the toast is visible
      setTimeout(() => {
        setIsStartingDownload(false);
        navigate('/downloads');
      }, 1000);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(t('download.toast.downloadFailed'));
      setIsStartingDownload(false);
    }

  }, [showNoDownloadPath, gameData, selectedProvider, isValidLink, inputLink, navigate, t, isStartingDownload]);

  // Then define handleProtocolUrl which depends on handleDownload
  const handleProtocolUrl = useCallback(async (event, url) => {
    if (!url || isProcessingUrlRef.current) return;
    
    // Check if this URL was recently processed (within last 10 seconds)
    const now = Date.now();
    const lastProcessed = recentUrlsRef.current.get(url);
    if (lastProcessed && (now - lastProcessed) < 10000) {
      console.log('URL was recently processed, skipping:', url);
      return;
    }
    
    // Set processing flag
    isProcessingUrlRef.current = true;
    
    try {
      console.log('1. Protocol handler received URL:', url);
      
      // Add URL to recent list with timestamp
      recentUrlsRef.current.set(url, now);
      
      // Clean up old entries from recentUrls
      for (const [key, timestamp] of recentUrlsRef.current.entries()) {
        if (now - timestamp > 10000) {
          recentUrlsRef.current.delete(key);
        }
      }

      // First remove the ascendara:// protocol
      let downloadUrl = url.replace(/^ascendara:\/+/i, '');
      
      // Remove the trailing "/" if it exists
      if (downloadUrl.endsWith('/')) {
        downloadUrl = downloadUrl.slice(0, -1);
      }
      
      // URL decode the remaining string
      downloadUrl = decodeURIComponent(downloadUrl);
      
      // Now the URL should be in a normal http/https format
      // Validate it's a proper URL
      const urlObj = new URL(downloadUrl);
      
      console.log('2. Final URL to download:', downloadUrl);
      
      await handleDownload(downloadUrl);
    } catch (e) {
      console.error('Error processing URL:', e);
      toast.error(t('download.toast.invalidUrl'));
    } finally {
      // Clear processing flag after a short delay to prevent race conditions
      setTimeout(() => {
        isProcessingUrlRef.current = false;
      }, 1000);
    }
  }, [handleDownload, t]);

  // Set up protocol handler
  useEffect(() => {
    window.electron.ipcRenderer.on('protocol-download-url', handleProtocolUrl);
    return () => {
      window.electron.ipcRenderer.removeListener('protocol-download-url', handleProtocolUrl);
    };
  }, [handleProtocolUrl]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      recentUrlsRef.current.clear();
      isProcessingUrlRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadFileFromPath = async (path) => {
      try {
        const data = await window.electron.getAssetPath(path);
        if (data) {
          setGuideImages(prev => ({
            ...prev,
            [path]: data
          }));
        }
      } catch (error) {
        console.error('Failed to load:', error);
      }
    };

    const guideImagePaths = [
      '/guide/guide-off.png',
      '/guide/guide-on.png',
      '/guide/guide-start.png',
      '/guide/guide-alwaysopen.png',
      '/guide/guide-open.png',
      '/guide/guide-downloads.png'
    ];

    guideImagePaths.forEach(path => loadFileFromPath(path));
  }, []);

  useEffect(() => {
    // Load initial settings
    const loadSettings = async () => {
      try {
        const savedSettings = await window.electron.getSettings();
        if (savedSettings) {
          setSettings(savedSettings);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);
  
  const guideSteps = [
    {
      title: t('download.newUserGuide.steps.0.title'),
      description: (
        <div>
          <p>{t('download.newUserGuide.steps.0.description')}</p>
          <p className="text-muted-foreground">
            {t('download.newUserGuide.steps.0.note')}
          </p>
        </div>
      )
    },
    {
      title: t('download.newUserGuide.steps.1.title'),
      description: t('download.newUserGuide.steps.1.description'),
      image: guideImages['/guide/guide-off.png']
    },
    {
      title: t('download.newUserGuide.steps.2.title'),
      description: t('download.newUserGuide.steps.2.description'),
      image: guideImages['/guide/guide-on.png']
    },
    {
      title: t('download.newUserGuide.steps.3.title'),
      description: t('download.newUserGuide.steps.3.description'),
      image: guideImages['/guide/guide-start.png']
    },
    {
      title: t('download.newUserGuide.steps.4.title'),
      description: t('download.newUserGuide.steps.4.description'),
      image: guideImages['/guide/guide-alwaysopen.png']
    },
    {
      title: t('download.newUserGuide.steps.5.title'),
      description: t('download.newUserGuide.steps.5.description'),
      image: guideImages['/guide/guide-open.png']
    },
    {
      title: t('download.newUserGuide.steps.6.title'),
      description: t('download.newUserGuide.steps.6.description'),
      image: guideImages['/guide/guide-downloads.png']
    }
  ];

  const handleStartGuide = () => {
    setGuideStep(1);
  };

  const handleNextStep = () => {
    if (guideStep < guideSteps.length) {
      setGuideStep(guideStep + 1);
    } else {
      const newSettings = { ...settings, downloadHandler: true };
      window.electron.saveSettings(newSettings)
        .then(() => {
          setSettings(newSettings);
          setShowNewUserGuide(false);
          setGuideStep(0);
        })
        .catch(error => {
          console.error('Failed to save settings:', error);
        });
    }
  };

  const handleCloseGuide = () => {
    setShowNewUserGuide(false);
    setGuideStep(0);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!gameData) {
      navigate('/search');
    } else {
      const loadCachedImage = async () => {
        const image = await imageCacheService.getImage(gameData.imgID);
        setCachedImage(image);
      };
      loadCachedImage();
    }
    checkDownloadPath();
  }, [gameData, navigate]);

  useEffect(() => {
    const savedPreference = localStorage.getItem('useAscendara');
    if (savedPreference !== null) {
      setUseAscendara(JSON.parse(savedPreference));
    }
  }, []);

  const checkDownloadPath = async () => {
    try {
      const settings = await window.electron.getSettings();
      if (!settings.downloadDirectory) {
        setShowNoDownloadPath(true);
      }
    } catch (error) {
      console.error('Error getting settings:', error);
    }
  };
  const handleInputChange = (e) => {
    const newLink = e.target.value;
    setInputLink(newLink);
    
    if (newLink.trim() === '') {
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
    document.body.style.overflow = 'hidden';

    return () => {
      // Re-enable scrolling when the component unmounts
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    if (gameData) {
      console.log('Game Data:', gameData);
      
      const downloadLinks = gameData.download_links || {};
      if (Object.keys(downloadLinks).length === 0) {
        console.log('No download providers available for:', gameData.game);
        return; // No providers available
      }
      
      // Log each provider and its links for debugging
      Object.entries(downloadLinks).forEach(([provider, links]) => {
        console.log(`Provider ${provider}:`, links);
      });

      const availableProviders = Object.entries(downloadLinks)
        .filter(([_, links]) => {
          if (!Array.isArray(links)) return false;
          if (links.length === 0) return false;
          return links.some(link => typeof link === 'string' && link.length > 0);
        })
        .map(([provider]) => provider);

      console.log('Filtered Available Providers:', availableProviders);
      
      if (!selectedProvider && availableProviders.includes('megadb')) {
        setSelectedProvider('megadb');
      }
    }
  }, [gameData, selectedProvider]);

  const checkIfNewUser = async () => {
    const settings = await window.electron.getSettings();
    if (!settings.downloadDirectory) {
      return true;
    }
    const games = await window.electron.getGames();
    return games.length === 0;
  };

  const handleCopyLink = async () => {
    let link = downloadLinks[selectedProvider][0].startsWith('//')
      ? `https:${downloadLinks[selectedProvider][0]}`
      : downloadLinks[selectedProvider][0];
    link = sanitizeText(link);
    await navigator.clipboard.writeText(link);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 1000);

    const isNewUser = await checkIfNewUser();
    if (isNewUser) {
      setShowNewUserGuide(true);
    }
  };

  const handleOpenInBrowser = async () => {
    let link = downloadLinks[selectedProvider][0].startsWith('//')
      ? `https:${downloadLinks[selectedProvider][0]}`
      : downloadLinks[selectedProvider][0];
    link = sanitizeText(link);
    window.electron.openURL(link);

    const isNewUser = await checkIfNewUser();
    if (isNewUser) {
      setShowNewUserGuide(true);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportReason || !reportDetails.trim()) {
      toast.error(t('download.reportError'));
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
            toast.success(t('download.toast.reportSubmitted'));
            setReportReason("");
            setReportDetails("");
            return;
          }
        }
        throw new Error("Failed to submit report");
      }

      toast.success(t('download.toast.reportSubmitted'));
      setReportReason("");
      setReportDetails("");
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error(t('download.toast.reportFailed'));
    } finally {
      setIsReporting(false);
    }
  };

  if (!gameData) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <AlertDialog variant="destructive">
          <AlertDialogDescription>
            {t('download.noGameData')}
          </AlertDialogDescription>
        </AlertDialog>
      </div>
    );
  }

  const downloadLinks = gameData?.download_links || {};
  const hasProviders = Object.keys(downloadLinks).length > 0;
  const providers = hasProviders ? Object.entries(downloadLinks)
    .filter(([_, links]) => {
      if (!Array.isArray(links)) return false;
      if (links.length === 0) return false;
      return links.some(link => typeof link === 'string' && link.length > 0);
    })
    .map(([provider]) => provider) : [];

  console.log('Final Available Providers:', providers);

  if (gameData && gameData.game) {
    gameData.game = sanitizeGameName(gameData.game);
  }

  return (
    <div className="container max-w-7xl mx-auto flex flex-col p-4 min-h-screen pt-24 fade-in" style={{ transform: 'scale(0.95)', transformOrigin: 'top center' }}>
      <div className="w-full max-w-6xl">
        <div className="flex flex-col gap-4">
          {/* Back Button */}
          <Button
            variant="ghost"
            className="w-fit"
            onClick={() => navigate(-1)}
          >
            <ArrowBigLeft size={16} className="mr-2 mt-0.5" /> {t('common.back')}
          </Button>

          {/* Game Header Section */}
          <div className="flex items-start gap-4">
            <img 
              src={cachedImage || `https://api.ascendara.app/v2/image/${gameData.imgID}`}
              alt={gameData.game}
              className="w-64 h-36 object-cover rounded-lg"
            />
            <div className="flex flex-col">
              <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">{gameData.game}</h1>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="fixed right-8" variant="outline" size="sm">
                      {t('download.reportBroken')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      handleSubmitReport();
                    }}>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-bold text-foreground">{t('download.reportBroken')}: {gameData.game}</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">{t('download.reportReason')}</label>
                            <Select
                              value={reportReason}
                              onValueChange={setReportReason}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('download.reportReasons.placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gamedetails">{t('download.reportReasons.gameDetails')}</SelectItem>
                                <SelectItem value="filesnotdownloading">{t('download.reportReasons.filesNotDownloading')}</SelectItem>
                                <SelectItem value="notagame">{t('download.reportReasons.notAGame')}</SelectItem>
                                <SelectItem value="linksnotworking">{t('download.reportReasons.linksNotWorking')}</SelectItem>
                                <SelectItem value="image-error">{t('download.reportReasons.imageError')}</SelectItem>
                                <SelectItem value="image-bad">{t('download.reportReasons.imageBad')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">{t('download.reportDescription')}</label>
                            <Textarea
                              placeholder={t('download.reportDescription')}
                              value={reportDetails}
                              onChange={(e) => setReportDetails(e.target.value)}
                              className="min-h-[100px]"
                            />
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      
                      <AlertDialogFooter className="gap-2 mt-4">
                        <AlertDialogCancel
                          onClick={() => {
                            setReportReason("");
                            setReportDetails("");
                          }}
                        >
                          {t('common.cancel')}
                        </AlertDialogCancel>
                        <Button
                          type="submit"
                          className="text-secondary"
                          disabled={isReporting}
                        >
                          {isReporting ? (
                            <>
                              <Loader className="mr-2 h-4 w-4 animate-spin" />
                              {t('download.submitting')}
                            </>
                          ) : (
                            t('download.submitReport')
                          )}
                        </Button>
                      </AlertDialogFooter>
                    </form>
                  </AlertDialogContent>
                </AlertDialog>

              </div>


              <div className="flex items-center gap-2">
                {gameData.emulator && (
                  <span className="text-sm bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded flex items-center">
                    <CircleSlash className="h-4 w-4 mr-1" /> {t('download.gameNeedsEmulator')}&nbsp;<a onClick={() => window.electron.openURL('https://ascendara.app/docs/troubleshooting/emulators')} className="hover:underline cursor-pointer">{t('common.learnMore')}</a>
                  </span>
                )}
                {gameData.category?.includes("Virtual Reality") && (
                  <span className="text-sm bg-purple-500/10 text-foreground px-2 py-0.5 rounded flex items-center">
                    <svg className="text-foreground p-0.5" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 10C2 8.89543 2.89543 8 4 8H20C21.1046 8 22 8.89543 22 10V17C22 18.1046 21.1046 19 20 19H16.1324C15.4299 19 14.7788 18.6314 14.4174 18.029L12.8575 15.4292C12.4691 14.7818 11.5309 14.7818 11.1425 15.4292L9.58261 18.029C9.22116 18.6314 8.57014 19 7.86762 19H4C2.89543 19 2 18.1046 2 17V10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M3.81253 6.7812C4.5544 5.6684 5.80332 5 7.14074 5H16.8593C18.1967 5 19.4456 5.6684 20.1875 6.7812L21 8H3L3.81253 6.7812Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                      <span className="ml-1text-foreground">&nbsp;{t('download.gameNeedsVR')}</span>
                  </span>
                )}
              </div>


              <div className="flex items-center mt-4 gap-2 mb-2">
                
                {gameData.version && (
                  <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                    {gameData.version}
                  </span>
                )}
                {gameData.online && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm bg-green-500/10 text-green-500 px-2 py-0.5 rounded flex items-center gap-1">
                          {t('download.online')}
                          <InfoIcon className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-secondary">{t('download.onlineTooltip')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {gameData.dlc && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded flex items-center gap-1">
                          {t('download.allDlc')}
                          <InfoIcon className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-secondary">{t('download.allDlcTooltip')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{t('download.size')}: {gameData.size}</p>
            </div>
          </div>

          {/* DMCA Notice Banner */}
          <div 
            className="w-full p-3 bg-primary/10 rounded-lg border border-primary/20 cursor-pointer hover:bg-primary/15 transition-colors"
            onClick={() => window.electron.openURL('https://ascendara.app/dmca')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">
                  {t('download.dmcaNotice')}
                </span>
              </div>
              <span className="text-sm text-primary hover:underline flex items-center gap-1">{t('common.learnMore')} <ExternalLink size={16} /></span>
            </div>
          </div>

          <Separator className="my-1" />

          {/* Download Options Section - Two columns with reduced spacing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column - Download Options */}
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-xl font-semibold">{t('download.downloadOptions.downloadOptions')}</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('download.downloadOptions.downloadSource')}</Label>
                    {providers.length > 0 ? (
                      <Select 
                        value={selectedProvider}
                        onValueChange={setSelectedProvider}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('download.downloadOptions.selectProvider')} />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border">
                          {providers.map((provider) => {
                            let displayName;
                            switch(provider.toLowerCase()) {
                              case 'gofile':
                                displayName = 'Seamless (GoFile)';
                                break;
                              case 'megadb':
                                displayName = 'Default (MegaDB)';
                                break;
                              case 'buzzheavier':
                                displayName = 'BuzzHeavier';
                                break;
                              case 'qiwi':
                                displayName = 'QIWI';
                                break;
                              case 'datanodes':
                                displayName = 'DataNodes';
                                break;
                              default:
                                displayName = provider.charAt(0).toUpperCase() + provider.slice(1);
                            }
                            const isVerified = VERIFIED_PROVIDERS.includes(provider.toLowerCase());
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
                      <p>{t('download.downloadOptions.noProviders')}</p>
                    )}
                  </div>

                  {selectedProvider && (
                    <div className="space-y-3">
                      <div>
                        <Label>{t('download.downloadOptions.downloadLink')}</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <div 
                            className="flex-1 bg-muted p-2 rounded-md text-sm flex items-center justify-between group cursor-pointer hover:bg-muted/80 transition-colors"
                            onClick={handleCopyLink}
                          >
                            <span>{downloadLinks[selectedProvider][0].startsWith('//') 
                              ? `https:${downloadLinks[selectedProvider][0]}` 
                              : downloadLinks[selectedProvider][0]}</span>
                            {showCopySuccess ? (
                              <CheckIcon className="h-4 w-4 text-green-500" />
                            ) : (
                              <CopyIcon className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                          <Button 
                            size="sm" 
                            onClick={handleOpenInBrowser} 
                            variant="outline"
                          >
                            {t('download.downloadOptions.openInBrowser')}
                          </Button>
                        </div>
                      </div>

                      {!useAscendara && selectedProvider !== 'gofile' && (
                        <div>
                          <Input
                            placeholder={t('download.downloadOptions.pasteLink')}
                            value={inputLink}
                            onChange={handleInputChange}
                            className={!isValidLink ? "border-red-500" : ""}
                          />
                          {!isValidLink && (
                            <p className="text-red-500 text-sm mt-1">
                              {t('download.downloadOptions.invalidLink')} {selectedProvider}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedProvider && selectedProvider !== "gofile" && (
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="ascendara-handler"
                          checked={useAscendara}
                          onCheckedChange={(checked) => {
                            setUseAscendara(checked);
                            localStorage.setItem('useAscendara', JSON.stringify(checked));
                          }}
                        />
                        <Label htmlFor="ascendara-handler" className="text-sm">
                          {t('download.downloadOptions.ascendaraHandler')}
                        </Label>
                      </div>
                      {!useAscendara && (
                        <p 
                          className="text-xs text-muted-foreground hover:underline cursor-pointer"
                          onClick={() => window.electron.openURL('https://ascendara.app/extension')}
                        >
                          {t('download.downloadOptions.getExtension')}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {selectedProvider && useAscendara && selectedProvider !== 'gofile' && (
                    <div className="flex items-center justify-center space-x-2 py-2 text-muted-foreground">
                      <Loader className="h-4 w-4 animate-spin" />
                      <span className="text-sm">
                        {isStartingDownload 
                          ? t('download.downloadOptions.startingDownload')
                          : t('download.downloadOptions.waitingForBrowser')
                        }
                      </span>
                    </div>
                  )}
                  
                  {(!useAscendara || selectedProvider === 'gofile') && (
                    <Button
                      onClick={() => handleDownload()}
                      disabled={isStartingDownload || !selectedProvider || (selectedProvider !== 'gofile' && (!inputLink || !isValidLink))}
                      className="w-full text-secondary"
                    >
                      {isStartingDownload ? (
                        <>
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                        {t('download.downloadOptions.downloading')}
                      </>
                    ) : (
                      t('download.downloadOptions.downloadNow')
                    )}
                  </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Instructions */}
            <div className="space-y-3">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-lg font-bold text-red-700 inline-flex items-center gap-2">
                      <TriangleAlert strokeWidth={2.3} className="text-red-400" />
                      {t('download.protectYourself.warningTitle')}
                    </p>
                    <p className="mt-2 text-sm text-red-700">{t('download.protectYourself.warning')}</p>
                    <a onClick={() => window.electron.openURL('https://ascendara.app/protect-yourself')} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block flex items-center gap-1 text-sm text-red-700 hover:text-red-900 cursor-pointer hover:underline">
                      {t('download.protectYourself.learnHow')} <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              </div>
              <h2 className="text-xl font-semibold">{t('download.downloadInstructions')}</h2>
              {selectedProvider ? (
                <div>
                  {selectedProvider === "gofile" ? (
                    <div className="space-y-2">
                      <h2 className="text-large">{t('download.downloadOptions.gofileInstructions.thanks')}</h2>
                      <h3>{t('download.downloadOptions.gofileInstructions.description')}</h3>
                      <h3 className="text-large">{t('download.downloadOptions.gofileInstructions.action')}</h3>
                    </div>
                  ) : (
                    <div>
                      {useAscendara ? (
                        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                          <li>{t('download.downloadOptions.handlerInstructions.step1')}</li>
                          <li>{t('download.downloadOptions.handlerInstructions.step2')}</li>
                          <li>{t('download.downloadOptions.handlerInstructions.step3')}</li>
                        </ol>
                      ) : (
                        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                          <li>{t('download.downloadOptions.manualInstructions.step1')}</li>
                          <li>{t('download.downloadOptions.manualInstructions.step2')}</li>
                          <li>{t('download.downloadOptions.manualInstructions.step3')}</li>
                          <li>{t('download.downloadOptions.manualInstructions.step4')}</li>
                          <li>{t('download.downloadOptions.manualInstructions.step5')}</li>
                          <li>{t('download.downloadOptions.manualInstructions.step6')}</li>
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('download.downloadOptions.selectProviderPrompt')}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New User Guide Alert Dialog */}
      <AlertDialog open={showNewUserGuide} onOpenChange={handleCloseGuide}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            {guideStep === 0 ? (
              <>
                <AlertDialogTitle className="text-2xl font-bold text-foreground">{t('download.newUserGuide.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('download.newUserGuide.description')}
                </AlertDialogDescription>
              </>
            ) : (
              <>
                <AlertDialogTitle className="text-2xl font-bold text-foreground">
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
              {guideStep === 0 ? t('download.newUserGuide.noThanks') : t('download.newUserGuide.close')}
            </AlertDialogCancel>
            <Button variant="text-secondary bg-primary" onClick={guideStep === 0 ? handleStartGuide : handleNextStep}>
              {guideStep === 0 ? t('download.newUserGuide.startGuide') : 
               guideStep === guideSteps.length ? t('download.newUserGuide.finish') : 
               guideStep === 1 ? t('download.newUserGuide.installed') :
               guideStep === 2 ? t('download.newUserGuide.handlerEnabled') :
               t('download.newUserGuide.nextStep')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
