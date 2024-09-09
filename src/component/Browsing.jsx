import React, { useState, useEffect } from "react";
import { Button, Pagination, Spacer, Spinner, Modal, ModalBody, ModalFooter, ModalContent, ModalHeader } from "@nextui-org/react";
import { HelpIcon } from "./GameSearch/svg/HelpIcon";
import { FlameIcon } from "./GameSearch/svg/FlameIcon";
import { CheckmarkIcon } from "./GameSearch/svg/CheckmarkIcon";
import "./GameSearch/browsing.css";
import SearchBox from "./GameSearch/SearchBox";
import CardComponent from "./GameSearch/GamesCard";
import ErrorCard from "./GameSearch/ErrorCard";
import Fuse from "fuse.js";

const CACHE_KEY = "cachedGamesLocalKey";
const CACHE_EXPIRY_KEY = "cacheExpiryLocalKey";
const METADATA_KEY = "cachedMetadataLocalKey";
const NEWS_CACHE_KEY = "cachedNewsLocalKey";
const NEWS_CACHE_EXPIRY_KEY = "newsCacheExpiryLocalKey";
const FORCE_REFRESH_INTERVAL = 30 * 60 * 1000;
const FORCE_REFRESH_KEY = "forceRefreshTime";

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
  const [forceRefreshTime, setForceRefreshTime] = useState(localStorage.getItem(FORCE_REFRESH_KEY));

  const handleForceRefresh = async () => {
    const currentTime = Date.now();
    if (forceRefreshTime && currentTime - forceRefreshTime < FORCE_REFRESH_INTERVAL) {
      alert("Chill out! You can force refresh once every 60 seconds.");
      return;
    }

    setForceRefreshTime(currentTime);
    localStorage.setItem(FORCE_REFRESH_KEY, currentTime.toString());

    const token = await getToken();
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

    localStorage.setItem(CACHE_KEY, JSON.stringify(data.games));
    localStorage.setItem(METADATA_KEY, JSON.stringify(data.metadata));
    const expiryTime = Date.now() + 60;
    localStorage.setItem(CACHE_EXPIRY_KEY, expiryTime.toString());
    setShowModal(false)
  };


  const handleHelpClick = () => {
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

    let cards = 6;

    if (width > 1600) {
      const extraWidthCards = Math.floor((width - 1600) / 100) * 0;
      cards += extraWidthCards;
    }

    if (height > 800) {
      const extraHeightCards = Math.floor((height - 800) / 100) * 2;
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
          const sortedGames = cachedGames
            .map(game => ({ ...game, weight: Number(game.weight) }))
            .sort((a, b) => b.weight - a.weight);
          setGames(sortedGames);
          setFilteredGames(sortedGames);
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
          const sortedGames = data.games
            .map(game => ({ ...game, weight: Number(game.weight) })) 
            .sort((a, b) => b.weight - a.weight);
          setMetadata(data.metadata);
          setGames(sortedGames);
          setFilteredGames(sortedGames);
          setLoading(false);
          setError(false);
          setRetryCount(0);
  
          localStorage.setItem(CACHE_KEY, JSON.stringify(sortedGames));
          localStorage.setItem(METADATA_KEY, JSON.stringify(data.metadata));
          const expiryTime = Date.now() + 60;
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
      const filtered = games
        .filter((game) => (showOnlineOnly ? game.online : true))
        .map(game => ({ ...game, weight: Number(game.weight) }))
        .sort((a, b) => b.weight - a.weight);
      setFilteredGames(filtered);
    } else {
      const options = {
        keys: ["game"],
        threshold: 0.3,
      };
  
      const fuse = new Fuse(games, options);
      const result = fuse.search(query);
      const filtered = result.map(({ item }) => item).filter((game) => (showOnlineOnly ? game.online : true));
      const sortedFiltered = filtered
        .map(game => ({ ...game, weight: Number(game.weight) }))
        .sort((a, b) => b.weight - a.weight);
  
      setFilteredGames(sortedFiltered);
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
      <div style={{ flex: 3, overflowY: "hidden", marginRight: "1rem", }}>
        <div className="flex items-center justify-between">
        <h1 className="py-4 text-small font-medium">
            Indexed Games: {metadata.games} | Current Source: {metadata.source}
          </h1>
          <Button isIconOnly color="none" onClick={handleHelpClick}>
            <HelpIcon size={18} />
          </Button>
          <SearchBox onSearch={handleSearch} />
          <Spacer y={2}/>
        <div className="flex flex-col items-center gap-8">
        <Spacer y="3"/>
        {loading ? (
          <Spinner size="lg"/>
        ) : error ? (
          <ErrorCard message="Failed to load games. Please try again later." />
        ) : currentGames.length === 0 ? (
          <ErrorCard message="We couldn't find that game :(" />
        ) : (
            <>
              <div className="flex gap-3">
                {currentGames.map((game, index) => (
                  <CardComponent
                  key={index}
                  game={game.game}
                  online={game.online}
                  version={game.version}
                  size={game.size}
                  imgID={game.imgID}
                  dirlink={game.dirlink}
                  dlc={game.dlc}
                  downloadLinks={game.download_links}
                  verified={game.verified ? (
                    <CheckmarkIcon className="fixed-icon-size" size={18} />
                  ) : null}
                  popular={game.popular ? (
                    <FlameIcon className="fixed-icon-size" size={18} />
                  ) : null}
                />
                ))}
              </div>
              <Spacer y={1} />
              {filteredGames.length > cardsPerPage && (
                <Pagination
                  variant="none"
                  color="secondary"
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
      </div>
      <div className="news-container">
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
              <p className="text-small text-default-400" >{article.date}</p>
              <p>{article.body}</p>
            </div>
          ))
        )}
      </div>
      <Modal hideCloseButton classNames={{body: "py-6",backdrop: "bg-[#292f46]/50",base: "border-[#292f46] bg-[#19172c] dark:bg-[#19172c] fixed arial",}} isOpen={showModal} onClose={handleCloseModal}>
        <ModalContent>
        <ModalHeader>Indexed Source</ModalHeader>
        <ModalBody>
          <h1 className="text-small">Ascendara Sources are the websites that hold all of the games along with their download links. These are indexed every few weeks in order to keep up with the latest games.</h1>
          <p>Source: {metadata.source}</p>
          <p>Indexed Games: {metadata.games}</p>
          <p>Last updated: {metadata.getDate}</p>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" variant="ghost" onClick={() => window.electron.openURL('https://github.com/tagoWorks/ascendara/wiki/Current-Sources')}>
            Read More
          </Button>
          <Button color="none" variant="ghost" onClick={() => {
              handleForceRefresh();
              window.location.reload();}}>
            Force Refresh
          </Button>
        </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default GameBrowse;