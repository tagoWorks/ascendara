import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "./ui/card";
import { cn } from '../lib/utils';
import { sanitizeText } from '../lib/utils';
import { Play } from 'lucide-react';
import { Button } from './ui/button';
import { AspectRatio } from './ui/aspect-ratio';
import { Skeleton } from './ui/skeleton';

const RecentGameCard = ({ game, onPlay }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const sanitizedGameName = sanitizeText(game.game || game.name);

  // Load game image
  useEffect(() => {
    let isMounted = true;

    const loadGameImage = async () => {
      try {
        const imageBase64 = await window.electron.getGameImage(game.game || game.name);
        if (imageBase64 && isMounted) {
          setImageData(`data:image/jpeg;base64,${imageBase64}`);
        }
      } catch (error) {
        console.error('Error loading game image:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadGameImage();
    return () => { isMounted = false; };
  }, [game]);

  // Check if game is running
  useEffect(() => {
    const checkGameStatus = setInterval(async () => {
      const running = await window.electron.isGameRunning(game.game || game.name);
      setIsRunning(running);
    }, 1000);

    return () => clearInterval(checkGameStatus);
  }, [game]);

  const handlePlay = (e) => {
    e.stopPropagation();
    onPlay(game);
  };

  const getTimeSinceLastPlayed = () => {
    const lastPlayed = new Date(game.lastPlayed);
    const now = new Date();
    const diffInHours = Math.floor((now - lastPlayed) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) {
        return 'Yesterday';
      } else {
        return `${diffInDays}d ago`;
      }
    }
  };

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-300',
        'hover:shadow-lg cursor-pointer',
        isRunning && 'ring-2 ring-primary'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-0">
        <AspectRatio ratio={16/9}>
          <div className="w-full h-full relative">
            {loading && (
              <Skeleton className="w-full h-full absolute inset-0" />
            )}
            {!loading && imageData && (
              <img
                src={imageData}
                alt={sanitizedGameName}
                className={cn(
                  'w-full h-full object-cover transition-transform duration-300',
                  isHovered && 'scale-110'
                )}
              />
            )}
            <div 
              className={cn(
                'absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent',
                'transition-opacity duration-300',
                isHovered ? 'opacity-100' : 'opacity-80'
              )}
            >
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className={cn(
                      'text-lg font-semibold text-white line-clamp-1',
                      'transition-transform duration-300',
                      isHovered ? 'translate-x-2' : 'translate-x-0'
                    )}>
                      {sanitizedGameName}
                    </h3>
                    <p className={cn(
                      'text-sm text-white/80',
                      'transition-transform duration-300',
                      isHovered ? 'translate-x-2' : 'translate-x-0'
                    )}>
                      {getTimeSinceLastPlayed()}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      'text-white hover:text-primary hover:bg-white/20',
                      'transition-transform duration-300',
                      isHovered ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
                    )}
                    onClick={handlePlay}
                  >
                    <Play className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </AspectRatio>
      </CardContent>
    </Card>
  );
};

export default RecentGameCard;
