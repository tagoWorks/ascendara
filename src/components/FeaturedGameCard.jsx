import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import imageCacheService from '../services/imageCacheService';
import { sanitizeText } from '../lib/utils';

function FeaturedGameCard({ game, isActive = false }) {
  const [cachedImage, setCachedImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const sanitizedGameName = sanitizeText(game.game);

  useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      if (!game.imgID) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const cached = await imageCacheService.getImage(game.imgID);
      
      if (mounted) {
        setCachedImage(cached);
        setLoading(false);
      }
    };

    loadImage();
    return () => { mounted = false; };
  }, [game.imgID]);

  return (
    <div 
      className={`relative w-full h-full flex-shrink-0 transition-opacity duration-500 ${
        isActive ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {loading && (
        <Skeleton className="absolute inset-0 w-full h-full bg-muted" />
      )}
      {cachedImage && (
        <img 
          src={cachedImage}
          alt={sanitizedGameName}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-center gap-2 text-white/80 mb-2">
          <Download className="w-4 h-4" />
          <span>{parseInt(game.downloads || 0).toLocaleString()} downloads</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">{sanitizedGameName}</h1>
        <p className="text-gray-200 mb-4 line-clamp-2 max-w-2xl">{game.description}</p>
        <div className="flex gap-2">
          <Button size="lg" onClick={() => console.log('Download:', game.game)}>
            Download Now
          </Button>
          <Button size="lg" variant="outline" onClick={() => console.log('More info:', game.game)}>
            More Info
          </Button>
        </div>
        <div className="flex gap-2 mt-4">
          {game.category?.slice(0, 3).map((cat, index) => (
            <span 
              key={index} 
              className="px-2 py-1 bg-white/10 rounded text-sm text-white/90"
            >
              {cat}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FeaturedGameCard;