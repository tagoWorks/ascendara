import React, { memo, useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from "./ui/card";
import { AspectRatio } from "./ui/aspect-ratio";
import { Clock } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import imageCacheService from '../services/imageCacheService';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

// Memoized sub-components
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

const GameImage = memo(({ imgID, gameName }) => {
  const { cachedImage, loading } = useImageLoader(imgID);

  return (
    <div className="relative group">
      <AspectRatio ratio={16/9}>
        {loading && (
          <Skeleton className="absolute inset-0 w-full h-full bg-muted" />
        )}
        {cachedImage && (
          <img
            src={cachedImage}
            alt={gameName}
            className={`w-full h-full object-cover rounded-t-lg transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
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
  const formattedDate = useMemo(() => new Date(date), [date]);
  
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

  if (variant === 'compact') {
    return (
      <Card 
        className="h-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
        onClick={handleClick}
      >
        <GameImage imgID={game.imgID} gameName={game.game} />
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
            <GameImage imgID={game.imgID} gameName={game.game} />
          </div>
          <CardContent className="flex-1 p-4 flex flex-col">
            <h3 className="font-semibold text-lg mb-2">{game.game}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2 flex-grow">
              {game.description || 'No description available'}
            </p>
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
      <GameImage imgID={game.imgID} gameName={game.game} />
      <CardContent className="p-4 flex flex-col flex-grow">
        <h3 className="font-semibold text-lg mb-2">{game.game}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2 flex-grow">
          {game.description || 'No description available'}
        </p>
        <div className="mt-auto">
          <Categories categories={game.category} />
          <UpdateDate date={game.date} />
        </div>
      </CardContent>
    </Card>
  );
});

export default HomeGameCard; 