import React, { useState, useEffect } from "react";
import { Button, Spacer, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@nextui-org/react";
import Games from "./Library/Games/GamesGet";
import { AddGamesIcon } from "./Library/Games/svg/AddGame";
import Downloads from "./Library/DownloadManager/DownloadManager";
import NewLibrary from "./Library/NewLibrary";
import GamesAddModal from "./Library/Games/GamesAdd";
import "../styles.css";

const Library = () => {
  const [games, setGames] = useState([]);
  const [downloadingGames, setDownloadingGames] = useState([]);
  const [customGames, setCustomGames] = useState([]);
  const [isGamesModalOpen, setIsGamesModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);
  const [totalSpace, setTotalSpace] = useState(0);
  const [spaceUsed, setSpaceUsed] = useState(0);
  const gamesPerPage = 8;

  const toggleGamesModal = async () => {  
    try {
    const downloadDir = await window.electron.getDownloadDirectory();

    if (downloadDir == '') {
      setShowDirectoryModal(true);
    } else {
      setIsGamesModalOpen(!isGamesModalOpen);
    }
  }
    catch (error){
      console.error("Failed to fetch directory:",) 
    }
  };

  const getGames = async () => {
    try {
      const gamesData = await window.electron.getGames();
      if (Array.isArray(gamesData)) {
        const installedGames = [];
        const downloadingGames = [];
        gamesData.forEach((game) => {
          if (game.downloadingData) {
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

  const fetchCustomGames = async () => {
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


  const getSpaceStats = async () => {
    try {
      const totalSpaceValue = await window.electron.getTotalSpace();
      setTotalSpace(totalSpaceValue);
      const spaceUsedValue = await window.electron.getSpaceUsed();
      setSpaceUsed(spaceUsedValue);
    } catch (error) {
      console.error("Error fetching space stats:", error);
    }
  };

  /* useEffect(() => {getSpaceStats();}); */


  useEffect(() => {
    getGames();
    const intervalId = setInterval(getGames, 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    fetchCustomGames();
    const intervalId = setInterval(fetchCustomGames, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const displayedGames = games.length > 0 
   ? games.slice((currentPage - 1) * gamesPerPage, currentPage * gamesPerPage) 
    : customGames.slice((currentPage - 1) * gamesPerPage, currentPage * gamesPerPage);

  const totalPages = Math.ceil((games.length > 0? games.length : customGames.length) / gamesPerPage);

  return (
    <div className="library-container">
      <GamesAddModal isOpen={isGamesModalOpen} onOpenChange={toggleGamesModal} />
      <Modal
        hideCloseButton
        isDismissable
        isOpen={showDirectoryModal}
        onClose={() => setShowDirectoryModal(false)}
        size="md"
        className="fixed arial"
      >
        <ModalContent>
          <ModalHeader>You can't do that yet...</ModalHeader>
          <ModalBody>
            <p>
              You need to set a directory for Ascendara to work with! Please set a games directory by clicking the
              settings button on the bottom left, then click on the Download Directory input.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              color="success"
              onClick={() => setShowDirectoryModal(false)}
            >
              Okay
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {games.length === 0 && customGames.length === 0 && downloadingGames.length === 0 ? (
        <div className="empty-library">
          <NewLibrary />
          <Spacer y={5} />
          <Button color="default" variant="ghost" onClick={toggleGamesModal}>
            Add a Game
          </Button>
        </div>
      ) : (
        <>
          <div className="library-header">
            <h1 className="library-title">
              Your Library
              <Button isIconOnly variant="light" onClick={toggleGamesModal}>
                <AddGamesIcon width={20} height={20} />
              </Button>
            </h1>
          </div>
          <div className="games-grid-container">
            <Games games={displayedGames} />
          </div>
          {downloadingGames.length > 0 && (
            <div className="downloads-section">
              <h2 className="downloads-title">Downloads</h2>
              <Downloads games={downloadingGames} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Library;