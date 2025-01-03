import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "./ui/card";
import { cn } from '../lib/utils';
import { sanitizeText } from '../lib/utils';
import { Play } from 'lucide-react';
import { Button } from './ui/button';

const RecentGameCard = ({ game, onPlay }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const sanitizedGameName = sanitizeText(game.game || game.name);

  // Load game image
  useEffect(() => {
    const loadGameImage = async () => {
      try {
        const imageBase64 = await window.electron.getGameImage(game.game || game.name);
        if (imageBase64) {
          setImageData(`data:image/jpeg;base64,${imageBase64}`);
        }
      } catch (error) {
        console.error('Error loading game image:', error);
      }
    };

    loadGameImage();
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
      return `${diffInDays}d ago`;
    }
  };

  return (
    <Card 
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-1"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-0">
        <div className="aspect-[4/3] relative">
          <img 
            src={imageData || '/game-placeholder.png'} 
            alt={game.game || game.name}
            className="w-full h-full object-cover"
          />
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "flex flex-col justify-between p-4 text-white"
          )}>
            <div className="flex justify-end">
              <Button
                size="icon"
                variant="secondary"
                className={cn(
                  "w-10 h-10 rounded-full backdrop-blur-sm",
                  isRunning 
                    ? "bg-white/5 hover:bg-white/5 cursor-not-allowed" 
                    : "bg-white/10 hover:bg-white/20"
                )}
                onClick={handlePlay}
                disabled={isRunning}
                title={isRunning ? "Game is running" : "Play game"}
              >
                <Play className={cn("w-5 h-5", isRunning && "opacity-50")} />
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <h3 className="font-semibold text-lg line-clamp-2">
                  {sanitizedGameName}
                </h3>
                <span className="text-sm text-white/70">
                  {getTimeSinceLastPlayed()}
                </span>
              </div>
              {game.version && (
                <p className="text-sm text-white/70">
                  v{game.version}
                </p>
              )}
              <div className="flex gap-2">
                {game.online && (
                  <span className="px-2 py-1 rounded-full bg-primary/20 text-primary text-xs backdrop-blur-sm">
                    Online Fix
                  </span>
                )}
                {game.dlc && (
                  <span className="px-2 py-1 rounded-full bg-primary/20 text-primary text-xs backdrop-blur-sm">
                    DLC
                  </span>
                )}
                {isRunning && (
                  <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs backdrop-blur-sm">
                    Running
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentGameCard;
