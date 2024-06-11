import React, { useState, useEffect } from "react";
import { Button, Dropdown, Spacer } from "@nextui-org/react";
import Games from "./Library/Games/GamesGet";
import { AddGamesIcon } from "./Library/Games/svg/AddGame"
import { HaltIcon } from "./Library/DownloadManager/HaltIcon"
import Downloads from "./Library/DownloadManager/DownloadManager";
import NewLibrary from "./Library/NewLibrary";
import GamesAddModal from "./Library/Games/GamesAdd";

const Library = () => {
  const [games, setGames] = useState([]);
  const [downloadingGames, setDownloadingGames] = useState([]);
  const [isGamesModalOpen, setIsGamesModalOpen] = useState(false);
  const toggleGamesModal = () => {
    setIsGamesModalOpen(!isGamesModalOpen);
  };

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
      <GamesAddModal isOpen={isGamesModalOpen} onOpenChange={toggleGamesModal} />
      <Spacer y={20} />
      {games.length === 0 && downloadingGames.length === 0 &&
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center">
            <NewLibrary />
            <Spacer y={5} />
            <Button variant="ghost" onClick={toggleGamesModal}>
                Add a Game
            </Button>
        </div>
       }
        <>
        {games.length > 0 && (
          <>
          <h1 className="text-large">
            Your Library
          <Button className="translate-y-1" isIconOnly variant="none" onClick={toggleGamesModal}>
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
            <h1 className="text-large">
              Queue
              <Dropdown className=''>
                <DropdownTrigger>
                  <HaltIcon width={20} height={20} />
                </DropdownTrigger>
                <DropdownMenu className='justify-center'>
                  <DropdownSection>
                    <DropdownItem variant='flat' color='danger' aria-label='Confirm' description='Are you sure you want to stop kill all downloads?' onClick="">
                      Stop all Downloads
                    </DropdownItem>
                  </DropdownSection>
                </DropdownMenu>
            </Dropdown>
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
