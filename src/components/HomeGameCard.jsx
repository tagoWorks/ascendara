import React, { memo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "./ui/card";
import { AspectRatio } from "./ui/aspect-ratio";
import { Clock } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import imageCacheService from '../services/imageCacheService';
import { useNavigate } from 'react-router-dom';
import { sanitizeText } from '../lib/utils';

// Memoized sub-components
const useImageLoader = (imgID, onIntersect) => {
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const maxAttempts = 3;

  const observerRef = useCallback(node => {
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            onIntersect?.(imgID);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '100px' } // Increased margin to start loading earlier
    );

    observer.observe(node);
  }, [imgID, onIntersect]);

  useEffect(() => {
    let mounted = true;
    let retryTimeout;

    const loadImage = async () => {
      if (!isVisible || !imgID || loadAttempts >= maxAttempts) return;
      
      try {
        console.log(`[HomeGameCard] Loading image ${imgID} (attempt ${loadAttempts + 1}/${maxAttempts})`);
        const src = await imageCacheService.getImage(imgID);
        
        if (!mounted) return;
        
        if (src) {
          setImageSrc(src);
          console.log(`[HomeGameCard] Successfully loaded image ${imgID}`);
        } else {
          console.warn(`[HomeGameCard] Failed to load image ${imgID}, will retry...`);
          // Retry after a delay if we still have attempts left
          if (loadAttempts < maxAttempts - 1) {
            retryTimeout = setTimeout(() => {
              if (mounted) {
                setLoadAttempts(prev => prev + 1);
              }
            }, 2000 * (loadAttempts + 1)); // Exponential backoff
          }
        }
      } catch (error) {
        console.error(`[HomeGameCard] Error loading image ${imgID}:`, error);
        if (loadAttempts < maxAttempts - 1) {
          retryTimeout = setTimeout(() => {
            if (mounted) {
              setLoadAttempts(prev => prev + 1);
            }
          }, 2000 * (loadAttempts + 1));
        }
      }
    };

    loadImage();

    return () => {
      mounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [imgID, isVisible, loadAttempts]);

  return { observerRef, isVisible, imageLoaded, setImageLoaded, imageSrc };
};

const GameImage = memo(({ imgID, gameName, onIntersect }) => {
  const { observerRef, isVisible, imageLoaded, setImageLoaded, imageSrc } = useImageLoader(imgID, onIntersect);
  const [error, setError] = useState(false);

  // Reset error state when imgID changes
  useEffect(() => {
    setError(false);
  }, [imgID]);

  const handleImageError = useCallback(() => {
    console.error(`[HomeGameCard] Failed to load image for ${gameName} (${imgID})`);
    setError(true);
    setImageLoaded(false);
  }, [imgID, gameName]);

  const handleImageLoad = useCallback(() => {
    console.log(`[HomeGameCard] Successfully loaded image for ${gameName} (${imgID})`);
    setImageLoaded(true);
    setError(false);
  }, [imgID, gameName]);

  return (
    <div className="relative group" ref={observerRef}>
      <AspectRatio ratio={16/9}>
        {(!imageLoaded || !imageSrc) && !error && (
          <Skeleton className="absolute inset-0 w-full h-full bg-muted animate-pulse" />
        )}
        {error && (
          <div className="absolute inset-0 w-full h-full bg-muted flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Failed to load image</span>
          </div>
        )}
        {isVisible && imageSrc && !error && (
          <img
            src={imageSrc}
            alt={gameName}
            className="w-full h-full object-cover rounded-t-lg transition-opacity duration-200"
            style={{ opacity: imageLoaded ? 1 : 0 }}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
      </AspectRatio>
    </div>
  );
});

const Categories = memo(({ categories }) => (
  <div className="flex flex-wrap gap-2 mt-2">
    {categories?.slice(0, 3).map((cat, idx) => (
      <span
        key={cat}
        className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
      >
        {cat}
      </span>
    ))}
  </div>
));

const UpdateDate = memo(({ date }) => {
  if (!date) return null;
  const formattedDate = new Date(date);
  
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
      <Clock className="w-3 h-3" />
      {formattedDate.toLocaleDateString()}
    </div>
  );
});

// Main component memoized
const HomeGameCard = memo(({ game, variant = 'default' }) => {
  const navigate = useNavigate();
  const sanitizedGameName = sanitizeText(game.game);

  const handleClick = useCallback(() => {
    const container = document.querySelector('.page-container');
    if (container) {
      container.classList.add('fade-out');
    }
    
    setTimeout(() => {
      navigate('/download', { 
        state: { 
          gameData: game
        }
      });
    }, 300);
  }, [navigate, game]);

  const handleImageLoad = useCallback((imgID) => {
    imageCacheService.getImage(imgID);
  }, []);

  if (variant === 'compact') {
    return (
      <Card 
        className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
        onClick={handleClick}
      >
        <GameImage imgID={game.imgID} gameName={sanitizedGameName} onIntersect={handleImageLoad} />
        <CardContent className="p-3">
          <h3 className="font-semibold text-sm truncate">{sanitizedGameName}</h3>
          <Categories categories={game.category} />
        </CardContent>
      </Card>
    );
  }

  if (variant === 'wide') {
    return (
      <Card 
        className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
        onClick={handleClick}
      >
        <div className="flex">
          <div className="w-48 shrink-0">
            <GameImage imgID={game.imgID} gameName={sanitizedGameName} onIntersect={handleImageLoad} />
          </div>
          <CardContent className="p-3 flex-1">
            <h3 className="font-semibold text-sm truncate">{sanitizedGameName}</h3>
            <Categories categories={game.category} />
            <UpdateDate date={game.updated} />
          </CardContent>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={handleClick}
    >
      <GameImage imgID={game.imgID} gameName={sanitizedGameName} onIntersect={handleImageLoad} />
      <CardContent className="p-3">
        <h3 className="font-semibold text-sm truncate">{sanitizedGameName}</h3>
        <Categories categories={game.category} />
        <UpdateDate date={game.updated} />
      </CardContent>
    </Card>
  );
});

export default HomeGameCard;