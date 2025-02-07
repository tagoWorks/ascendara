import React, { useState, memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardFooter } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Download, Gift, Gamepad2, Zap, Loader } from "lucide-react";
import { AspectRatio } from "../components/ui/aspect-ratio";
import { Skeleton } from "../components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { sanitizeText } from "../lib/utils";
import { useImageLoader } from "../hooks/useImageLoader";

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
      <div className="flex gap-4 hover:bg-secondary/50 p-2 rounded-lg transition-colors cursor-pointer">
        <img
          src={cachedImage || game.banner || game.image}
          alt={game.title || game.game}
          className="w-[120px] h-[68px] object-cover rounded-lg"
        />
        <div>
          <h3 className="font-medium text-foreground">{sanitizeText(game.game)}</h3>
          <div className="flex flex-wrap gap-1 mt-1">
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
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 animate-in fade-in-50 bg-card text-card-foreground flex flex-col min-h-[400px]">
      <CardContent className="p-0 flex-1">
        <div className="relative">
          <AspectRatio ratio={16 / 9}>
            {loading && <Skeleton className="absolute inset-0 w-full h-full bg-muted" />}
            {cachedImage && (
              <img
                src={cachedImage}
                alt={game.game}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  loading ? "opacity-0" : "opacity-100"
                }`}
              />
            )}
          </AspectRatio>
          <div className="absolute top-2 right-2 flex gap-2">
            {game.dlc && (
              <div className="px-2.5 py-1.5 rounded-md bg-background/95 backdrop-blur-sm border border-border/50 shadow-sm flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">{t("gameCard.dlc")}</span>
              </div>
            )}
            {game.online && (
              <div className="px-2.5 py-1.5 rounded-md bg-background/95 backdrop-blur-sm border border-border/50 shadow-sm flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">{t("gameCard.online")}</span>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 h-full">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg line-clamp-1 text-foreground">
              {sanitizeText(game.game)}
            </h3>
          </div>
          <div className="flex flex-wrap gap-1 mb-2">
            {categories.map((cat, index) => (
              <Badge
                key={`${cat}-${index}`}
                variant="secondary"
                className="text-xs bg-secondary text-secondary-foreground animate-in fade-in-50 slide-in-from-left-3"
              >
                {cat}
              </Badge>
            ))}
            {!showAllTags && gameCategories.length > 3 && (
              <Badge
                variant="outline"
                className="text-xs border-muted-foreground text-muted-foreground cursor-pointer hover:bg-accent transition-colors"
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
                className="text-xs border-muted-foreground text-muted-foreground cursor-pointer hover:bg-accent transition-colors animate-in fade-in-50"
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
      <CardFooter className="flex justify-between items-center p-4">
        <Button
          variant="secondary"
          size="sm"
          className="w-full font-medium bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={handleDownload}
          disabled={isInstalled || isLoading}
        >
          {isLoading ? (
            <Loader className="w-4 h-4 mr-2 animate-spin" />
          ) : isInstalled ? (
            <Gamepad2 className="w-4 h-4 mr-2" />
          ) : Object.keys(game.download_links || {}).includes("gofile") ? (
            <Zap className="w-4 h-4 mr-2" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
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
