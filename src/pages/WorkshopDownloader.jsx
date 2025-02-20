import React, { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallpaper, FolderOpen, ArrowRight, Settings2, Coffee, Link, Download, Loader, DownloadCloud, ExternalLink, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const WorkshopDownloader = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [wallpaperFolder, setWallpaperFolder] = useState("");
  const [wallpaperUrl, setWallpaperUrl] = useState("");
  const [isSetup, setIsSetup] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [downloadLogs, setDownloadLogs] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showFailureDialog, setShowFailureDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const isSteamCMDInstalled = await window.electron.isSteamCMDInstalled();
        setIsSetup(isSteamCMDInstalled);
      } catch (error) {
        console.error("Error checking SteamCMD installation:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSetup();
  }, []);

  useEffect(() => {
    // Set up download progress listener
    const removeListener = window.electron.onDownloadProgress((data) => {
      setDownloadLogs(prev => [...prev, data.message]);
    });

    // Cleanup listener on unmount
    return () => removeListener();
  }, []);


  const handleNext = async () => {
    if (step === 2) {
      setIsInstalling(true);
      try {
        const result = await window.electron.installSteamCMD();
        if (result.success) {
          toast.success(t("workshopDownloader.installSuccess"));
          setIsSetup(true);
          setStep(step + 1);
        } else {
          toast.error(t("workshopDownloader.installError"));
        }
      } finally {
        setIsInstalling(false);
      }
    } else {
      setStep(step + 1);
    }
  };

  const renderMainInterface = () => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="flex flex-col items-center justify-center text-center space-y-6"
      >
        <Link className="w-16 h-16 text-primary" />
        <h2 className="text-2xl font-bold">{t("workshopDownloader.mainTitle")}</h2>
        <p className="text-muted-foreground max-w-xl">
          {t("workshopDownloader.mainDescription")}&nbsp;
          <a className="cursor-pointer items-center text-primary hover:underline"
           onClick={() =>window.electron.openURL("https://steamcommunity.com/workshop/browse")}>
            {t("workshopDownloader.goToWorkshop")}
            <ExternalLink className="w-4 h-4 ml-1 mb-1 inline-flex" />
          </a>
        </p>
        
        <div className="w-full max-w-md space-y-4">
          <Input
            value={wallpaperUrl}
            onChange={(e) => setWallpaperUrl(e.target.value)}
            placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=XXXXXXXXXX"
            className="placeholder:text-xs"
          />
        </div>
        <div className="w-full max-w-md flex items-center space-x-2">
          <Button 
            size="lg" 
            className="flex-grow text-secondary"
            disabled={isDownloading || !wallpaperUrl}
            onClick={async () => {
              if (wallpaperUrl) {
                setIsDownloading(true);
                setDownloadLogs([]);
                try {
                  const result = await window.electron.downloadItem(wallpaperUrl);
                  if (result.success) {
                    toast.success(t("workshopDownloader.downloadSuccess"));
                  } else {
                    // Check if the error message indicates a download failure
                    if (result.message.includes("Workshop item download failed")) {
                      setShowFailureDialog(true);
                    } else {
                      toast.error(result.message || t("workshopDownloader.downloadError"));
                    }
                  }
                } catch (error) {
                  toast.error(t("workshopDownloader.downloadError"));
                  console.error("Error downloading wallpaper:", error);
                } finally {
                  setIsDownloading(false);
                  setWallpaperUrl("");
                }
              }
            }}
          >
            {isDownloading ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                {t("workshopDownloader.downloading")}
              </>
            ) : (
              <>
                {t("workshopDownloader.downloadLink")} <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.electron.openGameDirectory("workshop")}
          >
            <FolderOpen className="w-4 h-4" />
          </Button>
        </div>

        {/* Log Display Area */}
        {isDownloading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full max-w-md mt-4"
          >
            <div className="bg-background border rounded-lg p-4 max-h-48 overflow-y-auto font-mono text-sm">
              <h3 className="text-primary font-semibold mb-2">{t("workshopDownloader.downloadProgress")}</h3>
              <div className="space-y-1 text-muted-foreground">
                {downloadLogs.length > 0 ? (
                  downloadLogs.map((log, index) => (
                    <div key={index} className="whitespace-pre-wrap">{log}</div>
                  ))
                ) : (
                  <div className="text-center italic">{t("workshopDownloader.waitingForLogs")}</div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Download Failure Dialog */}
        <AlertDialog open={showFailureDialog} onOpenChange={setShowFailureDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold text-foreground">
                {t("workshopDownloader.downloadFailure.title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>{t("workshopDownloader.downloadFailure.description")}</p>
                <ul className="list-disc pl-6 space-y-1">
                  {t("workshopDownloader.downloadFailure.reasons", { returnObjects: true }).map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
                <p>{t("workshopDownloader.downloadFailure.suggestion")}</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="text-secondary" onClick={() => setShowFailureDialog(false)}>
                {t("common.ok")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    );
  };

  const renderSetupStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center text-center space-y-6"
          >
            <Package className="w-16 h-16 text-primary" />
            <h2 className="text-2xl font-bold">{t("workshopDownloader.welcome")}</h2>
            <p className="text-muted-foreground max-w-md">
              {t("workshopDownloader.welcomeDescription")}&nbsp;
              <a className="cursor-pointer items-center text-primary hover:underline"
               onClick={() =>window.electron.openURL("https://steamcommunity.com/workshop/browse/?appid=431960")}>
                {t("common.learnMore")}
                <ExternalLink className="w-4 h-4 ml-1 mb-1 inline-flex" />
              </a>
            </p>
            <Button onClick={handleNext} size="lg" className="mt-8 text-secondary">
              {t("common.getStarted")} <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center text-center space-y-6"
          >
            <DownloadCloud className="w-16 h-16 text-primary" />
            <h2 className="text-2xl font-bold">{t("workshopDownloader.installSteamCMD")}</h2>
            <p className="text-muted-foreground max-w-md">
              {t("workshopDownloader.installSteamCMDDescription")}
            </p>
            <Button
              onClick={handleNext}
              size="lg"
              className="mt-8 text-secondary"
              disabled={isInstalling}
            >
              {isInstalling ? (
                <>
                  <div className="animate-spin mr-2">
                    <Loader className="w-4 h-4" />
                  </div>
                  {t("workshopDownloader.installingSteamCMD")}
                </>
              ) : (
                <>
                  {t("workshopDownloader.install")} <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </motion.div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 min-h-[80vh] flex items-center justify-center">
      <AnimatePresence mode="wait">
        {isSetup ? renderMainInterface() : renderSetupStep()}
      </AnimatePresence>
    </div>
  );
};

export default WorkshopDownloader;