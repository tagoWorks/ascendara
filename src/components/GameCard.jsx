import React, { useState, memo, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardFooter } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Download, Gift, Gamepad2, Zap } from 'lucide-react';
import { AspectRatio } from "../components/ui/aspect-ratio";
import { Skeleton } from "../components/ui/skeleton";
import { useNavigate } from 'react-router-dom';
import imageCacheService from '../services/imageCacheService';

const useImageLoader = (imgID) => {
  const [cachedImage, setCachedImage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const loadImage = async () => {
      if (!imgID) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const cached = await imageCacheService.getImage(imgID);
      
      if (mounted) {
        setCachedImage(cached);
        setLoading(false);
      }
    };

    loadImage();
    return () => { mounted = false; };
  }, [imgID]);

  return { cachedImage, loading };
};

const GameCard = memo(function GameCard({ game, compact }) {
  const navigate = useNavigate();
  const [showAllTags, setShowAllTags] = useState(false);
  const { cachedImage, loading } = useImageLoader(game?.imgID);
  const [seamlessDownloads, setSeamlessDownloads] = useState(false);

  if (!game) {
    return null;
  }

  const gameCategories = Array.isArray(game.category) ? game.category : [];

  const categories = useMemo(() => {
    return showAllTags ? gameCategories : gameCategories.slice(0, 3);
  }, [gameCategories, showAllTags]);

  useEffect(() => {
    window.electron.getSettings().then(settings => {
      setSeamlessDownloads(settings.seamlessDownloads ?? true);
    });
  }, []);

  const handleDownload = useCallback(() => {
    const downloadLinks = game.download_links || {};
    const providers = Object.entries(downloadLinks)
      .filter(([_, links]) => Array.isArray(links) && links.length > 0)
      .map(([provider]) => provider);
    
    const hasGoFile = providers.includes('gofile');
    
    if (hasGoFile && seamlessDownloads) {
      const goFileLink = game.download_links['gofile'][0];
      const formattedLink = goFileLink.startsWith('//') ? `https:${goFileLink}` : goFileLink;
      
      window.electron.downloadFile(
        formattedLink,
        game.game,
        game.online || false,
        game.dlc || false,
        game.version || '',
        game.imgID,
        game.size || ''
      );
    } else {
      const container = document.querySelector('.page-container');
      if (container) {
        container.classList.add('fade-out');
      }
      
      setTimeout(() => {
        navigate('/download', { 
          state: { 
            gameData: {
              ...game,
              download_links: downloadLinks
            }
          }
        });
      }, 300);
    }
  }, [navigate, game, seamlessDownloads]);

  if (compact) {
    return (
      <div className="flex gap-4 hover:bg-secondary/50 p-2 rounded-lg transition-colors cursor-pointer">
        <img 
          src={cachedImage || game.banner || game.image} 
          alt={game.title || game.game}
          className="w-[120px] h-[68px] object-cover rounded-lg"
        />
        <div>
          <h3 className="font-medium text-foreground">{game.title || game.game}</h3>
          <div className="flex flex-wrap gap-1 mt-1">
            {categories.map((cat) => (
              <span 
                key={cat}
                className="text-xs text-muted-foreground"
              >
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
            {loading && (
              <Skeleton className="absolute inset-0 w-full h-full bg-muted" />
            )}
            {cachedImage && (
              <img
                src={cachedImage}
                alt={game.game}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  loading ? 'opacity-0' : 'opacity-100'
                }`}
              />
            )}
          </AspectRatio>
          <div className="absolute top-2 right-2 flex gap-2">
            {game.dlc && (
              <div className="px-2.5 py-1.5 rounded-md bg-background/95 backdrop-blur-sm border border-border/50 shadow-sm flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">DLC</span>
              </div>
            )}
            {game.online && (
              <div className="px-2.5 py-1.5 rounded-md bg-background/95 backdrop-blur-sm border border-border/50 shadow-sm flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">Online</span>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 h-full">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg line-clamp-1 text-foreground">
              {game.game}
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
                onClick={(e) => {
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
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAllTags(false);
                }}
              >
                Show Less
              </Badge>
            )}
          </div>
          <div className="text-sm space-y-1">
            <p className="flex items-center justify-between text-foreground">
              Size: <span className="font-medium">{game.size}</span>
            </p>
            {game.version && (
              <p className="flex items-center justify-between text-foreground">
                Version: <span className="font-medium">{game.version}</span>
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 mt-auto">
        <Button 
          variant="secondary"
          size="sm" 
          className="w-full font-medium bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={handleDownload}
        >
          {Object.keys(game.download_links || {}).includes('gofile') && seamlessDownloads ? (
            <Zap className="w-4 h-4 mr-2" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Download
        </Button>
      </CardFooter>
    </Card>
  );
});

export default GameCard;