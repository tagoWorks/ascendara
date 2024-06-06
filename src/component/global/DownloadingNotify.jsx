import React from 'react';
import CardComponent from '../Library/DownloadManager/DownloadingCard';

const DownloadingNotification = ({ games }) => {
  return (
    <div className="downloading-notification">
      {games.map((game, index) => (
        <CardComponent key={index} game={game.game} version={game.version} downloadingdata={game.downloadingdata} />
      ))}
    </div>
  );
};

export default DownloadingNotification;
