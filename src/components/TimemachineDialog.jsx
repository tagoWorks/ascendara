import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { useState, useEffect } from "react";
import { fetchGameVersions } from "../services/timemachineService";
import { useLanguage } from "@/context/LanguageContext";

export default function TimemachineDialog({ gameData, onVersionSelect, open, onOpenChange }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (open && gameData?.game) {
      loadVersions();
    }
  }, [open, gameData]);

  const loadVersions = async () => {
    console.log("Loading versions for game:", gameData.game);
    setLoading(true);
    setError(null);
    try {
      const versionData = await fetchGameVersions(gameData.game);
      console.log("Fetched versions:", versionData);
      setVersions(versionData);
      
      if (versionData.length === 0) {
        setError(t("download.timemachine.noVersions"));
      }
    } catch (err) {
      console.error("Error loading versions:", err);
      setError(t("download.timemachine.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleVersionSelect = (version) => {
    // Preserve the original image ID when selecting a version
    const updatedGameData = {
      ...version.game,
      imgID: gameData.imgID,
    };
    onVersionSelect(updatedGameData);
    onOpenChange(false);
    
    // Show toast notification
    const versionText = version.game.version || t("download.timemachine.unknownVersion");
    const dateText = version.metadata?.getDate || t("download.timemachine.unknownDate");
    
    toast.success(t("download.timemachine.versionChanged"), {
      description: t("download.timemachine.versionChangedDesc")
        .replace("{version}", versionText)
        .replace("{date}", dateText),
      duration: 3000
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-bold text-foreground">{t("download.timemachine.title")}</AlertDialogTitle>
          <AlertDialogDescription className="text-foreground">
            {t("download.timemachine.description").replace("{game}", gameData.game)}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-4">
            {t("download.timemachine.loading")}
          </div>
        ) : error ? (
          <div className="text-destructive p-4">{error}</div>
        ) : (
          <ScrollArea className="h-[300px] w-full">
            <div className="space-y-2 p-4">
              {versions.map((version) => (
                <Button
                  key={version.version}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleVersionSelect(version)}
                >
                  <div className="flex flex-col items-start">
                    <div className="font-medium">
                      {version.game.version || t("download.timemachine.unknownVersion")}
                    </div>
                    {version.metadata?.getDate && (
                      <div className="text-sm text-muted-foreground">
                        {version.metadata.getDate}
                      </div>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t("download.timemachine.cancel")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}