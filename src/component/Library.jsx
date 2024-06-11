import React, { useState, useEffect } from "react";
import { Button, Divider, Spacer } from "@nextui-org/react";
import Games from "./Library/Games/GamesGet";
import { AddGamesIcon } from "./Library/Games/svg/AddGame"
import Downloads from "./Library/DownloadManager/DownloadManager";
import NewLibrary from "./Library/NewLibrary";

const Library = () => {
  const [games, setGames] = useState([]);
  const [downloadingGames, setDownloadingGames] = useState([]);

  const getGames = async () => {
    try {
      const gamesData = await window.electron.getGames();
      if (Array.isArray(gamesData)) {
        const installedGames = [];
        const downloadingGames = [];
        gamesData.forEach((game) => {
          if (game.downloadingdata) {
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

  return (
    <div>
      <Spacer y={20} />
      {games.length === 0 && downloadingGames.length === 0 && <NewLibrary />}
        <>
        {games.length > 0 && (
          <>
          <h1 className="text-large font-medium quicksand">
            Your Library
          <Button className="translate-y-1" isIconOnly variant="none">
            <AddGamesIcon width={20} height={20} />
          </Button>
          </h1>
          <Spacer y={5} />
          <Games games={games} />
          </>
        )}
          {downloadingGames.length > 0 && (
          <>
            <Spacer y={20} />
            <h1 className="text-large ">
              Queue
            </h1>
            <Spacer y={5} />
            <Downloads games={downloadingGames} />
          </>
          )}
        </>
    </div>
  );
};

export default Library;
