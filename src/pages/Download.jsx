import React, { useEffect, useState } from 'react';
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
import { Loader2Icon, InfoIcon, CopyIcon, CheckIcon, BadgeCheckIcon } from "lucide-react";
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
      pattern = /^https:\/\/dl\.buzzheavier\.com\/\d+(?:\?.*?)?$/i;
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

const VERIFIED_PROVIDERS = ['megadb', 'gofile', 'datanodes'];

const sanitizeGameName = (name) => {
  if (!name) return '';
  // Replace special dash character with standard hyphen
  return name.replace(/[–—]/g, '-');
};

export default function DownloadPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { gameData } = state || {};
  const { t } = useLanguage();
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
  const [settings, setSettings] = useState({ downloadBlocker: false });

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
      '/guide/guide-toggle.png',
      '/guide/guide-start.png',
      '/guide/guide-copy.png',
      '/guide/guide-download.png',
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
      image: guideImages['/guide/guide-toggle.png']
    },
    {
      title: t('download.newUserGuide.steps.2.title'),
      description: t('download.newUserGuide.steps.2.description'),
      image: guideImages['/guide/guide-start.png']
    },
    {
      title: t('download.newUserGuide.steps.3.title'),
      description: t('download.newUserGuide.steps.3.description'),
      image: guideImages['/guide/guide-copy.png']
    },
    {
      title: t('download.newUserGuide.steps.4.title'),
      description: t('download.newUserGuide.steps.4.description'),
      image: guideImages['/guide/guide-download.png']
    },
    {
      title: t('download.newUserGuide.steps.5.title'),
      description: t('download.newUserGuide.steps.5.description'),
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
      const newSettings = { ...settings, downloadBlocker: true };
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
    setIsValidLink(isValidURL(newLink, selectedProvider));
  };

  const handleDownload = async () => {
    if (showNoDownloadPath) {
      return;
    }

    if (selectedProvider !== 'gofile' && !isValidLink) {
      return;
    }

    setIsStartingDownload(true);
    try {
      const sanitizedGameName = sanitizeText(gameData.game);
      await window.electron.downloadFile(
        sanitizeText(inputLink),
        sanitizedGameName,
        gameData.online,
        gameData.dlc,
        gameData.version,
        gameData.imgID,
        gameData.size
      );
      
      // Add a 2-second delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Show success notification
      toast.success(t('download.toast.downloadStarted'));
      
      // Redirect to downloads page
      navigate('/downloads');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(t('download.toast.downloadFailed'));
      setIsStartingDownload(false);
    }
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
    <div className="container max-w-7xl mx-auto flex flex-col p-4 min-h-screen pt-24 fade-in">
      <div className="w-full max-w-6xl">
        <div className="flex flex-col gap-4">
          {/* Back Button */}
          <Button
            variant="ghost"
            className="w-fit"
            onClick={() => navigate(-1)}
          >
            ← {t('common.back')}
          </Button>

          {/* Game Header Section */}
          <div className="flex items-start gap-4">
            <img 
              src={cachedImage || `https://api.ascendara.app/image/${gameData.imgID}`}
              alt={gameData.game}
              className="w-48 h-28 object-cover rounded-lg"
            />
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">{gameData.game}</h1>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      {t('download.reportBroken')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      handleSubmitReport();
                    }}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('download.reportBroken')}: {gameData.game}</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">{t('download.reportReason')}</label>
                            <Select
                              value={reportReason}
                              onValueChange={setReportReason}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t('download.selectProvider')} />
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
                      <AlertDialogFooter className="gap-2">
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
                          variant="destructive"
                          disabled={isReporting}
                        >
                          {isReporting ? (
                            <>
                              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
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
                <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {gameData.version}
                </span>
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
                <InfoIcon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">
                  {t('download.dmcaNotice')}
                </span>
              </div>
              <span className="text-sm text-primary hover:underline">{t('common.learnMore')}</span>
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

                      {selectedProvider !== "gofile" && (
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
                          id="ascendara-blocker"
                          checked={useAscendara}
                          onCheckedChange={(checked) => {
                            setUseAscendara(checked);
                            localStorage.setItem('useAscendara', JSON.stringify(checked));
                          }}
                        />
                        <Label htmlFor="ascendara-blocker" className="text-sm">
                          {t('download.downloadOptions.ascendaraBlocker')}
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

                  <Button
                    onClick={handleDownload}
                    disabled={isStartingDownload || !selectedProvider || (selectedProvider !== 'gofile' && (!inputLink || !isValidLink))}
                    className="w-full text-secondary"
                  >
                    {isStartingDownload ? (
                      <>
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        {t('download.downloadOptions.downloading')}
                      </>
                    ) : (
                      t('download.downloadOptions.downloadNow')
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Column - Instructions */}
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Download Instructions</h2>
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
                          <li>{t('download.downloadOptions.blockerInstructions.step1')}</li>
                          <li>{t('download.downloadOptions.blockerInstructions.step2')}</li>
                          <li>{t('download.downloadOptions.blockerInstructions.step3')}</li>
                          <li>{t('download.downloadOptions.blockerInstructions.step4')}</li>
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
                <AlertDialogTitle className="text-primary">{t('download.newUserGuide.title')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('download.newUserGuide.description')}
                </AlertDialogDescription>
              </>
            ) : (
              <>
                <AlertDialogTitle className="text-primary">
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
            <AlertDialogCancel className="text-muted-foreground" onClick={handleCloseGuide}>
              {guideStep === 0 ? t('download.newUserGuide.noThanks') : t('download.newUserGuide.close')}
            </AlertDialogCancel>
            <Button onClick={guideStep === 0 ? handleStartGuide : handleNextStep}>
              {guideStep === 0 ? t('download.newUserGuide.startGuide') : 
               guideStep === guideSteps.length ? t('download.newUserGuide.finish') : 
               guideStep === 1 ? t('download.newUserGuide.installed') :
               guideStep === 2 ? t('download.newUserGuide.blockerEnabled') :
               t('download.newUserGuide.nextStep')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
