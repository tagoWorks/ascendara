import React, { useState, useEffect } from "react";
import CardComponent from "./GamesCard";
import CustomCardComponent from "./CustomGamesCard";
import GamesEmptyCard from "./GamesEmptyCard";
import { Spacer } from "@nextui-org/react";
import "../library.css"

const Games = () => {
  const [games, setGames] = useState([]);
  const [customGames, setCustomGames] = useState([]);
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
        gamesData.forEach((game) => {
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

  const getCustomGames = async () => {
    try {
      const customGamesData = await window.electron.getCustomGames();
      if (Array.isArray(customGamesData)) {
        setCustomGames(customGamesData);
      } else {
        console.error("Invalid data format received:", customGamesData);
      }
    } catch (error) {
      console.error("Error fetching custom games:", error);
    }
  };

  useEffect(() => {
    getGames();
    getCustomGames();
    const intervalId = setInterval(() => {
      getGames();
      getCustomGames();
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const renderCards = (gameList, isCustom) => {
    return gameList.flatMap((game, index) => {
      if (game.downloadingdata && (game.downloadingdata.error || game.downloadingdata.downloading || game.downloadingdata.updating || game.downloadingdata.extracting)) {
        return null;
      }
      const CardComponentToUse = isCustom ? CustomCardComponent : CardComponent;
      return [
        index > 0 && <Spacer key={`spacer-${index}`} x={4} />,
        <CardComponentToUse
          key={`game-${index}`}
          game={game.game}
          online={game.online}
          dlc={game.dlc}
          version={game.version}
          path={game.executable}
          isRunning={game.isrunning}
          isUninstalling={isUninstalling[game.game] || false}
          toggleIsUninstalling={() => toggleIsUninstalling(game.game)}
        />,
      ];
    });
  };

return (
  <div className="flex flex-wrap">
    {renderCards(games, false)}
    <Spacer x={4} /> {/* Add a spacer between the two lists */}
    {renderCards(customGames, true)}
  </div>
);
};

export default Games;