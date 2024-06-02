import React, { useState, useEffect } from "react";
import CardComponent from "./GamesCard";
import GamesEmptyCard from "./GamesEmptyCard";
import { Spacer } from "@nextui-org/react";
import "../library.css"
const Games = () => {
  const [games, setGames] = useState([]);
  const [downloadingGames, setDownloadingGames] = useState([]);
  const [isUninstalling, setIsUninstalling] = useState({});
  const [isRunning, setIsRunning] = useState({});

  const toggleIsRunning = (game) => {
    setIsRunning((prevState) => ({
      ...prevState,
      [game]: !prevState[game],
    }));
  };

  const toggleIsUninstalling = (game) => {
    setIsUninstalling((prevState) => ({
      ...prevState,
      [game]: !prevState[game],
    }));
  };

  const getGames = async () => {
    try {
      const gamesData = await window.electron.getGames();
      if (Array.isArray(gamesData)) {
        const installedGames = [];
        const downloadingGames = [];
        gamesData.forEach(game => {
          if (game.downloadingdata && (game.downloadingdata.downloading || game.downloadingdata.error || game.downloadingdata.updating || game.downloadingdata.extracting)) {
            downloadingGames.push(game);
          } else {
            installedGames.push(game);
          }
        });
        setGames(installedGames);
        setDownloadingGames(downloadingGames);
      } else {
        console.error("Invalid data format received:", gamesData);
      }
    } catch (error) {
      console.error("Error fetching games:", error);
    }
  };

  useEffect(() => {
    getGames();
    const intervalId = setInterval(getGames, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const renderCards = (gameList) => {
    if (gameList.length === 0) {
      return <GamesEmptyCard />;
    }
  
    return gameList.flatMap((game, index) => {
      if (game.downloadingdata && (game.downloadingdata.error || game.downloadingdata.downloading || game.downloadingdata.updating || game.downloadingdata.extracting)) {
        return null;
      }
      return [
        index > 0 && <Spacer key={`spacer-${index}`} x={4} />,
        <CardComponent
          key={`game-${index}`}
          game={game.game}
          online={game.online}
          dlc={game.dlc}
          version={game.version}
          path={game.executable}
          isRunning={game.isrunning}
          isUninstalling={isUninstalling[game.game] || false}
          toggleIsUninstalling={() => toggleIsUninstalling(game.game)}
        />
      ];
    });
  };

  return (
    <div className="flex flex-wrap">
    {renderCards(games)}
    </div>
  );
};

export default Games;
