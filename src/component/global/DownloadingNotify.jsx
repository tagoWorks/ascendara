import React from 'react';
import CardComponent from '../Library/DownloadManager/DownloadingCard';

const DownloadingNotification = ({ games }) => {
  return (
    <div className="downloading-notification">
      {games.map((game, index) => (
        <CardComponent key={index} game={game.game} version={game.version} downloadingData={game.downloadingData} />
      ))}
    </div>
  );
};

export default DownloadingNotification;
