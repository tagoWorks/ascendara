import React, { useState, useEffect } from "react";
import CardComponent from "./GamesCard";
import CustomCardComponent from "./CustomGamesCard";
import { Spacer, Input, Pagination } from "@nextui-org/react";
import "../library.css";

const Games = () => {
  const [games, setGames] = useState([]);
  const [customGames, setCustomGames] = useState([]);
  const [downloadingGames, setDownloadingGames] = useState([]);
  const [isUninstalling, setIsUninstalling] = useState({});
  const [isRunning, setIsRunning] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [cardsPerPage, setCardsPerPage] = useState(6);

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
          if (game.downloadingData && (game.downloadingData.downloading || game.downloadingData.error || game.downloadingData.updating || game.downloadingData.extracting)) {
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

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  const filterGames = (gameList) => {
    return gameList.filter((game) => game.game.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const combinedFilteredGames = [...filterGames(games), ...filterGames(customGames)];
  const totalFilteredGames = combinedFilteredGames.length;
  const totalPages = Math.ceil(totalFilteredGames / cardsPerPage);

  const startIndex = (currentPage - 1) * cardsPerPage;
  const endIndex = startIndex + cardsPerPage;
  const paginatedGames = combinedFilteredGames.slice(startIndex, endIndex);

  const renderCards = (gameList, isCustom) => {
    const CardComponentToUse = isCustom ? CustomCardComponent : CardComponent;
    return gameList.map((game, index) => {
      if (game.downloadingData && (game.downloadingData.error || game.downloadingData.downloading || game.downloadingData.updating || game.downloadingData.extracting)) {
        return null;
      }
      return (
        <React.Fragment key={`game-${index}`}>
          {index > 0 && <Spacer x={4} />}
          <CardComponentToUse
            game={game.game}
            online={game.online}
            dlc={game.dlc}
            version={game.version}
            path={game.executable}
            isRunning={game.isrunning}
            isUninstalling={isUninstalling[game.game] || false}
            toggleIsUninstalling={() => toggleIsUninstalling(game.game)}
          />
        </React.Fragment>
      );
    });
  };

  return (
    <>
      <Input className="librarysearchbar" value={searchQuery} onChange={handleSearch} placeholder="Search for games" />
      <Spacer y={7} />
      <div className="flex flex-wrap">
        <Spacer x={4} />
        {renderCards(paginatedGames.filter(game => !customGames.includes(game)), false)}
        <Spacer x={4} />
        {renderCards(paginatedGames.filter(game => customGames.includes(game)), true)}
      </div>
      {totalFilteredGames > cardsPerPage && (
        <Pagination
          color="secondary"
          variant="none"
          className="librarypagination"
          total={totalPages}
          page={currentPage}
          onChange={(page) => setCurrentPage(page)}
        />
      )}
    </>
  );
};

export default Games;