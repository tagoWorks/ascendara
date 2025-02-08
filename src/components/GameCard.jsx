import React, { useState, memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Gift, Gamepad2, Zap, Loader } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { sanitizeText } from "@/lib/utils";
import { useImageLoader } from "@/hooks/useImageLoader";

const GameCard = memo(function GameCard({ game, compact }) {
  const navigate = useNavigate();
  const [showAllTags, setShowAllTags] = useState(false);
  const { cachedImage, loading, error } = useImageLoader(game?.imgID);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isMounted = useRef(true);
  const { t } = useLanguage();

  if (!game) {
    return null;
  }

  const gameCategories = Array.isArray(game.category) ? game.category : [];

  const categories = useMemo(() => {
    return showAllTags ? gameCategories : gameCategories.slice(0, 3);
  }, [gameCategories, showAllTags]);

  useEffect(() => {
    const checkInstalled = async () => {
      try {
        const installedGames = await window.electron.getGames();
        if (isMounted.current) {
          setIsInstalled(
            installedGames.some(installedGame => installedGame.game === game.game)
          );
        }
      } catch (error) {
        console.error("Error checking game installation:", error);
      }
    };

    checkInstalled();

    return () => {
      isMounted.current = false;
    };
  }, [game.game]);

  const handleDownload = useCallback(async () => {
    if (isInstalled) return;
    setIsLoading(true);
    const downloadLinks = game.download_links || {};
    setTimeout(() => {
      navigate("/download", {
        state: {
          gameData: {
            ...game,
            download_links: downloadLinks,
          },
        },
      });
    });
  }, [navigate, game, isInstalled, t]);

  if (compact) {
    return (
      <div className="flex cursor-pointer gap-4 rounded-lg p-2 transition-colors hover:bg-secondary/50">
        <img
          src={cachedImage || game.banner || game.image}
          alt={game.title || game.game}
          className="h-[68px] w-[120px] rounded-lg object-cover"
        />
        <div>
          <h3 className="font-medium text-foreground">{sanitizeText(game.game)}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {categories.map(cat => (
              <span key={cat} className="text-xs text-muted-foreground">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="group flex min-h-[400px] flex-col overflow-hidden bg-card text-card-foreground transition-all duration-300 animate-in fade-in-50 hover:shadow-lg">
      <CardContent className="flex-1 p-0">
        <div className="relative">
          <AspectRatio ratio={16 / 9}>
            {loading && <Skeleton className="absolute inset-0 h-full w-full bg-muted" />}
            {cachedImage && (
              <img
                src={cachedImage}
                alt={game.game}
                className={`h-full w-full object-cover transition-opacity duration-300 ${
                  loading ? "opacity-0" : "opacity-100"
                }`}
              />
            )}
          </AspectRatio>
          <div className="absolute right-2 top-2 flex gap-2">
            {game.dlc && (
              <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background/95 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
                <Gift className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">{t("gameCard.dlc")}</span>
              </div>
            )}
            {game.online && (
              <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background/95 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
                <Gamepad2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">{t("gameCard.online")}</span>
              </div>
            )}
          </div>
        </div>
        <div className="h-full p-4">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="line-clamp-1 text-lg font-semibold text-foreground">
              {sanitizeText(game.game)}
            </h3>
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {categories.map((cat, index) => (
              <Badge
                key={`${cat}-${index}`}
                variant="secondary"
                className="text-secondary-foreground bg-secondary text-xs animate-in fade-in-50 slide-in-from-left-3"
              >
                {cat}
              </Badge>
            ))}
            {!showAllTags && gameCategories.length > 3 && (
              <Badge
                variant="outline"
                className="cursor-pointer border-muted-foreground text-xs text-muted-foreground transition-colors hover:bg-accent"
                onClick={e => {
                  e.stopPropagation();
                  setShowAllTags(true);
                }}
              >
                +{gameCategories.length - 3}
              </Badge>
            )}
            {showAllTags && (
              <Badge
                variant="outline"
                className="cursor-pointer border-muted-foreground text-xs text-muted-foreground transition-colors animate-in fade-in-50 hover:bg-accent"
                onClick={e => {
                  e.stopPropagation();
                  setShowAllTags(false);
                }}
              >
                {t("gameCard.showLess")}
              </Badge>
            )}
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <p>
              {t("gameCard.size")}: <span className="font-medium">{game.size}</span>
            </p>
            {game.version && (
              <p>
                {t("gameCard.version")}:{" "}
                <span className="font-medium">{game.version}</span>
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between p-4">
        <Button
          variant="secondary"
          size="sm"
          className="w-full bg-accent font-medium text-accent-foreground hover:bg-accent/90"
          onClick={handleDownload}
          disabled={isInstalled || isLoading}
        >
          {isLoading ? (
            <Loader className="mr-2 h-4 w-4 animate-spin" />
          ) : isInstalled ? (
            <Gamepad2 className="mr-2 h-4 w-4" />
          ) : Object.keys(game.download_links || {}).includes("gofile") ? (
            <Zap className="mr-2 h-4 w-4" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {isLoading
            ? t("gameCard.loading")
            : isInstalled
              ? t("gameCard.installed")
              : t("gameCard.download")}
        </Button>
      </CardFooter>
    </Card>
  );
});

export default GameCard;
