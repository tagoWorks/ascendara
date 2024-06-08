import React, { useState, useEffect } from "react";
import { Button, Pagination, Spacer, Spinner, Modal, ModalBody, ModalFooter, ModalContent, ModalHeader } from "@nextui-org/react";
import { HelpIcon } from "./GameSearch/HelpIcon";
import "./GameSearch/browsing.css";
import SearchBox from "./GameSearch/SearchBox";
import CardComponent from "./GameSearch/GamesCard";
import ErrorCard from "./GameSearch/ErrorCard";
import Fuse from "fuse.js";

const CACHE_KEY = "cachedGames";
const CACHE_EXPIRY_KEY = "cacheExpiry";
const METADATA_KEY = "cachedMetadata";
const NEWS_CACHE_KEY = "cachedNews";
const NEWS_CACHE_EXPIRY_KEY = "newsCacheExpiry";

const GameBrowse = () => {
  const [games, setGames] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [filteredGames, setFilteredGames] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [cardsPerPage, setCardsPerPage] = useState(10);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleHelpClick = () => {
    console.log(metadata.getDate)
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const getToken = async () => {
    const AUTHORIZATION = await window.electron.getAPIKey();
    const response = await fetch("https://api.ascendara.app/auth/token", {
      headers: {
        Authorization: `Bearer ${AUTHORIZATION}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.token;
    } else {
      throw new Error("Failed to obtain token");
    }
  };

  const fetchNews = async (token) => {
    try {
      const cachedNews = JSON.parse(localStorage.getItem(NEWS_CACHE_KEY));
      const newsCacheExpiry = localStorage.getItem(NEWS_CACHE_EXPIRY_KEY);
      if (cachedNews && newsCacheExpiry && Date.now() < parseInt(newsCacheExpiry)) {
        setNews(cachedNews);
        setNewsLoading(false);
        setNewsError(false);
      } else {
        const response = await fetch("https://api.ascendara.app/json/news", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setNews(data.news);
        setNewsLoading(false);
        setNewsError(false);

        localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(data.news));
        const expiryTime = Date.now() + 1200000;
        localStorage.setItem(NEWS_CACHE_EXPIRY_KEY, expiryTime.toString());
      }
    } catch (error) {
      console.error("Error fetching news:", error);
      setNewsError(true);
      setNewsLoading(false);
    }
  };

  const updateCardsPerPage = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    let cards = 9;

    if (width > 1600) {
      const extraWidthCards = Math.floor((width - 1600) / 100) * 2;
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
        const token = await getToken();

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
        } else {
          const response = await fetch("https://api.ascendara.app/json/games", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
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
        }

        fetchNews(token);
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
    if (query.trim() === "") {
      setFilteredGames(games.filter((game) => (showOnlineOnly ? game.online : true)));
    } else {
      const options = {
        keys: ["game"],
        threshold: 0.3,
      };

      const fuse = new Fuse(games, options);
      const result = fuse.search(query);
      const filtered = result.map(({ item }) => item).filter((game) => (showOnlineOnly ? game.online : true));

      setFilteredGames(filtered);
    }

    setCurrentPage(1);
  };

  const indexOfLastGame = currentPage * cardsPerPage;
  const indexOfFirstGame = indexOfLastGame - cardsPerPage;
  const currentGames = filteredGames.slice(indexOfFirstGame, indexOfLastGame);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div style={{ padding: "5rem", display: "flex", height: "100vh" }}>
      <div style={{ flex: 3, overflowY: "hidden", marginRight: "1rem" }}>
        <div className="flex items-center justify-between">
          <h1 className="py-4 text-small font-medium">
            Indexed Games: {metadata.games} | Current Source: {metadata.source}
          </h1>
          <Button isIconOnly color="none" onClick={handleHelpClick}>
            <HelpIcon size={18} />
          </Button>
          <SearchBox onSearch={handleSearch} />
        </div>
        <div className="flex flex-col items-center gap-8">
          <Spacer y="3" />
          {loading ? (
            <Spinner />
          ) : error ? (
            <ErrorCard message="Failed to load games. Please try again later." />
          ) : currentGames.length === 0 ? (
            <ErrorCard message="We couldn't find that game :(" />
          ) : (
            <>
              <div className="flex justify-center gap-4">
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
              <Spacer y={1} />
              {filteredGames.length > cardsPerPage && (
                <Pagination
                  total={Math.ceil(filteredGames.length / cardsPerPage)}
                  isCompact
                  initialPage={1}
                  className="pagination"
                  onChange={handlePageChange}
                />
              )}
            </>
          )}
        </div>
      </div>
      <div className="news-container" style={{ flex: 1, overflowY: "auto" }}>
        {newsLoading ? (
          <Spinner />
        ) : newsError ? (
          <ErrorCard message="Failed to load news. Please try again later." />
        ) : news.length === 0 ? (
          <ErrorCard message="No news available." />
        ) : (
          news.map((article, index) => (
            <div key={index} className="news-section">
              <h2>{article.title}</h2>
              <p className="text-small text-default-400">{article.date}</p>
              <p>{article.body}</p>
            </div>
          ))
        )}
      </div>
      <Modal isOpen={showModal} onClose={handleCloseModal}>
        <ModalContent>
        <ModalHeader>Indexed Source</ModalHeader>
        <ModalBody>
          <h1 className="text-small">Ascendara Sources are the websites that hold all of the games along with their download links. These are indexed every few weeks in order to keep up with the latest games</h1>
          <p>Source: {metadata.source}</p>
          <p>Indexed Games: {metadata.games}</p>
          <p>Last updated: {metadata.getDate}</p>
        </ModalBody>
        <ModalFooter>
          <Button auto onClick={handleCloseModal}>
            Close
          </Button>
          <Button>
            <a href="https://docs.ascendara.app/" target="_blank">Read More</a>
          </Button>
        </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default GameBrowse;