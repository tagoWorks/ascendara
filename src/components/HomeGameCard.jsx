import React, { memo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from "./ui/card";
import { AspectRatio } from "./ui/aspect-ratio";
import { Clock } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import imageCacheService from '../services/imageCacheService';
import { useNavigate } from 'react-router-dom';

// Memoized sub-components
const useImageLoader = (imgID, onIntersect) => {
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);

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
      { rootMargin: '50px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [imgID, onIntersect]);

  useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      if (!isVisible || !imgID) return;
      
      try {
        const src = await imageCacheService.getImage(imgID);
        if (mounted && src) {
          setImageSrc(src);
        }
      } catch (error) {
        console.error('Error loading image:', error);
      }
    };

    loadImage();
    return () => { mounted = false; };
  }, [imgID, isVisible]);

  return { observerRef, isVisible, imageLoaded, setImageLoaded, imageSrc };
};

const GameImage = memo(({ imgID, gameName, onIntersect }) => {
  const { observerRef, isVisible, imageLoaded, setImageLoaded, imageSrc } = useImageLoader(imgID, onIntersect);

  return (
    <div className="relative group" ref={observerRef}>
      <AspectRatio ratio={16/9}>
        {(!imageLoaded || !imageSrc) && (
          <Skeleton className="absolute inset-0 w-full h-full bg-muted" />
        )}
        {isVisible && imageSrc && (
          <img
            src={imageSrc}
            alt={gameName}
            className="w-full h-full object-cover rounded-t-lg transition-opacity duration-200"
            style={{ opacity: imageLoaded ? 1 : 0 }}
            onLoad={() => setImageLoaded(true)}
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
        <GameImage imgID={game.imgID} gameName={game.game} onIntersect={handleImageLoad} />
        <CardContent className="p-3">
          <h3 className="font-semibold text-sm truncate">{game.game}</h3>
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
        <div className="flex flex-col sm:flex-row h-full">
          <div className="sm:w-1/3">
            <GameImage imgID={game.imgID} gameName={game.game} onIntersect={handleImageLoad} />
          </div>
          <CardContent className="flex-1 p-4 flex flex-col">
            <h3 className="font-semibold text-lg mb-2">{game.game}</h3>
            <div className="mt-auto">
              <Categories categories={game.category} />
              <UpdateDate date={game.date} />
            </div>
          </CardContent>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer flex flex-col"
      onClick={handleClick}
    >
      <GameImage imgID={game.imgID} gameName={game.game} onIntersect={handleImageLoad} />
      <CardContent className="p-4 flex flex-col flex-grow">
        <h3 className="font-semibold text-lg mb-2">{game.game}</h3>
        <div className="mt-auto">
          <Categories categories={game.category} />
          <UpdateDate date={game.date} />
        </div>
      </CardContent>
    </Card>
  );
});

export default HomeGameCard;