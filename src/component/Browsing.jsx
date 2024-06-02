import React, { useState, useEffect } from "react";
import { Button, Pagination, Spacer, Spinner } from "@nextui-org/react";
import { HelpIcon } from "./GameSearch/HelpIcon";
import "./GameSearch/browsing.css";
import SearchBox from "./GameSearch/SearchBox";
import CardComponent from "./GameSearch/GamesCard";
import ErrorCard from "./GameSearch/ErrorCard";

const CACHE_KEY = "cachedGames";
const CACHE_EXPIRY_KEY = "cacheExpiry";
const METADATA_KEY = "cachedMetadata";

const GameBrowse = () => {
  const [games, setGames] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [filteredGames, setFilteredGames] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [cardsPerPage, setCardsPerPage] = useState(10);


  const updateCardsPerPage = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    let cards = 10;

    if (width > 1600) {
      const extraWidthCards = Math.floor((width - 1600) / 100) * 3;
      cards += extraWidthCards;
    }

    if (height > 800) {
      const extraHeightCards = Math.floor((height - 800) / 100) * 3;
      cards += extraHeightCards;
    }

    setCardsPerPage(cards);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cachedGames = JSON.parse(localStorage.getItem(CACHE_KEY));
        const cacheExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);
        const cachedMetadata = JSON.parse(localStorage.getItem(METADATA_KEY));
        if (
          cachedGames &&
          cacheExpiry &&
          cachedMetadata &&
          Date.now() < parseInt(cacheExpiry)
        ) {
          setGames(cachedGames);
          setFilteredGames(cachedGames);
          setMetadata(cachedMetadata);
          setLoading(false);
          setError(false);
          return;
        }
        const response = await fetch("https://api.ascendara.app/json/games", {
        });
        const data = await response.json();
        setMetadata(data.metadata);
        setGames(data.games);
        setFilteredGames(data.games);
        setLoading(false);
        setError(false);
        setRetryCount(0);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.games));
        localStorage.setItem(METADATA_KEY, JSON.stringify(data.metadata));
        const expiryTime = Date.now() + 3600000;
        localStorage.setItem(CACHE_EXPIRY_KEY, expiryTime.toString());
      } catch (error) {
        console.error("Error fetching games:", error);
        if (retryCount < 3) {
          setRetryCount(retryCount + 1);
          setTimeout(fetchData, 5000);
        } else {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchData();
    updateCardsPerPage();
    window.addEventListener("resize", updateCardsPerPage);

    return () => {
      window.removeEventListener("resize", updateCardsPerPage);
    };
  }, [retryCount]);

  const handleSearch = (query, showOnlineOnly) => {
    const filtered = games.filter((game) => {
      const gameNameMatch = game.game.toLowerCase().includes(query.toLowerCase());
      const isOnlineMatch = showOnlineOnly ? game.online : true;
      return gameNameMatch && isOnlineMatch;
    });
    setFilteredGames(filtered);
    setCurrentPage(1);
  };

  const indexOfLastGame = currentPage * cardsPerPage;
  const indexOfFirstGame = indexOfLastGame - cardsPerPage;
  const currentGames = filteredGames.slice(indexOfFirstGame, indexOfLastGame);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="px-20 py-4" style={{ padding: "1rem 20rem" }}>
      <div className="flex items-center justify-between">
        <h1 className="py-4 text-small font-medium">
          Indexed Games: {metadata.games} | Current Source: {metadata.source}
        </h1>
        <Button isIconOnly color="none">
          <HelpIcon size={18} />
        </Button>
      </div>
      <SearchBox onSearch={handleSearch} />
      <Spacer y={10} />
      <div className="flex flex-col items-center gap-8">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorCard message="Failed to load games. Please try again later." />
        ) : currentGames.length === 0 ? (
          <ErrorCard message="We couldn't find that game :(" />
        ) : (
          <>
            <div className="container scrollable-box flex justify-center gap-4">
              {currentGames.map((game, index) => (
                <CardComponent
                  key={index}
                  game={game.game}
                  online={game.online}
                  version={game.version}
                  dirlink={game.dirlink}
                  dlc={game.dlc}
                  downloadLinks={game.download_links}
                />
              ))}
            </div>
            <Spacer y={10} />
            {filteredGames.length > cardsPerPage && (
              <Pagination
                total={Math.ceil(filteredGames.length / cardsPerPage)}
                initialPage={1}
                className="pagination"
                onChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GameBrowse;
