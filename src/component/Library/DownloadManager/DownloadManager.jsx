import React, { useState, useEffect } from 'react';
import CardComponent from './DownloadingCard';

const DownloadManager = () => {
  const [downloadingGames, setDownloadingGames] = useState([]);
  const [previouslyDownloading, setPreviouslyDownloading] = useState(false);

  useEffect(() => {
    const fetchDownloadingGames = async () => {
      try {
        const games = await window.electron.getGames();
        setDownloadingGames(games);
      } catch (error) {
        console.error('Error fetching downloading games:', error);
      }
    };

    fetchDownloadingGames();
    const intervalId = setInterval(fetchDownloadingGames, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const shouldRenderCard = downloadingGames.some((game) => {
    const { downloadingdata } = game;
    return (
      downloadingdata &&
      (downloadingdata.downloading ||
        downloadingdata.extracting ||
        downloadingdata.updating ||
        downloadingdata.error)
    );
  });

  if (shouldRenderCard && !previouslyDownloading) {
    console.log('Download has started');
    setPreviouslyDownloading(true);
  }

  if (!shouldRenderCard && previouslyDownloading) {
    console.log('Download is done');
    setPreviouslyDownloading(false);
  }

  return (
    <div className="flex flex-col gap-4 downloadcards">
      {shouldRenderCard &&
        downloadingGames.map((game) => (
          <CardComponent
            key={game.game}
            game={game.game}
            online={game.online}
            version={game.version}
            dirlink={game.dirlink}
            downloadingdata={game.downloadingdata || {}}
          />
        ))}
    </div>
  );
};

export default DownloadManager;