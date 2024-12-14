import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from "../components/ui/button";
import { AlertDialog, AlertDialogDescription } from "../components/ui/alert-dialog";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Loader2Icon, InfoIcon, CopyIcon, CheckIcon } from "lucide-react";
import imageCacheService from '../services/imageCacheService';
import { toast } from "sonner";

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

export default function DownloadPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { gameData } = state || {};

  const [selectedProvider, setSelectedProvider] = useState("");
  const [inputLink, setInputLink] = useState("");
  const [isStartingDownload, setIsStartingDownload] = useState(false);
  const [useAscendara, setUseAscendara] = useState(false);
  const [showNoDownloadPath, setShowNoDownloadPath] = useState(false);
  const [cachedImage, setCachedImage] = useState(null);
  const [isValidLink, setIsValidLink] = useState(true);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

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
      await window.electron.downloadFile(
        inputLink,
        gameData.game,
        gameData.online,
        gameData.dlc,
        gameData.version,
        gameData.imgID,
        gameData.size
      );
      
      // Add a 2-second delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Show success notification
      toast.success("Download started successfully!");
      
      // Redirect to downloads page
      navigate('/downloads');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error("Failed to start download. Please try again.");
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

  if (!gameData) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <AlertDialog variant="destructive">
          <AlertDialogDescription>
            No game data found. Redirecting to search...
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
            ← Back
          </Button>

          {/* Game Header Section */}
          <div className="flex items-start gap-4">
            <img 
              src={cachedImage || `https://api.ascendara.app/image/${gameData.imgID}`}
              alt={gameData.game}
              className="w-48 h-28 object-cover rounded-lg"
            />
            <div className="flex flex-col gap-1">
              <h1 className="text-4xl font-bold">{gameData.game}</h1>
              <div className="flex items-center gap-2">
                <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {gameData.version}
                </span>
                {gameData.online && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm bg-green-500/10 text-green-500 px-2 py-0.5 rounded flex items-center gap-1">
                          ONLINE
                          <InfoIcon className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-secondary">Online multiplayer capabilities enabled through online-fix.me</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {gameData.dlc && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded flex items-center gap-1">
                          ALL-DLC
                          <InfoIcon className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-secondary">Includes all downloadable content (DLC) available for this game</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Size: {gameData.size}</p>
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
                  DMCA Notice: Ascendara uses outsourced links and files and does not host anything on its own servers.
                </span>
              </div>
              <span className="text-sm text-primary hover:underline">Learn More →</span>
            </div>
          </div>

          <Separator className="my-1" />

          {/* Download Options Section - Two columns with reduced spacing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column - Download Options */}
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Download Options</h2>
              
              <div className="space-y-2">
                <Label>Download Source</Label>
                {providers.length > 0 ? (
                  <Select 
                    value={selectedProvider}
                    onValueChange={setSelectedProvider}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a download provider" />
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
                          default:
                            // Capitalize first letter of provider name
                            displayName = provider.charAt(0).toUpperCase() + provider.slice(1);
                        }
                        return (
                          <SelectItem 
                            key={provider} 
                            value={provider}
                            className="hover:bg-muted focus:bg-muted"
                          >
                            {displayName}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                ) : (
                  <p>No download providers available for this game.</p>
                )}
              </div>

              {selectedProvider && (
                <div className="space-y-3">
                  <div>
                    <Label>Download Link:</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div 
                        className="flex-1 bg-gray-100 p-2 rounded-md text-sm flex items-center justify-between group cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={async () => {
                          const link = downloadLinks[selectedProvider][0].startsWith('//')
                            ? `https:${downloadLinks[selectedProvider][0]}`
                            : downloadLinks[selectedProvider][0];
                          await navigator.clipboard.writeText(link);
                          setShowCopySuccess(true);
                          setTimeout(() => setShowCopySuccess(false), 1000);
                        }}
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
                        onClick={() => window.electron.openURL(
                          downloadLinks[selectedProvider][0].startsWith('//')
                            ? `https:${downloadLinks[selectedProvider][0]}`
                            : downloadLinks[selectedProvider][0]
                        )} 
                        variant="outline"
                      >
                        Open in Browser
                      </Button>
                    </div>
                  </div>

                  {selectedProvider !== "gofile" && (
                    <div>
                      <Input
                        placeholder="Paste your direct download link (DDL) here"
                        value={inputLink}
                        onChange={handleInputChange}
                        className={!isValidLink ? "border-red-500" : ""}
                      />
                      {!isValidLink && (
                        <p className="text-red-500 text-sm mt-1">
                          Please enter a valid download link for {selectedProvider}
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
                      Ascendara Download Blocker
                    </Label>
                  </div>
                  {!useAscendara && (
                    <p 
                      className="text-xs text-muted-foreground hover:underline cursor-pointer"
                      onClick={() => window.electron.openURL('https://ascendara.app/extension')}
                    >
                      Don't have the extension? Get it for Chrome or Firefox
                    </p>
                  )}
                </div>
              )}

              <Button
                onClick={handleDownload}
                disabled={isStartingDownload || !selectedProvider || (selectedProvider !== 'gofile' && (!inputLink || !isValidLink))}
                className="w-full"
              >
                {isStartingDownload ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Downloading
                  </>
                ) : (
                  "Download Now"
                )}
              </Button>
            </div>

            {/* Right Column - Instructions */}
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Download Instructions</h2>
              {selectedProvider ? (
                <div>
                  {selectedProvider === "gofile" ? (
                    <div className="space-y-2">
                      <h2 className="text-large">Thanks to ltsdw on GitHub</h2>
                      <h3>Unlike other providers that require a CAPTCHA verification, <br/>
                        GoFile allows direct downloads through their API without such interruptions.</h3>
                      <h3 className="text-large">Simply click on Download to start downloading this game.</h3>
                    </div>
                  ) : (
                    <div>
                      {useAscendara ? (
                        <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                          <li>Open the link in your browser and enabled the extension</li>
                          <li>Complete the CAPTCHA and start the download</li>
                          <li>The extension will automatically stop and capture the direct download link</li>
                          <li>Paste the DDL above and click Download Now</li>
                        </ol>
                      ) : (
                        <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
                          <li>Copy and paste the link into your browser</li>
                          <li>Complete the CAPTCHA and start the download</li>
                          <li>Stop the download once it starts in your browser</li>
                          <li>Hit <kbd>CTRL+J</kbd> to open your downloads</li>
                          <li>Copy the link that the browser started downloading</li>
                          <li>Paste the DDL above and click Download Now</li>
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Please select a download provider to see the instructions.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
